import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const root = path.resolve(new URL("../..", import.meta.url).pathname);

test("MBR HTML hides internal recipe section identifiers", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "vedha-render-"));
  const output = path.join(directory, "index.html");
  await execFileAsync(process.execPath, [
    path.join(root, "scripts/render-report.mjs"),
    path.join(root, "examples/mbr-review-object.json"),
    output
  ]);
  const html = await readFile(output, "utf8");
  assert.doesNotMatch(html, /class="section-kicker"/i);
  assert.doesNotMatch(html, /section-objective|section-kr_finance|section-causal_chain/i);
  assert.doesNotMatch(html, /class="atom-badge"|data-atom|>A1<|>A2<|>D1<|>E5</i);
  assert.doesNotMatch(html, />kr finance</i);
  assert.doesNotMatch(html, />causal chain</i);
  assert.match(html, />Is the business on plan\?</);
});

// Simulates the business-map skill merging the vedha_list_contexts structure
// with per-canvas fields resolved via vedha_get_canvas. Workflow nodes carry
// the goal metric; flow nodes carry an entity-flow and no goal metric at all.
const resolvedByWorkflow = {
  "Revenue": { current_value: "$54.0M", delta: "+$6.0M" },
  "Cash": { current_value: "$15.2M", delta: "-$2.2M" },
  "New Revenue": { current_value: "$3.6M", delta: "-$1.9M" },
  "Retention Revenue": { current_value: "105%", delta: "+5%" },
  "Expansion Revenue": { current_value: "+$4.2M", delta: "+$4.2M" },
  "Churn Revenue": { current_value: "-$1.8M", delta: "-$0.8M" }
};

const entityFlowByFlow = {
  "Lead-to-Cash": [
    { label: "Pipeline coverage", value: "1.1x" },
    { label: "Win rate", value: "28%" }
  ],
  "Renewal-to-Cash": [
    { label: "Renewal book due", value: "$12.0M" },
    { label: "At-risk ARR", value: "$2.2M" },
    { label: "Top open renewal", value: "Meridian $0.8M · decision Dec 16" }
  ],
  "Quote-to-Cash": [
    { label: "Expansion at renewal", value: "$2.8M" },
    { label: "Expansion in quarter", value: "$1.4M" }
  ],
  "Risk-to-Resolution": [
    { label: "Open at-risk ARR", value: "$0.8M" },
    { label: "Save rate", value: "28.6%" }
  ]
};

async function renderCatalogMap() {
  const directory = await mkdtemp(path.join(tmpdir(), "vedha-map-"));
  const input = path.join(directory, "map.json");
  const output = path.join(directory, "index.html");
  const catalog = JSON.parse(await readFile(path.join(root, "fixtures/catalog.json"), "utf8"));

  const map = {
    name: catalog.name,
    altitudes: catalog.altitudes.map((altitude) => {
      const key = altitude.workflows ? "workflows" : "flows";
      return {
        name: altitude.name,
        [key]: altitude[key].map((node) => {
          if (key === "flows") return { name: node.name, entity_flow: entityFlowByFlow[node.name] };
          const resolved = resolvedByWorkflow[node.name];
          return { name: node.name, goal_metric: node.goal_metric, current_value: resolved.current_value, delta: resolved.delta };
        })
      };
    })
  };

  await writeFile(input, JSON.stringify({ schema_version: "1.0", result_id: "context:dataorbit:v1", scope: "atlas", output_type: "business-map", ...map }));
  await execFileAsync(process.execPath, [path.join(root, "scripts/render-report.mjs"), input, output]);
  const html = await readFile(output, "utf8");
  return html.split("</style>")[1];
}

test("business map HTML shows name, goal metric, current value, and delta only", async () => {
  const body = await renderCatalogMap();
  assert.match(body, />Finance<.*>Revenue Levers<.*>Flows</s);
  assert.match(body, />ARR<|>NRR</);
  assert.match(body, />Current value</);
  assert.match(body, />\$54\.0M</);
  assert.match(body, />Delta</);
  assert.match(body, />\+\$6\.0M</);
  assert.doesNotMatch(body, />Atlas</);
  assert.doesNotMatch(body, />Altitude</i);
  assert.doesNotMatch(body, />Owner</i);
  assert.doesNotMatch(body, />Cadence</i);
  assert.doesNotMatch(body, />Workflow</i);
  assert.doesNotMatch(body, /class="atom-badge"|>A1<|>A2<|>D1</i);
});

test("flow nodes render their entity-flow, not their lever's goal metric", async () => {
  const body = await renderCatalogMap();
  const flowsBand = body.split(">Flows<")[1];
  assert.ok(flowsBand, "expected a Flows altitude band");

  // Every flow renders its own operational items.
  assert.match(flowsBand, /class="entity-flow"/);
  assert.match(flowsBand, />Pipeline coverage<.*>1\.1x</s);
  assert.match(flowsBand, />Renewal book due<.*>\$12\.0M</s);
  assert.match(flowsBand, />Top open renewal<.*>Meridian \$0\.8M · decision Dec 16</s);
  assert.match(flowsBand, />Expansion at renewal<.*>\$2\.8M</s);
  assert.match(flowsBand, />Save rate<.*>28\.6%</s);

  // No flow repeats its lever's goal metric, value, or delta.
  assert.doesNotMatch(flowsBand, />Goal metric</);
  assert.doesNotMatch(flowsBand, />Current value</);
  assert.doesNotMatch(flowsBand, />Delta</);
  assert.doesNotMatch(flowsBand, />New ACV<|>NRR<|>Expansion ARR<|>Minimised Lost ARR</);
  for (const { current_value, delta } of Object.values(resolvedByWorkflow)) {
    assert.doesNotMatch(flowsBand, new RegExp(`>${current_value.replace(/[.$+]/g, "\\$&")}<`));
    assert.doesNotMatch(flowsBand, new RegExp(`>${delta.replace(/[.$+]/g, "\\$&")}<`));
  }
});
