import "@/index.css";

import { mountWidget } from "skybridge/web";
import { useToolInfo } from "../helpers.js";

function AnomalyDetection() {
  const { output, isPending } = useToolInfo<"anomaly-detection">();

  if (isPending || !output) {
    return (
      <div className="container">
        <div className="loading">
          <div className="loading-spinner" />
          Scanning for anomalies…
        </div>
      </div>
    );
  }

  const { anomalies } = output;

  if (anomalies.length === 0) {
    return (
      <div className="container">
        <span className="section-title">Anomaly Detection</span>
        <div className="anomaly-empty">
          No unusual spending patterns detected. Everything looks normal.
        </div>
      </div>
    );
  }

  const highCount = anomalies.filter((a) => a.severity === "high").length;
  const medCount = anomalies.filter((a) => a.severity === "medium").length;

  return (
    <div
      className="container"
      data-llm={`Anomaly detection: ${anomalies.length} anomalies found (${highCount} high, ${medCount} medium). ${anomalies.slice(0, 3).map((a) => `${a.category} ${a.month}: £${a.amount} vs avg £${a.average}`).join("; ")}`}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "0.5rem" }}>
        <span className="section-title">Anomaly Detection</span>
        <span className="period-label">
          {anomalies.length} anomalies · {highCount} high · {medCount} medium
        </span>
      </div>
      <div className="anomaly-list">
        {anomalies.map((a, i) => (
          <div key={i} className={`anomaly-card anomaly-${a.severity}`}>
            <div className="anomaly-header">
              <span className={`anomaly-badge anomaly-badge-${a.severity}`}>
                {a.severity === "high" ? "!!" : "!"} {a.severity}
              </span>
              <span className="anomaly-category">{a.category}</span>
              <span className="anomaly-month">{a.month}</span>
            </div>
            <div className="anomaly-body">
              <span className="anomaly-amount">
                £{a.amount.toLocaleString()}
              </span>
              <span className="anomaly-comparison">
                {a.direction === "above" ? "▲" : "▼"}{" "}
                {Math.abs(Math.round(((a.amount - a.average) / a.average) * 100))}%{" "}
                {a.direction} avg of £{a.average.toLocaleString()}
              </span>
            </div>
            <div className="anomaly-bar-track">
              <div
                className={`anomaly-bar-fill anomaly-bar-${a.direction}`}
                style={{ width: `${Math.min(Math.abs(a.amount / a.average) * 50, 100)}%` }}
              />
              <div
                className="anomaly-bar-avg"
                style={{ left: "50%" }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AnomalyDetection;

mountWidget(<AnomalyDetection />);
