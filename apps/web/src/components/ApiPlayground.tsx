"use client";

import { useMemo, useState } from "react";
import {
  explainPlan,
  generatePlan,
  mcagentBaseUrl,
  parseIntent,
  type JsonValue,
  type PlanOptions,
} from "@/lib/mcagentClient";

const defaultPrompt = "我想玩 1.20.1，低配光影生存，要优化、小地图、苹果皮，别太复杂。";

export function ApiPlayground() {
  const [text, setText] = useState(defaultPrompt);
  const [intent, setIntent] = useState<JsonValue | null>(null);
  const [planResponse, setPlanResponse] = useState<JsonValue | null>(null);
  const [explanation, setExplanation] = useState<JsonValue | null>(null);
  const [mode, setMode] = useState<PlanOptions["mode"]>("pipeline");
  const [enableNetwork, setEnableNetwork] = useState(false);
  const [pending, setPending] = useState<"intent" | "plan" | "explain" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const diagnostics = getDiagnostics(planResponse);
  const canGeneratePlan = intent !== null;
  const canExplain = planResponse !== null;
  const apiUrl = useMemo(() => mcagentBaseUrl(), []);

  async function runParseIntent() {
    await run("intent", async () => {
      const nextIntent = await parseIntent(text);
      setIntent(nextIntent);
      setPlanResponse(null);
      setExplanation(null);
    });
  }

  async function runGeneratePlan() {
    if (!intent) {
      setError("Parse Intent must complete before Generate Plan.");
      return;
    }
    await run("plan", async () => {
      const nextPlan = await generatePlan(intent, {
        mode,
        enableNetwork,
      });
      setPlanResponse(nextPlan);
      setExplanation(null);
    });
  }

  async function runExplainPlan() {
    if (!planResponse) {
      setError("Generate Plan must complete before Explain Plan.");
      return;
    }
    await run("explain", async () => {
      setExplanation(await explainPlan(planResponse));
    });
  }

  async function run(kind: "intent" | "plan" | "explain", task: () => Promise<void>) {
    setPending(kind);
    setError(null);
    try {
      await task();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unknown request error.");
    } finally {
      setPending(null);
    }
  }

  return (
    <main className="page">
      <div className="shell">
        <header className="topbar">
          <div>
            <h1 className="title">MCagentlauncher v0.1 - Natural Instance</h1>
            <p className="subtitle">API Playground connected to {apiUrl}</p>
          </div>
          <div className="chain" aria-label="Current API flow">
            <span>Natural Language</span>
            <span>Intent</span>
            <span>Resource Plan</span>
            <span>Explanation</span>
          </div>
        </header>

        <div className="main-grid">
          <section className="panel controls">
            <h2>Request</h2>
            <label>
              <span className="muted">Natural language</span>
              <textarea value={text} onChange={(event) => setText(event.target.value)} />
            </label>
            <label>
              <span className="muted">Planning mode</span>
              <select value={mode} onChange={(event) => setMode(event.target.value as PlanOptions["mode"])}>
                <option value="pipeline">pipeline</option>
                <option value="mock">mock</option>
              </select>
            </label>
            <label className="pill">
              <input
                type="checkbox"
                checked={enableNetwork}
                onChange={(event) => setEnableNetwork(event.target.checked)}
              />{" "}
              enableNetwork
            </label>
            <div className="buttons">
              <button className="primary" disabled={pending !== null || text.trim().length === 0} onClick={runParseIntent}>
                {pending === "intent" ? "Parsing" : "Parse Intent"}
              </button>
              <button disabled={pending !== null || !canGeneratePlan} onClick={runGeneratePlan}>
                {pending === "plan" ? "Generating" : "Generate Plan"}
              </button>
              <button disabled={pending !== null || !canExplain} onClick={runExplainPlan}>
                {pending === "explain" ? "Explaining" : "Explain Plan"}
              </button>
            </div>
            <p className={error ? "status error" : "status"}>
              {error ?? (pending ? "Request in progress." : "Ready.")}
            </p>
          </section>

          <section className="results">
            <JsonPanel title="Intent JSON" value={intent} />
            <JsonPanel title="Plan Response JSON" value={planResponse} />

            <section className="panel wide">
              <h2>Diagnostics</h2>
              {diagnostics ? (
                <>
                  {diagnostics.networkUsed === false ? (
                    <p className="offline">当前为离线规划模式，没有联网查询真实资源元数据。</p>
                  ) : null}
                  <div className="metrics">
                    <Metric label="networkUsed" value={String(diagnostics.networkUsed)} />
                    <Metric label="aliasMatches" value={String(diagnostics.aliasMatches)} />
                    <Metric label="resolverQueries" value={String(diagnostics.resolverQueries)} />
                    <Metric label="candidatesResolved" value={String(diagnostics.candidatesResolved)} />
                  </div>
                  <MessageList title="Warnings" messages={diagnostics.warnings} />
                  <MessageList title="Errors" messages={diagnostics.errors} />
                </>
              ) : (
                <p className="muted">No diagnostics yet.</p>
              )}
            </section>

            <JsonPanel title="Explanation" value={explanation} wide />
          </section>
        </div>
      </div>
    </main>
  );
}

function JsonPanel({ title, value, wide = false }: { title: string; value: JsonValue | null; wide?: boolean }) {
  return (
    <section className={wide ? "panel wide" : "panel"}>
      <h2>{title}</h2>
      <pre>{value ? JSON.stringify(value, null, 2) : "null"}</pre>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MessageList({ title, messages }: { title: string; messages: string[] }) {
  return (
    <div>
      <h3>{title}</h3>
      {messages.length > 0 ? (
        <ul className="warning-list">
          {messages.map((message, index) => (
            <li key={`${title}-${index}`}>{message}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">None.</p>
      )}
    </div>
  );
}

function getDiagnostics(value: JsonValue | null) {
  if (!isRecord(value) || !isRecord(value.diagnostics)) {
    return null;
  }
  const diagnostics = value.diagnostics;
  return {
    networkUsed: typeof diagnostics.networkUsed === "boolean" ? diagnostics.networkUsed : null,
    aliasMatches: Array.isArray(diagnostics.aliasMatches) ? diagnostics.aliasMatches.length : 0,
    resolverQueries: Array.isArray(diagnostics.resolverQueries) ? diagnostics.resolverQueries.length : 0,
    candidatesResolved: typeof diagnostics.candidatesResolved === "number" ? diagnostics.candidatesResolved : 0,
    warnings: readMessages(diagnostics.warnings),
    errors: readMessages(diagnostics.errors),
  };
}

function readMessages(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => {
    if (isRecord(item) && typeof item.code === "string" && typeof item.message === "string") {
      return `${item.code}: ${item.message}`;
    }
    return JSON.stringify(item);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
