# UI & karta — brief (Fas 1 & 2)

## Mappar & referenser
- **Byggnads- och ljud-assets** ligger i projektmappen (`assets/…`, se `spec/assets.json`).
- **Referensbilder** ligger i två mappar: `Referens spelrigg/` = foton på den riktiga riggen och hur det ser ut när man spelar (kontext/stämning), och `Referens UI/` = det digitala UI:t / skärmdelar (t.ex. AVSLUTA OMGÅNG-knapp, grupper). **Tolka** dem — förstå vad som kommuniceras och bygg ett eget, snyggare UI. Återanvänd inte som grafik och kopiera inte ramen pixel för pixel. Behandla dem som **inspiration att tolka**, inte grafik att återanvända: förstå vad som kommuniceras och **bygg ett eget, snyggare UI**. Återskapa alltså inte ramen pixel för pixel.

Referensbilderna visar den befintliga riggen: en retro kontrollpanel-ram runt en låg-poly 3D-ö med tre färgade områden (gul åkermark, grön skog, orange tundra), resurs-displayer, humör/miljö-ikoner, KÖP och AVSLUTA OMGÅNG. **Behåll själen/känslan, men innehållet och layouten är fritt.**

## Layout-frihet (viktigt)
Grupperingen av *innehåll* i nuvarande prototyp är logisk (öhälsa, lag, hand, byteshandel, politik, register, logg) — men **du är fri att ändra hela layouten**. Det behöver **inte** trängas in i den slimmade kontrollpanel-ramen. Fullt tillåtet — och gärna:
- en **dashboard där allt syns samtidigt** (öhälsa, alla fyra lag, din hand, register, awards) utan lägen/flikar,
- **ön behöver inte vara centrerad** — placera den där den tjänar begripligheten bäst,
- egna proportioner, egen ram eller ingen ram alls.
Föreslå den uppställning du bedömer mest begriplig; motivera kort. Josef är redo att byta ut UI:t helt.

## Fas 1 — Kartan
Rita en **stiliserad 2D-karta** (SVG eller canvas — ritad i kod, inga bild-assets för själva kartan) i samma låg-poly/fasetterade anda som referensen:
- **Fyra områden, fyra färger:** Åkermark `#E7C24C` (gul), Skog `#3F8F4A` (grön), Tundra `#D98A3C` (orange), **Stad `#8A8F96` (grå, ny)**.
- Områdena ska vara tydligt avgränsade (fasetterade kanter, hav runt om) och ungefär lika stora — varje är ett lags hem.
- **10 fasta byggplatser (slots) per område.** Skriv ut koordinaterna till `spec/assets.json → slots` som `{area, index, x, y}` (kartans eget koordinatsystem, t.ex. 0–1000 × 0–600). När ett lag bygger droppar assetn på nästa lediga slot i sitt område.
- **Loggor = områdesfärg.** Färga om de fyra företagsloggorna till gul/grön/orange/grå så lag ↔ område ↔ färg är samma sak. En spelare ska direkt se "det här är mitt hörn".
- Kartan **är** öhälso-visningen: lägg ett overlay-lager som går från frodigt (grön zon) till nedsotat/kargt (röd zon) i de fem lägena.

Visa kartan + de omfärgade loggorna för Josef innan fas 2.

## Fas 2 — UI-förslag (stäm av innan bygge)
Ge ett genomtänkt förslag på hela skärmens UI, **grundat i teori och praktik**, för maximal begriplighet. Målgrupp: besökare/skolgrupper som ofta aldrig spelat förut; touch; låg insättningströskel; självfacilerande.

Utgå från och väg in:
- **Praktiken:** Josefs befintliga UI (referensbilderna) — behåll det som fungerar (tydliga resurs-displayer, KÖP, AVSLUTA OMGÅNG, humör/miljö-indikatorer).
- **Teorin (motivera dina val kort):**
  - *Progressiv exponering* — visa bara det som behövs just nu; en åtgärd i taget.
  - *Igenkänning framför minne* — ikoner + färg + text; spelaren ska aldrig behöva minnas vad något betyder.
  - *Omedelbar återkoppling* — varje handling syns direkt (byggnad på karta, siffror som rör sig, ljud).
  - *En primär sak per vy* — rundans val ska dominera; register/politik sekundärt.
  - *Signalfärger skilda från lagfärger* — grön/gul/röd för öns hälsa får inte krocka med områdesfärgerna; separera tydligt.
  - *Läsbarhet för språksvaga* — korta ord, stödjande piktogram (spelet har historiskt haft "för mycket ord"); minimera text.
- **Kärnkonflikten ska synas i gränssnittet:** att billigt/smutsigt lönar sig men sänker ön, och att man saknar den valuta man inte producerar (→ måste byta). Gör beroendet uppenbart från start ("Du gör material — du behöver pengar från de andra").

Leverans: en kort designmotivering + en skiss/mockup per huvudvy (rundans val, bokslut/awards, topplistor). **Vänta på Josefs okej innan fas 3.**

## Huvudvyer som UI:t måste rymma
1. **Rundan:** öhälso-mätare (delad), din hand (3 kort), dina + andras resurser, byteshandel, ev. politik, timer, AVSLUTA OMGÅNG.
2. **Bokslut/awards:** de tre pop-upsen (laget runt).
3. **Register:** Börsen + Klimatregistret (alltid synliga/åtkomliga), din årsberättelse.
4. **Slut:** vann/förlorade + vinnare + klimatbov + eftersnack.

## Byggnads-assets
Josef har producerat alla 12 (4 områden × smutsig/standard/grön). Peka dem i `spec/assets.json → buildings`. Visuell grammatik: smutsig = rökplym/dämpad, standard = neutral, grön = grönska/ren — så nivån läses på en halv sekund.
