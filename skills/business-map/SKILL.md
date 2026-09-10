---
name: business-map
description: Present the Vedha Atlas business map (three altitudes — Finance, Revenue Levers, Flows) or a value-free semantic model. Workflow nodes show goal metric / current value / delta; flow nodes show their entity-flow (how work moves through the flow). Use when the user asks to see the business map, operating model, Atlas map, semantic model, model behind a review plan, entities, activities, dimensions, or input measures.
---

# Business map and semantic model

This skill is orientation only. It never performs business analysis and never runs the MBR query. It is a **pure presentation skill**: every number is read from a fixed MCP field — never computed, estimated, inferred, or baked into this file.

## Business map

For "show me the business map":

1. Call `vedha_list_contexts` once to get the altitude / workflow / flow structure.
2. Call `vedha_get_canvas` once for each of the six canvases — `revenue_accounting`, `cash_accounting`, `new_business`, `retention`, `expansion`, `churn_engine` — to resolve each node's fields. A flow node has no `canvas_id` of its own — resolve it from the canvas of the workflow named in its `under_workflow` field (same canvas as that workflow's node).
3. Present in altitude order — **three altitudes: Finance · Revenue Levers · Flows**. Graphical layout: each altitude is a band; **Revenue Levers and Flows use the same four columns, so each flow sits directly under its lever** (same workflow, two faces). No labels beyond the band name and the card contents below.
4. Node content differs by altitude — this is the important change:
   - **Finance & Revenue Levers (workflow nodes)** → four fields only: **Name · Goal Metric · Current Value · Delta.** Read Current Value and Delta only from the **workflow fields** table.
   - **Flows (flow nodes)** → **Name + an entity-flow summary** (the ordered operational measures showing how work moves through the flow — e.g. amounts at stages, counts, the top at-risk / slipping item). A flow node must **NOT** repeat its lever's goal metric / value / delta. Read only from the **flow fields** table.
5. **Warm state:** each workflow and flow node in `vedha_list_contexts` carries a precomputed `state` (`nominal` | `warm` | `critical`), derived upstream from **active at-risk exposure only** — a red-tier ARR amount on the node's canvas together with a named open item (`{ account, deadline }`) falling inside that canvas's action window, i.e. the `red_tier_arr` + `open_renewal` signal. State deliberately does **not** flag below-plan or below-target pace: pace against the objective is already carried by the objective banner, and pace against target by each card's Delta, so state exists to surface the one thing neither of those shows — a live, actionable item. Copy `state` through verbatim and colour warm / critical cards accordingly (amber / red). The node's sibling `state_rule` records which comparison produced it — provenance only, never rendered. If `state` is absent, render as nominal. **Never derive state by computing a number**: the exposure logic belongs to the canvas / backend layer, not this skill.

### Workflow fields (Finance + Revenue Levers) — the goal metric

| Canvas | Goal Metric | Current Value field | Delta field |
|---|---|---|---|
| `revenue_accounting` | ARR | `measures.current_arr.display` | `measures.net_new_qtd.display` |
| `cash_accounting` | Cash Collected | `measures.collected.display` | `measures.collected_delta_vs_billed.display` |
| `new_business` | New ACV | `measures.current_acv.display` | `measures.acv_delta_vs_target.display` |
| `retention` | NRR | `measures.nrr.display` | `measures.nrr_delta_vs_threshold.display` |
| `expansion` | Expansion ARR | `measures.expansion_arr.display` | `measures.expansion_arr_delta_vs_floor.display` |
| `churn_engine` | Minimised Lost ARR | `measures.lost_arr.display` | `measures.lost_arr_open_exposure.display` |

### Flow fields (Flows) — the entity-flow summary

Each flow reads its **operational** measures from the **same canvas** as its parent workflow — a different set of fields than the goal metric. Emit the items in the order listed, each as `{ label, value }`: the **label** is the fixed string in the table, the **value** is the `display` string read from the fixed path. None of these fields is its lever's goal-metric field.

| Flow | Canvas (same as parent) | Entity-flow items, in order — `label` ← path |
|---|---|---|
| Lead-to-Cash | `new_business` | Pipeline coverage ← `measures.pipeline_coverage.display` · Win rate ← `measures.win_rate.display` |
| Renewal-to-Cash | `retention` | Renewal book due ← `measures.renewal_book.display` · At-risk ARR ← `measures.red_tier_arr.display` · Top open renewal ← *composed, see below* |
| Quote-to-Cash | `expansion` | Expansion at renewal ← `measures.at_renewal.display` · Expansion in quarter ← `measures.in_quarter.display` |
| Risk-to-Resolution | `churn_engine` | Open at-risk ARR ← `measures.open_at_risk.display` · Save rate ← `measures.save_rate.display` |

**Top open renewal** is the one composed value. Join three fixed sub-fields of `retention.measures.open_renewal` in this exact order and format, with no other text:

```
<account> <display> · decision <deadline>
```

reading `measures.open_renewal.account`, `measures.open_renewal.display`, and `measures.open_renewal.deadline` — which yields `Meridian $0.8M · decision Dec 16`. Concatenating fixed fields is presentation; it is never a calculation. If any of the three is absent, omit the whole item rather than partially rendering it.

Read each entity-flow value **only** from these fixed paths — never compute or fabricate. Never substitute a lever's goal-metric field (`current_acv`, `nrr`, `expansion_arr`, `lost_arr`) into a flow, even when it is the closest available number. If a path is not present in the semantic JSON, it is a **backend addition** (add the operational measure to that canvas); the skill never invents the value and never falls back to the goal metric — it omits the item.

### Header fields — as-of caption and objective banner

Two top-level keys sit above the altitude bands. Both are fixed-field passthroughs.

| Merged JSON key | Read from | Renders as |
|---|---|---|
| `as_of` | `vedha_list_contexts` → `as_of` (`{ as_of, period, week }`), passed through verbatim | small caption under the title |
| `objective.metric` | the `revenue_accounting` row of the workflow fields table — the literal `ARR` | objective banner label |
| `objective.current` | `revenue_accounting` → `measures.current_arr.display` | banner hero figure |
| `objective.target` | `revenue_accounting` → `measures.target_arr.display` | banner objective figure |
| `objective.pace_display` | `revenue_accounting` → `goal.percent_to_target` | pace pill and bar width |

If `as_of` is absent from `vedha_list_contexts`, omit the key and the caption does not render — never substitute today's date or infer a period. Never compute `pace_display` from current ÷ target; it is a stored field. If it is absent, omit it and the bar does not render.

6. **HTML artifact:** assemble a merged JSON — top-level `as_of` and `objective` (see *Header fields*), then the `vedha_list_contexts` altitude/workflow/flow structure, with each **workflow node** reduced to `{ name, goal_metric, current_value, delta, state }` and each **flow node** reduced to `{ name, entity_flow: [ { label, value }, ... ], state }` (using the tables above) — save it, and render it with `node "${CLAUDE_PLUGIN_ROOT}/scripts/render-report.mjs" <result.json> <index.html>`. A flow node carries **no** `goal_metric`, `current_value`, or `delta` key at all; the presence of `entity_flow` is what makes the renderer draw a flow card. The renderer is pure presentation; it reads only the merged JSON and never computes.

Do not call `vedha_get_diagnosis` or `vedha_get_atlas_review` for this request.

## Semantic model

For "show me the semantic model behind this":

1. Call `vedha_get_semantic_model` with the canvas IDs from the pending review plan. If no plan is pending, use the scope explicitly named by the user; otherwise ask them to establish scope.
2. Preserve workflow order and list only these labels exactly as returned:
   - `entity`
   - `activity`
   - `goal_metric`
   - `dimensions`
   - `input_measures`
3. Do not generate interpretation, explanation, findings, persuasion, recommendations, or chart selection.
4. After showing the semantic model for a pending MBR plan, ask for approval again.

## Strict exclusions

Business map output:
- Show only **Name · Goal Metric · Current Value · Delta** for workflow nodes, and **Name + entity-flow** for flow nodes. Never show Owner (CFO, VP CS, etc.), Cadence, Strategic/Operational type, per-card altitude eyebrows (the band's own name above its row is the one permitted label), parent-workflow references, accounting-face labels ("accounting-ownership face", "operational-surface face"), banded explanations ("two workflows — revenue accounting ‖ cash accounting"), or any summary / call-to-action sentence ("1 warm workflow · start with …").
- **Flows must show the entity-flow measures, never the parent lever's goal metric / value / delta.** Levers and Flows must not display the same numbers.
- Current Value, Delta, and entity-flow items come only from the fixed fields above. Never compute, estimate, round differently, or substitute a different field. Never mark a node's Delta as "not available" — every workflow canvas has a defined field for it.
- Never display internal recipe sections, canvas IDs, atom IDs, insight patterns, routes, result IDs, or schema names.

Semantic model output (unchanged — still strictly value-free):
- Never display metric values, targets, thresholds, current state, status, percentages, currency amounts, counts, or deltas.
- Never display internal recipe sections, canvas IDs, atom IDs, insight patterns, routes, result IDs, or schema names.
- Never apply the Atomic Insight Library to orientation or semantic-model output.
- Never infer labels that are not returned by the MCP tool.
- Categorical dimension members may be listed exactly as encoded; they are labels, not query values.

The business map is a deterministic, graphical map: workflow nodes show name/goal-metric/current-value/delta; flow nodes show their entity-flow. The semantic model is a deterministic list of encoded metadata. Neither is an insight view.
