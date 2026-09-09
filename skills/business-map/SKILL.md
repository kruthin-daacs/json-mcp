---
name: business-map
description: Present the Vedha Atlas business map or a value-free semantic model. Use when the user asks to see the business map, operating model, Atlas map, semantic model, model behind a review plan, entities, activities, dimensions, or input measures.
---

# Business map and semantic model

This skill is orientation only. It never performs business analysis and never runs the MBR query.

## Business map

For "show me the business map":

1. Call `vedha_list_contexts` once.
2. Present the returned structure in altitude order.
3. Under each altitude, show workflow or flow nodes with only:
   - Node name
   - Goal metric name
   - Owner and cadence when returned
   - Parent workflow and activity steps for a flow when returned
4. If an HTML artifact is requested, save the MCP result JSON and render it with `node "${CLAUDE_PLUGIN_ROOT}/scripts/render-report.mjs" <result.json> <index.html>`.

Do not call `vedha_get_canvas`, `vedha_get_diagnosis`, or `vedha_get_atlas_review` for this request.

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

- Never display metric values, targets, thresholds, current state, status, percentages, currency amounts, counts, or deltas.
- Never display internal recipe sections, canvas IDs, atom IDs, insight patterns, routes, result IDs, or schema names.
- Never apply the Atomic Insight Library to orientation or semantic-model output.
- Never infer labels that are not returned by the MCP tool.
- Categorical dimension members may be listed exactly as encoded; they are labels, not query values.

The output is a deterministic map or list of encoded metadata. It is not an insight view.
