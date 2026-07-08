"use client";

import { useMemo, useState } from "react";
import type { ResourcePlan } from "../../../../packages/shared-types/src/plan";
import { previewInstallActions, type ExecutorPreviewResult } from "../../../../packages/shared-types/src/executor";
import {
  buildInstallActionsFromPlan,
  type InstallActionPreview,
} from "../../../../packages/shared-types/src/installActions";
import {
  explainPlan,
  generatePlan,
  mcagentBaseUrl,
  parseIntent,
  type JsonValue,
  type PlanOptions,
} from "@/lib/mcagentClient";

const defaultPrompt = "\u6211\u60f3\u73a9 1.20.1\uff0c\u4f4e\u914d\u5149\u5f71\u751f\u5b58\uff0c\u8981\u4f18\u5316\u3001\u5c0f\u5730\u56fe\u3001\u82f9\u679c\u76ae\uff0c\u522b\u592a\u590d\u6742\u3002";

export function ApiPlayground() {
  const [text, setText] = useState(defaultPrompt);
  const [intent, setIntent] = useState<JsonValue | null>(null);
  const [planResponse, setPlanResponse] = useState<JsonValue | null>(null);
  const [explanation, setExplanation] = useState<JsonValue | null>(null);
  const [installPreview, setInstallPreview] = useState<InstallActionPreview | null>(null);
  const [executorPreview, setExecutorPreview] = useState<ExecutorPreviewResult | null>(null);
  const [mode, setMode] = useState<PlanOptions["mode"]>("pipeline");
  const [enableNetwork, setEnableNetwork] = useState(false);
  const [pending, setPending] = useState<"intent" | "plan" | "explain" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const diagnostics = getDiagnostics(planResponse);
  const planSummary = getPlanSummary(planResponse);
  const canGeneratePlan = intent !== null;
  const canExplain = planResponse !== null;
  const canPreviewInstall = extractPlan(planResponse) !== null;
  const apiUrl = useMemo(() => mcagentBaseUrl(), []);

  async function runParseIntent() {
    await run("intent", async () => {
      const nextIntent = await parseIntent(text);
      setIntent(nextIntent);
      setPlanResponse(null);
      setExplanation(null);
      setInstallPreview(null);
      setExecutorPreview(null);
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
      setInstallPreview(null);
      setExecutorPreview(null);
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

  function runGenerateInstallPreview() {
    const plan = extractPlan(planResponse);
    if (!plan) {
      setError("Generate Plan must complete before Generate Install Preview.");
      return;
    }

    const nextInstallPreview = buildInstallActionsFromPlan(plan, {
      dryRun: true,
      requireConfirmation: true,
      targetInstanceName: "MCagentlauncher Dry Run Preview",
      includeLaunchPreview: true,
    });
    setInstallPreview(nextInstallPreview);
    setExecutorPreview(previewInstallActions(nextInstallPreview.actions));
    setError(null);
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
            <h1 className="title">MCagentlauncher v0.1 - Natural Instance API Playground</h1>
            <p className="subtitle">Connected to {apiUrl}</p>
          </div>
          <div className="chain" aria-label="Current API flow">
            <span>Natural Language</span>
            <span>Intent</span>
            <span>Resource Plan</span>
            <span>Explanation</span>
          </div>
        </header>

        <section className="safety-banner">
          Web Playground only calls MCAgent planning APIs. It cannot access local files, probe the local environment, install Minecraft, or launch Minecraft.
          Release notes: docs/releases/v0.1-alpha-preview.md. Demo guide: docs/demo/v0.1-alpha-demo-flow.md.
        </section>

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
            <p className="muted">Default is offline planning. Network use must be enabled explicitly and still does not download resources.</p>
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
              <button disabled={pending !== null || !canPreviewInstall} onClick={runGenerateInstallPreview}>
                Generate Install Preview
              </button>
            </div>
            <div className="unsupported-list">
              <strong>Web does not support</strong>
              <span>Install execution</span>
              <span>Environment probe</span>
              <span>Local file access</span>
              <span>Minecraft launch</span>
            </div>
            <p className={error ? "status error" : "status"}>
              {error ?? (pending ? "Request in progress." : "Ready.")}
            </p>
          </section>

          <section className="results">
            <JsonPanel title="Intent JSON" value={intent} />

            <section className="panel">
              <h2>Plan Summary</h2>
              {planSummary ? (
                <div className="metrics two">
                  <Metric label="resources" value={planSummary.resources} />
                  <Metric label="required" value={planSummary.required} />
                  <Metric label="warnings" value={planSummary.warnings} />
                  <Metric label="networkUsed" value={String(diagnostics?.networkUsed ?? false)} />
                </div>
              ) : (
                <p className="muted">Generate a plan to view summary.</p>
              )}
            </section>

            <JsonPanel title="Plan Response JSON" value={planResponse} wide />

            <section className="panel wide">
              <h2>Diagnostics</h2>
              {diagnostics ? (
                <>
                  {diagnostics.networkUsed === false ? (
                    <p className="offline">Offline planning mode. The resource plan has not queried fresh Modrinth metadata.</p>
                  ) : null}
                  <div className="metrics">
                    <Metric label="networkUsed" value={String(diagnostics.networkUsed)} />
                    <Metric label="aliasMatches" value={String(diagnostics.aliasMatches)} />
                    <Metric label="resolverQueries" value={String(diagnostics.resolverQueries)} />
                    <Metric label="candidatesResolved" value={String(diagnostics.candidatesResolved)} />
                  </div>
                  {diagnostics.candidatesResolved === 0 ? (
                    <p className="offline">Current plan may come from the mock/offline pipeline. A future resolver stage will verify live metadata.</p>
                  ) : null}
                  <MessageList title="Warnings" messages={diagnostics.warnings} />
                  <MessageList title="Errors" messages={diagnostics.errors} />
                </>
              ) : (
                <p className="muted">No diagnostics yet.</p>
              )}
            </section>

            <JsonPanel title="Explanation" value={explanation} wide />

            <section className="panel wide">
              <h2>Install Preview</h2>
              {installPreview && executorPreview ? (
                <>
                  <p className="offline">
                    dryRun=true, requiresUserConfirmation=true, canExecute=false. No download, no install, no local write, no launch.
                  </p>
                  <div className="metrics">
                    <Metric label="actions" value={String(installPreview.actions.length)} />
                    <Metric label="blocked" value={String(executorPreview.blockedActions.length)} />
                    <Metric label="canExecute" value={String(executorPreview.canExecute)} />
                    <Metric label="dryRun" value={String(executorPreview.dryRun)} />
                  </div>
                  <p className="muted">{executorPreview.summary}</p>
                  <InlineJson title="Install Actions JSON" value={installPreview as unknown as JsonValue} />
                  <InlineJson title="Executor Preview JSON" value={executorPreview as unknown as JsonValue} />
                </>
              ) : (
                <p className="muted">Generate a resource plan first, then create a dry-run install preview.</p>
              )}
            </section>
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

function InlineJson({ title, value }: { title: string; value: JsonValue }) {
  return (
    <details className="inline-json">
      <summary>{title}</summary>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </details>
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

function getPlanSummary(value: JsonValue | null) {
  const plan = extractPlan(value);
  if (!plan) {
    return null;
  }
  const resources = Array.isArray(plan.resources) ? plan.resources.filter(isRecord) : [];
  const ruleResults = isRecord(plan.ruleResults) ? plan.ruleResults : null;
  return {
    resources: String(resources.length),
    required: String(resources.filter((resource) => resource.required === true).length),
    warnings: String(Array.isArray(ruleResults?.warnings) ? ruleResults.warnings.length : 0),
  };
}

function extractPlan(value: JsonValue | null): ResourcePlan | null {
  if (!isRecord(value)) {
    return null;
  }
  if (isRecord(value.plan)) {
    return value.plan as unknown as ResourcePlan;
  }
  if (typeof value.schemaVersion === "string" && Array.isArray(value.resources)) {
    return value as unknown as ResourcePlan;
  }
  return null;
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
