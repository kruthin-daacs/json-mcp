---
name: mbr-view
description: Turn the Vedha mbr_review recipe result into an evidence-backed Monthly Business Review JSON and polished HTML insight view using the atomic insights library. Use whenever the user asks for an MBR, monthly review, executive business review, or review-object presentation.
---

# Monthly Business Review view

This is a judgment and presentation skill. It does not define the business review's facts or traversal order.

- The **recipe** defines the six-step review architecture and declared data reads.
- The **MCP** resolves those reads from semantic JSON fixtures.
- This **skill** chooses atomic insights, frames the evidence, and presents the review.

## Required flow

1. Call `vedha_get_atlas_review` with `recipe_id: "mbr_review"`.
2. Preserve all six recipe steps and their returned order. Do not add, remove, merge, or reorder sections.
3. Use only values in each step's `resolved` object. Use numeric `value` fields for computation and `display` fields for labels.
4. Choose atoms using [atomic-insights.md](atomic-insights.md). Atom IDs and typed inputs are authoritative; do not rename an atom after a chart type.
5. Produce `schemas/review-object.schema.json`. Every atom must cite the Atlas `result_id` in `evidence_result_ids`.
6. Validate with `node "${CLAUDE_PLUGIN_ROOT}/scripts/validate-review.mjs" <result.json>` before rendering.
7. Render with `node "${CLAUDE_PLUGIN_ROOT}/scripts/render-report.mjs" <result.json> <index.html>`.

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
- Use restrained operational styling, square-to-small radii, clear hierarchy, and accessible color plus text labels.
- Render signed contributions consistently: positive additions in green, negative drags in red, opening/current totals in neutral/blue.
- Keep evidence result IDs visible in a compact footer or details area.
- The same `result.json` must always render to the same HTML.

The renderer owns markup and CSS. Do not hand-author a different visualization implementation when `scripts/render-report.mjs` is available.
