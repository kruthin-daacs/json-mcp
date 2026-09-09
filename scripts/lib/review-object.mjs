const SECTION_ORDER = ["objective", "kr_finance", "kr_revenue", "kr_customer_journey", "causal_chain", "decision"];
const ATOMS = new Set(["A1", "A2", "A3", "A4", "D1", "E1", "E4", "E5", "G2", "H1"]);

function requireField(object, field, context, errors) {
  if (!Object.hasOwn(object, field) || object[field] === null || object[field] === "") {
    errors.push(`${context}.${field} is required`);
  }
}

function requireNumber(object, field, context, errors) {
  if (typeof object[field] !== "number" || !Number.isFinite(object[field])) {
    errors.push(`${context}.${field} must be a finite number`);
  }
}

function sum(values) {
  return Object.values(values ?? {}).reduce((total, value) => total + Number(value), 0);
}

export function validateReview(review) {
  const errors = [];
  if (!review || typeof review !== "object" || Array.isArray(review)) return ["review must be an object"];

  for (const field of ["schema_version", "output_type", "recipe_id", "recipe_version", "title", "period", "cadence", "executive_summary", "sections", "evidence", "warnings"]) {
    requireField(review, field, "review", errors);
  }
  if (review.schema_version !== "1.0") errors.push("review.schema_version must be 1.0");
  if (review.output_type !== "review-object") errors.push("review.output_type must be review-object");
  if (review.recipe_id !== "mbr_review") errors.push("review.recipe_id must be mbr_review");
  if (review.cadence !== "monthly") errors.push("review.cadence must be monthly");
  if (!Array.isArray(review.sections) || review.sections.length !== 6) {
    errors.push("review.sections must contain exactly six sections");
    return errors;
  }

  const evidenceIds = new Set(Array.isArray(review.evidence) ? review.evidence.map((item) => item?.result_id) : []);
  review.sections.forEach((section, index) => {
    const context = `review.sections[${index}]`;
    if (section.step !== index + 1) errors.push(`${context}.step must be ${index + 1}`);
    if (section.section !== SECTION_ORDER[index]) errors.push(`${context}.section must be ${SECTION_ORDER[index]}`);
    for (const field of ["heading", "question", "answer", "insights"]) requireField(section, field, context, errors);
    if (!Array.isArray(section.insights)) return;

    section.insights.forEach((insight, insightIndex) => {
      const atomContext = `${context}.insights[${insightIndex}]`;
      for (const field of ["id", "atom_id", "title", "sentence", "evidence_result_ids"]) requireField(insight, field, atomContext, errors);
      if (!ATOMS.has(insight.atom_id)) errors.push(`${atomContext}.atom_id is unsupported`);
      if (!Array.isArray(insight.evidence_result_ids) || insight.evidence_result_ids.length === 0) {
        errors.push(`${atomContext}.evidence_result_ids must not be empty`);
      } else {
        for (const id of insight.evidence_result_ids) if (!evidenceIds.has(id)) errors.push(`${atomContext} cites unknown evidence ${id}`);
      }

      if (insight.atom_id === "A1") {
        requireNumber(insight, "value", atomContext, errors);
        for (const field of ["unit", "display"]) requireField(insight, field, atomContext, errors);
        const next = section.insights[insightIndex + 1]?.atom_id;
        if (!["A2", "A3", "A4"].includes(next)) errors.push(`${atomContext} must be followed by A2, A3, or A4`);
      }
      if (insight.atom_id === "A2") {
        requireNumber(insight, "value", atomContext, errors);
        requireNumber(insight, "target", atomContext, errors);
        requireNumber(insight, "gap", atomContext, errors);
        if (Math.abs(insight.gap - (insight.value - insight.target)) > 1e-9) errors.push(`${atomContext}.gap must equal value - target`);
      }
      if (insight.atom_id === "A3") {
        requireNumber(insight, "value", atomContext, errors);
        requireNumber(insight, "value_prior", atomContext, errors);
      }
      if (insight.atom_id === "D1") {
        requireNumber(insight, "value_a", atomContext, errors);
        requireNumber(insight, "value_b", atomContext, errors);
        requireField(insight, "label_a", atomContext, errors);
        requireField(insight, "label_b", atomContext, errors);
      }
      if (insight.atom_id === "E4") {
        requireNumber(insight, "parent", atomContext, errors);
        if (insight.operator === "+" && Math.abs(sum(insight.children) - insight.parent) > 1e-9) errors.push(`${atomContext} additive children must reconcile to parent`);
      }
      if (insight.atom_id === "E5") {
        requireField(insight, "children", atomContext, errors);
        requireField(insight, "children_prior", atomContext, errors);
        requireField(insight, "change_bridge", atomContext, errors);
        if (insight.operator === "+") {
          const parentDelta = sum(insight.children) - sum(insight.children_prior);
          if (Math.abs(sum(insight.change_bridge) - parentDelta) > 1e-9) errors.push(`${atomContext} additive change_bridge must reconcile to parent change`);
        }
      }
    });
  });
  return errors;
}

export function assertValidReview(review) {
  const errors = validateReview(review);
  if (errors.length) throw new Error(`Invalid review-object:\n- ${errors.join("\n- ")}`);
}
