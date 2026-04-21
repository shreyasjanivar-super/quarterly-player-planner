# Quarterly Player Planner

A single-page web application for visualising quarterly team planning across Player tribes and squads. Built for SuperBet's Product & Technology organisation.

## Features

- **Quarter & Year selection** with auto-calculated date ranges, working days, and UK bank holiday exclusions
- **T-Shirt Size Guide** aligned to the [SuperBet P&T Roadmapping Handbook](https://www.notion.so/superbet/HANDBOOK-Setting-up-Jira-for-P-T-Roadmapping-318032f852c58057a66ce19cf7a22d9e) (XS through XL, in weeks) — read-only
- **Player Capacity** table with tribe and squad-level breakdowns. All five tribes have real squad names sourced from the [Player Area Overview](https://www.notion.so/superbet/Player-Area-Overview-2a9032f852c581d0bc77e9508645f9c6). Tribe rows are collapsible and auto-sum their squad data with t-shirt size breakdowns
- **Initiatives** table with category, multi-tribe assignment, t-shirt size estimates (BE & FE), priority, capacity utilisation %, and PRD links
- **Gantt Chart** with tribe filtering, uniform bar height, and resizable initiative column
- **Allocation by Category** table showing percentage distribution across Carry Forward, KTLO, Scalability, Product Improvements, RO Migration, and Innovation
- **Jira Integration** for pulling initiative data from Atlassian Jira and creating new issues (requires CORS proxy)
- **GitHub Persistence** — saves and loads planning data via the GitHub API so multiple users can collaborate across devices
- **Section Tooltips** — every section has a `?` help icon that explains its purpose and how to populate it

## Tribe & Squad Structure

The capacity table reflects the actual Player org chart:

| Tribe | Squads |
|-------|--------|
| **Manage** (4) | Player Onboarding, Player Identity, Player Account, Manage Platform |
| **Engagement** (6) | Greyskull, Thundercats, Bonus Integration, Mobius, Gamification, SB Club Migration |
| **Transact** (6) | Wallet, Payment Integration, Payment Platform, Payment Experience, Card Experience, Greece |
| **Fraud** (1) | Fraud Prevention |
| **Retail** (7) | Retail Sports Experience, Retail Gaming Experience, Retail Operations Experience, Retail Platform Foundations, Retail Added Value Experience, Retail Terminals Platform |

## Project Structure

```
quarterly-player-planner/
├── index.html    # The entire application (HTML + CSS + JS in one file)
├── proxy.py      # Local CORS proxy for Jira API calls (port 8788)
├── data.json     # Initial/seed data structure for GitHub persistence
├── estimation/   # Separate MCP-based estimation tooling (not part of the planner UI)
└── README.md
```

## Getting Started

### 1. Start the local HTTP server

```bash
cd quarterly-player-planner
python3 -m http.server 8080
```

Then open [http://localhost:8080/index.html](http://localhost:8080/index.html) in your browser.

### 2. (Optional) Start the Jira CORS proxy

Only needed if you want to pull live data from Jira or create issues.

```bash
python3 proxy.py
```

This starts a proxy on `http://127.0.0.1:8788`. Configure your Jira credentials in the app via **Setup → Jira Connection**.

### 3. (Optional) Configure GitHub persistence

Click the **Setup** button in the sync bar at the top of the page and enter:

- **Repository Owner** — your GitHub username or org
- **Repository Name** — the repo where `data.json` will be stored
- **Personal Access Token** — a [GitHub PAT](https://github.com/settings/tokens/new?scopes=repo&description=Quarterly+Player+Planner) with `repo` scope

Once connected, use **Pull** to load the latest data and **Push** to save.

## How to Use the Tool

### Step 1 — Select the Quarter

Use the **Quarter** and **Year** dropdowns at the top of the page. The date range, working days, and bank holidays update automatically.

### Step 2 — Set Up Capacity

1. Scroll to the **Player Capacity** section.
2. Click a **tribe row** (e.g. Manage) to expand and see its squads.
3. For each squad, select a **t-shirt size** (XS–XL) and a **count** (1–25) for both BE and FE capabilities.
4. The tribe summary row auto-aggregates squad data, showing a breakdown like *S×3 M×2*.
5. The **Player (Total)** row sums all tribes.

### Step 3 — Add Initiatives

1. Scroll to the **Initiatives** section and click **+ Add Initiative**.
2. Fill in:
   - **Initiative Name** — a descriptive title
   - **Category** — Carry Forward, KTLO, Scalability, Product Improvements, RO Migration, or Innovation
   - **Tribe(s)** — click the dropdown and select one or more tribes involved
   - **Estimate** — pick a t-shirt size and count for BE and FE effort
   - **Priority** — P0 (critical) through P3, or NA
   - **PRD** — paste a URL or upload a document
3. The **% Capacity** column updates automatically based on your estimates vs. the capacity you set.
4. Use the **Filter by Tribe** dropdown to focus on a specific tribe's initiatives.
5. Click the **✕** button on a row to remove an initiative.

### Step 4 — Review the Visualisations

- **Allocation by Category** — shows what percentage of each tribe's effort goes to each category. Use this to check investment balance.
- **Timeline — Gantt Chart** — shows initiatives plotted on a timeline. Bars are calculated from t-shirt midpoints in working days, ordered by priority. Use the tribe filter to narrow the view.

### Step 5 — Save and Share

- Click **Push** to save your data to GitHub.
- Click **Pull** to load the latest data from GitHub (useful when collaborating with others).
- Data is persisted in `data.json` in the connected GitHub repository.

### Tips

- Hover over any **?** icon next to a section title for a quick explanation of that section.
- The **T-Shirt Size Guide** at the top is read-only — it shows company-standard sizing from the Handbook.
- Weekends and UK bank holidays are automatically excluded from all date and duration calculations.
- The Gantt chart initiative column is **resizable** — drag the column border to adjust width.

## How It Works

### Capacity Planning

Each tribe (Manage, Engagement, Transact, Fraud, Retail) has capacity defined per capability (BE, FE) at the squad level using a t-shirt size and count (e.g. "M × 3"). Tribe rows auto-aggregate their squad totals showing a size breakdown, and are collapsible.

### Initiative Estimates

Initiatives are estimated per capability using the same t-shirt size × count model. The **% Capacity Utilised** column shows how much of each capability's total capacity the initiative consumes.

### Date Calculations

All date logic accounts for weekends and UK bank holidays (including Easter, substitute days, and floating holidays). Initiative durations are based on the maximum estimated effort across capabilities, and start dates always land on a working day.

### T-Shirt Size Guide (Company Standard)

| Size | Duration | ~ Working Days | Midpoint |
|------|----------|---------------|----------|
| XS   | 0–4 weeks  | 0–20    | 10 d |
| S    | 5–9 weeks  | 25–45   | 35 d |
| M    | 10–19 weeks | 50–95  | 73 d |
| L    | 20–39 weeks | 100–195 | 148 d |
| XL   | 40+ weeks  | 200–260 | 230 d |

These values are read-only and sourced from the SuperBet P&T Roadmapping Handbook.

### Jira Integration

The tool supports two-way Jira integration via a local CORS proxy:

- **Refresh from Jira** — pulls the latest status, priority, and dates for initiatives that have a linked Jira key.
- **Create in Jira** *(scaffolding in place)* — the `+ Add Initiative` button will create issues directly in Jira once field mapping is configured. The `JIRA_CREATE_CONFIG` object in the code controls which Jira project and fields are used per tribe.

### GitHub Persistence

Planning data is stored as `data.json` in a GitHub repository. The app reads and writes this file directly via the GitHub REST API using a Personal Access Token. This enables cross-device, multi-user collaboration without a backend server.

## Tech Stack

- **Frontend**: Vanilla HTML, CSS, JavaScript (no build step, no framework)
- **Fonts**: DM Sans + JetBrains Mono (Google Fonts)
- **Persistence**: GitHub REST API (browser → GitHub direct)
- **Jira Integration**: Atlassian REST API v3 via local Python CORS proxy
- **Hosting**: GitHub Pages (or any static file server)
