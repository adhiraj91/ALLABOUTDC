// ============================================================================
// comics-v2 / categories.js — the New 52 category hierarchy (franchise pillars).
// A MAPPING LAYER ONLY: it reads series records and assigns each one to a pillar; it never writes or edits a record,
// so existing Batman / Superman / Flash / Green Lantern data stays byte-identical. Order is fixed (never alphabetised).
// Resolution order for a series:  series.categoryKey (new imports carry it)  →  SERIES_CATEGORY[series.id]  →  "other-obscure".
// To place a future series, give its record a `categoryKey` or add its id below — no UI code changes.
// ============================================================================
export const CATEGORIES = [
  { key: "batman", label: "Batman" },
  { key: "superman", label: "Superman" },
  { key: "wonder-woman", label: "Wonder Woman" },
  { key: "flash", label: "Flash" },
  { key: "green-lantern", label: "Green Lantern" },
  { key: "justice-league", label: "Justice League" },
  { key: "aquaman", label: "Aquaman" },
  { key: "green-arrow", label: "Green Arrow" },
  { key: "titans-young-heroes", label: "Titans & Young Heroes" },
  { key: "suicide-squad", label: "Suicide Squad" },
  { key: "magic-supernatural", label: "Magic & Supernatural" },
  { key: "deathstroke-assassins", label: "Deathstroke & Assassins" },
  { key: "legion-future", label: "Legion & Future" },
  { key: "earth-2", label: "Earth 2" },
  { key: "other-dc-heroes", label: "Other DC Heroes" },
  { key: "wildstorm", label: "WildStorm" },
  { key: "all-star-western", label: "All-Star Western" },
  { key: "other-obscure", label: "Other / Obscure" },
];
const RANK = new Map(CATEGORIES.map((c, i) => [c.key, i]));
const BY_KEY = new Map(CATEGORIES.map(c => [c.key, c]));

const put = (key, ids) => Object.fromEntries(ids.map(id => [id, key]));
export const SERIES_CATEGORY = {
  // BATMAN — Batman and the Bat-family (placement unchanged from the existing Batman territory)
  ...put("batman", ["batman-2011", "detective-comics-2011", "batman-and-robin-2011", "batman-the-dark-knight-2011", "batman-incorporated-2012", "batman-eternal-2014", "batman-and-robin-eternal-2015", "batman-europa-2016",
    "batgirl-2011", "nightwing-2011", "grayson-2014", "red-hood-and-the-outlaws-2011", "red-hood-arsenal-2015", "robin-son-of-batman-2015", "we-are-robin-2015", "batwoman-2011", "catwoman-2011", "batwing-2011", "birds-of-prey-2011", "talon-2012", "bat-mite-2015", "batman-beyond-2015",
    "arkham-manor-2014", "gotham-academy-2014", "gotham-by-midnight-2014", "batman-superman-2013"]),
  // SUPERMAN — Superman family (Superboy and Superman/Wonder Woman included)
  ...put("superman", ["action-comics-2011", "superman-2011", "supergirl-2011", "superboy-2011", "superman-wonder-woman-2013", "superman-unchained-2013", "doomed-2015", "superman-american-alien-2016", "superman-lois-and-clark-2015", "superman-the-coming-of-the-supermen-2016"]),
  ...put("wonder-woman", ["wonder-woman-2011"]),
  ...put("flash", ["the-flash-2011"]),
  // GREEN LANTERN — the whole Lantern universe
  ...put("green-lantern", ["green-lantern", "green-lantern-corps", "green-lantern-new-guardians", "red-lanterns", "larfleeze", "sinestro", "green-lantern-lost-army-2015", "green-lantern-corps-edge-of-oblivion-2016", "omega-men-2015", "threshold-2013"]),
  // JUSTICE LEAGUE — core League + extended League teams
  ...put("justice-league", ["justice-league-2011", "justice-league-international-2011", "justice-league-of-america-2013", "justice-league-of-americas-vibe-2013", "justice-league-united-2014"]),
  ...put("aquaman", ["aquaman-2011", "aquaman-and-the-others-2014"]),
  ...put("green-arrow", ["green-arrow-2011"]),
  ...put("titans-young-heroes", ["teen-titans-2011", "blue-beetle-2011", "hawk-and-dove-2011"]),
  ...put("suicide-squad", ["suicide-squad-2011"]),
  // MAGIC & SUPERNATURAL — Justice League Dark is NOT a peer of Justice League; it lives here
  ...put("magic-supernatural", ["justice-league-dark-2011", "swamp-thing-2011", "animal-man-2011", "i-vampire-2011", "frankenstein-agent-of-s-h-a-d-e-2011", "resurrection-man-2011", "trinity-of-sin-phantom-stranger-2012", "trinity-of-sin-pandora-2013", "constantine-2013"]),
  ...put("deathstroke-assassins", ["deathstroke-2011"]),
  ...put("legion-future", ["legion-of-super-heroes-2011", "legion-lost-2011", "justice-league-3000", "justice-league-3001"]),
  // EARTH 2 — Worlds' Finest belongs here, not under Batman/Superman
  ...put("earth-2", ["earth-2-2012", "earth-2-worlds-end", "worlds-finest-2012"]),
  // OTHER DC HEROES — Hawkman, Cyborg, Martian Manhunter, Firestorm, Captain Atom, Mister Terrific (no separate top-level categories)
  ...put("other-dc-heroes", ["the-fury-of-firestorm-the-nuclear-men-2011", "the-savage-hawkman-2011", "cyborg-2015", "martian-manhunter-2015", "captain-atom-2011", "mister-terrific-2011"]),
};

export const categoryRank = (key) => RANK.has(key) ? RANK.get(key) : RANK.size;
export function categoryOf(series) {
  const k = series?.categoryKey;
  const key = BY_KEY.has(k) ? k : (SERIES_CATEGORY[series?.id] || "other-obscure");
  return BY_KEY.get(key);
}
