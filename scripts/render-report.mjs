import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertValidReview } from "./lib/review-object.mjs";

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  console.error("Usage: npm run render -- <result.json> <index.html>");
  process.exit(1);
}

const result = JSON.parse(await readFile(inputPath, "utf8"));
const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function formatNumber(value, unit, signed = false) {
  const sign = signed && value > 0 ? "+" : "";
  if (unit === "usd_millions") return `${sign}${value < 0 ? "-" : ""}$${Math.abs(value).toFixed(1)}M`;
  if (unit === "ratio") return `${sign}${(value * 100).toFixed(value * 100 % 1 ? 1 : 0)}%`;
  if (unit === "days") return `${sign}${value} days`;
  return `${sign}${value}`;
}

function renderTarget(valueAtom, targetAtom) {
  const attained = targetAtom.target === 0 ? 0 : targetAtom.value / targetAtom.target;
  const statusLabel = targetAtom.status === "below_target" ? "Below objective" : targetAtom.status.replaceAll("_", " ");
  return `<div class="target-view">
    <div class="metric-stack"><div class="metric-label">${esc(valueAtom.title)}</div><div class="metric-value">${esc(valueAtom.display)}</div><div class="status status-${esc(targetAtom.status)}">${esc(statusLabel)}</div></div>
    <div class="target-track-wrap"><div class="target-scale"><span>Current</span><strong>${esc(targetAtom.display)}</strong><span>Objective ${esc(targetAtom.target_display)}</span></div><div class="target-track"><span style="width:${clamp(attained * 100, 0, 100)}%"></span></div><div class="target-gap">Gap ${esc(formatNumber(targetAtom.gap, targetAtom.unit, true))}</div></div>
  </div>`;
}

function renderValue(atom) {
  return `<div class="metric-view"><div><div class="metric-label">${esc(atom.title)}</div><div class="metric-value small">${esc(atom.display ?? atom.value)}</div></div></div>`;
}

function renderComparison(atom) {
  const max = Math.max(Math.abs(atom.value_a), Math.abs(atom.value_b), 1);
  const rows = [[atom.label_a, atom.value_a, "primary"], [atom.label_b, atom.value_b, "secondary"]]
    .map(([label, value, tone]) => `<div class="compare-row"><div class="compare-meta"><span>${esc(label)}</span><strong>${esc(formatNumber(value, atom.unit))}</strong></div><div class="compare-track"><span class="${tone}" style="width:${Math.abs(value) / max * 100}%"></span></div></div>`).join("");
  return `<div class="comparison-view"><div class="visual-head"><strong>${esc(atom.title)}</strong></div>${rows}<p class="atom-sentence">${esc(atom.sentence)}</p></div>`;
}

function renderStructural(atom) {
  const entries = Object.entries(atom.children ?? {}).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const max = Math.max(...entries.map(([, value]) => Math.abs(value)), 1);
  const rows = entries.map(([label, value]) => `<div class="driver-row"><span>${esc(label)}</span><div class="driver-track"><i class="${value >= 0 ? "positive" : "negative"}" style="width:${Math.abs(value) / max * 100}%"></i></div><strong class="${value >= 0 ? "positive-text" : "negative-text"}">${esc(formatNumber(value, atom.unit, true))}</strong></div>`).join("");
  return `<div class="structural-view"><div class="identity"><strong>${esc(atom.parent_label)}</strong><span>${esc(formatNumber(atom.parent, atom.unit))}</span><b>=</b><em>${esc(Object.keys(atom.children ?? {}).join(` ${atom.operator} `))}</em></div>${rows}<div class="visual-head foot"><span>${esc(atom.sentence)}</span></div></div>`;
}

function renderWaterfall(atom) {
  const deltas = Object.entries(atom.change_bridge ?? {}).filter(([, value]) => Math.abs(value) > 1e-12);
  const prior = Object.values(atom.children_prior ?? {}).reduce((sum, value) => sum + Number(value), 0);
  const current = Object.values(atom.children ?? {}).reduce((sum, value) => sum + Number(value), 0);
  const points = [prior];
  for (const [, delta] of deltas) points.push(points.at(-1) + delta);
  const low = Math.min(...points, current);
  const high = Math.max(...points, current);
  const pad = Math.max((high - low) * 0.18, 0.8);
  const min = low - pad;
  const max = high + pad;
  const width = 900;
  const height = 300;
  const plotTop = 34;
  const plotBottom = 236;
  const labels = ["Opening", ...deltas.map(([label]) => label), "Current"];
  const count = labels.length;
  const gap = 16;
  const barWidth = Math.min(96, (width - 100 - gap * (count - 1)) / count);
  const totalWidth = count * barWidth + (count - 1) * gap;
  const left = (width - totalWidth) / 2;
  const y = (value) => plotBottom - ((value - min) / (max - min)) * (plotBottom - plotTop);
  const baseline = y(min);
  const parts = [];

  const drawTotal = (index, label, value, color) => {
    const x = left + index * (barWidth + gap);
    const top = y(value);
    parts.push(`<rect x="${x}" y="${top}" width="${barWidth}" height="${Math.max(2, baseline - top)}" rx="3" fill="${color}"/>`);
    parts.push(`<text x="${x + barWidth / 2}" y="${top - 9}" text-anchor="middle" class="wf-value">${esc(formatNumber(value, atom.unit))}</text>`);
    parts.push(`<text x="${x + barWidth / 2}" y="${plotBottom + 26}" text-anchor="middle" class="wf-label">${esc(label)}</text>`);
  };

  drawTotal(0, "Opening", prior, "#8b918e");
  let running = prior;
  deltas.forEach(([label, delta], offset) => {
    const index = offset + 1;
    const x = left + index * (barWidth + gap);
    const next = running + delta;
    const top = y(Math.max(running, next));
    const bottom = y(Math.min(running, next));
    const previousX = left + (index - 1) * (barWidth + gap) + barWidth;
    parts.push(`<line x1="${previousX}" y1="${y(running)}" x2="${x}" y2="${y(running)}" stroke="#b9bfbc" stroke-width="1" stroke-dasharray="3 3"/>`);
    parts.push(`<rect x="${x}" y="${top}" width="${barWidth}" height="${Math.max(3, bottom - top)}" rx="3" fill="${delta >= 0 ? "#16815f" : "#d64c4c"}"/>`);
    parts.push(`<text x="${x + barWidth / 2}" y="${delta >= 0 ? top - 9 : bottom + 17}" text-anchor="middle" class="wf-value ${delta < 0 ? "loss" : ""}">${esc(formatNumber(delta, atom.unit, true))}</text>`);
    parts.push(`<text x="${x + barWidth / 2}" y="${plotBottom + 26}" text-anchor="middle" class="wf-label">${esc(label)}</text>`);
    running = next;
  });
  drawTotal(count - 1, "Current", current, "#3277b3");

  return `<div class="waterfall-view"><div class="visual-head"><strong>${esc(atom.title)}</strong></div><div class="chart-scroll"><svg role="img" aria-label="${esc(atom.title)}" viewBox="0 0 ${width} ${height}"><line x1="28" y1="${plotBottom}" x2="872" y2="${plotBottom}" stroke="#d8ddda"/>${parts.join("")}</svg></div><p class="atom-sentence">${esc(atom.sentence)}</p></div>`;
}

function renderAtom(atom) {
  if (atom.atom_id === "D1") return renderComparison(atom);
  if (atom.atom_id === "E4") return renderStructural(atom);
  if (atom.atom_id === "E5") return renderWaterfall(atom);
  return renderValue(atom);
}

function renderInsights(insights) {
  let html = "";
  for (let index = 0; index < insights.length; index += 1) {
    const current = insights[index];
    const next = insights[index + 1];
    if (current.atom_id === "A1" && next?.atom_id === "A2") {
      html += renderTarget(current, next);
      index += 1;
    } else {
      html += renderAtom(current);
    }
  }
  return html;
}

function renderReview(review) {
  assertValidReview(review);
  const sections = review.sections.map((section) => `<section class="review-section"><div class="section-index">0${section.step}</div><div class="section-body"><h2>${esc(section.heading)}</h2><p class="question">${esc(section.question)}</p><p class="answer">${esc(section.answer)}</p>${renderInsights(section.insights)}${section.callout ? `<aside class="callout callout-${esc(section.callout.tone)}"><span>${esc(section.callout.label)}</span><strong>${esc(section.callout.text)}</strong></aside>` : ""}</div></section>`).join("");
  const evidence = review.evidence.map((item) => `<li><code>${esc(item.result_id)}</code><span>${esc(item.tool)} · ${esc(item.scope)}</span></li>`).join("");
  const warnings = review.warnings.length ? `<div class="warnings"><strong>Evidence limits</strong>${review.warnings.map((warning) => `<p>${esc(warning)}</p>`).join("")}</div>` : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(review.title)}</title><style>${styles}</style></head><body><header class="topbar"><div class="brand">VEDHA</div><div class="meta"><span>${esc(review.period)}</span><span>${esc(review.cadence)}</span><span>Recipe ${esc(review.recipe_version)}</span></div></header><main><div class="review-title"><div><p class="eyebrow">Executive operating review</p><h1>${esc(review.title)}</h1></div><p>${esc(review.executive_summary)}</p></div>${sections}<footer>${warnings}<details><summary>Evidence and provenance</summary><ul>${evidence}</ul></details><div class="footer-meta">Schema ${esc(review.schema_version)} · ${esc(review.output_type)} · ${esc(review.recipe_id)}</div></footer></main></body></html>`;
}

function renderWorkflowNode(node) {
  return `<dl class="node-metric"><div class="node-goal"><dt>Goal metric</dt><dd>${esc(node.goal_metric)}</dd></div><div class="node-hero"><dt>Current value</dt><dd>${esc(node.current_value)}</dd></div><div class="node-delta"><dt>Delta</dt><dd>${esc(node.delta)}</dd></div></dl>`;
}

function renderFlowNode(node) {
  const items = node.entity_flow
    .map((item, index) => {
      // Layout-only: a long value (e.g. the composed top-renewal string) gets its
      // own line instead of being squeezed beside the label. Purely presentational.
      const classes = [index === 0 ? "lead" : "", String(item.value ?? "").length > 16 ? "stacked" : ""].filter(Boolean);
      const attr = classes.length ? ` class="${classes.join(" ")}"` : "";
      return `<li${attr}><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong></li>`;
    })
    .join("");
  return `<ul class="entity-flow">${items}</ul>`;
}

// Slug for the band tint. Unknown altitude names fall through to a neutral band.
function bandSlug(name) {
  return String(name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// as_of is a passthrough of three fixed strings; absent fields are simply omitted.
function renderAsOf(asOf) {
  if (!asOf) return "";
  const parts = [asOf.as_of && `as of ${asOf.as_of}`, asOf.period, asOf.week].filter(Boolean);
  if (parts.length === 0) return "";
  return `<p class="as-of">${parts.map(esc).join(" · ")}</p>`;
}

// The pace bar's width is geometry read off the supplied pace string — the
// percentage itself is a fixed field, never derived from current vs target.
function renderObjective(objective) {
  if (!objective) return "";
  const pace = Number.parseFloat(String(objective.pace_display ?? ""));
  const bar = Number.isFinite(pace)
    ? `<div class="objective-track"><span style="width:${clamp(pace, 0, 100)}%"></span></div>`
    : "";
  const pacePill = objective.pace_display ? `<span class="objective-pace">${esc(objective.pace_display)} of objective</span>` : "";
  return `<section class="objective">
    <div class="objective-head"><p class="eyebrow">Objective</p>${pacePill}</div>
    <div class="objective-figures"><strong>${esc(objective.current)}</strong><span class="objective-metric">${esc(objective.metric)}</span><span class="objective-target">Objective ${esc(objective.target)}</span></div>
    ${bar}
  </section>`;
}

function renderBusinessMap(map) {
  const altitudes = (map.altitudes ?? []).map((altitude) => {
    const nodes = altitude.workflows ?? altitude.flows ?? [];
    const nodeHtml = nodes.map((node) => {
      const body = Array.isArray(node.entity_flow) ? renderFlowNode(node) : renderWorkflowNode(node);
      // state is a precomputed field, read verbatim: absent renders neutral, never inferred.
      const state = node.state ? bandSlug(node.state) : "";
      const stateClass = state ? ` state-${state}` : "";
      const flag = state === "warm" || state === "critical"
        ? ` <span class="flag" role="img" aria-label="${esc(state)}">⚑</span>`
        : "";
      return `<article class="map-node${stateClass}"><h3>${esc(node.name)}${flag}</h3>${body}</article>`;
    }).join("");
    const grid = nodes.length === 2 ? "grid-2" : "grid-4";
    return `<section class="map-altitude band-${bandSlug(altitude.name)}"><header><p class="eyebrow">${esc(altitude.name)}</p></header><div class="map-grid ${grid}">${nodeHtml}</div></section>`;
  }).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(map.name)}</title><style>${styles}${mapStyles}</style></head><body class="map-page"><header class="topbar"><div class="brand">VEDHA</div><div class="meta"><span>Business map</span></div></header><main><div class="map-title"><h1>${esc(map.name)}</h1>${renderAsOf(map.as_of)}</div>${renderObjective(map.objective)}${altitudes}</main></body></html>`;
}

function renderSemanticModel(model) {
  const models = (model.models ?? []).map((item) => `<section class="semantic-model"><h2>${esc(item.workflow)}</h2><dl><div><dt>Entity</dt><dd>${item.entity.map(esc).join(", ")}</dd></div><div><dt>Activity</dt><dd>${item.activity.map(esc).join(", ")}</dd></div><div><dt>Goal metric</dt><dd>${esc(item.goal_metric)}</dd></div><div><dt>Dimensions</dt><dd>${item.dimensions.map((dimension) => esc(dimension.name)).join(", ")}</dd></div><div><dt>Input measures</dt><dd>${item.input_measures.map(esc).join(", ")}</dd></div></dl></section>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Semantic model</title><style>${styles}</style></head><body><header class="topbar"><div class="brand">VEDHA</div><div class="meta"><span>Semantic model</span></div></header><main><div class="map-title"><h1>Semantic model</h1></div><div class="semantic-list">${models}</div></main></body></html>`;
}

function renderLegacy(legacy) {
  const views = (legacy.visualizations ?? []).map((view) => {
    const rows = view.data ?? [];
    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    return `<section class="review-section"><div class="section-body"><h2>${esc(view.title)}</h2><table><thead><tr>${columns.map((column) => `<th>${esc(column)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map((column) => `<td>${esc(row[column])}</td>`).join("")}</tr>`).join("")}</tbody></table></div></section>`;
  }).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(legacy.title)}</title><style>${styles}</style></head><body><main><div class="review-title"><div><h1>${esc(legacy.title)}</h1></div><p>${esc(legacy.summary)}</p></div>${views}</main></body></html>`;
}

const styles = `
:root{font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#18201d;background:#f3f4f1;--ink:#18201d;--muted:#626b67;--line:#d5dad7;--paper:#fff;--green:#16815f;--red:#c53d45;--amber:#a56a0a;--blue:#3277b3}*{box-sizing:border-box}body{margin:0}.topbar{height:54px;padding:0 max(24px,calc((100vw - 1160px)/2));display:flex;align-items:center;justify-content:space-between;background:#153f35;color:#fff;border-bottom:4px solid #22a27b}.brand{font-size:13px;font-weight:800}.meta{display:flex;gap:20px;font:600 11px ui-monospace,SFMono-Regular,monospace;text-transform:uppercase;color:#d7e8e2}main{max-width:1160px;margin:0 auto;padding:34px 24px 70px}.review-title{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(300px,.95fr);gap:56px;align-items:end;padding:12px 0 30px;border-bottom:1px solid #9da5a1}.eyebrow{margin:0 0 8px;color:#147357;font:700 11px ui-monospace,SFMono-Regular,monospace;text-transform:uppercase}.review-title h1{font-size:clamp(30px,4vw,46px);line-height:1.08;letter-spacing:0;margin:0;max-width:680px}.review-title>p{margin:0;color:#48524e;font-size:16px;line-height:1.6}.review-section{display:grid;grid-template-columns:68px minmax(0,1fr);border-bottom:1px solid var(--line);background:transparent}.section-index{padding-top:32px;font:500 13px ui-monospace,SFMono-Regular,monospace;color:#89918d}.section-body{padding:30px 0 34px}.section-body h2{margin:0 0 7px;font-size:22px;line-height:1.25;letter-spacing:0}.question{margin:0 0 14px;color:#6b7470;font-size:13px}.answer{max-width:890px;margin:0;color:#28332f;font-size:15px;line-height:1.65}.target-view,.comparison-view,.structural-view,.waterfall-view,.metric-view{position:relative;margin-top:22px;padding:20px;background:var(--paper);border:1px solid var(--line);border-radius:6px}.target-view{display:grid;grid-template-columns:240px minmax(260px,1fr);gap:36px;align-items:center}.metric-label{font-size:12px;color:var(--muted);font-weight:650}.metric-value{font-size:42px;line-height:1.08;font-weight:650;margin:4px 0 9px}.metric-value.small{font-size:32px}.status{display:inline-flex;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:750;text-transform:uppercase}.status-below_target{background:#f9e5e5;color:#922b31}.status-above_target,.status-on_track{background:#e0f1ea;color:#106348}.target-scale{display:flex;justify-content:space-between;gap:12px;margin-bottom:8px;color:#69726e;font-size:11px}.target-scale strong{color:var(--ink);font-size:13px}.target-track,.compare-track,.driver-track{height:9px;background:#e6e9e7;border-radius:3px;overflow:hidden}.target-track span{display:block;height:100%;background:var(--blue)}.target-gap{margin-top:8px;color:#9d333a;font-size:12px;font-weight:650}.atom-pair{position:absolute;right:14px;top:12px}.atom-badge{display:inline-flex;align-items:center;height:21px;padding:0 6px;border:1px solid #bdc9c4;border-radius:3px;color:#466058;background:#f7f9f8;font:700 10px ui-monospace,SFMono-Regular,monospace}.visual-head{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:18px}.visual-head strong{font-size:14px}.compare-row{margin:12px 0}.compare-meta{display:flex;justify-content:space-between;gap:20px;margin-bottom:6px;font-size:12px}.compare-track span,.driver-track i{display:block;height:100%}.compare-track .primary{background:var(--blue)}.compare-track .secondary{background:#8e9994}.atom-sentence{margin:16px 0 0;color:#56605c;font-size:12px;line-height:1.5}.driver-row{display:grid;grid-template-columns:130px minmax(120px,1fr) 80px;gap:12px;align-items:center;margin:10px 0;font-size:12px}.driver-row strong{text-align:right}.driver-track .positive{background:var(--green)}.driver-track .negative{background:var(--red)}.positive-text{color:#106348}.negative-text{color:#a62f36}.identity{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;padding-bottom:16px;margin-bottom:14px;border-bottom:1px solid #e4e7e5}.identity span{font-size:26px;font-weight:700}.identity b{color:#848d89}.identity em{font-style:normal;color:#56615c}.visual-head.foot{justify-content:flex-start;margin:16px 0 0;color:#56605c;font-size:12px}.chart-scroll{overflow-x:auto}.waterfall-view svg{display:block;width:100%;min-width:720px;height:auto}.wf-value{font:700 12px Inter,ui-sans-serif,sans-serif;fill:#31403a}.wf-value.loss{fill:#a52e35}.wf-label{font:600 11px Inter,ui-sans-serif,sans-serif;fill:#626c67}.callout{display:grid;grid-template-columns:130px minmax(0,1fr);gap:16px;align-items:start;margin-top:18px;padding:14px 16px;border-left:4px solid #81908a;background:#e9ecea}.callout span{font:750 10px ui-monospace,SFMono-Regular,monospace;text-transform:uppercase;color:#53605b}.callout strong{font-size:13px;line-height:1.45}.callout-healthy{border-color:var(--green);background:#e4f2ec}.callout-watch{border-color:var(--amber);background:#f7edda}.callout-critical{border-color:var(--red);background:#f8e7e7}.callout-decision{border-color:#7b5ab5;background:#eee9f6}footer{padding:30px 0;color:#5c6661;font-size:12px}.warnings{border-left:4px solid var(--amber);padding:10px 14px;background:#f7edda;margin-bottom:18px}.warnings p{margin:5px 0 0}.footer-meta{margin-top:18px;font:500 10px ui-monospace,SFMono-Regular,monospace;text-transform:uppercase}details{border-top:1px solid var(--line);padding-top:16px}summary{cursor:pointer;font-weight:700;color:#34423d}details ul{list-style:none;padding:0;margin:12px 0}details li{display:flex;justify-content:space-between;gap:20px;padding:8px 0;border-bottom:1px solid #e1e5e2}code{font-size:11px;color:#176b55}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{text-align:left;padding:10px;border-bottom:1px solid var(--line);font-size:12px}th{text-transform:uppercase;color:var(--muted)}
.map-title{padding:12px 0 30px;border-bottom:1px solid #9da5a1}.map-title h1{font-size:38px;line-height:1.1;letter-spacing:0;margin:0}.map-altitude{padding:28px 0 34px;border-bottom:1px solid var(--line)}.map-altitude>header{margin-bottom:18px}.map-altitude>header h2{margin:0;font-size:24px}.map-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.map-node{background:var(--paper);border:1px solid var(--line);border-radius:6px;padding:16px}.map-node h3{font-size:16px;margin:0 0 14px}.map-node dl,.semantic-model dl{margin:0}.map-node dl div,.semantic-model dl div{display:grid;grid-template-columns:92px minmax(0,1fr);gap:10px;padding:7px 0;border-top:1px solid #e5e8e6}.map-node dt,.semantic-model dt{color:var(--muted);font-size:11px}.map-node dd,.semantic-model dd{margin:0;font-size:12px;font-weight:650}.entity-flow{list-style:none;margin:0;padding:0}.entity-flow li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:baseline;padding:7px 0;border-top:1px solid #e5e8e6}.entity-flow span{color:var(--muted);font-size:11px}.entity-flow strong{font-size:12px;font-weight:650;text-align:right}.semantic-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;margin-top:24px}.semantic-model{background:var(--paper);border:1px solid var(--line);border-radius:6px;padding:18px}.semantic-model h2{font-size:17px;margin:0 0 14px}
@media(max-width:720px){.topbar{padding:0 16px}.meta span:nth-child(2),.meta span:nth-child(3){display:none}main{padding:24px 16px 50px}.review-title{grid-template-columns:1fr;gap:16px}.review-title h1{font-size:32px}.review-title>p{font-size:14px}.review-section{grid-template-columns:36px minmax(0,1fr)}.section-index{padding-top:26px}.section-body{padding:24px 0 28px}.section-body h2{font-size:19px}.target-view{grid-template-columns:1fr;gap:20px;padding:16px}.metric-value{font-size:36px}.target-scale{flex-wrap:wrap}.atom-pair{position:static}.callout{grid-template-columns:1fr;gap:5px}.driver-row{grid-template-columns:90px minmax(80px,1fr) 72px}.comparison-view,.structural-view,.waterfall-view,.metric-view{padding:16px}details li{display:block}details li span{display:block;margin-top:4px}}
`;

// Business-map house style. Scoped entirely under .map-page so the review and
// semantic-model documents keep the stylesheet above unchanged.
const mapStyles = `
.map-page{--ink:#1E1E24;--paper:#fff;--cream:#F5F2EB;--muted:#6B6B76;--hair:#E3DDD1;--warm:#C98A1E;--critical:#C0453F;--band-finance:rgba(186,124,16,.13);--band-revenue:rgba(20,120,88,.12);--band-flows:rgba(38,104,168,.13);font-family:"Inter Tight","DM Sans",Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--cream);color:var(--ink);font-size:15px;-webkit-font-smoothing:antialiased}
.map-page main{max-width:1200px;padding:16px 26px 14px}
.map-page .map-title{padding:0 0 9px;border-bottom:none}
.map-page .map-title h1{font-size:clamp(22px,2.2vw,28px);font-weight:680;letter-spacing:-.015em;line-height:1.12;margin:0;max-width:46ch}
.map-page .as-of{margin:6px 0 0;color:var(--muted);font-size:13.5px;letter-spacing:.01em}
.map-page .eyebrow{margin:0;color:var(--muted);font:650 10.5px "Inter Tight",Inter,ui-sans-serif,sans-serif;letter-spacing:.14em;text-transform:uppercase}
.map-page .objective{margin:11px 0 13px;padding:11px 16px;background:var(--paper);border:1px solid var(--hair);border-radius:12px;box-shadow:0 1px 2px rgba(30,30,36,.04)}
.map-page .objective-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:6px}
.map-page .objective-pace{color:var(--muted);font-size:12.5px;font-weight:600}
.map-page .objective-figures{display:flex;align-items:baseline;gap:11px;flex-wrap:wrap}
.map-page .objective-figures strong{font-size:25px;font-weight:680;letter-spacing:-.02em;line-height:1}
.map-page .objective-metric{font-size:14px;font-weight:600}
.map-page .objective-target{margin-left:auto;color:var(--muted);font-size:13.5px}
.map-page .objective-track{height:5px;margin-top:9px;background:#EFEAE0;border-radius:99px;overflow:hidden}
.map-page .objective-track span{display:block;height:100%;background:linear-gradient(90deg,#1B7F5F,#2AA37C);border-radius:99px}
.map-page .map-altitude{margin:0 0 7px;padding:11px 14px 13px;border:none;border-radius:14px;background:#EFEAE0}
.map-page .band-finance{background:var(--band-finance)}
.map-page .band-revenue-levers{background:var(--band-revenue)}
.map-page .band-flows{background:var(--band-flows)}
.map-page .map-altitude>header{margin-bottom:8px}
/* grid-auto-rows:1fr equalises card height within a band, so a taller card
   (e.g. Renewal-to-Cash) does not leave its row-mates short. */
.map-page .map-grid{display:grid;gap:10px;grid-auto-rows:1fr}
.map-page .grid-2{grid-template-columns:repeat(2,minmax(0,1fr))}
.map-page .grid-4{grid-template-columns:repeat(4,minmax(0,1fr))}
.map-page .map-node{display:flex;flex-direction:column;height:100%;padding:13px 15px;background:var(--paper);border:1px solid var(--hair);border-radius:12px;box-shadow:0 1px 2px rgba(30,30,36,.04)}
.map-page .map-node h3{display:flex;align-items:center;gap:7px;margin:0 0 9px;font-size:17.5px;font-weight:660;letter-spacing:-.01em;line-height:1.2}
/* state accents — applied only when a node carries a state field. */
.map-page .map-node.state-warm{border-color:rgba(201,138,30,.5);box-shadow:0 1px 2px rgba(30,30,36,.04),inset 3px 0 0 var(--warm)}
.map-page .map-node.state-critical{border-color:rgba(192,69,63,.5);box-shadow:0 1px 2px rgba(30,30,36,.04),inset 3px 0 0 var(--critical)}
.map-page .flag{font-size:13px;line-height:1}
.map-page .state-warm .flag{color:var(--warm)}
.map-page .state-critical .flag{color:var(--critical)}
.map-page .node-metric{margin:0;display:flex;flex-direction:column;flex:1}
.map-page .node-metric div{display:block;grid-template-columns:none;gap:0;padding:0;border-top:none}
.map-page .node-metric dt{color:var(--muted);font-size:11.5px;font-weight:600;letter-spacing:.01em}
.map-page .node-metric dd{margin:0}
.map-page .node-goal dd{font-size:13.5px;font-weight:600}
.map-page .node-hero{margin-top:7px}
.map-page .node-hero dd{font-size:24px;font-weight:680;letter-spacing:-.02em;line-height:1.05;margin-top:1px}
.map-page .node-delta{display:flex!important;align-items:baseline;justify-content:space-between;gap:10px;margin-top:auto;padding-top:7px!important;border-top:1px solid #F0EBE1!important}
.map-page .node-delta dd{font-size:13.5px;font-weight:640}
.map-page .entity-flow li{grid-template-columns:minmax(0,1.15fr) auto;gap:12px;padding:6.5px 0;border-top:1px solid #F0EBE1}
.map-page .entity-flow li:first-child{border-top:none;padding-top:0}
.map-page .entity-flow span{color:var(--muted);font-size:12.5px;font-weight:500;line-height:1.3}
.map-page .entity-flow strong{font-size:13.5px;font-weight:640;text-align:right;white-space:nowrap}
.map-page .entity-flow li.lead span{color:var(--ink)}
.map-page .entity-flow li.lead strong{font-size:16px;font-weight:670;letter-spacing:-.01em}
.map-page .entity-flow li.stacked{grid-template-columns:minmax(0,1fr);gap:4px}
.map-page .entity-flow li.stacked strong{text-align:left;white-space:normal;font-size:13.5px;font-weight:640;line-height:1.35}
@media(max-width:1040px){.map-page .grid-4{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:720px){.map-page main{padding:20px 14px 40px}.map-page .grid-2,.map-page .grid-4{grid-template-columns:1fr}.map-page .map-grid{grid-auto-rows:auto}.map-page .objective-target{margin-left:0}}
`;

const html = result.output_type === "review-object"
  ? renderReview(result)
  : result.output_type === "business-map" || Array.isArray(result.altitudes)
    ? renderBusinessMap(result)
    : result.output_type === "semantic-model"
      ? renderSemanticModel(result)
      : renderLegacy(result);
await writeFile(outputPath, html, "utf8");
console.error(`Rendered ${path.resolve(outputPath)}`);
