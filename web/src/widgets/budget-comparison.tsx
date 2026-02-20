import "@/index.css";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { mountWidget, useDisplayMode } from "skybridge/web";
import { useToolInfo } from "../helpers.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

function BudgetComparison() {
  const { output, isPending } = useToolInfo<"budget-comparison">();
  const [displayMode, setDisplayMode] = useDisplayMode();
  const isFullscreen = displayMode === "fullscreen";

  if (isPending || !output) {
    return (
      <div className="container">
        <div className="loading">
          <div className="loading-spinner" />
          Comparing against your budget…
        </div>
      </div>
    );
  }

  const { categories, period } = output;

  // Aggregate totals across all periods per category
  const labels = categories.map((c) => c.name);
  const actuals = categories.map((c) => c.totalActual);
  const budgets = categories.map((c) => c.totalBudget);

  const data = {
    labels,
    datasets: [
      {
        label: "Actual",
        data: actuals,
        backgroundColor: categories.map((c) =>
          c.totalPercentage > 100 ? "#ef4444" : "#22c55e",
        ),
        borderRadius: 3,
      },
      {
        label: "Budget",
        data: budgets,
        backgroundColor: "#94a3b8",
        borderRadius: 3,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 } },
      },
      y: {
        grid: { color: "rgba(0,0,0,0.06)" },
        ticks: {
          callback: (value: string | number) =>
            `£${Number(value).toLocaleString()}`,
          font: { size: 11 },
        },
      },
    },
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          boxWidth: 12,
          padding: 10,
          font: { size: 11 },
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label?: string }; raw: unknown }) =>
            `${ctx.dataset.label}: £${Number(ctx.raw).toLocaleString()}`,
        },
      },
    },
  };

  const overBudget = categories.filter((c) => c.totalPercentage > 100);
  const withinBudget = categories.filter(
    (c) => c.totalPercentage <= 100 && c.totalPercentage > 0,
  );

  return (
    <div
      className={`container ${isFullscreen ? "fullscreen" : ""}`}
      data-llm={`Budget comparison for ${period}: ${categories.map((c) => `${c.name}: £${c.totalActual.toLocaleString()} actual vs £${c.totalBudget.toLocaleString()} budget (${c.totalPercentage}%)`).join(", ")}`}
    >
      <div className="widget-header">
        <span className="section-title">Budget vs Actual</span>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
          <span className="period-label">{period}</span>
          <button
            className="expand-btn"
            onClick={() => setDisplayMode(isFullscreen ? "inline" : "fullscreen")}
          >
            {isFullscreen ? "Close" : "Expand"}
          </button>
        </div>
      </div>

      <div className="chart-container" style={{ minHeight: isFullscreen ? 400 : 200 }}>
        <Bar data={data} options={options} />
      </div>

      {!isFullscreen && (
        <>
          {overBudget.length > 0 && (
            <div>
              <span className="section-title" style={{ color: "var(--color-expenses)" }}>
                Over Budget
              </span>
              <ul className="expenses-list">
                {overBudget.map((c) => (
                  <li key={c.name} className="expense-item">
                    <span className="expense-name">{c.name}</span>
                    <span className="expense-amount">
                      {c.totalPercentage}% — £{(c.totalActual - c.totalBudget).toLocaleString()} over
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {withinBudget.length > 0 && (
            <div>
              <span className="section-title" style={{ color: "var(--color-income)" }}>
                Within Budget
              </span>
              <ul className="expenses-list">
                {withinBudget.map((c) => (
                  <li key={c.name} className="expense-item">
                    <span className="expense-name">{c.name}</span>
                    <span className="expense-amount">
                      {c.totalPercentage}% — £{(c.totalBudget - c.totalActual).toLocaleString()} remaining
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {isFullscreen && (
        <table className="detail-table">
          <thead>
            <tr>
              <th>Category</th>
              <th className="num">Actual</th>
              <th className="num">Budget</th>
              <th className="num">%</th>
              <th className="num">Over/Under</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => {
              const diff = c.totalActual - c.totalBudget;
              const over = diff > 0;
              return (
                <tr key={c.name}>
                  <td style={{ textTransform: "capitalize" }}>{c.name}</td>
                  <td className="num">£{c.totalActual.toLocaleString()}</td>
                  <td className="num">£{c.totalBudget.toLocaleString()}</td>
                  <td className="num" style={{ color: c.totalPercentage > 100 ? "var(--color-expenses)" : "var(--color-income)" }}>
                    {c.totalPercentage}%
                  </td>
                  <td className="num" style={{ fontWeight: 600, color: over ? "var(--color-expenses)" : "var(--color-income)" }}>
                    {over ? `+£${diff.toLocaleString()} over` : `£${Math.abs(diff).toLocaleString()} under`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default BudgetComparison;

mountWidget(<BudgetComparison />);
