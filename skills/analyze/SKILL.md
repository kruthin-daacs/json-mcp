---
name: analyze
description: Analyze company metrics through Vedha fixture tools and create an evidence-backed JSON and HTML report. Use for business reviews, canvas questions, metric diagnosis, and audit questions.
---

# Vedha analysis

The operating model has three altitudes: **Finance** (Revenue, Cash — roll-up equations), **Revenue Levers** (New Business, Retention, Expansion, Churn — the bowtie, each a VP-owned workflow), and **Flows** (the operational steps under each lever). Each altitude/workflow is a **canvas**: `revenue_accounting`, `cash_accounting`, `new_business`, `retention`, `expansion`, `churn_engine`. Call `vedha_list_contexts` to see the full altitude tree.

Resolve the request as one of these scopes:

- **Atlas**: company-wide or cross-canvas review (e.g. the Monthly Business Review). Call `vedha_get_atlas_review` with `skill_id: "mbr_review"` — it deterministically walks the recipe's 6 steps and returns each step's declared field reads already resolved from the named canvases. Fill each step's `emits_template` using only values present in `resolved`; never invent a value the tool did not return.
- **Canvas**: bounded question within one workflow (`goal`, `drivers`, `inputs`, `guardrails`, `funnel`, `entities`, `dimensions`). Call `vedha_get_canvas` once, optionally narrowing with `dimension`/`value`.
- **Thread**: causal or follow-up "why" question inside one canvas. Call `vedha_get_diagnosis` with a `dimension` (and optional `value`) to get the guardrails plus that dimension's breakdown as evidence.

## Rules

1. Obtain every metric, value, definition, and causal claim from a `vedha_*` MCP tool.
2. Never read or modify files under `fixtures/` directly.
3. Never invent missing data. State that fixture evidence is unavailable.
4. Escalate a Canvas or Thread request to Atlas when it crosses canvases — call `vedha_get_atlas_review` (or make an additional `vedha_get_canvas` call and say so) instead of guessing.
5. Follow [scope-rules.md](scope-rules.md) and [chart-rules.md](chart-rules.md).
6. Write one scenario directory under `runs/<scenario-id>/` containing `request.json`, `result.json`, `audit.json`, and `index.html`.
7. Ensure `result.json` conforms to `schemas/analysis-result.schema.json`.
8. Put every MCP `result_id` used in `result.json.evidence` and `audit.json`.
9. Generate HTML by running `npm run render -- runs/<scenario-id>/result.json runs/<scenario-id>/index.html`.

Use the scenario ID supplied by the user. If none is supplied, use a short lowercase identifier derived from the request.
