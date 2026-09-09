---
name: analyze
description: Route business questions through Vedha MCP fixtures with explicit Atlas, Canvas, and Thread scope. Use for company reviews, bounded workflow questions, metric diagnosis, and audit questions.
---

# Vedha analysis

The operating model has three altitudes: **Finance** (Revenue, Cash — roll-up equations), **Revenue Levers** (New Business, Retention, Expansion, Churn — the bowtie, each a VP-owned workflow), and **Flows** (the operational steps under each lever). Each altitude/workflow is a **canvas**: `revenue_accounting`, `cash_accounting`, `new_business`, `retention`, `expansion`, `churn_engine`. Call `vedha_list_contexts` to see the full altitude tree.

Resolve the request as one of these scopes:

- **Atlas orientation**: for "show me the business map," call `vedha_list_contexts` and follow the `business-map` skill. Do not call Canvas, diagnosis, or review-query tools.
- **Atlas review**: for a Monthly Business Review request, follow the `mbr-view` approval flow. First call `vedha_get_review_plan`; call `vedha_get_atlas_review` only after the user explicitly approves the plan.
- **Canvas**: bounded question within one workflow (`goal`, `drivers`, `inputs`, `guardrails`, `funnel`, `entities`, `dimensions`). Call `vedha_get_canvas` once, optionally narrowing with `dimension`/`value`.
- **Thread**: causal or follow-up "why" question inside one canvas. Call `vedha_get_diagnosis` with a `dimension` (and optional `value`) to get the guardrails plus that dimension's breakdown as evidence.

## Rules

1. Obtain every metric, value, definition, and causal claim from a `vedha_*` MCP tool.
2. Never read or modify files under `fixtures/` directly.
3. Never invent missing data. State that fixture evidence is unavailable.
4. Escalate a Canvas or Thread request to Atlas when it crosses canvases — call `vedha_get_atlas_review` (or make an additional `vedha_get_canvas` call and say so) instead of guessing.
5. A semantic-model request is metadata, not analysis. Call `vedha_get_semantic_model` and list only entity, activity, goal metric, dimensions, and input measure names. Never show metric values, targets, statuses, or deltas.
6. Never execute an MBR query before explicit approval in the current conversation. "Run my business review" means present the plan; "Go ahead," "Approve," or an equivalent unambiguous confirmation means execute the pending plan.
7. Follow [scope-rules.md](scope-rules.md). Use `chart-rules.md` only for non-MBR query outputs; MBR visualization judgment belongs to the `mbr-view` skill.
8. When the user requests an artifact, write one scenario directory under `runs/<scenario-id>/` containing `request.json`, `result.json`, `audit.json`, and `index.html`.
9. An MBR `result.json` must conform to `schemas/review-object.schema.json`; other outputs use `schemas/analysis-result.schema.json`.
10. Put every MCP `result_id` used in `result.json.evidence` and `audit.json`.
11. Generate HTML by running `node "${CLAUDE_PLUGIN_ROOT}/scripts/render-report.mjs" runs/<scenario-id>/result.json runs/<scenario-id>/index.html`.

Use the scenario ID supplied by the user. If none is supplied, use a short lowercase identifier derived from the request.
