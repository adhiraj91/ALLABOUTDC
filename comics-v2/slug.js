// ============================================================================
// comics-v2 / slug.js
// ----------------------------------------------------------------------------
// Stable-ID helpers for the new Comics domain model.
//
// RULE (per the Phase 1 spec): never use a display title as a database ID.
// Every builder here produces a lowercase, hyphenated, human-legible-but-stable
// slug — safe as a Firestore document ID, deterministic (same inputs always
// produce the same ID, so re-running an import never creates duplicates).
// ============================================================================

/** Turn any free-text string into a safe, stable slug segment. */
export function slugify(input) {
  return String(input == null ? "" : input)
    .toLowerCase()
    .normalize("NFKD").replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/'/g, "")                                  // don't turn ' into a hyphen (Nite-Owl's -> nite-owls)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/** Issue numbers/labels aren't always plain integers (#0, #23.1, Annual, One-Shot, Special). */
export function slugifyIssueLabel(label) {
  const s = slugify(label);
  // Purely numeric issue numbers get zero-padded to 3 digits for stable sort/lookup (1 -> 001).
  if (/^\d+$/.test(s)) return s.padStart(3, "0");
  // "23.1" -> slugify turns "." into "-", giving "23-1" already — leave as-is.
  return s || "unknown";
}

export const buildUniverseId    = (name) => slugify(name);
export const buildContinuityId  = (name) => slugify(name);
export const buildCharacterId   = (name) => slugify(name);
export const buildCreatorId     = (name) => slugify(name);

/** e.g. buildSeriesId("Batman", 2011) -> "batman-2011" */
export function buildSeriesId(title, startYear) {
  const y = startYear ? String(startYear).slice(0, 4) : "";
  return [slugify(title), y].filter(Boolean).join("-");
}

/** e.g. buildRunId("batman-2011", "Scott Snyder / Greg Capullo") -> "batman-2011-snyder-capullo" */
export function buildRunId(seriesId, creatorLabel) {
  return [seriesId, slugify(creatorLabel)].filter(Boolean).join("-");
}

/** e.g. buildStoryId("batman-2011", "Court of Owls") -> "batman-2011-court-of-owls" */
export function buildStoryId(seriesId, storyTitle) {
  return [seriesId, slugify(storyTitle)].filter(Boolean).join("-");
}

/** e.g. buildIssueId("batman-2011", "1") -> "batman-2011-001"; ("batman-2011","23.1") -> "batman-2011-23-1" */
export function buildIssueId(seriesId, issueLabel) {
  return [seriesId, slugifyIssueLabel(issueLabel)].filter(Boolean).join("-");
}

/** e.g. buildCollectionId("Batman Vol. 1: Court of Owls") -> "batman-vol-1-court-of-owls" */
export function buildCollectionId(title) {
  return slugify(title);
}

/** Deterministic so re-importing the same relationship twice never duplicates it. */
export function buildRelationshipId(sourceId, relationshipType, targetId) {
  return `${sourceId}__${slugify(relationshipType)}__${targetId}`;
}

/** e.g. buildReadingPathId("batman", "new-52", "essential") -> "batman-new-52-essential" */
export function buildReadingPathId(scopeSlugs, pathType) {
  const parts = Array.isArray(scopeSlugs) ? scopeSlugs : [scopeSlugs];
  return [...parts.map(slugify), slugify(pathType)].filter(Boolean).join("-");
}
