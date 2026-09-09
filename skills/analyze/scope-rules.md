# Scope rules

| Signal | Scope | Behavior |
|---|---|---|
| Show the business map / orientation | Atlas | Call `vedha_list_contexts`; present altitudes, workflow nodes, and goal metric names only |
| Run the business review | Atlas plan | Call `vedha_get_review_plan` with `recipe_id: "mbr_review"`; ask for approval and do not query |
| Go ahead / approve a pending review plan | Atlas execution | Call `vedha_get_atlas_review` with `recipe_id: "mbr_review"` |
| Show the semantic model | Metadata | Call `vedha_get_semantic_model`; suppress all values, targets, statuses, and deltas |
| Current state of one workflow or metric | Canvas | Fetch one canvas with `vedha_get_canvas` |
| Why, driver, cause, or which intervention worked | Thread | Call `vedha_get_diagnosis` within the active canvas |
| Comparison with another workflow | Atlas escalation | Explain the escalation and call `vedha_get_atlas_review` or an additional `vedha_get_canvas` |
| How was this computed? | Audit | Call `vedha_get_audit` with cited result IDs |

The six canvases: `revenue_accounting`, `cash_accounting` (Finance altitude); `new_business`, `retention`, `expansion`, `churn_engine` (Revenue Levers altitude).

When scope is ambiguous, call `vedha_list_contexts` and say which interpretation you selected. Approval applies only to the pending plan in the same conversation.
