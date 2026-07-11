import assert from "node:assert/strict";
import test from "node:test";
import { createBuildInfo, validateConfiguredEndpoint } from "./buildInfo.ts";

test("build info preserves the native preview safety boundary", () => {
  const info = createBuildInfo({
    appVersion: "0.1.0",
    configuredEndpoint: "http://127.0.0.1:8000",
    tauriAvailable: true,
  });

  assert.equal(info.appVersion, "0.1.0");
  assert.equal(info.packaged, true);
  assert.equal(info.serverBundled, false);
  assert.equal(info.executorEnabled, false);
  assert.equal(info.updaterEnabled, false);
  assert.equal(info.signingStatus, "unsigned-preview");
});

test("endpoint validation accepts HTTP(S) without credentials", () => {
  assert.equal(validateConfiguredEndpoint("https://planner.example.test").host, "planner.example.test");
  assert.throws(() => validateConfiguredEndpoint("ftp://planner.example.test"), /HTTP or HTTPS/);
  assert.throws(() => validateConfiguredEndpoint("https://user:secret@planner.example.test"), /credentials/);
});
