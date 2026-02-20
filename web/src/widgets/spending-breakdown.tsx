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
import { mountWidget } from "skybridge/web";
import { useToolInfo } from "../helpers.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
];

function SpendingBreakdown() {
  const { output, isPending } = useToolInfo<"spending-breakdown">();

  if (isPending || !output) {
    return (
      <div className="container">
        <div className="loading">
          <div className="loading-spinner" />
          Analysing your spending…
        </div>
      </div>
    );
  }

  const { months, categoryTotals, grandTotal, period } = output;

  // Use category totals (sorted by amount) to determine which categories to show
  const topCategories = categoryTotals.slice(0, 8).map((c) => c.name);

  // Month labels for x-axis
  const labels = months.map((m) => m.date);

  // One dataset per category, with values per month
  const datasets = topCategories.map((catName, i) => ({
    label: catName,
    data: months.map((m) => {
      const found = m.categories.find((c) => c.name === catName);
      return found ? found.amount : 0;
    }),
    backgroundColor: COLORS[i % COLORS.length],
    borderRadius: 3,
  }));

  const data = { labels, datasets };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { font: { size: 11 } },
      },
      y: {
        stacked: true,
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
          label: (ctx: { dataset: { label?: string }; raw: unknown }) =>
            `${ctx.dataset.label}: £${Number(ctx.raw).toLocaleString()}`,
        },
      },
    },
  };

  const summaryText = categoryTotals
    .slice(0, 5)
    .map((c) => `${c.name} £${c.amount.toLocaleString()} (${c.percentage}%)`)
    .join(", ");

  return (
    <div
      className="container"
      data-llm={`Monthly spending breakdown for ${period}: grand total £${grandTotal.toLocaleString()} across ${months.length} months. Top categories: ${summaryText}`}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "0.5rem" }}>
        <span className="section-title">Spending Breakdown</span>
        <span className="period-label">{period} — £{grandTotal.toLocaleString()} total</span>
      </div>
      <div className="chart-container" style={{ minHeight: 250 }}>
        <Bar data={data} options={options} />
      </div>
    </div>
  );
}

export default SpendingBreakdown;

mountWidget(<SpendingBreakdown />);
