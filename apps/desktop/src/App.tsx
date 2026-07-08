import { useMemo, useState } from "react";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { EnvironmentPanel } from "./components/EnvironmentPanel";
import { ExecutorPreviewPanel } from "./components/ExecutorPreviewPanel";
import { InstallPreviewPanel } from "./components/InstallPreviewPanel";
import { IntentPanel } from "./components/IntentPanel";
import { PlanPanel } from "./components/PlanPanel";
import { ProbeConsentModal } from "./components/ProbeConsentModal";
import { PromptInput } from "./components/PromptInput";
import { SafetyNotice } from "./components/SafetyNotice";
import {
  createMockEnvironmentReport,
  summarizeEnvironmentReport,
  validateSafePlatformProbeSafety,
  type EnvironmentBlocker,
  type EnvironmentReport,
  type EnvironmentWarning,
} from "../../../packages/shared-types/src/environment";
import { buildDesktopInstallPreview } from "./lib/installPreview";
import { explainPlan, generatePlan, mcagentBaseUrl, parseIntent } from "./lib/mcagentClient";
import { runSafePlatformProbe } from "./lib/safePlatformProbe";
import type { JsonValue, PlanDiagnostics } from "./lib/types";

const defaultPrompt = "\u6211\u60f3\u73a9 1.20.1\uff0c\u4f4e\u914d\u5149\u5f71\u751f\u5b58\uff0c\u8981\u4f18\u5316\u3001\u5c0f\u5730\u56fe\u3001\u82f9\u679c\u76ae\uff0c\u522b\u592a\u590d\u6742\u3002";

export default function App() {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [intent, setIntent] = useState<JsonValue | null>(null);
  const [planResponse, setPlanResponse] = useState<JsonValue | null>(null);
  const [explanation, setExplanation] = useState<JsonValue | null>(null);
  const [installPreview, setInstallPreview] = useState<JsonValue | null>(null);
  const [executorPreview, setExecutorPreview] = useState<JsonValue | null>(null);
  const [environmentReport, setEnvironmentReport] = useState<JsonValue | null>(null);
  const [environmentSummary, setEnvironmentSummary] = useState<string | null>(null);
  const [environmentReadiness, setEnvironmentReadiness] = useState<string | null>(null);
  const [environmentWarnings, setEnvironmentWarnings] = useState<EnvironmentWarning[]>([]);
  const [environmentBlockers, setEnvironmentBlockers] = useState<EnvironmentBlocker[]>([]);
  const [showProbeConsent, setShowProbeConsent] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);

  const diagnostics = useMemo(() => extractDiagnostics(planResponse), [planResponse]);
  const workflowSteps = useMemo(() => ([
    { label: "Natural Language", status: prompt.trim().length > 0 ? "ready" : "idle" },
    { label: "Intent", status: intent ? "success" : "idle" },
    { label: "Resource Plan", status: diagnostics?.errors.length ? "blocked" : planResponse ? "success" : "idle" },
    { label: "Install Preview", status: installPreview ? "success" : "idle" },
    { label: "Executor Dry-run", status: executorPreview ? "warning" : "idle" },
    { label: "Environment Probe", status: environmentReport ? "success" : "idle" },
  ]), [diagnostics, environmentReport, executorPreview, installPreview, intent, planResponse, prompt]);

  async function runParseIntent() {
    await withPending("Parsing intent...", async () => {
      const parsed = await parseIntent(prompt);
      setIntent(parsed);
      setPlanResponse(null);
      setExplanation(null);
      setInstallPreview(null);
      setExecutorPreview(null);
    });
  }

  async function runGeneratePlan() {
    const activeIntent = intent ?? (await parseIntent(prompt));
    setIntent(activeIntent);
    await withPending("Generating resource plan...", async () => {
      const response = await generatePlan(activeIntent, { mode: "pipeline", enableNetwork: false });
      setPlanResponse(response);
      setExplanation(null);
      setInstallPreview(null);
      setExecutorPreview(null);
    });
  }

  async function runExplainPlan() {
    if (!planResponse) {
      return;
    }
    await withPending("Explaining plan...", async () => {
      const plan = extractPlan(planResponse);
      if (!plan) {
        throw new Error("Plan response does not contain plan.");
      }
      setExplanation(await explainPlan(plan));
    });
  }

  async function runGenerateInstallPreview() {
    if (!planResponse) {
      return;
    }
    await withPending("Building dry-run install preview...", async () => {
      const result = buildDesktopInstallPreview(planResponse);
      setInstallPreview(result.installPreview as unknown as JsonValue);
      setExecutorPreview(result.executorPreview as unknown as JsonValue);
      setConfirmationMessage(null);
    });
  }

  function runGenerateEnvironmentPreview() {
    setEnvironmentState(createMockEnvironmentReport({
      reportId: "env_desktop_shell_preview",
      platform: {
        os: "unknown",
        arch: "unknown",
      },
      runtime: {
        app: "MCagentlauncher Desktop Shell",
        tauriAvailable: false,
      },
    }));
    setConfirmationMessage(null);
  }

  function openProbeConsent() {
    setShowProbeConsent(true);
    setConfirmationMessage(null);
  }

  function cancelReadOnlyProbe() {
    setShowProbeConsent(false);
    setConfirmationMessage("Safe platform probe cancelled. No report was generated.");
  }

  function confirmReadOnlyProbe() {
    const report = runSafePlatformProbe(true);
    const safety = validateSafePlatformProbeSafety(report);

    setShowProbeConsent(false);
    setEnvironmentState(report);
    setConfirmationMessage(
      safety.accepted
        ? "Safe platform probe generated locally. No upload, persistence, command, file write, download, install, or launch occurred."
        : "Safe platform probe was generated, but safety validation reported blockers.",
    );
  }

  function confirmPreviewOnly() {
    setConfirmationMessage("v0.1 alpha supports dry-run preview only. The real Desktop Local Executor is not enabled.");
  }

  function setEnvironmentState(report: EnvironmentReport) {
    setEnvironmentReport(report as unknown as JsonValue);
    setEnvironmentSummary(summarizeEnvironmentReport(report));
    setEnvironmentReadiness(report.readiness.level);
    setEnvironmentWarnings(report.readiness.warnings);
    setEnvironmentBlockers(report.readiness.blockers);
  }

  async function withPending(label: string, action: () => Promise<void>) {
    setPending(label);
    setError(null);
    setConfirmationMessage(null);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setPending(null);
    }
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Desktop Shell / Dry-run Only</p>
          <h1>MCagentlauncher</h1>
          <p className="release-line">v0.1 - Natural Instance Alpha Preview</p>
          <p className="flow-line">Current status: no download / no install / no local write / no Minecraft launch</p>
        </div>
        <div className="api-box">
          <span>MCAgent API</span>
          <strong>{mcagentBaseUrl()}</strong>
        </div>
      </header>

      <section className="safety-banner" aria-label="Alpha preview safety boundary">
        v0.1 alpha is a dry-run preview. It will not download resources, install Minecraft, write a local instance, or launch Minecraft.
        Release notes: docs/releases/v0.1-alpha-preview.md. Demo guide: docs/demo/v0.1-alpha-demo-flow.md.
      </section>

      <StatusStepper steps={workflowSteps} />

      <PromptInput
        text={prompt}
        pending={pending}
        canGeneratePlan={prompt.trim().length > 0}
        canExplainPlan={planResponse !== null}
        canGeneratePreview={planResponse !== null}
        canConfirmPreview={installPreview !== null}
        onTextChange={setPrompt}
        onParseIntent={runParseIntent}
        onGeneratePlan={runGeneratePlan}
        onExplainPlan={runExplainPlan}
        onGeneratePreview={runGenerateInstallPreview}
        onConfirmInstall={confirmPreviewOnly}
        onGenerateEnvironmentPreview={runGenerateEnvironmentPreview}
        onRunSafePlatformProbe={openProbeConsent}
      />

      {error ? <div className="error-banner">{error}</div> : null}
      {confirmationMessage ? <div className="notice-banner">{confirmationMessage}</div> : null}

      <div className="grid">
        <IntentPanel intent={intent} />
        <DiagnosticsPanel diagnostics={diagnostics} explanation={explanation} />
        <PlanPanel planResponse={planResponse} />
        <EnvironmentPanel
          report={environmentReport}
          summary={environmentSummary}
          readinessLevel={environmentReadiness}
          warnings={environmentWarnings}
          blockers={environmentBlockers}
          onGeneratePreview={runGenerateEnvironmentPreview}
          onRunReadOnlyProbe={openProbeConsent}
        />
        <InstallPreviewPanel preview={installPreview} />
        <ExecutorPreviewPanel preview={executorPreview} />
        <SafetyNotice />
      </div>

      {showProbeConsent ? (
        <ProbeConsentModal onCancel={cancelReadOnlyProbe} onConfirm={confirmReadOnlyProbe} />
      ) : null}
    </main>
  );
}

function StatusStepper({ steps }: { steps: Array<{ label: string; status: string }> }) {
  return (
    <nav className="stepper" aria-label="Desktop preview workflow">
      {steps.map((step) => (
        <div className={`step ${step.status}`} key={step.label}>
          <span>{step.label}</span>
          <strong>{step.status}</strong>
        </div>
      ))}
    </nav>
  );
}

function extractPlan(value: JsonValue): JsonValue | null {
  if (isRecord(value) && isRecord(value.plan)) {
    return value.plan;
  }
  return value;
}

function extractDiagnostics(value: JsonValue | null): PlanDiagnostics | null {
  if (!isRecord(value) || !isRecord(value.diagnostics)) {
    return null;
  }

  const diagnostics = value.diagnostics;
  return {
    aliasMatches: Array.isArray(diagnostics.aliasMatches) ? diagnostics.aliasMatches : [],
    resolverQueries: Array.isArray(diagnostics.resolverQueries) ? diagnostics.resolverQueries : [],
    candidatesResolved: typeof diagnostics.candidatesResolved === "number" ? diagnostics.candidatesResolved : 0,
    warnings: toStringArray(diagnostics.warnings),
    errors: toStringArray(diagnostics.errors),
    networkUsed: diagnostics.networkUsed === true,
  };
}

function toStringArray(value: JsonValue | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => (typeof item === "string" ? item : JSON.stringify(item)));
}

function isRecord(value: JsonValue | undefined | null): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
