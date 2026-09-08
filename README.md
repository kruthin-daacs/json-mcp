# Vedha JSON MCP

A fixture-backed, read-only MCP and Claude skill for discovering Vedha access patterns before connecting a production data backend.

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

For Cowork, build the server first, then install this directory as a custom plugin in Claude Desktop. Local plugin MCP servers require the desktop application.

## Boundaries

- `fixtures/` is source evidence and is read only through MCP tools.
- `skills/` contains routing and visualization policy, not business facts.
- `runs/` contains generated `request.json`, `result.json`, `audit.json`, and `index.html`.
- The MCP accepts known canvas IDs and never accepts arbitrary filesystem paths.

## MCP tools

- `vedha_list_contexts` — the DataOrbit altitude/workflow/flow tree
- `vedha_get_canvas` — one workflow's semantic model (`revenue_accounting`, `cash_accounting`, `new_business`, `retention`, `expansion`, `churn_engine`)
- `vedha_get_diagnosis` — guardrails + a dimension breakdown, within one canvas (Thread scope)
- `vedha_get_atlas_review` — deterministically composes a cross-canvas review from the `mbr_review` recipe (Atlas scope)
- `vedha_get_audit` — replay which canvases/route produced a prior result
# json-mcp
