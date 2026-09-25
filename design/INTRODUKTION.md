# Eco Loco — Mellan · introduktion / tutorial

*Förslag och riktningar för en interaktiv introduktion som lär ut Eco Loco genom att man GÖR. Underlag att bygga vidare på — inga beslut låsta. Skrivet 2026-09-25 utifrån SPELINFO.md, engine.js, ui.js/spel.html samt referens från syskonstationerna `forhandlingen` och `minnestest` (delad station-kit-onboarding). Ändrar inte reglerna.*

---

## 1. Utgångsläge (vad vi vet)

**Problemet.** Spelet har idag ingen tutorial — bara en startruta med tre snabbrutor (Bygg / Byt / Rösta) och en STARTA-knapp. Från originalspelet är tre saker kända som gick fel:

1. **Röstningen** förstods inte.
2. **För mycket text** överlag.
3. **Beroendet** — att man *måste* byta för att man bara tjänar en valuta — gick många förbi tills det var för sent.

**Det etablerade uppslaget.** En "fäll-reveal" runda 0: alla lockas köpa det lönsamma valet, upptäcker att de saknar den andra valutan, och polletten trillar ner — *man måste byta med de andra*. Arkitekturen stödjer redan `config.mode = 'tutorial' | 'selfplay' | 'gm'`. Designprincip: progressiv exponering — visa bara det som behövs just nu, en handling i taget, igenkänning framför minne.

**Vad introt måste klara samtidigt.** En ensam spelare (mot tre datorlag) *och* fyra bänkar parallellt. Spontanbesökare *och* skolgrupp med lärare. Touch, svenska, minimal text, låg tröskel, självfaciliterande.

**Vad introt INTE ska lova.** Balansen är inte klar (pengarsektorn dominerar; överlevnad är binär). Introt ska alltså inte lova "rättvist" eller "räddningen är nära" — men kärnbudskapet står fast: *billigt skadar ön; du behöver de andra.*

---

## 2. Vad syskonstationerna redan gör (och som vi ska låna)

`forhandlingen` och `minnestest` delar ett `station-kit` med ett genomarbetat onboarding-mönster. Eco Loco (Mellan) ligger i en annan kodbas (vanilla JS, ingen Vue/kit), så vi lånar **mönstret och pedagogiken**, inte koden. Det viktigaste att ta med:

**A. "Overview-popups" — hur-man-vinner i tre animerade scener** (`onboarding/opening/OverviewPopups.vue`).
Minimal text (en rad per scen), tung visuell förklaring, och — avgörande — **återanvänder spelets egna animationsvokabulär** (resurskort, stämplar, kapitalräknare som tickar, ×2). Varje scen lär ut *ett* begrepp via **kontrast**: SÄKRAD vs 0 POÄNG, snål vs slösig. Prick-rad ("dots") visar hur många steg som återstår.
→ *För oss:* samma idé men med Eco Locos vokabulär — ö-mätaren som rör sig, byggnad som droppar på slot, mynt/tegel som flyger, 👑/⚠.

**B. Interfolierat "hör → gör" med barriärer** (`onboarding/Onboarding.vue`, `blocks.ts`).
Sekvensen är inte "läs allt, spela sen". Den varvar korta ljudblock med **riktiga övningsrundor på det riktiga UI:t** med popupar ovanpå: Block 1 → Test 1 → Block 2 → Test 2 → Test 3 → live. Testerna görs i egen takt; en **barriär** ("väntar på andra valvet") gatar nästa steg tills alla är klara. Progressionen är medvetet stegrad: Test 1 = 1 resurs/enkelt, Test 2 = fullt, Test 3 = låst utan feedback (självständigt).
→ *För oss:* exakt den progressionen passar Eco Locos rundor. Övningsrunda(-or) på skarpa UI:t, coach-marks som popupar, barriär mellan bänkar.

**C. Beat-motorn per moment** (`minnestest/StepCycle.vue`).
Ett moment körs som en kedja av *beats*: situation → nedräkning → gör → analys → svar. Uppgiften står **stor och tydlig hela tiden**; kontext litet ovanför. Nedräkning med "▸ REDO"-knapp innan tidspress. "Hoppa över"-knapp i pilotläge.
→ *För oss:* varje tutorial-steg är en beat med samma anatomi — visa, låt göra, bekräfta direkt.

**D. Två speglade demo-lägen** (`intro/SettleDemo.vue`, `IntroStage.vue`).
Demona **speglar det riktiga UI:t** och auto-spelar manusets klick, så det man ser i demon är exakt det man strax gör själv. Illustrationer tajmas mot `elapsed` sedan cue-start.
→ *För oss:* när vi *visar* ett byggval eller ett byte, visa det på en kopia av den riktiga handen/bytesmodalen — inte en separat "instruktionsbild".

**E. Tillgänglighet inbyggt.** Genomgående `prefers-reduced-motion` (animationer av, slutläge syns ändå), SFX vid nyckel-beats, korta ord + piktogram.
→ *För oss:* samma krav; Eco Loco har redav ljud och emoji-piktogram att haka i.

---

## 3. Alla moment — checklista med "så lär vi ut det genom att göra"

Varje mekanik i spelet, dess svårighetsgrad, och den DOING-baserade lärvägen. Detta är kartan tutorialen ska täcka.

| # | Moment | Svårt? | Vanligt missförstånd | Lär ut genom att GÖRA |
|---|---|---|---|---|
| 1 | **Din ö-del & färg** (lag = område = färg) | Lätt | — | Kartan zoomar till ditt hörn, loggan droppar. "Det här är ditt." Ett tryck. |
| 2 | **De tre valen** (smutsig/standard/grön: kostar / ger / öhälsa) | Medel | Ser bara priset, inte ö-effekten | Handen tänds, allt annat dimmas. Tryck ett kort → det expanderar och visar kostar/ger/ön. Bygg det. Byggnaden droppar + ljud. |
| 3 | **Beroendet** (du gör en valuta, behöver den andra) | **Svårast** | "Jag har ju pengar" tills de tar slut | Iscensätt väggen: nästa bygge kräver valutan du *inte* gör → kortet visar "saknar X → BYT". Coach-mark pekar. Tvinga fram ett byte. |
| 4 | **Byteshandel** (fritt, valfri kurs) | Medel | Vet inte vem som har det man behöver | Bytesmodalen öppnas förvald mot rätt lag (den som gör din bristvaluta). Gör bytet, se båda staplarna röra sig. |
| 5 | **Bokslut / ö-mätaren** (privat vinst, delad nota) | Medel | Kopplar inte eget bygge till öns fall | Efter bygget: mätaren rör sig med delta-pil, inkomst tickar in. Kontrast-beat: "smutsigt gav dig +8 🧱 men ön −4". |
| 6 | **Katastrof-zonen** (öhälsa <30 → alla förlorar 10+10) | Lätt | Ser rött som "lite dåligt" | Visas bäst *när* det händer i skarpt spel; i introt räcker en rad + röd overlay-glimt. |
| 7 | **Politik / röstning** (ett förslag/runda, 3 av 4 JA) | **Svårast** | Vad räknas? Vad händer? Friåkarproblemet | Egen beat: ett förslag poppar, du röstar JA/NEJ, en tydlig 4-pricks-tally fylls, utfallet slår direkt (öhälsa upp / skatt dras). |
| 8 | **Registren** (💰 Börsen, 🏭 Klimatregistret, 👑/⚠) | Lätt | Missar att de är kopplade | Peka en gång när första 👑/⚠ dyker upp: "rikast" resp. "värsta boven". |
| 9 | **Vinstvillkoret** (öhälsa ≥60 → rikast vinner; annars alla förlorar) | Medel | Tror "rikast vinner" utan villkoret | Avslutande kontrast-scen: rik + död ö = du förlorar ändå. |
| 10 | **Årsberättelsen** (dina val, ditt avtryck) | Lätt | — | Nämns i förbifarten; upptäcks vid behov. |

**Två moment bär hela introt: #3 (beroendet) och #7 (röstningen).** Historiskt de som floppade. Introt ska ge båda en *egen DOING-beat* där man inte kan gå vidare utan att ha gjort handlingen — inte bara läst om den.

---

## 4. Referenser — hur andra lär ut genom att göra

Grupperat efter den lärdom vi kan stjäla. (Korta, konkreta — för att motivera valen i avsnitt 5.)

**Tutorial-runda / guidad första omgång**
- **Pandemic / Catan (digitala versioner):** första partiet är en "guided game" där appen föreslår draget och förklarar *varför* precis när det blir relevant. Lärdom: lär ut i spelets eget tempo, inte i en meny före.
- **Overcooked:** en lugn övningsbana utan tidspress innan det skarpa kaoset. Lärdom: sänk en variabel (här: timern/tävlingen) i övningsrundan.
- **Into the Breach:** "tutorial" *är* en riktig, vinnbar första strid med begränsade brickor. Lärdom: låt övningen vara riktigt spel, inte en sandlåda.

**Lär genom design, nästan utan text**
- **Super Mario Bros 1-1 (Miyamoto):** första skärmen lär ut hopp, fiende och belöning utan ett ord, genom att arrangera situationen. Lärdom: arrangera väggen (moment #3) så insikten uppstår av sig själv.
- **Portal:** varje kammare introducerar en mekanik isolerat, sen i kombination. Lärdom: ett begrepp i taget, bygg ovanpå.
- **Threes / Monument Valley:** rör en bricka, se vad som händer, texten kommer efter handlingen. Lärdom: **gör först, förklara sen** (samma som Duolingo).

**Beroende / måste-samarbeta (mest relevant för #3–4)**
- **Catan:** hela spelet lever på att du saknar en resurs och måste byta. Digitala Catan lär ut det genom att blockera bygget och peka mot handeln — exakt vår "saknar X → BYT". Lärdom: gör bristen synlig *på kortet* i byggögonblicket.
- **Keep Talking and Nobody Explodes:** asymmetrisk info tvingar prat. Lärdom: om vi vill ha förhandling mellan bänkar, göm något så samtal krävs.

**Allmänningens dilemma (kärnan, #5 + #9)**
- **Fishbanks (Meadows, klassisk allmännings-simulering — nämns redan i SPELINFO):** deltagarna *upplever* överfiske innan de får teorin. Lärdom: låt introt visa den delade mätaren falla av privata val innan vi sätter ord på "allmänningens dilemma".
- **Plague Inc / Reigns:** en enkel gest (svep/tryck) och en mätare som svarar direkt lär ut ett helt system. Lärdom: en handling → en synlig systemreaktion, varje gång.

**Röstning / socialt beslut (#7)**
- **Codenames / Just One:** reglerna lärs på en runda med facit framme. Lärdom: kör en riktig röstning med tally synlig och omedelbart utfall.
- **Democracy / parlaments-spel:** visar rösträkningen som fysiska marker som fylls. Lärdom: "3 av 4"-tröskeln ska *synas* som fyra prickar, inte stå i text.

**Syskonstationerna (samma hus, samma målgrupp)**
- **`forhandlingen`:** overview-popups + hör-gör-block + barriär (avsnitt 2). Den närmaste och mest direkt återanvändbara referensen.
- **`minnestest`:** beat-motorn (situation → nedräkning → gör → svar) och "uppgiften stor hela tiden".

---

## 5. Förslag — tre spår, ett rekommenderat

Tre sätt att bygga introt, i stigande ambition. De utesluter inte varandra — C är A+B ihop.

### Spår A — "Coach-marks under skarp runda 1" (lättast, minst kod)
Ingen separat tutorial. Runda 1 spelas på riktigt men med **coach-marks**: dimma allt utom det aktuella, en bubbla pekar ("Välj ett kort", "Nu: avsluta omgången"), tona bort efter handlingen. Timern startar först efter första bygget.
- **För:** billigast; ingen ny state-maskin; man lär sig på riktiga data.
- **Emot:** svårt att *garantera* att beroendet (#3) och röstningen (#7) inträffar runda 1 — de är delvis slump/bot-drivna. Riskerar att missa just de två svåra momenten.
- **Bäst för:** skolgrupp med lärare som ändå ramar in.

### Spår B — "Fäll-reveal tutorial-runda 0" (det etablerade uppslaget)
En separat, skriptad runda 0 (`config.mode='tutorial'`) där allt är iscensatt: väggen (#3) och en röstning (#7) *garanterat* inträffar, timern av, botarna spelar förutsägbart. Sen "nu på riktigt — runda 1".
- **För:** vi kontrollerar att varje svårt moment upplevs; trygg och förutsägbar; funkar solo och lika för alla bänkar.
- **Emot:** en "extra" runda före det riktiga; risk att kännas som läxa om den blir för lång. Måste hållas kort (~90–120 s).
- **Bäst för:** spontanbesökare utan facilitator.

### Spår C — **REKOMMENDERAT: kort overview + iscensatt runda 0 + coach-marks som klingar av**
Kombinationen, byggd på syskonstationernas mönster:

1. **Titel + "din ö-del"** (5 s, ett tryck) — kartan zoomar till ditt färgade hörn, loggan droppar. "Du är Åkermark 🦬."
2. **Overview: tre kontrast-scener** (à la `OverviewPopups`, ~10 s, tryck-vidare, prick-rad) — spelets *löfte*, inte reglerna:
   - Scen 1 — **Billigt lönar sig … men ön faller.** Smutsig byggnad droppar → din +8 🧱 tickar upp, ö-mätaren −4 rör sig nedåt. Kontrast på en skärm.
   - Scen 2 — **Du gör bara en valuta.** 🧱 fylls hos dig, 🪙 lyser tomt → pil till de andra lagen. "Den andra byter du till dig."
   - Scen 3 — **Rikast vinner — om ön lever.** 👑 bredvid en grön ö = vinst; 👑 bredvid en död ö = alla förlorar (rött).
3. **Runda 0 — den skarpa övningsrundan** (timer av, botar skriptade). Beats, var och en "gör-gated" (kan ej gå vidare utan handling), coach-mark dimmar allt annat:
   - **Beat B1 — Bygg.** Handen tänds. Tryck ett kort → expanderar (kostar/ger/ön). KÖP. Byggnad droppar + ljud + inkomst tickar. *(moment #2, #5)*
   - **Beat B2 — Väggen & bytet.** Nästa föreslagna bygge kräver 🪙 du inte har → kortet visar "saknar X 🪙 → BYT", coach-mark: "Du gör bara 🧱. Byt till dig 🪙." Bytesmodalen öppnas förvald mot Tundra/Stad. Gör bytet → båda staplar rör sig. *(moment #3, #4 — det historiskt svåraste)*
   - **Beat B3 — Rösta.** Ett förslag poppar (t.ex. 🌱 Grön satsning). Fyra prickar = fyra lag; du trycker JA → prickarna fylls (botar röstar), "3 av 4 ✓" → öhälsa +8 slår direkt. *(moment #7 — det andra svåra)*
   - **Beat B4 — Avsluta & bokslut.** AVSLUTA OMGÅNG (timer-ringen förklaras: "annars sker bokslutet av sig självt"). Mini-bokslut: mätaren rör sig, en award-popup. *(moment #5, #8)*
4. **"Nu kör vi på riktigt — Runda 1."** `mode` växlar till selfplay; coach-marks borta men kan tonas in första gången ett *nytt* moment dyker upp (t.ex. första katastrofen).

- **För:** varje svårt moment upplevs garanterat och i rätt ordning; bygger på beprövat hus-mönster; kort (~2–2,5 min totalt); samma för solo och bänkar.
- **Emot:** mest att bygga. Men merparten är återbruk av existerande UI (handen, bytesmodal, röstmodal, bokslut) med ett tunt "tutorial-lager" ovanpå.

**Rekommendation: bygg C, men börja med kärnan (runda 0, beats B1–B4).** Overview-scenerna (steg 2) kan komma i andra hand — de är "trevliga att ha" medan runda 0 är "måste". Det ger en spelbar tutorial tidigt och en snyggare inramning sen.

---

## 6. Öppna designfrågor → förslag på svar

Från SPELINFO, med en riktning för var och en (att stämma av):

- **Tutorial-runda 0 eller lärande under spelets gång?** → Båda (spår C): runda 0 för de två svåra momenten, coach-marks som klingar av för resten.
- **Hur mycket avslöjas om vinstvillkoret i förväg?** → Visa *att* ön måste överleva för att någon ska vinna (overview scen 3), men låt *känslan* av allmänningens dilemma upptäckas i spel. Avslöja inte optimal strategi (särskilt inte medan balansen är osäker).
- **Röstningens pedagogik.** → Egen gör-gated beat med fyra prickar som fylls och omedelbart utfall. Aldrig förklara "3 av 4" i löptext.
- **Skolgrupp vs spontanbesökare — en intro eller två?** → En intro, med en **hoppa-över/förkorta** för facilitator (finns redan som mönster: `mode='gm'`, "hoppa över" i pilotläge). Läraren kan köra kort; spontanbesökaren får hela.
- **Solo (3 botar) vs fyra bänkar.** → Samma beats. För bänkar: **barriär mellan beats** (som `forhandlingen`s "väntar på andra valvet") så ingen lämnas efter. Solo: barriären passeras direkt.

---

## 7. Bygg-riktningar (hur det hakar i det som finns)

Konkret, för nästa build-session — utan att röra reglerna i `engine.js`.

- **Läge.** Använd `config.mode`. Lägg `'tutorial'` som ett tunt lager i `ui.js` (vylagret), inte i motorn. Runda 0 = motorn körs som vanligt men med skriptade bot-drag och pausad timer.
- **Timern.** `startT()` i `makeLocal()` styr rundans klocka — i tutorial: starta den inte förrän beat B4, eller låt `timerSec` vara ∞ tills tutorialen släpper.
- **Iscensätt väggen (#3).** Enklast: sätt tutorial-lagets startresurser (eller första bygget) så att det andra, önskade bygget hamnar strax utanför råd i den producerade valutan. `_canAfford` + kortets `saknar`-text driver redan "→ BYT". Ingen regeländring — bara startvärden/manus i tutorial-läget.
- **Garantera röstningen (#7).** I selfplay öppnas förslag slumpvis (`Math.random() < 0.35`). I tutorial: anropa `game.openProposal('gron')` deterministiskt i beat B3.
- **Coach-marks.** Ett overlay-lager (dimma + hål + bubbla) ovanpå `#stage`. Haka i de element-id:n som redan finns (`#cards`, `#btn-trade`, `#btn-prop`, `#btn-end`, ö-mätaren). Tona ut på den handling beaten väntar på (lyssna på samma klick som spelet redan lyssnar på).
- **Återanvänd UI.** Handen, bytesmodalen (`#ov-trade`), röstmodalen (`#ov-vote`), award-popupen (`#ov-award`) och bokslutssekvensen finns. Tutorialen ska *styra ordningen och fokus*, inte rita nya vyer.
- **Overview-scener.** Bygg som en liten sekvens av fullskärms-kort (samma `.overlay`-mönster som startskärmen) med prick-rad. Återanvänd ö-mätaren, `map.placeBuilding`, `flashRes`, `logoSVG` för animationsvokabulären — precis som `OverviewPopups` återanvänder spelets kort/stämpel/kapital.
- **Barriär för bänkar.** Speglar `forhandlingen`s `onbReady`/`bothReady`. I online-läget (server äger sanningen) blir det en tutorial-stage i serverns state; solo passerar direkt.
- **Tillgänglighet.** `prefers-reduced-motion` → hoppa animationssteg, visa slutläge. Ljud vid varje beat-övergång (finns: `ui_tap`, `build_*`, `vote`, `round_start`).
- **Copy.** All text på svenska, en rad per beat, piktogram före ord. Håll varje coach-mark under ~8 ord.

---

## 8. Nästa steg

1. Stäm av spår (A / B / **C**) och omfång (bara runda 0 först, eller med overview direkt).
2. Skriv det exakta manuset för runda 0 (bot-drag, startvärden, copy per beat) — jag kan ta fram ett förslag på beat-manus + copy när spåret är valt.
3. Bygg tutorial-lagret i `ui.js` bakom `mode='tutorial'`; verifiera att de två svåra momenten (beroende + röstning) alltid inträffar.
4. Testa på riktig målgrupp (skolklass + spontanbesökare) och mät var folk fastnar — samma två moment är facit.
