/*
 * ALLABOUTDC — New 52 Map Dataset (research-first)
 *
 * Scope:
 * - 93 New 52 ongoing series listed in DC's New 52 publication record.
 * - New 52 limited/maxi/mini-series and one-shots that belong to the publishing line.
 * - Major crossover spine and transition points.
 * - Issue coverage is represented as explicit issue labels/ranges so the UI can
 *   expose every numbered issue without inventing chronology.
 *
 * Research anchors:
 * - Wikipedia, List of The New 52 imprint publications (publication ranges,
 *   waves, one-shots, miniseries, maxiseries, collected-edition index).
 * - ComicBookReadingOrders, New 52 Parts 1–3 (issue-level chronology and
 *   crossover boundaries).
 * - ComicBookTreasury, DC New 52 Reading Order (complete-era cross-check).
 * - Comic Book Herald, New 52 reading order (independent cross-check).
 *
 * This file intentionally distinguishes:
 *   series -> run -> story -> issue -> collection edition.
 * A TPB/HC/Omnibus is never treated as a continuity node.
 */

const R = (from, to, extras = []) => ({ from, to, extras });
const issueLabels = spec => {
  const out = [];
  if (spec.zero) out.push('0');
  if (spec.from != null && spec.to != null) for (let n = spec.from; n <= spec.to; n++) out.push(String(n));
  if (spec.decimals) out.push(...spec.decimals.map(String));
  if (spec.extras) out.push(...spec.extras);
  return out;
};
const S = (id, title, lane, spec, notes = '', alt = false) => ({
  id, title, lane, alt,
  issueSpec: spec,
  issues: issueLabels(spec),
  issueCount: issueLabels(spec).length,
  notes,
  runs: [],
  collections: [],
});
const run = (title, from, to, notes = '') => ({ title, from, to, notes });
const coll = (title, format, coverage, notes = '', status = 'researched') => ({ title, format, coverage, notes, status });

export const transitionEvents = [
  {id:'transition-absolute',from:'dawn',to:'absolute',title:'Absolute Power',kicker:'Transition · Dawn of DC → Absolute Era',summary:'Major DC event used as the publishing/continuity junction into the Absolute era.',issues:['Absolute Power #1–4','Absolute Power: Ground Zero #1'],editions:[]},
  {id:'transition-dawn',from:'infinite-frontier',to:'dawn',title:'Dark Crisis on Infinite Earths',kicker:'Transition · Infinite Frontier → Dawn of DC',summary:'Major 2022 event preceding the Dawn of DC publishing initiative.',issues:['Dark Crisis on Infinite Earths #1–7'],editions:[]},
  {id:'transition-infinite',from:'rebirth',to:'infinite-frontier',title:'Dark Nights: Death Metal',kicker:'Transition · Rebirth → Infinite Frontier',summary:'The concluding Metal-era event that leads into the Infinite Frontier status quo.',issues:['Dark Nights: Death Metal #1–7'],editions:[]},
  {
    id: 'transition-rebirth',
    from: 'new52', to: 'rebirth',
    title: 'Convergence → DC Universe: Rebirth',
    kicker: 'Transition · New 52 → Rebirth',
    summary: 'Convergence is the publishing-line junction immediately before Rebirth. DC then launched the Rebirth initiative with DC Universe: Rebirth Special #1 in May 2016. Keep both visible so readers can see the actual bridge rather than a mysterious gap between eras.',
    issues: ['Convergence #0–8', 'Convergence tie-ins (40 two-part miniseries)', 'DC Universe: Rebirth Special #1'],
    editions: [
      coll('Convergence', 'Single Issues', 'Convergence #0–8', 'Core weekly event spine.'),
      coll('Convergence', 'Graphic Novel', 'Convergence #0–8', 'DC collected edition of the core event.'),
      coll('DC Universe: Rebirth', 'Single Issue', 'DC Universe: Rebirth Special #1', 'The launch special for the Rebirth initiative.'),
      coll('DC Universe: Rebirth', 'Hardcover', 'DC Universe: Rebirth Special #1', 'Collected in Rebirth-era hardcover programs.'),
      coll('DC Universe: Rebirth', 'Trade Paperback', 'DC Universe: Rebirth Special #1', 'Collected in Rebirth-era trade/reference editions.'),
    ],
  },
  {
    id: 'transition-new52',
    from: 'preflashpoint', to: 'new52',
    title: 'Flashpoint',
    kicker: 'Transition · Pre-Flashpoint → New 52',
    summary: 'Barry Allen’s Flashpoint story is the publishing and in-universe junction into the New 52. The five-issue main series is the core transition text.',
    issues: ['Flashpoint #1', 'Flashpoint #2', 'Flashpoint #3', 'Flashpoint #4', 'Flashpoint #5'],
    editions: [
      coll('Flashpoint', 'Single Issues', 'Flashpoint #1–5'),
      coll('Flashpoint', 'Hardcover', 'Flashpoint #1–5', 'Collected edition of the main Flashpoint series.'),
      coll('Flashpoint', 'Trade Paperback', 'Flashpoint #1–5', 'Collected edition of the main Flashpoint series.'),
      coll('Flashpoint', 'Omnibus / Complete Event', 'Flashpoint #1–5 + tie-ins', 'Event-wide collections include the tie-in material; exact contents vary by edition.'),
    ],
  },
  {id:'transition-crisis',from:'bronze',to:'preflashpoint',title:'Crisis on Infinite Earths',kicker:'Transition · Bronze Age → Post-Crisis / Pre-Flashpoint',summary:'The 1985–86 Crisis is the major continuity-reset event that establishes the post-Crisis DC Universe.',issues:['Crisis on Infinite Earths #1–12'],editions:[]},
];

export const crossoverSpine = [
  { id:'court-owls', title:'Court of Owls / Night of the Owls', issues:'Batman #1–12; Batman-family Night of the Owls tie-ins', lanes:['batman'], type:'crossover' },
  { id:'death-family', title:'Death of the Family', issues:'Batman #13–17 + Bat-family tie-ins', lanes:['batman'], type:'crossover' },
  { id:'throne-atlantis', title:'Throne of Atlantis', issues:'Justice League #13–17 + Aquaman #15–16', lanes:['justice'], type:'crossover' },
  { id:'rotworld', title:'Rotworld', issues:'Animal Man #12–17; Swamp Thing #12–18', lanes:['dark'], type:'crossover' },
  { id:'hel-earth', title:"H’El on Earth", issues:'Superman / Superboy / Supergirl + crossover chapters', lanes:['superman'], type:'crossover' },
  { id:'rise-third-army', title:'Rise of the Third Army', issues:'Green Lantern family crossover', lanes:['lantern'], type:'crossover' },
  { id:'wrath-first-lantern', title:'Wrath of the First Lantern', issues:'Green Lantern family crossover', lanes:['lantern'], type:'crossover' },
  { id:'lights-out', title:'Lights Out', issues:'Green Lantern #24–29 + Corps/New Guardians/Red Lanterns tie-ins', lanes:['lantern'], type:'crossover' },
  { id:'trinity-war', title:'Trinity War', issues:'Justice League #22–23; Justice League of America #6–7; Justice League Dark #22–23; Pandora #1–3; Phantom Stranger #11; Constantine #5', lanes:['justice','dark'], type:'crossover' },
  { id:'forever-evil', title:'Forever Evil', issues:'Forever Evil #1–7 + major tie-ins', lanes:['justice','batman','edge'], type:'crossover' },
  { id:'blight', title:'Forever Evil: Blight', issues:'Justice League Dark / Constantine / Pandora / Phantom Stranger / others', lanes:['dark'], type:'crossover' },
  { id:'krypton-returns', title:'Krypton Returns', issues:'Superman-family crossover', lanes:['superman'], type:'crossover' },
  { id:'doomed', title:'Superman: Doomed', issues:'Action Comics / Superman / Superman: Doomed + tie-ins', lanes:['superman'], type:'crossover' },
  { id:'red-daughter', title:'Red Daughter of Krypton', issues:'Supergirl / Red Lanterns / Green Lantern family', lanes:['superman','lantern'], type:'crossover' },
  { id:'uprising', title:'Green Lantern: Uprising', issues:'Green Lantern Corps / Green Lantern / New Guardians / Red Lanterns', lanes:['lantern'], type:'crossover' },
  { id:'futures-end', title:'The New 52: Futures End', issues:'Futures End #0–48 + September 2014 Futures End specials', lanes:['justice','batman','superman','lantern','edge'], type:'event' },
  { id:'godhead', title:'Godhead', issues:'Green Lantern family + New Gods: Godhead #1', lanes:['lantern'], type:'crossover' },
  { id:'robin-rises', title:'Robin Rises', issues:'Batman and Robin #29–40 + Robin Rises: Alpha/Omega', lanes:['batman'], type:'crossover' },
  { id:'endgame', title:'Batman: Endgame', issues:'Batman #35–40 + Batman-family tie-ins', lanes:['batman'], type:'crossover' },
  { id:'darkseid-war', title:'Darkseid War', issues:'Justice League #40–50 + special material', lanes:['justice'], type:'event' },
  { id:'multiversity', title:'The Multiversity', issues:'Multiversity #1–2 + seven one-shots + guidebook', lanes:['alternate'], type:'multiverse' },
  { id:'convergence', title:'Convergence', issues:'Convergence #0–8 + 40 two-part tie-ins', lanes:['alternate','dc-you'], type:'transition' },
];

const series = [
  // Justice League / central DC
  S('justice-league','Justice League','justice',R(0,50,['Annual #1','Annual #2','Annual #3']), 'Central New 52 team book; major universe spine.'),
  S('justice-league-of-america','Justice League of America','justice',R(0,14), 'Launched around Trinity War; JLA #6–7 participate in Trinity War.'),
  S('justice-league-dark','Justice League Dark','dark',R(0,40,['Annual #1','Annual #2']), 'Major supernatural team book; Trinity War and Blight.'),
  S('justice-league-international','Justice League International','justice',R(0,12,['Annual #1']), 'Early New 52 team title.'),
  S('justice-league-united','Justice League United','justice',R(0,10,['Annual #1']), 'Later cosmic/Legion-connected team book.'),
  S('justice-league-of-americas-vibe',"Justice League of America’s Vibe",'justice',R(1,10), 'Vibe spin-off from the JLA period.'),
  S('aquaman','Aquaman','justice',R(0,40,['Annual #1','Annual #2']), 'Arthur Curry solo series; Throne of Atlantis is shared with Justice League.'),
  S('aquaman-and-the-others','Aquaman and the Others','justice',R(1,11), 'Aquaman-family spin-off.'),
  S('the-flash','The Flash','justice',R(0,40,['Annual #1','Annual #2','Annual #3'],), 'Barry Allen solo series.'),
  S('green-arrow','Green Arrow','justice',R(0,40), 'Oliver Queen solo series.'),
  S('wonder-woman','Wonder Woman','justice',R(0,40,['Annual #1']), 'Wonder Woman solo series.'),
  S('captain-atom','Captain Atom','justice',R(1,12), 'Short-lived first-wave series.'),
  S('mister-terrific','Mister Terrific','justice',R(1,8), 'Short-lived first-wave series.'),
  S('savage-hawkman','The Savage Hawkman','justice',R(0,21), 'Hawkman first-wave series.'),
  S('dc-universe-presents','DC Universe Presents','justice',R(0,19), 'Anthology series; each arc focuses on different DC characters.'),
  S('earth-2','Earth 2','alternate',R(0,32,['Annual #1','Annual #2']), 'Separate New 52 Earth; the foundation of the Earth-2 branch.',true),
  S('worlds-finest','Worlds’ Finest','alternate',R(0,32,['Annual #1']), 'Begins with Power Girl and Huntress stranded on Prime Earth after leaving Earth-2; later connects strongly to Earth-2.',true),
  S('secret-origins','Secret Origins','justice',R(1,11), 'Anthology/origin series; issue numbering has gaps in the chronological guide.'),
  S('justice-league-3000','Justice League 3000','future',R(1,15,['Justice League 3001 #1–12']), 'Far-future New 52/continuity branch; the title continues as Justice League 3001 after #15.'),

  // Batman / Gotham
  S('batman','Batman','batman',R(0,52,['Annual #1','Annual #2','Annual #3']), 'Core Batman title. Snyder/Capullo run is the flagship New 52 Batman spine.'),
  S('detective-comics','Detective Comics','batman',R(0,40,['Annual #1','Annual #2','Annual #3']), 'Parallel Batman title; never merged into the Batman run.'),
  S('batman-and-robin','Batman and Robin','batman',R(0,40,['Annual #1','Annual #2','Annual #3']), 'Bruce/Damian core; later Robin Rises.'),
  S('batman-dark-knight','Batman: The Dark Knight','batman',R(0,29,['Annual #1']), 'Standalone Batman-family title.'),
  S('batman-incorporated','Batman Incorporated','batman',R(0,13,['Special #1']), 'Leviathan-era Batman Incorporated continuation.'),
  S('batman-eternal','Batman Eternal','batman',R(1,52), 'Weekly 52-issue maxiseries; MAIN New 52 continuity, not an alternate universe.'),
  S('nightwing','Nightwing','batman',R(0,30,['Annual #1']), 'Dick Grayson solo title; later transitions into Grayson.'),
  S('grayson','Grayson','batman',R(1,20,['Annual #1']), 'Post-Nightwing spy-era Dick Grayson title.'),
  S('batgirl','Batgirl','batman',R(0,40,['Annual #1','Annual #2']), 'Barbara Gordon solo title.'),
  S('batwoman','Batwoman','batman',R(0,40,['Annual #1','Annual #2']), 'Kate Kane solo title.'),
  S('catwoman','Catwoman','batman',R(0,40,['Annual #1','Annual #2']), 'Selina Kyle solo title.'),
  S('red-hood-outlaws','Red Hood and the Outlaws','batman',R(0,40,['Annual #1','Annual #2']), 'Jason Todd-led Batman-family title.'),
  S('birds-of-prey','Birds of Prey','batman',R(0,34), 'Bat-family/hero team title.'),
  S('batwing','Batwing','batman',R(0,34), 'Bat-family/International Batman Incorporated-adjacent title.'),
  S('talon','Talon','batman',R(0,17), 'Court of Owls spin-off focused on Calvin Rose.'),
  S('gotham-academy','Gotham Academy','batman',R(1,18), 'Gotham youth/academy title.'),
  S('arkham-manor','Arkham Manor','batman',R(1,6), 'Six-issue Gotham/Arkham miniseries.'),
  S('gotham-by-midnight','Gotham by Midnight','dark',R(1,12), 'Gotham supernatural police series.'),
  S('harley-quinn','Harley Quinn','batman',R(0,16,['Annual #1','Holiday Special #1','Valentine’s Day Special #1']), 'Harley title; later becomes a major standalone branch.'),

  // Superman family
  S('action-comics','Action Comics','superman',R(0,40,['Annual #1']), 'Superman flagship/action-history lane.'),
  S('superman','Superman','superman',R(0,40,['Annual #1','Annual #2']), 'Core Superman title.'),
  S('supergirl','Supergirl','superman',R(0,40), 'Kara Zor-El solo title.'),
  S('superboy','Superboy','superman',R(0,34), 'Kon-El / Superboy title.'),
  S('batman-superman','Batman/Superman','superman',R(1,32,['Annual #1','Annual #2']), 'Cross-family title connecting Batman and Superman.'),
  S('superman-wonder-woman','Superman/Wonder Woman','superman',R(1,17,['Annual #1']), 'Relationship/duo title.'),
  S('superman-unchained','Superman Unchained','superman',R(1,9), 'Scott Snyder/Jim Lee prestige miniseries.'),

  // Green Lantern
  S('green-lantern','Green Lantern','lantern',R(0,40,['Annual #1','Annual #2','Annual #3']), 'Hal Jordan / Sinestro / Simon Baz core.'),
  S('green-lantern-corps','Green Lantern Corps','lantern',R(0,40,['Annual #1','Annual #2']), 'Guy Gardner/John Stewart and Corps.'),
  S('green-lantern-new-guardians','Green Lantern: New Guardians','lantern',R(0,40,['Annual #1','Annual #2']), 'Kyle Rayner and emotional-spectrum team.'),
  S('red-lanterns','Red Lanterns','lantern',R(0,40,['Annual #1']), 'Atrocitus/Guy Gardner Red Lantern title.'),
  S('larfleeze','Larfleeze','lantern',R(1,12), 'Orange Lantern spin-off.'),
  S('sinestro','Sinestro','lantern',R(1,12,['Annual #1']), 'Sinestro solo title following Forever Evil/Villains Month.'),

  // Young / teen
  S('blue-beetle','Blue Beetle','young',R(0,16), 'Jaime Reyes title.'),
  S('hawk-dove','Hawk & Dove','young',R(1,8), 'Short first-wave series.'),
  S('legion-lost','Legion Lost','young',R(0,16), 'Legion time-lost team.'),
  S('legion-of-super-heroes','Legion of Super-Heroes','young',R(0,23), 'New 52-era Legion line.'),
  S('static-shock','Static Shock','young',R(1,8), 'First-wave series.'),
  S('teen-titans-v4','Teen Titans (vol. 4)','young',R(0,30,['Annual #1','Annual #2','Annual #3']), 'Original New 52 Teen Titans run.'),
  S('teen-titans-v5','Teen Titans (vol. 5)','young',R(1,8,['Annual #1']), 'Relaunch that continues the vol. 4 continuity.'),
  S('ravagers','The Ravagers','young',R(0,12), 'Spins out of The Culling.'),

  // Edge / science-fiction / government
  S('all-star-western','All-Star Western','edge',R(0,34), 'Jonah Hex / Gotham western-historical lane.'),
  S('blackhawks','Blackhawks','edge',R(1,8), 'War/aviation title.'),
  S('deathstroke-v2','Deathstroke (vol. 2)','edge',R(0,20), 'First New 52 Deathstroke volume.'),
  S('deathstroke-v3','Deathstroke (vol. 3)','edge',R(1,6), 'Late New 52 relaunch.'),
  S('gi-combat','G.I. Combat','edge',R(0,7), 'War anthology.'),
  S('grifter','Grifter','edge',R(0,16), 'WildStorm character integrated into New 52.'),
  S('infinity-man-forever-people','Infinity Man and the Forever People','edge',R(1,9), 'Fourth World / Kirby-inspired New 52 series.'),
  S('lobo','Lobo','edge',R(1,6), 'Late New 52 Lobo series.'),
  S('men-of-war','Men of War','edge',R(1,8), 'Short first-wave war title.'),
  S('new-suicide-squad','New Suicide Squad','edge',R(1,8), 'Second Suicide Squad series in the New 52 period.'),
  S('omac','O.M.A.C.','edge',R(1,8), 'Kevin Kho O.M.A.C. series.'),
  S('secret-six','Secret Six','edge',R(1,2), 'Late New 52 launch; only two issues under the New 52 imprint before DC You transition.'),
  S('star-spangled-war-stories','Star-Spangled War Stories Featuring G.I. Zombie','edge',R(1,8), 'War/zombie title.'),
  S('stormwatch','Stormwatch','edge',R(0,30), 'WildStorm integration / global-threat team.'),
  S('suicide-squad','Suicide Squad','edge',R(0,30), 'First New 52 Suicide Squad series.'),
  S('team-7','Team 7','edge',R(0,8), 'WildStorm/black-ops team title.'),
  S('green-team','The Green Team: Teen Trillionaires','edge',R(1,8), 'Late-wave short series.'),
  S('the-movement','The Movement','edge',R(1,12), 'Gail Simone series.'),
  S('threshold','Threshold','edge',R(1,8), 'Cosmic title spun from Green Lantern: New Guardians / Larfleeze material.'),
  S('voodoo','Voodoo','edge',R(0,12), 'WildStorm-integrated character title.'),

  // Dark / supernatural
  S('animal-man','Animal Man','dark',R(0,29,['Annual #1','Annual #2']), 'Jeff Lemire run; Rotworld crossover with Swamp Thing.'),
  S('demon-knights','Demon Knights','dark',R(0,23), 'Historical/fantasy team title.'),
  S('dial-h','Dial H','dark',R(0,15), 'China Miéville series; Villains Month epilogue in Justice League #23.3.'),
  S('constantine','Constantine','dark',R(1,23), 'New 52 John Constantine series after Vertigo Hellblazer.'),
  S('frankenstein-agent-shade','Frankenstein, Agent of S.H.A.D.E.','dark',R(0,16), 'Jeff Lemire first-wave series.'),
  S('i-vampire','I, Vampire','dark',R(0,19), 'Vampire/horror title.'),
  S('klarion','Klarion','dark',R(1,6), 'Late New 52 supernatural title.'),
  S('resurrection-man','Resurrection Man','dark',R(0,12), 'First-wave supernatural series.'),
  S('swamp-thing','Swamp Thing','dark',R(0,40,['Annual #1','Annual #2','Annual #3']), 'Alec Holland; major Rotworld line.'),
  S('sword-of-sorcery','Sword of Sorcery','dark',R(0,8), 'Amethyst/Beowulf/Stalker features.'),
  S('trinity-of-sin','Trinity of Sin','dark',R(1,6), 'Late New 52 trio title.'),
  S('trinity-of-sin-pandora','Trinity of Sin: Pandora','dark',R(1,14), 'Pandora solo title; Trinity War.'),
  S('trinity-of-sin-phantom-stranger','Trinity of Sin: The Phantom Stranger','dark',R(0,22), 'Originally Phantom Stranger; retitled from #9.'),
];

// Remove the display-only combined future helper from counts; it is not a publication.
export const new52Series = series;

// Miniseries / maxiseries / specials that materially belong on the New 52 map.
export const new52Limited = [
  {id:'damian-son-of-batman',title:'Damian: Son of Batman',lane:'batman',issues:['1','2','3','4'],kind:'miniseries'},
  {id:'huntress',title:'Huntress',lane:'alternate',issues:['1','2','3','4','5','6'],kind:'miniseries',notes:'Earth-2 refugee on Prime Earth; feeds into Worlds’ Finest.'},
  {id:'human-bomb',title:'Human Bomb',lane:'edge',issues:['1','2','3','4'],kind:'miniseries'},
  {id:'legion-secret-origin',title:'Legion: Secret Origin',lane:'young',issues:['1','2','3','4','5','6'],kind:'miniseries'},
  {id:'my-greatest-adventure',title:'My Greatest Adventure',lane:'dark',issues:['1','2','3','4','5','6'],kind:'miniseries'},
  {id:'night-force',title:'Night Force',lane:'dark',issues:['1','2','3','4','5','6','7'],kind:'miniseries'},
  {id:'penguin-pain-prejudice',title:'Penguin: Pain and Prejudice',lane:'batman',issues:['1','2','3','4','5'],kind:'miniseries'},
  {id:'phantom-lady-doll-man',title:'Phantom Lady and Doll Man',lane:'edge',issues:['1','2','3','4'],kind:'miniseries'},
  {id:'the-ray',title:'The Ray',lane:'edge',issues:['1','2','3','4'],kind:'miniseries'},
  {id:'the-shade',title:'The Shade',lane:'dark',issues:['1','2','3','4','5','6','7','8','9','10','11','12'],kind:'miniseries'},
  {id:'the-multiversity',title:'The Multiversity',lane:'alternate',issues:['#1','#2','Pax Americana','Thunderworld','The Just','Pax Americana','Guidebook','Mastermen','Ultra Comics','Multiversity #2'],kind:'multiverse',notes:'Seven complete adventures plus framing material and a guidebook across parallel Earths.'},
  {id:'forever-evil',title:'Forever Evil',lane:'justice',issues:['1','2','3','4','5','6','7'],kind:'event'},
  {id:'forever-evil-argus',title:'Forever Evil: A.R.G.U.S.',lane:'edge',issues:['1','2','3','4','5','6'],kind:'tie-in'},
  {id:'arkham-war',title:'Forever Evil: Arkham War',lane:'batman',issues:['1','2','3','4','5','6'],kind:'tie-in'},
  {id:'rogues-rebellion',title:'Forever Evil: Rogues Rebellion',lane:'justice',issues:['1','2','3','4','5','6'],kind:'tie-in'},
  {id:'futures-end',title:'The New 52: Futures End',lane:'future',issues:['0',...Array.from({length:48},(_,i)=>String(i+1))],kind:'maxiseries'},
  {id:'earth2-worlds-end',title:"Earth 2: World's End",lane:'alternate',issues:Array.from({length:26},(_,i)=>String(i+1)),kind:'maxiseries'},
  {id:'convergence',title:'Convergence',lane:'alternate',issues:['0','1','2','3','4','5','6','7','8'],kind:'transition',notes:'Nine-issue main event with 40 two-part tie-ins; the tie-ins are separate alternate-world stories.'},
  {id:'batman-robin-eternal',title:'Batman and Robin Eternal',lane:'future',issues:Array.from({length:26},(_,i)=>String(i+1)),kind:'dc-you-continuation',notes:'Post-Convergence weekly continuation that sits in the New 52-to-Rebirth transition period rather than the New 52 branded line.'},
  {id:'batman-beyond-v5',title:'Batman Beyond (vol. 5)',lane:'future',issues:Array.from({length:16},(_,i)=>String(i+1)),kind:'dc-you-continuation',notes:'Future title placed in the continuity bridge toward Rebirth.'},
  {id:'prez-v2',title:'Prez (vol. 2)',lane:'future',issues:Array.from({length:6},(_,i)=>String(i+1)),kind:'dc-you-continuation',notes:'Near-future political satire title in the post-Convergence DC You period.'},
  {id:'justice-league-3001',title:'Justice League 3001',lane:'future',issues:Array.from({length:12},(_,i)=>String(i+1)),kind:'dc-you-continuation',notes:'Continuation of Justice League 3000 after the title change.'},
];

export const new52OneShots = [
  'Batman, Incorporated Special #1','Batman: Joker’s Daughter #1','Batman Zero Year: Director’s Cut #1','Forever Evil Aftermath: Batman vs. Bane #1','Forever Evil Director’s Cut #1','Harley Quinn Director’s Cut #0','Harley Quinn Holiday Special #1','Harley Quinn Invades Comic-Con International: San Diego #1','Harley Quinn Valentine’s Day Special #1','Justice League: Trinity War – Director’s Cut #1','New Gods: Godhead #1','Robin Rises: Omega #1','Robin Rises: Alpha #1','Superman by Geoff Johns and John Romita, Jr.: Director’s Cut #1','Superman: Doomed #1','Superman: Doomed #2','Superman: Lois Lane #1','Superman Unchained: Director’s Cut #1','Suicide Squad: Amanda Waller #1','The Multiversity: Pax Americana: Director’s Cut #1','The New 52! Free Comic Book Day Special Edition #1','Young Romance: A New 52 Valentine’s Day Special #1'
].map((title,i)=>({id:`oneshot-${i+1}`,title,lane:'special',issues:['1'],kind:'one-shot'}));

// High-confidence collected editions for the major flagship books. These are
// displayed separately from issue lists so the UI can grow edition-by-edition.
// Status is explicit: the research pass never silently invents ISBNs or variant
// printings. Additional collected editions can be appended without changing the map.
const collectionIndex = {
  'batman': [
    coll('Batman Vol. 1: Court of Owls','Hardcover','Batman #1–7'),
    coll('Batman Vol. 1: Court of Owls','Trade Paperback','Batman #1–7'),
    coll('Batman Vol. 2: City of Owls','Hardcover','Batman #8–12 + Annual #1'),
    coll('Batman Vol. 2: City of Owls','Trade Paperback','Batman #8–12 + Annual #1'),
    coll('Batman Vol. 3: Death of the Family','Hardcover','Batman #13–17'),
    coll('Batman Vol. 3: Death of the Family','Trade Paperback','Batman #13–17'),
    coll('Batman Vol. 4: Zero Year – Secret City','Hardcover','Batman #21–24, #29–33'),
    coll('Batman Vol. 4: Zero Year – Secret City','Trade Paperback','Batman #21–24, #29–33'),
    coll('Batman Vol. 5: Zero Year – Dark City','Hardcover','Batman #25–27, #29–33'),
    coll('Batman Vol. 5: Zero Year – Dark City','Trade Paperback','Batman #25–27, #29–33'),
    coll('Batman Vol. 6: Graveyard Shift','Trade Paperback','Batman #0, #18–20, #28, #34 + Annual #2 + stories from Batman: The Dark Knight'),
    coll('Batman Vol. 7: Endgame','Hardcover','Batman #35–40'),
    coll('Batman Vol. 7: Endgame','Trade Paperback','Batman #35–40'),
    coll('Batman Vol. 8: Superheavy','Hardcover','Batman #41–45'),
    coll('Batman Vol. 8: Superheavy','Trade Paperback','Batman #41–45'),
    coll('Batman Vol. 9: Bloom','Hardcover','Batman #46–50'),
    coll('Batman Vol. 9: Bloom','Trade Paperback','Batman #46–50'),
    coll('Batman Vol. 10: Epilogue','Trade Paperback','Batman #51–52'),
    coll('Batman: Zero Year','Omnibus','Batman #0, #21–27, #29–33','Complete Zero Year story in omnibus form.'),
    coll('Batman by Scott Snyder & Greg Capullo','Omnibus','Batman #1–52 + relevant annual/special material','Run-level omnibus editions; exact contents vary by volume/printing.')
  ],
  'justice-league': [
    coll('Justice League Vol. 1: Origin','Hardcover','Justice League #1–6'),
    coll('Justice League Vol. 1: Origin','Trade Paperback','Justice League #1–6'),
    coll("Justice League Vol. 2: The Villain's Journey",'Hardcover','Justice League #7–12'),
    coll("Justice League Vol. 2: The Villain's Journey",'Trade Paperback','Justice League #7–12'),
    coll('Justice League Vol. 3: Throne of Atlantis','Hardcover','Justice League #13–17 + Aquaman #15–16'),
    coll('Justice League Vol. 3: Throne of Atlantis','Trade Paperback','Justice League #13–17 + Aquaman #15–16'),
    coll('Justice League Vol. 4: The Grid','Trade Paperback','Justice League #18–20, #22–23'),
    coll('Justice League Vol. 5: Forever Heroes','Trade Paperback','Justice League #24–29'),
    coll('Justice League Vol. 6: Injustice League','Trade Paperback','Justice League #30–39'),
    coll('Justice League Vol. 7: Darkseid War Part 1','Trade Paperback','Justice League #40–44 + DC Sneak Peek: Justice League'),
    coll('Justice League Vol. 8: Darkseid War Part 2','Trade Paperback','Justice League #46–50 + Justice League: Darkseid War Special'),
    coll('Justice League: Trinity War','Hardcover','Justice League #22–23; JLA #6–7; JLD #22–23; Constantine #5; Pandora #1–3; Phantom Stranger #11'),
  ],
  'all-star-western': [
    coll('All-Star Western Vol. 1: Guns and Gotham','Trade Paperback','All-Star Western #1–6'),
    coll('All-Star Western Vol. 2: The War of Lords and Owls','Trade Paperback','All-Star Western #7–12'),
    coll('All-Star Western Vol. 3: The Black Diamond Probability','Trade Paperback','All-Star Western #0, #13–16'),
    coll('All-Star Western Vol. 4: Gold Standard','Trade Paperback','All-Star Western #17–21'),
    coll('All-Star Western Vol. 5: Man Out of Time','Trade Paperback','All-Star Western #22–28'),
    coll('All-Star Western Vol. 6: End of the Trail','Trade Paperback','All-Star Western #29–34'),
  ],
  'animal-man': [
    coll('Animal Man Vol. 1: The Hunt','Trade Paperback','Animal Man #1–6'),
    coll('Animal Man Vol. 2: Animal vs. Man','Trade Paperback','Animal Man #0, #7–11 + Annual #1'),
    coll('Animal Man Vol. 3: Rotworld – The Red Kingdom','Trade Paperback','Animal Man #12–19 + Swamp Thing #12, #17–18'),
    coll('Animal Man by Jeff Lemire Omnibus','Hardcover / Omnibus','Animal Man #0–29 + Annual #1–2 + Swamp Thing #12, #17','Run omnibus.'),
  ],
};
for (const s of new52Series) s.collections = collectionIndex[s.id] || [];

export const lanes = [
  {id:'justice',title:'Justice League / DC Core',sub:'The connective spine of the shared universe'},
  {id:'batman',title:'Batman / Gotham',sub:'Batman, Detective, Bat-family and Gotham branches'},
  {id:'superman',title:'Superman Family',sub:'Superman, Action, Supergirl, Superboy and connected titles'},
  {id:'lantern',title:'Green Lantern / Corps',sub:'Lantern Corps and emotional-spectrum books'},
  {id:'young',title:'Teen / Young Heroes',sub:'Teen Titans, Legion and younger heroes'},
  {id:'dark',title:'Dark / Supernatural',sub:'Justice League Dark, Swamp Thing, Animal Man and occult books'},
  {id:'edge',title:'Edge / Government / Cosmic',sub:'WildStorm, war, science-fiction and government books'},
  {id:'alternate',title:'Alternate / Parallel Earths',sub:'Earth-2 and Multiversity worlds',alt:true},
  {id:'future',title:'Future / Time-Displaced',sub:'Futures End and future-facing continuities',alt:true},
];

export const new52Era = {
  id:'new52',
  title:'The New 52',
  years:'2011–2016 continuity',
  description:'The New 52 publishing relaunch began after Flashpoint in September 2011. The New 52 branding ended with Convergence in 2015, while the continuity continued through the DC You period into the 2016 Rebirth transition.',
  mainLanes: lanes.filter(l=>!l.alt && l.id !== 'future'),
  alternateLanes: lanes.filter(l=>l.alt),
  crossoverSpine,
  series:new52Series,
  limited:new52Limited,
  oneShots:new52OneShots,
};

export const eras = [
  {id:'absolute',title:'Absolute Era',years:'2024–',status:'future-build'},
  {id:'dawn',title:'Dawn of DC',years:'2023–2024',status:'future-build'},
  {id:'infinite-frontier',title:'Infinite Frontier',years:'2021–2023',status:'future-build'},
  {id:'rebirth',title:'DC Rebirth',years:'2016–2021',status:'future-build'},
  new52Era,
  {id:'preflashpoint',title:'Pre-Flashpoint DC Universe',years:'1986–2011',status:'future-build'},
  {id:'bronze',title:'Bronze Age',years:'1970s–1985',status:'future-build'},
  {id:'silver',title:'Silver Age',years:'1956–1969',status:'future-build'},
  {id:'golden',title:'Golden Age',years:'1938–1956',status:'future-build'},
];

export function getSeriesForLane(laneId) { return new52Series.filter(s => s.lane === laneId); }
export function getLane(laneId) { return lanes.find(l => l.id === laneId) || null; }
export function getSeries(id) { return new52Series.find(s => s.id === id) || null; }
export function auditNew52() {
  const ids = new Set();
  const errors = [];
  for (const s of new52Series) {
    if (ids.has(s.id)) errors.push(`duplicate series: ${s.id}`); ids.add(s.id);
    if (!s.issues.length) errors.push(`no issues: ${s.id}`);
  }
  return { ok: errors.length === 0, errors, series: new52Series.length, issueRows: new52Series.reduce((n,s)=>n+s.issues.length,0), limited:new52Limited.length, oneShots:new52OneShots.length, transitions:transitionEvents.length };
}
