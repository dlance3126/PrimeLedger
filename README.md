# PrimeLedger Phase 1

PrimeLedger is a static daily operations dashboard for restaurant owners. The first product question is:

> Did yesterday's operations make money, and what should change today?

This repo is the Phase 1 prototype. It runs entirely in the browser with HTML, CSS, and JavaScript.

## What It Shows

- Daily net sales
- Labor cost and labor percentage
- Estimated COGS and prime cost
- Shift-level contribution estimate
- Payroll cycle estimates
- Distribution safety guardrail
- Cash runway estimate
- Operational alerts
- Seven-day sales, labor, and prime cost trend

## App Views

- `Dashboard`: summary metrics and alerts.
- `Trends`: seven-day chart and shift/daypart profitability.
- `Cash Safety`: bank cash, payroll, vendor obligations, reserve, and labor-rate inputs.
- `Imports`: PrimeLedger CSV upload, Toast CSV upload, Toast folder upload, and local sample data loading.
- `Settings`: labor matching rules, paid/unpaid settings, hourly rates, COGS target, labor target, prime cost target, and upcoming payday.

## Running It

For basic CSV upload, you can open `index.html` directly in a browser.

For the `Load local ToastData` button, run a local static server from the repo root because browsers usually block `fetch()` from local files:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## Data Imports

PrimeLedger accepts its own simple CSV format:

```csv
date,shift,net_sales,labor_cost,labor_hours
2026-05-25,Lunch,3720,1085,44
2026-05-25,Dinner,6810,1855,71
```

It also recognizes these Toast exports:

- `Sales by day.csv`
- `OrderDetails_*.csv`
- `Labor cost by job.csv`

Import options:

- `Choose CSV files`: select one or more PrimeLedger or Toast CSV files.
- `Choose Toast report folder`: select a folder of Toast CSV reports; unsupported reports are ignored.
- `Load local ToastData`: loads the sample Toast files included in this repo.

The included sample files live in `ToastData/`.

## Toast Import Behavior

Current dashboard inputs are sales by day, order details, and labor cost by job.

Other Toast files, such as voids, discounts, payment details, product mix, and menu reports, are included as useful future inputs but do not currently create dashboard rows by themselves.

Sales handling:

- `OrderDetails` creates shift-level sales rows from order open times.
- `Sales by day` fills all-day sales when detailed order rows are not available for a date.

Labor handling:

- Daily labor rows are allocated across sales rows for the same date.
- If Toast labor exports only include aggregate hours and no daily labor cost, PrimeLedger estimates labor cost from labor rules and hourly-rate assumptions.
- If only aggregate labor is available, labor is allocated across imported sales rows proportionally.

## Labor Rules And Assumptions

Default assumptions:

- Estimated COGS: `31%`
- Target labor: `24%`
- Target prime cost: `60%`
- Default paid labor rate: `$22/hour`
- Upcoming payday: `2026-05-28`

Default labor rules:

- Owners are unpaid.
- Server Training is unpaid.
- Chef labor is paid at `$22/hour`.
- Other paid labor defaults to `$22/hour`.

Labor rules match Toast labor rows by employee name or job title. You can edit, add, or remove rules in `Settings`.

## Persistence

The app does not have a backend database yet.

Saved in browser `localStorage`:

- Cash assumptions
- Labor rules
- Target labor percentage
- Estimated COGS percentage
- Target prime cost percentage
- Upcoming payday

Not saved permanently:

- Imported dashboard rows
- Uploaded CSV file contents

After refreshing the page, reload CSV files or use `Load local ToastData` again.

## Repository Contents

- `index.html`: app shell and view markup.
- `styles.css`: visual styling and responsive layout.
- `app.js`: dashboard logic, CSV parsing, Toast import handling, calculations, rendering, and localStorage config.
- `ToastData/`: sample Toast CSV exports.
- `.gitignore`: excludes macOS `.DS_Store` files.

## Phase 1 Non-Goals

- No general ledger
- No chart of accounts
- No payroll processing
- No inventory management
- No multi-location support
- No AI forecasting
- No bank integrations

## Next Build Steps

1. Persist imported dashboard rows in browser storage or a small backend database.
2. Add saved import sessions with clear/reset controls.
3. Add Toast-specific mappings for voids, discounts, tips, taxes, service charges, and product mix.
4. Compare actual results against weekly targets.
5. Add exportable daily summaries for owner review.
