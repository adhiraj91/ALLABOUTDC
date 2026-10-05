// ============================================================================
// comics-v2 / seed-events.js — PHASE 5: additive, deterministic, idempotent, validation-first event import.
// Reads the ONE canonical definition (events-data.js) and writes:
//   comicEvents/<id>                          the Event records
//   comicIssues/<id>.eventIds                 membership (union with whatever is already there — never overwritten)
//   comicRelationships/rel-event-…            explicit event→event ordering edges
// It never deletes, never edits a Story, never creates an Issue/Series/Collection, and skips (reports) anything it cannot resolve
// instead of guessing. Re-running it changes nothing but updatedAt.
// ============================================================================
import { COLLECTIONS, validateEvent, validateRelationship } from "./schema.js";
import { buildIssueId } from "./slug.js";
import { buildEvents, buildEventRelationships, validateEventData, MEMBERS, NEW52_CONTINUITY_ID } from "./events-data.js";

/** Pure: which issue ids does each event name, before anything is checked against the catalogue? */
export function plannedMembership() {
  const plan = {};
  for (const [eventId, specs] of Object.entries(MEMBERS)) {
    plan[eventId] = specs.flatMap(s => s.labels.map(label => ({ seriesId: s.seriesId, label, issueId: buildIssueId(s.seriesId, label) })));
  }
  return plan;
}

export function validateDataset() {
  const events = buildEvents(), rels = buildEventRelationships();
  const errs = [];
  events.forEach(ev => validateEvent(ev).errors.forEach(e => errs.push(`${ev.id}: ${e}`)));
  rels.forEach(r => validateRelationship(r).errors.filter(e => !/outside the starting set/.test(e)).forEach(e => errs.push(`${r.id}: ${e}`)));
  const v = validateEventData(events, { relationships: rels, knownEntity: () => true });
  v.errors.forEach(x => errs.push(`${x.code}: ${x.message}`));
  return { valid: errs.length === 0, errors: errs, report: v };
}

/**
 * importEvents({ data, progress })
 *   data = the data.js namespace (upsertEntity, patchEntity, getEntity, getEntitiesByIds).
 * Returns { validation, written:{comicEvents, comicIssues, comicRelationships}, unresolved:[…], skipped:[…], errors:[…] }.
 */
export async function importEvents({ data, progress } = {}) {
  const say = m => { try { progress && progress(m); } catch (e) { /* ignore */ } };
  const out = { validation: null, written: { comicEvents: 0, comicIssues: 0, comicRelationships: 0 }, unresolved: [], skipped: [], errors: [] };
  say("Validating the event dataset…");
  out.validation = validateDataset();
  if (!out.validation.valid) return out; // validation-first: nothing is written
  const events = buildEvents(), rels = buildEventRelationships(), plan = plannedMembership();

  // Resolve membership against the catalogue in batches of 30 (never one read per issue).
  const wantIds = [...new Set(Object.values(plan).flat().map(m => m.issueId))];
  say(`Checking ${wantIds.length} participating issue ids…`);
  const have = new Map((await data.getEntitiesByIds(COLLECTIONS.ISSUES, wantIds)).map(i => [i.id, i]));
  for (const [eventId, list] of Object.entries(plan)) for (const m of list) if (!have.has(m.issueId)) out.unresolved.push(`${eventId}: ${m.seriesId} ${m.label} (no issue record ${m.issueId})`);

  // Existing event documents that were reviewed by hand (verified) are never overwritten.
  const existing = new Map((await data.getEntitiesByIds(COLLECTIONS.EVENTS, events.map(e => e.id))).map(e => [e.id, e]));
  const cont = await data.getEntity(COLLECTIONS.CONTINUITIES, NEW52_CONTINUITY_ID).catch(() => null);
  if (!cont) out.skipped.push(`continuity "${NEW52_CONTINUITY_ID}" is not in the catalogue — events are still written; their continuity link cannot be shown until it exists`);

  const writtenEvents = new Set();
  for (const ev of events) {
    const ex = existing.get(ev.id);
    if (ex && ex.sourceInfo?.verificationStatus === "verified") { out.skipped.push(`${ev.id}: existing record is verified — left untouched`); continue; }
    try { await data.upsertEntity(COLLECTIONS.EVENTS, ev.id, ev); out.written.comicEvents++; writtenEvents.add(ev.id); say(`Event ${out.written.comicEvents}/${events.length}: ${ev.title}`); }
    catch (e) { out.errors.push(`${ev.id}: ${e.message || e}`); }
  }
  // membership: issue.eventIds = union(existing, [eventId]) — additive and idempotent
  const toPatch = new Map();
  for (const [eventId, list] of Object.entries(plan)) {
    if (!writtenEvents.has(eventId)) continue;
    for (const m of list) { const i = have.get(m.issueId); if (!i) continue; const set = toPatch.get(i.id) || new Set(i.eventIds || []); set.add(eventId); toPatch.set(i.id, set); }
  }
  for (const [issueId, set] of toPatch) {
    const prev = have.get(issueId).eventIds || [];
    if (prev.length === set.size && prev.every(x => set.has(x))) continue; // already linked — nothing to write
    try { await data.patchEntity(COLLECTIONS.ISSUES, issueId, { eventIds: [...set].sort() }); out.written.comicIssues++; }
    catch (e) { out.errors.push(`${issueId}: ${e.message || e}`); }
  }
  for (const r of rels) {
    if (!writtenEvents.has(r.sourceId) && !existing.has(r.sourceId)) { out.skipped.push(`${r.id}: source event was not written`); continue; }
    try { await data.upsertEntity(COLLECTIONS.RELATIONSHIPS, r.id, r); out.written.comicRelationships++; } catch (e) { out.errors.push(`${r.id}: ${e.message || e}`); }
  }
  say(`Done — ${out.written.comicEvents} events, ${out.written.comicIssues} issue links, ${out.written.comicRelationships} relationships.`);
  return out;
}
