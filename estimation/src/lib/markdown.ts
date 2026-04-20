export interface WorkPackageRow {
  name: string;
  description: string;
  impacted_repos: string[];
  related_prs: { title: string; url: string }[];
  raw_estimate_days: number;
  complexity: "low" | "medium" | "high";
  buffered_estimate_days: number;
  person_weeks: number;
}

export function buildMarkdown(
  title: string,
  prdSummary: string,
  rows: WorkPackageRow[],
  bufferPercent: number,
): string {
  const totalRaw = rows.reduce((s, r) => s + r.raw_estimate_days, 0);
  const totalBuffered = rows.reduce((s, r) => s + r.buffered_estimate_days, 0);
  const totalWeeks = rows.reduce((s, r) => s + r.person_weeks, 0);

  const lines: string[] = [
    `# ${title}`,
    "",
    `> ${prdSummary}`,
    "",
    `**Buffer applied:** ${bufferPercent}%`,
    "",
    "## Estimation Summary",
    "",
    "| # | Work Package | Complexity | Impacted Repos | Related PRs | Raw (days) | Buffered (days) | Person-Weeks |",
    "|---|---|---|---|---|---:|---:|---:|",
  ];

  rows.forEach((r, i) => {
    const repos = r.impacted_repos.map((rp) => `\`${rp}\``).join(", ");
    const prs = r.related_prs
      .slice(0, 3)
      .map((p) => `[${truncate(p.title, 40)}](${p.url})`)
      .join(", ");
    lines.push(
      `| ${i + 1} | **${r.name}** | ${r.complexity} | ${repos} | ${prs} | ${r.raw_estimate_days} | ${r.buffered_estimate_days.toFixed(1)} | ${r.person_weeks.toFixed(1)} |`,
    );
  });

  lines.push(
    `| | **TOTAL** | | | | **${totalRaw}** | **${totalBuffered.toFixed(1)}** | **${totalWeeks.toFixed(1)}** |`,
  );
  lines.push("");

  lines.push("## Work Package Details", "");
  rows.forEach((r, i) => {
    lines.push(`### ${i + 1}. ${r.name}`);
    lines.push("");
    lines.push(r.description);
    lines.push("");
    lines.push(
      `- **Complexity:** ${r.complexity}`,
      `- **Impacted repos:** ${r.impacted_repos.join(", ")}`,
      `- **Raw estimate:** ${r.raw_estimate_days} days`,
      `- **Buffered estimate:** ${r.buffered_estimate_days.toFixed(1)} days (${r.person_weeks.toFixed(1)} person-weeks)`,
    );
    if (r.related_prs.length > 0) {
      lines.push("- **Reference PRs:**");
      r.related_prs.forEach((p) => {
        lines.push(`  - [${p.title}](${p.url})`);
      });
    }
    lines.push("");
  });

  // Final summary table at the end, grouped by work package / stage
  lines.push("---", "");
  lines.push("## Final Estimate Summary", "");
  lines.push(
    "| # | Work Package / Stage | Complexity | Raw (days) | Buffered (days) | Person-Weeks |",
    "|---:|---|:---:|---:|---:|---:|",
  );
  rows.forEach((r, i) => {
    lines.push(
      `| ${i + 1} | ${r.name} | ${r.complexity} | ${r.raw_estimate_days} | ${r.buffered_estimate_days.toFixed(1)} | ${r.person_weeks.toFixed(1)} |`,
    );
  });
  lines.push(
    `| | **TOTAL** | | **${totalRaw}** | **${totalBuffered.toFixed(1)}** | **${totalWeeks.toFixed(1)}** |`,
  );
  lines.push("");
  lines.push(
    `_All estimates include a ${bufferPercent}% buffer. Raw estimates are in person-days; person-weeks = buffered days / 5._`,
  );
  lines.push("");

  return lines.join("\n");
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
