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
  const server = new McpServer({ name: "vedha-json-mcp", version: "0.2.0" });
  const canvasIdEnum = z.enum(canvasIds() as [string, ...string[]]);

  server.registerTool(
    "vedha_list_contexts",
    {
      title: "List Vedha contexts",
      description: "List the altitudes, workflows, and flows of the DataOrbit operating model (Atlas scope map). Call this first when scope is ambiguous.",
      outputSchema: jsonRecord,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false }
    },
    async () => {
      const resultId = "context:dataorbit:v1";
      const output = {
        schema_version: "1.0",
        result_id: resultId,
        scope: "atlas",
        ...(await loadCatalog())
      };
      rememberAudit(resultId, ["atlas", "catalog"], {});
      return resultBlock(output);
    }
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
          measures: canvas.measures,
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
      description: "Deterministically execute an Atlas-level recipe by resolving each declared field read against the named canvases. Use for cross-canvas reviews such as the Monthly Business Review. This tool supplies facts and review structure; the MBR presentation skill selects atomic insights and renders them.",
      inputSchema: z.object({
        recipe_id: z.literal("mbr_review").optional(),
        skill_id: z.literal("mbr_review").optional().describe("Deprecated alias for recipe_id."),
        step: z.number().int().min(1).max(6).optional()
      }),
      outputSchema: jsonRecord,
      annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false }
    },
    async ({ recipe_id, skill_id, step }) => {
      try {
        const recipeId = recipe_id ?? skill_id;
        if (!recipeId) throw new Error("recipe_id is required.");
        const recipe = await loadRecipe(recipeId);
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

        const resultId = `atlas:${recipeId}:${step ?? "all"}`;
        const output = {
          schema_version: "1.0",
          result_id: resultId,
          scope: "atlas",
          recipe_id: recipeId,
          recipe_version: recipe.recipe_version,
          recipe_name: recipe.name,
          cadence: recipe.cadence,
          objective: recipe.objective,
          key_results: recipe.key_results,
          object: recipe.assembly.object,
          assembly: recipe.assembly,
          steps: resolvedSteps
        };
        rememberAudit(
          resultId,
          ["atlas", recipeId, ...stepsToRun.flatMap((s) => s.reads.map((r) => r.workflow))],
          { recipe_id: recipeId, step }
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
