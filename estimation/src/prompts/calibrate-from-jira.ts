export const CALIBRATE_FROM_JIRA_PROMPT = {
  name: "calibrate_from_jira",
  description:
    "Builds historical calibration data by pulling Jira tickets from the player area projects, " +
    "correlating them with GitHub PRs, and optionally enriching with employee tenure from Snowflake. " +
    "The result is cached locally for use during future estimations.",
} as const;

export function buildCalibrationPrompt(cloudId: string): string {
  return `You are a calibration agent. Your job is to build a historical dataset of completed Jira tickets,
their associated GitHub PRs, and (optionally) employee tenure data. Follow these steps precisely.

## Step 1: Discover Projects

Use the Atlassian MCP tool **getVisibleJiraProjects** with cloudId "${cloudId}" to list all projects.
Focus on projects that belong to the Player area (e.g. PAM, LOY, CRM, player-related projects).

## Step 2: Pull Resolved Tickets (Last 6 Months)

For each relevant project, use **searchJiraIssuesUsingJql** with:
- cloudId: "${cloudId}"
- jql: \`project = <KEY> AND resolved >= -26w ORDER BY resolved DESC\`
- fields: ["summary", "issuetype", "status", "assignee", "created", "resolutiondate", "story_points"]
- maxResults: 100
- responseContentFormat: "markdown"

Paginate using nextPageToken until all tickets are retrieved.
Collect all tickets into a single list with these fields extracted:
- key, summary, type (from issuetype.name), project, assignee (displayName or emailAddress), created, resolved (resolutiondate), story_points

## Step 3: Match Tickets to GitHub PRs

Take all the ticket keys you collected and call the prd-estimator tool **match_tickets_to_prs**
with the full list of keys. Process in batches if there are more than 200.
This will search the superbet-group GitHub org for PRs that reference each ticket key.

## Step 4: Get Employee Tenure (Optional -- Snowflake)

If the Snowflake MCP is configured, query the HR/employee table to get hire dates.
Look for a table containing employee email/name and hire_date columns.
Calculate each employee's tenure in months at the time of their ticket's resolution date.

Build a map of assignee → tenure_months.

If Snowflake is not configured or the query fails, skip this step and note it in the output.
Use an empty object {} for employee_tenure.

## Step 5: Store Calibration Data

Call the prd-estimator tool **store_calibration_data** with:
- tickets: the full array of ticket objects from Step 2
- pr_matches: the structured PR data from Step 3
- employee_tenure: the tenure map from Step 4 (or {} if skipped)

This will compute statistics (cycle times, lines changed, tenure multipliers) and save
everything to a local calibration.json file.

## Step 6: Report Summary

After storing, call **get_calibration_stats** (with no filters) to retrieve the summary.
Present the key findings:
- Total tickets processed
- Average cycle times by issue type
- Tenure multipliers (if available)
- Change size distribution
- Any notable patterns (e.g. "Bugs are resolved 3x faster than Stories")

---

Begin with Step 1 now.`;
}
