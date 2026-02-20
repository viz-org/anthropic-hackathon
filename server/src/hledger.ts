import { execSync } from "child_process";
import { existsSync, appendFileSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";

const SAMPLE_JOURNAL = join(process.cwd(), "data", "sample.journal");
const UPLOADED_JOURNAL = join("/tmp", "uploaded.journal");

function journalFlags(): string {
  const flags = `-f "${SAMPLE_JOURNAL}"`;
  if (existsSync(UPLOADED_JOURNAL)) {
    return `${flags} -f "${UPLOADED_JOURNAL}"`;
  }
  return flags;
}

// Use bundled binary if system hledger is not available
function getHledgerPath(): string {
  try {
    execSync("which hledger", { encoding: "utf-8" });
    return "hledger";
  } catch {
    const bundled = join(process.cwd(), "bin", "hledger");
    if (existsSync(bundled)) {
      return bundled;
    }
    throw new Error("hledger not found: install it or ensure bin/hledger exists");
  }
}

const HLEDGER_BIN = getHledgerPath();

// --- Base functions ---

export function hledger(args: string): string {
  try {
    return execSync(`${HLEDGER_BIN} ${journalFlags()} ${args}`, {
      timeout: 30000,
      encoding: "utf-8",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    throw new Error(`hledger command failed: ${message}`);
  }
}

export function appendToUploadedJournal(content: string): void {
  if (!existsSync(UPLOADED_JOURNAL)) {
    writeFileSync(UPLOADED_JOURNAL, "; Uploaded transactions\n\n", "utf-8");
  }
  appendFileSync(UPLOADED_JOURNAL, content, "utf-8");
}

export function recategorizeTransactions(
  mapping: { description: string; newAccount: string }[],
): { updated: number; unchanged: number } {
  if (!existsSync(UPLOADED_JOURNAL)) return { updated: 0, unchanged: 0 };

  let content = readFileSync(UPLOADED_JOURNAL, "utf-8");
  let updated = 0;

  for (const { description, newAccount } of mapping) {
    const escaped = description.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(
      `(\\d{4}-\\d{2}-\\d{2}\\s+${escaped}[^\\n]*\\n\\s+)expenses:unknown`,
      "gi",
    );
    const before = content;
    content = content.replace(regex, `$1${newAccount}`);
    if (content !== before) updated++;
  }

  writeFileSync(UPLOADED_JOURNAL, content, "utf-8");
  return { updated, unchanged: mapping.length - updated };
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

// --- Transaction Search ---

export interface Transaction {
  date: string;
  description: string;
  account: string;
  amount: number;
  runningTotal: number;
}

export interface TransactionSearchResult {
  transactions: Transaction[];
  count: number;
  query: string;
}

export function getTransactionSearch(
  account?: string,
  description?: string,
  period?: string,
  limit?: number,
): TransactionSearchResult {
  const parts: string[] = ["register"];

  if (account) parts.push(account);
  if (description) parts.push(`desc:"${description}"`);
  if (period) parts.push(`-p "${period}"`);

  const queryStr = parts.slice(1).join(" ");
  const result = hledgerJson(parts.join(" ")) as [
    string,         // date
    string | null,  // date2
    string,         // description
    {               // posting
      paccount: string;
      pamount: { aquantity: { floatingPoint: number } }[];
    },
    { aquantity: { floatingPoint: number } }[], // running total
  ][];

  const maxItems = limit ?? 50;
  const transactions: Transaction[] = result
    .slice(-maxItems)
    .map(([date, , desc, posting, total]) => ({
      date,
      description: desc,
      account: posting.paccount,
      amount: Math.round((posting.pamount[0]?.aquantity?.floatingPoint ?? 0) * 100) / 100,
      runningTotal: Math.round((total[0]?.aquantity?.floatingPoint ?? 0) * 100) / 100,
    }));

  return { transactions, count: result.length, query: queryStr };
}

// --- Net Worth Timeline ---

export interface NetWorthPoint {
  date: string;
  assets: number;
  liabilities: number;
  netWorth: number;
}

export interface NetWorthTimelineResult {
  points: NetWorthPoint[];
}

export function getNetWorthTimeline(
  period?: string,
): NetWorthTimelineResult {
  const periodArg = period ? `-p "${period}"` : "";

  // Monthly balance sheet gives cumulative balances per period
  const result = hledgerJson(`bs -M ${periodArg}`) as {
    cbrDates: { tag: string; contents: string | number }[][];
    cbrSubreports: [
      string,
      {
        prRows: {
          prrName: string;
          prrAmounts: unknown[][];
        }[];
        prTotals: {
          prrAmounts: unknown[][];
        };
      },
      boolean,
    ][];
    cbrTotals: {
      prrAmounts: unknown[][];
    };
  };

  const dates = result.cbrDates.map(
    (pair) => dateToYearMonth(pair[0].contents),
  );

  // Subreport 0 = Assets, Subreport 1 = Liabilities
  const assetsSubreport = result.cbrSubreports[0][1];
  const liabilitiesSubreport = result.cbrSubreports[1][1];

  const points: NetWorthPoint[] = dates.map((date, i) => {
    let assets = 0;
    for (const row of assetsSubreport.prRows) {
      assets += extractAmount(row.prrAmounts[i] ?? []);
    }
    assets = Math.round(assets * 100) / 100;

    let liabilities = 0;
    for (const row of liabilitiesSubreport.prRows) {
      liabilities += extractAmount(row.prrAmounts[i] ?? []);
    }
    liabilities = Math.abs(Math.round(liabilities * 100) / 100);

    const netWorth = Math.round((assets - liabilities) * 100) / 100;
    return { date, assets, liabilities, netWorth };
  });

  return { points };
}

// --- Anomaly Detection ---

export interface Anomaly {
  category: string;
  month: string;
  amount: number;
  average: number;
  deviation: number;
  severity: "high" | "medium";
  direction: "above" | "below";
}

export interface AnomalyDetectionResult {
  anomalies: Anomaly[];
  period: string;
}

export function getAnomalies(
  period?: string,
): AnomalyDetectionResult {
  const periodArg = period ? `-p "${period}"` : "";

  // Monthly expense breakdown
  const result = hledgerJson(
    `bal expenses --depth 2 ${periodArg} -M`,
  ) as {
    prDates: { tag: string; contents: string | number }[][];
    prRows: {
      prrName: string;
      prrAmounts: unknown[][];
    }[];
  };

  const dates = result.prDates.map(
    (pair) => dateToYearMonth(pair[0].contents),
  );

  const anomalies: Anomaly[] = [];

  for (const row of result.prRows) {
    const amounts = row.prrAmounts.map((a) => Math.abs(extractAmount(a)));
    const nonZero = amounts.filter((a) => a > 0);
    if (nonZero.length < 3) continue; // need enough data points

    const avg = nonZero.reduce((s, a) => s + a, 0) / nonZero.length;
    const stdDev = Math.sqrt(
      nonZero.reduce((s, a) => s + (a - avg) ** 2, 0) / nonZero.length,
    );

    if (stdDev === 0) continue; // constant spending, no anomalies

    for (let i = 0; i < amounts.length; i++) {
      const amount = amounts[i];
      if (amount === 0) continue;
      const zScore = (amount - avg) / stdDev;

      if (Math.abs(zScore) >= 1.5) {
        anomalies.push({
          category: row.prrName.replace(/^expenses:/, ""),
          month: dates[i],
          amount,
          average: Math.round(avg * 100) / 100,
          deviation: Math.round(zScore * 100) / 100,
          severity: Math.abs(zScore) >= 2 ? "high" : "medium",
          direction: zScore > 0 ? "above" : "below",
        });
      }
    }
  }

  // Sort by severity (high first), then by deviation magnitude
  anomalies.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "high" ? -1 : 1;
    return Math.abs(b.deviation) - Math.abs(a.deviation);
  });

  const usedPeriod = periodArg || "all time";
  return { anomalies, period: usedPeriod };
}

// --- Recurring Transaction Detection ---

export interface RecurringTransaction {
  description: string;
  account: string;
  averageAmount: number;
  frequency: "weekly" | "monthly" | "quarterly" | "yearly";
  occurrences: number;
  lastDate: string;
  nextExpectedDate: string;
  amounts: number[];
}

export function getRecurringTransactions(
  minOccurrences?: number,
): RecurringTransaction[] {
  const min = minOccurrences ?? 3;

  const result = hledgerJson("register") as [
    string,         // date
    string | null,  // date2
    string,         // description
    {
      paccount: string;
      pamount: { aquantity: { floatingPoint: number } }[];
    },
    unknown[], // running total
  ][];

  // Group by normalized description, keep original casing
  const groups = new Map<
    string,
    { date: string; description: string; account: string; amount: number }[]
  >();

  for (const [date, , desc, posting] of result) {
    const key = desc.toLowerCase().trim();
    if (!key) continue;
    const amount =
      Math.round(
        (posting.pamount[0]?.aquantity?.floatingPoint ?? 0) * 100,
      ) / 100;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ date, description: desc, account: posting.paccount, amount });
  }

  const recurring: RecurringTransaction[] = [];

  for (const [, entries] of groups) {
    if (entries.length < min) continue;

    entries.sort((a, b) => a.date.localeCompare(b.date));

    // Calculate gaps in days between consecutive occurrences
    const gaps: number[] = [];
    for (let i = 1; i < entries.length; i++) {
      const d1 = new Date(entries[i - 1].date).getTime();
      const d2 = new Date(entries[i].date).getTime();
      gaps.push(Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
    }

    if (gaps.length === 0) continue;

    // Calculate median gap
    const sorted = [...gaps].sort((a, b) => a - b);
    const median =
      sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];

    // Classify frequency
    let frequency: "weekly" | "monthly" | "quarterly" | "yearly" | null = null;
    if (median >= 5 && median <= 9) frequency = "weekly";
    else if (median >= 25 && median <= 35) frequency = "monthly";
    else if (median >= 80 && median <= 100) frequency = "quarterly";
    else if (median >= 350 && median <= 380) frequency = "yearly";

    if (!frequency) continue;

    // Skip if gap variance is too high (coefficient of variation > 0.5)
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    const gapStdDev = Math.sqrt(
      gaps.reduce((s, g) => s + (g - avgGap) ** 2, 0) / gaps.length,
    );
    if (avgGap > 0 && gapStdDev / avgGap > 0.5) continue;

    const amounts = entries.map((e) => Math.abs(e.amount));
    const avgAmount =
      Math.round(
        (amounts.reduce((s, a) => s + a, 0) / amounts.length) * 100,
      ) / 100;

    // Most common account
    const accountCounts = new Map<string, number>();
    for (const e of entries) {
      accountCounts.set(e.account, (accountCounts.get(e.account) ?? 0) + 1);
    }
    const account = [...accountCounts.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0][0];

    // Predict next date
    const lastDate = entries[entries.length - 1].date;
    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + Math.round(median));
    const nextExpectedDate = nextDate.toISOString().slice(0, 10);

    recurring.push({
      description: entries[entries.length - 1].description,
      account,
      averageAmount: avgAmount,
      frequency,
      occurrences: entries.length,
      lastDate,
      nextExpectedDate,
      amounts: amounts.slice(-5),
    });
  }

  // Sort: monthly first, then by amount descending
  const freqOrder = { weekly: 0, monthly: 1, quarterly: 2, yearly: 3 };
  recurring.sort((a, b) => {
    const fDiff = freqOrder[a.frequency] - freqOrder[b.frequency];
    if (fDiff !== 0) return fDiff;
    return b.averageAmount - a.averageAmount;
  });

  return recurring;
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
