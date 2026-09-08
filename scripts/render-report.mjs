import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  console.error("Usage: npm run render -- <result.json> <index.html>");
  process.exit(1);
}

const result = JSON.parse(await readFile(inputPath, "utf8"));
const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const tables = (result.visualizations ?? []).map((view) => {
  const rows = view.data ?? [];
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const head = columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("");
  const body = rows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(row[column])}</td>`).join("")}</tr>`).join("");
  return `<section><div class="view-type">${escapeHtml(view.type)}</div><h2>${escapeHtml(view.title)}</h2><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></section>`;
}).join("");

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(result.title)}</title><style>
:root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#17211d;background:#f5f4ef}body{margin:0}main{max-width:1120px;margin:auto;padding:40px 24px 72px}header{border-bottom:3px solid #0c6656;padding-bottom:24px;margin-bottom:28px}h1{font-size:32px;letter-spacing:0;margin:0 0 12px}h2{font-size:18px;letter-spacing:0;margin:4px 0 16px}p{color:#4d5752;line-height:1.6;max-width:760px}section{background:#fff;border:1px solid #d8ddd9;border-radius:6px;padding:20px;margin:18px 0;overflow:auto}.view-type{color:#0c6656;font:700 12px ui-monospace,monospace;text-transform:uppercase}table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #e3e7e4}th{color:#5f6964;font-size:12px;text-transform:uppercase}footer{margin-top:28px;color:#6d7671;font-size:12px}
</style></head><body><main><header><h1>${escapeHtml(result.title)}</h1><p>${escapeHtml(result.summary)}</p></header>${tables}<footer>Schema ${escapeHtml(result.schema_version)} · ${escapeHtml(result.output_type)}</footer></main></body></html>`;

await writeFile(outputPath, html, "utf8");
console.error(`Rendered ${path.resolve(outputPath)}`);
