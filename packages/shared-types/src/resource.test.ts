import test from "node:test";
import assert from "node:assert/strict";

import { RESOURCE_TYPES, SIDE_SUPPORT, VERSION_TYPES } from "./resource.ts";

test("resource constants expose v0.1 supported values", () => {
  assert.deepEqual(RESOURCE_TYPES, ["mod", "resourcepack", "shaderpack"]);
  assert.deepEqual(VERSION_TYPES, ["release", "beta", "alpha"]);
  assert.ok(SIDE_SUPPORT.includes("unknown"));
});

