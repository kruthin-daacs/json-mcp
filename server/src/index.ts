import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { canvasIds, filterDimension, loadCanvas, loadCatalog, loadRecipe, resolvePath } from "./fixtures.js";

const jsonRecord = z.record(z.string(), z.json());
const audits = new Map<string, Record<string, unknown>>();

function resultBlock(output: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(output) }],
    structuredContent: output
  };
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown fixture error";
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

function rememberAudit(resultId: string, route: string[], input: Record<string, unknown>) {
  audits.set(resultId, {
    schema_version: "1.0",
    result_id: resultId,
    route,
    input,
    generated_at: new Date().toISOString()
  });
}

function createServer(): McpServer {
  const server = new McpServer({ name: "vedha-json-mcp", version: "0.1.0" });
  const canvasIdEnum = z.enum(canvasIds() as [string, ...string[]]);

  server.registerTool(
    "vedha_list_contexts",
    {
      title: "List Vedha contexts",
      description: "List the altitudes, workflows, and flows of the DataOrbit operating model (Atlas scope map). Call this first when scope is ambiguous.",
      outputSchema: jsonRecord,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false }
    },
    async () => resultBlock(await loadCatalog())
  );

  server.registerTool(
    "vedha_get_canvas",
    {
      title: "Get a Vedha canvas",
      description: "Read one workflow's bounded semantic model (goal, drivers, inputs, guardrails, funnel, entities, dimensions). Optionally narrow to one dimension and value.",
      inputSchema: z.object({
        canvas_id: canvasIdEnum,
        dimension: z.string().optional(),
        value: z.string().optional()
      }),
      outputSchema: jsonRecord,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false }
    },
    async ({ canvas_id, dimension, value }) => {
      try {
        const canvas = await loadCanvas(canvas_id);
        const resultId = `canvas:${canvas_id}:${dimension ?? "*"}:${value ?? "*"}`;
        const output = {
          schema_version: "1.0",
          result_id: resultId,
          scope: "canvas",
          canvas_id,
          goal: canvas.goal,
          drivers: canvas.drivers,
          inputs: canvas.inputs,
          guardrails: canvas.guardrails,
          funnel: canvas.funnel,
          entities: canvas.entities,
          dimensions: filterDimension(canvas.dimensions, dimension, value)
        };
        rememberAudit(resultId, ["canvas", canvas_id], { canvas_id, dimension, value });
        return resultBlock(output);
      } catch (error) {
        return failure(error);
      }
    }
  );

  server.registerTool(
    "vedha_get_diagnosis",
    {
      title: "Diagnose within a Vedha canvas",
      description: "Return the guardrails and a dimension breakdown for one canvas, to support a causal 'why' question. Thread-scoped: stays inside one canvas. Never use it for cross-canvas questions — escalate to vedha_get_atlas_review instead.",
      inputSchema: z.object({
        canvas_id: canvasIdEnum,
        dimension: z.string().min(1),
        value: z.string().optional()
      }),
      outputSchema: jsonRecord,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false }
    },
    async ({ canvas_id, dimension, value }) => {
      try {
        const canvas = await loadCanvas(canvas_id);
        const dimensions = filterDimension(canvas.dimensions, dimension, value);
        if (dimensions.length === 0) {
          throw new Error(`Dimension '${dimension}' is not defined on canvas '${canvas_id}'.`);
        }
        const resultId = `diagnosis:${canvas_id}:${dimension}:${value ?? "*"}`;
        const output = {
          schema_version: "1.0",
          result_id: resultId,
          scope: "thread",
          canvas_id,
          guardrails: canvas.guardrails,
          dimension: dimensions[0]
        };
        rememberAudit(resultId, ["thread", canvas_id, "diagnosis"], { canvas_id, dimension, value });
        return resultBlock(output);
      } catch (error) {
        return failure(error);
      }
    }
  );

  server.registerTool(
    "vedha_get_atlas_review",
    {
      title: "Run a Vedha Atlas review recipe",
      description: "Deterministically compose an Atlas-level review by walking a named recipe's steps, resolving each step's declared field reads against the named canvases. Use for cross-canvas/cross-altitude reviews (e.g. the Monthly Business Review). Fill each step's emits_template from the returned resolved values only — never invent a value not present in `resolved`.",
      inputSchema: z.object({
        skill_id: z.literal("mbr_review"),
        step: z.number().int().min(1).max(6).optional()
      }),
      outputSchema: jsonRecord,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false }
    },
    async ({ skill_id, step }) => {
      try {
        const recipe = await loadRecipe(skill_id);
        const order = (recipe.assembly.order as number[]) ?? recipe.steps.map((s) => s.step);
        const stepsToRun = recipe.steps
          .filter((s) => !step || s.step === step)
          .sort((a, b) => order.indexOf(a.step) - order.indexOf(b.step));

        const canvasCache = new Map<string, Awaited<ReturnType<typeof loadCanvas>>>();
        const resolvedSteps = [];
        for (const s of stepsToRun) {
          const resolved: Record<string, unknown> = {};
          for (const read of s.reads) {
            if (!canvasCache.has(read.workflow)) {
              canvasCache.set(read.workflow, await loadCanvas(read.workflow));
            }
            const canvas = canvasCache.get(read.workflow)!;
            for (const field of read.fields) {
              resolved[`${read.workflow}.${field}`] = resolvePath(canvas, field);
            }
          }
          resolvedSteps.push({
            step: s.step,
            section: s.section,
            heading_source: s.heading_source,
            model_scope: s.model_scope,
            insight_pattern: s.insight_pattern,
            constructed_question: s.constructed_question,
            emits_template: s.emits_template,
            resolved
          });
        }

        const resultId = `atlas:${skill_id}:${step ?? "all"}`;
        const output = {
          schema_version: "1.0",
          result_id: resultId,
          scope: "atlas",
          skill_id,
          object: recipe.assembly.object,
          steps: resolvedSteps
        };
        rememberAudit(
          resultId,
          ["atlas", skill_id, ...stepsToRun.flatMap((s) => s.reads.map((r) => r.workflow))],
          { skill_id, step }
        );
        return resultBlock(output);
      } catch (error) {
        return failure(error);
      }
    }
  );

  server.registerTool(
    "vedha_get_audit",
    {
      title: "Get result audit",
      description: "Explain which canvases and route produced a result returned earlier in this session.",
      inputSchema: z.object({ result_id: z.string().min(1) }),
      outputSchema: jsonRecord,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false }
    },
    async ({ result_id }) => {
      const audit = audits.get(result_id);
      return audit ? resultBlock(audit) : failure(new Error(`No audit found for result '${result_id}' in this MCP session.`));
    }
  );

  return server;
}

void serveStdio(createServer);
console.error("Vedha JSON MCP running on stdio");
