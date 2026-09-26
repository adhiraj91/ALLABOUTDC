// ============================================================================
// comics-v2 / explorer.js
// ----------------------------------------------------------------------------
// INTERACTIVE COMICS CONTINUITY EXPLORER (Pointer 3 / Phase 3).
//
// A character-first drill-down UI over the new, normalized Comics data model:
//   Comics -> Characters/Continuities/Series -> Character -> Continuity/Era
//   -> Series -> Creative Run -> Story -> Issues -> Issue detail
//
// Design rules this file follows throughout:
//   - EVERY screen is populated by a targeted Firestore read via comics-v2/data.js
//     (single doc, a capped list read, or a where()/array-contains query) —
//     never a bulk download of the whole Comics graph. Nothing here hardcodes
//     any real Comics data (no "Batman", "Court of Owls", "New 52", etc.) —
//     all of that is discovered from whatever the database actually returns.
//   - Like the rest of comics-v2, this module is independent of app.js: no
//     imports either direction. It reuses the SITE'S EXISTING sheet visual
//     language (the .sheet / .sheet-backdrop bottom-sheet, .sheet-section /
//     .sheet-label / .tag classes) purely via shared CSS classes on its own
//     DOM (#comicsExplorerSheet, added to index.html), plus a small set of
//     new cx-* classes (in style.css) for the drill-down list/breadcrumb UI
//     that don't already exist on the site.
//   - Every level has Loading / Empty / Error states, tolerates missing
//     fields without ever showing "undefined" or a broken image, and exposes
//     extra raw/verification detail only when Nerd Mode (the site's existing
//     #nerdToggle / localStorage "dc_nerd_mode") is on.
//   - Navigation is an explicit in-sheet stack (breadcrumb + back button),
//     not the browser history stack — the existing app.js popstate handler
//     already closes whatever sheet is open on a hardware/browser Back press,
//     which is exactly the "never trapped, always get back out" behavior
//     Pointer 3 requires, without this module needing to touch app.js's
//     shared tab/history logic at all.
// ============================================================================
import * as data from "./data.js";
import { COLLECTIONS } from "./schema.js";

/* ============================= small utils ============================= */
function esc(s) {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function isNerd() {
  try { return localStorage.getItem("dc_nerd_mode") === "true"; } catch (e) { return false; }
}
function dateRangeText(start, end) {
  if (!start && !end) return "";
  if (start && end) return `${start}–${end}`;
  if (start) return `${start}–present`;
  return String(end);
}
function firstYearOf(entityWithStartDate) {
  const m = String((entityWithStartDate && entityWithStartDate.startDate) || "").match(/\d{4}/);
  return m ? parseInt(m[0], 10) : 0;
}
function seriesDateRange(s) { return dateRangeText(s.startDate, s.endDate); }
function contDateRange(ct) {
  const range = dateRangeText(ct.startDate, ct.endDate);
  return [ct.shortName, range].filter(Boolean).join(" · ");
}
function runRangeText(r) {
  if (r.startIssue && r.endIssue) return `Issues #${r.startIssue}–#${r.endIssue}`;
  if (r.startIssue) return `From issue #${r.startIssue}`;
  return "";
}
function initialsOf(text) {
  const w = String(text || "?").trim().split(/\s+/).slice(0, 2).map(x => x[0]).join("").toUpperCase();
  return w || "?";
}
function humanizeRel(t) { return String(t || "").replace(/_/g, " "); }
function sortIssuesInPlace(issues) {
  issues.sort((a, b) => {
    const na = parseFloat(a.issueNumber), nb = parseFloat(b.issueNumber);
    const ka = isNaN(na) ? Infinity : na, kb = isNaN(nb) ? Infinity : nb;
    if (ka !== kb) return ka - kb;
    return String(a.issueLabel || "").localeCompare(String(b.issueLabel || ""));
  });
}

/* Small read-through cache — many screens resolve the same creator/character/
   continuity doc more than once per render pass; this keeps each unique id to
   one network read for the lifetime of the page (never a bulk collection scan). */
const _cache = new Map();
async function cachedGet(col, id) {
  if (!id) return null;
  const key = col + "::" + id;
  if (_cache.has(key)) return _cache.get(key);
  try {
    const e = await data.getEntity(col, id);
    _cache.set(key, e);
    return e;
  } catch (err) {
    console.warn("[Comics Explorer] read failed", col, id, err);
    return null;
  }
}
const ENTITY_META = {
  universe: { col: COLLECTIONS.UNIVERSES, name: e => e.name },
  continuity: { col: COLLECTIONS.CONTINUITIES, name: e => e.name },
  character: { col: COLLECTIONS.CHARACTERS, name: e => e.displayName || e.name },
  series: { col: COLLECTIONS.SERIES, name: e => e.title },
  run: { col: COLLECTIONS.RUNS, name: e => e.title || "Run" },
  story: { col: COLLECTIONS.STORIES, name: e => e.title },
  issue: { col: COLLECTIONS.ISSUES, name: e => e.issueLabel || e.title || "Issue" },
  collection: { col: COLLECTIONS.COLLECTIONS, name: e => e.title },
  creator: { col: COLLECTIONS.CREATORS, name: e => e.displayName || e.name },
};
async function labelForEntity(type, id) {
  const meta = ENTITY_META[type];
  if (!meta) return null;
  const e = await cachedGet(meta.col, id);
  return e ? meta.name(e) : null;
}
async function runLabel(r) {
  if (r.title) return r.title;
  const names = await Promise.all((r.creatorIds || []).map(id => cachedGet(COLLECTIONS.CREATORS, id)));
  const joined = names.filter(Boolean).map(c => c.displayName || c.name).join(" / ");
  return joined || "Untitled Run";
}

/* ============================= fragments ============================= */
function emptyHtml(msg) { return `<div class="cx-empty">${esc(msg)}</div>`; }
function errorHtml(e) {
  return `<div class="cx-error">Couldn't load this right now — please try again.${isNerd() && e ? `<div class="cx-nerd-block">${esc(e.message || String(e))}</div>` : ""}</div>`;
}
function coverBlockHtml(url, altLabel) {
  if (!url) return "";
  return `<div class="cx-hero-cover"><img class="cx-cover" src="${esc(url)}" alt="" data-fallback="${esc(altLabel || "")}"></div>`;
}
function wireCovers(container) {
  container.querySelectorAll("img.cx-cover").forEach(img => {
    img.addEventListener("error", () => {
      const wrap = img.parentElement;
      const label = img.dataset.fallback || "";
      wrap.innerHTML = `<div class="cx-cover-fallback">${esc(initialsOf(label))}</div>`;
    }, { once: true });
  });
}
function nerdBlock(obj) {
  const lines = Object.entries(obj)
    .filter(([k, v]) => k !== "verification" && v != null && !(Array.isArray(v) && v.length === 0) && v !== "")
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
  const v = obj.verification;
  if (v) {
    lines.push(`verification: ${v.verificationStatus || "unverified"}${v.sourceName ? ` (source: ${v.sourceName})` : ""}`);
    if (v.notes) lines.push(`notes: ${v.notes}`);
  }
  if (!lines.length) return "";
  return `<div class="cx-nerd-block">${lines.map(esc).join("<br>")}</div>`;
}
function collectedInHtml(list) {
  if (!list || !list.length) return "";
  const rows = list.map(c => `<div class="cx-row" style="cursor:default;">
      <div class="cx-row-body">
        <div class="cx-row-title">${esc(c.title)}</div>
        <div class="cx-row-sub">${esc([c.format, c.publicationDate].filter(Boolean).join(" · "))}</div>
      </div>
    </div>`).join("");
  return `<div class="sheet-section"><div class="sheet-label">COLLECTED IN</div><div class="cx-list">${rows}</div></div>`;
}

/* ============================= level renderers =============================
   Each returns { html, wire(container) } — wire() attaches click handlers with
   closures over the exact objects already fetched for this screen, so opening
   a level never needs to re-fetch or re-look-up-by-id. */

async function levelRoot() {
  const html = `
    <div class="cx-kicker">COMICS</div>
    <h2 class="cx-title">Explore the DC Universe</h2>
    <p class="cx-subtitle">Explore the DC Universe through characters, continuities, series and stories.</p>
    <div class="cx-entry-grid">
      <button class="cx-entry-btn" data-nav="characterList"><span class="cx-entry-btn-label">Characters</span><span class="cx-entry-btn-sub">Start with a hero</span></button>
      <button class="cx-entry-btn" data-nav="continuityList"><span class="cx-entry-btn-label">Continuities / Eras</span><span class="cx-entry-btn-sub">Start with an era</span></button>
      <button class="cx-entry-btn" data-nav="seriesList"><span class="cx-entry-btn-label">Series</span><span class="cx-entry-btn-sub">Browse series directly</span></button>
    </div>`;
  return {
    html,
    wire(container) {
      const labels = { characterList: "Characters", continuityList: "Continuities", seriesList: "Series" };
      container.querySelectorAll("[data-nav]").forEach(btn => {
        btn.addEventListener("click", () => pushLevel(btn.dataset.nav, labels[btn.dataset.nav], {}));
      });
    },
  };
}

async function levelCharacterList() {
  const chars = await data.getAllCharacters();
  chars.sort((a, b) => (a.displayName || a.name || "").localeCompare(b.displayName || b.name || ""));
  if (!chars.length) return { html: emptyHtml("No characters have been added to the Comics database yet.") };
  const rows = chars.map(c => {
    const label = esc(c.displayName || c.name || "Unnamed");
    const sub = (c.aliases && c.aliases.length) ? esc(c.aliases.slice(0, 2).join(" · ")) : "";
    return `<div class="cx-row" data-id="${esc(c.id)}"><div class="cx-row-body"><div class="cx-row-title">${label}</div>${sub ? `<div class="cx-row-sub">${sub}</div>` : ""}</div><div class="cx-row-chevron">›</div></div>`;
  }).join("");
  const html = `<div class="cx-kicker">CHARACTERS</div><h2 class="cx-title">Choose a character</h2><div class="cx-list">${rows}</div>`;
  return {
    html,
    wire(container) {
      container.querySelectorAll(".cx-row[data-id]").forEach(row => {
        row.addEventListener("click", () => {
          const c = chars.find(x => x.id === row.dataset.id);
          pushLevel("character", c.displayName || c.name, { character: c });
        });
      });
    },
  };
}

async function levelCharacter(params) {
  const c = params.character;
  const [continuities, series] = await Promise.all([
    Promise.all((c.continuityIds || []).map(id => cachedGet(COLLECTIONS.CONTINUITIES, id))),
    data.getSeriesForCharacter(c.id),
  ]);
  const contList = continuities.filter(Boolean);
  series.sort((a, b) => firstYearOf(a) - firstYearOf(b));

  let html = `<div class="cx-kicker">CHARACTER</div><h2 class="cx-title">${esc(c.displayName || c.name)}</h2>`;
  if (c.aliases && c.aliases.length) {
    html += `<div class="cx-tag-row">${c.aliases.slice(0, 6).map(a => `<span class="tag">${esc(a)}</span>`).join("")}</div>`;
  }
  if (!contList.length && !series.length) {
    html += emptyHtml(`No comics data yet for ${c.displayName || c.name}.`);
    return { html };
  }
  if (contList.length) {
    html += `<div class="sheet-section"><div class="sheet-label">CONTINUITIES</div><div class="cx-list">`;
    html += contList.map(ct => `<div class="cx-row" data-cont="${esc(ct.id)}"><div class="cx-row-body"><div class="cx-row-title">${esc(ct.name)}</div>${ct.shortName ? `<div class="cx-row-sub">${esc(ct.shortName)}</div>` : ""}</div><div class="cx-row-chevron">›</div></div>`).join("");
    html += `</div></div>`;
  }
  if (series.length) {
    html += `<div class="sheet-section"><div class="sheet-label">SERIES FEATURING ${esc((c.displayName || c.name || "").toUpperCase())}</div><div class="cx-list">`;
    html += series.map(s => `<div class="cx-row" data-series="${esc(s.id)}"><div class="cx-row-body"><div class="cx-row-title">${esc(s.title)}</div><div class="cx-row-sub">${esc(seriesDateRange(s))}</div></div><div class="cx-row-chevron">›</div></div>`).join("");
    html += `</div></div>`;
  }
  return {
    html,
    wire(container) {
      container.querySelectorAll("[data-cont]").forEach(row => {
        row.addEventListener("click", () => {
          const ct = contList.find(x => x.id === row.dataset.cont);
          pushLevel("continuity", ct.name, { continuity: ct, character: c });
        });
      });
      container.querySelectorAll("[data-series]").forEach(row => {
        row.addEventListener("click", () => {
          const s = series.find(x => x.id === row.dataset.series);
          pushLevel("series", s.title, { series: s });
        });
      });
    },
  };
}

async function levelContinuityList() {
  const conts = await data.getAllContinuities();
  conts.sort((a, b) => String(a.startDate || "").localeCompare(String(b.startDate || "")));
  if (!conts.length) return { html: emptyHtml("No continuities have been added yet.") };
  const rows = conts.map(ct => `<div class="cx-row" data-id="${esc(ct.id)}"><div class="cx-row-body"><div class="cx-row-title">${esc(ct.name)}</div><div class="cx-row-sub">${esc(contDateRange(ct))}</div></div><div class="cx-row-chevron">›</div></div>`).join("");
  const html = `<div class="cx-kicker">CONTINUITIES</div><h2 class="cx-title">Choose an era</h2><div class="cx-list">${rows}</div>`;
  return {
    html,
    wire(container) {
      container.querySelectorAll(".cx-row[data-id]").forEach(row => {
        row.addEventListener("click", () => {
          const ct = conts.find(x => x.id === row.dataset.id);
          pushLevel("continuity", ct.name, { continuity: ct });
        });
      });
    },
  };
}

async function levelContinuity(params) {
  const ct = params.continuity;
  let series;
  if (params.character) {
    const all = await data.getSeriesForCharacter(params.character.id);
    series = all.filter(s => Array.isArray(s.continuityIds) && s.continuityIds.includes(ct.id));
  } else {
    series = await data.getSeriesForContinuity(ct.id);
  }
  series.sort((a, b) => firstYearOf(a) - firstYearOf(b));

  let html = `<div class="cx-kicker">${params.character ? esc((params.character.displayName || params.character.name || "").toUpperCase()) + " · " : ""}CONTINUITY</div><h2 class="cx-title">${esc(ct.name)}</h2>`;
  const sub = contDateRange(ct);
  if (sub) html += `<div class="cx-subtitle">${esc(sub)}</div>`;
  if (ct.description) html += `<div class="sheet-section"><div class="sheet-body">${esc(ct.description)}</div></div>`;
  if (!series.length) {
    html += emptyHtml("No series recorded for this continuity yet.");
    return { html };
  }
  html += `<div class="sheet-section"><div class="sheet-label">SERIES</div><div class="cx-list">`;
  html += series.map(s => `<div class="cx-row" data-series="${esc(s.id)}"><div class="cx-row-body"><div class="cx-row-title">${esc(s.title)}</div><div class="cx-row-sub">${esc(seriesDateRange(s))}${s.issueCount ? ` · ${s.issueCount} issues` : ""}</div></div><div class="cx-row-chevron">›</div></div>`).join("");
  html += `</div></div>`;
  return {
    html,
    wire(container) {
      container.querySelectorAll("[data-series]").forEach(row => {
        row.addEventListener("click", () => {
          const s = series.find(x => x.id === row.dataset.series);
          pushLevel("series", s.title, { series: s });
        });
      });
    },
  };
}

async function levelSeriesList() {
  const all = await data.getAllSeries();
  all.sort((a, b) => firstYearOf(a) - firstYearOf(b));
  if (!all.length) return { html: emptyHtml("No series have been added yet.") };
  const rows = all.map(s => `<div class="cx-row" data-id="${esc(s.id)}"><div class="cx-row-body"><div class="cx-row-title">${esc(s.title)}</div><div class="cx-row-sub">${esc(seriesDateRange(s))}</div></div><div class="cx-row-chevron">›</div></div>`).join("");
  const html = `<div class="cx-kicker">SERIES</div><h2 class="cx-title">Browse series</h2><div class="cx-list">${rows}</div>`;
  return {
    html,
    wire(container) {
      container.querySelectorAll(".cx-row[data-id]").forEach(row => {
        row.addEventListener("click", () => {
          const s = all.find(x => x.id === row.dataset.id);
          pushLevel("series", s.title, { series: s });
        });
      });
    },
  };
}

async function levelSeries(params) {
  const s = params.series;
  const [runs, creators] = await Promise.all([
    data.getRunsForSeries(s.id),
    Promise.all((s.creatorIds || []).map(id => cachedGet(COLLECTIONS.CREATORS, id))),
  ]);
  const runLabels = await Promise.all(runs.map(r => runLabel(r)));

  let html = coverBlockHtml(s.coverImage, s.title);
  html += `<div class="cx-kicker">SERIES</div><h2 class="cx-title">${esc(s.title)}</h2>`;
  const sub = [seriesDateRange(s), s.issueCount ? `${s.issueCount} issues` : ""].filter(Boolean).join(" · ");
  if (sub) html += `<div class="cx-subtitle">${esc(sub)}</div>`;
  const credNames = creators.filter(Boolean).map(c => c.displayName || c.name);
  if (credNames.length) html += `<div class="cx-tag-row">${credNames.map(n => `<span class="tag">${esc(n)}</span>`).join("")}</div>`;
  if (s.description) html += `<div class="sheet-section"><div class="sheet-label">ABOUT</div><div class="sheet-body">${esc(s.description)}</div></div>`;
  if (!runs.length) {
    html += emptyHtml("No creative runs recorded yet for this series.");
  } else {
    html += `<div class="sheet-section"><div class="sheet-label">CREATIVE RUNS</div><div class="cx-list">`;
    html += runs.map((r, idx) => `<div class="cx-row" data-idx="${idx}"><div class="cx-row-body"><div class="cx-row-title">${esc(runLabels[idx])}</div>${runRangeText(r) ? `<div class="cx-row-sub">${esc(runRangeText(r))}</div>` : ""}</div><div class="cx-row-chevron">›</div></div>`).join("");
    html += `</div></div>`;
  }
  if (isNerd()) html += nerdBlock({ id: s.id, universeId: s.universeId, continuityIds: s.continuityIds, characterIds: s.characterIds, verification: s.sourceInfo });
  return {
    html,
    wire(container) {
      container.querySelectorAll(".cx-row[data-idx]").forEach(row => {
        row.addEventListener("click", () => {
          const idx = +row.dataset.idx;
          pushLevel("run", runLabels[idx], { run: runs[idx], series: s });
        });
      });
    },
  };
}

async function levelRun(params) {
  const r = params.run, s = params.series;
  const label = await runLabel(r);
  const stories = await data.getStoriesForRun(r.id);
  // NOTE: comicRuns/comicStories has no explicit "order within run" field in the
  // current Phase 1 schema, so this list is shown in the order Firestore returns
  // it (matching import/insertion order) rather than invented by re-sorting —
  // see the final report's "genuine limitations" section.

  let html = `<div class="cx-kicker">${esc(s.title)}</div><h2 class="cx-title">${esc(label)}</h2>`;
  if (runRangeText(r)) html += `<div class="cx-subtitle">${esc(runRangeText(r))}</div>`;
  if (r.description) html += `<div class="sheet-section"><div class="sheet-label">ABOUT</div><div class="sheet-body">${esc(r.description)}</div></div>`;
  if (!stories.length) {
    html += emptyHtml("No stories recorded yet for this run.");
  } else {
    html += `<div class="sheet-section"><div class="sheet-label">STORIES</div><div class="cx-list">`;
    html += stories.map((st, idx) => `<div class="cx-row" data-idx="${idx}"><div class="cx-row-body"><div class="cx-row-title">${esc(st.title)}</div>${st.issueIds && st.issueIds.length ? `<div class="cx-row-sub">${st.issueIds.length} issue${st.issueIds.length === 1 ? "" : "s"}</div>` : ""}</div><div class="cx-row-chevron">›</div></div>`).join("");
    html += `</div></div>`;
  }
  if (isNerd()) html += nerdBlock({ id: r.id, seriesId: r.seriesId, creatorIds: r.creatorIds, verification: r.sourceInfo });
  return {
    html,
    wire(container) {
      container.querySelectorAll(".cx-row[data-idx]").forEach(row => {
        row.addEventListener("click", () => {
          const st = stories[+row.dataset.idx];
          pushLevel("story", st.title, { story: st, series: s, run: r });
        });
      });
    },
  };
}

async function levelStory(params) {
  const st = params.story;
  const seriesIdsToResolve = (st.seriesIds && st.seriesIds.length) ? st.seriesIds : (params.series ? [params.series.id] : []);
  const [issues, collections, seriesEntities, continuityEnt, characters, creators] = await Promise.all([
    data.getIssuesForStory(st.id),
    data.getCollectionsContainingStory(st.id),
    Promise.all(seriesIdsToResolve.map(id => cachedGet(COLLECTIONS.SERIES, id))),
    st.continuityId ? cachedGet(COLLECTIONS.CONTINUITIES, st.continuityId) : null,
    Promise.all((st.characterIds || []).map(id => cachedGet(COLLECTIONS.CHARACTERS, id))),
    Promise.all((st.creatorIds || []).map(id => cachedGet(COLLECTIONS.CREATORS, id))),
  ]);
  sortIssuesInPlace(issues);

  const seriesTitles = seriesEntities.filter(Boolean).map(x => x.title);
  const runLabelText = params.run ? await runLabel(params.run) : "";
  let html = `<div class="cx-kicker">${[runLabelText, seriesTitles.join(", ")].filter(Boolean).map(esc).join(" · ")}</div><h2 class="cx-title">${esc(st.title)}</h2>`;
  if (continuityEnt) html += `<div class="cx-tag-row"><span class="tag">${esc(continuityEnt.name)}</span></div>`;
  if (st.description) html += `<div class="sheet-section"><div class="sheet-label">ABOUT</div><div class="sheet-body">${esc(st.description)}</div></div>`;
  const charNames = characters.filter(Boolean).map(c => c.displayName || c.name);
  if (charNames.length) html += `<div class="sheet-section"><div class="sheet-label">CHARACTERS</div><div class="cx-tag-row">${charNames.map(n => `<span class="tag">${esc(n)}</span>`).join("")}</div></div>`;
  const credNames = creators.filter(Boolean).map(c => c.displayName || c.name);
  if (credNames.length) html += `<div class="sheet-section"><div class="sheet-label">CREATORS</div><div class="cx-tag-row">${credNames.map(n => `<span class="tag">${esc(n)}</span>`).join("")}</div></div>`;
  if (!issues.length) {
    html += emptyHtml("No issues recorded for this story yet.");
  } else {
    html += `<div class="sheet-section"><div class="sheet-label">ISSUES</div><div class="cx-list">`;
    html += issues.map((iss, idx) => `<div class="cx-row" data-idx="${idx}"><div class="cx-row-body"><div class="cx-row-title">${esc(iss.issueLabel || iss.title || "Issue")}</div>${iss.title && iss.issueLabel ? `<div class="cx-row-sub">${esc(iss.title)}</div>` : ""}</div><div class="cx-row-chevron">›</div></div>`).join("");
    html += `</div></div>`;
  }
  html += collectedInHtml(collections);
  if (isNerd()) html += nerdBlock({ id: st.id, seriesIds: st.seriesIds, runId: st.runId, continuityId: st.continuityId, universeId: st.universeId, eventId: st.eventId, verification: st.sourceInfo });
  return {
    html,
    wire(container) {
      container.querySelectorAll(".cx-row[data-idx]").forEach(row => {
        row.addEventListener("click", () => {
          const iss = issues[+row.dataset.idx];
          pushLevel("issue", iss.issueLabel || iss.title || "Issue", { issue: iss, story: st });
        });
      });
    },
  };
}

async function levelIssue(params) {
  const iss = params.issue;
  const [series, stories, continuityEnt, characters, creators, collections, relationships] = await Promise.all([
    iss.seriesId ? cachedGet(COLLECTIONS.SERIES, iss.seriesId) : null,
    Promise.all((iss.storyIds || []).map(id => cachedGet(COLLECTIONS.STORIES, id))),
    iss.continuityId ? cachedGet(COLLECTIONS.CONTINUITIES, iss.continuityId) : null,
    Promise.all((iss.characterIds || []).map(id => cachedGet(COLLECTIONS.CHARACTERS, id))),
    Promise.all((iss.creatorIds || []).map(id => cachedGet(COLLECTIONS.CREATORS, id))),
    data.getCollectionsContainingIssue(iss.id),
    data.getRelationshipsForEntity(iss.id),
  ]);
  const storyList = stories.filter(Boolean);

  let html = coverBlockHtml(iss.coverImage, series ? series.title : iss.issueLabel);
  html += `<div class="cx-kicker">${series ? esc(series.title) : ""}</div><h2 class="cx-title">${esc(iss.issueLabel || (iss.issueNumber ? "#" + iss.issueNumber : "Issue"))}${iss.title ? ` — ${esc(iss.title)}` : ""}</h2>`;
  const dateStr = iss.publicationDate || iss.coverDate;
  if (dateStr) html += `<div class="cx-subtitle">${esc(dateStr)}</div>`;
  if (continuityEnt) html += `<div class="cx-tag-row"><span class="tag">${esc(continuityEnt.name)}</span></div>`;
  if (storyList.length) {
    html += `<div class="sheet-section"><div class="sheet-label">STORY</div><div class="cx-list">`;
    html += storyList.map((stt, idx) => `<div class="cx-row" data-story-idx="${idx}"><div class="cx-row-body"><div class="cx-row-title">${esc(stt.title)}</div></div><div class="cx-row-chevron">›</div></div>`).join("");
    html += `</div></div>`;
  }
  const charNames = characters.filter(Boolean).map(c => c.displayName || c.name);
  if (charNames.length) html += `<div class="sheet-section"><div class="sheet-label">CHARACTERS</div><div class="cx-tag-row">${charNames.map(n => `<span class="tag">${esc(n)}</span>`).join("")}</div></div>`;
  const credNames = creators.filter(Boolean).map(c => c.displayName || c.name);
  if (credNames.length) html += `<div class="sheet-section"><div class="sheet-label">CREATORS</div><div class="cx-tag-row">${credNames.map(n => `<span class="tag">${esc(n)}</span>`).join("")}</div></div>`;

  const relLines = (await Promise.all(relationships.slice(0, 8).map(async rel => {
    const otherId = rel.sourceId === iss.id ? rel.targetId : rel.sourceId;
    const otherType = rel.sourceId === iss.id ? rel.targetType : rel.sourceType;
    const label = await labelForEntity(otherType, otherId);
    if (!label) return null;
    return `${humanizeRel(rel.relationshipType)} ${label}`;
  }))).filter(Boolean);
  if (relLines.length) html += `<div class="sheet-section"><div class="sheet-label">RELATED</div><div class="sheet-body">${relLines.map(l => `<div>${esc(l)}</div>`).join("")}</div></div>`;

  html += collectedInHtml(collections);
  if (isNerd()) html += nerdBlock({ id: iss.id, seriesId: iss.seriesId, storyIds: iss.storyIds, continuityId: iss.continuityId, universeId: iss.universeId, eventIds: iss.eventIds, verification: iss.sourceInfo });
  return {
    html,
    wire(container) {
      container.querySelectorAll("[data-story-idx]").forEach(row => {
        row.addEventListener("click", () => {
          const stt = storyList[+row.dataset.storyIdx];
          pushLevel("story", stt.title, { story: stt });
        });
      });
    },
  };
}

const LEVELS = {
  root: levelRoot,
  characterList: levelCharacterList,
  character: levelCharacter,
  continuityList: levelContinuityList,
  continuity: levelContinuity,
  seriesList: levelSeriesList,
  series: levelSeries,
  run: levelRun,
  story: levelStory,
  issue: levelIssue,
};

/* ============================= shell (breadcrumb + back) ============================= */
let cxStack = [];
let cxLoadToken = 0;

function shellHtml(bodyHtml) {
  const crumbs = cxStack.map((item, idx) => {
    const isLast = idx === cxStack.length - 1;
    const sep = idx > 0 ? `<span class="cx-crumb-sep">/</span>` : "";
    return `${sep}<span class="cx-crumb" data-idx="${idx}" data-current="${isLast}">${esc(item.label || "")}</span>`;
  }).join("");
  const backLabel = cxStack.length > 1 ? "←" : "✕";
  return `<div class="cx-topbar"><button class="cx-back-btn" id="cxBackBtn" aria-label="Back">${backLabel}</button><div class="cx-breadcrumb" id="cxBreadcrumb">${crumbs}</div></div>${bodyHtml}`;
}
function wireShellHandlers(container) {
  const backBtn = container.querySelector("#cxBackBtn");
  if (backBtn) backBtn.addEventListener("click", goBack);
  container.querySelectorAll('.cx-crumb[data-current="false"]').forEach(el => {
    el.addEventListener("click", () => goToCrumb(+el.dataset.idx));
  });
}

async function renderCurrentLevel() {
  const myToken = ++cxLoadToken;
  const top = cxStack[cxStack.length - 1];
  const contentEl = document.getElementById("comicsExplorerContent");
  if (!contentEl) return;
  const setShell = (bodyHtml) => { contentEl.innerHTML = shellHtml(bodyHtml); wireShellHandlers(contentEl); };
  setShell(`<div class="cx-loading">Loading…</div>`);
  let result;
  try {
    result = await LEVELS[top.level](top.params || {});
  } catch (e) {
    if (myToken !== cxLoadToken) return;
    setShell(errorHtml(e));
    return;
  }
  if (myToken !== cxLoadToken) return;
  setShell(result.html);
  wireCovers(contentEl);
  if (result.wire) result.wire(contentEl);
}

function pushLevel(level, label, levelParams) {
  cxStack.push({ level, label, params: levelParams || {} });
  renderCurrentLevel();
}
function goToCrumb(idx) {
  cxStack = cxStack.slice(0, idx + 1);
  renderCurrentLevel();
}
function goBack() {
  if (cxStack.length <= 1) { closeCxSheet(); return; }
  cxStack.pop();
  renderCurrentLevel();
}

/* ============================= open / close (reuses the site's existing
   bottom-sheet visual pattern on its own new #comicsExplorerSheet element) ============================= */
function openCxSheet() {
  const bd = document.getElementById("comicsExplorerBackdrop"), sh = document.getElementById("comicsExplorerSheet");
  if (!bd || !sh) return;
  bd.dataset.open = "true";
  sh.dataset.open = "true";
  if (!(history.state && history.state.cxSheet)) {
    try { history.pushState({ cxSheet: true }, "", location.href); } catch (e) { /* ignore */ }
  }
}
function closeCxSheet() {
  const bd = document.getElementById("comicsExplorerBackdrop"), sh = document.getElementById("comicsExplorerSheet");
  if (bd) bd.dataset.open = "false";
  if (sh) sh.dataset.open = "false";
}
export function openComicsExplorer() {
  cxStack = [{ level: "root", label: "Comics", params: {} }];
  openCxSheet();
  renderCurrentLevel();
}

/* ============================= wiring (minimal, additive) =============================
   Entry point button lives inside the existing Comics tab's card grid (app.js
   renders it, id="comicsExplorerEntryBtn") — that grid's innerHTML is replaced
   on every tab switch/filter change, so this listens on document via
   delegation instead of binding to the button directly. */
document.addEventListener("click", (e) => {
  if (e.target.closest("#comicsExplorerEntryBtn")) openComicsExplorer();
});

const _cxBackdrop = document.getElementById("comicsExplorerBackdrop");
const _cxSheetEl = document.getElementById("comicsExplorerSheet");
const _cxCloseBtn = document.getElementById("comicsExplorerClose");
if (_cxBackdrop) _cxBackdrop.addEventListener("click", closeCxSheet);
if (_cxCloseBtn) _cxCloseBtn.addEventListener("click", closeCxSheet);

// Respect the site's existing Nerd Mode toggle live, without redesigning it:
// if the explorer is open when it's flipped, just re-render the current level.
const _nerdToggleEl = document.getElementById("nerdToggle");
if (_nerdToggleEl) {
  _nerdToggleEl.addEventListener("click", () => {
    if (_cxSheetEl && _cxSheetEl.dataset.open === "true") setTimeout(renderCurrentLevel, 0);
  });
}

window.__comicsExplorer = { open: openComicsExplorer };
