import "@/index.css";

import { mountWidget, useDisplayMode } from "skybridge/web";
import { useToolInfo } from "../helpers.js";

function TransactionSearch() {
  const { output, isPending } = useToolInfo<"transaction-search">();
  const [displayMode, setDisplayMode] = useDisplayMode();
  const isFullscreen = displayMode === "fullscreen";

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
      className={`container ${isFullscreen ? "fullscreen" : ""}`}
      data-llm={`Transaction search: ${count} total results${query ? ` for "${query}"` : ""}. Showing ${transactions.length} most recent.`}
    >
      <div className="widget-header">
        <span className="section-title">Transactions</span>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
          <span className="period-label">
            {count} found{query ? ` · ${query}` : ""} · showing {transactions.length}
          </span>
          <button
            className="expand-btn"
            onClick={() => setDisplayMode(isFullscreen ? "inline" : "fullscreen")}
          >
            {isFullscreen ? "Close" : "Expand"}
          </button>
        </div>
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
                <td className={isFullscreen ? "" : "txn-desc"}>{txn.description}</td>
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
