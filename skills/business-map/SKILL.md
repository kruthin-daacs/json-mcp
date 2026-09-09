---
name: business-map
description: Present the Vedha Atlas business map (name, goal metric, current value, delta per node) or a value-free semantic model. Use when the user asks to see the business map, operating model, Atlas map, semantic model, model behind a review plan, entities, activities, dimensions, or input measures.
---

# Business map and semantic model

This skill is orientation only. It never performs business analysis and never runs the MBR query.

## Business map

For "show me the business map":

1. Call `vedha_list_contexts` once to get the altitude/workflow/flow structure.
2. Call `vedha_get_canvas` once for each distinct `canvas_id` referenced in that structure (the six canvases: `revenue_accounting`, `cash_accounting`, `new_business`, `retention`, `expansion`, `churn_engine`) to resolve each node's current value and delta. A flow node has no `canvas_id` of its own — resolve it from the canvas of the workflow named in its `under_workflow` field (same canvas as that workflow's node).
3. Present the returned structure in altitude order. Under each altitude, show each workflow or flow node with only these four fields, nothing else:
   - Name
   - Goal Metric
   - Current Value
   - Delta
4. Read Current Value and Delta **only** from the fixed fields below — never compute, estimate, or infer a number. These fields are precomputed and stored in the semantic JSON specifically so this lookup is deterministic:

   | Canvas | Goal Metric | Current Value field | Delta field |
   |---|---|---|---|
   | `revenue_accounting` | ARR | `measures.current_arr.display` | `measures.net_new_qtd.display` |
   | `cash_accounting` | Cash Collected | `measures.collected.display` | `measures.collected_delta_vs_billed.display` |
   | `new_business` | New ACV | `measures.current_acv.display` | `measures.acv_delta_vs_target.display` |
   | `retention` | NRR | `measures.nrr.display` | `measures.nrr_delta_vs_threshold.display` |
   | `expansion` | Expansion ARR | `measures.expansion_arr.display` | `measures.expansion_arr_delta_vs_floor.display` |
   | `churn_engine` | Minimised Lost ARR | `measures.lost_arr.display` | `measures.lost_arr_open_exposure.display` |

   A flow node's Goal Metric/Current Value/Delta are identical to its parent workflow's, since they share the same canvas.
5. If an HTML artifact is requested, assemble a merged JSON — the `vedha_list_contexts` altitude/workflow/flow structure, with each node reduced to `{ name, goal_metric, current_value, delta }` using the table above — save it, and render it with `node "${CLAUDE_PLUGIN_ROOT}/scripts/render-report.mjs" <result.json> <index.html>`.

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
- Show only Name, Goal Metric, Current Value, and Delta per node — never Owner, Cadence, Strategic/Operational type, Altitude labels/eyebrows, parent workflow references, or flow activity steps.
- Current Value and Delta must come only from the fixed fields in the table above. Never compute, estimate, round differently, or substitute a different field. Never mark a node's Delta as "not available" — every canvas has a defined field for it.
- Never display internal recipe sections, canvas IDs, atom IDs, insight patterns, routes, result IDs, or schema names.

Semantic model output (unchanged — still strictly value-free):
- Never display metric values, targets, thresholds, current state, status, percentages, currency amounts, counts, or deltas.
- Never display internal recipe sections, canvas IDs, atom IDs, insight patterns, routes, result IDs, or schema names.
- Never apply the Atomic Insight Library to orientation or semantic-model output.
- Never infer labels that are not returned by the MCP tool.
- Categorical dimension members may be listed exactly as encoded; they are labels, not query values.

The business map is a deterministic map of name/goal-metric/current-value/delta. The semantic model is a deterministic list of encoded metadata. Neither is an insight view.
