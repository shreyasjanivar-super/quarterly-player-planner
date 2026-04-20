# PRD Estimator MCP Server

A Model Context Protocol (MCP) server for Cursor that turns requirements documents into data-driven effort estimations. It searches the superbet-group GitHub org, correlates with historical Jira ticket data, factors in employee tenure, and produces buffered estimation tables.

## How It Works

```
PRD / Requirements Document
        │
        ▼
┌─────────────────────────────────┐
│  1. Parse PRD for keywords      │
│  2. Search GitHub repos & code  │
│  3. Identify impacted repos     │
│  4. Break down work packages    │
│  5. Find comparable past PRs    │
│  6. Load historical calibration │
│  7. Estimate with 20% buffer    │
│  8. Publish to Markdown + Notion│
└─────────────────────────────────┘
        │
        ▼
  Estimation Table (markdown + Notion)
```

## Prerequisites

- **Node.js 20+** -- `brew install node`
- **GitHub CLI** -- `brew install gh` (must be authenticated: `gh auth login`)
- **Notion Integration** (optional) -- create one at https://www.notion.so/my-integrations
- **Jira / Atlassian MCP** (for calibration) -- already configured in Cursor via the Atlassian plugin
- **Snowflake MCP** (optional, for employee tenure) -- requires PAT token setup

## Setup

```bash
cd /Users/shreyasjanivara/Desktop/planpage/estimation
npm install
npm run build
```

## Cursor Configuration

The MCP is registered in `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "prd-estimator": {
      "type": "stdio",
      "command": "node",
      "args": ["/Users/shreyasjanivara/Desktop/planpage/estimation/build/index.js"],
      "env": {
        "GITHUB_ORG": "superbet-group",
        "JIRA_CLOUD_ID": "axilis.atlassian.net",
        "NOTION_API_KEY": "your-notion-api-key",
        "NOTION_PARENT_PAGE_ID": "your-parent-page-id"
      }
    }
  }
}
```

Restart Cursor after any config changes.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_ORG` | Yes | GitHub organisation to search (default: `superbet-group`) |
| `JIRA_CLOUD_ID` | Yes | Jira cloud ID or site URL (default: `axilis.atlassian.net`) |
| `NOTION_API_KEY` | No | Notion integration token for publishing estimations |
| `NOTION_PARENT_PAGE_ID` | No | Notion page ID where estimation sub-pages are created |

## Tools

### GitHub Analysis Tools

| Tool | Description |
|------|-------------|
| `search_org_repos` | Search repositories in the org by keywords |
| `search_org_code` | Search code across the org for functions, APIs, domain terms |
| `get_repo_overview` | Get a repo's README, file tree, languages, recent commits |
| `search_recent_prs` | Find merged PRs from the last N months |
| `get_pr_details` | Get full PR details: files changed, lines, reviews |

### Calibration Tools

| Tool | Description |
|------|-------------|
| `match_tickets_to_prs` | Batch-search GitHub for PRs matching Jira ticket keys |
| `store_calibration_data` | Compute historical statistics and save to `calibration.json` |
| `get_calibration_stats` | Read cached calibration data with optional project/type filters |

### Output Tools

| Tool | Description |
|------|-------------|
| `publish_estimation` | Generate estimation table with buffer, publish to markdown + Notion |

## Prompts

### `estimate_from_prd`

The primary estimation workflow. Guides the LLM through:

1. Loading calibration data (if available)
2. Parsing the PRD for features, keywords, and integration points
3. Searching GitHub to identify impacted repositories
4. Breaking down work into discrete work packages
5. Finding comparable past PRs for calibration
6. Estimating effort using historical data + PR complexity
7. Publishing the buffered estimation table

**Usage in Cursor:**

> Use the `estimate_from_prd` prompt with this PRD: [paste your PRD]

### `calibrate_from_jira`

Builds the historical calibration dataset. This is a one-time (or periodic) operation that:

1. Discovers all player-area projects from Jira
2. Pulls every resolved ticket from the last 6 months
3. Matches tickets to GitHub PRs by ticket key
4. Queries Snowflake for employee tenure data (optional)
5. Computes statistics: cycle times, change sizes, tenure multipliers
6. Saves everything to `calibration.json`

**Usage in Cursor:**

> Use the `calibrate_from_jira` prompt

**Run this before your first estimation** to give the estimator historical context.

## Calibration Data

After running `calibrate_from_jira`, a `calibration.json` file is created with:

- **Per-ticket data**: key, summary, type, project, assignee, cycle time, linked PRs, lines changed, tenure
- **Statistics by issue type**: average/P50/P75 cycle times, average lines changed
- **Tenure multipliers**: how much slower new employees (0-6 months) are vs experienced (12+ months)
- **Change size buckets**: average cycle time for small (<100 lines), medium (100-500), and large (500+) changes

The `estimate_from_prd` prompt automatically loads this data and uses P75 cycle times as the baseline for new estimates.

## Output

All markdown estimation files are written to:

```
/Users/shreyasjanivara/Desktop/planpage/estimation/mdfiles/
```

Each estimation includes:
- A detailed breakdown with impacted repos and related PRs per work package
- A final summary table at the end with raw and buffered estimates
- Totals in person-days and person-weeks

## Buffer

All estimates include a configurable buffer (default 20%) applied automatically by `publish_estimation`. This accounts for unknowns, code review cycles, and integration testing overhead.

## Project Structure

```
estimation/
  src/
    index.ts                        Server entry point, registers all tools + prompts
    lib/
      gh.ts                         GitHub CLI wrapper (exec, JSON parsing)
      markdown.ts                   Markdown table formatter
      notion.ts                     Notion API publisher
    tools/
      search-repos.ts               search_org_repos
      search-code.ts                search_org_code
      repo-overview.ts              get_repo_overview
      search-prs.ts                 search_recent_prs
      pr-details.ts                 get_pr_details
      publish.ts                    publish_estimation
      match-tickets.ts              match_tickets_to_prs
      store-calibration.ts          store_calibration_data
      get-calibration.ts            get_calibration_stats
    prompts/
      estimate-from-prd.ts          Estimation workflow prompt
      calibrate-from-jira.ts        Calibration workflow prompt
  build/                            Compiled JS output
  mdfiles/                          Generated estimation markdown files
  calibration.json                  Cached historical calibration data
  package.json
  tsconfig.json
```
