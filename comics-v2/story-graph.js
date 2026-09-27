// ============================================================================
// comics-v2 / story-graph.js
// ----------------------------------------------------------------------------
// POINTER 6 — CONTEXTUAL Story Graph helpers (pure: no Firestore, no DOM).
//
// Given ONE story and the comicRelationships records touching it, group the
// connected entities the way a reader thinks about them. Only relationship
// types actually present in the data produce a group; an unknown/future type
// falls into "Related" rather than being dropped or invented.
//
// Direction always comes from the record itself (sourceId → relationshipType →
// targetId). IMPORTANT: none of these groups is a reading order. Before/After
// reflect recorded story continuity (sequel_to / prequel_to / continues); events,
// tie-ins and crossovers are connections only — what to read next is decided by
// reading paths (comicReadingPaths), never by this module.
// ============================================================================

export const GROUPS = [
  { id: "before", label: "Before" },
  { id: "after", label: "After" },
  { id: "event", label: "Part of event" },
  { id: "in_event", label: "In this event" },
  { id: "crossover", label: "Crossover" },
  { id: "tie_ins", label: "Tie-ins" },
  { id: "related", label: "Related" },
];

// [group when THIS story is the source, group when THIS story is the target]
const GROUP_BY_TYPE = {
  sequel_to: ["before", "after"],        // A sequel_to B: B comes before A
  prequel_to: ["after", "before"],       // A prequel_to B: B comes after A
  continues: ["before", "after"],
  part_of_event: ["event", "in_event"],
  crossover_with: ["crossover", "crossover"],
  tie_in_to: ["tie_ins", "tie_ins"],
};

/** Short phrase shown on each connected row, from this story's point of view. */
const PHRASE_BY_TYPE = {
  sequel_to: ["Comes before this story", "Continues after this story"],
  prequel_to: ["Comes after this story", "Leads into this story"],
  continues: ["This continues it", "Continues this"],
  part_of_event: ["Event this story is part of", "Part of this event"],
  crossover_with: ["Crossover", "Crossover"],
  tie_in_to: ["This story ties in to it", "Ties in to this story"],
  spin_off_from: ["Spun off from", "Spin-off"],
  relaunches: ["Relaunches", "Relaunched as"],
  alternate_version_of: ["Alternate version of", "Has alternate version"],
  adaptation_of: ["Adaptation of", "Adapted as"],
  features_character: ["Features", "Featured in"],
};
const human = (t) => String(t || "").replace(/_/g, " ");

/** Full factual sentence using both titles, straight from the record's direction. */
export function connectionSentence(rel, sourceTitle, targetTitle) {
  const s = sourceTitle || "This story", t = targetTitle || "another story";
  switch (rel.relationshipType) {
    case "sequel_to": return `${s} follows ${t}`;
    case "prequel_to": return `${s} is a prequel to ${t}`;
    case "continues": return `${s} continues ${t}`;
    case "part_of_event": return `${s} is part of ${t}`;
    case "crossover_with": return `${s} crosses over with ${t}`;
    case "tie_in_to": return `${s} ties in to ${t}`;
    default: return `${s} — ${human(rel.relationshipType)} — ${t}`;
  }
}

/**
 * groupConnections(storyId, rels) → [{ id, label, items:[{ rel, otherId, otherType, outgoing, phrase }] }]
 * Only non-empty groups, in GROUPS order. Self-links are ignored; duplicates collapsed.
 */
export function groupConnections(storyId, rels) {
  const byGroup = new Map(GROUPS.map(g => [g.id, []]));
  const seen = new Set();
  (rels || []).forEach(rel => {
    if (!rel || rel.sourceId === rel.targetId) return;
    const outgoing = rel.sourceId === storyId;
    if (!outgoing && rel.targetId !== storyId) return;
    const otherId = outgoing ? rel.targetId : rel.sourceId;
    const otherType = outgoing ? rel.targetType : rel.sourceType;
    const pair = GROUP_BY_TYPE[rel.relationshipType];
    const group = pair ? pair[outgoing ? 0 : 1] : "related";
    const key = group + "|" + otherId;
    if (seen.has(key)) return;
    seen.add(key);
    const ph = PHRASE_BY_TYPE[rel.relationshipType];
    byGroup.get(group).push({ rel, otherId, otherType, outgoing, phrase: ph ? ph[outgoing ? 0 : 1] : human(rel.relationshipType) });
  });
  return GROUPS.map(g => ({ ...g, items: byGroup.get(g.id) })).filter(g => g.items.length);
}

/** True for connection kinds that must never be read as "read this next". */
export function isNonOrderingGroup(groupId) {
  return groupId === "event" || groupId === "in_event" || groupId === "crossover" || groupId === "tie_ins" || groupId === "related";
}
