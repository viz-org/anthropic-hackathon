# hledger Financial Insights — MCP App

An AI-powered financial dashboard built as an MCP App using [Skybridge](https://docs.skybridge.tech/home). Ask Claude about your finances in natural language and get interactive charts, tables, and anomaly alerts rendered directly in chat.

Built with [hledger](https://hledger.org/) (plain-text accounting) on the backend and Chart.js widgets on the frontend.

## What It Does

Ask Claude things like:
- "Where is my money going?" — stacked bar chart by category and month
- "How are my finances trending?" — income vs expenses over time
- "Give me a financial overview" — dashboard with net worth, savings rate, cashflow
- "Am I on budget?" — actual vs budget comparison
- "Show my recent restaurant purchases" — searchable transaction table
- "How has my net worth changed?" — assets, liabilities, and net worth over time
- "Flag anything unusual" — anomaly detection with severity ratings
- Upload a CSV bank statement — visual preview, dedup, and import

## Widgets

| Widget | Description |
|--------|-------------|
| **spending-breakdown** | Monthly stacked bar chart of expense categories |
| **financial-trends** | Multi-line chart: income, expenses, net savings |
| **financial-summary** | Key metrics: net worth, income, expenses, savings rate |
| **budget-comparison** | Grouped bar chart: actual vs budget per category |
| **transaction-search** | Filterable transaction table with dates, accounts, amounts |
| **net-worth-timeline** | Line chart: net worth, assets, liabilities over time |
| **anomaly-detection** | Alert cards for unusual spending with severity badges |
| **csv-upload** | CSV import preview with stats, table, and confirmation flow |

## Tools

| Tool | Description |
|------|-------------|
| **get-data-info** | Discover available categories, date ranges, and suggested periods |
| **preview-csv** | Parse and preview a CSV bank statement (text-only, no widget) |
| **import-csv** | Import a confirmed CSV into the journal |

## Architecture

```
server/src/
├── index.ts           # Widget & tool registrations (MCP App entry point)
├── hledger.ts         # hledger CLI wrapper — shells out with -O json
└── csv-processor.ts   # CSV parsing, column detection, dedup, journal conversion

web/src/
├── widgets/           # One React component per widget (Chart.js + react-chartjs-2)
├── helpers.ts         # Typed Skybridge helpers (useToolInfo, useCallTool)
└── index.css          # Shared styles (light/dark mode)

data/
├── sample.journal     # Demo financial data
└── uploaded.journal   # User-imported CSV data (gitignored)
```

The server shells out to `hledger` CLI with `-O json` for structured data. Both `sample.journal` and `uploaded.journal` are merged automatically so imported CSV data appears in all widgets immediately.

## Prerequisites

- Node.js 24+
- [hledger](https://hledger.org/install.html) installed and on PATH
- HTTP tunnel (e.g. [ngrok](https://ngrok.com/download)) for testing with Claude.ai or ChatGPT

## Getting Started

```bash
pnpm install
pnpm dev
```

This starts:
- MCP server at `http://localhost:3000/mcp`
- Skybridge DevTools at `http://localhost:3000/`

## Deploy

```bash
pnpm build
pnpm deploy   # deploys to Alpic
```

Or deploy to any cloud platform supporting MCP. See [Skybridge docs](https://docs.skybridge.tech/) for details.

## Resources

- [Skybridge Documentation](https://docs.skybridge.tech/)
- [hledger Documentation](https://hledger.org/)
- [MCP Apps Spec](https://github.com/modelcontextprotocol/ext-apps/tree/main)
- [Alpic Deployment](https://docs.alpic.ai/)
