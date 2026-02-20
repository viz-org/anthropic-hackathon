import "@/index.css";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { mountWidget, useDisplayMode } from "skybridge/web";
import { useToolInfo } from "../helpers.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

function NetWorthTimeline() {
  const { output, isPending } = useToolInfo<"net-worth-timeline">();
  const [displayMode, setDisplayMode] = useDisplayMode();
  const isFullscreen = displayMode === "fullscreen";

  if (isPending || !output) {
    return (
      <div className="container">
        <div className="loading">
          <div className="loading-spinner" />
          Calculating net worth…
        </div>
      </div>
    );
  }

  const { points } = output;
  const latest = points[points.length - 1];
  const first = points[0];
  const change = latest && first ? latest.netWorth - first.netWorth : 0;

  const data = {
    labels: points.map((p) => p.date),
    datasets: [
      {
        label: "Net Worth",
        data: points.map((p) => p.netWorth),
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: "#3b82f6",
        borderWidth: 2,
      },
      {
        label: "Assets",
        data: points.map((p) => p.assets),
        borderColor: "#22c55e",
        backgroundColor: "transparent",
        borderDash: [5, 5],
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: "#22c55e",
        borderWidth: 1.5,
      },
      {
        label: "Liabilities",
        data: points.map((p) => p.liabilities),
        borderColor: "#ef4444",
        backgroundColor: "transparent",
        borderDash: [5, 5],
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: "#ef4444",
        borderWidth: 1.5,
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
          callback: (value: string | number) => `£${Number(value).toLocaleString()}`,
          font: { size: 11 },
        },
      },
    },
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: { boxWidth: 12, padding: 10, font: { size: 11 } },
      },
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label?: string }; raw: unknown }) =>
            `${ctx.dataset.label}: £${Number(ctx.raw).toLocaleString()}`,
        },
      },
    },
  };

  return (
    <div
      className={`container ${isFullscreen ? "fullscreen" : ""}`}
      data-llm={`Net worth timeline: ${points.length} months. Latest: £${latest?.netWorth.toLocaleString() ?? "N/A"}. Change: £${change.toLocaleString()}.`}
    >
      <div className="widget-header">
        <span className="section-title">Net Worth Over Time</span>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
          <span className="period-label">
            £{latest?.netWorth.toLocaleString() ?? "—"}{" "}
            <span style={{ color: change >= 0 ? "var(--color-income)" : "var(--color-expenses)" }}>
              ({change >= 0 ? "+" : ""}£{change.toLocaleString()})
            </span>
          </span>
          <button
            className="expand-btn"
            onClick={() => setDisplayMode(isFullscreen ? "inline" : "fullscreen")}
          >
            {isFullscreen ? "Close" : "Expand"}
          </button>
        </div>
      </div>
      <div className="chart-container" style={{ minHeight: isFullscreen ? 400 : 250 }}>
        <Line data={data} options={options} />
      </div>

      {isFullscreen && (
        <table className="detail-table">
          <thead>
            <tr>
              <th>Date</th>
              <th className="num">Net Worth</th>
              <th className="num">Assets</th>
              <th className="num">Liabilities</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.date}>
                <td>{p.date}</td>
                <td className="num" style={{ fontWeight: 600 }}>£{p.netWorth.toLocaleString()}</td>
                <td className="num" style={{ color: "var(--color-income)" }}>£{p.assets.toLocaleString()}</td>
                <td className="num" style={{ color: "var(--color-expenses)" }}>£{p.liabilities.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default NetWorthTimeline;

mountWidget(<NetWorthTimeline />);
