#!/usr/bin/env node

import { McpServer, StdioServerTransport } from "@modelcontextprotocol/server";
import { z } from "zod";

import { searchReposSchema, searchRepos } from "./tools/search-repos.js";
import { searchCodeSchema, searchCode } from "./tools/search-code.js";
import { repoOverviewSchema, getRepoOverview } from "./tools/repo-overview.js";
import { searchPrsSchema, searchRecentPrs } from "./tools/search-prs.js";
import { prDetailsSchema, getPrDetails } from "./tools/pr-details.js";
import { publishEstimationSchema, publishEstimation } from "./tools/publish.js";
import { matchTicketsSchema, matchTicketsToPrs } from "./tools/match-tickets.js";
import { storeCalibrationSchema, storeCalibrationData } from "./tools/store-calibration.js";
import { getCalibrationSchema, getCalibrationStats } from "./tools/get-calibration.js";
import {
  ESTIMATE_FROM_PRD_PROMPT,
  buildEstimationPrompt,
} from "./prompts/estimate-from-prd.js";
import {
  CALIBRATE_FROM_JIRA_PROMPT,
  buildCalibrationPrompt,
} from "./prompts/calibrate-from-jira.js";

const ORG = process.env["GITHUB_ORG"] || "superbet-group";

const server = new McpServer({
  name: "prd-estimator",
  version: "1.0.0",
});

// --- Tools ---

server.registerTool(
  "search_org_repos",
  {
    title: "Search Org Repos",
    description: `Search repositories in the ${ORG} GitHub org by keywords. Use to find repos relevant to a PRD.`,
    inputSchema: searchReposSchema,
  },
  async (input) => searchRepos(input, ORG),
);

server.registerTool(
  "search_org_code",
  {
    title: "Search Org Code",
    description: `Search code across the ${ORG} GitHub org. Use to find where specific functions, APIs, or domain terms live.`,
    inputSchema: searchCodeSchema,
  },
  async (input) => searchCode(input, ORG),
);

server.registerTool(
  "get_repo_overview",
  {
    title: "Get Repo Overview",
    description:
      "Get a structured overview of a GitHub repo: README, file tree, languages, recent commits.",
    inputSchema: repoOverviewSchema,
  },
  async (input) => getRepoOverview(input),
);

server.registerTool(
  "search_recent_prs",
  {
    title: "Search Recent PRs",
    description: `Search merged PRs in the ${ORG} org. Use to find comparable past work for estimation calibration.`,
    inputSchema: searchPrsSchema,
  },
  async (input) => searchRecentPrs(input, ORG),
);

server.registerTool(
  "get_pr_details",
  {
    title: "Get PR Details",
    description:
      "Get full details of a PR: description, files changed, lines added/removed, review timeline.",
    inputSchema: prDetailsSchema,
  },
  async (input) => getPrDetails(input),
);

server.registerTool(
  "publish_estimation",
  {
    title: "Publish Estimation",
    description:
      "Generate a buffered estimation table and publish to both a local markdown file and Notion. " +
      "Automatically applies the configured buffer percentage (default 20%) to all estimates.",
    inputSchema: publishEstimationSchema,
  },
  async (input) => publishEstimation(input),
);

// --- Calibration Tools ---

server.registerTool(
  "match_tickets_to_prs",
  {
    title: "Match Tickets to PRs",
    description:
      `Batch-search the ${ORG} GitHub org for merged PRs matching Jira ticket keys. ` +
      "Returns a map of ticket key to matched PRs with lines changed, files, and merge dates.",
    inputSchema: matchTicketsSchema,
  },
  async (input) => matchTicketsToPrs(input, ORG),
);

server.registerTool(
  "store_calibration_data",
  {
    title: "Store Calibration Data",
    description:
      "Takes Jira ticket data, matched PR data, and employee tenure, then computes " +
      "historical statistics (cycle times, lines changed, tenure multipliers) and saves " +
      "to a local calibration.json file for use during future estimations.",
    inputSchema: storeCalibrationSchema,
  },
  async (input) => storeCalibrationData(input),
);

server.registerTool(
  "get_calibration_stats",
  {
    title: "Get Calibration Stats",
    description:
      "Reads cached calibration data and returns summary statistics: cycle times by issue type, " +
      "tenure multipliers, change size buckets. Optionally filter by project or issue type.",
    inputSchema: getCalibrationSchema,
  },
  async (input) => getCalibrationStats(input),
);

// --- Prompts ---

const promptArgsSchema = z.object({
  prd: z.string().describe("The full requirements document / PRD text to estimate"),
  buffer_percent: z
    .string()
    .optional()
    .describe("Buffer percentage to add to estimates (default 20)"),
});

server.registerPrompt(
  ESTIMATE_FROM_PRD_PROMPT.name,
  {
    title: "Estimate from PRD",
    description: ESTIMATE_FROM_PRD_PROMPT.description,
    argsSchema: promptArgsSchema,
  },
  async ({ prd, buffer_percent }) => {
    const buffer =
      buffer_percent !== undefined ? Number(buffer_percent) : 20;

    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: buildEstimationPrompt(prd, buffer),
          },
        },
      ],
    };
  },
);

const JIRA_CLOUD_ID = process.env["JIRA_CLOUD_ID"] || "axilis.atlassian.net";

const calibrateArgsSchema = z.object({
  cloud_id: z
    .string()
    .optional()
    .describe(`Jira cloud ID or site URL (default: ${JIRA_CLOUD_ID})`),
});

server.registerPrompt(
  CALIBRATE_FROM_JIRA_PROMPT.name,
  {
    title: "Calibrate from Jira",
    description: CALIBRATE_FROM_JIRA_PROMPT.description,
    argsSchema: calibrateArgsSchema,
  },
  async ({ cloud_id }) => {
    const cid = cloud_id ?? JIRA_CLOUD_ID;

    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: buildCalibrationPrompt(cid),
          },
        },
      ],
    };
  },
);

// --- Start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("prd-estimator MCP server running on stdio");
  console.error(`GitHub org: ${ORG}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
