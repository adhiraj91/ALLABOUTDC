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
import { FLASHPOINT_SERIES_ID, FLASHPOINT_STORY_ID, flashpointIssueLabels } from "./flashpoint-core.js?v=fp2";
import { buildIssueId } from "./slug.js";
import { makeEvent, makeRelationship, makeSourceInfo, EVENT_TYPES, ENTITY_TYPES, RELATIONSHIP_TYPES, ORDERING_RELATIONSHIP_TYPES } from "./schema.js";

export const UNIVERSE_ID = "dc-universe";
export const NEW52_CONTINUITY_ID = "the-new-52";
export const FLASHPOINT_ID = "flashpoint";
/** transition record id → canonical Event id (one mapping, used by the era transition view so both screens show the SAME event). */
export const TRANSITION_EVENT_IDS = { "transition-new52": FLASHPOINT_ID };
const OWNER = "owner-supplied New 52 map data (new52-map-data.js)";
const src = (notes, extra = {}) => makeSourceInfo({ sourceName: OWNER, sourceType: "other", verificationStatus: "unverified", notes, ...extra });

// Spine "type" → Event.eventType. "story" is not an event at all (Court of Owls stays a Story arc).
const TYPE_OF = { crossover: "crossover", event: "event", multiverse: "multiverse", transition: "transition" };

// Explicit membership. labels are issue labels exactly as the catalogue stores them (slug.buildIssueId(seriesId,label) gives the issue id).
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => String(a + i));
// Each spec: {seriesId, labels, from} — `from` is the exact segment of the owner's wording that this spec transcribes (validated: it must occur in the
// wording). It lets recordedMaterial keep ONLY what is not already a catalogue issue; the rest of the wording stays as recorded text.
const FUTURES_END_SPECIAL_SERIES = ["action-comics-2011", "aquaman-2011", "aquaman-and-the-others-2014", "batgirl-2011", "batman-2011", "batman-and-robin-2011", "batman-superman-2013", "batwing-2011", "batwoman-2011", "birds-of-prey-2011", "constantine-2013", "detective-comics-2011", "earth-2-2012", "grayson-2014", "green-arrow-2011", "justice-league-dark-2011", "justice-league-united-2014", "nightwing-2011", "red-hood-and-the-outlaws-2011", "red-lanterns", "sinestro", "superboy-2011", "supergirl-2011", "swamp-thing-2011", "teen-titans-2011", "the-flash-2011", "trinity-of-sin-pandora-2013", "trinity-of-sin-phantom-stranger-2012", "wonder-woman-2011", "worlds-finest-2012"];
export const MEMBERS = {
  // Flashpoint #1–5: the core bridge (flashpoint-core.js builds these catalogue records from the same owner transition record).
  "flashpoint":      flashpointIssueLabels().map(n => ({ seriesId: FLASHPOINT_SERIES_ID, labels: [n], from: `Flashpoint #${n}` })),
  "night-of-owls":   [{ seriesId: "batman-2011", labels: range(8, 11), from: "Batman #8–11" }, { seriesId: "batman-2011", labels: ["Annual 1"], from: "Annual #1" }],
  "death-family":    [{ seriesId: "batman-2011", labels: range(13, 17), from: "Batman #13–17" }],
  "throne-atlantis": [{ seriesId: "justice-league-2011", labels: range(13, 17), from: "Justice League #13–17" }, { seriesId: "aquaman-2011", labels: range(15, 16), from: "Aquaman #15–16" }],
  "rotworld":        [{ seriesId: "animal-man-2011", labels: range(12, 17), from: "Animal Man #12–17" }, { seriesId: "swamp-thing-2011", labels: range(12, 18), from: "Swamp Thing #12–18" },
                      { seriesId: "frankenstein-agent-of-s-h-a-d-e-2011", labels: range(13, 16), evidence: "branch-paths.js dark-rotworld (owner branching CSV ROTWORLD): branch_to \"Animal Man #12-17; Swamp Thing #12-18; Frankenstein #13-16\"" }],
  "trinity-war":     [{ seriesId: "justice-league-2011", labels: range(22, 23), from: "Justice League #22–23" }, { seriesId: "justice-league-of-america-2013", labels: range(6, 7), from: "Justice League of America #6–7" },
                      { seriesId: "justice-league-dark-2011", labels: range(22, 23), from: "Justice League Dark #22–23" }, { seriesId: "trinity-of-sin-pandora-2013", labels: range(1, 3), from: "Pandora #1–3" },
                      { seriesId: "trinity-of-sin-phantom-stranger-2012", labels: ["11"], from: "Phantom Stranger #11" }, { seriesId: "constantine-2013", labels: ["5"], from: "Constantine #5" }],
  "lights-out":      [{ seriesId: "green-lantern", labels: range(24, 29), from: "Green Lantern #24–29" }],
  "darkseid-war":    [{ seriesId: "justice-league-2011", labels: range(40, 50), from: "Justice League #40–50" }],
  // Phase 5.1 closure — specs below carry `evidence` (no `from`) when the issue numbers come from another owner source in this repository instead of the spine wording.
  //   evidence strings are verified to occur in that source by the closure test; nothing here is inferred from titles or ranges.
  "forever-evil":    [{ seriesId: "justice-league-2011", labels: range(24, 29), evidence: "branch-paths.js jl-forever-evil (owner branching CSV FOREVER_EVIL): branch_to \"Forever Evil #1-7; Justice League #24-29\"" }],
  "red-daughter":    [{ seriesId: "green-lantern", labels: ["28"], evidence: "new52-map-data.js collection \"Supergirl Vol. 5: Red Daughter of Krypton\": \"Supergirl #26–33 + Green Lantern #28 + Red Lanterns #28–29\"" },
                      { seriesId: "red-lanterns", labels: ["28", "29"], evidence: "new52-map-data.js collection \"Supergirl Vol. 5: Red Daughter of Krypton\": \"Supergirl #26–33 + Green Lantern #28 + Red Lanterns #28–29\"" }],
  // the owner's "September 2014 Futures End specials": every catalogue issue the owner CSVs record as the series' "Futures End #1" special (type special). Listed explicitly; no pattern is applied at run time.
  "futures-end":     FUTURES_END_SPECIAL_SERIES.map(sid => ({ seriesId: sid, labels: ["Futures End #1"], from: "September 2014 Futures End specials" })),
  // Batman: Endgame and Robin Rises are NOT here: Phase 5 audit reclassified them as story arcs (see RETIRED_EVENTS).
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

// ---------------------------------------------------------------------------
// EVENT ENRICHMENT — the ONE place where an Event gets its explanation. Keyed by canonical event id; the generic builder below consumes it (nothing
// is hardcoded in the UI). Each description is an ORIGINAL paraphrase (1–3 sentences), written for readers, spoiler-conscious. `sources` lists ONLY pages that
// were actually fetched and read while writing it (`official` = dc.com). Status model unchanged: an event backed by a fetched dc.com page is
// "partially_verified" (the premise is confirmed; identity/membership remain the owner's data); otherwise "unverified". Nothing is marked "verified".
// An event with no safe description is simply absent from this map — the importer reports why (see NO_DESCRIPTION).
// ---------------------------------------------------------------------------
const DC = "https://www.dc.com/blog/";
export const EVENT_ENRICHMENT = {
  "night-of-owls": { description: "In spring 2012 the Court of Owls sends its Talon assassins against Gotham in a single night, and Batman and the wider Bat-family defend the city. Scott Snyder's Batman anchors a crossover that runs through the Bat-line's ongoing series — the New 52's first major crossover.",
    sources: [DC + "2012/02/22/cbr-s-talkin-about-the-night-of-the-owls", "https://en.wikipedia.org/wiki/Batman:_Night_of_the_Owls"], official: true },
  "death-family": { description: "The Joker returns to Gotham in 2012–13 and goes after Batman's closest allies rather than Batman alone. Scott Snyder and Greg Capullo's Batman is the core, with tie-ins running through the Bat-family titles.",
    sources: ["https://www.dccomics.com/blog/2012/10/04/52-reasons-were-excited-for-death-of-the-family", DC + "2012/10/14/nycc-2012-dc-comics-batman-death-comes-to-gotham"], official: true },
  "throne-atlantis": { description: "Arthur Curry is pulled between his place in the Justice League and his claim to Atlantis as tensions between the two worlds are pushed toward war. The story runs across Justice League and Aquaman and reshapes Aquaman's standing.",
    sources: ["https://www.dc.com/graphic-novels/aquaman-2011/aquaman-war-for-the-throne"], official: true },
  "rotworld": { description: "The Rot, an elemental force of death, overruns the world in a story shared by Animal Man (Jeff Lemire) and Swamp Thing (Scott Snyder). Buddy Baker and Alec Holland fight it in a corrupted future where heroes have been twisted into monsters.",
    sources: [DC + "2013/01/10/5-2-reasons-to-venture-into-rotworld"], official: true },
  "hel-earth": { description: "H'El, a Kryptonian outsider, arrives on Earth in late 2012 with a plan to restore Krypton and overpowers Superman, splitting the Super-family. Superman, Supergirl and Superboy share the crossover.",
    sources: [DC + "2012/08/10/announcing-hel-on-earth", "https://comicbookreadingorders.com/dc/events/superman-hel-on-earth-reading-order/"], official: true },
  "rise-third-army": { description: "The Guardians of the Universe decide the Green Lantern Corps' free will makes it unreliable and field an emotionless robotic force, the Third Army, to replace it. The 2012–13 story runs through the four main Green Lantern titles.",
    sources: [DC + "2012/07/03/rise-of-the-third-army", "https://comicbookreadingorders.com/dc/events/rise-of-the-third-army-reading-order/"], official: true },
  "wrath-first-lantern": { description: "Following Rise of the Third Army, the Corps and the Guardians' Third Army collide with the First Lantern, the original Lantern, in a 2013 story across the four main Green Lantern titles. It decides the fate of Hal Jordan and Sinestro.",
    sources: ["https://www.dc.com/graphic-novels/green-lantern-2011/green-lantern-wrath-of-the-first-lantern"], official: true },
  "lights-out": { description: "Relic, an ancient being, believes the Lantern power rings are failing and moves to wipe out Lanterns across the spectrum. The autumn 2013 story runs through the Green Lantern family titles and concludes in Green Lantern Annual #2.",
    sources: [DC + "2013/10/04/lights-out-concludes-in-green-lantern-annual-2", "https://www.howtolovecomics.com/2013/09/29/green-lantern-lights-out-reading-order-checklist/"], official: true },
  "trinity-war": { description: "In summer 2013 the three Justice League teams — Justice League, Justice League of America and Justice League Dark — are drawn into a conflict that forces them to take sides and reshapes the DC Universe heading into Forever Evil. Pandora, Phantom Stranger and Constantine titles carry the tie-ins.",
    sources: [DC + "2013/04/08/usa-today-announces-trinity-war", DC + "2013/04/25/trinity-war-tie-ins-announced"], official: true },
  "forever-evil": { description: "In late 2013 the Crime Syndicate, an evil counterpart of the Justice League, seizes Earth while the real League is out of action. Geoff Johns and David Finch's miniseries leads the event, with tie-in series and the Villains Month issues around it, through spring 2014.",
    sources: [DC + "2013/09/04/villains-month-kicks-off-today"], official: true },
  "blight": { description: "After the Crime Syndicate invasion, John Constantine sets out to rescue his missing allies and faces Blight, an entity embodying the world's evil. The story runs through Justice League Dark, Constantine and the two Trinity of Sin titles (Pandora and Phantom Stranger), and follows Forever Evil.",
    sources: [DC + "2013/10/04/whats-new-in-the-new-52-announcing-forever-evil-blight"], official: true },
  "krypton-returns": { description: "Superman, Superboy and Supergirl are thrown into Krypton's past, where H'El has taken over the planet. The 2013 Superman-family crossover begins in Action Comics Annual #2.",
    sources: [DC + "2013/09/13/whats-new-in-the-new-52-krypton-returns-launches-in-action-comics-annual-2", "https://comicbookreadingorders.com/dc/events/krypton-returns-reading-order/"], official: true },
  "doomed": { description: "Doomsday emerges, and Superman is infected while stopping it, slowly turning him into a Doomsday-like creature. The 2014 crossover runs through Action Comics, Superman, Superman/Wonder Woman and related titles.",
    sources: [DC + "2014/05/16/this-just-happened-is-superman-doomed", "https://en.wikipedia.org/wiki/Superman:_Doomed"], official: true },
  "red-daughter": { description: "Kara Zor-El, consumed by rage after repeated losses, takes up a Red Lantern ring during a split in that Corps. The Supergirl-led story crosses into Red Lanterns and the wider Green Lantern family.",
    sources: ["https://www.dc.com/blog/2026-06-22/girl-of-rage-revisiting-supergirl-red-daughter-of-krypton", "https://comicbookreadingorders.com/dc/events/red-daughter-of-krypton-reading-order/"], official: true },
  "uprising": { description: "In 2014 the Green Lantern Corps faces an open revolt by several species that reject its role as the universe's police force. The story runs through the Green Lantern and Green Lantern Corps titles.",
    sources: ["https://dc.fandom.com/wiki/Green_Lantern:_Uprising", "https://comicbookreadingorders.com/dc/events/green-lantern-uprising-reading-order/"], official: false },
  "futures-end": { description: "A weekly series (May 2014–April 2015) set five years beyond the New 52 present, where heroes confront a future overrun by Brother Eye. A September 2014 tie-in month echoed it across DC's ongoing titles, and it led into Convergence.",
    sources: [DC + "2013/12/11/associated-press-announces-the-new-52-futures-end", "https://en.wikipedia.org/wiki/The_New_52:_Futures_End"], official: true },
  "godhead": { description: "The New Gods, led by Highfather, try to breach the Source Wall at the edge of the universe and declare war on any Lantern who stands in their way. The autumn 2014 event runs through the Green Lantern family titles and ends in Green Lantern Annual #3.",
    sources: [DC + "2014/10/03/this-just-happened-godhead-opens-at-the-source-wall", "https://www.howtolovecomics.com/2014/10/11/green-lantern-godhead-reading-order/"], official: true },
  "darkseid-war": { description: "Darkseid and the Anti-Monitor wage a cosmic war that drags in the Justice League. Geoff Johns and Jason Fabok's story runs through Justice League from 2015 and reshapes the team's lineup.",
    sources: [DC + "2015/03/11/a-dark-day-dawning-geoff-johns-and-jason-fabok-discuss-darkseid-war", "https://dc.com/comics/justice-league-2011/justice-league-41"], official: true },
  "multiversity": { description: "Grant Morrison's 2014–15 project about the DC Multiverse, in which extradimensional invaders threaten many parallel Earths. Two bookend issues surround seven one-shots, each styled as a different kind of comic, plus a Guidebook cataloguing the Earths.",
    sources: ["https://en.wikipedia.org/wiki/The_Multiversity"], official: false },
  "convergence": { description: "In spring 2015 Brainiac holds cities from many eras and alternate histories on a planet outside time and pits their champions against each other. A weekly core series and 40 two-issue tie-ins temporarily replaced DC's regular titles, closing out the New 52 era.",
    sources: [DC + "2014/11/03/dc-entertainment-announces-major-publishing-event-convergence", DC + "2015/04/01/convergence-101-a-new-readers-guide", "https://en.wikipedia.org/wiki/Convergence_(comics)"], official: true },
};

/** Events that were imported as crossovers in the first Phase 5 pass but are, on the evidence, STORY ARCS (the Court of Owls pattern: a Story, never an Event).
 *  They are no longer built or imported. The importer never deletes: it reports an existing record, removes only the link IDs it wrote itself from issue.eventIds,
 *  and detaches the stale record from the continuity listing. Evidence (official dc.com collected-edition pages + secondary tie-in lists) is in the notes. */
export const RETIRED_EVENTS = [
  { id: "endgame", title: "Batman: Endgame", now: "story arc",
    reason: "DC's collected-edition page presents Endgame as the Joker story of Batman #35–40 within Snyder's run; the tie-ins (Batman Annual #3, Arkham Manor / Batgirl / Detective Comics / Gotham Academy: Endgame one-shots) are ancillary single issues. Tie-ins do not turn a story arc into an Event. The Story stays a Batman story arc; the tie-ins are not catalogued." },
  { id: "robin-rises", title: "Robin Rises", now: "story arc",
    reason: "DC describes it as a storyline within Batman and Robin (#35–40, with the Alpha and Omega one-shots by the same team); it involves one series, not a multi-series crossover." },
];

/** ONE semantic rule: an id is a retired/reclassified Event when RETIRED_EVENTS names it OR the owner's spine types it "story" (the Court of Owls pattern).
 *  Everything that lists, opens, relates or graphs Events filters through this, so a stale Firestore comicEvents document can never override the classification. */
const RETIRED_IDS = new Set([...RETIRED_EVENTS.map(r => r.id), ...crossoverSpine.filter(e => e.type === "story").map(e => e.id)]);
export const retiredEventIds = () => [...RETIRED_IDS];
export const isRetiredEvent = id => RETIRED_IDS.has(id);
export const activeEventsOnly = list => (list || []).filter(e => e && !RETIRED_IDS.has(e.id));

/** Dedicated event EDITIONS whose stored issueCoverage is accepted as membership evidence (explicit issue ids already in the catalogue, declared by the owner's
 *  branch definition as that event's own edition). Mixed series volumes are deliberately NOT listed (e.g. "Aquaman Vol. 3" also holds #0 and #14, which are not part of
 *  Throne of Atlantis). The importer reads these collections (one batched read) and unions their issue ids with MEMBERS; ids that do not exist are reported, never created. */
export const EDITION_MEMBERSHIP = {
  "death-family": ["the-joker-death-of-the-family", "the-joker-death-of-the-family-hc"],
  "hel-earth": ["superman-hel-on-earth"],
  "doomed": ["superman-doomed"],
  "rise-third-army": ["green-lantern-rise-of-the-third-army"],
  "wrath-first-lantern": ["green-lantern-the-wrath-of-the-first-lantern"],
  "lights-out": ["green-lantern-lights-out"],
  "godhead": ["green-lantern-new-gods-godhead"],
  "blight": ["forever-evil-blight"],
  "krypton-returns": ["superman-krypton-returns"],   // owner-supplied crossover edition: coverage exactly as supplied
  "uprising": ["green-lantern-corps-vol-5-uprising"], // DC-confirmed contents: GL Corps #28–34 + Green Lantern #31–33 + Annual #2
  "red-daughter": ["supergirl-vol-5-red-daughter-of-krypton"], // Supergirl #26–33 (Green Lantern #28 + Red Lanterns #28–29 are MEMBERS evidence specs)
};

/** Differences between the owner's data and what was read while enriching — reported by the importer, NEVER auto-corrected. */
export const OWNER_REVIEW = [
  { id: "throne-atlantis", note: "Owner membership is Justice League #13–17 + Aquaman #15–16. DC's 'Aquaman: War for the Throne' page lists Aquaman #0 and #14–16 with Justice League #15–17. Owner data left unchanged." },
  { id: "lights-out", note: "Owner membership is Green Lantern #24–29. Secondary reading orders place Lights Out at Green Lantern #24, Green Lantern Corps #24, New Guardians #23–24, Red Lanterns #24 and Annual #2. Owner data left unchanged." },
  { id: "convergence", note: "Owner data bridges Convergence to 'Rebirth'. DC's pages describe it as following Futures End and Earth 2: World's End; secondary sources place the 'DC You' line (June 2015) between Convergence and Rebirth. The 'Rebirth' label is left as owner-supplied." },
  { id: "red-daughter", note: "Sources disagree on the year (2014 vs 2015); the description avoids a year." },
  { id: "multiversity", note: "Description rests on a single secondary source; no dc.com page could be fetched." },
  { id: "uprising", note: "Description rests on secondary sources only (DC Fandom, a reading-order site); they list Green Lantern and Green Lantern Corps, not New Guardians / Red Lanterns as the owner wording does." },
];

const wordingOf = (sp) => sp.issues || "";
const issueIdsOf = (eventId, seg) => (MEMBERS[eventId] || []).filter(m => m.from === seg).flatMap(m => m.labels.map(l => buildIssueId(m.seriesId, l)));
/** recordedMaterial = the owner's wording as RECORDED. Segments that a MEMBERS spec transcribes carry `issueIds`, so a reader screen can drop them once those
 *  catalogue issues resolve; the rest of the wording (tie-ins, "+ special material") is kept as plain recorded text without ids. */
function recordedMaterialFor(sp) {
  const wording = wordingOf(sp), specs = MEMBERS[sp.id] || [];
  if (!wording) return [];
  let rest = wording;
  const out = [];
  for (const m of specs) {
    if (!m.from || !wording.includes(m.from)) continue;
    const ids = m.labels.map(l => buildIssueId(m.seriesId, l)), prev = out.find(o => o.label === m.from);
    if (prev) { prev.issueIds.push(...ids); continue; } // several specs may transcribe one wording segment (e.g. the Futures End specials)
    rest = rest.replace(m.from, "");
    out.push({ label: m.from, role: "summary", issueIds: ids });
  }
  const left = rest.replace(/^[\s+;,]+|[\s+;,]+$/g, "").replace(/\s*[+;,]\s*[+;,]+\s*/g, " + ").replace(/^with\s+/i, "with ");
  const tail = left.replace(/[\s+;,]+/g, "") ? left : "";
  if (out.length === 0) return [{ label: wording, role: "summary" }];
  if (tail) out.push({ label: tail, role: "summary" });
  return out;
}

/** Builds every Event record from the owner map data + the enrichment map. Pure + deterministic: same input → same output. */
export function buildEvents() {
  const out = [];
  for (const sp of crossoverSpine) {
    if (!TYPE_OF[sp.type]) continue; // story → not an event (Court of Owls, Batman: Endgame, Robin Rises)
    const eventType = TYPE_OF[sp.type];
    const en = EVENT_ENRICHMENT[sp.id];
    const official = !!(en && en.official);
    const ev = makeEvent({
      id: sp.id, title: sp.title, eventType, universeId: UNIVERSE_ID, continuityIds: [NEW52_CONTINUITY_ID],
      description: en ? en.description : "",
      readingPathIds: READING_PATHS[sp.id] || [],
      recordedMaterial: recordedMaterialFor(sp),
      sourceInfo: en
        ? makeSourceInfo({ sourceUrl: en.sources[0], sourceName: official ? "DC.com + owner-supplied New 52 map data" : "Secondary sources + owner-supplied New 52 map data", sourceType: official ? "official" : "other",
            verificationStatus: official ? "partially_verified" : "unverified",
            notes: `The description is an original paraphrase written from: ${en.sources.join(" ; ")}. Identity, type and issue membership come from the owner's map data (crossoverSpine["${sp.id}"]) and were not independently re-verified.` })
        : src(`Identity and the wording of its material come from crossoverSpine["${sp.id}"]; participating issues (if any) are transcribed from that wording. No description could be safely sourced (see NO_DESCRIPTION).`),
    });
    if (sp.type === "transition") { // Convergence: owner data (transitionEvents "transition-rebirth") says New 52 → Rebirth
      ev.transitionFromContinuityId = NEW52_CONTINUITY_ID;
      ev.transitionToContinuityId = null; ev.transitionToLabel = "Rebirth";
    }
    out.push(ev);
  }
  const fp = transitionEvents.find(t => t.id === "transition-new52");
  if (fp) {
    const en = EVENT_ENRICHMENT[FLASHPOINT_ID];
    out.push(makeEvent({
      id: FLASHPOINT_ID, title: fp.title, eventType: "transition", universeId: UNIVERSE_ID, continuityIds: [],
      description: en ? en.description : fp.summary, coreStoryIds: [FLASHPOINT_STORY_ID],
      transitionFromContinuityId: null, transitionFromLabel: "Pre-Flashpoint", // no Pre-Flashpoint continuity record exists yet
      transitionToContinuityId: NEW52_CONTINUITY_ID,
      recordedMaterial: (fp.issues || []).map(label => {
        const n = (String(label).match(/^Flashpoint #(\d+)$/) || [])[1];
        return n ? { label, role: "core", issueIds: [buildIssueId(FLASHPOINT_SERIES_ID, n)] } : { label, role: "core" };
      }),
      sourceInfo: src('Transcribed from transitionEvents["transition-new52"]. Its core story and five core issues are catalogue records built from that same record by flashpoint-core.js; tie-ins and further material are not catalogued. Creators, the 2011 miniseries and its link to the New 52 relaunch are confirmed by DC\'s own pages (https://www.dc.com/blog/2016/10/03/dc-comics-101-why-is-flashpoint-so-important ; https://www.dc.com/blog/2011/07/21/august-31st-is-just-the-beginning-eddie-berganza-how-flashpoint-5-leads-into-dc-comics-the-new-52).',
        { sourceUrl: "https://www.dc.com/blog/2016/10/03/dc-comics-101-why-is-flashpoint-so-important", sourceType: "official", verificationStatus: "partially_verified" }),
    }));
  }
  return out;
}

/** Pure: the MEMBERS table must agree with the owner's spine. Every `from` segment must occur in the wording it transcribes; retired ids must not be built. */
export function validateMembers() {
  const errs = [], byId = new Map(crossoverSpine.map(e => [e.id, e]));
  for (const [id, specs] of Object.entries(MEMBERS)) {
    if (id === FLASHPOINT_ID) { if (!specs.length) errs.push("flashpoint has no member specs"); continue; }
    const sp = byId.get(id);
    if (!sp) { errs.push(`MEMBERS["${id}"] has no crossoverSpine record`); continue; }
    if (!TYPE_OF[sp.type]) errs.push(`MEMBERS["${id}"] belongs to a spine record of type "${sp.type}", which is not an Event`);
    for (const m of specs) {
      if (!m.labels || !m.labels.length) errs.push(`MEMBERS["${id}"] spec for ${m.seriesId} has no labels`);
      if (!m.from && !m.evidence) errs.push(`MEMBERS["${id}"] spec for ${m.seriesId} has neither a wording segment nor evidence`);
      else if (m.from && !(sp.issues || "").includes(m.from)) errs.push(`MEMBERS["${id}"] segment "${m.from}" does not occur in the owner wording "${sp.issues}"`);
    }
  }
  for (const [id, specs] of Object.entries(MEMBERS)) { // duplicate membership: the same issue id twice for one event
    const seen = new Set();
    for (const m of specs) for (const l of m.labels) { const iid = buildIssueId(m.seriesId, l); if (seen.has(iid)) errs.push(`MEMBERS["${id}"] lists issue "${iid}" twice`); seen.add(iid); }
  }
  const built = new Set(buildEvents().map(e => e.id));
  for (const id of Object.keys(EDITION_MEMBERSHIP)) if (!built.has(id)) errs.push(`EDITION_MEMBERSHIP["${id}"] is not an active event`);
  for (const id of built) if (!staticMemberCount(id) && !(EDITION_MEMBERSHIP[id] || []).length && !(MEMBERSHIP_UNRESOLVED[id] || []).length) errs.push(`event "${id}" has no membership source and no stated reason (unexplained missing membership)`);
  for (const id of Object.keys(MEMBERSHIP_UNRESOLVED)) if (!built.has(id)) errs.push(`MEMBERSHIP_UNRESOLVED["${id}"] is not an active event`);
  for (const id of built) if (RETIRED_IDS.has(id)) errs.push(`active event "${id}" is also retired`);
  for (const r of RETIRED_EVENTS) if (built.has(r.id)) errs.push(`retired event "${r.id}" is still being built`);
  return errs;
}

/** Evidence-based reasons why an Event's issue membership cannot be taken further (hand-audited against the catalogue, the collections, the branch CSV and the owner wording).
 *  An Event with resolvable issues and NO entry here is FULLY MAPPED; with entries it is PARTIALLY MAPPED; with no resolvable issues it is NO SAFE ISSUE MAPPING.
 *  Nothing here creates membership — it only explains what stays unresolved. */
const EDITION_ONLY = "wording is non-specific; membership is limited to the dedicated collected edition's issueCoverage";
export const MEMBERSHIP_UNRESOLVED = {
  "night-of-owls":   ["\"with Batman-family tie-ins\" — the wording names no issues and no collected edition is declared for this event"],
  "death-family":    ["Teen Titans #15 and pages of Suicide Squad #14–15 / Teen Titans #14, #16 — the edition records them as out-of-scope or partial contents, not whole catalogue issues"],
  "hel-earth":       ["\"crossover chapters\" — " + EDITION_ONLY],
  "rise-third-army": ["\"Green Lantern family crossover\" — " + EDITION_ONLY],
  "wrath-first-lantern": ["\"Green Lantern family crossover\" — " + EDITION_ONLY],
  "lights-out":      ["Corps / New Guardians / Red Lanterns tie-ins beyond the edition's coverage — the wording names no issue numbers"],
  "forever-evil":    ["Forever Evil #1–7 — no Forever Evil series or issue records exist in the catalogue (the owner's edition lists it as out-of-scope contents and the branch CSV says not to create duplicate issue records)",
                      "\"major tie-ins\" — non-specific; only Justice League #24–29 is explicit (owner branch CSV)"],
  "blight":          ["\"others\" — " + EDITION_ONLY],
  "krypton-returns": ["\"Superman-family crossover\" — " + EDITION_ONLY],
  "doomed":          ["\"+ tie-ins\" and Superman: Doomed #1–2 (a separate one-shot the edition lists as out-of-scope contents) — " + EDITION_ONLY],
  "red-daughter":    ["Supergirl / Red Lanterns / Green Lantern family beyond Supergirl #26–33, Green Lantern #28 and Red Lanterns #28–29 — no further issue numbers are recorded"],
  "uprising":        ["New Guardians / Red Lanterns chapters — the edition's coverage lists none and no issue numbers are recorded"],
  "futures-end":     ["Futures End #0–48 — the weekly series has no series or issue records in the catalogue",
                      "specials of any series without a \"Futures End #1\" record in the catalogue — not present, so not linked"],
  "godhead":         ["\"Green Lantern family\" — " + EDITION_ONLY, "New Gods: Godhead #1 — listed by the edition as out-of-scope contents, no catalogue record"],
  "darkseid-war":    ["\"special material\" — Justice League: Darkseid War Special #1 and the Divergence #1 Justice League story are out-of-scope contents of the editions, with no catalogue records"],
  "multiversity":    ["Multiversity #1–2, the seven one-shots and the guidebook — the catalogue has no Multiversity series or issue records and no collection with issueCoverage; the owner map holds titles only"],
  "convergence":     ["Convergence #0–8 and the 40 two-part tie-ins — the catalogue has no Convergence series, issue records or event collection; \"Sneak Peek\" mentions inside other collections are out-of-scope contents, not membership"],
};
export const MEMBERSHIP_STATES = ["FULLY MAPPED", "PARTIALLY MAPPED", "NO SAFE ISSUE MAPPING"];
/** Pure: the explicit membership state of one Event given how many of its canonical issue ids actually resolve in the catalogue. */
export function membershipState(eventId, resolvedCount) {
  const reasons = MEMBERSHIP_UNRESOLVED[eventId] || [];
  const state = resolvedCount <= 0 ? MEMBERSHIP_STATES[2] : reasons.length ? MEMBERSHIP_STATES[1] : MEMBERSHIP_STATES[0];
  return { state, reasons };
}
/** Pure: planned issue-id count per event from the static sources (MEMBERS only; edition coverage is read from the catalogue at import time). */
export const staticMemberCount = id => (MEMBERS[id] || []).reduce((n, m) => n + m.labels.length, 0);

/** Events that have no description and why (reported by the importer; the reader screen simply hides an empty explanation). */
export function eventsWithoutDescription() {
  return buildEvents().filter(e => !e.description).map(e => ({ id: e.id, title: e.title, reason: "no source that could be fetched and read supports a safe description" }));
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
