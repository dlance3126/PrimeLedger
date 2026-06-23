# PrimeLedger Phase 1

PrimeLedger v1 is a narrow daily operations dashboard for restaurant owners.
The first product question is:

> Did yesterday's operations make money, and what should change today?

## Current Prototype

This static prototype includes:

- Daily net sales
- Labor cost and labor percentage
- Estimated COGS and prime cost
- Shift-level contribution estimate
- Distribution safety guardrail
- Operational alerts
- CSV upload for sales and labor data
- Toast CSV import support for Sales by day, OrderDetails, and Labor cost by job exports
- Separate Dashboard, Trends, Cash Safety, Imports, and Settings views
- Browser-saved labor rules for positions, paid/unpaid status, and hourly rates

Open `index.html` directly in a browser.

## CSV Format

Upload a CSV with these columns:

```csv
date,shift,net_sales,labor_cost,labor_hours
2026-05-25,Lunch,3720,1085,44
2026-05-25,Dinner,6810,1855,71
```

You can also upload Toast exports directly:

- `Sales by day.csv`
- `OrderDetails_*.csv`
- `Labor cost by job.csv`

Those three are the current dashboard inputs. Other Toast files such as voids,
discounts, product mix, and payment detail are useful later, but they do not
currently create daily dashboard rows by themselves.

If Toast labor exports only include aggregate hours and no daily labor cost, PrimeLedger
uses the estimated labor dollars per hour assumption and allocates labor across imported
sales days proportionally.

Current labor-cost assumption:

- Chef labor is estimated at `$22/hour`.
- Owner labor and Server Training labor are treated as unpaid for hourly wage estimates.

## Phase 1 Non-Goals

- No general ledger
- No chart of accounts
- No payroll processing
- No inventory management
- No multi-location support
- No AI forecasting
- No bank integrations

## Next Build Steps

1. Add persistent local storage or a small backend database.
2. Add persistent local storage or a small backend database.
3. Add editable COGS and labor targets.
4. Add Toast-specific import templates.
5. Compare actual results against weekly targets.
