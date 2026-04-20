import { z } from "zod";
import { ghJson, sixMonthsAgo } from "../lib/gh.js";

export const searchPrsSchema = z.object({
  query: z.string().describe("Search keywords for PR titles/bodies"),
  months: z.number().min(1).max(24).default(6).describe("How many months back to search"),
  repo: z.string().optional().describe("Limit to a specific repo (e.g. 'superbet-group/loyalty-shop')"),
  limit: z.number().min(1).max(100).default(30).describe("Max PRs to return"),
});

export type SearchPrsInput = z.infer<typeof searchPrsSchema>;

interface PrResult {
  title: string;
  url: string;
  repository: { nameWithOwner: string };
  author: { login: string };
  mergedAt: string;
  additions: number;
  deletions: number;
}

export async function searchRecentPrs(input: SearchPrsInput, org: string) {
  const since = nMonthsAgo(input.months);

  const args = [
    "search",
    "prs",
    input.query,
    `--owner=${org}`,
    "--merged",
    `--merged-after=${since}`,
    "--json=title,url,repository,author,mergedAt,additions,deletions",
    `--limit=${input.limit}`,
  ];

  if (input.repo) {
    const idx = args.indexOf(`--owner=${org}`);
    if (idx !== -1) args.splice(idx, 1);
    args.push(`--repo=${input.repo}`);
  }

  const prs = await ghJson<PrResult[]>(args);

  return {
    content: [
      {
        type: "text" as const,
        text: prs.length === 0
          ? `No merged PRs found matching "${input.query}" in the last ${input.months} months.`
          : `Found ${prs.length} merged PRs matching "${input.query}" (last ${input.months} months):\n\n${formatPrs(prs)}`,
      },
    ],
  };
}

function nMonthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().split("T")[0]!;
}

function formatPrs(prs: PrResult[]): string {
  return prs
    .map(
      (p, i) =>
        `${i + 1}. **${p.title}**\n   Repo: ${p.repository.nameWithOwner}\n   Author: ${p.author.login} | Merged: ${p.mergedAt?.split("T")[0] ?? "unknown"}\n   +${p.additions} / -${p.deletions} lines\n   ${p.url}`,
    )
    .join("\n\n");
}
