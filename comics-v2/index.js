// ============================================================================
// comics-v2 / index.js
// ----------------------------------------------------------------------------
// Barrel export for the new Comics domain model (Phase 1 — foundation only).
//
// This file is loaded by index.html as an independent <script type="module">
// alongside app.js. It does NOT touch app.js, does NOT render any UI, and
// does NOT run any Firestore writes on its own. Loading it does exactly one
// thing automatically: attaches `window.__comicsV2` so a developer/admin can
// verify the foundation from the browser console, e.g.:
//
//   await __comicsV2.selfTest()
//
// Nothing here executes on page load beyond that assignment — no reads, no
// writes, no visible change to the site.
// ============================================================================
import * as schema from "./schema.js";
import * as slug from "./slug.js";
import * as data from "./data.js";
import { COLLECTIONS } from "./schema.js";
import { collectionIsReachable, upsertEntity, upsertCollectionEdition } from "./data.js";
import { dataset as batmanNew52Dataset, validateDataset as validateBatmanNew52, importDataset as importBatmanNew52Dataset } from "./seed-batman-new52.js";

/* ---------------------------------------------------------------------------
   Foundation self-test — the "minimal developer utility necessary to verify
   it works" (Step 20). Three parts, none of which write anything:
     1. ID builders round-trip against the exact example IDs from the spec.
     2. Every default-shape factory produces an object its own validator
        accepts.
     3. Each new collection is reachable with a 1-doc, read-only probe (they
        will legitimately come back empty — Phase 1 populates no real data).
--------------------------------------------------------------------------- */
export async function selfTest() {
  const results = [];
  const record = (name, pass, detail) => results.push({ name, pass, detail: detail || "" });

  // ---- 1. ID builders ----
  const idChecks = [
    ["buildSeriesId",       slug.buildSeriesId("Batman", 2011),                          "batman-2011"],
    ["buildRunId",          slug.buildRunId("batman-2011", "Snyder / Capullo"),           "batman-2011-snyder-capullo"],
    ["buildStoryId",        slug.buildStoryId("batman-2011", "Court of Owls"),            "batman-2011-court-of-owls"],
    ["buildIssueId (plain)",slug.buildIssueId("batman-2011", "1"),                        "batman-2011-001"],
    ["buildIssueId (dec.)", slug.buildIssueId("batman-2011", "23.1"),                     "batman-2011-23-1"],
    ["buildIssueId (label)",slug.buildIssueId("batman-2011", "Annual"),                   "batman-2011-annual"],
    ["buildCollectionId",   slug.buildCollectionId("Batman Vol. 1: Court of Owls"),        "batman-vol-1-court-of-owls"],
  ];
  idChecks.forEach(([name, got, want]) => record(`id: ${name}`, got === want, `got "${got}", want "${want}"`));

  // ---- 2. Shape factories vs. their own validators ----
  const shapeChecks = [
    ["Universe",   schema.makeUniverse({ id: "test-universe", name: "Test Universe" }), schema.validateUniverse],
    ["Continuity", schema.makeContinuity({ id: "test-cont", name: "Test Continuity" }), schema.validateContinuity],
    ["Character",  schema.makeCharacter({ id: "test-char", name: "Test Character" }), schema.validateCharacter],
    ["Series",     schema.makeSeries({ id: "test-series", title: "Test Series" }), schema.validateSeries],
    ["Run",        schema.makeRun({ id: "test-run", seriesId: "test-series" }), schema.validateRun],
    ["Story",      schema.makeStory({ id: "test-story", title: "Test Story" }), schema.validateStory],
    ["Issue",      schema.makeIssue({ id: "test-issue", seriesId: "test-series", issueNumber: "1" }), schema.validateIssue],
    ["Collection", schema.makeCollection({ id: "test-collection", title: "Test Collection", issueCoverage: [{ issueId: "test-issue", coveragePart: "complete" }] }), schema.validateCollection],
    ["Creator",    schema.makeCreator({ id: "test-creator", name: "Test Creator" }), schema.validateCreator],
    ["Relationship", schema.makeRelationship({ id: "test-rel", sourceId: "a", sourceType: "story", relationshipType: "sequel_to", targetId: "b", targetType: "story" }), schema.validateRelationship],
    ["ReadingPath", schema.makeReadingPath({ id: "test-path", pathType: "essential", title: "Test Path", entries: [{ order: 1, entityType: "issue", entityId: "test-issue" }] }), schema.validateReadingPath],
  ];
  shapeChecks.forEach(([name, obj, validate]) => {
    const { valid, errors } = validate(obj);
    record(`shape: ${name}`, valid, valid ? "" : errors.join("; "));
  });

  // ---- 3. Collections reachable (read-only, empty is fine) ----
  for (const name of Object.values(COLLECTIONS)) {
    const ok = await collectionIsReachable(name);
    record(`collection reachable: ${name}`, ok);
  }

  const passed = results.filter(r => r.pass).length;
  const failed = results.length - passed;
  console.table(results.map(r => ({ check: r.name, pass: r.pass, detail: r.detail })));
  console.log(`[comics-v2] self-test: ${passed} passed, ${failed} failed`);
  return { passed, failed, results };
}

/* ---------------------------------------------------------------------------
   PHASE 2 — New 52 Batman dataset (comics-v2/seed-batman-new52.js).
   Read-only inspection (`batmanNew52.dataset`, `batmanNew52.validate()`) never
   writes anything. The actual import is an explicit opt-in call
   (`await __comicsV2.batmanNew52.import()`) so nothing is written just by
   loading this module on every page load.
--------------------------------------------------------------------------- */
const batmanNew52 = {
  dataset: batmanNew52Dataset,
  validate: validateBatmanNew52,
  import: () => importBatmanNew52Dataset({ upsertEntity, upsertCollectionEdition, COLLECTIONS }),
};

window.__comicsV2 = { schema, slug, data, COLLECTIONS, selfTest, batmanNew52 };
