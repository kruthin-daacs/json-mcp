import { readFile } from "node:fs/promises";
import path from "node:path";

export type Filters = Record<string, string | number | boolean>;

export interface Canvas {
  canvas_id: string;
  measures: Record<string, Record<string, unknown>>;
  goal: Record<string, unknown>;
  drivers: Array<Record<string, unknown>>;
  inputs: Array<Record<string, unknown>>;
  guardrails: Array<Record<string, unknown>>;
  funnel: Array<Record<string, unknown>>;
  entities: Array<Record<string, unknown>>;
  dimensions: Array<{ name: string; values: string[]; breakdown: Array<Record<string, unknown>> }>;
}

export interface RecipeStep {
  step: number;
  section: string;
  heading_source: string;
  scenario: string;
  model_scope: string[];
  insight_pattern: string;
  plan_question: string;
  constructed_question: Record<string, unknown>;
  reads: Array<{ workflow: string; fields: string[] }>;
  emits_template: string;
}

export interface Recipe {
  skill_id: string;
  recipe_version: string;
  name: string;
  description: string;
  cadence: string;
  objective: Record<string, unknown>;
  key_results: Array<Record<string, unknown>>;
  patterns: Record<string, string>;
  steps: RecipeStep[];
  assembly: Record<string, unknown>;
}

const ALLOWED_FIXTURES: Record<string, string> = {
  revenue_accounting: "revenue_accounting.json",
  cash_accounting: "cash_accounting.json",
  new_business: "new_business.json",
  retention: "retention.json",
  expansion: "expansion.json",
  churn_engine: "churn_engine.json"
};

const ALLOWED_RECIPES: Record<string, string> = {
  mbr_review: "mbr_review.json"
};

const WORKFLOW_NAMES: Record<string, string> = {
  revenue_accounting: "Revenue",
  cash_accounting: "Cash",
  new_business: "New Revenue",
  retention: "Retention Revenue",
  expansion: "Expansion Revenue",
  churn_engine: "Churn Revenue"
};

function fixturesDir(): string {
  return process.env.VEDHA_FIXTURES_DIR ?? path.resolve(process.cwd(), "fixtures");
}

async function readJson<T>(filename: string): Promise<T> {
  const raw = await readFile(path.join(fixturesDir(), filename), "utf8");
  return JSON.parse(raw) as T;
}

export async function loadCatalog(): Promise<Record<string, unknown>> {
  return readJson<Record<string, unknown>>("catalog.json");
}

export function canvasIds(): string[] {
  return Object.keys(ALLOWED_FIXTURES);
}

export async function loadCanvas(canvasId: string): Promise<Canvas> {
  const filename = ALLOWED_FIXTURES[canvasId];
  if (!filename) {
    throw new Error(`Unknown canvas '${canvasId}'. Use vedha_list_contexts to discover valid canvases.`);
  }
  const raw = await readJson<Record<string, Record<string, unknown>>>(filename);
  const body = raw[canvasId] as Omit<Canvas, "canvas_id">;
  return { canvas_id: canvasId, ...body };
}

export async function loadRecipe(skillId: string): Promise<Recipe> {
  const filename = ALLOWED_RECIPES[skillId];
  if (!filename) {
    throw new Error(`Unknown recipe '${skillId}'. Only 'mbr_review' is available.`);
  }
  return readJson<Recipe>(filename);
}

export async function loadSemanticModels(selectedCanvasIds: string[] = canvasIds()) {
  return Promise.all(selectedCanvasIds.map(async (canvasId) => {
    const canvas = await loadCanvas(canvasId);
    return {
      canvas_id: canvasId,
      workflow: WORKFLOW_NAMES[canvasId],
      entity: canvas.entities.map((item) => String(item.name)),
      activity: canvas.funnel.map((item) => String(item.stage)),
      goal_metric: String(canvas.goal.metric),
      dimensions: canvas.dimensions.map((dimension) => ({
        name: dimension.name,
        values: dimension.values
      })),
      input_measures: canvas.inputs.map((item) => String(item.metric))
    };
  }));
}

export function filterDimension(
  dimensions: Canvas["dimensions"],
  dimensionName?: string,
  value?: string
): Canvas["dimensions"] {
  let result = dimensions;
  if (dimensionName) {
    result = result.filter((dim) => dim.name === dimensionName);
  }
  if (value) {
    result = result.map((dim) => ({
      ...dim,
      breakdown: dim.breakdown.filter((row) => String(row.value) === value)
    }));
  }
  return result;
}

/**
 * Resolves dotted paths with optional array filters, e.g.
 * "guardrails[metric=AR Ageing].value" or "dimensions[name=health_tier].breakdown[value=red]".
 * Bracket contents may contain spaces but never a literal ".".
 */
export function resolvePath(source: unknown, fieldPath: string): unknown {
  const segments = fieldPath.split(".");
  let current: unknown = source;
  for (const segment of segments) {
    const match = segment.match(/^([A-Za-z_]+)(?:\[([A-Za-z_]+)=(.+)\])?$/);
    if (!match || current == null || typeof current !== "object") return undefined;
    const [, key, filterKey, filterValue] = match;
    current = (current as Record<string, unknown>)[key];
    if (filterKey && Array.isArray(current)) {
      current = current.find((item) => String((item as Record<string, unknown>)?.[filterKey]) === filterValue);
    }
  }
  return current;
}
