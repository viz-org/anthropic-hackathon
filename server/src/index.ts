import { McpServer } from "skybridge/server";
import { z } from "zod";
import {
  getSpendingBreakdown,
  getFinancialTrends,
  getFinancialSummary,
  getBudgetComparison,
  getTransactionSearch,
  getNetWorthTimeline,
  getAnomalies,
  getDataInfo,
  appendToUploadedJournal,
} from "./hledger.js";
import {
  previewCsv,
  transactionsToJournal,
} from "./csv-processor.js";

const server = new McpServer(
  {
    name: "hledger-financial-insights",
    version: "0.1.0",
  },
  { capabilities: {} },
)
  .registerWidget(
    "spending-breakdown",
    {
      description: "Interactive bar chart showing expense categories and percentages",
    },
    {
      description:
        "Show monthly spending breakdown as a stacked bar chart. Each month gets its own stacked bar showing expense categories. Always use a multi-month period range so the chart shows month-over-month comparison. Examples: 'Where is my money going?', 'Top expenses?', 'How much on food?'",
      inputSchema: {
        period: z
          .string()
          .describe(
            'Time period range — MUST span multiple months for the chart to be useful. Use date ranges like "2025-09..2026-03" or "this year" or "this quarter". Avoid single months.',
          ),
        depth: z
          .number()
          .optional()
          .default(2)
          .describe(
            "Account depth for grouping (2 = top-level categories like food, housing)",
          ),
        category: z
          .string()
          .optional()
          .describe(
            'Optional filter to drill into a specific category, e.g. "food" to see groceries vs dining',
          ),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async ({ period, depth, category }) => {
      try {
        const result = getSpendingBreakdown(period, depth, category);
        const topItems = result.categoryTotals
          .slice(0, 5)
          .map((c) => `${c.name} £${c.amount.toLocaleString()} (${c.percentage}%)`)
          .join(", ");
        return {
          structuredContent: result,
          content: [
            {
              type: "text" as const,
              text: `Monthly spending breakdown for ${period} (${result.months.length} months): Grand total £${result.grandTotal.toLocaleString()}. Top categories: ${topItems}.`,
            },
          ],
          isError: false,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error getting spending breakdown: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  )
  .registerWidget(
    "financial-trends",
    {
      description:
        "Multi-line chart showing income, expenses, and net savings over time",
    },
    {
      description:
        "Show financial trends over time. Use when the user asks about spending trends, income vs expenses, savings trajectory, or how finances have changed. Examples: 'How are my expenses trending?', 'Income vs spending over time?', 'Am I saving more?'",
      inputSchema: {
        period: z
          .string()
          .describe(
            'Time period range, e.g. "last 6 months", "2025-09..2026-03", "this year"',
          ),
        interval: z
          .enum(["monthly", "weekly", "quarterly"])
          .optional()
          .default("monthly")
          .describe("Grouping interval for the trend data"),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async ({ period, interval }) => {
      try {
        const result = getFinancialTrends(period, interval);
        const avgIncome =
          result.periods.reduce((s, p) => s + p.income, 0) /
          (result.periods.length || 1);
        const avgExpenses =
          result.periods.reduce((s, p) => s + p.expenses, 0) /
          (result.periods.length || 1);
        const latestNet =
          result.periods.length > 0
            ? result.periods[result.periods.length - 1].net
            : 0;
        return {
          structuredContent: result,
          content: [
            {
              type: "text" as const,
              text: `Financial trends (${interval}, ${period}): Average income £${Math.round(avgIncome).toLocaleString()}/period, average expenses £${Math.round(avgExpenses).toLocaleString()}/period. Most recent period net: £${latestNet.toLocaleString()}.`,
            },
          ],
          isError: false,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error getting financial trends: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  )
  .registerWidget(
    "financial-summary",
    {
      description:
        "Dashboard with key financial metrics: net worth, income, expenses, savings rate, and cashflow",
    },
    {
      description:
        "Show a financial overview with key metrics. Use when the user asks for a summary, financial health check, net worth, or overall picture. Examples: 'Give me a financial overview', 'What is my net worth?', 'How am I doing financially?'",
      inputSchema: {
        period: z
          .string()
          .optional()
          .describe(
            'Optional time period to scope the summary, e.g. "this month", "last quarter". Omit for all-time.',
          ),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async ({ period }) => {
      try {
        const result = getFinancialSummary(period);
        const topExpStr = result.topExpenses
          .slice(0, 3)
          .map((e) => `${e.name} (£${e.amount.toLocaleString()})`)
          .join(", ");
        return {
          structuredContent: result,
          content: [
            {
              type: "text" as const,
              text: `Financial summary${period ? ` for ${period}` : ""}: Net worth £${result.netWorth.toLocaleString()}, income £${result.totalIncome.toLocaleString()}, expenses £${result.totalExpenses.toLocaleString()}, savings rate ${result.savingsRate}%, cashflow £${result.cashflow.toLocaleString()}. Top expenses: ${topExpStr}.`,
            },
          ],
          isError: false,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error getting financial summary: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  )
  .registerWidget(
    "budget-comparison",
    {
      description:
        "Grouped bar chart comparing actual spending vs budget targets per category",
    },
    {
      description:
        "Compare actual spending against budget targets. Use when the user asks about budget performance, overspending, whether they're on track, or how actual compares to planned. Examples: 'Am I on budget?', 'Where am I overspending?', 'How does my spending compare to my budget?'",
      inputSchema: {
        period: z
          .string()
          .describe(
            'Time period range, e.g. "2025-09..2026-03", "last 3 months", "this quarter"',
          ),
        depth: z
          .number()
          .optional()
          .default(2)
          .describe(
            "Account depth for grouping (2 = top-level categories like food, housing)",
          ),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async ({ period, depth }) => {
      try {
        const result = getBudgetComparison(period, depth);
        const overBudget = result.categories
          .filter((c) => c.totalPercentage > 100)
          .map((c) => `${c.name} (${c.totalPercentage}%)`)
          .join(", ");
        const underBudget = result.categories
          .filter((c) => c.totalPercentage <= 100 && c.totalPercentage > 0)
          .map((c) => `${c.name} (${c.totalPercentage}%)`)
          .join(", ");
        return {
          structuredContent: result,
          content: [
            {
              type: "text" as const,
              text: `Budget comparison for ${period}. Over budget: ${overBudget || "none"}. Within budget: ${underBudget || "none"}.`,
            },
          ],
          isError: false,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error getting budget comparison: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  )
  .registerWidget(
    "transaction-search",
    {
      description:
        "Searchable table of financial transactions with dates, descriptions, accounts, and amounts",
    },
    {
      description:
        "Search and display individual transactions. Use when the user asks to see transactions, look up specific purchases, find payments, or drill into account activity. Examples: 'Show my recent food purchases', 'What did I spend at restaurants?', 'Show transactions for January'",
      inputSchema: {
        account: z
          .string()
          .optional()
          .describe(
            'Account to filter by, e.g. "expenses:food", "assets:bank:checking", "expenses:entertainment"',
          ),
        description: z
          .string()
          .optional()
          .describe(
            'Search term to filter by transaction description, e.g. "amazon", "groceries", "rent"',
          ),
        period: z
          .string()
          .optional()
          .describe(
            'Time period, e.g. "2026-01", "2025-09..2026-03", "this month"',
          ),
        limit: z
          .number()
          .optional()
          .default(30)
          .describe("Max number of transactions to return (most recent first)"),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async ({ account, description, period, limit }) => {
      try {
        const result = getTransactionSearch(account, description, period, limit);
        return {
          structuredContent: result,
          content: [
            {
              type: "text" as const,
              text: `Found ${result.count} transactions${result.query ? ` matching: ${result.query}` : ""}. Showing ${result.transactions.length} most recent.`,
            },
          ],
          isError: false,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error searching transactions: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  )
  .registerWidget(
    "net-worth-timeline",
    {
      description:
        "Line chart showing net worth, assets, and liabilities over time",
    },
    {
      description:
        "Show net worth trajectory over time. Use when the user asks about net worth history, asset growth, wealth trends, or how their financial position has changed. Examples: 'How has my net worth changed?', 'Show my wealth over time', 'Are my assets growing?'",
      inputSchema: {
        period: z
          .string()
          .optional()
          .describe(
            'Time period range, e.g. "2025-09..2026-03", "this year". Omit for all available data.',
          ),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async ({ period }) => {
      try {
        const result = getNetWorthTimeline(period);
        const latest = result.points[result.points.length - 1];
        const first = result.points[0];
        const change = latest ? latest.netWorth - (first?.netWorth ?? 0) : 0;
        return {
          structuredContent: result,
          content: [
            {
              type: "text" as const,
              text: `Net worth timeline: ${result.points.length} months. Current net worth: £${latest?.netWorth.toLocaleString() ?? "N/A"}. Change over period: £${change.toLocaleString()}.`,
            },
          ],
          isError: false,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error getting net worth timeline: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  )
  .registerWidget(
    "anomaly-detection",
    {
      description:
        "Alert cards highlighting unusual spending patterns and financial anomalies",
    },
    {
      description:
        "Detect unusual spending patterns and anomalies. Use when the user asks about unexpected expenses, spending spikes, unusual activity, or wants to find outliers. Examples: 'Any unusual spending?', 'Where did I overspend?', 'Flag anything weird in my finances'",
      inputSchema: {
        period: z
          .string()
          .optional()
          .describe(
            'Time period to analyze, e.g. "2025-09..2026-03". Omit for all available data.',
          ),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async ({ period }) => {
      try {
        const result = getAnomalies(period);
        const highCount = result.anomalies.filter((a) => a.severity === "high").length;
        const summary = result.anomalies
          .slice(0, 3)
          .map((a) => `${a.category} in ${a.month}: £${a.amount} (${a.deviation > 0 ? "+" : ""}${a.deviation}σ ${a.direction} average)`)
          .join("; ");
        return {
          structuredContent: result,
          content: [
            {
              type: "text" as const,
              text: `Found ${result.anomalies.length} anomalies (${highCount} high severity). Top: ${summary || "none"}.`,
            },
          ],
          isError: false,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error detecting anomalies: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  )
  .registerWidget(
    "csv-upload",
    {
      description:
        "Interactive CSV import preview with transaction table, stats, and import confirmation",
    },
    {
      description:
        "Preview and import a CSV bank statement with a visual table. Use when the user provides CSV data or a bank statement to import. First call with confirm=false to show preview. After user confirms, call again with confirm=true to import.",
      inputSchema: {
        csvContent: z
          .string()
          .describe("The full CSV file content as a string"),
        confirm: z
          .boolean()
          .optional()
          .default(false)
          .describe("Set to true to actually import the transactions. Default false = preview only."),
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async ({ csvContent, confirm }) => {
      try {
        const result = previewCsv(csvContent);

        if (confirm) {
          const journal = transactionsToJournal(result.transactions);
          appendToUploadedJournal(journal);
          return {
            structuredContent: {
              imported: true,
              transactions: result.transactions,
              count: result.count,
              skippedDuplicates: result.skippedDuplicates,
              dateRange: result.dateRange,
              totalExpenses: result.totalExpenses,
              totalIncome: result.totalIncome,
            },
            content: [
              {
                type: "text" as const,
                text: `Successfully imported ${result.count} transactions.${result.skippedDuplicates > 0 ? ` (${result.skippedDuplicates} duplicates skipped)` : ""} All widgets now include this data.`,
              },
            ],
            isError: false,
          };
        }

        return {
          structuredContent: {
            imported: false,
            transactions: result.transactions,
            count: result.count,
            skippedDuplicates: result.skippedDuplicates,
            dateRange: result.dateRange,
            totalExpenses: result.totalExpenses,
            totalIncome: result.totalIncome,
          },
          content: [
            {
              type: "text" as const,
              text: `CSV preview: ${result.count} new transactions found.${result.skippedDuplicates > 0 ? ` (${result.skippedDuplicates} duplicates skipped)` : ""} Ask the user to confirm before calling again with confirm=true.`,
            },
          ],
          isError: false,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error processing CSV: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

server.registerTool(
  "preview-csv",
  {
    description:
      "Parse and preview a CSV bank statement WITHOUT importing it. Returns a summary of detected transactions, date range, totals, and a sample of the first 5 rows. Use this FIRST when a user provides CSV data, then show them the preview and ask for confirmation before calling import-csv.",
    inputSchema: {
      csvContent: z
        .string()
        .describe("The full CSV file content as a string"),
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  async ({ csvContent }) => {
    try {
      const result = previewCsv(csvContent);
      const sampleLines = result.sample
        .map((t) => `  ${t.date}  ${t.description}  ${t.amount > 0 ? "expense" : "income"} £${Math.abs(t.amount)}`)
        .join("\n");
      return {
        content: [
          {
            type: "text" as const,
            text: [
              `CSV Preview: ${result.count} new transactions found.${result.skippedDuplicates > 0 ? ` (${result.skippedDuplicates} duplicates skipped)` : ""}`,
              `Date range: ${result.dateRange.start} to ${result.dateRange.end}`,
              `Total expenses: £${result.totalExpenses.toLocaleString()}`,
              `Total income: £${result.totalIncome.toLocaleString()}`,
              `Detected columns: date="${result.mapping.date}", description="${result.mapping.description}", ${result.mapping.amount ? `amount="${result.mapping.amount}"` : `debit="${result.mapping.debit}", credit="${result.mapping.credit}"`}`,
              ``,
              `Sample transactions:`,
              sampleLines,
              ``,
              `Ask the user to confirm before importing.`,
            ].join("\n"),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error previewing CSV: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.registerTool(
  "import-csv",
  {
    description:
      "Import a previously previewed CSV bank statement into the journal. Only call this AFTER preview-csv and after the user has confirmed they want to import. Converts transactions to hledger journal format and appends to the uploaded journal file.",
    inputSchema: {
      csvContent: z
        .string()
        .describe("The same CSV content that was previewed"),
    },
    annotations: {
      readOnlyHint: false,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  async ({ csvContent }) => {
    try {
      const result = previewCsv(csvContent);
      const journal = transactionsToJournal(result.transactions);
      appendToUploadedJournal(journal);
      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Successfully imported ${result.count} transactions.${result.skippedDuplicates > 0 ? ` (${result.skippedDuplicates} duplicates skipped)` : ""}`,
              `Date range: ${result.dateRange.start} to ${result.dateRange.end}`,
              `Total expenses: £${result.totalExpenses.toLocaleString()}`,
              `Total income: £${result.totalIncome.toLocaleString()}`,
              ``,
              `Transactions saved to uploaded journal. All existing widgets (spending breakdown, trends, etc.) will now include this data.`,
            ].join("\n"),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error importing CSV: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.registerTool(
  "get-data-info",
  {
    description:
      "Get available expense categories, date range, and suggested periods. Call this FIRST before using any financial widget to discover valid parameters.",
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  async () => {
    try {
      const info = getDataInfo();
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(info, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error getting data info: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.run();

export type AppType = typeof server;
