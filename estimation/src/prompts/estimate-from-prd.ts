export const ESTIMATE_FROM_PRD_PROMPT = {
  name: "estimate_from_prd",
  description:
    "Guides you through analysing a PRD against the superbet-group GitHub org, " +
    "identifying impacted repos, finding comparable past PRs, and producing a " +
    "buffered effort estimation table.",
  arguments: [
    {
      name: "prd",
      description: "The full requirements document / PRD text to estimate",
      required: true,
    },
    {
      name: "buffer_percent",
      description: "Buffer percentage to add to estimates (default 20)",
      required: false,
    },
  ],
} as const;

export function buildEstimationPrompt(prd: string, bufferPercent = 20): string {
  return `You are a senior engineering estimation agent. Follow these steps precisely:

## Step 0: Load Calibration Data
Call **get_calibration_stats** (with no filters) to check for historical calibration data.
If calibration data exists, use it throughout the estimation to ground your estimates in
actual team velocity data. Pay attention to:
- Average cycle times by issue type (Stories vs Bugs vs Tasks)
- Tenure multipliers (new employees take longer)
- Change size buckets (small/medium/large PRs and their typical cycle times)
- P50 and P75 cycle times for realistic vs pessimistic estimates

If no calibration data exists, proceed without it and note that estimates are not
calibrated against historical data.

## Step 1: Parse the PRD
Read the requirements document below and extract:
- Key features / change requests
- Domain terms and technical keywords (service names, APIs, protocols)
- Integration points mentioned

## Step 2: Identify Impacted Repositories
Use the **search_org_repos** tool with keywords from the PRD to find candidate repos.
Then use **search_org_code** to verify which repos actually contain the relevant code.
For the top 5-8 most relevant repos, use **get_repo_overview** to understand their structure.

## Step 3: Break Down Into Work Packages
Split the PRD into discrete work packages. Each work package should:
- Map to one or more impacted repositories
- Be independently estimable
- Have a clear scope (e.g. "Add new API endpoint for X", "Migrate service Y to Z")
Flag any **frontend effort** separately from backend.

## Step 4: Find Comparable Past PRs
For each work package, use **search_recent_prs** to find merged PRs from the last 6 months
that did similar work (same repos, similar patterns). Use **get_pr_details** on the most
relevant 2-3 PRs per work package to calibrate your size estimate.

## Step 5: Estimate Effort
For each work package, estimate person-days based on:
- **Calibration data** (if available): use historical cycle times for similar issue types
  and change sizes as your baseline. Apply tenure multipliers if the team is known.
- Lines of code changed in comparable PRs
- Number of files/services touched
- Complexity (low/medium/high)
- Integration testing needs

When calibration data is available, prefer the P75 cycle time (75th percentile) as your
raw estimate for each work package -- this accounts for typical variability without being
overly optimistic. Adjust up or down based on the specific complexity factors.

## Step 6: Publish Results
Call **publish_estimation** with all work packages. The buffer of ${bufferPercent}% will be
applied automatically. This will output both a Notion page and a local markdown file.

---

## PRD to Estimate

${prd}

---

Begin with Step 0 now.`;
}
