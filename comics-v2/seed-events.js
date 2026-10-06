// ============================================================================
// comics-v2 / seed-events.js — PHASE 5: additive, deterministic, idempotent, validation-first event import.
// Reads the ONE canonical definition (events-data.js; Flashpoint's catalogue bridge comes from flashpoint-core.js) and writes:
//   comicSeries / comicStories / comicIssues / comicCollections   the Flashpoint core bridge — CREATE-IF-ABSENT only, never overwritten
//   comicEvents/<id>                                              the Event records (a hand-verified event keeps its descriptive fields)
//   comicIssues/<id>.eventIds                                     membership — union with whatever is already there, repaired for EVERY event,
//                                                                 including events whose own document was skipped because it is verified
//   comicRelationships/<id>__sequel_to__<id>                      explicit event→event ordering edges
// It never deletes, never edits a Story, and never invents a record other than the Flashpoint core bridge. Anything it cannot resolve is REPORTED.
// Re-running converges: second run → every link "already present", nothing added.
// Reads per run: issues by id (ceil(n/30)), events by id (ceil(n/30)), bridge ids (ceil(n/30) per kind), plus a single-document fallback only for ids the
// batched query could not find (bounded by the number of planned ids; empty on a healthy catalogue).
// ============================================================================
import { COLLECTIONS, validateEvent, validateRelationship, validateSeries, validateStory, validateIssue, validateCollection } from "./schema.js";
import { buildIssueId } from "./slug.js";
import { buildEvents, buildEventRelationships, validateEventData, MEMBERS, NEW52_CONTINUITY_ID } from "./events-data.js?v=fp1";
import { buildFlashpointBridge } from "./flashpoint-core.js?v=fp1";

/** Pure: which issue ids does each event name, before anything is checked against the catalogue? */
export function plannedMembership() {
  const plan = {};
  for (const [eventId, specs] of Object.entries(MEMBERS)) {
    plan[eventId] = specs.flatMap(s => s.labels.map(label => ({ seriesId: s.seriesId, label, issueId: buildIssueId(s.seriesId, label) })));
  }
  return plan;
}

export function validateDataset() {
  const events = buildEvents(), rels = buildEventRelationships(), bridge = buildFlashpointBridge();
  const errs = [];
  events.forEach(ev => validateEvent(ev).errors.forEach(e => errs.push(`${ev.id}: ${e}`)));
  rels.forEach(r => validateRelationship(r).errors.filter(e => !/outside the starting set/.test(e)).forEach(e => errs.push(`${r.id}: ${e}`)));
  if (bridge.series) {
    validateSeries(bridge.series).errors.forEach(e => errs.push(`bridge ${bridge.series.id}: ${e}`));
    validateStory(bridge.story).errors.forEach(e => errs.push(`bridge ${bridge.story.id}: ${e}`));
    bridge.issues.forEach(i => validateIssue(i).errors.forEach(e => errs.push(`bridge ${i.id}: ${e}`)));
    bridge.collections.forEach(c => validateCollection(c).errors.forEach(e => errs.push(`bridge ${c.id}: ${e}`)));
  }
  const v = validateEventData(events, { relationships: rels, knownEntity: () => true });
  v.errors.forEach(x => errs.push(`${x.code}: ${x.message}`));
  return { valid: errs.length === 0, errors: errs, report: v };
}

const verified = d => d && d.sourceInfo && d.sourceInfo.verificationStatus === "verified";

/**
 * importEvents({ data, progress })
 *   data = the data.js namespace (upsertEntity, upsertCollectionEdition, patchEntity, getEntity, getEntitiesByIds).
 * Returns {
 *   validation, written:{comicEvents,comicIssues,comicRelationships,comicSeries,comicStories,comicCollections},
 *   events:{created,updated,keptVerified}, links:{added,alreadyPresent}, bridge:{created:[ids],present:[ids],notes:[…]},
 *   unresolved:[…], ownerReview:[…], skipped:[…], errors:[…] }
 */
export async function importEvents({ data, progress } = {}) {
  const say = m => { try { progress && progress(m); } catch (e) { /* ignore */ } };
  const out = {
    validation: null, written: { comicEvents: 0, comicIssues: 0, comicRelationships: 0, comicSeries: 0, comicStories: 0, comicCollections: 0 },
    events: { created: 0, updated: 0, keptVerified: 0 }, links: { added: 0, alreadyPresent: 0 }, bridge: { created: [], present: [], notes: [] },
    unresolved: [], ownerReview: [], skipped: [], errors: [],
  };
  say("Validating the event dataset…");
  out.validation = validateDataset();
  if (!out.validation.valid) return out; // validation-first: nothing is written
  const events = buildEvents(), rels = buildEventRelationships(), plan = plannedMembership(), bridge = buildFlashpointBridge();
  const fail = (what, e) => out.errors.push(`${what}: ${(e && e.message) || e}`);

  // 1) Flashpoint core bridge — create-if-absent (a record that already exists, verified or not, is never overwritten).
  if (bridge.series) {
    say("Checking the Flashpoint core records…");
    out.bridge.notes.push(...bridge.skipped);
    const kinds = [
      [COLLECTIONS.SERIES, [bridge.series], "comicSeries", (c, r) => data.upsertEntity(c, r.id, r)],
      [COLLECTIONS.STORIES, [bridge.story], "comicStories", (c, r) => data.upsertEntity(c, r.id, r)],
      [COLLECTIONS.ISSUES, bridge.issues, "comicIssues", (c, r) => data.upsertEntity(c, r.id, r)],
      [COLLECTIONS.COLLECTIONS, bridge.collections, "comicCollections", (c, r) => (data.upsertCollectionEdition ? data.upsertCollectionEdition(r.id, r) : data.upsertEntity(c, r.id, r))],
    ];
    for (const [col, list, key, write] of kinds) {
      let have = new Set();
      try { have = new Set((await data.getEntitiesByIds(col, list.map(r => r.id))).map(r => r.id)); } catch (e) { fail(`${col} lookup`, e); continue; }
      for (const rec of list) {
        if (have.has(rec.id)) { out.bridge.present.push(`${col}/${rec.id}`); continue; }
        try { await write(col, rec); out.written[key]++; out.bridge.created.push(`${col}/${rec.id}`); } catch (e) { fail(`${col}/${rec.id}`, e); }
      }
    }
  }

  // 2) Event documents — a hand-verified event keeps its descriptive fields (but still gets its membership repaired below).
  const existing = new Map((await data.getEntitiesByIds(COLLECTIONS.EVENTS, events.map(e => e.id))).map(e => [e.id, e]));
  const cont = await data.getEntity(COLLECTIONS.CONTINUITIES, NEW52_CONTINUITY_ID).catch(() => null);
  if (!cont) out.skipped.push(`continuity "${NEW52_CONTINUITY_ID}" is not in the catalogue — events are still written; their continuity link cannot be shown until it exists`);
  const known = new Set(); // events that exist after this step (written now or already there)
  for (const ev of events) {
    const ex = existing.get(ev.id);
    if (ex && verified(ex)) { out.events.keptVerified++; known.add(ev.id); out.skipped.push(`${ev.id}: existing record is verified — descriptive fields left untouched (membership still reconciled)`); continue; }
    try {
      await data.upsertEntity(COLLECTIONS.EVENTS, ev.id, ev);
      out.written.comicEvents++; known.add(ev.id);
      if (ex) out.events.updated++; else out.events.created++;
      say(`Event ${out.written.comicEvents}/${events.length}: ${ev.title}`);
    } catch (e) { fail(`${ev.id}`, e); if (ex) known.add(ev.id); }
  }

  // 3) Membership — resolve every planned issue id in batches, report what is missing, and reconcile issue.eventIds additively.
  const wantIds = [...new Set(Object.values(plan).flat().map(m => m.issueId))];
  say(`Checking ${wantIds.length} participating issue ids…`);
  const have = new Map();
  try { (await data.getEntitiesByIds(COLLECTIONS.ISSUES, wantIds)).forEach(i => have.set(i.id, i)); } catch (e) { fail("issue lookup", e); }
  for (const id of wantIds.filter(x => !have.has(x))) { // single-document fallback for ids the batched `in` query could not see (e.g. a record without an `id` field)
    try { const i = await data.getEntity(COLLECTIONS.ISSUES, id); if (i) have.set(id, i); } catch (e) { /* stays unresolved */ }
  }
  const toPatch = new Map(); // issueId → Set(eventId) after reconciliation
  for (const [eventId, list] of Object.entries(plan)) {
    if (!known.has(eventId)) { out.skipped.push(`${eventId}: event record is not in the database — membership not written`); continue; }
    for (const m of list) {
      const i = have.get(m.issueId);
      if (!i) { out.unresolved.push(`${eventId}: ${m.seriesId} ${m.label} — no issue record "${m.issueId}"`); continue; }
      const set = toPatch.get(i.id) || new Set(i.eventIds || []);
      if (set.has(eventId)) out.links.alreadyPresent++; else { set.add(eventId); out.links.added++; }
      toPatch.set(i.id, set);
    }
  }
  for (const [issueId, set] of toPatch) {
    const prev = have.get(issueId).eventIds || [];
    if (prev.length === set.size && prev.every(x => set.has(x))) continue; // nothing new for this issue
    try { await data.patchEntity(COLLECTIONS.ISSUES, issueId, { eventIds: [...set].sort() }); out.written.comicIssues++; }
    catch (e) { fail(`${issueId}`, e); }
  }
  // Events whose owner data gives wording but no issue-level membership are reported, never turned into membership.
  for (const ev of events) {
    const planned = (plan[ev.id] || []).filter(m => have.has(m.issueId)).length;
    if (!planned && !(ev.coreStoryIds || []).length) out.ownerReview.push(`${ev.id} (${ev.title}): summary wording only${(ev.recordedMaterial || []).filter(m => m.role === "summary").map(m => ` — "${m.label}"`).join("")}`);
  }

  // 4) Event → event edges
  for (const r of rels) {
    if (!known.has(r.sourceId)) { out.skipped.push(`${r.id}: source event is not in the database`); continue; }
    try { await data.upsertEntity(COLLECTIONS.RELATIONSHIPS, r.id, r); out.written.comicRelationships++; } catch (e) { fail(`${r.id}`, e); }
  }
  say(`Done — ${out.events.created + out.events.updated} events, ${out.links.added} issue links added, ${out.links.alreadyPresent} already present.`);
  return out;
}
