import { z } from "zod";
import { ghJson } from "../lib/gh.js";

/** Used only for fallback GitHub search queries (`<host>/browse/KEY`). */
const JIRA_BROWSE_HOST =
  process.env["JIRA_BROWSE_HOST"] ?? "axilis.atlassian.net";

const SEARCH_LIMIT_PER_QUERY = 40;
const MAX_PRS_PER_TICKET = 10;

export const matchTicketsSchema = z.object({
  ticket_keys: z
    .array(z.string())
    .min(1)
    .max(200)
    .describe("Jira ticket keys to match against GitHub PRs (e.g. ['PAM-123', 'LOY-456'])"),
});

export type MatchTicketsInput = z.infer<typeof matchTicketsSchema>;

interface PrMatch {
  title: string;
  url: string;
  repo: string;
  author: string;
  mergedAt: string;
  additions: number;
  deletions: number;
  files: number;
}

interface SearchResult {
  title: string;
  url: string;
  repository: { nameWithOwner: string };
  author?: { login: string };
  body?: string | null;
}

interface PrDetails {
  additions: number;
  deletions: number;
  changedFiles: number;
  mergedAt: string | null;
}

function ticketKeyRegex(key: string): RegExp {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i");
}

function titleBodyMentionsKey(pr: SearchResult, re: RegExp): boolean {
  return re.test(pr.title ?? "") || re.test(pr.body ?? "");
}

/** Prefer PRs whose title references the ticket (common `[KEY]` convention). */
function candidateSortScore(pr: SearchResult, re: RegExp): number {
  const t = pr.title ?? "";
  const b = pr.body ?? "";
  if (re.test(t)) return 2;
  if (re.test(b)) return 1;
  return 0;
}

async function ghSearchPrs(
  query: string,
  org: string,
): Promise<SearchResult[]> {
  try {
    return await ghJson<SearchResult[]>([
      "search",
      "prs",
      query,
      `--owner=${org}`,
      "--merged",
      "--json=title,url,repository,author,body",
      `--limit=${SEARCH_LIMIT_PER_QUERY}`,
    ]);
  } catch {
    return [];
  }
}

/**
 * Tiered GitHub PR discovery: precise `in:title` / `in:body` searches first,
 * then broader keyword and Jira URL patterns. Results are merged by PR URL
 * and filtered so the ticket key appears as a real token (word boundaries).
 */
async function discoverCandidatePrs(
  key: string,
  org: string,
): Promise<SearchResult[]> {
  const byUrl = new Map<string, SearchResult>();
  const merge = (rows: SearchResult[]) => {
    for (const pr of rows) {
      byUrl.set(pr.url, pr);
    }
  };

  merge(await ghSearchPrs(`"${key}" in:title`, org));
  merge(await ghSearchPrs(`"${key}" in:body`, org));

  const re = ticketKeyRegex(key);
  let list = [...byUrl.values()].filter((pr) => titleBodyMentionsKey(pr, re));

  if (list.length === 0) {
    merge(await ghSearchPrs(key, org));
    merge(await ghSearchPrs(`browse/${key}`, org));
    merge(
      await ghSearchPrs(`${JIRA_BROWSE_HOST.replace(/\/$/, "")}/browse/${key}`, org),
    );
    list = [...byUrl.values()].filter((pr) => titleBodyMentionsKey(pr, re));
  }

  list.sort((a, b) => candidateSortScore(b, re) - candidateSortScore(a, re));
  return list;
}

async function enrichPr(pr: SearchResult): Promise<PrMatch | null> {
  try {
    const d = await ghJson<PrDetails>([
      "pr",
      "view",
      pr.url,
      "--json=additions,deletions,changedFiles,mergedAt",
    ]);
    return {
      title: pr.title,
      url: pr.url,
      repo: pr.repository.nameWithOwner,
      author: pr.author?.login ?? "unknown",
      mergedAt: d.mergedAt ?? "",
      additions: d.additions,
      deletions: d.deletions,
      files: d.changedFiles,
    };
  } catch {
    return null;
  }
}

export async function matchTicketsToPrs(input: MatchTicketsInput, org: string) {
  const results: Record<string, PrMatch[]> = {};
  const batchSize = 5;

  for (let i = 0; i < input.ticket_keys.length; i += batchSize) {
    const batch = input.ticket_keys.slice(i, i + batchSize);
    const promises = batch.map(async (key) => {
      try {
        const candidates = await discoverCandidatePrs(key, org);

        const enriched: PrMatch[] = [];
        for (const pr of candidates.slice(0, MAX_PRS_PER_TICKET)) {
          const row = await enrichPr(pr);
          if (row) enriched.push(row);
        }

        results[key] = enriched;
      } catch {
        results[key] = [];
      }
    });

    await Promise.all(promises);
  }

  const matched = Object.entries(results).filter(([, prs]) => prs.length > 0);
  const unmatched = Object.entries(results).filter(([, prs]) => prs.length === 0);

  const lines: string[] = [
    `Matched ${matched.length} of ${input.ticket_keys.length} tickets to GitHub PRs.`,
    "",
  ];

  if (matched.length > 0) {
    lines.push("## Matched Tickets", "");
    for (const [key, prs] of matched) {
      lines.push(`### ${key} (${prs.length} PR${prs.length > 1 ? "s" : ""})`);
      for (const pr of prs) {
        lines.push(
          `- **${pr.title}**`,
          `  Repo: ${pr.repo} | Author: ${pr.author} | Merged: ${pr.mergedAt?.split("T")[0] ?? "unknown"}`,
          `  +${pr.additions} / -${pr.deletions} | ${pr.files} files`,
          `  ${pr.url}`,
        );
      }
      lines.push("");
    }
  }

  if (unmatched.length > 0) {
    lines.push(
      `## Unmatched Tickets (${unmatched.length})`,
      "",
      unmatched.map(([key]) => `- ${key}`).join("\n"),
      "",
    );
  }

  return {
    content: [{ type: "text" as const, text: lines.join("\n") }],
    structuredData: results,
  };
}
