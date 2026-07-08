import { JsonBlock } from "./JsonBlock";
import type { JsonValue } from "../lib/types";

interface EnvironmentPanelProps {
  report: JsonValue | null;
  summary: string | null;
  readinessLevel: string | null;
  warnings: Array<{ code: string; message: string }>;
  blockers: Array<{ code: string; message: string }>;
  onGeneratePreview: () => void;
  onRunReadOnlyProbe: () => void;
}

export function EnvironmentPanel({
  report,
  summary,
  readinessLevel,
  warnings,
  blockers,
  onGeneratePreview,
  onRunReadOnlyProbe,
}: EnvironmentPanelProps) {
  const environment = summarizeEnvironment(report);

  return (
    <section className="panel wide environment-panel" aria-labelledby="environment-heading">
      <div className="panel-heading">
        <h2 id="environment-heading">Environment Preview</h2>
        <span className="status-pill safe">localOnly=true</span>
        <span className="status-pill blocked">uploadAllowed=false</span>
      </div>
      <div className="button-row">
        <button type="button" onClick={onGeneratePreview}>
          Generate Environment Preview
        </button>
        <button type="button" className="secondary" onClick={onRunReadOnlyProbe}>
          Run Read-only Probe
        </button>
      </div>
      <p className="notice-line">
        Mock/read-only preview only. Run Read-only Probe requires explicit consent first. M8.3 may read only OS, architecture, app version, and Tauri runtime availability.
      </p>
      <p className="notice-line">
        Current probe policy: M8.3 Safe Platform Probe. Java, paths, disk, network, upload, persistence, file write, download, install, and process launch remain disabled by policy.
      </p>
      {summary ? <p className="summary-line">{summary}</p> : null}
      {environment ? (
        <div className="summary-grid">
          <Metric label="Probe mode" value={environment.mode} />
          <Metric label="Consent" value={environment.consentGranted} />
          <Metric label="Platform" value={environment.platform} />
          <Metric label="Arch" value={environment.arch} />
          <Metric label="App version" value={environment.appVersion} />
          <Metric label="Tauri" value={environment.tauriAvailable} />
          <Metric label="Java" value="Not checked by M8.3 policy" />
          <Metric label="Minecraft path" value="Not checked by M8.3 policy" />
          <Metric label="Disk" value="Not checked by M8.3 policy" />
          <Metric label="Network" value="Not checked by M8.3 policy" />
          <Metric label="Local only" value={environment.localOnly} />
          <Metric label="Upload allowed" value={environment.uploadAllowed} />
          <Metric label="Files written" value={environment.filesWritten} />
          <Metric label="Network requests" value={environment.networkRequests} />
        </div>
      ) : null}
      {readinessLevel ? (
        <div className="readiness-line">
          <span className="metric-label">readiness</span>
          <strong>{readinessLevel}</strong>
        </div>
      ) : null}
      {warnings.length > 0 ? (
        <div className="message-list">
          <h3>Warnings</h3>
          <ul>
            {warnings.map((warning) => (
              <li key={warning.code}>
                <strong>{warning.code}</strong>: {warning.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {blockers.length > 0 ? (
        <div className="message-list error-list">
          <h3>Blockers</h3>
          <ul>
            {blockers.map((blocker) => (
              <li key={blocker.code}>
                <strong>{blocker.code}</strong>: {blocker.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <JsonBlock value={report} emptyLabel="Generate environment preview to inspect the mock local environment report." />
    </section>
  );
}

function summarizeEnvironment(value: JsonValue | null) {
  if (!isRecord(value)) {
    return null;
  }
  const source = isRecord(value.source) ? value.source : {};
  const platform = isRecord(value.platform) ? value.platform : {};
  const runtime = isRecord(value.runtime) ? value.runtime : {};
  const probe = isRecord(value.probe) ? value.probe : {};
  const privacy = isRecord(value.privacy) ? value.privacy : {};

  return {
    mode: readString(source.mode) ?? "unknown",
    consentGranted: String(source.consentGranted === true),
    platform: readString(platform.os) ?? "unknown",
    arch: readString(platform.arch) ?? "unknown",
    appVersion: readString(runtime.appVersion) ?? "unknown",
    tauriAvailable: String(runtime.tauriAvailable === true),
    localOnly: String(privacy.localOnly === true),
    uploadAllowed: String(privacy.uploadAllowed === true),
    filesWritten: String(typeof probe.filesWritten === "number" ? probe.filesWritten : 0),
    networkRequests: String(typeof probe.networkRequests === "number" ? probe.networkRequests : 0),
  };
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-card">
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function readString(value: JsonValue | undefined): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isRecord(value: JsonValue | undefined | null): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
