// ============================================================================
// comics-v2 / flashpoint-core.js — PHASE 5 FIX: the MINIMUM rich-catalogue bridge for the Flashpoint transition event.
// The owner's transition record (new52-map-data.js → transitionEvents["transition-new52"]) names five core issues and four editions, but the rich catalogue
// (comicSeries / comicStories / comicIssues / comicCollections) had no Flashpoint records, so the Event could not link to anything real.
// This module builds exactly those records from that SAME transition record (no second copy of the data) and nothing more:
//   series  flashpoint-2011               story  flashpoint-2011-flashpoint        issues  flashpoint-2011-001 … -005
//   collections: only the editions the transition record lists that are real collected editions (Hardcover, Trade Paperback, Omnibus / Complete Event).
//   "Single Issues" is not a collected edition — the five issues themselves are that entry.
// Pure + deterministic. Nothing here invents dates, creators, characters, ISBNs, page counts or tie-ins. Writes are done by seed-events.js (create-if-absent).
// ============================================================================
import { transitionEvents } from "./new52-map-data.js?v=4";
import { makeSeries, makeStory, makeIssue, makeCollection, makeSourceInfo } from "./schema.js";
import { buildSeriesId, buildStoryId, buildIssueId, buildCollectionId } from "./slug.js";

export const FLASHPOINT_EVENT_ID = "flashpoint";
export const FLASHPOINT_TRANSITION_ID = "transition-new52";   // the owner's transition record this bridge is built from
export const FLASHPOINT_SERIES_ID = buildSeriesId("Flashpoint", 2011);                      // "flashpoint-2011"
export const FLASHPOINT_STORY_ID = buildStoryId(FLASHPOINT_SERIES_ID, "Flashpoint");        // "flashpoint-2011-flashpoint"
const UNIVERSE_ID = "dc-universe";
const OWNER = "owner-supplied New 52 map data (new52-map-data.js, transition-new52)";
const DC_BLOG = "https://www.dc.com/blog/2016/10/03/dc-comics-101-why-is-flashpoint-so-important";

const record = () => transitionEvents.find(t => t.id === FLASHPOINT_TRANSITION_ID) || null;
/** "Flashpoint #3" → "3" (only plain numbered labels; anything else is left out rather than guessed). */
export function flashpointIssueLabels() {
  const t = record();
  return ((t && t.issues) || []).map(s => (String(s).match(/#\s*(\d+)\s*$/) || [])[1]).filter(Boolean);
}
const FORMAT = { "Hardcover": ["Hardcover", "-hc", "mainline"], "Trade Paperback": ["Trade Paperback", "-tpb", "mainline"], "Omnibus / Complete Event": ["Omnibus / Complete Event", "-complete-event", "crossover"] };

/** → { series, story, issues, collections, skipped:[reason…] } — all create-if-absent records. */
export function buildFlashpointBridge() {
  const t = record(), labels = flashpointIssueLabels(), skipped = [];
  if (!t || !labels.length) return { series: null, story: null, issues: [], collections: [], skipped: ["transition-new52 has no numbered core issues — nothing to bridge"] };
  const own = (notes, extra = {}) => makeSourceInfo({ sourceName: OWNER, sourceType: "other", verificationStatus: "unverified", notes, ...extra });
  const series = makeSeries({
    id: FLASHPOINT_SERIES_ID, title: "Flashpoint", publisher: "DC Comics", startDate: "2011", endDate: "2011", issueCount: labels.length,
    universeId: UNIVERSE_ID, continuityIds: [], characterIds: [], creatorIds: [], description: "",
    sourceInfo: makeSourceInfo({
      sourceUrl: DC_BLOG, sourceName: "DC.com — \"DC Comics 101: Why is Flashpoint So Important?\" + owner transition record", sourceType: "official", verificationStatus: "partially_verified",
      notes: "DC's own page confirms Flashpoint as a 2011 miniseries by Geoff Johns and Andy Kubert. The five-issue count and issue list come from the owner's transition record; the dc.com issue pages could not be fetched when this was built. No continuity is attached: Flashpoint bridges Pre-Flashpoint and the New 52 (see the Flashpoint event).",
    }),
  });
  Object.assign(series, { categoryKey: "other-dc-heroes" }); // a placement in the existing category list (not "Other / Obscure": a five-issue DC event series); change here if you prefer another
  const issues = labels.map(n => makeIssue({
    id: buildIssueId(FLASHPOINT_SERIES_ID, n), seriesId: FLASHPOINT_SERIES_ID, issueNumber: n, issueLabel: `#${n}`, issueLabelType: "numbered",
    storyIds: [FLASHPOINT_STORY_ID], eventIds: [], universeId: UNIVERSE_ID,
    sourceInfo: own("Core issue of the Flashpoint miniseries as listed in the owner's transition record. No date, creator or character data recorded."),
  }));
  const story = makeStory({
    id: FLASHPOINT_STORY_ID, title: "Flashpoint", seriesIds: [FLASHPOINT_SERIES_ID], issueIds: issues.map(i => i.id), universeId: UNIVERSE_ID, eventId: FLASHPOINT_EVENT_ID,
    sourceInfo: own("The core Flashpoint story (the five-issue main series). The Flashpoint EVENT is a separate record that points to this story."),
  });
  const collections = [];
  (t.editions || []).forEach(ed => {
    const f = FORMAT[ed.format];
    if (!f) { skipped.push(`edition "${ed.format}": not a collected edition — the five issues themselves are the record`); return; }
    const c = makeCollection({
      id: buildCollectionId("Flashpoint") + f[1], title: "Flashpoint", format: f[0], seriesIds: [FLASHPOINT_SERIES_ID], storyIds: [FLASHPOINT_STORY_ID],
      issueCoverage: issues.map(i => ({ seriesId: FLASHPOINT_SERIES_ID, issueId: i.id, issueLabel: i.issueLabel, coveragePart: "complete" })),
      sourceInfo: own(`Edition recorded in the owner's transition record (${ed.format}; coverage "${ed.coverage}").${ed.notes ? " " + ed.notes : ""} Title, ISBN, date and page count are not recorded.`),
    });
    Object.assign(c, { role: f[2], primarySeriesId: FLASHPOINT_SERIES_ID });
    if (f[2] === "crossover") c.crossover = true;
    collections.push(c);
  });
  return { series, story, issues, collections, skipped };
}
