# hledger Financial Insights MCP App — Design Document

**Date:** 2026-02-20
**Context:** Claude Code London Hack Night 03 — "Build an MCP App"
**Submission deadline:** Sunday Feb 22, 23:59
**Team size:** Solo or pair
**Deliverables:** Video demo, GitHub repo, README

---

## 1. Overview

An MCP App that turns plain-text accounting data (hledger) into interactive financial insights inside Claude Chat. Users ask natural language questions about their finances — Claude picks the right visualization tool, queries hledger, and renders rich charts directly in the conversation.

**The pitch:** "Ask your finances anything — AI-powered financial analyst that does in seconds what takes hours with spreadsheets."

## 2. Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Claude Chat (claude.ai / Claude Desktop)                │
│                                                          │
│  User: "Where am I spending the most money?"             │
│  Claude → picks spending-breakdown tool                  │
│  Claude → passes { period: "this month", depth: 2 }     │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  [widget renders in sandboxed iframe]              │  │
│  │  Bar chart: Food $1,580 | Rent $2,000 | ...       │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
         │  MCP protocol (ngrok tunnel for dev)
         ▼
┌──────────────────────────────────────────────────────────┐
│  Skybridge Server (localhost:3000/mcp)                   │
│                                                          │
│  server/src/index.ts                                     │
│    ├── registerWidget("spending-breakdown", ...)         │
│    ├── registerWidget("financial-trends", ...)           │
│    └── registerWidget("financial-summary", ...)          │
│                                                          │
│  server/src/hledger.ts                                   │
│    └── execSync(`hledger -f data/sample.journal ...`)    │
└──────────────────────────────────────────────────────────┘
         │  child_process.execSync
         ▼
┌──────────────────────────────────────────────────────────┐
│  hledger CLI                                             │
│    reads: data/sample.journal                            │
│    returns: JSON via -O json                             │
└──────────────────────────────────────────────────────────┘
```

**Key decisions:**
- Single process: Skybridge server is the only thing we run
- hledger invoked via CLI per-request (fast enough — ~25k tx/sec)
- Claude's intelligence handles "which widget?" routing based on user question
- No database, no auth, no external services — just files and CLI

## 3. Widgets

### 3.1 `spending-breakdown`

**Claude uses when:** "Where is my money going?", "Top expenses?", "How much on food?"

| Aspect | Detail |
|--------|--------|
| **Input schema** | `period` (string, e.g. "last 6 months"), `depth` (number, default 2), `accountFilter` (optional string) |
| **hledger command** | `hledger bal expenses --depth {depth} -p "{period}" -M -O json -S` |
| **Server returns** | `{ months: [{ date, categories: [{ name, amount }] }], categoryTotals: [{ name, total, percentage }] }` |
| **Widget renders** | Stacked or grouped bar chart with months on x-axis, expense categories as colored segments. Shows how spending per category changes month-over-month. |

### 3.2 `financial-trends`

**Claude uses when:** "How are expenses trending?", "Income vs spending?", "Am I saving more?"

| Aspect | Detail |
|--------|--------|
| **Input schema** | `period` (string, e.g. "last 6 months"), `interval` (enum: monthly/weekly/quarterly) |
| **hledger command** | `hledger is -{M\|W\|Q} -p "{period}" -O json` |
| **Server returns** | `{ periods: [{ date, income, expenses, net }] }` |
| **Widget renders** | Multi-line chart: income (green), expenses (red), net savings (blue) |

### 3.3 `financial-summary`

**Claude uses when:** "Give me an overview", "Financial health?", "Net worth?"

| Aspect | Detail |
|--------|--------|
| **Input schema** | `period` (optional string) |
| **hledger commands** | `hledger bs -O json` + `hledger is -O json` + `hledger cf -O json` |
| **Server returns** | `{ netWorth, totalIncome, totalExpenses, savingsRate, cashflow, topExpenses: [{ name, amount }] }` |
| **Widget renders** | Card grid with key metrics (net worth, savings rate, income, expenses, cashflow) |

## 4. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Skybridge (MCP App framework) |
| Server | TypeScript, Node.js 24+ |
| Widgets | React 19, Chart.js + react-chartjs-2 |
| Accounting | hledger CLI with `-O json` output |
| Data | Static `.journal` file (sample data) |
| Build | Vite, pnpm |
| Deployment | Alpic (optional, for production URL) |

## 5. Project Structure

```
anthropic-hackathon/
├── data/
│   └── sample.journal              # ~6 months, ~200-300 transactions
├── server/
│   └── src/
│       ├── index.ts                # 3 widget registrations + server.run()
│       └── hledger.ts              # Thin CLI wrapper (~20 lines)
├── web/
│   └── src/
│       ├── widgets/
│       │   ├── spending-breakdown.tsx
│       │   ├── financial-trends.tsx
│       │   └── financial-summary.tsx
│       ├── helpers.ts              # Type helpers (existing)
│       └── index.css               # Shared styles
├── package.json                    # + chart.js, react-chartjs-2
├── alpic.json
└── tsconfig.json
```

**Files to create:**
- `data/sample.journal`
- `server/src/hledger.ts`
- `web/src/widgets/spending-breakdown.tsx`
- `web/src/widgets/financial-trends.tsx`
- `web/src/widgets/financial-summary.tsx`

**Files to modify:**
- `server/src/index.ts` (replace Magic 8-Ball with 3 widgets)
- `web/src/index.css` (styles for new widgets)
- `package.json` (add chart.js, react-chartjs-2)

**Files to delete:**
- `web/src/widgets/magic-8-ball.tsx`

## 6. Sample Journal Data

The `data/sample.journal` will contain ~6 months (Sep 2025 — Feb 2026) of realistic personal finance data:

**Accounts:**
- `assets:bank:checking`, `assets:bank:savings`
- `liabilities:credit-card`
- `income:salary`, `income:freelance`
- `expenses:housing:rent`, `expenses:food:groceries`, `expenses:food:dining`
- `expenses:transport`, `expenses:utilities`, `expenses:entertainment`
- `expenses:subscriptions`, `expenses:health`, `expenses:clothing`

**Characteristics:**
- Monthly salary (~$5,000) with occasional freelance ($500-1,500)
- Rent fixed at $1,800/month
- Food spending that trends upward (good for demo — "you're spending more on food")
- Seasonal variation in entertainment/clothing
- A few large one-off purchases (good for anomaly detection)
- ~40-50 transactions per month

## 7. hledger CLI Wrapper

```typescript
// server/src/hledger.ts
import { execSync } from "child_process";
import { join } from "path";

const JOURNAL_PATH = join(process.cwd(), "data", "sample.journal");

export function hledger(args: string): string {
  return execSync(`hledger -f "${JOURNAL_PATH}" ${args}`, {
    encoding: "utf-8",
    timeout: 5000,
  });
}

export function hledgerJson(args: string): unknown {
  return JSON.parse(hledger(`${args} -O json`));
}
```

## 8. Demo Flow

The ideal demo narrative for the video submission:

1. Open Claude Chat with the MCP App connected
2. "Hey Claude, can you give me a financial overview?" → `financial-summary` widget renders with metric cards
3. "I feel like I'm spending too much — where's my money going?" → `spending-breakdown` widget with bar chart
4. "How has my spending changed over the last 6 months?" → `financial-trends` widget with line charts
5. "Am I spending more on food recently?" → `spending-breakdown` filtered to food, showing the upward trend
6. Claude provides natural language commentary alongside each widget

## 9. Stretch Goals (Weekend Polish)

If time permits after the core 3 widgets:

1. **CSV upload flow** — upload bank CSV, convert to journal, analyze
2. **Budget comparison widget** — actual vs budget using hledger's `--budget` flag
3. **data-llm attributes** — keep Claude aware of what the user is seeing in the widgets
4. **Dark mode / visual polish** — make the video demo look professional
5. **Deploy to Alpic** — production URL for judges to try live

## 10. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| hledger not installed on machine | Install via `brew install hledger` before hackathon |
| hledger JSON output format surprises | Test all 3 command outputs with sample data first |
| ngrok tunnel issues for Claude connection | Test tunnel setup before hackathon; have Alpic deploy as backup |
| Chart.js rendering issues in Skybridge iframe | Test with DevTools emulator first |
| Time pressure (90 min hack time) | Build hledger wrapper + sample data first, then widgets in parallel |
