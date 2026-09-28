ALLABOUTDC — DC COMICS EXPLORER PASS 3

This pass addresses the latest Comics Explorer review.

WHAT CHANGED
- Character entry is explicitly Batman-only at the current New 52 starting scope.
- Supporting characters remain inside Batman territory rather than appearing as peer root characters.
- Gotham Academy is represented through the character Olive Silverlock; the publication remains Gotham Academy.
- Batman series are presented as Batman / Bat-Family / Gotham & Spin-offs / Team-Ups / Other Batman, with Batman itself first.
- Creative runs are metadata on the series page; the extra “View run” navigation layer is removed from the normal flow.
- Series Overview now contains an actual story/series gist, not only issue ranges.
- Publication order is Overview → Collected Editions → Annuals → Specials.
- There is no Issues tab. The numbered issue run is represented by a dedicated overview card.
- Collected Editions use format tabs only; there is no All tab. Formats are ordered TPB, Hardcover, Omnibus, Deluxe, Compact, Special Editions.
- Collection cards are visual, ordered cards with publication coverage.
- Batman Vol. 1–10 are classified as TPB in this catalogue view; Omnibus and Compact are separate formats.
- Compact Comics Edition is detected as Compact even if stale Firestore data has an inconsistent format field.
- Batgirl’s publisher volume-number reset is handled in the display so the second Vol. 1/2/3 sequence does not look like duplicate catalogue numbering; official titles remain in the underlying data.
- Annuals and Specials have explicit publication-type labels even where issue-title metadata has not yet been expanded.
- Featured Territory and Starting Point blocks were removed from the Comics landing page.
- Atlas / Story Map was NOT modified in this pass.

CURRENT DATA VALIDATION
- 26 series
- 788 publication units/issues
- 97 collected editions
- 12 supporting/root character records
- 1 catalogue-root character: Batman
- Dataset validation: PASS

DEPLOY
Replace only the files included in this package, especially:
- index.html
- style.css
- comics-v2/schema.js
- comics-v2/seed-batman-new52.js
- comics-v2/explorer.js
- comics-v2/landing.js
- comics-v2/index.js

Do not replace app.js, firebase-config.js, data.js, storymap.js or unrelated site files.

IMPORT
Because the seed data changed, run the clean New 52 Batman reset/import once after deployment. Do not run it repeatedly.

ATLAS
No Atlas/Story Map changes are included. The current flowchart will be redesigned separately.
