# Scope rules

| Signal | Scope | Behavior |
|---|---|---|
| Company-wide, business review, or multiple functions | Atlas | Call `vedha_get_atlas_review` (`skill_id: "mbr_review"`) |
| Current state of one workflow or metric | Canvas | Fetch one canvas with `vedha_get_canvas` |
| Why, driver, cause, or which intervention worked | Thread | Call `vedha_get_diagnosis` within the active canvas |
| Comparison with another workflow | Atlas escalation | Explain the escalation and call `vedha_get_atlas_review` or an additional `vedha_get_canvas` |
| How was this computed? | Audit | Call `vedha_get_audit` with cited result IDs |

The six canvases: `revenue_accounting`, `cash_accounting` (Finance altitude); `new_business`, `retention`, `expansion`, `churn_engine` (Revenue Levers altitude).

When scope is ambiguous, call `vedha_list_contexts` and say which interpretation you selected.
