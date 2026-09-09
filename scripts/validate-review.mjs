import { readFile } from "node:fs/promises";
import { assertValidReview } from "./lib/review-object.mjs";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: npm run validate:review -- <result.json>");
  process.exit(1);
}

const review = JSON.parse(await readFile(inputPath, "utf8"));
assertValidReview(review);
console.log(`Valid review-object: ${inputPath}`);
