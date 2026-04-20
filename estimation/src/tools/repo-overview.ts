import { z } from "zod";
import { gh, ghJson } from "../lib/gh.js";

export const repoOverviewSchema = z.object({
  repo: z.string().describe("Full repo name (e.g. 'superbet-group/loyalty-shop')"),
});

export type RepoOverviewInput = z.infer<typeof repoOverviewSchema>;

interface RepoInfo {
  name: string;
  description: string;
  languages: { node: { name: string; size: number } }[];
  defaultBranchRef: { name: string };
}

interface TreeEntry {
  path: string;
  type: string;
}

export async function getRepoOverview(input: RepoOverviewInput) {
  const [repoInfo, tree, readme, recentCommits] = await Promise.all([
    fetchRepoInfo(input.repo),
    fetchTree(input.repo),
    fetchReadme(input.repo),
    fetchRecentCommits(input.repo),
  ]);

  const text = [
    `# ${repoInfo.name}`,
    "",
    `**Description:** ${repoInfo.description || "None"}`,
    `**Languages:** ${formatLanguages(repoInfo.languages)}`,
    `**Default branch:** ${repoInfo.defaultBranchRef?.name ?? "main"}`,
    "",
    "## File Structure (key paths)",
    "",
    tree,
    "",
    "## README (excerpt)",
    "",
    readme,
    "",
    "## Recent Commits (last 10)",
    "",
    recentCommits,
  ].join("\n");

  return { content: [{ type: "text" as const, text }] };
}

async function fetchRepoInfo(repo: string): Promise<RepoInfo> {
  return ghJson<RepoInfo>([
    "repo",
    "view",
    repo,
    "--json=name,description,languages,defaultBranchRef",
  ]);
}

async function fetchTree(repo: string): Promise<string> {
  try {
    const { stdout } = await gh([
      "api",
      `repos/${repo}/git/trees/HEAD?recursive=1`,
      "--jq",
      '.tree[] | select(.type=="blob") | .path',
    ]);

    const paths = stdout.split("\n").filter(Boolean);
    // Show top-level structure plus key directories (max 60 entries)
    const keyPaths = paths
      .filter((p) => {
        const depth = p.split("/").length;
        if (depth <= 2) return true;
        if (p.match(/\.(go|ex|exs|ts|tsx|proto|graphql|yaml|yml|json)$/)) {
          return depth <= 3;
        }
        return false;
      })
      .slice(0, 60);

    return keyPaths.map((p) => `  ${p}`).join("\n") || "(empty or inaccessible)";
  } catch {
    return "(could not retrieve file tree)";
  }
}

async function fetchReadme(repo: string): Promise<string> {
  try {
    const { stdout } = await gh([
      "api",
      `repos/${repo}/readme`,
      "--jq",
      ".content",
    ]);
    const decoded = Buffer.from(stdout, "base64").toString("utf-8");
    return decoded.slice(0, 2000) + (decoded.length > 2000 ? "\n\n...(truncated)" : "");
  } catch {
    return "(no README found)";
  }
}

async function fetchRecentCommits(repo: string): Promise<string> {
  try {
    const { stdout } = await gh([
      "api",
      `repos/${repo}/commits?per_page=10`,
      "--jq",
      '.[] | "- " + (.commit.message | split("\n")[0]) + " (" + .commit.author.date[:10] + ", " + .commit.author.name + ")"',
    ]);
    return stdout || "(no commits)";
  } catch {
    return "(could not retrieve commits)";
  }
}

function formatLanguages(
  langs: { node: { name: string; size: number } }[] | undefined,
): string {
  if (!langs || langs.length === 0) return "unknown";
  return langs.map((l) => l.node?.name ?? "unknown").join(", ");
}
