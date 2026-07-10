import type {
  ClientCompatibility,
  ServiceInfo,
} from "../../../../packages/shared-types/src/serviceInfo";
import { JsonBlock } from "./JsonBlock";
import type { JsonValue } from "../lib/types";

export type ServiceConnectionStatus =
  | "idle"
  | "checking"
  | "connected"
  | "degraded"
  | "incompatible"
  | "unreachable";

export interface ServiceConnectionState {
  status: ServiceConnectionStatus;
  serviceInfo: ServiceInfo | null;
  compatibility: ClientCompatibility | null;
  lastCheckedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

interface ServiceConnectionPanelProps {
  endpoint: string;
  state: ServiceConnectionState;
  onCheck: () => void;
}

export function ServiceConnectionPanel({ endpoint, state, onCheck }: ServiceConnectionPanelProps) {
  const info = state.serviceInfo;
  const compatibility = state.compatibility;
  const buttonLabel = state.status === "checking"
    ? "Checking MCAgent Connection"
    : state.lastCheckedAt
      ? "Retry Connection"
      : "Check MCAgent Connection";

  return (
    <section className="panel wide service-panel" aria-labelledby="service-connection-heading">
      <div className="panel-heading">
        <div>
          <h2 id="service-connection-heading">MCAgent Connection</h2>
          <p className="muted-line">One lightweight GET /v1/meta check. No local environment data is read or uploaded.</p>
        </div>
        <span className={`connection-status ${state.status}`}>{state.status}</span>
      </div>

      <div className="summary-grid">
        <Metric label="Configured endpoint" value={endpoint} />
        <Metric label="Server" value={info ? `${info.service.name} ${info.service.version}` : "not checked"} />
        <Metric label="API / schema" value={info ? `${info.api.version} / ${info.schemaVersion}` : "not checked"} />
        <Metric label="Planning mode" value={info ? info.mode.planning : "not checked"} />
        <Metric label="Network default" value={info ? String(info.mode.networkEnabledByDefault) : "not checked"} />
        <Metric label="Compatibility" value={compatibility?.status ?? "not checked"} />
        <Metric label="Planner only" value={info ? String(info.safety.plannerOnly) : "not checked"} />
        <Metric label="Last checked" value={state.lastCheckedAt ?? "not checked"} />
      </div>

      <button type="button" onClick={onCheck} disabled={state.status === "checking"}>
        {buttonLabel}
      </button>

      {state.status === "unreachable" ? (
        <p className="connection-blocker">
          The configured MCAgent endpoint is unavailable. Check that the server is running, then retry. Desktop-local environment previews remain available.
        </p>
      ) : null}
      {state.status === "incompatible" ? (
        <p className="connection-blocker">This endpoint is incompatible. Server-dependent planning actions are blocked.</p>
      ) : null}
      {state.status === "degraded" ? (
        <p className="connection-warning">The endpoint is usable with optional capability limitations.</p>
      ) : null}
      {state.errorMessage ? (
        <p className="connection-error"><strong>{state.errorCode ?? "CONNECTION_ERROR"}</strong>: {state.errorMessage}</p>
      ) : null}

      {info ? (
        <div className="capability-grid">
          <CapabilityList
            title="Required planning capabilities"
            items={compatibility?.requiredCapabilities.map((name) => `${name}=${info.capabilities[name]}`) ?? []}
          />
          <CapabilityList
            title="Optional capabilities"
            items={[
              `liveResourceResolver=${info.capabilities.liveResourceResolver}`,
              `networkEnabledByDefault=${info.mode.networkEnabledByDefault}`,
            ]}
          />
          <CapabilityList
            title="Safety capabilities"
            items={[
              `installExecution=${info.capabilities.installExecution}`,
              `localFileAccess=${info.capabilities.localFileAccess}`,
              `environmentProbe=${info.capabilities.environmentProbe}`,
              `minecraftLaunch=${info.capabilities.minecraftLaunch}`,
              `canDownload=${info.safety.canDownload}`,
              `canWriteLocalFiles=${info.safety.canWriteLocalFiles}`,
              `canLaunchProcesses=${info.safety.canLaunchProcesses}`,
            ]}
          />
        </div>
      ) : null}

      {compatibility?.issues.length ? (
        <div className="message-list">
          <h3>Compatibility notes</h3>
          <ul>
            {compatibility.issues.map((issue) => (
              <li key={`${issue.code}-${issue.capability ?? "general"}`}>{issue.code}: {issue.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {info ? <JsonBlock value={info as unknown as JsonValue} emptyLabel="No service metadata." /> : null}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-card">
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CapabilityList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="capability-list">
      <h3>{title}</h3>
      {items.length ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p>None requested.</p>}
    </div>
  );
}
