import "@/index.css";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { mountWidget, useDisplayMode } from "skybridge/web";
import { useToolInfo } from "../helpers.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
);

function FinancialTrends() {
  const { output, isPending } = useToolInfo<"financial-trends">();
  const [displayMode, setDisplayMode] = useDisplayMode();
  const isFullscreen = displayMode === "fullscreen";

  if (isPending || !output) {
    return (
      <div className="container">
        <div className="loading">
          <div className="loading-spinner" />
          Crunching your trends…
        </div>
      </div>
    );
  }

  const { periods } = output;
  const labels = periods.map((p) => p.date);

  const data = {
    labels,
    datasets: [
      {
        label: "Income",
        data: periods.map((p) => p.income),
        borderColor: "#22c55e",
        backgroundColor: "rgba(34, 197, 94, 0.1)",
        fill: false,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: "Expenses",
        data: periods.map((p) => p.expenses),
        borderColor: "#ef4444",
        backgroundColor: "rgba(239, 68, 68, 0.1)",
        fill: false,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: "Net Savings",
        data: periods.map((p) => p.net),
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
        borderDash: [5, 3],
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index" as const,
      intersect: false,
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 } },
      },
      y: {
        grid: { color: "rgba(0,0,0,0.06)" },
        ticks: {
          callback: (value: string | number) => `£${Number(value).toLocaleString()}`,
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
          label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) =>
            `${ctx.dataset.label}: £${(ctx.parsed.y ?? 0).toLocaleString()}`,
        },
      },
    },
  };

  const latestPeriod = periods[periods.length - 1];

  return (
    <div
      className={`container ${isFullscreen ? "fullscreen" : ""}`}
      data-llm={`Financial trends: ${periods.map((p) => `${p.date}: income £${p.income.toLocaleString()}, expenses £${p.expenses.toLocaleString()}, net £${p.net.toLocaleString()}`).join("; ")}`}
    >
      <div className="widget-header">
        <span className="section-title">Financial Trends</span>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
          {latestPeriod && (
            <span className="period-label">
              Latest: £{latestPeriod.net.toLocaleString()} net
            </span>
          )}
          <button
            className="expand-btn"
            onClick={() => setDisplayMode(isFullscreen ? "inline" : "fullscreen")}
          >
            {isFullscreen ? "Close" : "Expand"}
          </button>
        </div>
      </div>
      <div className="chart-container" style={{ minHeight: isFullscreen ? 400 : 200 }}>
        <Line data={data} options={options} />
      </div>

      {isFullscreen && (
        <table className="detail-table">
          <thead>
            <tr>
              <th>Period</th>
              <th className="num">Income</th>
              <th className="num">Expenses</th>
              <th className="num">Net</th>
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p.date}>
                <td>{p.date}</td>
                <td className="num" style={{ color: "var(--color-income)" }}>£{p.income.toLocaleString()}</td>
                <td className="num" style={{ color: "var(--color-expenses)" }}>£{p.expenses.toLocaleString()}</td>
                <td className="num" style={{ fontWeight: 600, color: p.net >= 0 ? "var(--color-income)" : "var(--color-expenses)" }}>
                  {p.net >= 0 ? "" : "-"}£{Math.abs(p.net).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default FinancialTrends;

mountWidget(<FinancialTrends />);
