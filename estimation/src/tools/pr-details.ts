import { z } from "zod";
import { ghJson } from "../lib/gh.js";

export const prDetailsSchema = z.object({
  pr_url: z.string().url().describe("Full GitHub PR URL (e.g. 'https://github.com/superbet-group/repo/pull/123')"),
});

export type PrDetailsInput = z.infer<typeof prDetailsSchema>;

interface FileChange {
  path: string;
  additions: number;
  deletions: number;
}

interface Review {
  author: { login: string };
  state: string;
  submittedAt: string;
}

interface PrDetail {
  title: string;
  body: string;
  author: { login: string };
  mergedAt: string;
  additions: number;
  deletions: number;
  files: FileChange[];
  reviews: Review[];
  labels: { name: string }[];
}

export async function getPrDetails(input: PrDetailsInput) {
  const detail = await ghJson<PrDetail>([
    "pr",
    "view",
    input.pr_url,
    "--json=title,body,author,mergedAt,additions,deletions,files,reviews,labels",
  ]);

  const text = [
    `# ${detail.title}`,
    "",
    `**Author:** ${detail.author?.login ?? "unknown"}`,
    `**Merged:** ${detail.mergedAt?.split("T")[0] ?? "not merged"}`,
    `**Lines changed:** +${detail.additions} / -${detail.deletions}`,
    `**Labels:** ${detail.labels?.map((l) => l.name).join(", ") || "none"}`,
    "",
    "## Description",
    "",
    (detail.body || "(no description)").slice(0, 3000),
    "",
    "## Files Changed",
    "",
    formatFiles(detail.files ?? []),
    "",
    "## Review Timeline",
    "",
    formatReviews(detail.reviews ?? []),
  ].join("\n");

  return { content: [{ type: "text" as const, text }] };
}

function formatFiles(files: FileChange[]): string {
  if (files.length === 0) return "(no files)";
  return files
    .slice(0, 50)
    .map((f) => `- \`${f.path}\` (+${f.additions} / -${f.deletions})`)
    .join("\n");
}

function formatReviews(reviews: Review[]): string {
  if (reviews.length === 0) return "(no reviews)";
  return reviews
    .map(
      (r) =>
        `- ${r.author?.login ?? "unknown"}: ${r.state} (${r.submittedAt?.split("T")[0] ?? "unknown"})`,
    )
    .join("\n");
}
