import { z } from "zod";
import { readFile } from "node:fs/promises";

const CALIBRATION_PATH =
  "/Users/shreyasjanivara/Desktop/planpage/estimation/calibration.json";

export const getCalibrationSchema = z.object({
  filter_project: z
    .string()
    .optional()
    .describe("Filter stats to a specific project (e.g. 'PAM')"),
  filter_type: z
    .string()
    .optional()
    .describe("Filter stats to a specific issue type (e.g. 'Story')"),
});

export type GetCalibrationInput = z.infer<typeof getCalibrationSchema>;

export async function getCalibrationStats(input: GetCalibrationInput) {
  let raw: string;
  try {
    raw = await readFile(CALIBRATION_PATH, "utf-8");
  } catch {
    return {
      content: [
        {
          type: "text" as const,
          text: "No calibration data found. Run the `calibrate_from_jira` prompt first to build historical calibration data.",
        },
      ],
    };
  }

  const data = JSON.parse(raw);

  let tickets: any[] = data.tickets ?? [];
  if (input.filter_project) {
    tickets = tickets.filter(
      (t: any) =>
        t.project?.toLowerCase() === input.filter_project!.toLowerCase(),
    );
  }
  if (input.filter_type) {
    tickets = tickets.filter(
      (t: any) =>
        t.type?.toLowerCase() === input.filter_type!.toLowerCase(),
    );
  }

  const resolved = tickets.filter((t: any) => t.cycle_time_days !== null);

  if (resolved.length === 0) {
    const filterDesc = [
      input.filter_project && `project=${input.filter_project}`,
      input.filter_type && `type=${input.filter_type}`,
    ]
      .filter(Boolean)
      .join(", ");

    return {
      content: [
        {
          type: "text" as const,
          text: `No resolved tickets found${filterDesc ? ` matching ${filterDesc}` : ""}. Calibration data has ${data.ticket_count} total tickets across projects: ${data.projects?.join(", ") ?? "unknown"}.`,
        },
      ],
    };
  }

  const cycleTimes = resolved.map((t: any) => t.cycle_time_days as number).sort((a: number, b: number) => a - b);
  const linesCounts = resolved.map((t: any) => (t.total_lines_changed ?? 0) as number);
  const prCounts = resolved.map((t: any) => (t.prs?.length ?? 0) as number);

  const avgCycle = avg(cycleTimes);
  const p50Cycle = percentile(cycleTimes, 50);
  const p75Cycle = percentile(cycleTimes, 75);
  const avgLines = avg(linesCounts);
  const avgPrs = avg(prCounts);

  const typeBreakdown: Record<string, { count: number; avgCycle: number; avgLines: number }> = {};
  for (const t of resolved) {
    const type = t.type as string;
    if (!typeBreakdown[type]) typeBreakdown[type] = { count: 0, avgCycle: 0, avgLines: 0 };
    typeBreakdown[type]!.count++;
  }
  for (const type of Object.keys(typeBreakdown)) {
    const group = resolved.filter((t: any) => t.type === type);
    typeBreakdown[type]!.avgCycle = avg(group.map((t: any) => t.cycle_time_days));
    typeBreakdown[type]!.avgLines = avg(group.map((t: any) => t.total_lines_changed ?? 0));
  }

  const tenureStats = data.statistics?.by_tenure_bracket ?? {};

  const lines: string[] = [
    `# Calibration Statistics`,
    "",
    `**Source:** ${data.ticket_count} total tickets | **Generated:** ${data.generated_at?.split("T")[0] ?? "unknown"}`,
    `**Filtered set:** ${resolved.length} resolved tickets`,
    input.filter_project ? `**Project filter:** ${input.filter_project}` : "",
    input.filter_type ? `**Type filter:** ${input.filter_type}` : "",
    "",
    "## Overall Metrics",
    "",
    `- Average cycle time: **${avgCycle.toFixed(1)} days**`,
    `- Median cycle time (P50): **${p50Cycle.toFixed(1)} days**`,
    `- P75 cycle time: **${p75Cycle.toFixed(1)} days**`,
    `- Average lines changed: **${avgLines.toFixed(0)}**`,
    `- Average PRs per ticket: **${avgPrs.toFixed(1)}**`,
    "",
    "## By Issue Type",
    "",
    "| Type | Count | Avg Cycle (days) | Avg Lines |",
    "|------|------:|---:|---:|",
    ...Object.entries(typeBreakdown).map(
      ([type, s]) => `| ${type} | ${s.count} | ${s.avgCycle.toFixed(1)} | ${s.avgLines.toFixed(0)} |`,
    ),
    "",
    "## Tenure Multipliers",
    "",
    "| Bracket | Multiplier | Sample Size |",
    "|---------|---:|---:|",
    ...Object.entries(tenureStats).map(
      ([bracket, s]: [string, any]) =>
        `| ${bracket} | ${s.avg_cycle_multiplier?.toFixed(2) ?? "1.00"}x | ${s.sample_size ?? 0} |`,
    ),
    "",
    "## Change Size Buckets",
    "",
    "| Bucket | Avg Cycle (days) | Sample Size |",
    "|--------|---:|---:|",
    ...Object.entries(data.statistics?.by_lines_changed_bucket ?? {}).map(
      ([bucket, s]: [string, any]) =>
        `| ${bucket} | ${s.avg_cycle_days?.toFixed(1) ?? "N/A"} | ${s.sample_size ?? 0} |`,
    ),
  ].filter(Boolean);

  return { content: [{ type: "text" as const, text: lines.join("\n") }] };
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
}
