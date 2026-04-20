import { z } from "zod";
import { ghJson } from "../lib/gh.js";

export const searchReposSchema = z.object({
  query: z.string().describe("Search keywords extracted from the PRD (e.g. 'loyalty shop supercoin')"),
  language: z.string().optional().describe("Filter by primary language (e.g. 'Elixir', 'Go', 'TypeScript')"),
  limit: z.number().min(1).max(100).default(20).describe("Max repos to return"),
});

export type SearchReposInput = z.infer<typeof searchReposSchema>;

interface RepoResult {
  name: string;
  description: string;
  language: string;
  updatedAt: string;
  url: string;
}

export async function searchRepos(input: SearchReposInput, org: string) {
  const args = [
    "search",
    "repos",
    input.query,
    `--owner=${org}`,
    "--json=name,description,language,updatedAt,url",
    `--limit=${input.limit}`,
  ];

  if (input.language) {
    args.push(`--language=${input.language}`);
  }

  const repos = await ghJson<RepoResult[]>(args);

  return {
    content: [
      {
        type: "text" as const,
        text: repos.length === 0
          ? `No repositories found in ${org} matching "${input.query}".`
          : `Found ${repos.length} repositories in ${org} matching "${input.query}":\n\n${formatRepos(repos)}`,
      },
    ],
  };
}

function formatRepos(repos: RepoResult[]): string {
  return repos
    .map(
      (r, i) =>
        `${i + 1}. **${r.name}** (${r.language || "unknown lang"})\n   ${r.description || "No description"}\n   Updated: ${r.updatedAt?.split("T")[0] ?? "unknown"}\n   ${r.url}`,
    )
    .join("\n\n");
}
