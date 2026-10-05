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
  // Split: the Court of Owls is a Batman (2011) story arc (collected in Batman Vol. 1, #1–7, role "mainline"); Night of the Owls is the separate Bat-family crossover
  // (its own collection, crossover:true — Batman #8–11 + Annual #1 and tie-ins). They were one merged record typed "crossover".
  { id:'court-owls', title:'The Court of Owls', issues:'Batman #1–7', lanes:['batman'], type:'story' },
  { id:'night-of-owls', title:'Night of the Owls', issues:'Batman #8–11 + Annual #1, with Batman-family tie-ins', lanes:['batman'], type:'crossover' },
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
  S('katana','Katana','justice',R(1,10), 'Short-lived fourth-wave solo series spun out of the Justice League of America/Birds of Prey orbit.'),
  S('fury-of-firestorm','The Fury of Firestorm: The Nuclear Men','justice',R(0,20), 'New 52 Firestorm series; retitled The Fury of Firestorm: The Nuclear Man from #13.'),
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
  S('secret-six','Secret Six','edge',R(1,14), 'Late New 52 launch; 14-issue run, collected in two trades. The title is a New 52-era publication even though it sits in the post-Convergence/DC You transition period.'),
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
  {id:'the-multiversity',title:'The Multiversity',lane:'alternate',issues:['#1','#2','Pax Americana','Thunderworld','The Just','Guidebook','Mastermen','Ultra Comics','Multiversity #2'],kind:'multiverse',notes:'Seven complete adventures plus framing material and a guidebook across parallel Earths.'},
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
  'all-star-western': [
    coll('All-Star Western Vol. 1: Guns and Gotham','Trade Paperback','All-Star Western #1–6'),
    coll('All-Star Western Vol. 2: The War of Lords and Owls','Trade Paperback','All-Star Western #7–12'),
    coll('All-Star Western Vol. 3: The Black Diamond Probability','Trade Paperback','All-Star Western #0, #13–16'),
    coll('All-Star Western Vol. 4: Gold Standard','Trade Paperback','All-Star Western #17–21'),
    coll('All-Star Western Vol. 5: Man Out of Time','Trade Paperback','All-Star Western #22–28'),
    coll('All-Star Western Vol. 6: End of the Trail','Trade Paperback','All-Star Western #29–34'),
  ],
  'animal-man': [
    coll('Animal Man Vol. 1: The Hunt','Trade Paperback','Animal Man #1–6'), coll('Animal Man Vol. 2: Animal vs. Man','Trade Paperback','Animal Man #0, #7–11 + Annual #1'),
    coll('Animal Man Vol. 3: Rotworld – The Red Kingdom','Trade Paperback','Animal Man #12–19 + Swamp Thing #12, #17–18'),
    coll('Animal Man Vol. 4: Splinter Species','Trade Paperback','Animal Man #20–23 + Annual #2'), coll('Animal Man Vol. 5: Evolve or Die!','Trade Paperback','Animal Man #24–29'),
    coll('Animal Man by Jeff Lemire Omnibus','Hardcover / Omnibus','Animal Man #0–29 + Annual #1–2 + Swamp Thing #12, #17'),
  ],
  'aquaman': [
    coll('Aquaman Vol. 1: The Trench','Hardcover','Aquaman #1–6'), coll('Aquaman Vol. 2: The Others','Hardcover','Aquaman #7–13'),
    coll('Aquaman Vol. 3: Throne of Atlantis','Hardcover','Aquaman #0, #14–16 + Justice League #15–17'), coll('Aquaman Vol. 4: Death of a King','Hardcover','Aquaman #17–19, #21–25'),
    coll('Aquaman Vol. 5: Sea of Storms','Hardcover','Aquaman #26–31 + Annual #2'), coll('Aquaman Vol. 6: Maelstrom','Hardcover','Aquaman #32–40 + Secret Origins stories'),
    coll('Aquaman by Geoff Johns Omnibus','Hardcover / Omnibus','Aquaman #0–25, #23.1–23.2 + Justice League #15–17'),
  ],
  'aquaman-and-the-others': [
    coll('Aquaman and the Others Vol. 1: Legacy of Gold','Trade Paperback','Aquaman and the Others #1–5 + Aquaman #20 + Aquaman Annual #1'),
    coll('Aquaman and the Others Vol. 2: Alignment Earth','Trade Paperback','Aquaman and the Others #6–11 + Aquaman: Futures End #1 + Aquaman and the Others: Futures End #1'),
  ],
  'arkham-manor': [coll('Arkham Manor','Trade Paperback','Arkham Manor #1–6')],
  'batgirl': [
    coll('Batgirl Vol. 1: The Darkest Reflection','Hardcover','Batgirl #1–6'), coll('Batgirl Vol. 2: Knightfall Descends','Hardcover','Batgirl #0, #7–13'),
    coll('Batgirl Vol. 3: Death of the Family','Hardcover','Batgirl #14–19 + Batman #17 + Annual #1'), coll('Batgirl Vol. 4: Wanted','Hardcover','Batgirl #20–26 + Batman: The Dark Knight #23.1'),
    coll('Batgirl Vol. 5: Deadline','Hardcover','Batgirl #27–34 + Annual #2'), coll('Batgirl Vol. 1: Batgirl of Burnside','Hardcover','Batgirl #35–40'),
  ],
  'batman': [
    coll('Batman Vol. 1: The Court of Owls','Hardcover','Batman #1–7'), coll('Batman Vol. 1: The Court of Owls','Trade Paperback','Batman #1–7'),
    coll('Batman Vol. 2: City of Owls','Hardcover','Batman #8–12 + Annual #1'), coll('Batman Vol. 2: City of Owls','Trade Paperback','Batman #8–12 + Annual #1'),
    coll('Batman Vol. 3: Death of the Family','Hardcover','Batman #13–17'), coll('Batman Vol. 3: Death of the Family','Trade Paperback','Batman #13–17'),
    coll('Batman Vol. 4: Zero Year – Secret City','Hardcover','Batman #21–24'), coll('Batman Vol. 4: Zero Year – Secret City','Trade Paperback','Batman #21–24'),
    coll('Batman Vol. 5: Zero Year – Dark City','Hardcover','Batman #25–27, #29–33'), coll('Batman Vol. 5: Zero Year – Dark City','Trade Paperback','Batman #25–27, #29–33'),
    coll('Batman Vol. 6: Graveyard Shift','Hardcover','Batman #0, #18–20, #28, #34 + Annual #2'), coll('Batman Vol. 7: Endgame','Hardcover','Batman #35–40'), coll('Batman Vol. 7: Endgame','Trade Paperback','Batman #35–40'),
    coll('Batman: The Night of the Owls','Hardcover','Batman #8–9 + selected Bat-family tie-ins'), coll('Absolute Batman: The Court of Owls','Hardcover / Absolute','Batman #1–11'),
    coll('Batman by Scott Snyder & Greg Capullo Omnibus Vol. 1','Hardcover / Omnibus','Batman #0–33 + #23.2 + Annuals #1–2'),
  ],
  'batman-and-robin': [
    coll('Batman and Robin Vol. 1: Born to Kill','Hardcover','Batman and Robin #1–8'), coll('Batman and Robin Vol. 2: Pearl','Hardcover','Batman and Robin #0, #9–14'),
    coll('Batman and Robin Vol. 3: Death of the Family','Hardcover','Batman and Robin #15–17 + Batman #17 + Annual #1'), coll('Batman and Robin Vol. 4: Requiem for Damian','Hardcover','Batman and Robin #18–23'),
    coll('Batman and Robin Vol. 5: The Big Burn','Hardcover','Batman and... #24–28 + Annual #2'), coll('Batman and Robin Vol. 6: The Hunt for Robin','Hardcover','Batman and Robin #29–34 + Robin Rises: Omega #1'),
    coll('Batman and Robin Vol. 7: Robin Rises','Hardcover','Batman and Robin #35–40 + Robin Rises: Alpha #1 + Annual #3 + Futures End #1'),
    coll('Batman and Robin by Peter J. Tomasi & Patrick Gleason Omnibus','Hardcover / Omnibus','Run-level omnibus covering the Tomasi/Gleason New 52 material'),
  ],
  'batman-dark-knight': [
    coll('Batman: The Dark Knight Vol. 1: Knight Terrors','Hardcover','Batman: The Dark Knight #1–9'), coll('Batman: The Dark Knight Vol. 2: Cycle of Violence','Hardcover','Batman: The Dark Knight #0, #10–15'),
    coll('Batman: The Dark Knight Vol. 3: Mad','Hardcover','Batman: The Dark Knight #16–21 + Annual #1'), coll('Batman: The Dark Knight Vol. 4: Clay','Hardcover','Batman: The Dark Knight #22–29'),
  ],
  'batman-incorporated': [
    coll('Batman, Incorporated Vol. 1: Demon Star','Hardcover','Batman, Incorporated #0–6'), coll('Batman, Incorporated Vol. 2: Gotham’s Most Wanted','Hardcover','Batman, Incorporated #7–13 + Special #1'),
    coll('Absolute Batman Incorporated','Hardcover / Absolute','Batman Incorporated Vol. 1 #1–8 + Vol. 2 #1–13 + Leviathan Rises + Special #1'),
  ],
  'batman-eternal': [coll('Batman Eternal Vol. 1','Trade Paperback','Batman Eternal #1–20'), coll('Batman Eternal Vol. 2','Trade Paperback','Batman Eternal #22–34'), coll('Batman Eternal Vol. 3','Trade Paperback','Batman Eternal #35–52 + Batman #28'), coll('Batman: Eternal Omnibus','Hardcover / Omnibus','Batman Eternal #1–52 + Batman #28')],
  'batman-superman': [
    coll('Batman/Superman Vol. 1: Cross World','Hardcover','Batman/Superman #1–4 + Justice League #23.1'), coll('Batman/Superman Vol. 2: Game Over','Hardcover','Batman/Superman #5–9 + Annual #1 + Worlds’ Finest #20–21'),
    coll('Batman/Superman Vol. 3: Second Chance','Hardcover','Batman/Superman #10–15'), coll('Batman/Superman Vol. 4: Siege','Hardcover','Batman/Superman #16–20 + Annual #2 + Futures End #1'),
    coll('Batman/Superman Vol. 5: Truth Hurts','Hardcover','Batman/Superman #21–27'),
  ],
  'batwing': [coll('Batwing Vol. 1: The Lost Kingdom','Trade Paperback','Batwing #1–6'), coll('Batwing Vol. 2: In the Shadow of the Ancients','Trade Paperback','Batwing #0, #7–12'), coll('Batwing Vol. 3: Enemy of the State','Trade Paperback','Batwing #13–18'), coll('Batwing Vol. 4: Welcome to the Family','Trade Paperback','Batwing #19–26'), coll('Batwing Vol. 5: Into the Dark','Trade Paperback','Batwing #27–34 + Futures End #1')],
  'detective-comics': [coll('Batman: Detective Comics Vol. 1: Faces of Death','Hardcover','Detective Comics #1–7'), coll('Batman: Detective Comics Vol. 2: Scare Tactics','Hardcover','Detective Comics #0, #8–12 + Annual #1'), coll('Batman: Detective Comics Vol. 3: Emperor Penguin','Hardcover','Detective Comics #13–18'), coll('Batman: Detective Comics Vol. 4: The Wrath','Hardcover','Detective Comics #19–24 + Annual #2'), coll('Batman: Detective Comics Vol. 5: Gothtopia','Hardcover','Detective Comics #25–29'), coll('Batman: Detective Comics Vol. 6: Icarus','Hardcover','Detective Comics #30–34 + Annual #3'), coll('Batman: Detective Comics Vol. 7: Anarky','Hardcover','Detective Comics #35–40 + Endgame #1 + Futures End #1')],
  'batwoman': [coll('Batwoman Vol. 1: Hydrology','Hardcover','Batwoman #0, #1–5'), coll('Batwoman Vol. 2: To Drown the World','Hardcover','Batwoman #6–11'), coll('Batwoman Vol. 3: World’s Finest','Hardcover','Batwoman #0, #12–17'), coll('Batwoman Vol. 4: This Blood is Thick','Hardcover','Batwoman #18–24'), coll('Batwoman Vol. 5: Webs','Trade Paperback','Batwoman #25–31 + Annual #1'), coll('Batwoman Vol. 6: The Unknowns','Trade Paperback','Batwoman #35–40 + Futures End #1 + Secret Origins story')],
  'birds-of-prey': [coll('Birds of Prey Vol. 1: Trouble in Mind','Trade Paperback','Birds of Prey #1–7'), coll('Birds of Prey Vol. 2: Your Kiss Might Kill','Trade Paperback','Birds of Prey #8–13'), coll('Birds of Prey Vol. 3: A Clash of Daggers','Trade Paperback','Birds of Prey #13–17 + Batgirl Annual #1'), coll('Birds of Prey Vol. 4: The Cruelest Cut','Trade Paperback','Birds of Prey #18–24, #26 + Talon #9'), coll('Birds of Prey Vol. 5: Soul Crisis','Trade Paperback','Birds of Prey #25, #27–34 + Futures End #1')],
  'blackhawks': [coll('Blackhawks Vol. 1: The Great Leap Forward','Trade Paperback','Blackhawks #1–8')],
  'blue-beetle': [coll('Blue Beetle Vol. 1: Metamorphosis','Trade Paperback','Blue Beetle #1–6'), coll('Blue Beetle Vol. 2: Blue Diamond','Trade Paperback','Blue Beetle #0, #7–16 + Green Lantern: New Guardians #9')],
  'captain-atom': [coll('Captain Atom Vol. 1: Evolution','Trade Paperback','Captain Atom #1–6'), coll('Captain Atom Vol. 2: Genesis','Trade Paperback','Captain Atom #0, #7–12')],
  'catwoman': [coll('Catwoman Vol. 1: The Game','Trade Paperback','Catwoman #1–6'), coll('Catwoman Vol. 2: Dollhouse','Trade Paperback','Catwoman #7–12'), coll('Catwoman Vol. 3: Death of the Family','Trade Paperback','Catwoman #0, #13–18 + Young Romance special story'), coll('Catwoman Vol. 4: Gotham Underground','Trade Paperback','Catwoman #19–24, #26 + Annual #1 + Batman: The Dark Knight #23.4'), coll('Catwoman Vol. 5: Race of Thieves','Trade Paperback','Catwoman #25, #27–34'), coll('Catwoman Vol. 6: Keeper of the Castle','Trade Paperback','Catwoman #35–40 + Annual #2')],
  'constantine': [coll('Constantine Vol. 1: The Spark and the Flame','Trade Paperback','Constantine #1–6'), coll('Constantine Vol. 2: Blight','Trade Paperback','Constantine #7–12'), coll('Constantine Vol. 3: The Voice in the Fire','Trade Paperback','Constantine #13–17 + Futures End #1'), coll('Constantine Vol. 4: The Apocalypse Road','Trade Paperback','Constantine #18–23')],
  'dc-universe-presents': [coll('DC Universe Presents Vol. 1: Deadman/Challengers of the Unknown','Trade Paperback','DC Universe Presents #1–8'), coll('DC Universe Presents Vol. 2: Vandal Savage','Trade Paperback','DC Universe Presents #0, #9–12'), coll('DC Universe Presents Vol. 3: Black Lightning and Blue Devil','Trade Paperback','DC Universe Presents #13–19')],
  'mister-terrific': [coll('Mister Terrific Vol. 1: Mind Games','Trade Paperback','Mister Terrific #1–8')],
  'savage-hawkman': [coll('The Savage Hawkman Vol. 1: Darkness Rising','Trade Paperback','The Savage Hawkman #1–8'), coll('The Savage Hawkman Vol. 2: Wanted','Trade Paperback','The Savage Hawkman #0, #9–20')],
  'secret-six': [coll('Secret Six Vol. 1: Friends in Low Places','Trade Paperback','Secret Six #1–6 + the Sneak Peek story from Convergence: Wonder Woman #2'), coll('Secret Six Vol. 2: The Gauntlet','Trade Paperback','Secret Six #7–14')],
  'ravagers': [coll('The Ravagers Vol. 1: The Kids from N.O.W.H.E.R.E.','Trade Paperback','The Ravagers #1–7'), coll('The Ravagers Vol. 2: Heavenly Destruction','Trade Paperback','The Ravagers #0, #8–12')],
  'star-spangled-war-stories': [coll('G.I. Zombie: A Star-Spangled War Story','Trade Paperback','Star-Spangled War Stories Featuring G.I. Zombie #1–8 + Futures End #1')],
  'green-team': [coll('The Green Team: Teen Trillionaires Vol. 1: Money and Power','Trade Paperback','The Green Team: Teen Trillionaires #1–8')],
  'threshold': [coll('Threshold Vol. 1: The Hunted','Trade Paperback','Threshold #1–8 + Green Lantern: New Guardians Annual #1')],
  'deathstroke-v2': [coll('Deathstroke Vol. 1: Legacy','Trade Paperback','Deathstroke #1–8'), coll('Deathstroke Vol. 2: Lobo Hunt','Trade Paperback','Deathstroke #0, #9–20')],
  'deathstroke-v3': [coll('Deathstroke Vol. 1: Gods of War','Trade Paperback','Deathstroke #1–6')],
  'demon-knights': [coll('Demon Knights Vol. 1: Seven Against the Dark','Trade Paperback','Demon Knights #1–7'), coll('Demon Knights Vol. 2: The Avalon Trap','Trade Paperback','Demon Knights #0, #8–12'), coll('Demon Knights Vol. 3: The Gathering Storm','Trade Paperback','Demon Knights #13–23')],
  'dial-h': [coll('Dial H Vol. 1: Into You','Trade Paperback','Dial H #0–6'), coll('Dial H Vol. 2: Exchange','Trade Paperback','Dial H #7–15 + Justice League #23.3'), coll('Dial H Deluxe Edition','Hardcover / Deluxe','Dial H #0–15')],
  'earth-2': [coll('Earth 2 Vol. 1: The Gathering','Hardcover','Earth 2 #1–6'), coll('Earth 2 Vol. 2: The Tower of Fate','Hardcover','Earth 2 #0, #7–12 + DC Universe Presents #0 story'), coll('Earth 2 Vol. 3: Battle Cry','Hardcover','Earth 2 #13–16, #15.1 + Annual #1'), coll('Earth 2 Vol. 4: The Dark Age','Hardcover','Earth 2 #17–20 + Annual #2'), coll('Earth 2 Vol. 5: The Kryptonian','Hardcover','Earth 2 #21–26 + Futures End #1'), coll('Earth 2 Vol. 6: Collision','Hardcover','Earth 2 #27–32')],
  'frankenstein-agent-shade': [coll('Frankenstein, Agent of S.H.A.D.E. Vol. 1: War of the Monsters','Trade Paperback','Frankenstein, Agent of S.H.A.D.E. #1–7'), coll('Frankenstein, Agent of S.H.A.D.E. Vol. 2: Secrets of the Dead','Trade Paperback','Frankenstein, Agent of S.H.A.D.E. #0, #8–16 + Men of War #8')],
  'fury-of-firestorm': [coll('The Fury of Firestorm Vol. 1: The God Particle','Trade Paperback','The Fury of Firestorm #1–6'), coll('The Fury of Firestorm Vol. 2: The Firestorm Protocols','Trade Paperback','The Fury of Firestorm #0, #7–12'), coll('The Fury of Firestorm Vol. 3: Takeover','Trade Paperback','The Fury of Firestorm: The Nuclear Man #13–20')],
  'gi-combat': [coll('G.I. Combat Vol. 1: The War That Time Forgot','Trade Paperback','G.I. Combat #0–7')],
  'gotham-academy': [coll('Gotham Academy Vol. 1: Welcome to Gotham Academy','Trade Paperback','Gotham Academy #1–6')],
  'gotham-by-midnight': [coll('Gotham by Midnight Vol. 1: We Do Not Sleep','Trade Paperback','Gotham by Midnight #1–5')],
  'grayson': [coll('Grayson Vol. 1: Agents of Spyral','Hardcover','Grayson #1–4 + Secret Origins #8 story + Futures End #1'), coll('Grayson Vol. 2: We All Die at Dawn','Trade Paperback','Grayson #5–8 + Annual #1')],
  'green-arrow': [coll('Green Arrow Vol. 1: The Midas Touch','Trade Paperback','Green Arrow #1–6'), coll('Green Arrow Vol. 2: Triple Threat','Trade Paperback','Green Arrow #7–13'), coll('Green Arrow Vol. 3: Harrow','Trade Paperback','Green Arrow #0, #14–16 + Savage Hawkman #14 + Justice League #8'), coll('Green Arrow Vol. 4: The Kill Machine','Trade Paperback','Green Arrow #17–24'), coll('Green Arrow Vol. 5: The Outsiders War','Trade Paperback','Green Arrow #25–31'), coll('Green Arrow Vol. 6: Broken','Trade Paperback','Green Arrow #32–34 + Futures End #1 + Secret Origins #4 story'), coll('Green Arrow Vol. 7: Kingdom','Trade Paperback','Green Arrow #35–40'), coll('Green Arrow by Jeff Lemire Deluxe Edition','Hardcover / Deluxe','Green Arrow #17–34 + Futures End #1 + Secret Origins #4 story')],
  'green-lantern': [coll('Green Lantern Vol. 1: Sinestro','Hardcover','Green Lantern #1–6'), coll('Green Lantern Vol. 2: The Revenge of Black Hand','Hardcover','Green Lantern #7–12 + Annual #1'), coll('Green Lantern Vol. 3: The End','Hardcover','Green Lantern #0, #13–20'), coll('Green Lantern Vol. 4: Dark Days','Hardcover','Green Lantern #21–26, #23.1 + Annual #2'), coll('Green Lantern Vol. 5: Test of Wills','Hardcover','Green Lantern #27–34 + Green Lantern Corps #31–33'), coll('Green Lantern Vol. 6: The Life Equation','Hardcover','Green Lantern #35–40 + Annual #3 + Secret Origins #3 story'), coll('Green Lantern: Rise of the Third Army','Hardcover','Green Lantern #13–16 + related Lantern family chapters'), coll('Green Lantern: Wrath of the First Lantern','Hardcover','Green Lantern #17–20 + related Lantern family chapters'), coll('Green Lantern: Lights Out','Hardcover','Green Lantern #23.1, #24 + Lantern family tie-ins'), coll('Green Lantern/New Gods: Godhead','Hardcover','Green Lantern #35–37 + Lantern family tie-ins + Godhead #1'), coll('Green Lantern by Geoff Johns Omnibus Vol. 3','Hardcover / Omnibus','Green Lantern #1–20 + preceding Green Lantern material')],
  'green-lantern-corps': [coll('Green Lantern Corps Vol. 1: Fearsome','Hardcover','Green Lantern Corps #1–7'), coll('Green Lantern Corps Vol. 2: Alpha War','Hardcover','Green Lantern Corps #0, #8–14'), coll('Green Lantern Corps Vol. 3: Willpower','Hardcover','Green Lantern Corps #15–20 + Annual #1 + Green Lantern #20'), coll('Green Lantern Corps Vol. 4: Rebuild','Trade Paperback','Green Lantern Corps #21–27 + Annual #2'), coll('Green Lantern Corps Vol. 5: Uprising','Trade Paperback','Green Lantern Corps #28–34 + Green Lantern #31–33 + Annual #2'), coll('Green Lantern Corps Vol. 6: Reckoning','Trade Paperback','Green Lantern Corps #35–40'), coll('Green Lantern: Rise of the Third Army','Hardcover','Green Lantern Corps #13–16 + related Lantern family chapters'), coll('Green Lantern: Wrath of the First Lantern','Hardcover','Green Lantern Corps #17–20 + related Lantern family chapters'), coll('Green Lantern: Lights Out','Hardcover','Green Lantern Corps #24 + related Lantern family chapters'), coll('Green Lantern/New Gods: Godhead','Hardcover','Green Lantern Corps #35–37 + related Lantern family chapters')],
  'green-lantern-new-guardians': [coll('Green Lantern: New Guardians Vol. 1: The Ring Bearer','Hardcover','New Guardians #1–7'), coll('Green Lantern: New Guardians Vol. 2: Beyond Hope','Hardcover','New Guardians #8–12 + Blue Beetle #9'), coll('Green Lantern: New Guardians Vol. 3: Love and Death','Hardcover','New Guardians #0, #13–20 + Green Lantern #20'), coll('Green Lantern: New Guardians Vol. 4: Gods and Monsters','Trade Paperback','New Guardians #21–27 + Annual #2'), coll('Green Lantern: New Guardians Vol. 5: Godkillers','Trade Paperback','New Guardians #28–34'), coll('Green Lantern: New Guardians Vol. 6: Storming the Gates','Trade Paperback','New Guardians #35–40'), coll('Green Lantern: Rise of the Third Army','Hardcover','New Guardians #13–16 + related Lantern family chapters'), coll('Green Lantern: Wrath of the First Lantern','Hardcover','New Guardians #17–20 + related Lantern family chapters'), coll('Green Lantern: Lights Out','Hardcover','New Guardians #23–24 + related Lantern family chapters'), coll('Green Lantern/New Gods: Godhead','Hardcover','New Guardians #35–37 + related Lantern family chapters')],
  'grifter': [coll('Grifter Vol. 1: Most Wanted','Trade Paperback','Grifter #1–8'), coll('Grifter Vol. 2: Newfound Power','Trade Paperback','Grifter #0, #9–16')],
  'harley-quinn': [coll('Harley Quinn Vol. 1: Hot in the City','Hardcover','Harley Quinn #0–8'), coll('Harley Quinn Vol. 2: Power Outage','Hardcover','Harley Quinn #9–13 + Futures End #1 + Secret Origins #4 story + Comic-Con special'), coll('Harley Quinn Vol. 3: Kiss Kiss Bang Stab','Hardcover','Harley Quinn #14–16 + Valentine’s Day and Holiday specials'), coll('Harley Quinn by Amanda Conner & Jimmy Palmiotti Omnibus Vol. 1','Hardcover / Omnibus','Harley Quinn #0–16 + Annual #1 + specials')],
  'hawk-dove': [coll('Hawk and Dove Vol. 1: First Strikes','Trade Paperback','Hawk & Dove #1–8')],
  'i-vampire': [coll('I, Vampire Vol. 1: Tainted Love','Trade Paperback','I, Vampire #1–6'), coll('I, Vampire Vol. 2: Rise of the Vampires','Trade Paperback','I, Vampire #7–12 + Justice League Dark #7–8'), coll('I, Vampire Vol. 3: Wave of Mutilation','Trade Paperback','I, Vampire #0, #13–19')],
  'infinity-man-forever-people': [coll('Infinity Man and the Forever People Vol. 1: Planet of the Humans','Trade Paperback','Infinity Man and the Forever People #1–9 + Futures End #1')],
  'justice-league': [coll('Justice League Vol. 1: Origin','Hardcover','Justice League #1–6'), coll('Justice League Vol. 1: Origin','Trade Paperback','Justice League #1–6'), coll("Justice League Vol. 2: The Villain’s Journey",'Hardcover','Justice League #7–12'), coll("Justice League Vol. 2: The Villain’s Journey",'Trade Paperback','Justice League #7–12'), coll('Justice League Vol. 3: Throne of Atlantis','Hardcover','Justice League #13–17 + Aquaman #15–16'), coll('Justice League Vol. 3: Throne of Atlantis','Trade Paperback','Justice League #13–17 + Aquaman #15–16'), coll('Justice League Vol. 4: The Grid','Hardcover','Justice League #18–20, #22–23'), coll('Justice League Vol. 4: The Grid','Trade Paperback','Justice League #18–20, #22–23'), coll('Justice League Vol. 5: Forever Heroes','Hardcover','Justice League #24–29'), coll('Justice League Vol. 6: Injustice League','Hardcover','Justice League #30–39'), coll('Justice League Vol. 7: Darkseid War Part 1','Hardcover','Justice League #40–44 + DC Sneak Peek'), coll('Justice League Vol. 8: Darkseid War Part 2','Hardcover','Justice League #45–50 + Darkseid War Special'), coll('Justice League: Trinity War','Hardcover','Justice League #22–23 + JLA #6–7 + JLD #22–23 + Constantine #5 + Pandora #1–3 + Phantom Stranger #11')],
  'justice-league-dark': [coll('Justice League Dark Vol. 1: In the Dark','Trade Paperback','Justice League Dark #1–6'), coll('Justice League Dark Vol. 2: The Books of Magic','Trade Paperback','Justice League Dark #0, #7–13 + Annual #1'), coll('Justice League Dark Vol. 3: The Death of Magic','Trade Paperback','Justice League Dark #14–21'), coll('Justice League Dark Vol. 4: The Rebirth of Evil','Trade Paperback','Justice League Dark #22–29'), coll('Justice League Dark Vol. 5: Paradise Lost','Trade Paperback','Justice League Dark #30–34 + Futures End #1'), coll('Justice League Dark Vol. 6: Lost in Forever','Trade Paperback','Justice League Dark #35–40 + Annual #2'), coll('Justice League: Trinity War','Hardcover','Justice League Dark #22–23 + crossover chapters'), coll('Forever Evil: Blight','Trade Paperback','Justice League Dark #24–29 + Constantine #9–12 + Pandora #6–9 + Phantom Stranger #14–17')],
  'justice-league-international': [coll('Justice League International Vol. 1: The Signal Masters','Trade Paperback','Justice League International #1–6'), coll('Justice League International Vol. 2: Breakdown','Trade Paperback','Justice League International #7–12 + Annual #1 + Fury of Firestorm #9')],
  'justice-league-of-america': [coll('Justice League of America Vol. 1: World’s Most Dangerous','Hardcover','Justice League of America #1–7'), coll('Justice League of America Vol. 2: Survivors of Evil','Hardcover','Justice League of America #8–14'), coll('Justice League: Trinity War','Hardcover','Justice League of America #6–7 + crossover chapters')],
  'justice-league-of-americas-vibe': [coll('Justice League of America’s Vibe Vol. 1: Breach','Trade Paperback','Justice League of America’s Vibe #1–10')],
  'justice-league-united': [coll('Justice League United Vol. 1: Justice League Canada','Hardcover','Justice League United #0–5'), coll('Justice League United Vol. 2: The Infinitus Saga','Hardcover','Justice League United #6–10 + Annual #1 + Futures End specials')],
  'justice-league-3000': [coll('Justice League 3000 Vol. 1: Yesterday Lives','Trade Paperback','Justice League 3000 #1–7'), coll('Justice League 3000 Vol. 2: The Camelot War','Trade Paperback','Justice League 3000 #8–13'), coll('Justice League 3001 Vol. 1: Deja Vu All Over Again','Trade Paperback','Justice League 3000 #14–15 + Justice League 3001 #1–6'), coll('Justice League 3001 Vol. 2: Things Fall Apart','Trade Paperback','Justice League 3001 #7–12')],
  'katana': [coll('Katana Vol. 1: Soultaker','Trade Paperback','Katana #1–10 + Justice League Dark #23.1')],
  'klarion': [coll('Klarion Vol. 1: The New Witch in Town','Trade Paperback','Klarion #1–6')],
  'larfleeze': [coll('Larfleeze Vol. 1: Revolt of the Orange Lanterns','Trade Paperback','Larfleeze #1–5 + Threshold material'), coll('Larfleeze Vol. 2: The Face of Greed','Trade Paperback','Larfleeze #6–12')],
  'legion-lost': [coll('Legion Lost Vol. 1: Run From Tomorrow','Trade Paperback','Legion Lost #1–7'), coll('Legion Lost Vol. 2: The Culling','Trade Paperback','Legion Lost #0, #8–16')],
  'legion-of-super-heroes': [coll('Legion of Super-Heroes Vol. 1: Hostile World','Trade Paperback','Legion of Super-Heroes #1–7'), coll('Legion of Super-Heroes Vol. 2: The Dominators','Trade Paperback','Legion of Super-Heroes #0, #8–14'), coll('Legion of Super-Heroes Vol. 3: The Fatal Five','Trade Paperback','Legion of Super-Heroes #15–23')],
  'lobo': [coll('Lobo Vol. 1: Targets','Trade Paperback','Lobo #1–6')],
  'men-of-war': [coll('Men of War Vol. 1: Uneasy Company','Trade Paperback','Men of War #1–8')],
  'new-suicide-squad': [coll('New Suicide Squad Vol. 1: Pure Insanity','Trade Paperback','New Suicide Squad #1–8')],
  'nightwing': [coll('Nightwing Vol. 1: Traps and Trapezes','Trade Paperback','Nightwing #1–7'), coll('Nightwing Vol. 2: Night of the Owls','Trade Paperback','Nightwing #0, #8–12'), coll('Nightwing Vol. 3: Death of the Family','Trade Paperback','Nightwing #13–18 + Batman #17'), coll('Nightwing Vol. 4: Second City','Trade Paperback','Nightwing #19–24'), coll('Nightwing Vol. 5: Setting Son','Trade Paperback','Nightwing #25–30 + Annual #1')],
  'omac': [coll('O.M.A.C. Vol. 1: Omactivate','Trade Paperback','O.M.A.C. #1–8')],
  'red-hood-outlaws': [coll('Red Hood and the Outlaws Vol. 1: Redemption','Trade Paperback','Red Hood and the Outlaws #1–7'), coll('Red Hood and the Outlaws Vol. 2: The Starfire','Trade Paperback','Red Hood and the Outlaws #8–14'), coll('Red Hood and the Outlaws Vol. 3: Death of the Family','Trade Paperback','Red Hood and the Outlaws #0, #15–18 + Teen Titans #15–16'), coll('Red Hood and the Outlaws Vol. 4: League of Assassins','Trade Paperback','Red Hood and the Outlaws #19–24 + Annual #1'), coll('Red Hood and the Outlaws Vol. 5: The Big Picture','Trade Paperback','Red Hood and the Outlaws #27–31 + DC Universe Presents #17–18'), coll('Red Hood and the Outlaws Vol. 6: Lost and Found','Trade Paperback','Red Hood and the Outlaws #32–34 + Secret Origins stories + Annual #2'), coll('Red Hood and the Outlaws Vol. 7: Last Call','Trade Paperback','Red Hood and the Outlaws #35–40 + Futures End #1')],
  'red-lanterns': [coll('Red Lanterns Vol. 1: Blood and Rage','Trade Paperback','Red Lanterns #1–7'), coll('Red Lanterns Vol. 2: The Death of the Red Lanterns','Trade Paperback','Red Lanterns #8–12 + Stormwatch #9'), coll('Red Lanterns Vol. 3: The Second Prophecy','Trade Paperback','Red Lanterns #0, #13–20'), coll('Red Lanterns Vol. 4: Blood Brothers','Trade Paperback','Red Lanterns #21–26 + Green Lantern Annual #2'), coll('Red Lanterns Vol. 5: Atrocities','Trade Paperback','Red Lanterns #27–34 + Annual #1 + Supergirl #31'), coll('Red Lanterns Vol. 6: Forged in Blood','Trade Paperback','Red Lanterns #35–40 + Futures End #1'), coll('Green Lantern: Rise of the Third Army','Hardcover','Red Lanterns #13–16 + related Lantern family chapters'), coll('Green Lantern: Wrath of the First Lantern','Hardcover','Red Lanterns #17–20 + related Lantern family chapters'), coll('Green Lantern: Lights Out','Hardcover','Red Lanterns #24 + related Lantern family chapters'), coll('Green Lantern/New Gods: Godhead','Hardcover','Red Lanterns #35–37 + related Lantern family chapters')],
  'resurrection-man': [coll('Resurrection Man Vol. 1: Dead Again','Trade Paperback','Resurrection Man #1–7'), coll('Resurrection Man Vol. 2: A Matter of Death and Life','Trade Paperback','Resurrection Man #0, #8–12 + Suicide Squad #9')],
  'secret-origins': [coll('Secret Origins Vol. 1','Trade Paperback','Secret Origins #1–4'), coll('Secret Origins Vol. 2','Trade Paperback','Secret Origins #5–11')],
  'sinestro': [coll('Sinestro Vol. 1: The Demon Within','Trade Paperback','Sinestro #1–5 + Futures End #1 + Green Lantern #23.4'), coll('Sinestro Vol. 2: Sacrifice','Trade Paperback','Sinestro #6–11 + Annual #1 + Secret Origins #6 story'), coll('Green Lantern/New Gods: Godhead','Hardcover','Sinestro #6–8 + Godhead crossover')],
  'static-shock': [coll('Static Shock Vol. 1: Supercharged','Trade Paperback','Static Shock #1–8')],
  'stormwatch': [coll('Stormwatch Vol. 1: The Dark Side','Trade Paperback','Stormwatch #1–6'), coll('Stormwatch Vol. 2: Enemies of Earth','Trade Paperback','Stormwatch #7–12 + Red Lanterns #10'), coll('Stormwatch Vol. 3: Betrayal','Trade Paperback','Stormwatch #0, #13–18'), coll('Stormwatch Vol. 4: Reset','Trade Paperback','Stormwatch #19–30')],
  'suicide-squad': [coll('Suicide Squad Vol. 1: Kicked in the Teeth','Trade Paperback','Suicide Squad #1–7'), coll('Suicide Squad Vol. 2: Basilisk Rising','Trade Paperback','Suicide Squad #0, #8–13 + Resurrection Man #9'), coll('Suicide Squad Vol. 3: Death is for Suckers','Trade Paperback','Suicide Squad #14–19'), coll('Suicide Squad Vol. 4: Discipline and Punish','Trade Paperback','Suicide Squad #20–23 + JLA #7.1 + Detective Comics #23.2'), coll('Suicide Squad Vol. 5: Walled In','Trade Paperback','Suicide Squad #24–30 + Amanda Waller #1')],
  'superboy': [coll('Superboy Vol. 1: Incubation','Trade Paperback','Superboy #1–7'), coll('Superboy Vol. 2: Extraction','Trade Paperback','Superboy #0, #8–12 + Teen Titans #10'), coll('Superboy Vol. 3: Lost','Trade Paperback','Superboy #13–19 + Annual #1'), coll('Superboy Vol. 4: Blood and Steel','Trade Paperback','Superboy #20–25'), coll('Superboy Vol. 5: Paradox','Trade Paperback','Superboy #26–34 + Futures End #1')],
  'supergirl': [coll('Supergirl Vol. 1: Last Daughter of Krypton','Trade Paperback','Supergirl #1–7'), coll('Supergirl Vol. 2: Girl in the World','Trade Paperback','Supergirl #0, #8–12'), coll('Supergirl Vol. 3: Sanctuary','Trade Paperback','Supergirl #13–19'), coll('Supergirl Vol. 4: Out of the Past','Trade Paperback','Supergirl #21–25 + Action Comics #23.1 + Superman #25'), coll('Supergirl Vol. 5: Red Daughter of Krypton','Trade Paperback','Supergirl #26–33 + Green Lantern #28 + Red Lanterns #28–29'), coll('Supergirl Vol. 6: Crucible','Trade Paperback','Supergirl #34–40 + Futures End #1')],
  'action-comics': [coll('Superman: Action Comics Vol. 1: Superman and the Men of Steel','Hardcover','Action Comics #1–8'), coll('Superman: Action Comics Vol. 2: Bulletproof','Hardcover','Action Comics #0, #9–12 + Annual #1'), coll('Superman: Action Comics Vol. 3: At the End of Days','Hardcover','Action Comics #13–18'), coll('Superman: Action Comics Vol. 4: Hybrid','Hardcover','Action Comics #19–24 + Young Romance and Superman Annual material'), coll('Superman: Action Comics Vol. 5: What Lies Beneath','Hardcover','Action Comics #25–29 + Secret Origins #1 story'), coll('Superman: Action Comics Vol. 6: Superdoom','Hardcover','Action Comics #30–35 + Annual #3'), coll('Superman: Action Comics Vol. 7: Under the Skin','Hardcover','Action Comics #36–40 + Futures End #1')],
  'superman': [coll('Superman Vol. 1: What Price Tomorrow?','Hardcover','Superman #1–6'), coll('Superman Vol. 2: Secrets and Lies','Hardcover','Superman #7–12 + Annual #1'), coll('Superman Vol. 3: Fury at World’s End','Hardcover','Superman #0, #13–17'), coll('Superman Vol. 4: Psi War','Hardcover','Superman #18–24 + Annual #2'), coll('Superman Vol. 5: Under Fire','Hardcover','Superman #25–31'), coll('Superman Vol. 6: The Men of Tomorrow','Hardcover','Superman #32–39'), coll('Superman: H’el on Earth','Hardcover','Superman #13–17 + Superboy #14–17 + Supergirl #14–17'), coll('Superman: Doomed','Hardcover','Superman: Doomed #1–2 + Superman #30 + connected Superman-family chapters'), coll('Superman: Krypton Returns','Hardcover','Superman #0, #25 + connected Superboy/Supergirl/Action material')],
  'superman-unchained': [coll('Superman Unchained Vol. 1','Hardcover','Superman Unchained #1–7'), coll('Superman Unchained Deluxe Edition','Hardcover / Deluxe','Superman Unchained #1–9')],
  'superman-wonder-woman': [coll('Superman/Wonder Woman Vol. 1: Power Couple','Hardcover','Superman/Wonder Woman #1–6'), coll('Superman/Wonder Woman Vol. 2: War and Peace','Hardcover','Superman/Wonder Woman #8–12 + Annual #1 + Futures End #1'), coll('Superman/Wonder Woman Vol. 3: Casualties of War','Hardcover','Superman/Wonder Woman #13–17')],
  'swamp-thing': [coll('Swamp Thing Vol. 1: Raise Them Bones','Trade Paperback','Swamp Thing #1–7'), coll('Swamp Thing Vol. 2: Family Tree','Trade Paperback','Swamp Thing #0, #8–11 + Annual #1'), coll('Swamp Thing Vol. 3: Rotworld: The Green Kingdom','Trade Paperback','Swamp Thing #12–18 + Animal Man #12, #17'), coll('Swamp Thing Vol. 4: Seeder','Trade Paperback','Swamp Thing #19–23, #23.1'), coll('Swamp Thing Vol. 5: Killing Field','Trade Paperback','Swamp Thing #24–27 + Annual #2'), coll('Swamp Thing Vol. 6: The Sureen','Trade Paperback','Swamp Thing #28–34 + Aquaman #31 pages'), coll('Swamp Thing Vol. 7: Season’s End','Trade Paperback','Swamp Thing #35–40 + Annual #3 + Futures End #1'), coll('Swamp Thing by Scott Snyder Deluxe Edition','Hardcover / Deluxe','Swamp Thing #0–18 + Annual #1 + Animal Man #12, #17')],
  'sword-of-sorcery': [coll('Sword of Sorcery Vol. 1: Amethyst','Trade Paperback','Sword of Sorcery #0–8')],
  'talon': [coll('Talon Vol. 1: Scourge of the Owls','Trade Paperback','Talon #0–7'), coll('Talon Vol. 2: Fall of the Owls','Trade Paperback','Talon #8–17 + Birds of Prey #21')],
  'team-7': [coll('Team 7 Vol. 1: Fight Fire With Fire','Trade Paperback','Team 7 #0–8')],
  'teen-titans-v4': [coll("Teen Titans Vol. 1: It’s Our Right to Fight",'Trade Paperback','Teen Titans #1–7'), coll('Teen Titans Vol. 2: The Culling','Trade Paperback','Teen Titans #8–14 + DC Universe Presents #12'), coll('Teen Titans Vol. 3: Death of the Family','Trade Paperback','Teen Titans #0, #15–17 + Batman #17 + Red Hood #16'), coll('Teen Titans Vol. 4: Light and Dark','Trade Paperback','Teen Titans #18–23'), coll('Teen Titans Vol. 5: The Trial of Kid Flash','Trade Paperback','Teen Titans #24–30 + Annual #2'), coll('The Culling: Rise of the Ravagers','Trade Paperback','Legion Lost #8–9 + Superboy #8–9 + Teen Titans #8–9 + Annual #1')],
  'teen-titans-v5': [coll('Teen Titans Vol. 1: Blinded by the Light','Trade Paperback','Teen Titans #1–7')],
  'the-flash': [coll('The Flash Vol. 1: Move Forward','Hardcover','The Flash #1–8'), coll('The Flash Vol. 2: Rogues Revolution','Hardcover','The Flash #0, #9–12 + Annual #1'), coll('The Flash Vol. 3: Gorilla Warfare','Hardcover','The Flash #13–19'), coll('The Flash Vol. 4: Reverse','Hardcover','The Flash #20–25 + #23.2'), coll('The Flash Vol. 5: History Lessons','Hardcover','The Flash #26–29 + Annual #2'), coll('The Flash Vol. 6: Out of Time','Hardcover','The Flash #30–35 + Annual #3 + Futures End #1'), coll('The Flash Vol. 7: Savage World','Hardcover','The Flash #36–40 + Secret Origins #7 story'), coll('The Flash by Francis Manapul & Brian Buccellato Omnibus','Hardcover / Omnibus','The Flash #0–25 + #23.2')],
  'the-movement': [coll('The Movement Vol. 1: Class Warfare','Trade Paperback','The Movement #1–8'), coll('The Movement Vol. 2: Fighting for the Future','Trade Paperback','The Movement #9–12')],
  'the-ravagers': [coll('The Ravagers Vol. 1: The Kids from N.O.W.H.E.R.E.','Trade Paperback','The Ravagers #1–7'), coll('The Ravagers Vol. 2: Heavenly Destruction','Trade Paperback','The Ravagers #0, #8–12')],
  'the-savage-hawkman': [coll('The Savage Hawkman Vol. 1: Darkness Rising','Trade Paperback','The Savage Hawkman #1–8'), coll('The Savage Hawkman Vol. 2: Wanted','Trade Paperback','The Savage Hawkman #0, #9–20')],
  'trinity-of-sin': [coll('Trinity of Sin Vol. 1: The Wages of Sin','Trade Paperback','Trinity of Sin #1–6')],
  'trinity-of-sin-pandora': [coll('Trinity of Sin: Pandora Vol. 1: The Curse','Trade Paperback','Pandora #1–5 + Justice League #0/#6 backups + FCBD 2012'), coll('Trinity of Sin: Pandora Vol. 2: Choices','Trade Paperback','Pandora #6–14')],
  'trinity-of-sin-phantom-stranger': [coll('Trinity of Sin: The Phantom Stranger Vol. 1: A Stranger Among Us','Trade Paperback','Phantom Stranger #0–5'), coll('Trinity of Sin: The Phantom Stranger Vol. 2: Breach of Faith','Trade Paperback','Phantom Stranger #6–11'), coll('Trinity of Sin: The Phantom Stranger Vol. 3: The Crack in Creation','Trade Paperback','Phantom Stranger #12–22 + Futures End #1')],
  'wonder-woman': [coll('Wonder Woman Vol. 1: Blood','Hardcover','Wonder Woman #1–6'), coll('Wonder Woman Vol. 2: Guts','Hardcover','Wonder Woman #7–12'), coll('Wonder Woman Vol. 3: Iron','Hardcover','Wonder Woman #0, #13–18'), coll('Wonder Woman Vol. 4: War','Hardcover','Wonder Woman #19–23'), coll('Wonder Woman Vol. 5: Flesh','Hardcover','Wonder Woman #24–29 + #23.2'), coll('Wonder Woman Vol. 6: Bones','Hardcover','Wonder Woman #30–35 + Secret Origins #6 story'), coll('Wonder Woman Vol. 7: War Torn','Hardcover','Wonder Woman #36–40 + Annual #1'), coll('Wonder Woman by Brian Azzarello & Cliff Chiang Omnibus','Hardcover / Omnibus','Wonder Woman #0–35 + #23.1 + Secret Origins #6 story')],
  'worlds-finest': [coll('Worlds’ Finest Vol. 1: Lost Daughters of Earth 2','Trade Paperback','Worlds’ Finest #0–5'), coll('Worlds’ Finest Vol. 2: Hunt and Be Hunted','Trade Paperback','Worlds’ Finest #6–12'), coll('Worlds’ Finest Vol. 3: Control Issues','Trade Paperback','Worlds’ Finest #13–18'), coll('Worlds’ Finest Vol. 4: First Contact','Trade Paperback','Worlds’ Finest #19–21 + Annual #1 + Batman/Superman #8–9'), coll('Worlds’ Finest Vol. 5: Homeward Bound','Trade Paperback','Worlds’ Finest #22–26 + Futures End #1'), coll('Worlds’ Finest Vol. 6: The Secret History of Superman and Batman','Trade Paperback','Worlds’ Finest #27–32')],
  'voodoo': [coll('Voodoo Vol. 1: What Lies Beneath','Trade Paperback','Voodoo #1–6'), coll('Voodoo Vol. 2: The Killer in Me','Trade Paperback','Voodoo #0, #7–12')],
};


// Research metadata for EVERY mapped run.  Issue coverage is the publication record;
// collections are a separate layer and may legitimately be empty when no verified
// collected edition exists. This prevents the UI from implying that an uncollected
// run has a TPB/HC/Omnibus.
const runMeta = {
  'justice-league': ['2011–2016','0–52 + Annuals 1–3','Core Earth-0 team; #41–52 continued through the pre-Rebirth transition.'],
  'justice-league-of-america': ['2013–2015','1–14 + Villains Month 7.1–7.4','Third-wave JLA run; Trinity War and Forever Evil connective material.'],
  'justice-league-dark': ['2011–2015','0–40 + Annuals 1–2 + 23.1–23.2','Supernatural team; Trinity War and Blight.'],
  'justice-league-international': ['2011–2012','1–12 + Annual 1','Early New 52 team run.'],
  'justice-league-united': ['2014–2015','0–16 + Annual 1','Canada/Legion/cosmic team; Infinitus and Futures End.'],
  'justice-league-of-americas-vibe': ['2013–2013','1–10','Vibe spin-off.'], 'katana':['2013–2013','1–10','Fourth-wave solo series.'],
  'fury-of-firestorm':['2011–2013','0–20','Firestorm run; title changed to The Fury of Firestorm: The Nuclear Man from #13.'],
  'aquaman':['2011–2016','0–52 + Annuals / Villains Month','Geoff Johns/Jeff Parker era; Throne of Atlantis and later arcs.'],
  'aquaman-and-the-others':['2014–2015','1–11','Aquaman spin-off.'], 'the-flash':['2011–2016','0–52 + Annuals','Barry Allen run; later issues bridge into Rebirth.'],
  'green-arrow':['2011–2016','0–52','Oliver Queen run; continued through the pre-Rebirth period.'], 'wonder-woman':['2011–2016','0–52 + Annuals','Azzarello/Chiang run and continuation.'],
  'captain-atom':['2011–2012','1–12','First-wave series.'], 'mister-terrific':['2011–2012','1–8','First-wave series.'], 'savage-hawkman':['2011–2013','0–20','First-wave series.'],
  'dc-universe-presents':['2011–2015','0–19','Anthology/spotlight series with rotating characters.'], 'earth-2':['2012–2015','0–32 + Annuals 1–2','Parallel Earth-2 series.'],
  'worlds-finest':['2012–2015','0–32 + Annual 1','Earth-2 characters Huntress/Power Girl; later Earth-2-connected.'], 'secret-origins':['2014–2015','1–11','Rotating character origin anthology.'],
  'justice-league-3000':['2013–2015','1–15','Far-future team series; continued as Justice League 3001.'],
  'batman':['2011–2016','0–52 + Annuals 1–3 + 23.1–23.4','Snyder/Capullo flagship; Court of Owls, Death of the Family, Zero Year, Endgame.'],
  'detective-comics':['2011–2016','0–52 + Annuals 1–3 + 23.1–23.4','Parallel Batman publication; separate from Batman.'], 'batman-and-robin':['2011–2015','0–40 + Annuals 1–3','Tomasi/Gleason Damian Wayne era.'],
  'batman-dark-knight':['2011–2014','0–29 + Annual 1 + 23.1–23.4','Separate Dark Knight series.'], 'batman-incorporated':['2012–2013','0–13 + Special 1','Morrison Leviathan finale.'],
  'batman-eternal':['2014–2015','1–52','Main continuity weekly Batman maxiseries.'], 'nightwing':['2011–2014','0–30 + Annual 1','Dick Grayson solo run.'], 'grayson':['2014–2016','1–20 + Annual 1 + Futures End','Spyral era; continues from Forever Evil.'],
  'batgirl':['2011–2015','0–40 + Annuals 1–2','Barbara Gordon run; Burnside begins at #35.'], 'batwoman':['2011–2015','0–40 + Annual 1','Kate Kane run.'], 'catwoman':['2011–2016','0–52 + Annuals 1–2','Selina Kyle run.'],
  'red-hood-outlaws':['2011–2015','0–40 + Annuals 1–2','Jason Todd/Roy Harper/Starfire run.'], 'birds-of-prey':['2011–2014','0–34','Team run; Futures End one-shot.'],
  'batwing':['2011–2014','0–34','David Zavimbe/Luke Fox run.'], 'talon':['2012–2014','0–17','Court of Owls spin-off.'], 'gotham-academy':['2014–2015','1–18 + Endgame','Gotham teen series; Second Semester continues after New 52 branding.'],
  'arkham-manor':['2014–2015','1–6 + Endgame','Limited Gotham series.'], 'gotham-by-midnight':['2014–2015','1–12','Horror/Gotham supernatural series.'], 'harley-quinn':['2013–2016','0–30 + Annuals / specials','Conner/Palmiotti run; continued through the transition.'],
  'action-comics':['2011–2016','0–52 + Annuals / 23.1–23.4','Morrison-to-Pak Superman publication.'], 'superman':['2011–2016','0–52 + Annuals / 23.1–23.4','Main Superman solo publication.'],
  'supergirl':['2011–2016','0–40 + Futures End / 23.1–23.4','Kara run; Red Daughter of Krypton crossover.'], 'superboy':['2011–2014','0–34 + Annual 1','Superboy run; Futures End.'],
  'batman-superman':['2013–2016','1–32 + Annuals 1–3 + Futures End','Shared Batman/Superman series; continued after New 52 branding.'], 'superman-wonder-woman':['2013–2016','1–29 + Annuals 1–2 + Futures End','Relationship/team-up title.'],
  'superman-unchained':['2013–2014','1–9','Snyder/Lee limited series.'], 'green-lantern':['2011–2016','0–52 + Annuals 1–3 + 23.1–23.4','Johns-to-Venditti Lantern flagship.'],
  'green-lantern-corps':['2011–2015','0–40 + Annuals 1–2','Corps title; Uprising.'], 'green-lantern-new-guardians':['2011–2015','0–40 + Annuals 1–2','Kyle Rayner/Emotional Spectrum line.'],
  'red-lanterns':['2011–2015','0–40 + Annual 1','Atrocitus/Guy Gardner line.'], 'larfleeze':['2013–2014','1–12','Orange Lantern spin-off.'], 'sinestro':['2014–2016','1–23 + Annual 1','Post-Forever Evil Sinestro Corps series.'],
  'blue-beetle':['2011–2013','0–16','Jaime Reyes run.'], 'hawk-dove':['2011–2012','1–8','Short first-wave series.'], 'legion-lost':['2011–2013','0–16','Legion spin-off.'],
  'legion-of-super-heroes':['2011–2013','0–23','Far-future Legion series.'], 'static-shock':['2011–2012','1–8','Short first-wave series.'], 'teen-titans-v4':['2011–2014','0–30 + Annuals 1–3','First New 52 Teen Titans run.'],
  'teen-titans-v5':['2014–2015','1–8 + Annual 1','Relaunch continuing the same continuity.'], 'ravagers':['2012–2013','0–12','Culling spin-off.'],
  'all-star-western':['2011–2014','0–34','Jonah Hex/Gotham western.'], 'blackhawks':['2011–2012','1–8','War/aviation series.'], 'deathstroke-v2':['2011–2013','0–20','First Deathstroke New 52 run.'],
  'deathstroke-v3':['2014–2015','1–6','Late New 52 relaunch.'], 'gi-combat':['2012','0–7','War That Time Forgot framing series.'], 'grifter':['2011–2013','0–16','WildStorm character integrated into New 52.'],
  'infinity-man-forever-people':['2014–2015','1–9','Fourth World/Edge series.'], 'lobo':['2014–2015','1–6','Late New 52 mini/ongoing.'], 'men-of-war':['2011–2012','1–8','War anthology/series.'],
  'new-suicide-squad':['2014–2015','1–8','Second Suicide Squad series.'], 'omac':['2011–2012','1–8','First-wave series.'], 'secret-six':['2014–2015','1–14','14-issue New 52/DC You transition-era run; collected in two trade paperbacks.'],
  'star-spangled-war-stories':['2014–2015','1–8','G.I. Zombie war series.'], 'stormwatch':['2011–2014','0–30','WildStorm team integrated into New 52.'], 'suicide-squad':['2011–2014','0–30','Task Force X first New 52 run.'],
  'team-7':['2012–2013','0–8','WildStorm/government team.'], 'green-team':['2013–2014','1–8','Teen Trillionaires limited ongoing.'], 'the-movement':['2013–2014','1–12','Gail Simone series.'],
  'threshold':['2013','1–8','Cosmic series spun out of New Guardians/Blue Beetle material.'], 'voodoo':['2011–2012','0–12','WildStorm character solo.'], 'animal-man':['2011–2014','0–29 + Annuals 1–2','Jeff Lemire run; Rotworld.'],
  'demon-knights':['2011–2013','0–23','Historical fantasy series.'], 'dial-h':['2012–2013','0–15 + Dial E #1','China Miéville series.'], 'constantine':['2013–2015','1–23','New 52 Constantine solo.'],
  'frankenstein-agent-shade':['2011–2013','0–16','S.H.A.D.E. series.'], 'i-vampire':['2011–2013','0–19','Vampire/horror series.'], 'klarion':['2014–2015','1–6','Late New 52 mini.'],
  'resurrection-man':['2011–2012','0–12','First-wave supernatural series.'], 'swamp-thing':['2011–2015','0–40 + Annuals 1–3','Snyder-to-Soule Swamp Thing run; Rotworld.'], 'sword-of-sorcery':['2012–2013','0–8','Amethyst-led series.'],
  'trinity-of-sin':['2014–2015','1–6','Pandora/Phantom Stranger continuation.'], 'trinity-of-sin-pandora':['2013–2014','1–14','Trinity War-linked Pandora series.'], 'trinity-of-sin-phantom-stranger':['2012–2014','0–22 + Futures End','Retitled Phantom Stranger series.'],
};

// Correct the publication issue ranges and attach one canonical run record to every ongoing series.
for (const [id, [years, coverage, notes]] of Object.entries(runMeta)) {
  const s = new52Series.find(x => x.id === id);
  if (!s) continue;
  s.runYears = years; s.issueCoverage = coverage; s.runNotes = notes;
  s.runs = [{ id: `${id}-run`, title: s.title, years, issueCoverage: coverage, notes }];
}
for (const s of new52Series) {
  const cov = s.issueCoverage || '';
  const range = cov.match(/(\d+)–(\d+)/);
  if (range) {
    const from = Number(range[1]), to = Number(range[2]);
    const out = [];
    for (let n=from; n<=to; n++) out.push(String(n));
    const decimals = [...cov.matchAll(/(\d+)\.(\d+)/g)].map(m=>`${m[1]}.${m[2]}`);
    out.push(...decimals.filter(x=>!out.includes(x)));
    const annualMatch = cov.match(/Annuals?(?:\s+)(\d+)(?:[–-](\d+))?/i);
    if (annualMatch) {
      const a=Number(annualMatch[1]), b=Number(annualMatch[2]||annualMatch[1]);
      for(let n=a;n<=b;n++) out.push(`Annual #${n}`);
    }
    s.issues=out; s.issueCount=out.length;
  }
}
for (const s of new52Series) {
  if (!s.runs.length) s.runs = [{id:`${s.id}-run`, title:s.title, years:'New 52 era', issueCoverage:s.issues.join(', '), notes:s.notes}];
  s.collections = collectionIndex[s.id] || [];
  s.collectionStatus = s.collections.length ? 'verified-editions-listed' : 'no-verified-edition-record-in-current-research-index';
}



const limitedCollections = {
  'huntress':[coll('Huntress: Crossbow at the Crossroads','Trade Paperback','Huntress #1–6')],
  'penguin-pain-prejudice':[coll('Penguin: Pain and Prejudice','Trade Paperback','Penguin: Pain and Prejudice #1–5')],
  'forever-evil':[coll('Forever Evil','Hardcover','Forever Evil #1–7')],
  'forever-evil-argus':[coll('Forever Evil: A.R.G.U.S.','Trade Paperback','A.R.G.U.S. #1–6')],
  'arkham-war':[coll('Forever Evil: Arkham War','Trade Paperback','Arkham War #1–6 + Batman #23.4 + Aftermath #1')],
  'rogues-rebellion':[coll('Forever Evil: Rogues Rebellion','Trade Paperback','Rogues Rebellion #1–6 + The Flash #23.1')],
  'futures-end':[coll('The New 52: Futures End Vol. 1','Trade Paperback','Futures End #0–17'),coll('The New 52: Futures End Vol. 2','Trade Paperback','Futures End #18–30'),coll('The New 52: Futures End Vol. 3','Trade Paperback','Futures End #31–48'),coll('Futures End: Five Years Later Omnibus','Hardcover / Omnibus','Futures End weekly series + September 2014 Futures End specials')],
  'earth2-worlds-end':[coll("Earth 2: World's End Vol. 1",'Trade Paperback',"Earth 2: World's End #1–11"),coll("Earth 2: World's End Vol. 2",'Trade Paperback',"Earth 2: World's End #12–26")],
  'the-multiversity':[coll('The Multiversity Deluxe Edition','Hardcover / Deluxe','All issues of The Multiversity')],
  'convergence':[coll('Convergence','Hardcover','Convergence #0–8')],
  'human-bomb':[coll('Human Bomb','Trade Paperback','Human Bomb #1–4')],
  'legion-secret-origin':[coll('Legion: Secret Origin','Trade Paperback','Legion: Secret Origin #1–6')],
  'night-force':[coll('Night Force','Trade Paperback','Night Force #1–7')],
  'the-ray':[coll('The Ray','Trade Paperback','The Ray #1–4')],
  'the-shade':[coll('The Shade','Trade Paperback','The Shade #1–12')],
  'damian-son-of-batman':[coll('Damian: Son of Batman','Trade Paperback','Damian: Son of Batman #1–4 + Batman #666'), coll('Damian: Son of Batman Deluxe Edition','Hardcover / Deluxe','Damian: Son of Batman #1–4 + Batman #666')],
  'batman-robin-eternal':[coll('Batman and Robin Eternal Vol. 1','Trade Paperback','Batman and Robin Eternal #1–12 + Batman: Endgame Special Edition #1 eight-page story'), coll('Batman and Robin Eternal Vol. 2','Trade Paperback','Batman and Robin Eternal #13–26')],
  'batman-beyond-v5':[coll('Batman Beyond Vol. 1: Brave New Worlds','Trade Paperback','Batman Beyond #1–6 + the sneak peek story from Convergence: Batman and the Outsiders #2'), coll('Batman Beyond Vol. 2: City of Yesterday','Trade Paperback','Batman Beyond #7–11'), coll('Batman Beyond Vol. 3: Wired for Death','Trade Paperback','Batman Beyond #12–16 + sneak peek of Batman Beyond: Rebirth #1')],
  'prez-v2':[coll('Prez Vol. 1: Corndog in Chief','Trade Paperback','Prez #1–6 + the Sneak Peek story from Convergence: Batgirl #2'), coll('Prez by Mark Russell and Ben Caldwell: The Deluxe Edition','Hardcover / Deluxe','Prez #1–6 + DC Sneak Peek: Prez #1 + Catwoman: Election Night #1 + Prez: Setting a Dangerous President')],
  'justice-league-3001':[coll('Justice League 3001 Vol. 1: Déjà Vu All Over Again','Trade Paperback','Justice League 3000 #14–15 + Justice League 3001 #1–6 + sneak peek from Convergence: Justice League International #2'), coll('Justice League 3001 Vol. 2: Things Fall Apart','Trade Paperback','Justice League 3001 #7–12')],
};
for (const s of new52Limited) { s.collections=limitedCollections[s.id]||[]; s.collectionStatus=s.collections.length?'verified-editions-listed':'no-verified-edition-record-in-current-research-index'; s.runs=[{id:`${s.id}-run`,title:s.title,years:'New 52 era',issueCoverage:s.issues.map(i=>/^\d/.test(i)?`#${i}`:i).join(', '),notes:s.notes||''}]; }

export const new52ResearchSummary = {
  ongoingSeries: new52Series.length,
  limitedSeries: new52Limited.length,
  oneShots: new52OneShots.length,
  seriesWithEditionRecords: new52Series.filter(s=>s.collections.length).length,
  seriesWithoutEditionRecords: new52Series.filter(s=>!s.collections.length).length,
  issueAndRunData: new52Series.filter(s=>s.runs.length && s.issues.length).length,
  editionPolicy: 'Only researched collected editions are listed. A missing edition record is not treated as evidence that the book was never collected.'
};

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


/* -------------------------------------------------------------------------
 * NEW 52 EXPLORE INDEX
 * -------------------------------------------------------------------------
 * The Comics landing, Character browser, Continuity/Era browser and Reading
 * Paths use this same research dataset as the Story Map.  These are curated
 * navigation indexes, not a second copy of issue/edition data: every series
 * entry resolves back to new52Series/new52Limited above.
 */
export const new52CharacterIndex = [
  {id:'batman', title:'Batman', sub:'Batman, Gotham and the Bat-family', seriesIds:['batman','detective-comics','batman-and-robin','batman-dark-knight','batman-incorporated','batman-eternal','nightwing','grayson','batgirl','batwoman','catwoman','red-hood-outlaws','birds-of-prey','batwing','talon','gotham-academy','arkham-manor','harley-quinn']},
  {id:'superman', title:'Superman', sub:'Superman Family and the Kryptonian line', seriesIds:['action-comics','superman','supergirl','superboy','batman-superman','superman-wonder-woman','superman-unchained']},
  {id:'justice-league', title:'Justice League', sub:'Core DC team books and universe spine', seriesIds:['justice-league','justice-league-of-america','justice-league-international','justice-league-united','justice-league-of-americas-vibe','aquaman','aquaman-and-the-others','the-flash','green-arrow','wonder-woman','captain-atom','mister-terrific','savage-hawkman','dc-universe-presents']},
  {id:'green-lantern', title:'Green Lantern', sub:'Lantern Corps and emotional-spectrum books', seriesIds:['green-lantern','green-lantern-corps','green-lantern-new-guardians','red-lanterns','larfleeze','sinestro']},
  {id:'flash', title:'The Flash', sub:'Barry Allen and Flash-connected events', seriesIds:['the-flash']},
  {id:'aquaman', title:'Aquaman', sub:'Aquaman and the Others', seriesIds:['aquaman','aquaman-and-the-others']},
  {id:'wonder-woman', title:'Wonder Woman', sub:'Diana and the Wonder Woman line', seriesIds:['wonder-woman']},
  {id:'green-arrow', title:'Green Arrow', sub:'Oliver Queen and the Justice League orbit', seriesIds:['green-arrow']},
  {id:'teen-titans', title:'Teen Titans', sub:'Titans, young heroes and connected teams', seriesIds:['teen-titans-v4','teen-titans-v5','blue-beetle','hawk-dove','ravagers']},
  {id:'legion', title:'Legion of Super-Heroes', sub:'Legion and far-future branches', seriesIds:['legion-lost','legion-of-super-heroes','justice-league-3000']},
  {id:'swamp-thing', title:'Swamp Thing', sub:'The Green, Rotworld and the supernatural line', seriesIds:['swamp-thing','animal-man','justice-league-dark','gotham-by-midnight']},
  {id:'suicide-squad', title:'Suicide Squad', sub:'Task Force X and government/black-ops books', seriesIds:['suicide-squad','new-suicide-squad','team-7','stormwatch']},
  {id:'harley-quinn', title:'Harley Quinn', sub:'Harley’s New 52 launch and Gotham orbit', seriesIds:['harley-quinn']},
  {id:'deathstroke', title:'Deathstroke', sub:'Slade Wilson and the Edge line', seriesIds:['deathstroke-v2','deathstroke-v3']},
  {id:'supernatural', title:'Dark / Supernatural', sub:'Occult and horror books across the New 52', seriesIds:['justice-league-dark','animal-man','demon-knights','dial-h','constantine','frankenstein-agent-shade','i-vampire','klarion','resurrection-man','swamp-thing','sword-of-sorcery','trinity-of-sin','trinity-of-sin-pandora','trinity-of-sin-phantom-stranger']},
];



/* -------------------------------------------------------------------------
 * CHARACTER HUBS — presentation index only; series/issues/editions stay in
 * new52Series/new52Limited above. A hub is a navigation lens, not a second
 * catalogue. Flagship characters are individual destinations; supporting
 * characters are grouped into the logical family/team they belong to.
 * ------------------------------------------------------------------------- */
const n52Ids = ids => ids.filter(Boolean);
export const new52CharacterHubs = [
  {id:'batman',type:'hero',title:'Batman',sub:'The flagship Gotham line and its core Batman publications.',seriesIds:n52Ids(['batman','detective-comics','batman-and-robin','batman-dark-knight','batman-incorporated','batman-eternal'])},
  {id:'superman',type:'hero',title:'Superman',sub:'The core Superman line, including the major cross-family books.',seriesIds:n52Ids(['action-comics','superman','batman-superman','superman-wonder-woman','superman-unchained'])},
  {id:'wonder-woman',type:'hero',title:'Wonder Woman',sub:'Diana’s New 52 solo run.',seriesIds:['wonder-woman']},
  {id:'flash',type:'hero',title:'The Flash',sub:'Barry Allen’s New 52 run and Flash-connected material.',seriesIds:['the-flash']},
  {id:'green-lantern',type:'hero',title:'Green Lantern',sub:'The Lantern flagship plus the Corps and emotional-spectrum family.',seriesIds:['green-lantern','green-lantern-corps','green-lantern-new-guardians','red-lanterns','larfleeze','sinestro']},
  {id:'aquaman',type:'hero',title:'Aquaman',sub:'Arthur Curry and the connected Others line.',seriesIds:['aquaman','aquaman-and-the-others']},
  {id:'green-arrow',type:'hero',title:'Green Arrow',sub:'Oliver Queen’s New 52 solo run.',seriesIds:['green-arrow']},
  {id:'supergirl',type:'hero',title:'Supergirl',sub:'Kara Zor-El’s standalone New 52 line — kept separate from Superman.',seriesIds:['supergirl']},
  {id:'harley-quinn',type:'hero',title:'Harley Quinn',sub:'Harley’s New 52 breakout solo line and specials.',seriesIds:['harley-quinn']},
  {id:'swamp-thing',type:'hero',title:'Swamp Thing',sub:'Alec Holland, the Green and the Rotworld branch.',seriesIds:['swamp-thing']},
  {id:'constantine',type:'hero',title:'Constantine',sub:'John Constantine’s New 52 solo line and supernatural crossover orbit.',seriesIds:['constantine']},
  {id:'deathstroke',type:'hero',title:'Deathstroke',sub:'Slade Wilson’s New 52 runs.',seriesIds:['deathstroke-v2','deathstroke-v3']},
  {id:'blue-beetle',type:'hero',title:'Blue Beetle',sub:'Jaime Reyes’ New 52 solo run.',seriesIds:['blue-beetle']},
  {id:'bat-family',type:'group',title:'Bat-Family',sub:'The rest of Gotham’s major standalone publications, kept together without merging their runs.',seriesIds:['nightwing','grayson','batgirl','batwoman','catwoman','red-hood-outlaws','birds-of-prey','batwing','talon','gotham-academy','arkham-manor','gotham-by-midnight','damian-son-of-batman','penguin-pain-prejudice']},
  {id:'superman-family',type:'group',title:'Superman Family',sub:'Supporting Kryptonian and Superman-adjacent books, excluding Superman and Supergirl themselves.',seriesIds:['superboy','batman-superman','superman-wonder-woman','superman-unchained']},
  {id:'justice-league',type:'group',title:'Justice League & Core Teams',sub:'League books and the central shared-universe team network.',seriesIds:['justice-league','justice-league-of-america','justice-league-international','justice-league-united','justice-league-of-americas-vibe','katana','fury-of-firestorm','mister-terrific','savage-hawkman','dc-universe-presents']},
  {id:'lantern-corps',type:'group',title:'Lantern Corps & Spectrum',sub:'Corps, emotional-spectrum and Lantern-adjacent publications.',seriesIds:['green-lantern-corps','green-lantern-new-guardians','red-lanterns','larfleeze','sinestro','threshold']},
  {id:'titans-young-heroes',type:'group',title:'Titans & Young Heroes',sub:'Teen Titans, Legion, Blue Beetle, Hawk & Dove and the younger-hero branch.',seriesIds:['teen-titans-v4','teen-titans-v5','legion-lost','legion-of-super-heroes','blue-beetle','hawk-dove','static-shock','ravagers','legion-secret-origin']},
  {id:'dark-supernatural',type:'group',title:'Dark & Supernatural',sub:'Justice League Dark, horror, magic, the Green and occult books.',seriesIds:['justice-league-dark','animal-man','demon-knights','dial-h','frankenstein-agent-shade','i-vampire','klarion','resurrection-man','sword-of-sorcery','trinity-of-sin','trinity-of-sin-pandora','trinity-of-sin-phantom-stranger','night-force','my-greatest-adventure','the-shade']},
  {id:'suicide-squad-government',type:'group',title:'Suicide Squad & Government',sub:'Task Force X, black-ops, government and covert-team books.',seriesIds:['suicide-squad','new-suicide-squad','team-7','stormwatch','the-movement','green-team']},
  {id:'cosmic-edge',type:'group',title:'Cosmic, Edge & WildStorm',sub:'Fourth World, war, science-fiction and WildStorm-integrated publications.',seriesIds:['all-star-western','blackhawks','deathstroke-v2','deathstroke-v3','gi-combat','grifter','infinity-man-forever-people','lobo','men-of-war','omac','star-spangled-war-stories','voodoo','human-bomb','phantom-lady-doll-man','the-ray']},
  {id:'multiverse',type:'group',title:'Alternate Earths & Multiverse',sub:'Earth-2, Worlds’ Finest, Multiversity and parallel-world material.',seriesIds:['earth-2','worlds-finest','huntress','the-multiversity','earth2-worlds-end','convergence']},
  {id:'future-bridge',type:'group',title:'Future & Continuation',sub:'Futures End and the late New 52 / DC You bridge toward Rebirth.',seriesIds:['futures-end','justice-league-3000','batman-robin-eternal','batman-beyond-v5','prez-v2','justice-league-3001']},
];

export function getNew52CharacterHub(id) { return new52CharacterHubs.find(x => x.id === id) || null; }

export const new52ReadingPaths = [
  {id:'new52-core',title:'New 52 Core Event Spine',type:'essential',sub:'Milestone events across the central Earth-0 publishing lanes.',laneIds:['justice','batman','superman','lantern','young','dark','edge'],eventIds:['court-owls','night-of-owls','throne-atlantis','trinity-war','forever-evil','futures-end','darkseid-war']},
  {id:'new52-batman',title:'Batman / Gotham',type:'main_series',sub:'Batman and the parallel Gotham-family series kept as separate publications.',laneIds:['batman'],eventIds:['court-owls','night-of-owls','death-family','robin-rises','endgame']},
  {id:'new52-superman',title:'Superman Family',type:'main_series',sub:'The Superman-family line plus its major crossover spine.',laneIds:['superman'],eventIds:['hel-earth','krypton-returns','doomed']},
  {id:'new52-lantern',title:'Green Lantern / Corps',type:'main_series',sub:'The Lantern books and the major Corps-wide events.',laneIds:['lantern'],eventIds:['rise-third-army','wrath-first-lantern','lights-out','red-daughter','uprising','godhead']},
  {id:'new52-dark',title:'Dark / Supernatural',type:'main_series',sub:'The supernatural line and its crossovers.',laneIds:['dark'],eventIds:['rotworld','trinity-war','blight']},
  {id:'new52-complete',title:'New 52 Crossover Spine',type:'event_crossover',sub:'Major connective events across the New 52 publication lanes.',laneIds:[],eventIds:['court-owls','night-of-owls','death-family','throne-atlantis','rotworld','hel-earth','rise-third-army','wrath-first-lantern','lights-out','trinity-war','forever-evil','blight','krypton-returns','doomed','red-daughter','uprising','futures-end','godhead','robin-rises','endgame','darkseid-war','multiversity','convergence']},
];

export function getNew52SeriesByIds(ids=[]) {
  const wanted = new Set(ids);
  return [...new52Series, ...new52Limited].filter(s => wanted.has(s.id));
}

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
