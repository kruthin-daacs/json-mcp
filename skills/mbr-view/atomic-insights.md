# Atomic insight subset for MBR

This reference is derived only from the final Atomic Insight Library v4 supplied for this implementation. Atom names describe analytical operations, not chart types.

| Atom | Operation | Required inputs | MBR selection rule |
|---|---|---|---|
| `A1` | Value (Quantity) | `value`, `unit` | Establish current state. Always followed by `A2`, `A3`, or `A4`. |
| `A2` | Target / Threshold | `value`, `target` | Internal goal pass/fail only. Always follows `A1`. |
| `A3` | Delta (Change) | `value`, `value_prior` | One current-to-prior change. Do not use without a prior value. |
| `A4` | Silent / Zero-Activity Census | `provisioned`, `active`, `value_per_entity`, `prior_silent_share` | Inactivity risk against a known population. |
| `D1` | Comparison (Peer) | `value_a`, `value_b` | A deliberate two-measure or two-entity comparison. |
| `E1` | Dimensional Contribution | `total`, all dimensional `members` | Members partition a total by group-by. Not a metric-tree decomposition. |
| `E4` | Structural Contribution | `parent`, formula `children`, `operator` | Exact metric identity at the current level. Additive children use plain part-of-whole. |
| `E5` | Structural Change Bridge | current and prior formula `children`, `operator` | Operator-aware bridge from prior to current. Additive identities have no interaction term. |
| `G2` | Root Cause Path | `outcome_delta`, `candidates`, `metric_tree` | Final causal narrative; emits a decision. `candidate` unless controlled evidence confirms it. |
| `H1` | Stage Conversion | ordered `stage_counts` | First funnel atom. Counts, not formatted prose or unrelated money values. |

Important distinctions:

- A KPI tile is `A1 + A3`; a gauge or progress-to-goal is `A2`.
- A waterfall or change bridge is `E5`. An additive formula-level current decomposition is `E4`.
- `E1` asks which dimension member owns a total. `E4` asks how a metric decomposes down its definition.
- `G1` causal impact requires an isolated intervention with a control or defensible before/after design. Do not use ordinary co-movement as causality.
