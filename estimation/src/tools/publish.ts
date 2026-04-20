import { z } from "zod";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { buildMarkdown, type WorkPackageRow } from "../lib/markdown.js";
import { publishToNotion } from "../lib/notion.js";

const MD_OUTPUT_DIR = "/Users/shreyasjanivara/Desktop/planpage/estimation/mdfiles";

const relatedPrSchema = z.object({
  title: z.string(),
  url: z.string().url(),
});

const workPackageSchema = z.object({
  name: z.string().describe("Work package name"),
  description: z.string().describe("What this work package covers"),
  impacted_repos: z.array(z.string()).describe("List of impacted repository names"),
  related_prs: z.array(relatedPrSchema).default([]).describe("Related PRs from the past 6 months"),
  raw_estimate_days: z.number().min(0).describe("Raw effort estimate in person-days"),
  complexity: z.enum(["low", "medium", "high"]).describe("Relative complexity"),
});

export const publishEstimationSchema = z.object({
  title: z.string().describe("Title of the estimation document"),
  prd_summary: z.string().describe("Brief summary of the requirements being estimated"),
  work_packages: z.array(workPackageSchema).min(1).describe("Work packages with estimates"),
  buffer_percent: z.number().min(0).max(100).default(20).describe("Buffer percentage to apply (default 20%)"),
  output_filename: z.string().default("estimation.md").describe("Filename for the markdown output (written to the mdfiles directory)"),
});

export type PublishEstimationInput = z.infer<typeof publishEstimationSchema>;

export async function publishEstimation(input: PublishEstimationInput) {
  const bufferMultiplier = 1 + input.buffer_percent / 100;

  const rows: WorkPackageRow[] = input.work_packages.map((wp) => {
    const buffered = wp.raw_estimate_days * bufferMultiplier;
    return {
      ...wp,
      buffered_estimate_days: buffered,
      person_weeks: buffered / 5,
    };
  });

  const markdown = buildMarkdown(
    input.title,
    input.prd_summary,
    rows,
    input.buffer_percent,
  );

  // Write markdown file to the fixed output directory
  await mkdir(MD_OUTPUT_DIR, { recursive: true });
  const absPath = join(MD_OUTPUT_DIR, input.output_filename);
  await writeFile(absPath, markdown, "utf-8");

  // Publish to Notion (best-effort -- don't fail if Notion isn't configured)
  let notionUrl: string | null = null;
  try {
    notionUrl = await publishToNotion(
      input.title,
      input.prd_summary,
      rows,
      input.buffer_percent,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Notion publish skipped: ${msg}`);
  }

  const totalRaw = rows.reduce((s, r) => s + r.raw_estimate_days, 0);
  const totalBuffered = rows.reduce((s, r) => s + r.buffered_estimate_days, 0);
  const totalWeeks = rows.reduce((s, r) => s + r.person_weeks, 0);

  const summary = [
    `Estimation published successfully.`,
    "",
    `**${rows.length} work packages** | **${totalRaw} raw days** → **${totalBuffered.toFixed(1)} buffered days** (${totalWeeks.toFixed(1)} person-weeks)`,
    "",
    `Markdown: ${absPath}`,
    notionUrl ? `Notion: ${notionUrl}` : "Notion: skipped (NOTION_API_KEY or NOTION_PARENT_PAGE_ID not set)",
  ].join("\n");

  return { content: [{ type: "text" as const, text: summary }] };
}
