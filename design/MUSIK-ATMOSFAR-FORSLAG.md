# Musik & atmosfär — tre riktningar (Eco Loco "Maktspelet")

*Underlag för attract-musik + flexibla loopar. Grundljuden (soundscape_1..5 = drones) är bra
som de är — detta lägger en **melodisk grundslinga** i botten så det inte bara blir "skrap/drone".
Knyter an till ljudidentiteten (design/LJUDIDENTITET.md): "Centralmaktens slitna PA", melankolisk,
med en **tvåtons-myndighetssignatur** som redan är tänkt som röd tråd — den är vår naturliga
"grundmelodi". Pixabay-musik = royaltyfri (Pixabay Content License, oftast ingen attribution).*

Sökväg på Pixabay: `pixabay.com/music/search/<term>/` (filtrera på "Loopable" + genre i vänstermenyn).

---

## Riktning A — "Centralmaktens etersändning" (förläng den befintliga identiteten)

**Stämning:** institutionell, melankolisk, milt olycksbådande — en trött kommunal "hymn" som sänds
ut över den tomma ön genom en sliten PA. Mörkast/mest reserverad av de tre.
**Instrumentering:** harmonium/rörorgel, sub-drone-pad, rör-/bandmättnad, avlägset rumseko.
**Grundmelodi:** den mjukt *fallande tvåtonssignaturen* ur ljudidentiteten, utdragen till en långsam
mollslinga. Samma motiv som `event_*`/`round_start` redan bär → musik och SFX blir samma maskin.
**Används bäst:** in-game spänning, kris, och ett kyligt attract-läge (Centralmakten "sänder").

**Pixabay-söktermer:** `dark ambient` · `drone` · `dystopian` · `ominous ambient` · `tension` ·
`cinematic dark` · `harmonium` · `melancholic ambient`
**Suno-prompt:**
> Slow melancholic institutional broadcast loop: a tired reed-organ / harmonium plays a soft falling
> two-note minor motif over a warm low drone, heard through an old worn PA loudspeaker with
> valve-and-tape saturation, tape hiss and wow-flutter, distant room echo. No vocals, no drums,
> bureaucratic and slightly ominous. 70 bpm, seamless loop.

---

## Riktning B — "Allmänningens saga" (nordisk / maritim folk, varnande)

**Stämning:** en kuslig men varm folksaga — ön, havet, den varnande torsk-kollapsen (Newfoundland).
Mänsklig, bjuder in, men med en underström av förlust.
**Instrumentering:** nyckelharpa/fiol, knäppta strängar, låg visselpipa/flöjt, hammered dulcimer.
**Grundmelodi:** ett enkelt modalt 4-tonsmotiv som kan *omharmoniseras* — öppet/durartat när ön mår
bra, glest/moll när den kollapsar. Samma melodi, olika skrud.
**Används bäst:** attract (värmande "det här är en berättelse om en ö") + slutdelen (Newfoundland).

**Pixabay-söktermer:** `nordic folk` · `celtic` · `folk instrumental` · `maritime` · `sea` ·
`acoustic emotional` · `fable` · `dulcimer`
**Suno-prompt:**
> Haunting Nordic folk fable loop: a simple modal melody on nyckelharpa and low whistle over soft
> plucked strings and a hammered dulcimer, warm and human with an undertow of loss, like an old
> island story. No vocals, no modern drums, acoustic. 80 bpm, seamless loop.

---

## Riktning C — "Levande ö" (minimal neo-klassiskt) · REKOMMENDERAD som flexibel bas

**Stämning:** stillsam, reflekterande, försiktigt hoppfull — kan både ljusna (frisk ö) och tunnas
ut/mörkna (kollaps). Minst "tung", lättast att ha överallt utan att trötta.
**Instrumentering:** felt-piano-ostinato + mjuka stråkar + organiska texturer (vatten, fåglar, vind).
**Grundmelodi:** ett mjukt 3–4-tonspiano-ostinato som ligger KONSTANT medan harmoni/textur skiftar med
öhälsan. **Enklast att lägga UNDER de befintliga drones:en** — bara ostinatot, lågt i mixen.
**Används bäst:** överallt — den flexibla basen; lätt att variera per öhälso-läge (soundscape_1..5).

**Pixabay-söktermer (starkast bekräftade):** `soft loop` · `minimal piano` · `modern classical` ·
`neoclassical` · `ambient piano` · `emotional piano` · `reflective` · `hopeful ambient`
(konkreta träffar sedda: *Soft Felt Piano – Minimalist Sad Loop*, *Tender Breeze (loop)*, *Modern Classical*)
**Suno-prompt:**
> Minimal neo-classical loop: a gentle 4-note felt-piano ostinato over soft sustained strings and
> faint organic textures (distant water, light wind), reflective and quietly hopeful. No vocals, no
> drums, slow and warm. 72 bpm, seamless loop.

---

## Rekommendation

- **Attract:** led med **B** (bjuder in varmt, "en berättelse om en ö") ELLER **A** om du vill att
  den dystopiska Centralmakts-ramen ska möta besökaren direkt. **C** om du vill ha något neutralt
  och tidlöst som aldrig stör.
- **In-game bas (under drones):** **C** — ostinatot är gjort för att ligga lågt under soundscape_1..5.
- **Slutdel/Newfoundland:** **B**.

**Pixabay vs Suno:**
- **Pixabay** = direkt, gratis, royaltyfritt (ingen attribution för de flesta spår), men du tar det
  som finns — mindre på tema, och "sliten PA"-karaktären saknas.
- **Suno** = skräddarsytt och på tema, kan bära exakt tvåtons-motivet + PA-känslan. MEN: kör Suno-spåret
  genom samma "Centralmaktens PA"-behandling (ffmpeg: rör-/bandmättnad, smalbands-PA-filter, lätt dist)
  så det matchar riggens identitet — och kolla Suno-licensnivån för publikt/kommersiellt museibruk.
- **Rekommendation:** generera *grundmotivet* i **Suno** (så det blir genuint Eco Loco), processa det
  genom PA-behandlingen, och använd **Pixabay** som snabb fallback / för neutrala bakgrundsloopar.

**Lägga motivet UNDER drones:en (teknik):** behåll soundscape_1..5 som dronebädd. Lägg en SEPARAT,
tyst melodi-stem (ostinatot/motivet, −12 till −18 dB under dronen) som loopar fristående. Antingen
(a) baka in motivet i varje soundscape-fil, eller (b) spela det som ett andra ambience-lager i hjärnan
(en andra `_amb_worker`-kanal) så det är oberoende av öhälso-dronen. Använd **tvåtons-signaturen** som
motiv → musiken och SFX:en knyts ihop till en helhet.
