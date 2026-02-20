import { execSync } from "child_process";
import { join } from "path";

const JOURNAL_PATH = join(process.cwd(), "data", "sample.journal");

// --- Base functions ---

export function hledger(args: string): string {
  try {
    return execSync(`hledger -f "${JOURNAL_PATH}" ${args}`, {
      timeout: 5000,
      encoding: "utf-8",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    throw new Error(`hledger command failed: ${message}`);
  }
}

export function hledgerJson(args: string): unknown {
  const output = hledger(`${args} -O json`);
  return JSON.parse(output);
}

// --- Helper ---

export function extractAmount(amounts: unknown[]): number {
  if (amounts.length === 0) return 0;
  const amt = amounts[0] as { aquantity: { floatingPoint: number } };
  return Math.round(amt.aquantity.floatingPoint * 100) / 100;
}

function dateToYearMonth(contents: string | number): string {
  if (typeof contents === "string") {
    // hledger v1.51+ uses { tag: "Exact", contents: "2025-09-01" }
    return contents.slice(0, 7);
  }
  // Older versions use Modified Julian Day: { tag: "ModifiedJulianDay", contents: 60588 }
  return new Date((contents - 2440587.5) * 86400000)
    .toISOString()
    .slice(0, 7);
}

// --- Types ---

export interface CategoryBreakdown {
  name: string;
  amount: number;
  percentage: number;
}

export interface MonthlySpending {
  date: string;
  categories: { name: string; amount: number }[];
  total: number;
}

export interface SpendingBreakdownResult {
  months: MonthlySpending[];
  categoryTotals: CategoryBreakdown[];
  grandTotal: number;
  period: string;
}

export interface PeriodTrend {
  date: string;
  income: number;
  expenses: number;
  net: number;
}

export interface TrendsResult {
  periods: PeriodTrend[];
}

export interface FinancialSummaryResult {
  netWorth: number;
  totalIncome: number;
  totalExpenses: number;
  savingsRate: number;
  cashflow: number;
  topExpenses: { name: string; amount: number }[];
}

// --- Parsers ---

export function getSpendingBreakdown(
  period: string,
  depth?: number,
  category?: string,
): SpendingBreakdownResult {
  const depthArg = depth ? `--depth ${depth}` : "";
  const account = category
    ? `"expenses:${category}"`
    : "expenses";

  // Monthly periodic balance report
  const result = hledgerJson(
    `bal ${account} ${depthArg} -p "${period}" -M -S`,
  ) as {
    prDates: { tag: string; contents: string | number }[][];
    prRows: {
      prrName: string;
      prrAmounts: unknown[][];
      prrTotal: unknown[];
      prrAverage: unknown[];
    }[];
    prTotals: {
      prrAmounts: unknown[][];
      prrTotal: unknown[];
    };
  };

  const dates = result.prDates.map(
    (pair) => dateToYearMonth(pair[0].contents),
  );

  // Build per-month data
  const months: MonthlySpending[] = dates.map((date, i) => {
    const categories: { name: string; amount: number }[] = [];
    let monthTotal = 0;
    for (const row of result.prRows) {
      const amount = Math.abs(extractAmount(row.prrAmounts[i] ?? []));
      if (amount > 0) {
        categories.push({
          name: row.prrName.replace(/^expenses:/, ""),
          amount,
        });
        monthTotal += amount;
      }
    }
    // Sort by amount descending within each month
    categories.sort((a, b) => b.amount - a.amount);
    return { date, categories, total: Math.round(monthTotal * 100) / 100 };
  });

  // Category totals across all months (from prrTotal)
  const grandTotal = Math.abs(extractAmount(result.prTotals.prrTotal));
  const categoryTotals: CategoryBreakdown[] = result.prRows
    .map((row) => {
      const amount = Math.abs(extractAmount(row.prrTotal));
      return {
        name: row.prrName.replace(/^expenses:/, ""),
        amount,
        percentage:
          grandTotal > 0
            ? Math.round((amount / grandTotal) * 10000) / 100
            : 0,
      };
    })
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  return { months, categoryTotals, grandTotal, period };
}

export function getFinancialTrends(
  period: string,
  interval: "monthly" | "weekly" | "quarterly",
): TrendsResult {
  const flagMap = { monthly: "M", weekly: "W", quarterly: "Q" };
  const flag = flagMap[interval];

  const result = hledgerJson(`is -${flag} -p "${period}"`) as {
    cbrTitle: string;
    cbrDates: { tag: string; contents: string | number }[][];
    cbrSubreports: [
      string,
      {
        prDates: unknown[];
        prRows: {
          prrName: string;
          prrAmounts: unknown[][];
          prrTotal: unknown[];
          prrAverage: unknown[];
        }[];
        prTotals: unknown;
      },
      boolean,
    ][];
    cbrTotals: {
      prrName: string;
      prrAmounts: unknown[][];
      prrTotal: unknown[];
      prrAverage: unknown[];
    };
  };

  const dates = result.cbrDates.map(
    (pair) => dateToYearMonth(pair[0].contents),
  );

  // Revenue subreport (index 0), expenses subreport (index 1)
  const revenueSubreport = result.cbrSubreports[0][1];
  const expensesSubreport = result.cbrSubreports[1][1];

  const periods: PeriodTrend[] = dates.map((date, i) => {
    // Sum all revenue rows for this period column
    let income = 0;
    for (const row of revenueSubreport.prRows) {
      income += extractAmount(row.prrAmounts[i] ?? []);
    }
    // Revenue amounts are already positive (inverted flag)
    income = Math.abs(Math.round(income * 100) / 100);

    // Sum all expense rows for this period column
    let expenses = 0;
    for (const row of expensesSubreport.prRows) {
      expenses += extractAmount(row.prrAmounts[i] ?? []);
    }
    expenses = Math.abs(Math.round(expenses * 100) / 100);

    const net = Math.round((income - expenses) * 100) / 100;

    return { date, income, expenses, net };
  });

  return { periods };
}

export function getFinancialSummary(
  period?: string,
): FinancialSummaryResult {
  const periodArg = period ? `-p "${period}"` : "";

  // Balance sheet for net worth
  const bsResult = hledgerJson(`bs ${periodArg}`) as {
    cbrTotals: {
      prrAmounts: unknown[][];
      prrTotal: unknown[];
    };
  };

  // Income statement for income/expenses
  const isResult = hledgerJson(`is ${periodArg}`) as {
    cbrSubreports: [
      string,
      {
        prRows: {
          prrName: string;
          prrAmounts: unknown[][];
          prrTotal: unknown[];
        }[];
        prTotals: {
          prrAmounts: unknown[][];
          prrTotal: unknown[];
        };
      },
      boolean,
    ][];
    cbrTotals: {
      prrTotal: unknown[];
    };
  };

  // Balance for top expenses
  const balResult = hledgerJson(
    `bal expenses --depth 2 ${periodArg} -S`,
  ) as [unknown[], unknown[]];

  // Net worth from bs totals
  const netWorth = extractAmount(bsResult.cbrTotals.prrTotal);

  // Income and expenses from is subreports
  const revenueReport = isResult.cbrSubreports[0][1];
  const expensesReport = isResult.cbrSubreports[1][1];
  const totalIncome = Math.abs(
    extractAmount(revenueReport.prTotals.prrTotal),
  );
  const totalExpenses = Math.abs(
    extractAmount(expensesReport.prTotals.prrTotal),
  );

  const savingsRate =
    totalIncome > 0
      ? Math.round(
          ((totalIncome - totalExpenses) / totalIncome) * 10000,
        ) / 100
      : 0;

  const cashflow =
    Math.round((totalIncome - totalExpenses) * 100) / 100;

  // Top 5 expenses from bal
  const [rows] = balResult;
  const topExpenses = (
    rows as [string, string, number, unknown[]][]
  )
    .slice(0, 5)
    .map(([fullName, , , amounts]) => ({
      name: fullName.replace(/^expenses:/, ""),
      amount: Math.abs(extractAmount(amounts)),
    }));

  return {
    netWorth,
    totalIncome,
    totalExpenses,
    savingsRate,
    cashflow,
    topExpenses,
  };
}

// --- Discovery ---

export interface DataInfo {
  categories: string[];
  dateRange: { start: string; end: string };
  suggestedPeriods: { label: string; value: string }[];
}

export function getDataInfo(): DataInfo {
  // Get expense categories (depth 2 for top-level groupings)
  const accountsRaw = hledger("accounts expenses --depth 2").trim();
  const categories = accountsRaw
    .split("\n")
    .map((a) => a.replace(/^expenses:/, ""))
    .filter(Boolean);

  // Get date range from stats
  const statsRaw = hledger("stats");
  const spanMatch = statsRaw.match(
    /Txns span\s*:\s*(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})/,
  );
  const start = spanMatch ? spanMatch[1] : "unknown";
  const end = spanMatch ? spanMatch[2] : "unknown";

  const suggestedPeriods = [
    { label: "All time", value: `${start}..${end}` },
    { label: "Last 3 months", value: "2025-12..2026-03" },
    { label: "Last month", value: "2026-02" },
    { label: "Q4 2025 (Oct–Dec)", value: "2025q4" },
    { label: "Q1 2026 (Jan–Mar)", value: "2026q1" },
  ];

  return { categories, dateRange: { start, end }, suggestedPeriods };
}

// --- Budget Comparison ---

export interface BudgetPeriod {
  date: string;
  actual: number;
  budget: number;
  percentage: number;
}

export interface BudgetCategory {
  name: string;
  periods: BudgetPeriod[];
  totalActual: number;
  totalBudget: number;
  totalPercentage: number;
}

export interface BudgetComparisonResult {
  categories: BudgetCategory[];
  period: string;
  totals: BudgetPeriod[];
}

function extractBudgetCell(cell: unknown[][]): { actual: number; budget: number } {
  const actual = cell[0] && (cell[0] as unknown[]).length > 0
    ? Math.abs(extractAmount(cell[0] as unknown[]))
    : 0;
  const budget = cell[1] && (cell[1] as unknown[]).length > 0
    ? Math.abs(extractAmount(cell[1] as unknown[]))
    : 0;
  return { actual, budget };
}

export function getBudgetComparison(
  period: string,
  depth?: number,
): BudgetComparisonResult {
  const depthArg = depth ? `--depth ${depth}` : "--depth 2";
  const result = hledgerJson(
    `bal expenses --budget ${depthArg} -p "${period}" -M`,
  ) as {
    prDates: { tag: string; contents: string | number }[][];
    prRows: {
      prrName: string;
      prrAmounts: unknown[][][];
      prrTotal: unknown[][];
      prrAverage: unknown[][];
    }[];
    prTotals: {
      prrName: unknown;
      prrAmounts: unknown[][][];
      prrTotal: unknown[][];
      prrAverage: unknown[][];
    };
  };

  const dates = result.prDates.map(
    (pair) => dateToYearMonth(pair[0].contents),
  );

  const categories: BudgetCategory[] = result.prRows.map((row) => {
    const periods = row.prrAmounts.map((cell, i) => {
      const { actual, budget } = extractBudgetCell(cell);
      return {
        date: dates[i],
        actual,
        budget,
        percentage: budget > 0 ? Math.round((actual / budget) * 100) : 0,
      };
    });

    const { actual: totalActual, budget: totalBudget } = extractBudgetCell(row.prrTotal);

    return {
      name: row.prrName.replace(/^expenses:/, ""),
      periods,
      totalActual,
      totalBudget,
      totalPercentage: totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0,
    };
  });

  const totals = result.prTotals.prrAmounts.map((cell, i) => {
    const { actual, budget } = extractBudgetCell(cell);
    return {
      date: dates[i],
      actual,
      budget,
      percentage: budget > 0 ? Math.round((actual / budget) * 100) : 0,
    };
  });

  return { categories, period, totals };
}
