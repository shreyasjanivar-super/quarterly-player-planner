import { Client } from "@notionhq/client";
import type { WorkPackageRow } from "./markdown.js";

let cachedClient: Client | null = null;

function getClient(): Client {
  if (cachedClient) return cachedClient;
  const token = process.env["NOTION_API_KEY"];
  if (!token) throw new Error("NOTION_API_KEY env var is not set");
  cachedClient = new Client({ auth: token });
  return cachedClient;
}

function getParentPageId(): string {
  const id = process.env["NOTION_PARENT_PAGE_ID"];
  if (!id) throw new Error("NOTION_PARENT_PAGE_ID env var is not set");
  return id;
}

export async function publishToNotion(
  title: string,
  prdSummary: string,
  rows: WorkPackageRow[],
  bufferPercent: number,
): Promise<string> {
  const notion = getClient();
  const parentId = getParentPageId();

  const totalRaw = rows.reduce((s, r) => s + r.raw_estimate_days, 0);
  const totalBuffered = rows.reduce((s, r) => s + r.buffered_estimate_days, 0);
  const totalWeeks = rows.reduce((s, r) => s + r.person_weeks, 0);

  const children: any[] = [
    {
      object: "block",
      type: "callout",
      callout: {
        icon: { type: "emoji", emoji: "📋" },
        rich_text: [{ type: "text", text: { content: prdSummary } }],
      },
    },
    {
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [
          {
            type: "text",
            text: { content: `Buffer applied: ${bufferPercent}%` },
            annotations: { bold: true },
          },
        ],
      },
    },
    {
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "Estimation Summary" } }],
      },
    },
    buildNotionTable(rows, totalRaw, totalBuffered, totalWeeks),
    {
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [
          { type: "text", text: { content: "Work Package Details" } },
        ],
      },
    },
  ];

  for (const [i, r] of rows.entries()) {
    children.push({
      object: "block",
      type: "heading_3",
      heading_3: {
        rich_text: [
          { type: "text", text: { content: `${i + 1}. ${r.name}` } },
        ],
      },
    });
    children.push({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [{ type: "text", text: { content: r.description } }],
      },
    });
    const details = [
      `Complexity: ${r.complexity}`,
      `Impacted repos: ${r.impacted_repos.join(", ")}`,
      `Raw estimate: ${r.raw_estimate_days} days`,
      `Buffered: ${r.buffered_estimate_days.toFixed(1)} days (${r.person_weeks.toFixed(1)} person-weeks)`,
    ];
    for (const d of details) {
      children.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [{ type: "text", text: { content: d } }],
        },
      });
    }
    if (r.related_prs.length > 0) {
      children.push({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: { content: "Reference PRs:" },
              annotations: { bold: true },
            },
          ],
        },
      });
      for (const pr of r.related_prs.slice(0, 5)) {
        children.push({
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: [
              { type: "text", text: { content: pr.title, link: { url: pr.url } } },
            ],
          },
        });
      }
    }
  }

  const page = await notion.pages.create({
    parent: { page_id: parentId },
    properties: {
      title: {
        title: [{ text: { content: title } }],
      },
    },
    children: children.slice(0, 100), // Notion API limit
  });

  return (page as any).url as string;
}

function buildNotionTable(
  rows: WorkPackageRow[],
  totalRaw: number,
  totalBuffered: number,
  totalWeeks: number,
): any {
  const headerRow = {
    type: "table_row",
    table_row: {
      cells: [
        [{ type: "text", text: { content: "#" } }],
        [{ type: "text", text: { content: "Work Package" } }],
        [{ type: "text", text: { content: "Complexity" } }],
        [{ type: "text", text: { content: "Impacted Repos" } }],
        [{ type: "text", text: { content: "Raw (days)" } }],
        [{ type: "text", text: { content: "Buffered (days)" } }],
        [{ type: "text", text: { content: "Person-Weeks" } }],
      ],
    },
  };

  const dataRows = rows.map((r, i) => ({
    type: "table_row",
    table_row: {
      cells: [
        [{ type: "text", text: { content: String(i + 1) } }],
        [{ type: "text", text: { content: r.name } }],
        [{ type: "text", text: { content: r.complexity } }],
        [
          {
            type: "text",
            text: { content: r.impacted_repos.join(", ") },
          },
        ],
        [{ type: "text", text: { content: String(r.raw_estimate_days) } }],
        [
          {
            type: "text",
            text: { content: r.buffered_estimate_days.toFixed(1) },
          },
        ],
        [{ type: "text", text: { content: r.person_weeks.toFixed(1) } }],
      ],
    },
  }));

  const totalRow = {
    type: "table_row",
    table_row: {
      cells: [
        [{ type: "text", text: { content: "" } }],
        [
          {
            type: "text",
            text: { content: "TOTAL" },
            annotations: { bold: true },
          },
        ],
        [{ type: "text", text: { content: "" } }],
        [{ type: "text", text: { content: "" } }],
        [
          {
            type: "text",
            text: { content: String(totalRaw) },
            annotations: { bold: true },
          },
        ],
        [
          {
            type: "text",
            text: { content: totalBuffered.toFixed(1) },
            annotations: { bold: true },
          },
        ],
        [
          {
            type: "text",
            text: { content: totalWeeks.toFixed(1) },
            annotations: { bold: true },
          },
        ],
      ],
    },
  };

  return {
    object: "block",
    type: "table",
    table: {
      table_width: 7,
      has_column_header: true,
      has_row_header: false,
      children: [headerRow, ...dataRows, totalRow],
    },
  };
}
