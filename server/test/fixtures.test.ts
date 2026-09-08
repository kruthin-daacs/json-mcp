import assert from "node:assert/strict";
import test from "node:test";
import { canvasIds, filterDimension, loadCanvas, loadCatalog, loadRecipe, resolvePath } from "../src/fixtures.js";

test("catalog exposes the DataOrbit altitude tree", async () => {
  const catalog = await loadCatalog();
  assert.equal(Array.isArray(catalog.altitudes), true);
  assert.equal((catalog.altitudes as unknown[]).length, 3);
});

test("all six workflow canvases load and expose the shared shape", async () => {
  for (const id of canvasIds()) {
    const canvas = await loadCanvas(id);
    assert.equal(canvas.canvas_id, id);
    assert.ok(canvas.goal, `${id} missing goal`);
    assert.ok(Array.isArray(canvas.dimensions), `${id} missing dimensions`);
  }
});

test("unknown canvases are rejected", async () => {
  await assert.rejects(() => loadCanvas("unknown"), /Unknown canvas/);
});

test("filterDimension narrows to one dimension and value without mutating source", async () => {
  const canvas = await loadCanvas("retention");
  const filtered = filterDimension(canvas.dimensions, "health_tier", "red");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].breakdown.length, 1);
  assert.equal(filtered[0].breakdown[0].value, "red");
  const original = canvas.dimensions.find((d) => d.name === "health_tier")!;
  assert.equal(original.breakdown.length, 3);
});

test("resolvePath resolves dotted and bracket-filtered accessors", async () => {
  const canvas = await loadCanvas("cash_accounting");
  assert.equal(resolvePath(canvas, "goal.collected"), "$15.2M");
  const dso = resolvePath(canvas, "guardrails[metric=DSO].value");
  assert.equal(dso, "46 days");
});

test("resolvePath resolves chained bracket filters", async () => {
  const canvas = await loadCanvas("retention");
  const redRow = resolvePath(canvas, "dimensions[name=health_tier].breakdown[value=red]") as Record<string, unknown>;
  assert.equal(redRow.book, "$2.20M");
});

test("mbr_review recipe loads with six ordered steps", async () => {
  const recipe = await loadRecipe("mbr_review");
  assert.equal(recipe.steps.length, 6);
  assert.deepEqual(recipe.assembly.order, [1, 2, 3, 4, 5, 6]);
});

test("unknown recipes are rejected", async () => {
  await assert.rejects(() => loadRecipe("unknown"), /Unknown recipe/);
});
