# Quarterly Player Planner

A single-page web application for visualising quarterly team planning across Player tribes and squads. Built for SuperBet's Product & Technology organisation.

## Features

- **Quarter & Year selection** with auto-calculated date ranges, working days, and UK bank holiday exclusions
- **T-Shirt Size Guide** aligned to the [SuperBet P&T Roadmapping Handbook](https://www.notion.so/superbet/HANDBOOK-Setting-up-Jira-for-P-T-Roadmapping-318032f852c58057a66ce19cf7a22d9e) (XS through XL, in weeks)
- **Player Capacity** table with tribe-level and squad-level breakdowns (Engagement tribe has 5 squads: Engagement Integrations, Grayskull (Bonus), Thundercats (Promo), Engagement Platform, Loyalty). Tribe rows are collapsible and auto-sum their squad data
- **Initiatives** table with category, multi-tribe assignment, t-shirt size estimates (BE & FE), priority, capacity utilisation %, and PRD links
- **Gantt Chart** with tribe filtering, uniform bar height, and resizable initiative column
- **Allocation by Category** table showing percentage distribution across Carry Forward, KTLO, Scalability, Product Improvements, RO Migration, and Innovation
- **Jira Integration** for pulling initiative data from Atlassian Jira (requires CORS proxy)
- **GitHub Persistence** — saves and loads planning data via the GitHub API so multiple users can collaborate across devices

## Project Structure

```
planpage/
├── index.html    # The entire application (HTML + CSS + JS in one file)
├── proxy.py      # Local CORS proxy for Jira API calls (port 8788)
├── data.json     # Initial/seed data structure for GitHub persistence
├── estimation/   # Separate MCP-based estimation tooling (not part of the planner UI)
└── README.md
```

## Getting Started

### 1. Start the local HTTP server

```bash
cd ~/Desktop/planpage
python3 -m http.server 8080
```

Then open [http://localhost:8080/index.html](http://localhost:8080/index.html) in your browser.

### 2. (Optional) Start the Jira CORS proxy

Only needed if you want to pull live data from Jira.

```bash
python3 proxy.py
```

This starts a proxy on `http://127.0.0.1:8788`. Configure your Jira credentials in the app via the Jira config modal.

### 3. (Optional) Configure GitHub persistence

Click the **Setup** button in the sync bar at the top of the page and enter:

- **Repository Owner** — your GitHub username or org
- **Repository Name** — the repo where `data.json` will be stored
- **Personal Access Token** — a [GitHub PAT](https://github.com/settings/tokens/new?scopes=repo&description=Quarterly+Player+Planner) with `repo` scope

Once connected, use **Pull** to load the latest data and **Push** to save. Changes auto-save with a debounce after each edit.

## How It Works

### Capacity Planning

Each tribe (Manage, Engagement, Transact, Fraud, Retail) has capacity defined per capability (BE, FE) using a t-shirt size and count (e.g. "M × 3"). Tribes with squads (currently Engagement) break this down further — the tribe row auto-aggregates its squad totals and is collapsible.

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

## Tech Stack

- **Frontend**: Vanilla HTML, CSS, JavaScript (no build step, no framework)
- **Fonts**: DM Sans + JetBrains Mono (Google Fonts)
- **Persistence**: GitHub REST API (browser → GitHub direct)
- **Jira Integration**: Atlassian REST API v3 via local Python CORS proxy
- **Hosting**: GitHub Pages (or any static file server)
