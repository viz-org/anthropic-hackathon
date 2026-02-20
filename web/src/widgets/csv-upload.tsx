import "@/index.css";

import { mountWidget } from "skybridge/web";
import { useToolInfo } from "../helpers.js";

function CsvUpload() {
  const { output, isPending } = useToolInfo<"csv-upload">();

  if (isPending || !output) {
    return (
      <div className="container">
        <div className="loading">
          <div className="loading-spinner" />
          Processing CSV…
        </div>
      </div>
    );
  }

  const {
    imported,
    transactions,
    count,
    skippedDuplicates,
    dateRange,
    totalExpenses,
    totalIncome,
  } = output as {
    imported: boolean;
    transactions: { date: string; description: string; amount: number }[];
    count: number;
    skippedDuplicates: number;
    dateRange: { start: string; end: string };
    totalExpenses: number;
    totalIncome: number;
  };

  if (imported) {
    return (
      <div className="container">
        <div className="csv-success">
          <div className="csv-success-icon">&#10003;</div>
          <div className="csv-success-text">
            Imported {count} transactions
          </div>
          <div className="csv-success-sub">
            {dateRange.start} to {dateRange.end} · £{totalExpenses.toLocaleString()} expenses · £{totalIncome.toLocaleString()} income
            {skippedDuplicates > 0 && ` · ${skippedDuplicates} duplicates skipped`}
          </div>
          <div className="csv-success-sub">
            All widgets now include this data. Ask Claude to analyse your spending!
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="container"
      data-llm={`CSV preview: ${count} transactions, ${dateRange.start} to ${dateRange.end}, expenses £${totalExpenses}, income £${totalIncome}. Waiting for user to confirm import.`}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "0.5rem" }}>
        <span className="section-title">CSV Import Preview</span>
        <span className="period-label">
          {dateRange.start} to {dateRange.end}
        </span>
      </div>

      <div className="csv-stats">
        <div className="csv-stat">
          <span className="csv-stat-value">{count}</span>
          <span className="csv-stat-label">transactions</span>
        </div>
        <div className="csv-stat">
          <span className="csv-stat-value csv-expense">£{totalExpenses.toLocaleString()}</span>
          <span className="csv-stat-label">expenses</span>
        </div>
        <div className="csv-stat">
          <span className="csv-stat-value csv-income">£{totalIncome.toLocaleString()}</span>
          <span className="csv-stat-label">income</span>
        </div>
        {skippedDuplicates > 0 && (
          <div className="csv-stat">
            <span className="csv-stat-value">{skippedDuplicates}</span>
            <span className="csv-stat-label">dupes skipped</span>
          </div>
        )}
      </div>

      <div className="txn-table-wrap" style={{ maxHeight: 300 }}>
        <table className="txn-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th className="txn-amount-col">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((txn, i) => (
              <tr key={i}>
                <td className="txn-date">{txn.date}</td>
                <td className="txn-desc">{txn.description}</td>
                <td className={`txn-amount ${txn.amount < 0 ? "positive" : ""}`}>
                  {txn.amount < 0 ? "-" : ""}£{Math.abs(txn.amount).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="csv-confirm-hint">
        Tell Claude to confirm the import to proceed
      </div>
    </div>
  );
}

export default CsvUpload;

mountWidget(<CsvUpload />);
