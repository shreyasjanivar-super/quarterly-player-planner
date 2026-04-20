import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

const MAX_BUFFER = 10 * 1024 * 1024; // 10 MB

export interface GhExecResult {
  stdout: string;
  stderr: string;
}

export async function gh(args: string[]): Promise<GhExecResult> {
  try {
    const { stdout, stderr } = await exec("gh", args, {
      maxBuffer: MAX_BUFFER,
      timeout: 60_000,
    });
    return { stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Unknown error running gh CLI";
    throw new Error(`gh ${args.join(" ")} failed: ${msg}`);
  }
}

export async function ghJson<T = unknown>(args: string[]): Promise<T> {
  const { stdout } = await gh(args);
  if (!stdout) return [] as unknown as T;
  try {
    return JSON.parse(stdout) as T;
  } catch {
    throw new Error(`Failed to parse gh JSON output: ${stdout.slice(0, 200)}`);
  }
}

export function sixMonthsAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  return d.toISOString().split("T")[0]!;
}
