// ============================================================================
// comics-v2 / seed-events.js — PHASE 5: additive, deterministic, idempotent, validation-first event import.
// Reads the ONE canonical definition (events-data.js; Flashpoint's catalogue bridge comes from flashpoint-core.js) and writes:
//   comicSeries / comicStories / comicIssues / comicCollections   the Flashpoint core bridge — CREATE-IF-ABSENT only, never overwritten
//   comicEvents/<id>                                              the Event records (a hand-verified event keeps its descriptive fields)
//   comicIssues/<id>.eventIds                                     membership — union with whatever is already there, repaired for EVERY event,
//                                                                 including events whose own document was skipped because it is verified
//   comicRelationships/<id>__sequel_to__<id>                      explicit event→event ordering edges
// It never deletes a record, and never invents one other than the Flashpoint core bridge. Anything it cannot resolve is REPORTED.
// An existing Event document is MERGED (mergeEvent): verified descriptive content is protected, missing structural fields are repaired additively, lists are unioned,
// conflicts are reported not overwritten. Events reclassified as story arcs (RETIRED_EVENTS) are detached, never deleted.
// Re-running converges: second run → every link "already present", nothing added, every event "unchanged".
// Reads per run: issues by id (ceil(n/30)), events by id (ceil(n/30)), bridge ids (ceil(n/30) per kind), plus a single-document fallback only for ids the
// batched query could not find (bounded by the number of planned ids; empty on a healthy catalogue).
// ============================================================================
import { COLLECTIONS, validateEvent, validateRelationship, validateSeries, validateStory, validateIssue, validateCollection } from "./schema.js";
import { buildIssueId } from "./slug.js";
import { buildEvents, buildEventRelationships, validateEventData, validateMembers, MEMBERS, EDITION_MEMBERSHIP, membershipState, NEW52_CONTINUITY_ID, RETIRED_EVENTS, OWNER_REVIEW, eventsWithoutDescription } from "./events-data.js?v=fp2";
import { buildFlashpointBridge } from "./flashpoint-core.js?v=fp2";

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
  validateMembers().forEach(e => errs.push(`members: ${e}`));
  const v = validateEventData(events, { relationships: rels, knownEntity: () => true });
  v.errors.forEach(x => errs.push(`${x.code}: ${x.message}`));
  return { valid: errs.length === 0, errors: errs, report: v };
}

const verified = d => d && d.sourceInfo && d.sourceInfo.verificationStatus === "verified";
const empty = v => v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length);
const stable = v => JSON.stringify(v ?? null, (k, x) => (x && typeof x === "object" && !Array.isArray(x)) ? Object.fromEntries(Object.keys(x).sort().map(key => [key, x[key]])) : x); // key order is not significant (Firestore returns maps in its own order)
const same = (a, b) => stable(a) === stable(b);
const union = (a, b) => [...new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])])];
const matKey = m => `${m.role || ""}|${m.label || ""}`;
const SCALARS = ["eventType", "universeId", "transitionFromContinuityId", "transitionToContinuityId", "transitionFromLabel", "transitionToLabel", "startDate", "endDate"];
const LISTS = ["continuityIds", "coreStoryIds", "readingPathIds"];

/**
 * Pure: merge the canonical Event definition `cv` into an existing document `ex` without ever treating a document as a frozen snapshot.
 *   • descriptive fields (title, description, sourceInfo): a VERIFIED document keeps them; an unverified one follows the canonical definition. An empty description is filled.
 *   • structural scalars (eventType, universe, transition endpoints): filled when missing; a conflicting value in a verified document is kept and REPORTED.
 *   • structural lists (continuityIds, coreStoryIds, readingPathIds): additive union, existing ids first, de-duplicated — nothing the owner added is removed.
 *   • recordedMaterial: verified → only missing entries are appended; unverified → follows the canonical wording.
 * Returns { doc, structural:[fields repaired], descriptive:[fields changed], conflicts:[…], description:"added"|"updated"|"preserved"|"none", typeChange }.
 */
export function mergeEvent(ex, cv) {
  if (!ex) return { doc: cv, structural: [], descriptive: [], conflicts: [], description: cv.description ? "added" : "none", typeChange: null, created: true };
  const isV = verified(ex), doc = { ...ex }, structural = [], descriptive = [], conflicts = [];
  let typeChange = null, description = "preserved";
  for (const f of SCALARS) {
    const xv = ex[f], c = cv[f];
    if (empty(c) || same(xv, c)) continue;
    if (empty(xv)) { doc[f] = c; structural.push(f); }
    else if (isV) conflicts.push(`${f}: existing "${xv}" (verified) vs canonical "${c}" — kept the existing value`);
    else { doc[f] = c; structural.push(f); if (f === "eventType") typeChange = `${xv} → ${c}`; }
  }
  for (const f of LISTS) {
    const u = union(ex[f], cv[f]);
    if (!same(u, ex[f] || [])) { doc[f] = u; structural.push(f); }
  }
  const have = new Set((ex.recordedMaterial || []).map(matKey));
  if (isV) {
    const add = (cv.recordedMaterial || []).filter(m => !have.has(matKey(m)));
    if (add.length) { doc.recordedMaterial = [...(ex.recordedMaterial || []), ...add]; structural.push("recordedMaterial"); }
  } else if (!same(ex.recordedMaterial || [], cv.recordedMaterial || [])) { doc.recordedMaterial = cv.recordedMaterial || []; structural.push("recordedMaterial"); }
  // description
  if (empty(cv.description)) description = empty(ex.description) ? "none" : "preserved";
  else if (empty(ex.description)) { doc.description = cv.description; description = "added"; descriptive.push("description"); }
  else if (same(ex.description, cv.description)) description = "preserved";
  else if (isV) { description = "preserved"; conflicts.push("description: a different verified description exists — kept"); }
  else { doc.description = cv.description; description = "updated"; descriptive.push("description"); }
  if (!isV) {
    if (ex.title !== cv.title) { doc.title = cv.title; descriptive.push("title"); }
    if (!same(ex.sourceInfo, cv.sourceInfo)) { doc.sourceInfo = cv.sourceInfo; descriptive.push("sourceInfo"); }
  }
  if (structural.length || descriptive.length) doc.updatedAt = cv.updatedAt;
  return { doc, structural, descriptive, conflicts, description, typeChange, created: false };
}

/**
 * importEvents({ data, progress })
 *   data = the data.js namespace (upsertEntity, upsertCollectionEdition, patchEntity, getEntity, getEntitiesByIds, getIssuesForEvent, getCollectionsCoveringIssues).
 * Returns the full report: validation, written{…}, events{created,updated,unchanged,keptVerified,structuralRepaired[]}, links{added,alreadyPresent,retiredRemoved},
 * stories{coreResolved,coreUnresolved,linksAdded,alreadyPresent}, readingPaths{linked,unavailable}, relationships{written,alreadyPresent,unresolved},
 * descriptions{added,updated,preserved,conflicts,missing}, semantic{changed,ownerReview}, bridge{…}, unresolved, ownerReview, skipped, errors, audit[one row per Event].
 */
export async function importEvents({ data, progress } = {}) {
  const say = m => { try { progress && progress(m); } catch (e) { /* ignore */ } };
  const out = {
    validation: null, written: { comicEvents: 0, comicIssues: 0, comicRelationships: 0, comicSeries: 0, comicStories: 0, comicCollections: 0 },
    events: { created: 0, updated: 0, unchanged: 0, keptVerified: 0, structuralRepaired: [] }, links: { added: 0, alreadyPresent: 0, retiredRemoved: 0 },
    stories: { coreResolved: [], coreUnresolved: [], linksAdded: 0, alreadyPresent: 0, viaIssuesResolved: 0, viaIssuesUnresolved: [], issuesWithoutStory: 0 }, membership: { states: [], mismatches: [], preserved: 0, orphanRefs: [], duplicates: [] }, retired: [], editions: { used: [], missing: [], issueIdsAdded: 0 }, readingPaths: { linked: [], unavailable: [] },
    relationships: { written: 0, alreadyPresent: 0, unresolved: [] }, descriptions: { added: [], updated: [], preserved: [], conflicts: [], missing: [] },
    semantic: { changed: [], ownerReview: [] }, bridge: { created: [], present: [], notes: [] },
    unresolved: [], ownerReview: [], skipped: [], errors: [], audit: [],
  };
  say("Validating the event dataset…");
  out.validation = validateDataset();
  if (!out.validation.valid) return out; // validation-first: nothing is written
  const events = buildEvents(), rels = buildEventRelationships(), plan = plannedMembership(), bridge = buildFlashpointBridge();
  const fail = (what, e) => out.errors.push(`${what}: ${(e && e.message) || e}`);
  const rowOf = new Map(events.map(e => [e.id, { eventId: e.id, title: e.title, type: e.eventType, conflicts: [], structuralRepaired: [], linksAdded: 0, linksAlreadyPresent: 0, unresolvedIssues: 0 }]));

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

  // 2) Event documents — merged field-class by field-class (see mergeEvent); a verified document is protected DESCRIPTIVE content, not a frozen schema.
  let existing = new Map();
  try { existing = new Map((await data.getEntitiesByIds(COLLECTIONS.EVENTS, events.map(e => e.id))).map(e => [e.id, e])); } catch (e) { fail("event lookup", e); }
  const cont = await data.getEntity(COLLECTIONS.CONTINUITIES, NEW52_CONTINUITY_ID).catch(() => null);
  if (!cont) out.skipped.push(`continuity "${NEW52_CONTINUITY_ID}" is not in the catalogue — events are still written; their continuity link cannot be shown until it exists`);
  const known = new Set(); // events that exist after this step (written now or already there)
  for (const ev of events) {
    const ex = existing.get(ev.id), m = mergeEvent(ex, ev), row = rowOf.get(ev.id);
    row.conflicts.push(...m.conflicts);
    if (m.conflicts.length) out.descriptions.conflicts.push(...m.conflicts.filter(c => c.startsWith("description")).map(c => `${ev.id}: ${c}`));
    if (m.created || m.structural.length || m.descriptive.length) {
      try {
        await data.upsertEntity(COLLECTIONS.EVENTS, ev.id, m.doc);
        out.written.comicEvents++; known.add(ev.id);
        if (m.created) out.events.created++; else out.events.updated++;
        if (m.structural.length) { out.events.structuralRepaired.push(`${ev.id}: ${m.structural.join(", ")}`); row.structuralRepaired = m.structural; }
        say(`Event ${out.written.comicEvents}/${events.length}: ${ev.title}`);
      } catch (e) { fail(`${ev.id}`, e); if (ex) known.add(ev.id); continue; }
    } else { out.events.unchanged++; known.add(ev.id); }
    if (ex && verified(ex)) { out.events.keptVerified++; out.skipped.push(`${ev.id}: existing record is verified — descriptive fields kept${m.structural.length ? `; structural fields repaired additively (${m.structural.join(", ")})` : ""}`); }
    if (m.description === "added") out.descriptions.added.push(ev.id);
    else if (m.description === "updated") out.descriptions.updated.push(ev.id);
    else if (m.description === "preserved") out.descriptions.preserved.push(ev.id);
    else out.descriptions.missing.push(ev.id);
    if (m.typeChange) out.semantic.changed.push(`${ev.id}: eventType ${m.typeChange}`);
  }
  for (const d of eventsWithoutDescription()) out.descriptions.missing = [...new Set([...out.descriptions.missing, d.id])];
  out.descriptions.missingReasons = eventsWithoutDescription();

  // 2b) Retired events — reclassified as story arcs. NEVER deleted: the record is reported, the issue links this importer wrote are removed, and the record is
  // detached from the continuity listing so it no longer appears as an Event. Idempotent.
  for (const r of RETIRED_EVENTS) {
    try {
      const ex = await data.getEntity(COLLECTIONS.EVENTS, r.id).catch(() => null);
      const linked = (await data.getIssuesForEvent(r.id).catch(() => [])) || [];
      let touched = false;
      for (const i of linked) { await data.patchEntity(COLLECTIONS.ISSUES, i.id, { eventIds: (i.eventIds || []).filter(x => x !== r.id) }); out.links.retiredRemoved++; out.written.comicIssues++; touched = true; }
      if (ex && !empty(ex.continuityIds)) { await data.patchEntity(COLLECTIONS.EVENTS, r.id, { continuityIds: [], retiredNote: `Reclassified as a ${r.now} (Phase 5 audit). Record kept, not deleted; no longer listed as an Event.` }); touched = true; }
      if (touched) out.semantic.changed.push(`${r.id}: Event → ${r.now}${ex ? " (existing record kept, detached; issue links removed: " + linked.length + ")" : ""}`);
      out.retired.push(`${r.id}: ${r.now} — ${ex ? "stale Event document kept for history, ignored at runtime" : "no Event document"}; ${linked.length} stale issue link(s) removed`);
      out.semantic.ownerReview.push(`${r.id}: ${r.reason}`);
    } catch (e) { fail(`retire ${r.id}`, e); }
  }
  for (const o of OWNER_REVIEW) out.semantic.ownerReview.push(`${o.id}: ${o.note}`);

  // 2c) Edition-backed membership: the issueCoverage of an event's own dedicated collected edition (EDITION_MEMBERSHIP) names explicit catalogue issue ids. They are unioned into
  // the plan (de-duplicated); a missing collection or issue is reported, never created. Mixed series volumes are not used.
  const editionIds = [...new Set(Object.values(EDITION_MEMBERSHIP).flat())];
  if (editionIds.length) {
    let eds = new Map();
    try { eds = new Map((await data.getEntitiesByIds(COLLECTIONS.COLLECTIONS, editionIds)).map(c => [c.id, c])); } catch (e) { fail("edition lookup", e); }
    for (const [eventId, cids] of Object.entries(EDITION_MEMBERSHIP)) {
      const list = plan[eventId] || (plan[eventId] = []), seen = new Set(list.map(m => m.issueId));
      for (const cid of cids) {
        const c = eds.get(cid);
        if (!c) { out.editions.missing.push(`${eventId}: edition "${cid}" is not in the database — its issues cannot be linked yet`); continue; }
        out.editions.used.push(`${eventId}: ${cid}`);
        for (const r of c.issueCoverage || []) if (r.issueId && !seen.has(r.issueId)) { seen.add(r.issueId); list.push({ seriesId: r.seriesId, label: r.issueLabel, issueId: r.issueId, via: "edition" }); out.editions.issueIdsAdded++; }
      }
    }
  }

  // 3) Membership — resolve every planned issue id in batches, report what is missing, and reconcile issue.eventIds additively (for EVERY known event, verified or not).
  const wantIds = [...new Set(Object.values(plan).flat().map(m => m.issueId))];
  say(`Checking ${wantIds.length} participating issue ids…`);
  const have = new Map();
  try { (await data.getEntitiesByIds(COLLECTIONS.ISSUES, wantIds)).forEach(i => have.set(i.id, i)); } catch (e) { fail("issue lookup", e); }
  for (const id of wantIds.filter(x => !have.has(x))) { // single-document fallback for ids the batched `in` query could not see
    try { const i = await data.getEntity(COLLECTIONS.ISSUES, id); if (i) have.set(id, i); } catch (e) { /* stays unresolved */ }
  }
  const toPatch = new Map(); // issueId → Set(eventId) after reconciliation
  for (const [eventId, list] of Object.entries(plan)) {
    const row = rowOf.get(eventId);
    if (!known.has(eventId)) { out.skipped.push(`${eventId}: event record is not in the database — membership not written`); continue; }
    for (const m of list) {
      const i = have.get(m.issueId);
      if (!i) { out.unresolved.push(`${eventId}: ${m.seriesId} ${m.label} — no issue record "${m.issueId}"${m.via === "edition" ? " (from the edition's coverage)" : ""}`); if (row) row.unresolvedIssues++; continue; }
      if ((i.eventIds || []).length !== new Set(i.eventIds || []).size && !out.membership.duplicates.some(x => x.startsWith(i.id + ":"))) out.membership.duplicates.push(`${i.id}: duplicate eventIds (de-duplicated by this import)`);
      const set = toPatch.get(i.id) || new Set(i.eventIds || []);
      if (set.has(eventId)) { out.links.alreadyPresent++; if (row) row.linksAlreadyPresent++; } else { set.add(eventId); out.links.added++; if (row) row.linksAdded++; }
      toPatch.set(i.id, set);
    }
  }
  for (const [issueId, set] of toPatch) {
    const prev = have.get(issueId).eventIds || [];
    if (prev.length === set.size && prev.every(x => set.has(x))) continue; // nothing new for this issue
    try { await data.patchEntity(COLLECTIONS.ISSUES, issueId, { eventIds: [...set].sort() }); out.written.comicIssues++; }
    catch (e) { fail(`${issueId}`, e); }
  }
  // 3d) Membership verification (read-only): every resolvable canonical id must now be on its issue; existing links are preserved and counted; duplicates and
  // orphan references (an eventId that is neither an active nor a retired event) are reported. One query per event (21), not per issue.
  const activeIds = new Set(events.map(e => e.id)), retiredIds = new Set(RETIRED_EVENTS.map(r => r.id));
  const actualOf = new Map();
  for (const ev of events) {
    if (!known.has(ev.id)) continue;
    try {
      const actual = (await data.getIssuesForEvent(ev.id)) || [];
      actualOf.set(ev.id, actual);
      const have2 = new Set(actual.map(i => i.id)), planned = (plan[ev.id] || []).filter(m => have.has(m.issueId));
      for (const m of planned) if (!have2.has(m.issueId)) out.membership.mismatches.push(`${ev.id}: ${m.issueId} is planned and exists but is not linked`);
      const plannedIds = new Set(planned.map(m => m.issueId));
      out.membership.preserved += actual.filter(i => !plannedIds.has(i.id)).length;
      for (const i of actual) {
        if (new Set(i.eventIds || []).size !== (i.eventIds || []).length && !out.membership.duplicates.some(x => x.startsWith(i.id + ":"))) out.membership.duplicates.push(`${i.id}: duplicate eventIds`);
        for (const x of i.eventIds || []) { const msg = `${i.id}: references unknown event "${x}"`; if (!activeIds.has(x) && !retiredIds.has(x) && !out.membership.orphanRefs.includes(msg)) out.membership.orphanRefs.push(msg); }
      }
    } catch (e) { fail(`membership check ${ev.id}`, e); }
  }
  for (const ev of events) {
    const resolved = (plan[ev.id] || []).filter(m => have.has(m.issueId)).length, st = membershipState(ev.id, resolved);
    const missingIds = (plan[ev.id] || []).filter(m => !have.has(m.issueId)).length;
    out.membership.states.push({ eventId: ev.id, title: ev.title, state: st.state, resolved, planned: (plan[ev.id] || []).length, unresolvedRefs: missingIds, reasons: st.reasons });
  }

  // 3a) Event → Story through the canonical resolver (explicit links + coreStoryIds + issue.storyIds, batched, de-duplicated). Read-only: no Story is ever created from an Issue.
  const storyOf = new Map(); // eventId → { resolved:n, unresolved:[ids], issuesWithoutStory:n }
  if (typeof data.getStoriesForEventDeep === "function") {
    say("Resolving stories through participating issues…");
    for (const ev of events) {
      if (!known.has(ev.id)) continue;
      try {
        const d = await data.getStoriesForEventDeep(ev.id, { coreStoryIds: ev.coreStoryIds || [] });
        storyOf.set(ev.id, { resolved: d.stories.length, viaIssues: d.viaIssueIds.size, unresolved: d.unresolvedIds, issuesWithoutStory: d.issuesWithoutStory });
        out.stories.viaIssuesResolved += [...d.viaIssueIds].filter(id => d.stories.some(s => s.id === id)).length;
        d.unresolvedIds.forEach(id => out.stories.viaIssuesUnresolved.push(`${ev.id}: story "${id}" is named but has no record`));
        out.stories.issuesWithoutStory += d.issuesWithoutStory;
      } catch (e) { fail(`stories for ${ev.id}`, e); }
    }
  }
  // Events whose owner data gives wording but no issue-level membership are reported, never turned into membership.
  for (const ev of events) {
    const planned = (plan[ev.id] || []).filter(m => have.has(m.issueId)).length;
    if (!planned && !(ev.coreStoryIds || []).length) out.ownerReview.push(`${ev.id} (${ev.title}): summary wording only${(ev.recordedMaterial || []).filter(m => m.role === "summary").map(m => ` — "${m.label}"`).join("")}`);
  }

  // 3b) Core stories — resolved by id (never created here except by the Flashpoint bridge). A resolved story that lacks its event link gains it additively.
  const coreIds = [...new Set(events.flatMap(e => e.coreStoryIds || []))];
  if (coreIds.length) {
    let stories = new Map();
    try { stories = new Map((await data.getEntitiesByIds(COLLECTIONS.STORIES, coreIds)).map(s => [s.id, s])); } catch (e) { fail("comicStories lookup", e); }
    for (const ev of events) for (const sid of ev.coreStoryIds || []) {
      const st = stories.get(sid);
      if (!st) { out.stories.coreUnresolved.push(`${ev.id}: core story "${sid}" not found`); continue; }
      out.stories.coreResolved.push(`${ev.id}: ${sid}`);
      if (st.eventId === ev.id) out.stories.alreadyPresent++;
      else if (empty(st.eventId)) { try { await data.patchEntity(COLLECTIONS.STORIES, sid, { eventId: ev.id }); out.stories.linksAdded++; out.written.comicStories++; } catch (e) { fail(`${sid}`, e); } }
      else rowOf.get(ev.id).conflicts.push(`story "${sid}" already names event "${st.eventId}" — left as is`);
    }
  }

  // 3c) Reading paths — every declared id must resolve to a real record.
  const rpIds = [...new Set(events.flatMap(e => e.readingPathIds || []))];
  let rpHave = new Set();
  if (rpIds.length) { try { rpHave = new Set((await data.getEntitiesByIds(COLLECTIONS.READING_PATHS, rpIds)).map(p => p.id)); } catch (e) { fail("reading path lookup", e); } }
  for (const ev of events) for (const pid of ev.readingPathIds || []) (rpHave.has(pid) ? out.readingPaths.linked : out.readingPaths.unavailable).push(`${ev.id}: ${pid}`);

  // 4) Event → event edges
  let relHave = new Set();
  try { relHave = new Set((await data.getEntitiesByIds(COLLECTIONS.RELATIONSHIPS, rels.map(r => r.id))).map(r => r.id)); } catch (e) { fail("relationship lookup", e); }
  for (const r of rels) {
    if (!known.has(r.sourceId) || !known.has(r.targetId)) { out.relationships.unresolved.push(`${r.id}: ${!known.has(r.sourceId) ? "source" : "target"} event is not in the database`); continue; }
    if (relHave.has(r.id)) { out.relationships.alreadyPresent++; continue; }
    try { await data.upsertEntity(COLLECTIONS.RELATIONSHIPS, r.id, r); out.written.comicRelationships++; out.relationships.written++; } catch (e) { fail(`${r.id}`, e); }
  }

  // 5) Per-event audit rows (the data-quality report)
  say("Auditing every event…");
  for (const ev of events) {
    const row = rowOf.get(ev.id), ids = (plan[ev.id] || []).map(m => m.issueId).filter(id => have.has(id)), iss = ids.map(id => have.get(id));
    let collections = null;
    if (ids.length) { try { collections = (await data.getCollectionsCoveringIssues(ids)).length; } catch (e) { collections = null; } }
    const rl = rels.filter(r => r.sourceId === ev.id || r.targetId === ev.id).length;
    const coreOk = (ev.coreStoryIds || []).every(sid => out.stories.coreResolved.some(x => x === `${ev.id}: ${sid}`));
    out.audit.push({
      eventId: ev.id, title: ev.title, semanticType: ev.eventType, descriptionPresent: !!ev.description, descriptionSource: ev.sourceInfo?.sourceUrl || "",
      coreStoryIds: ev.coreStoryIds || [], coreStoryResolved: (ev.coreStoryIds || []).length ? coreOk : null, issueCount: ids.length,
      issueLinksAdded: row.linksAdded, issueLinksAlreadyPresent: row.linksAlreadyPresent, unresolvedIssueRefs: row.unresolvedIssues,
      participatingSeries: new Set(iss.map(i => i.seriesId)).size, participatingStories: new Set(iss.flatMap(i => i.storyIds || [])).size,
      storiesResolved: storyOf.get(ev.id)?.resolved ?? null, storiesUnresolved: storyOf.get(ev.id)?.unresolved || [], issuesWithoutStory: storyOf.get(ev.id)?.issuesWithoutStory ?? null,
      membership: out.membership.states.find(x => x.eventId === ev.id),
      issuesFromEditions: (plan[ev.id] || []).filter(m => m.via === "edition" && have.has(m.issueId)).length,
      characters: new Set(iss.flatMap(i => i.characterIds || [])).size, continuityContext: ev.continuityIds || [], continuityImpact: 0, relatedEvents: rl,
      readingPathIds: ev.readingPathIds || [], readingPathResolved: (ev.readingPathIds || []).length ? (ev.readingPathIds || []).every(p => rpHave.has(p)) : null,
      collections, structuralRepaired: row.structuralRepaired, conflicts: row.conflicts,
      status: row.conflicts.length ? "owner review" : (!ids.length && !(ev.coreStoryIds || []).length) ? "wording only — owner review" : (row.unresolvedIssues ? "partial" : "ok"),
    });
  }
  say(`Done — ${out.events.created} created, ${out.events.updated} updated, ${out.links.added} issue links added, ${out.links.alreadyPresent} already present.`);
  return out;
}
