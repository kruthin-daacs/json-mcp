# Vedha JSON MCP

A fixture-backed, read-only MCP plus Claude skills for discovering Vedha access patterns before connecting a production data backend.

## Architecture

- `fixtures/mbr_review.json` is the **recipe**: six fixed review steps and declared semantic reads.
- The `vedha_get_atlas_review` MCP tool is the **fact layer**: it resolves recipe reads from JSON fixtures and returns evidence IDs.
- `skills/mbr-view/` is the **judgment layer**: it selects typed operations from Atomic Insight Library v4 and frames the review.
- `scripts/render-report.mjs` is the **deterministic presentation layer**: it renders a validated review-object to HTML.
- `skills/business-map/` owns value-free Atlas orientation and semantic-model presentation.

## Setup

Requires Node.js 20 or newer.

```bash
npm install
npm run build
npm test
```

Test as a local Claude Code plugin:

```bash
claude --plugin-dir .
```

Then ask Claude to run a scenario, for example:

```text
/vedha-playground:analyze Run scenario T1: why is mid-market churning?
```

For an MBR demo:

```text
1. Show me the business map.
2. Run my business review.
3. Show me the semantic model behind this. (Optional.)
4. Go ahead.
```

For Cowork, build the server first, then install this directory as a custom plugin in Claude Desktop. Local plugin MCP servers require the desktop application.

## Boundaries

- `fixtures/` is source evidence and is read only through MCP tools.
- `skills/analyze/` owns scope routing, `skills/business-map/` owns orientation, and `skills/mbr-view/` owns the approval-gated MBR judgment flow. None contains business facts.
- `runs/` contains generated `request.json`, `result.json`, `audit.json`, and `index.html`.
- The MCP accepts known canvas IDs and never accepts arbitrary filesystem paths.

## MCP tools

- `vedha_list_contexts` — the DataOrbit altitude/workflow/flow tree
- `vedha_get_semantic_model` — value-free labels for entities, activities, goal metrics, dimensions, and input measures
- `vedha_get_review_plan` — query-free MBR questions and semantic-model scope for human approval
- `vedha_get_canvas` — one workflow's semantic model (`revenue_accounting`, `cash_accounting`, `new_business`, `retention`, `expansion`, `churn_engine`)
- `vedha_get_diagnosis` — guardrails + a dimension breakdown, within one canvas (Thread scope)
- `vedha_get_atlas_review` — deterministically executes the `mbr_review` recipe and returns resolved cross-canvas facts (Atlas scope)
- `vedha_get_audit` — replay which canvases/route produced a prior result

## MBR validation and rendering

```bash
npm run validate:review -- examples/mbr-review-object.json
npm run render -- examples/mbr-review-object.json runs/A1/index.html
```

`schemas/review-object.schema.json` defines the six-section MBR contract. `schemas/atomic-insight.schema.json` defines the supported v4 atom payloads, and `scripts/lib/review-object.mjs` enforces ordering and computation invariants before HTML is written.

Internal recipe section keys and Atomic Insight Library IDs remain in JSON for validation, but neither is rendered in user-facing HTML.
# json-mcp
