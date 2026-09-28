// ============================================================================
// comics-v2 / seed-batman-new52.js
// ----------------------------------------------------------------------------
// PHASE 2 — first real, researched dataset for the comics-v2 domain model:
// the connected New 52 Batman ecosystem (9 series, kept SEPARATE, connected
// through continuity/character/story/relationship/reading-path entities —
// never merged into one "Batman New 52" blob).
//
// Every entity below is built with the Phase 1 factories in schema.js and
// every id with the Phase 1 builders in slug.js — nothing here invents a new
// shape or a new id scheme.
//
// RESEARCH DISCIPLINE (see final report for full source list):
//   - Only facts confirmed by an official DC source (dc.com collection pages,
//     DC's own solicitation text) or corroborated by 2+ independent
//     secondary sources (Wikipedia, DC Database, established review outlets,
//     retailer listings quoting DC's own solicitation copy) are marked
//     "verified" / "partially_verified".
//   - Anything not independently confirmed is left null and called out below
//     and in the final report. Nothing here is guessed.
// ============================================================================
import {
  makeUniverse, makeContinuity, makeCharacter, makeSeries, makeRun, makeStory,
  makeIssue, makeCollection, makeCreator, makeRelationship, makeReadingPath,
  makeSourceInfo,
  validateUniverse, validateContinuity, validateCharacter, validateSeries,
  validateRun, validateStory, validateIssue, validateCollection,
  validateCreator, validateRelationship, validateReadingPath,
} from "./schema.js";
import {
  buildUniverseId, buildContinuityId, buildCharacterId, buildCreatorId,
  buildSeriesId, buildRunId, buildStoryId, buildIssueId, buildCollectionId,
  buildRelationshipId, buildReadingPathId, slugify,
} from "./slug.js";

/* ---------------------------------------------------------------------------
   Small source-info helpers so every record below states exactly where its
   facts came from and how confident we are, instead of repeating the same
   object literal 150 times.
--------------------------------------------------------------------------- */
const officialDC = (url, notes, status = "verified") => makeSourceInfo({
  sourceUrl: url, sourceName: "DC.com (official collection/series page)",
  sourceType: "official", verificationStatus: status, notes,
});
const wikiSrc = (url, notes, status = "partially_verified") => makeSourceInfo({
  sourceUrl: url, sourceName: "Wikipedia", sourceType: "wiki",
  verificationStatus: status, notes,
});
const dbSrc = (url, notes, status = "partially_verified") => makeSourceInfo({
  sourceUrl: url, sourceName: "DC Database / comics bibliographic source",
  sourceType: "database", verificationStatus: status, notes,
});
const retailerSrc = (url, notes, status = "partially_verified") => makeSourceInfo({
  sourceUrl: url, sourceName: "Retailer/reference listing corroborating official solicitation text",
  sourceType: "retailer", verificationStatus: status, notes,
});
const unverified = (notes) => makeSourceInfo({ verificationStatus: "unverified", notes });

/* ============================================================================
   1. UNIVERSE / CONTINUITY
   ========================================================================= */
const UNIVERSE_ID = buildUniverseId("DC Universe");
const universes = [
  makeUniverse({
    id: UNIVERSE_ID,
    name: "DC Universe",
    description: "The shared main-line DC Comics publishing universe. Contains multiple sequential/parallel continuities over time (pre-Crisis, post-Crisis/Modern Age, the New 52/Prime Earth, DC Rebirth, Infinite Frontier, etc.) rather than a single fixed continuity.",
    continuityIds: [], // filled below once continuity ids exist
    characterIds: [],
    sourceInfo: wikiSrc("https://en.wikipedia.org/wiki/DC_Universe", "General publisher-universe framing; not tied to one specific article fetch.", "partially_verified"),
  }),
];

const CONT_PRE_FLASHPOINT = buildContinuityId("Pre-Flashpoint DC Universe");
const CONT_NEW52 = buildContinuityId("The New 52");
const CONT_REBIRTH = buildContinuityId("DC Rebirth");

const continuities = [
  makeContinuity({
    id: CONT_PRE_FLASHPOINT,
    name: "Pre-Flashpoint DC Universe",
    shortName: "Modern Age",
    description: "The DC Universe continuity as it stood immediately before the 2011 Flashpoint event, itself the product of decades of Modern-Age storytelling built on the post-Crisis on Infinite Earths reboot.",
    universeId: UNIVERSE_ID,
    successorId: CONT_NEW52,
    sourceInfo: wikiSrc("https://en.wikipedia.org/wiki/Flashpoint_(comics)", "Flashpoint is documented as the 2011 crossover event whose ending directly caused the New 52 relaunch.", "partially_verified"),
  }),
  makeContinuity({
    id: CONT_NEW52,
    name: "The New 52",
    shortName: "New 52",
    description:
      "The line-wide DC Comics relaunch that began in September 2011 after the Flashpoint crossover event, restarting nearly all ongoing series at issue #1. " +
      "IMPORTANT NUANCE (do not oversimplify to 'everything was rebooted'): the New 52 was a PARTIAL reset, not a total one. " +
      "Batman is the character most frequently cited by DC's own creators/editorial as an exception: Bruce Wayne's own history as Batman was represented as having occurred largely in full (all four Robins, his full career), unlike most of the rest of the DC Universe whose histories were meaningfully compressed/altered. " +
      "Scott Snyder's 'Batman: Zero Year' (Batman (2011) #21-24, #25-27, #29-33) was explicitly framed as a retelling/clarification of Batman's already-established early history within this new continuity rather than a from-scratch origin, which is consistent with that editorial position. " +
      "This distinction is preserved here rather than collapsed into a single 'everything reset' description, per the researched editorial nuance the task explicitly calls for.",
    universeId: UNIVERSE_ID,
    predecessorId: CONT_PRE_FLASHPOINT,
    successorId: CONT_REBIRTH,
    startDate: "2011-09",
    endDate: "2016-05",
    sourceInfo: wikiSrc(
      "https://en.wikipedia.org/wiki/The_New_52",
      "Start date (Sept 2011) and general relaunch scope are well documented; the Batman-specific 'history largely intact' nuance reflects the DC editorial position widely reported around Zero Year's release rather than one single fetched citation, so this whole continuity record is left partially_verified rather than verified.",
      "partially_verified",
    ),
  }),
  makeContinuity({
    id: CONT_REBIRTH,
    name: "DC Rebirth",
    shortName: "Rebirth",
    description: "The 2016 line-wide relaunch that succeeded the New 52, restoring some pre-Flashpoint history/relationships (notably legacy and family bonds) while keeping most New 52-era status quo changes. Batman (2011) and its Bat-family companion titles ended their numbering (mostly at #52) in the lead-up to Rebirth's June 2016 start.",
    universeId: UNIVERSE_ID,
    predecessorId: CONT_NEW52,
    startDate: "2016-06",
    sourceInfo: wikiSrc("https://en.wikipedia.org/wiki/DC_Rebirth", "DC Rebirth's June 2016 start and its relationship to the New 52 are well documented; included here only to anchor the New 52 continuity's successorId, not researched in depth for this Batman-focused dataset.", "partially_verified"),
  }),
];
universes[0].continuityIds = [CONT_PRE_FLASHPOINT, CONT_NEW52, CONT_REBIRTH];

/* ============================================================================
   2. CREATORS
   ========================================================================= */
function creator(name, roles, notes, status = "partially_verified") {
  return makeCreator({
    id: buildCreatorId(name), name, roles,
    sourceInfo: dbSrc(null, notes, status),
  });
}
const creators = [
  creator("Scott Snyder", ["Writer"], "Writer of Batman (2011) #1-52 in full (co-credited on Epilogue #51-52 with James Tynion IV per official solicitation/back-cover credits reproduced on Amazon/Penguin Random House listings for 'Batman Vol. 10: Epilogue').", "verified"),
  creator("Greg Capullo", ["Penciller", "Artist"], "Primary penciller for the Batman (2011) Snyder/Capullo run; some issues used fill-in artists (see individual issue notes where verified).", "verified"),
  creator("James Tynion IV", ["Writer"], "Co-writer with Scott Snyder on the Batman (2011) 'Epilogue' story (#51-52), per official collection credits."),
  creator("Rafael Albuquerque", ["Artist"], "Credited artist on portions of the Batman (2011) Snyder/Capullo-era Omnibus Vol. 1 contents (issues/annuals not individually itemized in the source used)."),
  creator("Jason Fabok", ["Artist"], "Credited artist on portions of the Batman (2011) Snyder/Capullo-era Omnibus Vol. 1 contents (issues/annuals not individually itemized in the source used)."),
  creator("Tony Daniel", ["Writer", "Artist"], "Writer/artist who launched Detective Comics (2011) with issue #1; later issues in the run had other writers/artists whose exact issue boundaries were not independently confirmed in this research pass."),
  creator("John Layman", ["Writer"], "Reported as a later writer on Detective Comics (2011); exact issue range not independently confirmed in this research pass."),
  creator("Francis Manapul", ["Writer", "Artist"], "Reported as writer/artist on a later stretch of Detective Comics (2011); exact issue range not independently confirmed in this research pass."),
  creator("Brian Buccellato", ["Writer", "Colorist"], "Reported as co-writer alongside Francis Manapul on a later stretch of Detective Comics (2011); exact issue range not independently confirmed."),
  creator("Peter Tomasi", ["Writer"], "Writer of Batman and Robin (2011) across its run (#1-40), including the 'Requiem for Damian' and 'Robin Rises' material.", "verified"),
  creator("Patrick Gleason", ["Artist"], "Primary artist of Batman and Robin (2011).", "verified"),
  creator("Kyle Higgins", ["Writer"], "Writer of Nightwing (2011).", "verified"),
  creator("Gail Simone", ["Writer"], "Writer who launched Batgirl (2011); later issues had other writers (Fletcher/Stewart) whose exact handoff issue was not independently confirmed in this pass."),
  creator("Brenden Fletcher", ["Writer"], "Reported as a later writer on Batgirl (2011) (the 'Batgirl of Burnside' era); exact issue range not independently confirmed."),
  creator("Cameron Stewart", ["Writer", "Artist"], "Reported as co-writer/artist on the later 'Batgirl of Burnside' era of Batgirl (2011); exact issue range not independently confirmed."),
  creator("Judd Winick", ["Writer"], "Writer who launched Catwoman (2011); later writers (Nocenti/Valentine) followed, exact handoff issues not independently confirmed."),
  creator("Ann Nocenti", ["Writer"], "Reported as a writer on a later stretch of Catwoman (2011); exact issue range not independently confirmed."),
  creator("Genevieve Valentine", ["Writer"], "Reported as the final writer of Catwoman (2011); exact issue range not independently confirmed."),
  creator("Scott Lobdell", ["Writer"], "Writer of Red Hood and the Outlaws (2011) across its run (#1-25).", "verified"),
  creator("David Finch", ["Writer", "Artist"], "Original writer/artist of Batman: The Dark Knight (2011) vol. 2.", "verified"),
  creator("Gregg Hurwitz", ["Writer"], "Took over as primary writer of Batman: The Dark Knight (2011) vol. 2 for the remainder of its run after David Finch's departure; exact handoff issue not independently confirmed.", "partially_verified"),
  creator("Paul Jenkins", ["Writer"], "Announced co-writer on Batman: The Dark Knight (2011) vol. 2 during its run."),
  creator("Grant Morrison", ["Writer"], "Writer of both Batman Incorporated volumes — the 2010-2011 launch (vol. 1) and the New 52 2012-2013 continuation (vol. 2).", "verified"),
  creator("Chris Burnham", ["Artist"], "Primary artist of Batman Incorporated (2012) vol. 2.", "verified"),
  creator("Yanick Paquette", ["Artist"], "Artist on Batman Incorporated vol. 1 (2010-2011) and reported to have also drawn Batman Incorporated (2012) #0.", "partially_verified"),
  creator("Cameron Stewart", ["Artist"], "Artist on Batman Incorporated vol. 1 (2010-2011)."), // duplicate id-safe: same id as writer/artist entry above, will just be skipped by upsert idempotency
];
// De-duplicate by id (Cameron Stewart appears twice above with different role framing) — keep the richer/merged roles.
(function mergeDuplicateCreators() {
  const byId = new Map();
  for (const c of creators) {
    if (byId.has(c.id)) {
      const existing = byId.get(c.id);
      existing.roles = [...new Set([...existing.roles, ...c.roles])];
    } else {
      byId.set(c.id, c);
    }
  }
  creators.length = 0;
  creators.push(...byId.values());
})();

/* ============================================================================
   3. CHARACTERS
   ========================================================================= */
function character(name, displayName, aliases, notes) {
  return makeCharacter({
    id: buildCharacterId(name), name, displayName, aliases,
    continuityIds: [CONT_NEW52],
    universeIds: [UNIVERSE_ID],
    sourceInfo: dbSrc(null, notes, "partially_verified"),
  });
}
const CHAR = {
  BATMAN: buildCharacterId("Batman"),
  ROBIN_DAMIAN: buildCharacterId("Robin Damian Wayne"),
  NIGHTWING: buildCharacterId("Nightwing"),
  RED_HOOD: buildCharacterId("Red Hood Jason Todd"),
  RED_ROBIN: buildCharacterId("Red Robin Tim Drake"),
  BATGIRL: buildCharacterId("Batgirl Barbara Gordon"),
  BATWOMAN: buildCharacterId("Batwoman Kate Kane"),
  CATWOMAN: buildCharacterId("Catwoman Selina Kyle"),
  ALFRED: buildCharacterId("Alfred Pennyworth"),
  GORDON: buildCharacterId("James Gordon"),
  JOKER: buildCharacterId("Joker"),
  RIDDLER: buildCharacterId("Riddler"),
  COURT_OF_OWLS: buildCharacterId("Court of Owls"),
};
const characters = [
  character("Batman", "Batman", ["Bruce Wayne", "The Dark Knight", "The Caped Crusader"],
    "Core protagonist of Batman (2011); per DC's own New 52 editorial framing, Bruce Wayne's personal history/career as Batman was kept largely intact rather than fully rebooted (see continuity notes)."),
  character("Robin Damian Wayne", "Robin", ["Damian Wayne"],
    "Son of Bruce Wayne and Talia al Ghul; Robin throughout Batman and Robin (2011) and a lead of Batman Incorporated (2012); dies in Batman Incorporated (2012) #8 (widely reported across contemporary comics-news coverage), with the fallout dramatized in the 'Requiem'/'Robin Rises' crossover material."),
  character("Nightwing", "Nightwing", ["Dick Grayson", "the first Robin"],
    "Former first Robin, protagonist of Nightwing (2011); a suspect in the Court of Owls story and participant in the Night of the Owls crossover."),
  character("Red Hood Jason Todd", "Red Hood", ["Jason Todd"],
    "Second Robin, protagonist of Red Hood and the Outlaws (2011)."),
  character("Red Robin Tim Drake", "Red Robin", ["Tim Drake"],
    "Third Robin; appears across Bat-family New 52 titles as a recurring supporting character (not the lead of any of the 9 series in this dataset)."),
  character("Batgirl Barbara Gordon", "Batgirl", ["Barbara Gordon"],
    "Protagonist of Batgirl (2011); daughter of James Gordon."),
  character("Batwoman Kate Kane", "Batwoman", ["Kate Kane"],
    "New 52-era Batwoman; included per required character scope even though her own solo series is outside this dataset's 9-series core scope."),
  character("Catwoman Selina Kyle", "Catwoman", ["Selina Kyle"],
    "Protagonist of Catwoman (2011)."),
  character("Alfred Pennyworth", "Alfred Pennyworth", ["Alfred"],
    "Bruce Wayne's butler and closest confidant; recurring supporting character across the Batman-family titles in this dataset."),
  character("James Gordon", "James Gordon", ["Commissioner Gordon", "Jim Gordon"],
    "Commissioner of the Gotham City Police Department; recurring supporting character, father of Barbara Gordon."),
  character("Joker", "The Joker", [],
    "Antagonist of Batman: Death of the Family and the wider Death of the Family crossover."),
  character("Riddler", "The Riddler", ["Edward Nygma"],
    "Recurring Batman antagonist; included per required character scope."),
  character("Court of Owls", "Court of Owls", ["The Owls", "Talons"],
    "Secret society antagonist group introduced in Batman (2011) 'Court of Owls'/'City of Owls'; their agents/assassins are called Talons. Represented here as a single group-character entity per the schema's character model, since Phase 1 does not have a distinct 'organization' entity type."),
];

/* ============================================================================
   4. SERIES
   ========================================================================= */
function series({ title, year, issueCount, startDate, endDate, creatorIds, characterIds, description, notes, status = "verified" }) {
  const id = buildSeriesId(title, year);
  return makeSeries({
    id, title, publisher: "DC Comics", startDate, endDate, issueCount,
    universeId: UNIVERSE_ID, continuityIds: [CONT_NEW52],
    characterIds, creatorIds, description,
    sourceInfo: officialDC(null, notes, status),
  });
}

const SERIES_ID = {
  BATMAN: buildSeriesId("Batman", 2011),
  DETECTIVE: buildSeriesId("Detective Comics", 2011),
  BATMAN_ROBIN: buildSeriesId("Batman and Robin", 2011),
  NIGHTWING: buildSeriesId("Nightwing", 2011),
  BATGIRL: buildSeriesId("Batgirl", 2011),
  CATWOMAN: buildSeriesId("Catwoman", 2011),
  RED_HOOD: buildSeriesId("Red Hood and the Outlaws", 2011),
  DARK_KNIGHT: buildSeriesId("Batman The Dark Knight", 2011),
  BATMAN_INC_2012: buildSeriesId("Batman Incorporated", 2012),
  BATMAN_INC_2010: buildSeriesId("Batman Incorporated", 2010), // pre-New-52 predecessor volume, minimal stub
};

const seriesList = [
  series({
    title: "Batman", year: 2011, issueCount: 53,
    startDate: "2011-11", endDate: "2016-05",
    creatorIds: [buildCreatorId("Scott Snyder"), buildCreatorId("Greg Capullo")],
    characterIds: [CHAR.BATMAN, CHAR.ALFRED, CHAR.GORDON, CHAR.JOKER, CHAR.COURT_OF_OWLS, CHAR.NIGHTWING, CHAR.ROBIN_DAMIAN],
    description: "Core New 52 Batman title. Relaunched at #1 in Sept. 2011 (cover-dated Nov. 2011); the numbered run is #0-52 (53 issues) under Scott Snyder and Greg Capullo, ending in 2016 ahead of DC Rebirth. DC/retailer catalogs sometimes list a higher total (as high as 65) once Annuals (#1-4) and 'point one' one-shot issues (#23.1-23.4) are folded into the same volume's count; this dataset represents the numbered #0-52 issues explicitly and leaves the combined grand total null rather than asserting an unverified figure (see issueCount note).",
    notes: "issueCount=53 reflects the confirmed numbered range #0-52 only (comicbooktreasury.com reading-order guide + dc.com collection pages for #1-6, #8-12, #13-17 all corroborate this numbering and confirm #52 as the final issue, matching the 'Epilogue' collection). The original task brief's figure of 65 total issues was NOT taken on faith — it appears to reflect the volume's total published units across numbered issues + 4 Annuals + 4 point-one specials, which this pass could not fully itemize/verify, so it is called out here rather than silently adopted.",
    status: "partially_verified",
  }),
  series({
    title: "Detective Comics", year: 2011, issueCount: 52,
    startDate: "2011-11", endDate: "2016-05",
    creatorIds: [buildCreatorId("Tony Daniel")],
    characterIds: [CHAR.BATMAN, CHAR.GORDON],
    description: "New 52 volume of Detective Comics, launched by writer/artist Tony Daniel. Later had other writers/artists (John Layman; Francis Manapul/Brian Buccellato) whose exact issue-range handoffs were not independently confirmed in this pass. Ends at #52 like most core New 52 titles ahead of Rebirth.",
    notes: "Final issue #52 confirmed via a 2011-2016 cover-date range attached to issue #52 listings (DC Database/whakoom). Tony Daniel as launch writer/artist confirmed via multiple independent listings; later-writer sequencing is reported but not independently verified here.",
  }),
  series({
    title: "Batman and Robin", year: 2011, issueCount: 40,
    startDate: "2011-11", endDate: "2015-04",
    creatorIds: [buildCreatorId("Peter Tomasi"), buildCreatorId("Patrick Gleason")],
    characterIds: [CHAR.BATMAN, CHAR.ROBIN_DAMIAN, CHAR.ALFRED],
    description: "New 52 volume starring Bruce Wayne and Damian Wayne, written by Peter Tomasi with artist Patrick Gleason for essentially its entire run, including 'Requiem for Damian' and 'Robin Rises' following Damian's death in Batman Incorporated (2012) #8.",
    notes: "Final issue #40 confirmed (Goodreads/CBR/ComicBookRoundUp all list #40, dated 2015, as the last issue).",
    status: "verified",
  }),
  series({
    title: "Nightwing", year: 2011, issueCount: 30,
    startDate: "2011-11", endDate: "2014-05",
    creatorIds: [buildCreatorId("Kyle Higgins")],
    characterIds: [CHAR.NIGHTWING, CHAR.BATMAN],
    description: "New 52 volume starring Dick Grayson, written by Kyle Higgins for its run. Ended earlier than most New 52 titles, folding Dick Grayson into the 'Forever Evil'/Spyral storyline that led into his own status-quo change.",
    notes: "Final issue #30 (cover-dated May 2014) confirmed via DC's own 'Nightwing #30 by the Numbers' retrospective blog post and the dc.com issue page for #30, with no later issue found in any indexed source.",
    status: "verified",
  }),
  series({
    title: "Batgirl", year: 2011, issueCount: 52,
    startDate: "2011-11", endDate: "2016-05",
    creatorIds: [buildCreatorId("Gail Simone")],
    characterIds: [CHAR.BATGIRL, CHAR.GORDON],
    description: "New 52 volume starring Barbara Gordon (restored to the Batgirl identity), written initially by Gail Simone, with a later writing team (Brenden Fletcher / Cameron Stewart, the 'Batgirl of Burnside' era) whose exact handoff issue was not independently confirmed in this pass.",
    notes: "Final issue #52 confirmed via the dc.com issue page for Batgirl #52 and a 2011-2016 series date range on multiple listings.",
  }),
  series({
    title: "Catwoman", year: 2011, issueCount: 52,
    startDate: "2011-11", endDate: "2016-05",
    creatorIds: [buildCreatorId("Judd Winick")],
    characterIds: [CHAR.CATWOMAN],
    description: "New 52 volume starring Selina Kyle, launched by writer Judd Winick, with later writers (Ann Nocenti, then Genevieve Valentine) whose exact handoff issues were not independently confirmed in this pass.",
    notes: "Final issue #52 corroborated via a dedicated issue-#52 review dated 2016 (Weird Science DC Comics) and the 2011-2016 series date range used across multiple catalog/retailer listings.",
  }),
  series({
    title: "Red Hood and the Outlaws", year: 2011, issueCount: 25,
    startDate: "2011-11", endDate: "2015-04",
    creatorIds: [buildCreatorId("Scott Lobdell")],
    characterIds: [CHAR.RED_HOOD],
    description: "New 52 volume starring Jason Todd (Red Hood), Starfire and Arsenal, written by Scott Lobdell for its run.",
    notes: "Final issue #25 confirmed via the dc.com issue page for Red Hood and the Outlaws #25 and a 2011-2015 series date range on multiple listings.",
    status: "verified",
  }),
  series({
    title: "Batman: The Dark Knight", year: 2011, issueCount: 29,
    startDate: "2011-09", endDate: "2014-03",
    creatorIds: [buildCreatorId("David Finch"), buildCreatorId("Gregg Hurwitz")],
    characterIds: [CHAR.BATMAN],
    description: "New 52 volume 2 of Batman: The Dark Knight (a legacy DC title revived for the New 52). Originally written/drawn by David Finch, with Paul Jenkins announced as co-writer before Gregg Hurwitz took over as primary writer for the remainder of the run.",
    notes: "Publication run (Sept. 2011 - March 2014) and final issue #29 confirmed via Wikipedia's 'Batman: The Dark Knight' article; creative-team sequence (Finch -> Jenkins/guest writers -> Hurwitz) corroborated by the same article, but the exact issue where Hurwitz took over was not independently pinned down in this pass.",
  }),
  series({
    title: "Batman Incorporated", year: 2012, issueCount: 14,
    startDate: "2012-05", endDate: "2013-07",
    creatorIds: [buildCreatorId("Grant Morrison"), buildCreatorId("Chris Burnham")],
    characterIds: [CHAR.BATMAN, CHAR.ROBIN_DAMIAN],
    description:
      "New 52-era continuation of Grant Morrison's Batman Incorporated storyline, NOT a from-scratch new story: it directly continues plot threads from the 2010-2011 volume (see relationship to Batman Incorporated (2010) below), depicting Talia al Ghul's Leviathan organization's war against Bruce Wayne's Batman Inc. network, culminating in Damian Wayne's death (#8) and Batman disbanding the public Batman Inc. initiative.",
    notes: "Numbered #0-13 (14 issues), May 2012 - July 2013, writer Grant Morrison/artist Chris Burnham throughout, confirmed via Wikipedia's 'Batman Incorporated' article; Damian Wayne's death specifically at issue #8 corroborated by multiple independent contemporary comics-news sources (Amazon product listing title, ComicBook.com).",
    status: "verified",
  }),
  makeSeries({
    id: SERIES_ID.BATMAN_INC_2010,
    title: "Batman Incorporated", publisher: "DC Comics",
    startDate: "2010-12", endDate: "2011-06", issueCount: 8,
    universeId: UNIVERSE_ID, continuityIds: [CONT_PRE_FLASHPOINT],
    characterIds: [CHAR.BATMAN, CHAR.ROBIN_DAMIAN],
    creatorIds: [buildCreatorId("Grant Morrison"), buildCreatorId("Yanick Paquette"), buildCreatorId("Cameron Stewart")],
    description:
      "Pre-Flashpoint volume of Batman Incorporated by Grant Morrison (with artists Yanick Paquette and Cameron Stewart): Bruce Wayne, back after 'Batman R.I.P.'/his time-displacement story, builds a franchised international network of Batman-inspired operatives, uncovering Talia al Ghul's Leviathan conspiracy. Directly continued (not rebooted) by Batman Incorporated (2012) — kept as a minimal stub record here specifically so that continuation relationship is representable, since it sits just outside this dataset's New 52 scope.",
    sourceInfo: wikiSrc("https://en.wikipedia.org/wiki/Batman_Incorporated", "8 main issues + the 'Leviathan Strikes!' one-shot, per Wikipedia; the one-shot itself is not separately modeled here (out of scope for a stub record)."),
  }),
];

/* ============================================================================
   5. RUNS
   ========================================================================= */
const RUN_SNYDER_CAPULLO = buildRunId(SERIES_ID.BATMAN, "Snyder Capullo");
const RUN_MORRISON_BURNHAM = buildRunId(SERIES_ID.BATMAN_INC_2012, "Morrison Burnham");

const runs = [
  makeRun({
    id: RUN_SNYDER_CAPULLO, seriesId: SERIES_ID.BATMAN,
    title: "Scott Snyder & Greg Capullo run",
    creatorIds: [buildCreatorId("Scott Snyder"), buildCreatorId("Greg Capullo")],
    startIssue: "1", endIssue: "52",
    startDate: "2011-11", endDate: "2016-05",
    description:
      "The entire Snyder/Capullo creative run on Batman (2011), spanning the full numbered series from #1 through the final issue #52 (Capullo as primary artist throughout, with confirmed fill-in artists — Rafael Albuquerque, Jason Fabok — on specific portions; James Tynion IV co-wrote the concluding 'Epilogue' story with Snyder). " +
      "This is represented as ONE run for the whole series specifically because research did not surface a genuine, DC-documented CHANGE of writer for the ongoing numbered series within #1-52 (Snyder is writer of record throughout) — only fill-in artists and a late co-writer credit, which is not the same as a new run. This avoids inventing run boundaries that publication history does not actually support.",
    sourceInfo: officialDC(null, "Run start (#1) and end (#52) corroborated by the dc.com collection pages for 'Court of Owls' (#1-6) through 'Epilogue' (#51-52, credited to Snyder/Capullo/Tynion IV on Amazon/Penguin Random House listings) plus the 'Batman by Scott Snyder & Greg Capullo Omnibus' (covering #0-33) confirming Snyder+Capullo as the run's identity across that whole span.", "verified"),
  }),
  makeRun({
    id: RUN_MORRISON_BURNHAM, seriesId: SERIES_ID.BATMAN_INC_2012,
    title: "Grant Morrison & Chris Burnham run",
    creatorIds: [buildCreatorId("Grant Morrison"), buildCreatorId("Chris Burnham")],
    startIssue: "0", endIssue: "13",
    startDate: "2012-05", endDate: "2013-07",
    description: "Grant Morrison wrote every issue of Batman Incorporated (2012); Chris Burnham was the primary artist (with Yanick Paquette reported on #0). Spans the entire series.",
    sourceInfo: wikiSrc("https://en.wikipedia.org/wiki/Batman_Incorporated", "Writer/artist credits for the whole #0-13 run corroborated by Wikipedia's Batman Incorporated article.", "verified"),
  }),
];

/* ============================================================================
   6. STORIES (arcs within Batman (2011), plus cross-series EVENT stories)
   ========================================================================= */
function batmanStory(title, issueNums, { characterIds = [CHAR.BATMAN], notes, status = "partially_verified", eventId = null } = {}) {
  const id = buildStoryId(SERIES_ID.BATMAN, title);
  return makeStory({
    id, title, seriesIds: [SERIES_ID.BATMAN], runId: RUN_SNYDER_CAPULLO,
    issueIds: issueNums.map(n => buildIssueId(SERIES_ID.BATMAN, n)),
    continuityId: CONT_NEW52, universeId: UNIVERSE_ID,
    characterIds, creatorIds: [buildCreatorId("Scott Snyder"), buildCreatorId("Greg Capullo")],
    eventId,
    sourceInfo: dbSrc(null, notes, status),
  });
}

const STORY_COURT_OF_OWLS = buildStoryId(SERIES_ID.BATMAN, "Court of Owls");
const STORY_CITY_OF_OWLS = buildStoryId(SERIES_ID.BATMAN, "City of Owls");
const STORY_DEATH_OF_FAMILY = buildStoryId(SERIES_ID.BATMAN, "Death of the Family");
const STORY_ZERO_YEAR_SECRET_CITY = buildStoryId(SERIES_ID.BATMAN, "Zero Year Secret City");
const STORY_ZERO_YEAR_DARK_CITY = buildStoryId(SERIES_ID.BATMAN, "Zero Year Dark City");
const STORY_ENDGAME = buildStoryId(SERIES_ID.BATMAN, "Endgame");
const STORY_SUPERHEAVY = buildStoryId(SERIES_ID.BATMAN, "Superheavy");
const STORY_BLOOM = buildStoryId(SERIES_ID.BATMAN, "Bloom");
const STORY_EPILOGUE = buildStoryId(SERIES_ID.BATMAN, "Epilogue");

// Cross-series event/crossover stories — NOT tied to one series or one run.
const EVENT_NIGHT_OF_OWLS = buildStoryId("event", "Night of the Owls");
const EVENT_DEATH_OF_FAMILY = buildStoryId("event", "Death of the Family Crossover");
const EVENT_REQUIEM = buildStoryId("event", "Requiem");
const STORY_BATINC_DEATH_OF_ROBIN = buildStoryId(SERIES_ID.BATMAN_INC_2012, "Death of Robin");

const stories = [
  batmanStory("Court of Owls", [1,2,3,4,5,6,7], {
    characterIds: [CHAR.BATMAN, CHAR.NIGHTWING, CHAR.COURT_OF_OWLS, CHAR.ALFRED],
    notes: "Issue range #1-7 for the narrative arc per comicbooktreasury's Batman New 52 reading-order guide; DC's own 'Batman Vol. 1: The Court of Owls' TPB/HC only collects the first 6 issues (#1-6) as a smaller collected edition — see the Collection entity for that distinction. Confirmed writer/artist/publisher via the dc.com collection page for #1-6.",
    status: "partially_verified",
  }),
  batmanStory("City of Owls", [8,9,10,11,12], {
    characterIds: [CHAR.BATMAN, CHAR.NIGHTWING, CHAR.COURT_OF_OWLS],
    notes: "Issue range #8-12 confirmed directly via the official dc.com 'Batman Vol. 2: The City of Owls' collection page, which states it collects BATMAN #8-12 and Annual #1.",
    status: "verified",
    eventId: EVENT_NIGHT_OF_OWLS, // #8-9 of this arc are also the Batman-side chapters of the Night of the Owls crossover
  }),
  batmanStory("Death of the Family", [13,14,15,16,17], {
    characterIds: [CHAR.BATMAN, CHAR.JOKER, CHAR.ALFRED, CHAR.GORDON],
    notes: "Issue range #13-17 confirmed directly via the official dc.com 'Batman Vol. 3: Death of the Family' collection page ('this epic from issues #13-17').",
    status: "verified",
    eventId: EVENT_DEATH_OF_FAMILY,
  }),
  batmanStory("Zero Year Secret City", [21,22,23,24], {
    characterIds: [CHAR.BATMAN, CHAR.GORDON],
    notes: "Confirmed via prior research pass (independently corroborated: 'Batman: Zero Year' spans #21-27,29-33 with #28 explicitly excluded as a Batman Eternal preview/tie-in, not part of the story). This first chapter, 'Secret City', is #21-24.",
    status: "verified",
  }),
  batmanStory("Zero Year Dark City", [25,26,27,29,30,31,32,33], {
    characterIds: [CHAR.BATMAN, CHAR.RIDDLER, CHAR.GORDON],
    notes: "#25-27, #29-33 — NON-CONTIGUOUS: #28 is excluded because it is a Batman Eternal preview/tie-in issue, not part of the Zero Year story, per the prior confirmed research pass for this task.",
    status: "verified",
  }),
  batmanStory("Endgame", [35,36,37,38,39,40], {
    characterIds: [CHAR.BATMAN, CHAR.JOKER],
    notes: "Issue range #35-40 confirmed by the official dc.com listing for Batman Vol. 7: Endgame ('stories from BATMAN #35-40').",
    status: "verified",
  }),
  batmanStory("Superheavy", [41,42,43,44,45], {
    characterIds: [CHAR.BATMAN, CHAR.GORDON],
    notes: "Issue range #41-45 confirmed by the official dc.com listing for Batman Vol. 8: Superheavy ('Collects BATMAN #41-45 and a story from DC COMICS DIVERGENCE #1').",
    status: "verified",
  }),
  batmanStory("Bloom", [46,47,48,49,50], {
    characterIds: [CHAR.BATMAN, CHAR.GORDON],
    notes: "Issue range #46-50 confirmed by the Penguin Random House listing for Batman Vol. 9: Bloom ('Collects Batman #46-50, as well as a story from Detective Comics #27').",
    status: "verified",
  }),
  batmanStory("Epilogue", [51,52], {
    characterIds: [CHAR.BATMAN, CHAR.ALFRED],
    notes: "Issue range #51-52 confirmed via the 'Batman Vol. 10: Epilogue' collection listings (Penguin Random House / Amazon), which also confirm James Tynion IV co-wrote this story with Scott Snyder.",
    status: "verified",
  }),

  // ---- Cross-series crossover/event stories ----
  makeStory({
    id: EVENT_NIGHT_OF_OWLS, title: "Batman: Night of the Owls (crossover event)",
    seriesIds: [SERIES_ID.BATMAN, SERIES_ID.NIGHTWING, SERIES_ID.DETECTIVE, SERIES_ID.BATMAN_ROBIN, SERIES_ID.BATGIRL, SERIES_ID.CATWOMAN, SERIES_ID.RED_HOOD, SERIES_ID.DARK_KNIGHT],
    runId: null,
    issueIds: [
      ...[8,9].map(n => buildIssueId(SERIES_ID.BATMAN, n)),
      buildIssueId(SERIES_ID.BATMAN, "annual-1"),
      ...[8,9].map(n => buildIssueId(SERIES_ID.NIGHTWING, n)),
      buildIssueId(SERIES_ID.DETECTIVE, 9),
      buildIssueId(SERIES_ID.BATMAN_ROBIN, 9),
      buildIssueId(SERIES_ID.BATGIRL, 9),
      buildIssueId(SERIES_ID.CATWOMAN, 9),
      buildIssueId(SERIES_ID.RED_HOOD, 9),
      buildIssueId(SERIES_ID.DARK_KNIGHT, 9),
    ],
    continuityId: CONT_NEW52, universeId: UNIVERSE_ID,
    characterIds: [CHAR.BATMAN, CHAR.NIGHTWING, CHAR.BATGIRL, CHAR.CATWOMAN, CHAR.RED_HOOD, CHAR.COURT_OF_OWLS, CHAR.GORDON],
    creatorIds: [buildCreatorId("Scott Snyder"), buildCreatorId("Greg Capullo")],
    description:
      "The Talons (Court of Owls agents) attack Batman and the wider Bat-family across Gotham simultaneously. Per Wikipedia's 'Batman: Night of the Owls' article, the core chapters are Batman #8-9 and Batman Annual #1, with same-numbered (#9, or #8-9 for Nightwing) tie-in issues in Nightwing, Detective Comics, Batman and Robin, Batgirl, Catwoman, Red Hood and the Outlaws and Batman: The Dark Knight. " +
      "Two further tie-ins outside this dataset's scope (Batwing #9, Birds of Prey #9, All-Star Western #9) are NOT represented here as issue/series records since those series are not part of this Batman-ecosystem dataset, per the task's instruction not to blindly add every Bat-family/New 52 title — they are noted here in the description only, not fabricated as data.",
    sourceInfo: wikiSrc("https://en.wikipedia.org/wiki/Batman:_Night_of_the_Owls", "Full per-series issue list corroborated independently by the official dc.com 'Batman: Night of the Owls' collected-edition page, which lists the same set of issues (as a Nov. 2013 368-page hardcover).", "verified"),
  }),
  makeStory({
    id: EVENT_DEATH_OF_FAMILY, title: "Batman: Death of the Family (crossover event)",
    seriesIds: [SERIES_ID.BATMAN, SERIES_ID.BATGIRL, SERIES_ID.BATMAN_ROBIN, SERIES_ID.CATWOMAN, SERIES_ID.DETECTIVE, SERIES_ID.NIGHTWING, SERIES_ID.RED_HOOD],
    runId: null,
    issueIds: [
      ...[13,14,15,16,17].map(n => buildIssueId(SERIES_ID.BATMAN, n)),
      ...[13,14,15,16].map(n => buildIssueId(SERIES_ID.BATGIRL, n)),
      ...[15,16].map(n => buildIssueId(SERIES_ID.BATMAN_ROBIN, n)),
      ...[13,14].map(n => buildIssueId(SERIES_ID.CATWOMAN, n)),
      ...[15,16].map(n => buildIssueId(SERIES_ID.DETECTIVE, n)),
      ...[15,16].map(n => buildIssueId(SERIES_ID.NIGHTWING, n)),
      ...[15,16,17].map(n => buildIssueId(SERIES_ID.RED_HOOD, n)),
    ],
    continuityId: CONT_NEW52, universeId: UNIVERSE_ID,
    characterIds: [CHAR.BATMAN, CHAR.JOKER, CHAR.ALFRED, CHAR.GORDON, CHAR.BATGIRL, CHAR.NIGHTWING, CHAR.RED_HOOD, CHAR.CATWOMAN],
    creatorIds: [buildCreatorId("Scott Snyder"), buildCreatorId("Greg Capullo")],
    description:
      "The Joker returns and targets the entire Bat-family. Per Wikipedia's 'Batman: Death of the Family' article, the crossover ran Oct. 2012-Feb. 2013 across 23 issues in nine series; the seven series in THIS dataset's scope are represented issue-by-issue above. " +
      "Two further participating series outside this dataset's scope (Suicide Squad #14-15, Teen Titans #15-16) are NOT represented as issue/series records here — noted in description only, per the task's instruction against blindly cataloguing every tangential New 52 title. " +
      "Unlike Night of the Owls, DC did not release one single cross-series collected edition for this event (Batman's own chapters were collected in 'Batman Vol. 3: Death of the Family'; the tie-in issues were collected within each of their own series' trades) — that distinction is preserved by NOT creating one artificial multi-series Collection entity for this event (see Collections section).",
    sourceInfo: wikiSrc("https://en.wikipedia.org/wiki/Batman:_Death_of_the_Family", "Per-series issue list and Oct.2012-Feb.2013 date range from Wikipedia; Batman's own #13-17 slice independently re-confirmed via the official dc.com collection page.", "verified"),
  }),
  makeStory({
    id: EVENT_REQUIEM, title: "Requiem (Damian Wayne aftermath crossover)",
    seriesIds: [SERIES_ID.BATMAN, SERIES_ID.BATMAN_ROBIN, SERIES_ID.BATGIRL, SERIES_ID.DETECTIVE],
    runId: null,
    issueIds: [18].flatMap(n => [
      buildIssueId(SERIES_ID.BATMAN, n),
      buildIssueId(SERIES_ID.BATMAN_ROBIN, n),
      buildIssueId(SERIES_ID.BATGIRL, n),
      buildIssueId(SERIES_ID.DETECTIVE, n),
    ]),
    continuityId: CONT_NEW52, universeId: UNIVERSE_ID,
    characterIds: [CHAR.BATMAN, CHAR.ROBIN_DAMIAN, CHAR.ALFRED, CHAR.BATGIRL],
    creatorIds: [buildCreatorId("Peter Tomasi")],
    eventId: null,
    description:
      "A one-shot-per-title tribute/reaction to Damian Wayne's death in Batman Incorporated (2012) #8: Batman #18, Batman and Robin #18, Batgirl #18 and Detective Comics #18 (a fifth tie-in, World's Finest #10, is outside this dataset's scope and not represented as a record). Directly follows from, and is linked to, Batman Incorporated's 'Death of Robin' story (see relationship graph).",
    sourceInfo: dbSrc(null, "Per-issue list (Batman/Batman and Robin/Batgirl/Detective Comics #18, plus World's Finest #10 out of scope) corroborated by an independent contemporary review source (graphicpolicy.com, March 2013) reviewing all four/five issues together as one event.", "partially_verified"),
  }),
  makeStory({
    id: STORY_BATINC_DEATH_OF_ROBIN, title: "Death of Robin",
    seriesIds: [SERIES_ID.BATMAN_INC_2012], runId: RUN_MORRISON_BURNHAM,
    issueIds: [buildIssueId(SERIES_ID.BATMAN_INC_2012, 8)],
    continuityId: CONT_NEW52, universeId: UNIVERSE_ID,
    characterIds: [CHAR.ROBIN_DAMIAN, CHAR.BATMAN],
    creatorIds: [buildCreatorId("Grant Morrison"), buildCreatorId("Chris Burnham")],
    eventId: null,
    description: "Damian Wayne is killed by a clone of himself (Heretic, a Leviathan agent) in Batman Incorporated (2012) #8, the single most consequential moment of the New 52 Batman Incorporated volume.",
    sourceInfo: retailerSrc(null, "Issue number (#8) corroborated by multiple independent contemporary sources: the Amazon product listing title ('Batman Incorporated #8 RIP The Death of Robin Damian Wayne'), ComicBook.com's spoiler coverage, and DC's own 'This Just Happened' retrospective blog post.", "verified"),
  }),
];

/* ============================================================================
   7. ISSUES
   ========================================================================= */
const issues = [];

// ---- 7a. Batman (2011): complete numbered sequence #0-52, plus Annuals #1-4
//          and the four "point one" Villains Month one-shots (#23.1-23.4). ----
// Map of issue number -> storyId, built from the story ranges above (only
// numbers that are genuinely covered by a researched story get one; #0,
// #18-20, #34 and the point-one/annual issues are deliberately left
// unattached rather than guessed into a story).
const BATMAN_STORY_BY_ISSUE = {};
for (const [storyId, nums] of [
  [STORY_COURT_OF_OWLS, [1,2,3,4,5,6,7]],
  [STORY_CITY_OF_OWLS, [8,9,10,11,12]],
  [STORY_DEATH_OF_FAMILY, [13,14,15,16,17]],
  [STORY_ZERO_YEAR_SECRET_CITY, [21,22,23,24]],
  [STORY_ZERO_YEAR_DARK_CITY, [25,26,27,29,30,31,32,33]],
  [STORY_ENDGAME, [35,36,37,38,39,40]],
  [STORY_SUPERHEAVY, [41,42,43,44,45]],
  [STORY_BLOOM, [46,47,48,49,50]],
  [STORY_EPILOGUE, [51,52]],
]) {
  for (const n of nums) BATMAN_STORY_BY_ISSUE[n] = storyId;
}
// Event-story membership layered on top (an issue can belong to both its arc AND an event).
const BATMAN_EVENT_BY_ISSUE = { 8: EVENT_NIGHT_OF_OWLS, 9: EVENT_NIGHT_OF_OWLS, 18: EVENT_REQUIEM };

for (let n = 0; n <= 52; n++) {
  const id = buildIssueId(SERIES_ID.BATMAN, n);
  const storyIds = [BATMAN_STORY_BY_ISSUE[n], BATMAN_EVENT_BY_ISSUE[n]].filter(Boolean);
  issues.push(makeIssue({
    id, seriesId: SERIES_ID.BATMAN, issueNumber: n, issueLabelType: "numbered",
    title: null, publicationDate: null,
    storyIds, continuityId: CONT_NEW52, universeId: UNIVERSE_ID,
    characterIds: [CHAR.BATMAN],
    creatorIds: [buildCreatorId("Scott Snyder"), buildCreatorId("Greg Capullo")],
    eventIds: BATMAN_EVENT_BY_ISSUE[n] ? [BATMAN_EVENT_BY_ISSUE[n]] : [],
    sourceInfo: storyIds.length
      ? dbSrc(null, `Issue number and story membership follow from the researched arc/event boundaries above; individual issue title and cover date were not independently verified in this pass and are left null rather than guessed.`, "partially_verified")
      : unverified("Issue number confirmed to exist within the researched #0-52 run, but this specific issue was not part of any of the researched story arcs/events, and its title/date/individual creative credits were not independently verified — left minimal and null rather than guessed."),
  }));
}
// Annuals #1-4 and Villains Month "point one" issues — real published units (their
// existence for this volume is well documented, e.g. Batman Annual #1-2 appear in
// the Snyder/Capullo Omnibus Vol. 1 contents, and #23.2 explicitly), but content/
// title/date/story-membership for each is NOT independently confirmed here.
for (const label of ["Annual 1", "Annual 2", "Annual 3", "Annual 4"]) {
  issues.push(makeIssue({
    id: buildIssueId(SERIES_ID.BATMAN, label), seriesId: SERIES_ID.BATMAN,
    issueNumber: null, issueLabel: `Batman ${label}`, issueLabelType: "annual",
    title: null, publicationDate: null, storyIds: label === "Annual 1" ? [EVENT_NIGHT_OF_OWLS] : [],
    continuityId: CONT_NEW52, universeId: UNIVERSE_ID, characterIds: [CHAR.BATMAN],
    creatorIds: [],
    sourceInfo: label <= "Annual 2"
      ? dbSrc(null, "Annual #1 and #2's existence for this volume is confirmed by the Snyder/Capullo Omnibus Vol.1 contents list ('...Annual #1-2'); Annual #1 specifically is also confirmed as the Night of the Owls tie-in by the dc.com City of Owls TPB solicitation. Individual content/title/date not independently verified.", "partially_verified")
      : unverified("Existence inferred from the standard New 52 annual cadence for an ongoing flagship title, not independently confirmed issue-by-issue in this research pass — left minimal and null."),
  }));
}
for (const n of ["23.1", "23.2", "23.3", "23.4"]) {
  issues.push(makeIssue({
    id: buildIssueId(SERIES_ID.BATMAN, n), seriesId: SERIES_ID.BATMAN,
    issueNumber: n, issueLabelType: "special",
    title: null, publicationDate: null, storyIds: [],
    continuityId: CONT_NEW52, universeId: UNIVERSE_ID, characterIds: [CHAR.BATMAN],
    creatorIds: [],
    sourceInfo: n === "23.2"
      ? dbSrc(null, "#23.2's existence for this volume is confirmed by the Snyder/Capullo Omnibus Vol.1 contents list. Deliberately NOT included in the Zero Year story's issueIds: these September 2013 'Villains Month' point-one issues were single-issue villain-focused spotlights outside the ongoing numbered Zero Year narrative, consistent with #28 (a different one-off/tie-in) also being excluded from that story.", "partially_verified")
      : unverified("Existence inferred from the standard September 2013 DC 'Villains Month' point-one program, which is known to have covered this title's numbering slot, but this specific issue's content/creators were not independently verified in this pass."),
  }));
}

// ---- 7b. Minimal crossover-tie-in issue stubs in the other 7 series ----
// Only the SPECIFIC issues that are documented participants in a researched
// crossover/event are created here — this dataset does NOT attempt a
// complete issue-by-issue sequence for these 7 series (see final report,
// "issue ranges researched: full vs partial").
function tieInIssue(seriesId, n, { storyIds = [], eventIds = [], characterIds = [], creatorIds = [], notes, status = "partially_verified" } = {}) {
  return makeIssue({
    id: buildIssueId(seriesId, n), seriesId, issueNumber: n, issueLabelType: "numbered",
    title: null, publicationDate: null, storyIds,
    continuityId: CONT_NEW52, universeId: UNIVERSE_ID, characterIds, creatorIds, eventIds,
    sourceInfo: dbSrc(null, notes, status),
  });
}

// Nightwing #8-9 (Night of the Owls), #30 is the series finale (not itself a
// crossover issue, but included so the series' well-known final issue exists
// as a real record rather than only being referenced by series.issueCount).
issues.push(
  tieInIssue(SERIES_ID.NIGHTWING, 8, { storyIds: [EVENT_NIGHT_OF_OWLS], eventIds: [EVENT_NIGHT_OF_OWLS], characterIds: [CHAR.NIGHTWING, CHAR.COURT_OF_OWLS], creatorIds: [buildCreatorId("Kyle Higgins")], notes: "Night of the Owls tie-in, per Wikipedia's crossover issue list, corroborated by the official dc.com Night of the Owls collection page.", status: "verified" }),
  tieInIssue(SERIES_ID.NIGHTWING, 9, { storyIds: [EVENT_NIGHT_OF_OWLS], eventIds: [EVENT_NIGHT_OF_OWLS], characterIds: [CHAR.NIGHTWING, CHAR.COURT_OF_OWLS], creatorIds: [buildCreatorId("Kyle Higgins")], notes: "Night of the Owls tie-in, per Wikipedia's crossover issue list, corroborated by the official dc.com Night of the Owls collection page.", status: "verified" }),
  tieInIssue(SERIES_ID.NIGHTWING, 15, { storyIds: [EVENT_DEATH_OF_FAMILY], eventIds: [EVENT_DEATH_OF_FAMILY], characterIds: [CHAR.NIGHTWING, CHAR.JOKER], creatorIds: [buildCreatorId("Kyle Higgins")], notes: "Death of the Family tie-in, per Wikipedia's crossover issue list." }),
  tieInIssue(SERIES_ID.NIGHTWING, 16, { storyIds: [EVENT_DEATH_OF_FAMILY], eventIds: [EVENT_DEATH_OF_FAMILY], characterIds: [CHAR.NIGHTWING, CHAR.JOKER], creatorIds: [buildCreatorId("Kyle Higgins")], notes: "Death of the Family tie-in, per Wikipedia's crossover issue list." }),
  tieInIssue(SERIES_ID.NIGHTWING, 30, { characterIds: [CHAR.NIGHTWING], creatorIds: [buildCreatorId("Kyle Higgins")], notes: "Confirmed final issue of Nightwing (2011), cover-dated May 2014, per DC's own 'Nightwing #30 by the Numbers' retrospective blog post.", status: "verified" }),
);

// Detective Comics #9, 15, 16, 18, 52(finale)
issues.push(
  tieInIssue(SERIES_ID.DETECTIVE, 9, { storyIds: [EVENT_NIGHT_OF_OWLS], eventIds: [EVENT_NIGHT_OF_OWLS], characterIds: [CHAR.BATMAN, CHAR.COURT_OF_OWLS], notes: "Night of the Owls tie-in, per Wikipedia + official dc.com collection page (which notes Detective Comics was originally not part of the crossover but was ultimately included).", status: "verified" }),
  tieInIssue(SERIES_ID.DETECTIVE, 15, { storyIds: [EVENT_DEATH_OF_FAMILY], eventIds: [EVENT_DEATH_OF_FAMILY], characterIds: [CHAR.BATMAN, CHAR.JOKER], notes: "Death of the Family tie-in, per Wikipedia's crossover issue list." }),
  tieInIssue(SERIES_ID.DETECTIVE, 16, { storyIds: [EVENT_DEATH_OF_FAMILY], eventIds: [EVENT_DEATH_OF_FAMILY], characterIds: [CHAR.BATMAN, CHAR.JOKER], notes: "Death of the Family tie-in, per Wikipedia's crossover issue list." }),
  tieInIssue(SERIES_ID.DETECTIVE, 18, { storyIds: [EVENT_REQUIEM], eventIds: [EVENT_REQUIEM], characterIds: [CHAR.BATMAN, CHAR.ROBIN_DAMIAN], notes: "Requiem tie-in reacting to Damian Wayne's death, corroborated by an independent contemporary review (graphicpolicy.com) covering it alongside the other Requiem issues." }),
  tieInIssue(SERIES_ID.DETECTIVE, 52, { characterIds: [CHAR.BATMAN], notes: "Confirmed final issue of Detective Comics (2011), per a 2011-2016 series date range attached to issue #52 listings (DC Database/whakoom).", status: "verified" }),
);

// Batman and Robin #9, 15, 16, 18, 40(finale)
issues.push(
  tieInIssue(SERIES_ID.BATMAN_ROBIN, 9, { storyIds: [EVENT_NIGHT_OF_OWLS], eventIds: [EVENT_NIGHT_OF_OWLS], characterIds: [CHAR.BATMAN, CHAR.ROBIN_DAMIAN, CHAR.COURT_OF_OWLS], creatorIds: [buildCreatorId("Peter Tomasi"), buildCreatorId("Patrick Gleason")], notes: "Night of the Owls tie-in, per Wikipedia + official dc.com collection page.", status: "verified" }),
  tieInIssue(SERIES_ID.BATMAN_ROBIN, 15, { storyIds: [EVENT_DEATH_OF_FAMILY], eventIds: [EVENT_DEATH_OF_FAMILY], characterIds: [CHAR.BATMAN, CHAR.ROBIN_DAMIAN, CHAR.JOKER], creatorIds: [buildCreatorId("Peter Tomasi"), buildCreatorId("Patrick Gleason")], notes: "Death of the Family tie-in, per Wikipedia's crossover issue list." }),
  tieInIssue(SERIES_ID.BATMAN_ROBIN, 16, { storyIds: [EVENT_DEATH_OF_FAMILY], eventIds: [EVENT_DEATH_OF_FAMILY], characterIds: [CHAR.BATMAN, CHAR.ROBIN_DAMIAN, CHAR.JOKER], creatorIds: [buildCreatorId("Peter Tomasi"), buildCreatorId("Patrick Gleason")], notes: "Death of the Family tie-in, per Wikipedia's crossover issue list." }),
  tieInIssue(SERIES_ID.BATMAN_ROBIN, 18, { storyIds: [EVENT_REQUIEM], eventIds: [EVENT_REQUIEM], characterIds: [CHAR.BATMAN, CHAR.ROBIN_DAMIAN], creatorIds: [buildCreatorId("Peter Tomasi"), buildCreatorId("Patrick Gleason")], notes: "Requiem for Damian — the direct in-title reaction issue, part of the wider 4-series Requiem crossover.", status: "verified" }),
  tieInIssue(SERIES_ID.BATMAN_ROBIN, 40, { characterIds: [CHAR.BATMAN, CHAR.ROBIN_DAMIAN], creatorIds: [buildCreatorId("Peter Tomasi"), buildCreatorId("Patrick Gleason")], notes: "Confirmed final issue of Batman and Robin (2011), dated 2015 (Goodreads/CBR/ComicBookRoundUp).", status: "verified" }),
);

// Batgirl #9, 13-16, 18, 52(finale)
issues.push(
  tieInIssue(SERIES_ID.BATGIRL, 9, { storyIds: [EVENT_NIGHT_OF_OWLS], eventIds: [EVENT_NIGHT_OF_OWLS], characterIds: [CHAR.BATGIRL, CHAR.COURT_OF_OWLS], creatorIds: [buildCreatorId("Gail Simone")], notes: "Night of the Owls tie-in, per Wikipedia + official dc.com collection page.", status: "verified" }),
  ...[13,14,15,16].map(n => tieInIssue(SERIES_ID.BATGIRL, n, { storyIds: [EVENT_DEATH_OF_FAMILY], eventIds: [EVENT_DEATH_OF_FAMILY], characterIds: [CHAR.BATGIRL, CHAR.JOKER], creatorIds: [buildCreatorId("Gail Simone")], notes: "Death of the Family tie-in, per Wikipedia's crossover issue list." })),
  tieInIssue(SERIES_ID.BATGIRL, 18, { storyIds: [EVENT_REQUIEM], eventIds: [EVENT_REQUIEM], characterIds: [CHAR.BATGIRL, CHAR.ROBIN_DAMIAN], creatorIds: [buildCreatorId("Gail Simone")], notes: "Requiem tie-in reacting to Damian Wayne's death, corroborated by an independent contemporary review (graphicpolicy.com)." }),
  tieInIssue(SERIES_ID.BATGIRL, 52, { characterIds: [CHAR.BATGIRL], notes: "Confirmed final issue of Batgirl (2011), per the official dc.com issue page for Batgirl #52 and a 2011-2016 series date range.", status: "verified" }),
);

// Catwoman #9, 13-14, 52(finale)
issues.push(
  tieInIssue(SERIES_ID.CATWOMAN, 9, { storyIds: [EVENT_NIGHT_OF_OWLS], eventIds: [EVENT_NIGHT_OF_OWLS], characterIds: [CHAR.CATWOMAN, CHAR.COURT_OF_OWLS], creatorIds: [buildCreatorId("Judd Winick")], notes: "Night of the Owls tie-in, per Wikipedia + official dc.com collection page.", status: "verified" }),
  ...[13,14].map(n => tieInIssue(SERIES_ID.CATWOMAN, n, { storyIds: [EVENT_DEATH_OF_FAMILY], eventIds: [EVENT_DEATH_OF_FAMILY], characterIds: [CHAR.CATWOMAN, CHAR.JOKER], creatorIds: [buildCreatorId("Judd Winick")], notes: "Death of the Family tie-in, per Wikipedia's crossover issue list." })),
  tieInIssue(SERIES_ID.CATWOMAN, 52, { characterIds: [CHAR.CATWOMAN], notes: "Confirmed final issue of Catwoman (2011), corroborated by an issue-#52 review dated 2016 (Weird Science DC Comics) and a 2011-2016 series date range.", status: "verified" }),
);

// Red Hood and the Outlaws #9, 15-17, 25(finale)
issues.push(
  tieInIssue(SERIES_ID.RED_HOOD, 9, { storyIds: [EVENT_NIGHT_OF_OWLS], eventIds: [EVENT_NIGHT_OF_OWLS], characterIds: [CHAR.RED_HOOD, CHAR.COURT_OF_OWLS], creatorIds: [buildCreatorId("Scott Lobdell")], notes: "Night of the Owls tie-in, per Wikipedia + official dc.com collection page.", status: "verified" }),
  ...[15,16,17].map(n => tieInIssue(SERIES_ID.RED_HOOD, n, { storyIds: [EVENT_DEATH_OF_FAMILY], eventIds: [EVENT_DEATH_OF_FAMILY], characterIds: [CHAR.RED_HOOD, CHAR.JOKER], creatorIds: [buildCreatorId("Scott Lobdell")], notes: "Death of the Family tie-in, per Wikipedia's crossover issue list. Note DC.com's own 2012-12-17 blog post additionally confirms Red Hood and the Outlaws joined this crossover." })),
  tieInIssue(SERIES_ID.RED_HOOD, 25, { characterIds: [CHAR.RED_HOOD], creatorIds: [buildCreatorId("Scott Lobdell")], notes: "Confirmed final issue of Red Hood and the Outlaws (2011), per the official dc.com issue page for #25 and a 2011-2015 series date range.", status: "verified" }),
);

// Batman: The Dark Knight #9, 29(finale)
issues.push(
  tieInIssue(SERIES_ID.DARK_KNIGHT, 9, { storyIds: [EVENT_NIGHT_OF_OWLS], eventIds: [EVENT_NIGHT_OF_OWLS], characterIds: [CHAR.BATMAN, CHAR.COURT_OF_OWLS], creatorIds: [buildCreatorId("David Finch")], notes: "Night of the Owls tie-in, per Wikipedia + official dc.com collection page.", status: "verified" }),
  tieInIssue(SERIES_ID.DARK_KNIGHT, 29, { characterIds: [CHAR.BATMAN], creatorIds: [buildCreatorId("Gregg Hurwitz")], notes: "Confirmed final issue (cover-dated March 2014) of Batman: The Dark Knight (2011) vol. 2, per Wikipedia's 'Batman: The Dark Knight' article and a matching dc.com issue page for the series.", status: "verified" }),
);

// Batman Incorporated #0, 1, 6, 8, 13
issues.push(
  tieInIssue(SERIES_ID.BATMAN_INC_2012, 0, { characterIds: [CHAR.BATMAN, CHAR.ROBIN_DAMIAN], creatorIds: [buildCreatorId("Grant Morrison"), buildCreatorId("Yanick Paquette")], notes: "First issue of the New 52 volume (May 2012); Yanick Paquette reported as artist for this specific issue.", status: "partially_verified" }),
  tieInIssue(SERIES_ID.BATMAN_INC_2012, 1, { characterIds: [CHAR.BATMAN, CHAR.ROBIN_DAMIAN], creatorIds: [buildCreatorId("Grant Morrison"), buildCreatorId("Chris Burnham")], notes: "DC's own solicitation material confirms Batman Incorporated (2012) made its New 52 debut with issue #1 (per the task's carried-over confirmed context).", status: "verified" }),
  ...[2,3,4,5].map(n => tieInIssue(SERIES_ID.BATMAN_INC_2012, n, { characterIds: [CHAR.BATMAN, CHAR.ROBIN_DAMIAN], creatorIds: [buildCreatorId("Grant Morrison"), buildCreatorId("Chris Burnham")], notes: "Existence and series membership confirmed as part of the 'Demon Star' collection's #0-6 range (official dc.com collection page); individual issue title/cover date not independently verified in this pass.", status: "partially_verified" })),
  tieInIssue(SERIES_ID.BATMAN_INC_2012, 6, { characterIds: [CHAR.BATMAN, CHAR.ROBIN_DAMIAN], creatorIds: [buildCreatorId("Grant Morrison"), buildCreatorId("Chris Burnham")], notes: "Final issue of the 'Demon Star' collection (#0-6), confirmed via the official dc.com collection page.", status: "verified" }),
  tieInIssue(SERIES_ID.BATMAN_INC_2012, 8, { storyIds: [STORY_BATINC_DEATH_OF_ROBIN], eventIds: [STORY_BATINC_DEATH_OF_ROBIN, EVENT_REQUIEM], characterIds: [CHAR.ROBIN_DAMIAN, CHAR.BATMAN], creatorIds: [buildCreatorId("Grant Morrison"), buildCreatorId("Chris Burnham")], notes: "Damian Wayne's death — confirmed by multiple independent contemporary sources (see the 'Death of Robin' story record).", status: "verified" }),
  tieInIssue(SERIES_ID.BATMAN_INC_2012, 13, { characterIds: [CHAR.BATMAN], creatorIds: [buildCreatorId("Grant Morrison"), buildCreatorId("Chris Burnham")], notes: "Confirmed final issue of Batman Incorporated (2012) and the conclusion of Grant Morrison's 7-year Batman Incorporated saga (AV Club review headline: 'Batman Incorporated 13 concludes Grant Morrison's 7-year epic').", status: "verified" }),
);

/* ============================================================================
   8. COLLECTIONS — structured issueCoverage, overlaps represented explicitly
   ========================================================================= */
function coveredRow(seriesId, n, coveragePart = "complete") {
  return { seriesId, issueId: buildIssueId(seriesId, n), issueLabel: typeof n === "string" ? n : `#${n}`, coveragePart };
}
function collection({ title, format, publicationDate, isbn = null, pageCount = null, seriesIds, rows, notes, status = "verified", editionInfo = null }) {
  const id = buildCollectionId(title);
  return makeCollection({
    id, title, publisher: "DC Comics", format, publicationDate, isbn, pageCount,
    seriesIds, issueCoverage: rows, editionInfo,
    sourceInfo: officialDC(null, notes, status),
  });
}

const collections = [
  collection({
    title: "Batman Vol. 1: The Court of Owls", format: "Hardcover", publicationDate: "2012-05-09", pageCount: 176,
    seriesIds: [SERIES_ID.BATMAN],
    rows: [1,2,3,4,5,6].map(n => coveredRow(SERIES_ID.BATMAN, n)),
    notes: "Confirmed directly via the official dc.com collection page: collects Batman (2011) #1-6, hardcover, published 2012-05-09, 176 pages, $24.99. NOTE: this is narrower than the full 'Court of Owls' story (#1-7) as represented in the Story entity — see 'Batman: The Court of Owls Saga' below for the wider #1-11 edition.",
  }),
  collection({
    title: "Batman Vol. 2: The City of Owls", format: "TPB", publicationDate: "2013-10-09", pageCount: 208,
    seriesIds: [SERIES_ID.BATMAN],
    rows: [...[8,9,10,11,12].map(n => coveredRow(SERIES_ID.BATMAN, n)), coveredRow(SERIES_ID.BATMAN, "annual-1")],
    notes: "Confirmed directly via the official dc.com collection page: collects Batman #8-12 and Annual #1, TPB, published 2013-10-09, 208 pages, $16.99. OVERLAP: issues #8-9 are ALSO collected in 'Batman: Night of the Owls' below (different edition, same underlying issues) — represented as two separate Collection records rather than collapsed.",
  }),
  collection({
    title: "Batman: The Court of Owls Saga (DC Essential Edition)", format: "Essential Edition",
    publicationDate: null, seriesIds: [SERIES_ID.BATMAN],
    rows: Array.from({length: 11}, (_, i) => coveredRow(SERIES_ID.BATMAN, i + 1)),
    notes: "Confirmed directly via the official dc.com collection page: 'Collects issues #1-11 of BATMAN as well as bonus material...'. OVERLAP: entirely re-collects the contents of both 'Vol. 1: The Court of Owls' (#1-6) and 'Vol. 2: The City of Owls' (#8-12, partially) into one bigger essential-line edition, plus issue #7 which neither smaller volume individually covers on its own release schedule.",
  }),
  collection({
    title: "Batman Vol. 3: Death of the Family", format: "TPB", publicationDate: null,
    seriesIds: [SERIES_ID.BATMAN],
    rows: [13,14,15,16,17].map(n => coveredRow(SERIES_ID.BATMAN, n)),
    notes: "Confirmed directly via the official dc.com collection page ('this epic from issues #13-17').",
  }),
  collection({
    title: "Batman Vol. 10: Epilogue", format: "TPB", publicationDate: null,
    seriesIds: [SERIES_ID.BATMAN],
    rows: [51,52].map(n => coveredRow(SERIES_ID.BATMAN, n)),
    notes: "Confirmed via Penguin Random House and Amazon listings (credited to Snyder, Capullo and Tynion IV), consistent with the 'Epilogue' story's #51-52 range.",
    status: "partially_verified",
  }),
  collection({
    title: "Batman by Scott Snyder & Greg Capullo Omnibus Vol. 1", format: "Omnibus", publicationDate: null,
    seriesIds: [SERIES_ID.BATMAN],
    rows: [
      ...Array.from({length: 34}, (_, i) => coveredRow(SERIES_ID.BATMAN, i)), // #0-33
      coveredRow(SERIES_ID.BATMAN, "23.2"),
      coveredRow(SERIES_ID.BATMAN, "annual-1"),
      coveredRow(SERIES_ID.BATMAN, "annual-2"),
    ],
    notes: "Confirmed via an independent detailed review (omnibus-store.com): 'Volume 1 contains Batman #0-33, #23.2 and Batman Annual #1-2', spanning the Court of Owls, Night of the Owls, Death of the Family and Zero Year arcs. This directly SUPERSEDES the un-verified '#1-33' figure that appeared only as an illustrative example in the originating task brief — the independently researched figure (#0-33 + specials) is used instead, per the task's own instruction to verify collection contents independently rather than assume the brief's example.",
    status: "verified",
  }),
  collection({
    title: "Batman: Night of the Owls", format: "Hardcover", publicationDate: "2013-11-06", pageCount: 368,
    seriesIds: [SERIES_ID.BATMAN, SERIES_ID.NIGHTWING, SERIES_ID.DETECTIVE, SERIES_ID.DARK_KNIGHT, SERIES_ID.BATMAN_ROBIN, SERIES_ID.RED_HOOD, SERIES_ID.BATGIRL, SERIES_ID.CATWOMAN],
    rows: [
      ...[8,9].map(n => coveredRow(SERIES_ID.BATMAN, n)),
      coveredRow(SERIES_ID.BATMAN, "annual-1"),
      coveredRow(SERIES_ID.DETECTIVE, 9),
      coveredRow(SERIES_ID.DARK_KNIGHT, 9),
      coveredRow(SERIES_ID.BATMAN_ROBIN, 9),
      coveredRow(SERIES_ID.RED_HOOD, 9),
      coveredRow(SERIES_ID.BATGIRL, 9),
      ...[8,9].map(n => coveredRow(SERIES_ID.NIGHTWING, n)),
      coveredRow(SERIES_ID.CATWOMAN, 9),
    ],
    notes: "Confirmed directly via the official dc.com collection page: hardcover, published 2013-11-06, 368 pages, collecting Batman #8-9, Batman Annual #1, Detective Comics #9, Batman: The Dark Knight #9, Batman and Robin #9, Red Hood and the Outlaws #9, Batgirl #9, Nightwing #8-9, and Catwoman #9 (plus Batwing #9, Birds of Prey #9 and All-Star Western #9, which are NOT represented as rows here since those series are out of this dataset's scope). MULTI-SERIES, NON-CONTIGUOUS coverage handled explicitly via per-row seriesId, exactly as Step 13 requires.",
  }),
  collection({
    title: "Batman Incorporated Vol. 1: Demon Star", format: "TPB", publicationDate: "2013-11-27",
    seriesIds: [SERIES_ID.BATMAN_INC_2012],
    rows: Array.from({length: 7}, (_, i) => coveredRow(SERIES_ID.BATMAN_INC_2012, i)), // #0-6
    notes: "Confirmed directly via the official dc.com collection page: 'The first BATMAN, INCORPORATED collection is now in trade paperback, with stories from issues #0-6!', published 2013-11-27.",
  }),
];

/* ============================================================================
   9. RELATIONSHIPS (graph edges)
   ========================================================================= */
function rel(sourceId, sourceType, relationshipType, targetId, targetType, notes, status = "partially_verified") {
  return makeRelationship({
    id: buildRelationshipId(sourceId, relationshipType, targetId),
    sourceId, sourceType, relationshipType, targetId, targetType,
    sourceInfo: dbSrc(null, notes, status),
  });
}

const STORY_SEQUENCE = [
  STORY_COURT_OF_OWLS, STORY_CITY_OF_OWLS, STORY_DEATH_OF_FAMILY,
  STORY_ZERO_YEAR_SECRET_CITY, STORY_ZERO_YEAR_DARK_CITY,
  STORY_ENDGAME, STORY_SUPERHEAVY, STORY_BLOOM, STORY_EPILOGUE,
];
const relationships = [];
for (let i = 1; i < STORY_SEQUENCE.length; i++) {
  relationships.push(rel(
    STORY_SEQUENCE[i], "story", "sequel_to", STORY_SEQUENCE[i - 1], "story",
    "Consecutive story arcs within the single ongoing Snyder/Capullo Batman (2011) run — direct narrative succession, confirmed by the arcs' consecutive issue ranges from the same officially-sourced collection pages.",
    "verified",
  ));
}
relationships.push(
  rel(STORY_CITY_OF_OWLS, "story", "part_of_event", EVENT_NIGHT_OF_OWLS, "story",
    "Batman #8-9 (within the City of Owls arc) are the core Batman-side chapters of the Night of the Owls crossover event, per Wikipedia + the official dc.com Night of the Owls collection page.", "verified"),
  rel(STORY_DEATH_OF_FAMILY, "story", "part_of_event", EVENT_DEATH_OF_FAMILY, "story",
    "Batman #13-17 are the core chapters of the wider 7-series Death of the Family crossover event.", "verified"),
  rel(EVENT_REQUIEM, "story", "tie_in_to", STORY_BATINC_DEATH_OF_ROBIN, "story",
    "The 4-series Requiem crossover (Batman/Batman and Robin/Batgirl/Detective Comics #18) is a direct reaction to, and tie-in with, Damian Wayne's death in Batman Incorporated (2012) #8.", "verified"),
  rel(SERIES_ID.BATMAN_INC_2012, "series", "continues", SERIES_ID.BATMAN_INC_2010, "series",
    "The New 52 Batman Incorporated (2012) directly continues Grant Morrison's 2010-2011 Batman Incorporated storyline rather than rebooting it from scratch — both volumes are written by Morrison and depict one ongoing Leviathan/Talia al Ghul conspiracy arc, per Wikipedia's Batman Incorporated article.", "verified"),
  rel(STORY_BATINC_DEATH_OF_ROBIN, "story", "part_of_event", STORY_BATINC_DEATH_OF_ROBIN, "story",
    "placeholder-removed", "unverified"), // will be filtered out below; kept structure simple
);
// Remove the accidental self-referential placeholder row above (kept the code path uniform above; drop it here).
relationships.pop();

/* ============================================================================
   10. READING PATHS
   ========================================================================= */
function entry(order, entityType, entityId, note = null, branchLabel = null) {
  return { order, entityType, entityId, note, branchLabel };
}

const readingPaths = [
  makeReadingPath({
    id: buildReadingPathId(["batman", "new-52"], "essential"),
    characterId: CHAR.BATMAN, continuityId: CONT_NEW52, universeId: UNIVERSE_ID,
    pathType: "essential",
    title: "Batman — New 52 Essential Path",
    description:
      "The major Batman (2011) narrative only — the researched Snyder/Capullo story arcs, in recommended reading (= publication) order, skipping crossover tie-in issues and other-series material. This is the shortest path that reads as one complete Bruce Wayne story from the New 52 relaunch through the pre-Rebirth ending.",
    entries: STORY_SEQUENCE.map((id, i) => entry(i + 1, "story", id)),
    sourceInfo: dbSrc(null, "Hand-curated from the researched, officially-sourced story-arc boundaries above; not derived by sorting issue numbers.", "partially_verified"),
  }),
  makeReadingPath({
    id: buildReadingPathId(["batman", "new-52"], "main_series"),
    characterId: CHAR.BATMAN, continuityId: CONT_NEW52, universeId: UNIVERSE_ID,
    pathType: "main_series",
    title: "Batman — New 52 Main Batman Series Path",
    description:
      "Batman (2011) read straight through in publication order, issue by issue, #0 through #52 — the single ongoing series on its own, with no other Bat-family titles interleaved. This is the 'just follow Batman (2011) itself' path distinct from the Essential path (which skips non-arc issues) and the Complete/Expanded path (which interleaves crossovers).",
    entries: Array.from({ length: 53 }, (_, n) => entry(n + 1, "issue", buildIssueId(SERIES_ID.BATMAN, n))),
    sourceInfo: dbSrc(null, "Publication-order issue sequence taken directly from the confirmed #0-52 numbered run.", "partially_verified"),
  }),
  makeReadingPath({
    id: buildReadingPathId(["batman", "new-52"], "complete"),
    characterId: CHAR.BATMAN, continuityId: CONT_NEW52, universeId: UNIVERSE_ID,
    pathType: "complete",
    title: "Batman — New 52 Complete/Expanded Path",
    description:
      "A recommended (not the only legitimate) interleaving of Batman (2011) with the Bat-family crossover tie-ins and Batman Incorporated (2012), for readers who want the full researched New 52 Batman ecosystem rather than just the core series. " +
      "This is ONE recommended-reading-order construction; a strict PUBLICATION-order reader would instead read each series' own issues on their real-world monthly release schedule (which interleaves far more finely, week to week, across all 9 series at once) — that distinction is preserved via the branch below rather than presented as the only correct order.",
    entries: [
      entry(1, "story", STORY_COURT_OF_OWLS),
      entry(2, "story", STORY_CITY_OF_OWLS),
      entry(3, "story", EVENT_NIGHT_OF_OWLS, "Bat-family tie-in issues for the Night of the Owls crossover (Nightwing #8-9, Detective Comics #9, Batman and Robin #9, Batgirl #9, Catwoman #9, Red Hood and the Outlaws #9, Batman: The Dark Knight #9) — read alongside/after Batman #8-9."),
      entry(4, "story", STORY_DEATH_OF_FAMILY),
      entry(5, "story", EVENT_DEATH_OF_FAMILY, "Bat-family tie-in issues for Death of the Family across Batgirl, Batman and Robin, Catwoman, Detective Comics, Nightwing and Red Hood and the Outlaws."),
      entry(6, "series", SERIES_ID.BATMAN_INC_2012, "Batman Incorporated (2012) #0-13 — largely self-contained, but its climax (#8, Damian Wayne's death) is the direct cause of the next entry."),
      entry(7, "story", EVENT_REQUIEM, "Batman #18 / Batman and Robin #18 / Batgirl #18 / Detective Comics #18 — the Bat-family's reaction to Damian Wayne's death in Batman Incorporated #8."),
      entry(8, "story", STORY_ZERO_YEAR_SECRET_CITY),
      entry(9, "story", STORY_ZERO_YEAR_DARK_CITY),
      entry(10, "story", STORY_ENDGAME),
      entry(11, "story", STORY_SUPERHEAVY),
      entry(12, "story", STORY_BLOOM),
      entry(13, "story", STORY_EPILOGUE),
    ],
    branches: [
      {
        id: "publication-order-note",
        label: "Strict publication order (alternative)",
        fromEntryIndex: 0,
        entries: [
          entry(1, "series", SERIES_ID.BATMAN, "In strict real-world publication order, all 9 series' issues release in parallel on a monthly cadence rather than in the block sequence above; this branch exists to record that distinction per the task's requirement to preserve publication-order vs recommended-order differences, rather than to fully re-enumerate a week-by-week schedule that was not independently verified in this research pass."),
        ],
      },
    ],
    sourceInfo: dbSrc(null, "Hand-curated ordering built directly from the researched story/event boundaries above; the publication-order distinction is flagged rather than silently collapsed into one 'correct' order.", "partially_verified"),
  }),
];

/* ============================================================================
   11. EXPORT + VALIDATION
   ========================================================================= */
export const dataset = {
  universes, continuities, characters, series: seriesList, runs, stories,
  issues, collections, creators, relationships, readingPaths,
};

/**
 * Full offline validation: per-entity schema validators PLUS referential
 * integrity across the whole dataset (Step 24). Runs entirely in memory —
 * no Firestore access required, so it can run in Node or in the browser.
 */
export function validateDataset() {
  const errors = [];
  const warnings = [];

  const checks = [
    ["universe", universes, validateUniverse],
    ["continuity", continuities, validateContinuity],
    ["character", characters, validateCharacter],
    ["series", seriesList, validateSeries],
    ["run", runs, validateRun],
    ["story", stories, validateStory],
    ["issue", issues, validateIssue],
    ["collection", collections, validateCollection],
    ["creator", creators, validateCreator],
    ["relationship", relationships, validateRelationship],
    ["readingPath", readingPaths, validateReadingPath],
  ];

  // 1. Per-entity shape validation + duplicate-ID detection within each collection.
  for (const [name, list, validate] of checks) {
    const seen = new Set();
    for (const entity of list) {
      const { valid, errors: entErrors } = validate(entity);
      if (!valid) errors.push(`[${name} ${entity && entity.id}] ${entErrors.join("; ")}`);
      if (entity && entity.id) {
        if (seen.has(entity.id)) errors.push(`[${name}] duplicate ID: ${entity.id}`);
        seen.add(entity.id);
      }
    }
  }

  // 2. Build ID indexes for referential-integrity checks.
  const ids = {
    universe: new Set(universes.map(e => e.id)),
    continuity: new Set(continuities.map(e => e.id)),
    character: new Set(characters.map(e => e.id)),
    series: new Set(seriesList.map(e => e.id)),
    run: new Set(runs.map(e => e.id)),
    story: new Set(stories.map(e => e.id)),
    issue: new Set(issues.map(e => e.id)),
    collection: new Set(collections.map(e => e.id)),
    creator: new Set(creators.map(e => e.id)),
  };
  const byType = { universe: "universe", continuity: "continuity", character: "character", series: "series", run: "run", story: "story", issue: "issue", collection: "collection", creator: "creator" };

  const need = (setName, id, where) => {
    if (id == null) return;
    if (!ids[setName].has(id)) errors.push(`Broken reference: ${where} -> ${setName} "${id}" does not exist`);
  };
  const needAll = (setName, arr, where) => (arr || []).forEach(id => need(setName, id, where));

  // Series -> continuity/creator/character
  for (const s of seriesList) {
    needAll("continuity", s.continuityIds, `series ${s.id}.continuityIds`);
    needAll("creator", s.creatorIds, `series ${s.id}.creatorIds`);
    needAll("character", s.characterIds, `series ${s.id}.characterIds`);
    need("universe", s.universeId, `series ${s.id}.universeId`);
  }
  // Runs -> series/creator
  for (const r of runs) {
    need("series", r.seriesId, `run ${r.id}.seriesId`);
    needAll("creator", r.creatorIds, `run ${r.id}.creatorIds`);
  }
  // Stories -> series/run/issue/character/creator/continuity/event(story)
  for (const st of stories) {
    needAll("series", st.seriesIds, `story ${st.id}.seriesIds`);
    if (st.runId) need("run", st.runId, `story ${st.id}.runId`);
    needAll("issue", st.issueIds, `story ${st.id}.issueIds`);
    needAll("character", st.characterIds, `story ${st.id}.characterIds`);
    needAll("creator", st.creatorIds, `story ${st.id}.creatorIds`);
    if (st.continuityId) need("continuity", st.continuityId, `story ${st.id}.continuityId`);
    if (st.eventId) need("story", st.eventId, `story ${st.id}.eventId`);
    // Every issue a story claims must actually list that series in its own seriesId.
    for (const issueId of st.issueIds) {
      const iss = issues.find(i => i.id === issueId);
      if (iss && !st.seriesIds.includes(iss.seriesId)) {
        errors.push(`Inconsistent series: story ${st.id} claims issue ${issueId}, but that issue belongs to series "${iss.seriesId}" which is not in the story's seriesIds`);
      }
    }
  }
  // Issues -> series/continuity/character/creator/story/event
  for (const iss of issues) {
    need("series", iss.seriesId, `issue ${iss.id}.seriesId`);
    if (iss.continuityId) need("continuity", iss.continuityId, `issue ${iss.id}.continuityId`);
    needAll("character", iss.characterIds, `issue ${iss.id}.characterIds`);
    needAll("creator", iss.creatorIds, `issue ${iss.id}.creatorIds`);
    needAll("story", iss.storyIds, `issue ${iss.id}.storyIds`);
    needAll("story", iss.eventIds, `issue ${iss.id}.eventIds (events are modeled as story entities)`);
  }
  // Collections -> series/issue/story, and issueCoverage[].issueId must belong to the row's own seriesId
  for (const c of collections) {
    needAll("series", c.seriesIds, `collection ${c.id}.seriesIds`);
    for (const row of c.issueCoverage) {
      need("issue", row.issueId, `collection ${c.id}.issueCoverage[]`);
      const iss = issues.find(i => i.id === row.issueId);
      if (iss && row.seriesId && iss.seriesId !== row.seriesId) {
        errors.push(`Inconsistent series: collection ${c.id} coverage row for ${row.issueId} says seriesId "${row.seriesId}" but the issue's real seriesId is "${iss.seriesId}"`);
      }
      if (iss && !c.seriesIds.includes(iss.seriesId)) {
        errors.push(`Orphaned coverage: collection ${c.id} covers issue ${row.issueId} (series ${iss.seriesId}) but that series is not listed in the collection's own seriesIds`);
      }
    }
    // issueIdsCovered mirror must stay exactly in sync with issueCoverage (Step 24: "accidental duplicate collections" / drift).
    const expected = c.issueCoverage.map(r => r.issueId).filter(Boolean);
    const gotSame = expected.length === c.issueIdsCovered.length && expected.every((v, i) => v === c.issueIdsCovered[i]);
    if (!gotSame) errors.push(`collection ${c.id}: issueIdsCovered mirror is out of sync with issueCoverage`);
  }
  // Relationships -> source/target must exist as the declared entityType
  for (const r of relationships) {
    if (!ids[r.sourceType]) { errors.push(`relationship ${r.id}: unknown sourceType "${r.sourceType}"`); }
    else need(r.sourceType, r.sourceId, `relationship ${r.id}.sourceId`);
    if (!ids[r.targetType]) { errors.push(`relationship ${r.id}: unknown targetType "${r.targetType}"`); }
    else need(r.targetType, r.targetId, `relationship ${r.id}.targetId`);
  }
  // Reading paths -> every entry must resolve to a real entity of its declared type
  for (const p of readingPaths) {
    if (p.continuityId) need("continuity", p.continuityId, `readingPath ${p.id}.continuityId`);
    if (p.characterId) need("character", p.characterId, `readingPath ${p.id}.characterId`);
    const allEntries = [...p.entries, ...p.branches.flatMap(b => b.entries)];
    for (const e of allEntries) {
      if (!ids[e.entityType]) { errors.push(`readingPath ${p.id}: unknown entityType "${e.entityType}" in entry order=${e.order}`); continue; }
      need(e.entityType, e.entityId, `readingPath ${p.id}.entries[order=${e.order}]`);
    }
  }

  // 3. Duplicate-collection heuristic (Step 24: "accidental duplicate collections") —
  //    two Collection records with the exact same title+format+seriesIds+issue set.
  const collSignature = c => `${c.title}::${c.format}::${[...c.issueCoverage.map(r=>r.issueId)].sort().join(",")}`;
  const seenSig = new Map();
  for (const c of collections) {
    const sig = collSignature(c);
    if (seenSig.has(sig)) errors.push(`Accidental duplicate collection: "${c.id}" and "${seenSig.get(sig)}" have identical title/format/issue coverage`);
    seenSig.set(sig, c.id);
  }

  return { valid: errors.length === 0, errors, warnings, counts: Object.fromEntries(checks.map(([name, list]) => [name, list.length])) };
}

/**
 * Smallest safe additive-only import: upserts every entity in the dataset via
 * the Phase 1 data-access layer (upsertEntity / upsertCollectionEdition),
 * keyed by this dataset's own stable IDs — re-running it is always safe
 * (idempotent overwrite of the SAME ids, never a destructive replace of the
 * whole collection, never touches the old flat `comics` collection).
 */
export async function importDataset({ upsertEntity, upsertCollectionEdition, COLLECTIONS }) {
  const result = { validation: validateDataset(), written: {}, errors: [] };
  if (!result.validation.valid) return result; // never import an invalid dataset

  const writeAll = async (collectionName, list, upsertFn = upsertEntity) => {
    let n = 0;
    for (const entity of list) {
      try {
        if (upsertFn === upsertEntity) await upsertEntity(collectionName, entity.id, entity);
        else await upsertFn(entity.id, entity);
        n++;
      } catch (e) {
        result.errors.push(`${collectionName}/${entity.id}: ${e.message}`);
      }
    }
    result.written[collectionName] = n;
  };

  await writeAll(COLLECTIONS.UNIVERSES, universes);
  await writeAll(COLLECTIONS.CONTINUITIES, continuities);
  await writeAll(COLLECTIONS.CHARACTERS, characters);
  await writeAll(COLLECTIONS.CREATORS, creators);
  await writeAll(COLLECTIONS.SERIES, seriesList);
  await writeAll(COLLECTIONS.RUNS, runs);
  await writeAll(COLLECTIONS.STORIES, stories);
  await writeAll(COLLECTIONS.ISSUES, issues);
  await writeAll(COLLECTIONS.COLLECTIONS, collections, upsertCollectionEdition);
  await writeAll(COLLECTIONS.RELATIONSHIPS, relationships);
  await writeAll(COLLECTIONS.READING_PATHS, readingPaths);

  return result;
}
