import "@/index.css";

import { mountWidget, useDisplayMode } from "skybridge/web";
import { useToolInfo } from "../helpers.js";

function AnomalyDetection() {
  const { output, isPending } = useToolInfo<"anomaly-detection">();
  const [displayMode, setDisplayMode] = useDisplayMode();
  const isFullscreen = displayMode === "fullscreen";

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
      className={`container ${isFullscreen ? "fullscreen" : ""}`}
      data-llm={`Anomaly detection: ${anomalies.length} anomalies found (${highCount} high, ${medCount} medium). ${anomalies.slice(0, 3).map((a) => `${a.category} ${a.month}: £${a.amount} vs avg £${a.average}`).join("; ")}`}
    >
      <div className="widget-header">
        <span className="section-title">Anomaly Detection</span>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
          <span className="period-label">
            {anomalies.length} anomalies · {highCount} high · {medCount} medium
          </span>
          <button
            className="expand-btn"
            onClick={() => setDisplayMode(isFullscreen ? "inline" : "fullscreen")}
          >
            {isFullscreen ? "Close" : "Expand"}
          </button>
        </div>
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
            <div className="anomaly-bar-track" style={{ height: isFullscreen ? 8 : 4 }}>
              <div
                className={`anomaly-bar-fill anomaly-bar-${a.direction}`}
                style={{ width: `${Math.min(Math.abs(a.amount / a.average) * 50, 100)}%` }}
              />
              <div
                className="anomaly-bar-avg"
                style={{ left: "50%", height: isFullscreen ? 14 : 8, top: isFullscreen ? -3 : -2 }}
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
