# Eco Loco — Mellan · speldesign

## Kärnan (allt annat tjänar detta)
Konflikten mellan **eget vinstintresse** och **tvånget att samarbeta — annars kraschar ön.**
Den som blir rik på öns bekostnad ska inte kunna vinna ostraffat: ön bärs bara gemensamt.

## Format
- **4 lag**, ett per område. Timerstyrt, **fast antal rundor (8)**.
- **En delad mätare: Öns hälsa (0–100)**, tre färgzoner (röd < 30, gul, grön > 70). Start 50.
- Två personliga valutor: **Pengar** och **Material**. Start 40 pengar / 30 material.

## Utfall (en uppåt-tröskel, mätt vid slutet)
- Efter runda 8: **öhälsa ≥ tröskel (60)** → laget klarar det, **rikast (pengar + material) vinner.**
- Öhälsa **under tröskeln** vid slut → **alla förlorar.**
- Öhälsa **når 0** när som helst → **direkt kollaps, alla förlorar.**

## Beroendet (varför ingen kan köra sitt eget race)
Fyra områden = fyra hemvist-lag. Områdesfärg = lagfärg.

| Område | Färg | Sektor | Producerar | Korten kostar |
|---|---|---|---|---|
| Åkermark | gul | Material | material | mest pengar |
| Skog | grön | Material | material | mest pengar |
| Tundra | orange | Pengar | pengar | mest material |
| Stad | grå | Pengar | pengar | mest material |

Man tjänar bara den ena valutan men behöver den andra för att bygga → **man måste byta med de andra.** Narrativ: land som *växer/skördar* ger material (åker, skog); land som *industrialiserar/handlar* ger pengar (tundra, stad).

## Rundans lopp (~90 s)
1. **Handling & rådslag (öppet fönster):** varje lag väljer **ett** kort ur sin hand (3 st), kan **byta** valutor med andra, och **ett** lag kan lägga **ett** politiskt förslag som alla röstar om (3 av 4 krävs).
2. **Bokslut:** kostnad drogs vid valet; inkomst betalas ut, alla lags öhälso-avtryck summeras och slår på mätaren, event-kontroll.
3. **Årsbokslut-awards:** tre pop-ups (laget runt).

> Motorn (`engine.js`) applicerar för enkelhet både inkomst och öhälso-avtryck vid **samma rundas** bokslut (originalet fördröjer till nästa år). Tunbart om Josef vill ha fördröjningen.

## De 12 byggnaderna (spelaren ser bara: smutsig / standard / grön)
Samma balans-siffror per sektor; bara namn/asset skiljer per område. Siffror = engångskostnad, inkomst/runda, öhälso-effekt (engång vid bokslut).

**Material (Åkermark & Skog)**
| Nivå | kost | ger/runda | öhälsa |
|---|---|---|---|
| Smutsig | 10 pengar | +8 material | −4 |
| Standard | 15 pengar +5 mat | +6 material | −2 |
| Grön | 25 pengar +10 mat | +5 material | +1 |

**Pengar (Tundra & Stad)**
| Nivå | kost | ger/runda | öhälsa |
|---|---|---|---|
| Smutsig | 8 material | +10 pengar | −2 |
| Standard | 6 pengar +6 mat | +7 pengar | +1 |
| Grön | 10 pengar +8 mat | +6 pengar | +3 |

Namn/assets per område:
| | Smutsig | Standard | Grön |
|---|---|---|---|
| Åkermark | Industrijordbruk | Jordbruk | Ekologiskt jordbruk |
| Skog | Sågverk | Skogsbruk | Skogsjordbruk |
| Tundra | Oljeplattform | Fabrik | Vindkraft |
| Stad | Kolkraftverk | Kontor & hotell | Solceller |

## Politik (ett socialt system, ett förslag/runda, 3 av 4)
- **För ön:** *Grön satsning* — alla som röstar ja betalar 10 pengar → öhälsa +8. (Ersätter forskning.)
- **Mot:** *Miljöskatt på värsta boven* — laget med störst negativt avtryck betalar 15 pengar, delas lika mellan de andra.
- **Mot:** *Förbjud smutsigaste kortet* — nästa runda kan ingen välja smutsig.

## Awards (varje bokslut, räknat på årets runda)
- 🏆 **Årets ledande företag** — störst kapitalökning i år.
- 🌱 **Årets eldsjäl** — mest +öhälsa i år.
- 💀 **Årets sabotör** — mest −öhälsa i år.
Kantfall med flärd: "Ingen sabotör — ön andas ut." Håll dem **sociala, inte mekaniska** (ingen bonus) i v1.

## Alltid synliga register + personlig logg
- 💰 **Börsen** (rank på pengar + material) och 🏭 **Klimatregistret** (rank på ackumulerat negativt avtryck). Företagen märks 👑 ekonomisk ledare / ⚠ värsta boven → kopplas även till riggens gröna/varnings-LED.
- **Din årsberättelse:** dina val + löpande summa av ditt avtryck (+/− och netto) och ditt kapital.

## De fem ölägena (för overlay + soundscape)
| Läge | Öhälsa | Känsla |
|---|---|---|
| superdaligt | 0–20 | tung smog; hostande, industri |
| daligt | 20–40 | dis; mildare industri |
| neutralt | 40–60 | klart; lite av varje |
| bra | 60–80 | grönska; fågelkvitter, glada röster |
| mycketbra | 80–100 | frodigt; feststämning |

## Faciliteringsläge
Self-play som grund; spelledare + Blocks-lager ovanpå (extra event/tempo/genomgång) via `config.mode = 'selfplay' | 'gm'`. Telefon/röstväxlare är en fysisk förstärkning — all mekanik sker på skärm.
