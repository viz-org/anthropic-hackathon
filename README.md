# Ledger Lens — MCP App

> Ask your finances anything. An AI-powered financial analyst that turns your transactions into interactive visualizations inside Claude Chat.

Built for the **Claude Code London Hack Night** (Feb 20, 2026) using [Skybridge](https://docs.skybridge.tech/home) and [hledger](https://hledger.org/).

## Demo

Ask Claude natural-language questions about your finances and get rich, interactive widgets rendered directly in the conversation:

| Prompt | What You Get |
|--------|-------------|
| "Give me a financial overview" | Dashboard with net worth, savings rate, income, expenses, cashflow |
| "Where is my money going?" | Stacked bar chart by category and month, with drill-down |
| "How are my finances trending?" | Multi-line chart: income vs expenses vs net savings |
| "Am I on budget?" | Side-by-side actual vs budget per category |
| "Show my restaurant purchases" | Searchable, filterable transaction table |
| "How has my net worth changed?" | Assets, liabilities, and net worth over time |
| "What will my net worth look like in 9 months?" | Scenario projections (pessimistic / realistic / optimistic) |
| "Flag anything unusual" | Anomaly detection cards with severity ratings |
| *Upload a CSV bank statement* | Visual preview, deduplication, and one-click import |

## Widgets (9)

| Widget | Description |
|--------|-------------|
| `spending-breakdown` | Monthly stacked bar chart of expense categories with interactive drill-down |
| `financial-trends` | Multi-line chart: income, expenses, net savings (monthly/weekly/quarterly) |
| `financial-summary` | Key metric cards: net worth, income, expenses, savings rate, cashflow |
| `budget-comparison` | Grouped bar chart: actual vs budget per category with % indicators |
| `transaction-search` | Filterable transaction table with date, account, and description search |
| `net-worth-timeline` | Line chart: net worth, assets, liabilities over time |
| `net-worth-forecast` | 9-month projections across 3 scenarios (pessimistic/realistic/optimistic) |
| `anomaly-detection` | Alert cards for unusual spending with severity badges and z-score analysis |
| `csv-upload` | CSV import with preview table, stats, dedup check, and confirmation flow |

## Tools (6)

| Tool | Description |
|------|-------------|
| `get-data-info` | Discover available categories, date ranges, and suggested query periods |
| `preview-csv` | Parse and preview a CSV bank statement (read-only) |
| `import-csv` | Import confirmed CSV transactions into the journal |
| `recategorize` | Batch re-categorize imported transactions |
| `detect-recurring` | Find subscriptions, salary, and recurring payments |
| `bulk-transactions` | Fetch up to 500 transactions as compact text for analysis |

## Architecture

```
server/src/
├── index.ts           # Widget & tool registrations (MCP App entry point)
├── hledger.ts         # hledger CLI wrapper — shells out with -O json, 15+ parsing functions
└── csv-processor.ts   # CSV parsing, auto-column detection, dedup, journal conversion

web/src/
├── widgets/           # 9 React components (Chart.js + react-chartjs-2)
├── helpers.ts         # Typed Skybridge helpers (useToolInfo, useCallTool)
└── index.css          # Shared styles with light/dark mode support

data/
├── sample.journal     # Sample financial data (see note below)
└── test-bank-statement.csv  # Sample CSV for import testing

bin/
└── hledger            # Bundled hledger binary (see deployment note)

docs/plans/            # Design docs and review notes (left intentionally)
```

The server shells out to the `hledger` CLI with `-O json` for structured financial data. Both `sample.journal` and any user-imported CSV data are merged automatically, so imported transactions appear across all widgets immediately.

### hledger

[hledger](https://hledger.org/) is a plain-text accounting CLI tool. We've **bundled a pre-built hledger binary** in `bin/` so the app is self-contained and easy to deploy to Alpic without requiring hledger to be installed on the host. The server auto-detects a system hledger or falls back to the bundled binary.

### Flexible CSV Import

Transaction data can be in any format — there's no need for specialised handlers per bank or data source. Claude detects the structure of the uploaded CSV automatically and transforms it for import into hledger. Just drag and drop a bank statement and Claude figures out the columns, dates, and amounts.

### Sample Data

The app ships with **sample financial data** in `data/sample.journal` — roughly 6 months of realistic transactions (Sep 2025 – Feb 2026) including salary income, rent, groceries, dining, subscriptions, and budget targets. This is demo data for evaluating the app; in production, users would import their own bank statements via the CSV upload widget.

### Design Plans

The `docs/plans/` directory contains the original design document and implementation review findings. These are left in the repo intentionally to show our planning and development process.

## Getting Started

```bash
pnpm install
pnpm dev
```

This starts:
- MCP server at `http://localhost:3000/mcp`
- Skybridge DevTools at `http://localhost:3000/`

### Prerequisites

- Node.js 24+
- [hledger](https://hledger.org/install.html) on PATH (or use the bundled binary in `bin/`)

## Deploy to Alpic

```bash
pnpm build
pnpm deploy
```

## Tech Stack

- **MCP Framework:** [Skybridge](https://docs.skybridge.tech/home)
- **Backend:** TypeScript, Node.js, hledger CLI
- **Frontend:** React 19, Chart.js, Vite
- **Validation:** Zod
- **Deployment:** [Alpic](https://docs.alpic.ai/)

## Resources

- [Skybridge Documentation](https://docs.skybridge.tech/)
- [hledger Documentation](https://hledger.org/)
- [MCP Apps Spec](https://github.com/modelcontextprotocol/ext-apps/tree/main)
- [Model Context Protocol](https://modelcontextprotocol.io)

## Team

Built by **Pete Mitchell** and **Vino Mano** at Claude Code London Hack Night 03.
