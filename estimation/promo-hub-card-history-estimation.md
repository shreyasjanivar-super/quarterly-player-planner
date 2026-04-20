# Estimation: Improve Promo Hub Card Behaviour and Campaign History (revised)

> **PRD source:** [Improve Promo Hub Card Behaviour and Campaign History](https://www.notion.so/superbet/Improve-Promo-Hub-Card-Behaviour-and-Campaign-History-2c6032f852c58030aa3fc57924e27c5d?source=copy_link) — revised using the **full** PRD: seven user-visible states (available → active → pending bonus → bonus awarded → bonus used / campaign expired / bonus expired), **Active** tab replacing **In Progress**, pending processing UX, **bonus instance creation in Bonus Tab** on state 4, and analytics/QA across transitions.

**Buffer applied:** 20%

## PRD traceability (states → work)

| PRD state | Phase | Covered primarily by |
|-----------|--------|----------------------|
| 1 Available (not opted-in) | Campaign | WP3 |
| 2 Active (opted-in) | Campaign | WP2 (tab), WP3 |
| 3 Complete (pending bonus) | Transition | WP4, WP5 (verification contract) |
| 4 Bonus awarded | Bonus | WP4, **WP5** (materialisation + Bonus tab) |
| 5 Bonus used | End | WP6 |
| 6 Campaign expired | End | WP6 |
| 7 Bonus expired | End | WP6 |
| Design TBD (multiple CTAs) | Cross-cutting | WP1 workshops, WP3–WP4 iteration, buffer |
| System status `???` | Discovery | **WP1** |

## Estimation Summary

| # | Work Package | Complexity | Impacted repos (typical) | Related PRs | Raw (days) | Buffered (days) | Person-Weeks |
|---|--------------|------------|--------------------------|-------------|------------|-----------------|---------------|
| 1 | **Discovery & state model alignment (PRD → domain/API)** | high | `dot-country-web.client`, engagement/bonus platform repos (TBD in discovery) | — | 3.0 | 3.6 | 0.7 |
| 2 | **Navigation: Active tab replaces In Progress** | medium | `dot-country-web.client`, `web.gaming.translations` (strings) | [[BCN-9513] Campaign ordering and improvements](https://github.com/superbet-group/dot-country-web.client/pull/18339) | 2.0 | 2.4 | 0.5 |
| 3 | **Card UI — Phase 1 (states 1–2: Available, Active)** | medium | `dot-country-web.client`, `web.lib.ui-components` | [[BCN-8440] Promohub new History card](https://github.com/superbet-group/dot-country-web.client/pull/18265), [[BCN-9513] History details](https://github.com/superbet-group/dot-country-web.client/pull/18299), [fix: free chips available bonus card](https://github.com/superbet-group/dot-country-web.client/pull/18601) | 4.5 | 5.4 | 1.1 |
| 4 | **Card UI — Phases 2–3 (states 3–4: Pending bonus, Bonus awarded)** | medium | `dot-country-web.client` | [[BCN-9513] History details](https://github.com/superbet-group/dot-country-web.client/pull/18299) | 4.0 | 4.8 | 1.0 |
| 5 | **Bonus materialisation + Bonus Tab consolidation (state 4 system action)** | high | Platform TBD (bonus/campaign services) + `dot-country-web.client` (stores, Bonus tab, invalidation) | — | 6.0 | 7.2 | 1.4 |
| 6 | **Terminal states & rules (5–7: used, campaign expired, bonus expired)** | medium | `dot-country-web.client` + contract tests with backend | — | 3.5 | 4.2 | 0.8 |
| 7 | **Analytics & event contracts (states and transitions)** | medium | `product.analytics`, `data.airflow.dags`, client instrumentation | — | 3.0 | 3.6 | 0.7 |
| 8 | **web.promotion-hub MFE / federation (if in scope)** | medium | `web.promotion-hub`, `dot-country-web.client` | — | 1.5 | 1.8 | 0.4 |
| 9 | **QA, E2E, and cross-surface matrix (7 states × surfaces × markets)** | high | `dot-country-web.client` (+ automated suites as applicable) | — | 5.5 | 6.6 | 1.3 |
| | **TOTAL** | | | | **32.5** | **39.0** | **7.8** |

**Optional savings:** If WP8 is out of scope (all work stays in the federated shell only), subtract **1.5 raw days** → **31.0 raw / 37.2 buffered (~7.4 person-weeks)**.

## Evidence (GitHub)

- **Player shell:** `superbet-group/dot-country-web.client` — Promotion Hub (`PromotionService`, DTO mappers, `PromotionsInProgressList`, v2 cards/overlays). Recent comparable UI: [#18265](https://github.com/superbet-group/dot-country-web.client/pull/18265), [#18299](https://github.com/superbet-group/dot-country-web.client/pull/18299), [#18339](https://github.com/superbet-group/dot-country-web.client/pull/18339).
- **Dedicated MFE:** `superbet-group/web.promotion-hub` — only if product confirms this delivery surface.
- **Reporting:** `superbet-group/product.analytics` — promo hub tabs, entry points, interaction events.
- **WP5** assumes one or more **backend/contract** repositories will be identified in WP1 (bonus lifecycle, campaign completion, idempotent “create bonus” behaviour).

## Work Package Details

### 1. Discovery & state model alignment (PRD → domain/API)

Produce a single **state map**: each PRD state (1–7) ↔ existing or new **API fields** (campaign participation, qualification progress, fulfillment/pending, bonus lifecycle, campaign end vs bonus expiry). Run workshops with backend/design; document gaps, sequencing, and feature-flag strategy. Resolves the PRD’s “System Status: ???” before large UI build.

- **Complexity:** high  
- **Raw estimate:** 3.0 days · **Buffered:** 3.6 days (0.7 person-weeks)

### 2. Navigation: Active tab replaces In Progress

Implement tab model change: routing, deep links, `promotionHubTabs` (or equivalent), empty/redirect behaviour, copy/i18n, and safe rollout (flag if needed). Ensures state **2** lives under the new **Active** experience rather than only renaming labels.

- **Complexity:** medium  
- **Impacted repos:** dot-country-web.client; translation bundles as needed  
- **Raw estimate:** 2.0 days · **Buffered:** 2.4 days (0.5 person-weeks)

### 3. Card UI — Phase 1 (states 1–2: Available, Active)

“Learn More” / “Opt-In”; post–opt-in progress (counts, bar, spend remaining); multiple CTAs (View progress, T&Cs, etc.) per confirmed design. Includes SCSS, shared components, and **design iteration** within the estimate (CTAs still TBD in PRD).

- **Complexity:** medium  
- **Raw estimate:** 4.5 days · **Buffered:** 5.4 days (1.1 person-weeks)

### 4. Card UI — Phases 2–3 (states 3–4: Pending bonus, Bonus awarded)

Success/pending messaging while reward is processed; transition to **bonus-first** card (reward copy, primary “Use now” / “Redeem”). Covers async UX (loading, refetch/poll strategy, failure/retry) **in the client** once contracts are known from WP1.

- **Complexity:** medium  
- **Raw estimate:** 4.0 days · **Buffered:** 4.8 days (1.0 person-weeks)

### 5. Bonus materialisation + Bonus Tab consolidation (state 4 system action)

Implement or wire **server-side guarantee**: when the user reaches **Bonus awarded**, the platform **creates the bonus instance** shown in **Bonus Tab**, with idempotency, ordering vs webhooks/pushes, and client **cache/store invalidation** so both tabs stay consistent. This is the largest unknown until WP1 names services; estimate assumes moderate new integration work, not a full greenfield bonus engine.

- **Complexity:** high  
- **Raw estimate:** 6.0 days · **Buffered:** 7.2 days (1.4 person-weeks)

### 6. Terminal states & rules (5–7)

Distinct UI for **bonus used** (happy path), **campaign expired** (from 1–2), **bonus expired** (from 4); correct handling of **two different expiries** and “used” detection; edge cases (timezone, boundary days). Includes contract/unit coverage with backend where rules live.

- **Complexity:** medium  
- **Raw estimate:** 3.5 days · **Buffered:** 4.2 days (0.8 person-weeks)

### 7. Analytics & event contracts (states and transitions)

Instrument or extend events for **key transitions** (opt-in, progress milestones, pending, awarded, redeem, both expiry types, used); update `product.analytics` structures and downstream DAGs/metrics where required; validate with data stakeholders.

- **Complexity:** medium  
- **Raw estimate:** 3.0 days · **Buffered:** 3.6 days (0.7 person-weeks)

### 8. web.promotion-hub MFE / federation (if in scope)

Only if delivery includes the standalone MFE: align federation boundaries, routing, and shared tokens with the shell.

- **Complexity:** medium  
- **Raw estimate:** 1.5 days · **Buffered:** 1.8 days (0.4 person-weeks)  
- **Exclude from plan** if product confirms shell-only delivery.

### 9. QA, E2E, and cross-surface matrix

Matrix across **seven states**, web/mobile shells, markets/flags, and **Bonus Tab** consistency after state 4. Regression on opt-in, progress, redemption, and expiry paths.

- **Complexity:** high  
- **Raw estimate:** 5.5 days · **Buffered:** 6.6 days (1.3 person-weeks)

---

*Revision v2: full PRD lifecycle + bonus consolidation + tab change + discovery + heavier analytics/QA. For Notion publish via MCP, configure `NOTION_API_KEY` and `NOTION_PARENT_PAGE_ID` for `prd-estimator` and call `publish_estimation` with the same work package structure.*
