import test from "node:test";
import assert from "node:assert/strict";

import {
  formatPortConflictMessage,
  isControlledStage17PortOwner,
} from "./stage17-port-preflight.mjs";

test("recognizes only the managed Stage 17 reverse proxy as a controlled port owner", () => {
  assert.equal(isControlledStage17PortOwner("lexframe-stage17-reverse-proxy-1"), true);
  assert.equal(isControlledStage17PortOwner("law_frame_main-backend-1"), false);
});

test("formats a port conflict without suggesting destructive cleanup", () => {
  const message = formatPortConflictMessage(3100, ["law_frame_main-backend-1"]);

  assert.match(message, /port 3100 is already in use/i);
  assert.match(message, /law_frame_main-backend-1/);
  assert.match(message, /stage17:down only manages lexframe-stage17/i);
  assert.doesNotMatch(message, /kill/i);
});
