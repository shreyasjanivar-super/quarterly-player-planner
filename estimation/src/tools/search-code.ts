import { z } from "zod";
import { ghJson } from "../lib/gh.js";

export const searchCodeSchema = z.object({
  query: z.string().describe("Code search query (function name, API endpoint, domain term)"),
  filename: z.string().optional().describe("Filter by filename (e.g. 'router.ex', 'handler.go')"),
  language: z.string().optional().describe("Filter by language"),
  repo: z.string().optional().describe("Limit to a specific repo (e.g. 'superbet-group/loyalty-shop')"),
  limit: z.number().min(1).max(100).default(30).describe("Max results to return"),
});

export type SearchCodeInput = z.infer<typeof searchCodeSchema>;

interface CodeResult {
  repo: { fullName: string };
  path: string;
  textMatches: { fragment: string }[];
}

export async function searchCode(input: SearchCodeInput, org: string) {
  const args = [
    "search",
    "code",
    input.query,
    `--owner=${org}`,
    "--json=repo,path,textMatches",
    `--limit=${input.limit}`,
  ];

  if (input.filename) args.push(`--filename=${input.filename}`);
  if (input.language) args.push(`--language=${input.language}`);
  if (input.repo) {
    // Override owner with specific repo
    const idx = args.indexOf(`--owner=${org}`);
    if (idx !== -1) args.splice(idx, 1);
    args.push(`--repo=${input.repo}`);
  }

  const results = await ghJson<CodeResult[]>(args);

  return {
    content: [
      {
        type: "text" as const,
        text: results.length === 0
          ? `No code matches found for "${input.query}".`
          : `Found ${results.length} code matches for "${input.query}":\n\n${formatCode(results)}`,
      },
    ],
  };
}

function formatCode(results: CodeResult[]): string {
  return results
    .map((r, i) => {
      const snippet =
        r.textMatches?.[0]?.fragment?.slice(0, 200) ?? "(no snippet)";
      return `${i + 1}. **${r.repo.fullName}** — \`${r.path}\`\n   \`\`\`\n   ${snippet}\n   \`\`\``;
    })
    .join("\n\n");
}
