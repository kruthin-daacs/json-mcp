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

test("business map HTML shows name, goal metric, current value, and delta only", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "vedha-map-"));
  const input = path.join(directory, "map.json");
  const output = path.join(directory, "index.html");
  const catalog = JSON.parse(await readFile(path.join(root, "fixtures/catalog.json"), "utf8"));

  // Simulates the business-map skill merging vedha_list_contexts structure
  // with per-canvas current_value/delta resolved via vedha_get_canvas.
  const resolvedByWorkflow = {
    "Revenue": { current_value: "$54.0M", delta: "+$6.0M" },
    "Cash": { current_value: "$15.2M", delta: "-$2.2M" },
    "New Revenue": { current_value: "$3.6M", delta: "-$1.9M" },
    "Retention Revenue": { current_value: "105%", delta: "+5%" },
    "Expansion Revenue": { current_value: "+$4.2M", delta: "+$4.2M" },
    "Churn Revenue": { current_value: "-$1.8M", delta: "-$0.8M" }
  };
  const map = {
    name: catalog.name,
    altitudes: catalog.altitudes.map((altitude) => {
      const key = altitude.workflows ? "workflows" : "flows";
      return {
        name: altitude.name,
        [key]: altitude[key].map((node) => {
          const resolved = resolvedByWorkflow[node.name] ?? resolvedByWorkflow[node.under_workflow];
          return { name: node.name, goal_metric: node.goal_metric, current_value: resolved.current_value, delta: resolved.delta };
        })
      };
    })
  };

  await writeFile(input, JSON.stringify({ schema_version: "1.0", result_id: "context:dataorbit:v1", scope: "atlas", output_type: "business-map", ...map }));
  await execFileAsync(process.execPath, [path.join(root, "scripts/render-report.mjs"), input, output]);
  const html = await readFile(output, "utf8");
  const body = html.split("</style>")[1];
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
