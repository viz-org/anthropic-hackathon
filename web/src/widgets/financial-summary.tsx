import "@/index.css";

import { mountWidget, useDisplayMode } from "skybridge/web";
import { useToolInfo } from "../helpers.js";

function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  const formatted =
    abs >= 1000
      ? `£${abs.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
      : `£${abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return value < 0 ? `-${formatted}` : formatted;
}

interface MetricProps {
  label: string;
  value: string;
  colorClass?: string;
}

function MetricCard({ label, value, colorClass }: MetricProps) {
  return (
    <div className="metric-card">
      <span className="metric-label">{label}</span>
      <span className={`metric-value ${colorClass ?? ""}`}>{value}</span>
    </div>
  );
}

function FinancialSummary() {
  const { output, isPending } = useToolInfo<"financial-summary">();
  const [displayMode, setDisplayMode] = useDisplayMode();
  const isFullscreen = displayMode === "fullscreen";

  if (isPending || !output) {
    return (
      <div className="container">
        <div className="loading">
          <div className="loading-spinner" />
          Pulling together your finances…
        </div>
      </div>
    );
  }

  const {
    netWorth,
    totalIncome,
    totalExpenses,
    savingsRate,
    cashflow,
    topExpenses,
  } = output;

  const expensesToShow = isFullscreen ? topExpenses : topExpenses.slice(0, 5);

  return (
    <div
      className={`container ${isFullscreen ? "fullscreen" : ""}`}
      data-llm={`Financial summary: net worth ${formatCurrency(netWorth)}, income ${formatCurrency(totalIncome)}, expenses ${formatCurrency(totalExpenses)}, savings rate ${savingsRate}%, cashflow ${formatCurrency(cashflow)}. Top expenses: ${topExpenses.map((e) => `${e.name} ${formatCurrency(e.amount)}`).join(", ")}`}
    >
      <div className="widget-header">
        <span className="section-title">Financial Overview</span>
        <button
          className="expand-btn"
          onClick={() => setDisplayMode(isFullscreen ? "inline" : "fullscreen")}
        >
          {isFullscreen ? "Close" : "Expand"}
        </button>
      </div>

      <div className="metrics-grid">
        <MetricCard
          label="Net Worth"
          value={formatCurrency(netWorth)}
          colorClass={netWorth >= 0 ? "positive" : "negative"}
        />
        <MetricCard
          label="Total Income"
          value={formatCurrency(totalIncome)}
          colorClass="positive"
        />
        <MetricCard
          label="Total Expenses"
          value={formatCurrency(totalExpenses)}
          colorClass="negative"
        />
        <MetricCard
          label="Savings Rate"
          value={`${savingsRate}%`}
          colorClass={savingsRate >= 0 ? "positive" : "negative"}
        />
        <MetricCard
          label="Cashflow"
          value={formatCurrency(cashflow)}
          colorClass={cashflow >= 0 ? "positive" : "negative"}
        />
      </div>

      <span className="section-title">
        {isFullscreen ? "All Expenses" : "Top Expenses"}
      </span>
      <ul className="expenses-list">
        {expensesToShow.map((expense) => (
          <li key={expense.name} className="expense-item">
            <span className="expense-name">{expense.name}</span>
            <span className="expense-amount">{formatCurrency(expense.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default FinancialSummary;

mountWidget(<FinancialSummary />);
