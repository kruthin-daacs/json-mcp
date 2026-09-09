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

test("business map HTML shows topology without values or atomic taxonomy", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "vedha-map-"));
  const input = path.join(directory, "map.json");
  const output = path.join(directory, "index.html");
  const catalog = JSON.parse(await readFile(path.join(root, "fixtures/catalog.json"), "utf8"));
  await writeFile(input, JSON.stringify({ schema_version: "1.0", result_id: "context:dataorbit:v1", scope: "atlas", output_type: "business-map", ...catalog }));
  await execFileAsync(process.execPath, [path.join(root, "scripts/render-report.mjs"), input, output]);
  const html = await readFile(output, "utf8");
  const body = html.split("</style>")[1];
  assert.match(body, />Finance<.*>Revenue Levers<.*>Flows</s);
  assert.match(body, />ARR<|>NRR</);
  assert.doesNotMatch(body, /\$\d|\d+%|class="atom-badge"|>A1<|>A2<|>D1</i);
});
