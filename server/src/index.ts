import { McpServer } from "skybridge/server";
import { z } from "zod";
import {
  getSpendingBreakdown,
  getFinancialTrends,
  getFinancialSummary,
  getBudgetComparison,
  getDataInfo,
} from "./hledger.js";

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
        "Show where money is being spent. Use when the user asks about spending breakdown, top expenses, category spending, or where their money goes. Examples: 'Where is my money going?', 'Top expenses this month?', 'How much on food?'",
      inputSchema: {
        period: z
          .string()
          .describe(
            'Time period for the report, e.g. "this month", "last 3 months", "2025-10", "2025-09..2026-03"',
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
        const topItems = result.categories
          .slice(0, 5)
          .map((c) => `${c.name} £${c.amount.toLocaleString()} (${c.percentage}%)`)
          .join(", ");
        return {
          structuredContent: result,
          content: [
            {
              type: "text" as const,
              text: `Spending breakdown for ${period}: Total £${result.total.toLocaleString()}. Top categories: ${topItems}.`,
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
  );

server.registerTool(
  "get-data-info",
  {
    description:
      "Get available expense categories and date ranges for the financial data. Call this FIRST before other tools so you can suggest valid categories and periods to the user. Returns a list of expense categories (e.g. food, housing, transport) and suggested time periods.",
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
      const catList = info.categories.join(", ");
      const periodList = info.suggestedPeriods
        .map((p) => `${p.label} (${p.value})`)
        .join(", ");
      return {
        content: [
          {
            type: "text" as const,
            text: `Available data from ${info.dateRange.start} to ${info.dateRange.end}.\n\nExpense categories: ${catList}.\n\nSuggested periods: ${periodList}.`,
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
