---
name: mbr-view
description: Turn the Vedha mbr_review recipe result into an evidence-backed Monthly Business Review JSON and polished HTML insight view using the atomic insights library. Use whenever the user asks for an MBR, monthly review, executive business review, or review-object presentation.
---

# Monthly Business Review view

This is a judgment and presentation skill. It does not define the business review's facts or traversal order.

- The **recipe** defines the six-step review architecture and declared data reads.
- The **MCP** resolves those reads from semantic JSON fixtures.
- This **skill** chooses atomic insights, frames the evidence, and presents the review.

## Five-prompt happy path

1. **Business map:** handled by the `business-map` skill using `vedha_list_contexts`.
2. **Run my business review:** call `vedha_get_review_plan` with `recipe_id: "mbr_review"`. Present the ordered plan and ask for approval. Do not call `vedha_get_atlas_review`, do not resolve values, and do not render the review.
3. **Show the semantic model behind this:** optional. Call `vedha_get_semantic_model` with the pending plan's semantic models. Present only the deterministic labels defined by the `business-map` skill, then ask for approval again.
4. **Go ahead:** only after an explicit approval in the same conversation, call `vedha_get_atlas_review` with `recipe_id: "mbr_review"`, construct the review-object, validate it, and render the HTML.
5. **Edit/drop a lever:** outside the current happy path. State that scope editing is not enabled in this version; do not silently alter the recipe or recompute numbers.

If "Go ahead" is received without a pending plan in the current conversation, present the plan first. Never treat the initial review request as approval.

## Plan presentation

Present exactly what `vedha_get_review_plan` returns:

- Review name and objective question.
- Each ordered review question.
- Semantic-model scope for each question, using user-facing workflow names.
- A final approval request: `Approve this plan? Reply "Go ahead" to run it, or ask to see the semantic model.`

The plan contains no query result, metric value, target, status, delta, finding, visualization, or recommendation. Do not use atomic insights during planning.

## Approved execution

1. Preserve all six recipe steps and their returned order. Do not add, remove, merge, or reorder sections.
2. Use only values in each step's `resolved` object. Use numeric `value` fields for computation and `display` fields for labels.
3. Choose atoms using [atomic-insights.md](atomic-insights.md). Atom IDs and typed inputs are authoritative internal metadata.
4. Produce `schemas/review-object.schema.json`. Every atom must cite the Atlas `result_id` in `evidence_result_ids`.
5. Validate with `node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-review.mjs" <result.json>` before rendering.
6. Render with `node "${CLAUDE_PLUGIN_ROOT}/scripts/render-report.mjs" <result.json> <index.html>`.

If working in chat without filesystem access, return the valid review-object JSON in a fenced block and then present the same six-section review in chat. Do not pretend an HTML artifact was created.

## Judgment rules

- Start a metric block with `A1`, then immediately add `A2`, `A3`, or `A4`. Never narrate `A1` alone.
- Use `A2` only for an internal target or threshold. Do not relabel a stage value such as billed cash as a target.
- Use `D1` for a deliberate comparison between two measures, such as collected versus billed.
- Use `E4` for an exact formula-level decomposition. For this fixture, current ARR is the additive identity `opening ARR + new + expansion + contraction + churn`.
- Use `E5` only when both current and prior formula children are returned. It is a change bridge; current-level contribution is `E4`. The MBR recipe returns `measures.arr_bridge` specifically for the ARR waterfall.
- Use `H1` only with ordered stage counts. Do not turn dollar values or prose funnel labels into stage counts.
- Use `G2` only when the outcome delta, candidate causes, and metric-tree path are present. Without controlled intervention evidence, mark its epistemic status `candidate`. Without all inputs, use a callout and explicitly say the causal explanation is not established.
- A decision may be a section callout rather than an atom. The atomic library is an analytical operation library, not a generic component catalog.
- Prefer one decisive visual per section. Use prose when the available facts do not satisfy an atom's typed input.
- Never infer a prior period, forecast, benchmark, threshold, causal effect, or missing denominator.

## Presentation rules

- Make the first viewport a compact executive review, not a landing page.
- Show title, period, cadence, executive summary, and the objective status first.
- Keep each recipe `section` identifier in `result.json` for ordering and validation, but never display internal section keys such as `objective`, `kr_finance`, or `causal_chain` in HTML. Display only the user-facing `heading` and `question`.
- Keep atomic taxonomy IDs such as `A1`, `A2`, `D1`, and `E5` in `result.json`, but never display them in HTML or user-facing prose.
- Use restrained operational styling, square-to-small radii, clear hierarchy, and accessible color plus text labels.
- Render signed contributions consistently: positive additions in green, negative drags in red, opening/current totals in neutral/blue.
- Keep evidence result IDs visible in a compact footer or details area.
- The same `result.json` must always render to the same HTML.

The renderer owns markup and CSS. Do not hand-author a different visualization implementation when `scripts/render-report.mjs` is available.
