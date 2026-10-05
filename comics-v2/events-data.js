// ============================================================================
// comics-v2 / events-data.js — PHASE 5: the ONE canonical definition of the New 52 Events (pure data + pure validators; no Firestore).
// ----------------------------------------------------------------------------
// Identity (id / title / type / lanes) is NOT copied here: it is read from the owner-supplied new52-map-data.js (`crossoverSpine`,
// `transitionEvents`), so an event exists in exactly one source file. This file adds only what that presentation layer lacks:
//   • MEMBERS   — explicit participating issues as {seriesId, labels}. Transcribed from the owner's own wording in
//                 crossoverSpine[].issues (cross-checked with the owner branching CSV in branch-paths.js). Where the owner text is vague
//                 ("with Batman-family tie-ins", "+ major tie-ins") NOTHING is encoded for the vague part — it stays in recordedMaterial.
//   • READING   — explicit event → curated reading path links (bp-* ids from branch-paths.js). No title matching.
//   • CHAIN     — explicit event → event ordering edges, each with its source.
// Court of Owls (spine type "story") is a Batman story arc and is deliberately NOT an Event.
// Nothing here is marked verified: the data is the owner's research, transcribed, and defaults to "unverified".
// ============================================================================
import { crossoverSpine, transitionEvents } from "./new52-map-data.js?v=4";
import { makeEvent, makeRelationship, makeSourceInfo, EVENT_TYPES, ENTITY_TYPES, RELATIONSHIP_TYPES, ORDERING_RELATIONSHIP_TYPES } from "./schema.js";

export const UNIVERSE_ID = "dc-universe";
export const NEW52_CONTINUITY_ID = "the-new-52";
export const FLASHPOINT_ID = "flashpoint";
const OWNER = "owner-supplied New 52 map data (new52-map-data.js)";
const src = (notes, extra = {}) => makeSourceInfo({ sourceName: OWNER, sourceType: "other", verificationStatus: "unverified", notes, ...extra });

// Spine "type" → Event.eventType. "story" is not an event at all (Court of Owls stays a Story arc).
const TYPE_OF = { crossover: "crossover", event: "event", multiverse: "multiverse", transition: "transition" };

// Explicit membership. labels are issue labels exactly as the catalogue stores them (slug.buildIssueId(seriesId,label) gives the issue id).
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => String(a + i));
export const MEMBERS = {
  "night-of-owls":   [{ seriesId: "batman-2011", labels: [...range(8, 11), "Annual 1"] }],
  "death-family":    [{ seriesId: "batman-2011", labels: range(13, 17) }],
  "throne-atlantis": [{ seriesId: "justice-league-2011", labels: range(13, 17) }, { seriesId: "aquaman-2011", labels: range(15, 16) }],
  "rotworld":        [{ seriesId: "animal-man-2011", labels: range(12, 17) }, { seriesId: "swamp-thing-2011", labels: range(12, 18) }],
  "trinity-war":     [{ seriesId: "justice-league-2011", labels: range(22, 23) }, { seriesId: "justice-league-of-america-2013", labels: range(6, 7) },
                      { seriesId: "justice-league-dark-2011", labels: range(22, 23) }, { seriesId: "trinity-of-sin-pandora-2013", labels: range(1, 3) },
                      { seriesId: "trinity-of-sin-phantom-stranger-2012", labels: ["11"] }, { seriesId: "constantine-2013", labels: ["5"] }],
  "lights-out":      [{ seriesId: "green-lantern", labels: range(24, 29) }],
  "darkseid-war":    [{ seriesId: "justice-league-2011", labels: range(40, 50) }],
  "robin-rises":     [{ seriesId: "batman-and-robin-2011", labels: range(29, 40) }],
  "endgame":         [{ seriesId: "batman-2011", labels: range(35, 40) }],
};

// event id → its curated branch reading path(s) (comicReadingPaths ids "bp-<key>"). Reading paths stay owner-supplied and separate from the graph.
export const READING_PATHS = {
  "death-family": ["bp-bat-dotf"], "hel-earth": ["bp-sup-hel"], "doomed": ["bp-sup-doomed"], "rise-third-army": ["bp-gl-third-army"],
  "wrath-first-lantern": ["bp-gl-first-lantern"], "lights-out": ["bp-gl-lights-out"], "godhead": ["bp-gl-godhead"],
  "throne-atlantis": ["bp-jl-throne-of-atlantis"], "trinity-war": ["bp-jl-trinity-war"], "forever-evil": ["bp-jl-forever-evil"],
  "darkseid-war": ["bp-jl-darkseid-war"], "rotworld": ["bp-dark-rotworld"], "blight": ["bp-dark-blight"],
};

// Explicit event → event ordering. A sequel_to B = "A follows B". Each edge names its source; none is inferred from adjacency in the spine.
export const CHAIN = [
  { from: "forever-evil", rel: "sequel_to", to: "trinity-war",
    note: "Forever Evil follows Trinity War. Source: DC's own coverage cited in the Phase 5 brief (https://www.dc.com/blog/2013/08/09/ign-confirms-major-trinity-war/forever-evil-news); not independently re-checked in this build.",
    url: "https://www.dc.com/blog/2013/08/09/ign-confirms-major-trinity-war/forever-evil-news" },
];

/** Builds every Event record from the owner map data. Pure + deterministic: same input → same output. */
export function buildEvents() {
  const out = [];
  for (const sp of crossoverSpine) {
    if (!TYPE_OF[sp.type]) continue; // story → not an event
    const eventType = TYPE_OF[sp.type];
    const ev = makeEvent({
      id: sp.id, title: sp.title, eventType, universeId: UNIVERSE_ID, continuityIds: [NEW52_CONTINUITY_ID],
      readingPathIds: READING_PATHS[sp.id] || [],
      recordedMaterial: sp.issues ? [{ label: sp.issues, role: "summary" }] : [],
      sourceInfo: src(`Identity and the wording of its material come from crossoverSpine["${sp.id}"]; participating issues (if any) are transcribed from that wording.`),
    });
    if (sp.type === "transition") { // Convergence: owner data (transitionEvents "transition-rebirth") says New 52 → Rebirth
      ev.transitionFromContinuityId = NEW52_CONTINUITY_ID;
      ev.transitionToContinuityId = null; ev.transitionToLabel = "Rebirth";
    }
    out.push(ev);
  }
  const fp = transitionEvents.find(t => t.id === "transition-new52");
  if (fp) {
    out.push(makeEvent({
      id: FLASHPOINT_ID, title: fp.title, eventType: "transition", universeId: UNIVERSE_ID, continuityIds: [],
      description: fp.summary,
      transitionFromContinuityId: null, transitionFromLabel: "Pre-Flashpoint", // no Pre-Flashpoint continuity record exists yet
      transitionToContinuityId: NEW52_CONTINUITY_ID,
      recordedMaterial: (fp.issues || []).map(label => ({ label, role: "core" })),
      sourceInfo: src('Transcribed from transitionEvents["transition-new52"]. The five core issues are recorded as labels only: no Flashpoint series/issue records exist in the catalogue.'),
    }));
  }
  return out;
}

export function buildEventRelationships() {
  return CHAIN.map(c => makeRelationship({
    id: `rel-event-${c.from}-${c.rel}-${c.to}`, sourceId: c.from, sourceType: "event", relationshipType: c.rel, targetId: c.to, targetType: "event",
    sourceInfo: makeSourceInfo({ sourceUrl: c.url, sourceName: "DC (cited in the Phase 5 brief)", sourceType: "official", verificationStatus: "unverified", notes: c.note }),
  }));
}

/* ---------------------------------------------------------------------------
   Validators — pure. Severity: ERROR (breaks the model) · WARNING (needs owner review) · INFO (worth knowing). Nothing is repaired silently.
   `ctx` carries what the caller already loaded: {issues:Map id→issue, stories:Map, series:Set, continuities:Set, events:[…], relationships:[…]}.
--------------------------------------------------------------------------- */
const E = (code, msg, id) => ({ severity: "ERROR", code, message: msg, id });
const W = (code, msg, id) => ({ severity: "WARNING", code, message: msg, id });
const I = (code, msg, id) => ({ severity: "INFO", code, message: msg, id });

export function validateEventData(events, ctx = {}) {
  const f = [];
  const seen = new Set();
  const byId = new Map();
  for (const ev of events || []) {
    if (!ev || !ev.id) { f.push(E("event-no-id", "event without an id")); continue; }
    if (seen.has(ev.id)) f.push(E("event-duplicate-id", `duplicate event id "${ev.id}"`, ev.id));
    seen.add(ev.id); byId.set(ev.id, ev);
    if (!ev.title) f.push(E("event-no-title", `event "${ev.id}" has no title`, ev.id));
    if (!ev.sourceInfo || typeof ev.sourceInfo !== "object") f.push(E("event-no-source", `event "${ev.id}" has no sourceInfo`, ev.id));
    if (!EVENT_TYPES.includes(ev.eventType)) f.push(W("event-type-outside-set", `event "${ev.id}" has eventType "${ev.eventType}" outside the starting set`, ev.id));
    for (const sid of ev.coreStoryIds || []) if (ctx.stories && !ctx.stories.has(sid)) f.push(E("event-missing-story", `event "${ev.id}" lists core story "${sid}" which does not exist`, ev.id));
    for (const cid of ev.continuityIds || []) if (ctx.continuities && !ctx.continuities.has(cid)) f.push(W("event-missing-continuity", `event "${ev.id}" references continuity "${cid}" which is not catalogued`, ev.id));
    if (ev.eventType === "transition") {
      const from = ev.transitionFromContinuityId || ev.transitionFromLabel, to = ev.transitionToContinuityId || ev.transitionToLabel;
      if (!from || !to) f.push(W("transition-no-endpoints", `transition event "${ev.id}" lacks a ${!from ? "from" : "to"} endpoint`, ev.id));
      if (ev.transitionFromContinuityId && ctx.continuities && !ctx.continuities.has(ev.transitionFromContinuityId)) f.push(E("transition-missing-continuity", `"${ev.id}" transition-from continuity "${ev.transitionFromContinuityId}" does not exist`, ev.id));
      if (ev.transitionToContinuityId && ctx.continuities && !ctx.continuities.has(ev.transitionToContinuityId)) f.push(E("transition-missing-continuity", `"${ev.id}" transition-to continuity "${ev.transitionToContinuityId}" does not exist`, ev.id));
      if (ev.transitionFromContinuityId && ev.transitionFromContinuityId === ev.transitionToContinuityId) f.push(E("transition-self", `"${ev.id}" transitions from a continuity to itself`, ev.id));
    }
    const dupStories = (ev.coreStoryIds || []).filter((x, i, a) => a.indexOf(x) !== i);
    if (dupStories.length) f.push(W("event-duplicate-story-edge", `event "${ev.id}" lists core story ${[...new Set(dupStories)].join(", ")} more than once`, ev.id));
  }
  // issue membership (from the issues that name the event)
  const memberCount = new Map();
  if (ctx.issuesByEvent) for (const [eid, list] of ctx.issuesByEvent) {
    const ids = list.map(i => i.id), dup = ids.filter((x, i) => ids.indexOf(x) !== i);
    if (dup.length) f.push(W("event-duplicate-issue", `event "${eid}" lists issue ${[...new Set(dup)].join(", ")} more than once`, eid));
    memberCount.set(eid, ids.length);
    if (!byId.has(eid)) f.push(W("orphan-event-reference", `issues reference event "${eid}" which has no event record`, eid));
  }
  for (const ev of events || []) {
    if (!ev?.id) continue;
    const n = memberCount.get(ev.id) || 0, rels = (ctx.relationships || []).filter(r => r.sourceId === ev.id || r.targetId === ev.id).length;
    if (!n && !(ev.coreStoryIds || []).length && !rels) f.push(I("event-no-connected-material", `event "${ev.id}" has no participating issues, core stories or relationships yet (shown honestly as "not mapped yet")`, ev.id));
  }
  // relationships
  const seenRel = new Set(), succ = new Map();
  for (const r of ctx.relationships || []) {
    if (!r) continue;
    const touchesEvent = r.sourceType === "event" || r.targetType === "event";
    if (!touchesEvent) continue;
    if (r.sourceId === r.targetId) { f.push(E("relationship-self", `relationship "${r.id}" points an entity at itself`, r.id)); continue; }
    if (!ENTITY_TYPES.includes(r.sourceType) || !ENTITY_TYPES.includes(r.targetType)) f.push(E("relationship-bad-entity-type", `relationship "${r.id}" has an unknown entity type`, r.id));
    if (!RELATIONSHIP_TYPES.includes(r.relationshipType)) f.push(W("relationship-type-outside-set", `relationship "${r.id}" uses "${r.relationshipType}" outside the starting set`, r.id));
    const key = `${r.sourceId}|${r.relationshipType}|${r.targetId}`;
    if (seenRel.has(key)) f.push(W("relationship-duplicate-edge", `duplicate edge ${key}`, r.id)); seenRel.add(key);
    if (r.sourceType === "event" && !byId.has(r.sourceId) && ctx.knownEntity && !ctx.knownEntity("event", r.sourceId)) f.push(E("relationship-missing-entity", `relationship "${r.id}" source event "${r.sourceId}" does not exist`, r.id));
    if (r.targetType === "event" && !byId.has(r.targetId) && ctx.knownEntity && !ctx.knownEntity("event", r.targetId)) f.push(E("relationship-missing-entity", `relationship "${r.id}" target event "${r.targetId}" does not exist`, r.id));
    if (r.relationshipType === "part_of_event" && r.targetType !== "event" && r.targetType !== "story") f.push(W("relationship-semantic-mismatch", `part_of_event "${r.id}" targets a ${r.targetType}`, r.id));
    if (r.relationshipType === "impacts" && r.sourceType !== "event") f.push(W("relationship-semantic-mismatch", `impacts "${r.id}" should run from an event`, r.id));
    if (ORDERING_RELATIONSHIP_TYPES.includes(r.relationshipType) && r.sourceType === "event" && r.targetType === "event") {
      const a = r.relationshipType === "prequel_to" ? r.targetId : r.sourceId, b = r.relationshipType === "prequel_to" ? r.sourceId : r.targetId; // a follows b
      if (!succ.has(b)) succ.set(b, new Set()); succ.get(b).add(a);
    }
  }
  // circular predecessor/successor chain
  const visiting = new Set(), done = new Set();
  const dfs = (n, path) => {
    if (done.has(n)) return; if (visiting.has(n)) { f.push(E("event-chain-cycle", `circular event chain: ${[...path.slice(path.indexOf(n)), n].join(" → ")}`, n)); return; }
    visiting.add(n); for (const m of succ.get(n) || []) dfs(m, [...path, n]); visiting.delete(n); done.add(n);
  };
  for (const n of succ.keys()) dfs(n, []);
  // a Story that other records treat as an event (legacy inference) — reported, never changed
  for (const sid of ctx.legacyEventStories || []) f.push(W("story-marked-as-event", `story "${sid}" is only event-like by legacy inference (another story's eventId / part_of_event target) — needs owner review`, sid));
  return { errors: f.filter(x => x.severity === "ERROR"), warnings: f.filter(x => x.severity === "WARNING"), info: f.filter(x => x.severity === "INFO"), findings: f, valid: !f.some(x => x.severity === "ERROR") };
}
