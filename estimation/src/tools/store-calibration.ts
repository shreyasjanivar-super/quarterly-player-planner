import { z } from "zod";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const CALIBRATION_PATH =
  "/Users/shreyasjanivara/Desktop/planpage/estimation/calibration.json";

const prDataSchema = z.object({
  url: z.string(),
  repo: z.string(),
  author: z.string().optional(),
  additions: z.number(),
  deletions: z.number(),
  files: z.number().optional(),
  mergedAt: z.string().optional(),
});

const ticketSchema = z.object({
  key: z.string(),
  summary: z.string(),
  type: z.string().describe("Issue type (Story, Bug, Task, etc.)"),
  project: z.string(),
  assignee: z.string(),
  created: z.string().describe("ISO date string"),
  resolved: z.string().optional().describe("ISO date string"),
  story_points: z.number().optional(),
});

const prMatchesSchema = z.record(z.string(), z.array(prDataSchema));

const tenureMapSchema = z
  .record(z.string(), z.number())
  .describe("Map of assignee username/email to tenure in months at time of ticket");

export const storeCalibrationSchema = z.object({
  tickets: z.array(ticketSchema).min(1).describe("Jira tickets from the last 6 months"),
  pr_matches: prMatchesSchema.describe("Output from match_tickets_to_prs: ticket key → PRs"),
  employee_tenure: tenureMapSchema
    .default({})
    .describe("Map of assignee to tenure in months (from Snowflake). Empty if unavailable."),
});

export type StoreCalibrationInput = z.infer<typeof storeCalibrationSchema>;

interface CalibratedTicket {
  key: string;
  summary: string;
  type: string;
  project: string;
  assignee: string;
  created: string;
  resolved: string | undefined;
  cycle_time_days: number | null;
  story_points: number | undefined;
  prs: { url: string; repo: string; additions: number; deletions: number; files_changed: number }[];
  total_lines_changed: number;
  assignee_tenure_months: number | null;
}

interface TypeStats {
  count: number;
  avg_cycle_days: number;
  avg_lines: number;
  p25_cycle_days: number;
  p50_cycle_days: number;
  p75_cycle_days: number;
}

interface TenureBracketStats {
  avg_cycle_multiplier: number;
  sample_size: number;
}

interface LinesBucketStats {
  avg_cycle_days: number;
  sample_size: number;
}

export async function storeCalibrationData(input: StoreCalibrationInput) {
  const calibratedTickets: CalibratedTicket[] = input.tickets.map((t) => {
    const cycleDays = t.resolved ? daysBetween(t.created, t.resolved) : null;
    const prs = (input.pr_matches[t.key] ?? []).map((pr) => ({
      url: pr.url,
      repo: pr.repo,
      additions: pr.additions,
      deletions: pr.deletions,
      files_changed: pr.files ?? 0,
    }));
    const totalLines = prs.reduce((s, p) => s + p.additions + p.deletions, 0);
    const tenure = input.employee_tenure[t.assignee] ?? null;

    return {
      key: t.key,
      summary: t.summary,
      type: t.type,
      project: t.project,
      assignee: t.assignee,
      created: t.created,
      resolved: t.resolved,
      cycle_time_days: cycleDays,
      story_points: t.story_points,
      prs,
      total_lines_changed: totalLines,
      assignee_tenure_months: tenure,
    };
  });

  const resolvedTickets = calibratedTickets.filter((t) => t.cycle_time_days !== null);

  const byIssueType = computeTypeStats(resolvedTickets);
  const byTenureBracket = computeTenureStats(resolvedTickets);
  const byLinesBucket = computeLinesBucketStats(resolvedTickets);

  const projects = [...new Set(calibratedTickets.map((t) => t.project))].sort();

  const calibration = {
    generated_at: new Date().toISOString(),
    ticket_count: calibratedTickets.length,
    resolved_ticket_count: resolvedTickets.length,
    projects,
    tickets: calibratedTickets,
    statistics: {
      by_issue_type: byIssueType,
      by_tenure_bracket: byTenureBracket,
      by_lines_changed_bucket: byLinesBucket,
    },
  };

  await mkdir(dirname(CALIBRATION_PATH), { recursive: true });
  await writeFile(CALIBRATION_PATH, JSON.stringify(calibration, null, 2), "utf-8");

  const summary = [
    `Calibration data saved to ${CALIBRATION_PATH}`,
    "",
    `**${calibratedTickets.length} tickets** across projects: ${projects.join(", ")}`,
    `**${resolvedTickets.length} resolved** (with cycle time data)`,
    `**${Object.values(input.pr_matches).filter((v) => v.length > 0).length}** tickets matched to PRs`,
    `**${Object.keys(input.employee_tenure).length}** employees with tenure data`,
    "",
    "## Statistics by Issue Type",
    "",
    "| Type | Count | Avg Cycle (days) | P50 | P75 | Avg Lines |",
    "|------|------:|---:|---:|---:|---:|",
    ...Object.entries(byIssueType).map(
      ([type, s]) =>
        `| ${type} | ${s.count} | ${s.avg_cycle_days.toFixed(1)} | ${s.p50_cycle_days.toFixed(1)} | ${s.p75_cycle_days.toFixed(1)} | ${s.avg_lines.toFixed(0)} |`,
    ),
    "",
    "## Statistics by Tenure Bracket",
    "",
    "| Bracket | Multiplier | Sample Size |",
    "|---------|---:|---:|",
    ...Object.entries(byTenureBracket).map(
      ([bracket, s]) => `| ${bracket} | ${s.avg_cycle_multiplier.toFixed(2)}x | ${s.sample_size} |`,
    ),
    "",
    "## Statistics by Change Size",
    "",
    "| Size Bucket | Avg Cycle (days) | Sample Size |",
    "|-------------|---:|---:|",
    ...Object.entries(byLinesBucket).map(
      ([bucket, s]) => `| ${bucket} | ${s.avg_cycle_days.toFixed(1)} | ${s.sample_size} |`,
    ),
  ];

  return { content: [{ type: "text" as const, text: summary.join("\n") }] };
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a);
  const db = new Date(b);
  return Math.max(0, Math.round((db.getTime() - da.getTime()) / 86_400_000));
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
}

function computeTypeStats(
  tickets: CalibratedTicket[],
): Record<string, TypeStats> {
  const groups: Record<string, CalibratedTicket[]> = {};
  for (const t of tickets) {
    (groups[t.type] ??= []).push(t);
  }

  const result: Record<string, TypeStats> = {};
  for (const [type, group] of Object.entries(groups)) {
    const cycles = group
      .map((t) => t.cycle_time_days!)
      .sort((a, b) => a - b);
    const lines = group.map((t) => t.total_lines_changed);

    result[type] = {
      count: group.length,
      avg_cycle_days: avg(cycles),
      avg_lines: avg(lines),
      p25_cycle_days: percentile(cycles, 25),
      p50_cycle_days: percentile(cycles, 50),
      p75_cycle_days: percentile(cycles, 75),
    };
  }
  return result;
}

function computeTenureStats(
  tickets: CalibratedTicket[],
): Record<string, TenureBracketStats> {
  const withTenure = tickets.filter((t) => t.assignee_tenure_months !== null);
  if (withTenure.length === 0) {
    return {
      "0-6_months": { avg_cycle_multiplier: 1.0, sample_size: 0 },
      "6-12_months": { avg_cycle_multiplier: 1.0, sample_size: 0 },
      "12+_months": { avg_cycle_multiplier: 1.0, sample_size: 0 },
    };
  }

  const brackets: Record<string, number[]> = {
    "0-6_months": [],
    "6-12_months": [],
    "12+_months": [],
  };

  for (const t of withTenure) {
    const tenure = t.assignee_tenure_months!;
    const bucket =
      tenure < 6 ? "0-6_months" : tenure < 12 ? "6-12_months" : "12+_months";
    brackets[bucket]!.push(t.cycle_time_days!);
  }

  const allAvg = avg(withTenure.map((t) => t.cycle_time_days!));
  const baseline = allAvg > 0 ? allAvg : 1;

  const result: Record<string, TenureBracketStats> = {};
  for (const [bracket, cycles] of Object.entries(brackets)) {
    const bracketAvg = cycles.length > 0 ? avg(cycles) : baseline;
    result[bracket] = {
      avg_cycle_multiplier: bracketAvg / baseline,
      sample_size: cycles.length,
    };
  }
  return result;
}

function computeLinesBucketStats(
  tickets: CalibratedTicket[],
): Record<string, LinesBucketStats> {
  const buckets: Record<string, number[]> = {
    "small_lt100": [],
    "medium_100_500": [],
    "large_gt500": [],
  };

  for (const t of tickets) {
    const lines = t.total_lines_changed;
    const bucket =
      lines < 100
        ? "small_lt100"
        : lines <= 500
          ? "medium_100_500"
          : "large_gt500";
    buckets[bucket]!.push(t.cycle_time_days!);
  }

  const result: Record<string, LinesBucketStats> = {};
  for (const [bucket, cycles] of Object.entries(buckets)) {
    result[bucket] = {
      avg_cycle_days: cycles.length > 0 ? avg(cycles) : 0,
      sample_size: cycles.length,
    };
  }
  return result;
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}
