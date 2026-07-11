import desktopPackage from "../../package.json";
import { createBuildInfo } from "../../../../packages/shared-types/src/buildInfo";
import { mcagentBaseUrl } from "./mcagentClient";

export function getDesktopBuildInfo() {
  const tauriAvailable = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  return createBuildInfo({
    appVersion: desktopPackage.version,
    configuredEndpoint: mcagentBaseUrl(),
    tauriAvailable,
  });
}
