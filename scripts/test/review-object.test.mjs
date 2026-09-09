import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateReview } from "../lib/review-object.mjs";

const fixture = JSON.parse(await readFile(new URL("../../examples/mbr-review-object.json", import.meta.url), "utf8"));

test("example MBR review-object is valid", () => {
  assert.deepEqual(validateReview(fixture), []);
});

test("review validator rejects reordered recipe sections", () => {
  const invalid = structuredClone(fixture);
  [invalid.sections[0], invalid.sections[1]] = [invalid.sections[1], invalid.sections[0]];
  assert.match(validateReview(invalid).join("\n"), /step must be 1|section must be objective/);
});

test("review validator enforces additive E5 reconciliation", () => {
  const invalid = structuredClone(fixture);
  invalid.sections[2].insights[0].change_bridge.New = 99;
  assert.match(validateReview(invalid).join("\n"), /must reconcile/);
});

test("A1 cannot be narrated without a comparison companion", () => {
  const invalid = structuredClone(fixture);
  invalid.sections[0].insights.splice(1, 1);
  assert.match(validateReview(invalid).join("\n"), /must be followed by A2, A3, or A4/);
});
