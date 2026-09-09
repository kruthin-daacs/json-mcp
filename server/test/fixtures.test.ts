import assert from "node:assert/strict";
import test from "node:test";
import { canvasIds, filterDimension, loadCanvas, loadCatalog, loadRecipe, loadSemanticModels, resolvePath } from "../src/fixtures.js";

test("catalog exposes the DataOrbit altitude tree", async () => {
  const catalog = await loadCatalog();
  assert.equal(Array.isArray(catalog.altitudes), true);
  assert.equal((catalog.altitudes as unknown[]).length, 3);
});

test("catalog workflow nodes declare goal metric names without query values", async () => {
  const catalog = await loadCatalog();
  const altitudes = catalog.altitudes as Array<Record<string, unknown>>;
  const nodes = altitudes.flatMap((altitude) => (altitude.workflows ?? altitude.flows) as Array<Record<string, unknown>>);
  assert.ok(nodes.every((node) => typeof node.goal_metric === "string"));
  assert.ok(nodes.every((node) => !Object.hasOwn(node, "value")));
});

test("all six workflow canvases load and expose the shared shape", async () => {
  for (const id of canvasIds()) {
    const canvas = await loadCanvas(id);
    assert.equal(canvas.canvas_id, id);
    assert.ok(canvas.goal, `${id} missing goal`);
    assert.ok(canvas.measures, `${id} missing numeric measures`);
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
  assert.equal(recipe.recipe_version, "1.0");
  assert.equal(recipe.steps.length, 6);
  assert.deepEqual(recipe.assembly.order, [1, 2, 3, 4, 5, 6]);
  assert.ok(recipe.steps.every((step) => step.plan_question.length > 0));
});

test("semantic model projection contains labels and no query values", async () => {
  const models = await loadSemanticModels(["retention"]);
  assert.deepEqual(Object.keys(models[0]), ["canvas_id", "workflow", "entity", "activity", "goal_metric", "dimensions", "input_measures"]);
  assert.equal(models[0].goal_metric, "NRR");
  assert.ok(models[0].input_measures.includes("Renewal Book Due"));
  const serialized = JSON.stringify(models);
  assert.doesNotMatch(serialized, /\$|"current"|"target"|"status"|"measures"/i);
});

test("every MBR recipe read resolves from its declared canvas", async () => {
  const recipe = await loadRecipe("mbr_review");
  for (const step of recipe.steps) {
    for (const read of step.reads) {
      const canvas = await loadCanvas(read.workflow);
      for (const field of read.fields) {
        assert.notEqual(resolvePath(canvas, field), undefined, `step ${step.step}: ${read.workflow}.${field}`);
      }
    }
  }
});

test("ARR bridge reconciles opening and movements to current ARR", async () => {
  const canvas = await loadCanvas("revenue_accounting");
  const bridge = canvas.measures.arr_bridge;
  const current = Object.values(bridge.children as Record<string, number>).reduce((sum, value) => sum + value, 0);
  const prior = Object.values(bridge.children_prior as Record<string, number>).reduce((sum, value) => sum + value, 0);
  assert.equal(prior, bridge.parent_prior);
  assert.equal(current, bridge.parent_current);
});

test("unknown recipes are rejected", async () => {
  await assert.rejects(() => loadRecipe("unknown"), /Unknown recipe/);
});
