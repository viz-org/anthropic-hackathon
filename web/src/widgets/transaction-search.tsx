import "@/index.css";

import { mountWidget } from "skybridge/web";
import { useToolInfo } from "../helpers.js";

function TransactionSearch() {
  const { output, isPending } = useToolInfo<"transaction-search">();

  if (isPending || !output) {
    return (
      <div className="container">
        <div className="loading">
          <div className="loading-spinner" />
          Searching transactions…
        </div>
      </div>
    );
  }

  const { transactions, count, query } = output;

  return (
    <div
      className="container"
      data-llm={`Transaction search: ${count} total results${query ? ` for "${query}"` : ""}. Showing ${transactions.length} most recent.`}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "0.5rem" }}>
        <span className="section-title">Transactions</span>
        <span className="period-label">
          {count} found{query ? ` · ${query}` : ""} · showing {transactions.length}
        </span>
      </div>
      <div className="txn-table-wrap">
        <table className="txn-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Account</th>
              <th className="txn-amount-col">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((txn, i) => (
              <tr key={i}>
                <td className="txn-date">{txn.date}</td>
                <td className="txn-desc">{txn.description}</td>
                <td className="txn-account">{txn.account}</td>
                <td className={`txn-amount ${txn.amount < 0 ? "positive" : ""}`}>
                  {txn.amount < 0 ? "-" : ""}£{Math.abs(txn.amount).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TransactionSearch;

mountWidget(<TransactionSearch />);
