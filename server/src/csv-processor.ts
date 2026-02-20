import { existsSync, readFileSync } from "fs";
import { join } from "path";

// --- Deduplication ---

function txnKey(date: string, description: string, amount: number): string {
  return `${date}|${description}|${amount}`;
}

function getExistingTransactionKeys(): Set<string> {
  const keys = new Set<string>();
  const uploadedPath = join(process.cwd(), "data", "uploaded.journal");
  if (!existsSync(uploadedPath)) return keys;

  const content = readFileSync(uploadedPath, "utf-8");
  // Parse journal entries: date line followed by posting lines
  const lines = content.split("\n");
  let currentDate = "";
  let currentDesc = "";

  for (const line of lines) {
    // Transaction header: "2026-01-15 Tesco groceries"
    const headerMatch = line.match(/^(\d{4}-\d{2}-\d{2})\s+(.+)/);
    if (headerMatch) {
      currentDate = headerMatch[1];
      currentDesc = headerMatch[2].trim();
      continue;
    }
    // Posting with amount: "    expenses:unknown    £45.80"
    const postingMatch = line.match(/^\s+\S+.*£([\d.]+)/);
    if (postingMatch && currentDate) {
      const amount = parseFloat(postingMatch[1]);
      keys.add(txnKey(currentDate, currentDesc, amount));
      keys.add(txnKey(currentDate, currentDesc, -amount));
      currentDate = "";
      currentDesc = "";
    }
  }

  return keys;
}

// --- CSV Parsing ---

interface CsvRow {
  [key: string]: string;
}

function parseCsv(content: string): { headers: string[]; rows: CsvRow[] } {
  let normalized: string;
  if (content.includes("\n")) {
    // Real newlines
    normalized = content;
  } else if (content.includes("\\n")) {
    // Literal \n characters from JSON
    normalized = content.replace(/\\n/g, "\n");
  } else {
    // Space-separated (DevTools strips newlines) — split before date patterns
    normalized = content.replace(/ (\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{4})/g, "\n$1")
                        .replace(/ (\d{4}-\d{2}-\d{2})/g, "\n$1");
  }
  const lines = normalized
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row");

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: CsvRow = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });
    return row;
  });

  return { headers, rows };
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

// --- Column Auto-Detection ---

const DATE_PATTERNS = [/^date$/i, /^transaction.?date$/i, /^posted$/i, /^booking.?date$/i, /^value.?date$/i];
const DESC_PATTERNS = [/^desc/i, /^narrative$/i, /^memo$/i, /^reference$/i, /^detail/i, /^transaction.?desc/i, /^payee$/i];
const AMOUNT_PATTERNS = [/^amount$/i, /^value$/i, /^sum$/i];
const DEBIT_PATTERNS = [/^debit$/i, /^money.?out$/i, /^paid.?out$/i, /^withdrawal/i, /^expense/i];
const CREDIT_PATTERNS = [/^credit$/i, /^money.?in$/i, /^paid.?in$/i, /^deposit/i, /^income/i];

function detectColumn(headers: string[], patterns: RegExp[]): string | undefined {
  return headers.find((h) => patterns.some((p) => p.test(h)));
}

export interface ColumnMapping {
  date: string;
  description: string;
  amount?: string;
  debit?: string;
  credit?: string;
}

export function autoDetectColumns(headers: string[]): ColumnMapping | null {
  const date = detectColumn(headers, DATE_PATTERNS);
  const description = detectColumn(headers, DESC_PATTERNS);
  if (!date || !description) return null;

  const amount = detectColumn(headers, AMOUNT_PATTERNS);
  const debit = detectColumn(headers, DEBIT_PATTERNS);
  const credit = detectColumn(headers, CREDIT_PATTERNS);

  if (amount) return { date, description, amount };
  if (debit || credit) return { date, description, debit, credit };

  return null;
}

// --- Date Parsing ---

function parseDate(raw: string): string {
  const trimmed = raw.trim();

  // ISO: 2025-09-15
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // UK: DD/MM/YYYY or DD-MM-YYYY
  const ukMatch = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (ukMatch) {
    return `${ukMatch[3]}-${ukMatch[2].padStart(2, "0")}-${ukMatch[1].padStart(2, "0")}`;
  }

  // US: MM/DD/YYYY — try as fallback if day > 12
  // (ambiguous with UK, but we prefer UK format)

  // DD Mon YYYY: 15 Sep 2025
  const monthNames: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const namedMatch = trimmed.match(/^(\d{1,2})\s+(\w{3})\s+(\d{4})$/);
  if (namedMatch) {
    const mon = monthNames[namedMatch[2].toLowerCase()];
    if (mon) return `${namedMatch[3]}-${mon}-${namedMatch[1].padStart(2, "0")}`;
  }

  throw new Error(`Cannot parse date: "${raw}"`);
}

// --- Amount Parsing ---

function parseAmount(raw: string): number {
  if (!raw || raw.trim() === "") return 0;
  // Strip currency symbols and whitespace, keep minus sign
  const cleaned = raw.replace(/[£$€,\s]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return Math.round(num * 100) / 100;
}

// --- Parsed Transaction ---

export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number; // positive = expense, negative = income
}

export interface PreviewResult {
  transactions: ParsedTransaction[];
  count: number;
  skippedDuplicates: number;
  dateRange: { start: string; end: string };
  totalExpenses: number;
  totalIncome: number;
  headers: string[];
  mapping: ColumnMapping;
  sample: ParsedTransaction[];
}

export function previewCsv(
  csvContent: string,
  mappingOverride?: ColumnMapping,
): PreviewResult {
  const { headers, rows } = parseCsv(csvContent);

  const mapping = mappingOverride ?? autoDetectColumns(headers);
  if (!mapping) {
    throw new Error(
      `Could not auto-detect columns. Headers found: ${headers.join(", ")}. ` +
      `Expected columns like Date, Description, and Amount (or Debit/Credit).`,
    );
  }

  // Validate mapping columns exist
  for (const [key, col] of Object.entries(mapping)) {
    if (col && !headers.includes(col)) {
      throw new Error(`Column "${col}" (for ${key}) not found in CSV headers: ${headers.join(", ")}`);
    }
  }

  const transactions: ParsedTransaction[] = [];

  for (const row of rows) {
    const date = parseDate(row[mapping.date]);
    const description = row[mapping.description] ?? "Unknown";

    let amount: number;
    if (mapping.amount) {
      amount = parseAmount(row[mapping.amount]);
    } else {
      const debit = mapping.debit ? parseAmount(row[mapping.debit]) : 0;
      const credit = mapping.credit ? parseAmount(row[mapping.credit]) : 0;
      amount = debit > 0 ? debit : -credit;
    }

    if (amount === 0) continue; // skip zero-amount rows

    transactions.push({ date, description, amount });
  }

  transactions.sort((a, b) => a.date.localeCompare(b.date));

  // Deduplicate against already-imported transactions
  const existingKeys = getExistingTransactionKeys();
  const beforeCount = transactions.length;
  const dedupedTransactions = transactions.filter(
    (t) => !existingKeys.has(txnKey(t.date, t.description, t.amount)),
  );
  const skippedDuplicates = beforeCount - dedupedTransactions.length;

  const dates = dedupedTransactions.map((t) => t.date);
  const totalExpenses = dedupedTransactions
    .filter((t) => t.amount > 0)
    .reduce((s, t) => s + t.amount, 0);
  const totalIncome = dedupedTransactions
    .filter((t) => t.amount < 0)
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  return {
    transactions: dedupedTransactions,
    count: dedupedTransactions.length,
    skippedDuplicates,
    dateRange: {
      start: dates[0] ?? "unknown",
      end: dates[dates.length - 1] ?? "unknown",
    },
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    totalIncome: Math.round(totalIncome * 100) / 100,
    headers,
    mapping,
    sample: transactions.slice(0, 5),
  };
}

// --- Journal Conversion ---

export function transactionsToJournal(transactions: ParsedTransaction[]): string {
  const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
  let journal = `; Imported from CSV at ${timestamp}\n`;
  journal += `; ${transactions.length} transactions\n\n`;

  for (const txn of transactions) {
    const isExpense = txn.amount > 0;
    const absAmount = Math.abs(txn.amount).toFixed(2);
    const account = isExpense ? "expenses:unknown" : "income:unknown";

    journal += `${txn.date} ${txn.description}\n`;
    journal += `    ${account}    £${absAmount}\n`;
    journal += `    assets:bank:checking\n`;
    journal += `\n`;
  }

  return journal;
}
