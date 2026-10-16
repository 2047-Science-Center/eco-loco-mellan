# Maktspelet — Strategicoach (vänster-station)

En **fristående** AI-strategicoach för **spelarna** i Maktspelet. I stationen styr mitten skärmen, höger förhandlar via telefon med andra lag, och **vänster** har den här AI-chatten tränad på spelet. Spelarna diskuterar strategi, får inspel och lär sig reglerna snabbare.

**Helt oberoende av spelet:** pratar INTE med `server.js` eller spelets WebSocket. Det är i grunden bara en AI med en kunskapsbas om spelet. Körs i ett Chrome-fönster på en **liggande surfplatta** (iPad/Android), touch-vänlig (knappar ≥ 64 px).

## Innehåll
- `index.html` — frontend (chatt, förprogrammerade snabbfrågor som chips, fritext).
- `server/index.js` — liten Node/Express-backend som proxar OpenAI-anropet och håller nyckeln i en miljövariabel. Serverar även frontend.
- `server/system-prompt.sv.txt` — den destillerade spel-kunskapsbasen (AI:ns system-prompt).
- `server/.env.example` — mall för nyckeln. Kopiera till `server/.env` (committas aldrig).

## Köra

```bash
cd strateg
npm install

# För skarpa svar: lägg in din OpenAI-nyckel
cp server/.env.example server/.env
#   redigera server/.env och sätt AI_API_KEY=sk-...

npm start
# → http://localhost:8790   (öppna i Chrome på surfplattan, liggande)
```

Öppna `http://localhost:8790` i webbläsaren. Backend serverar frontend på samma port, så inget separat statiskt steg behövs.

## API-nyckel (ALDRIG i git)
- Nyckeln läses från miljövariabeln `AI_API_KEY` (eller `OPENAI_API_KEY`) i `server/.env`.
- `server/.env` är gitignore:ad och ska **aldrig** committas. Repot är publikt — inga hemligheter i någon fil.
- Byte av nyckel (Josefs → driftens) = ändra i `server/.env`, ingen kodändring.

## Modell
- **`gpt-5-mini`** med `reasoning.effort: 'low'` — samma snabba/lilla familj som minnestest-stationen. Ändras via `STRATEG_MODEL` i `.env`.
- System-prompten **tvingar koncisa svar** (max ~2–4 meningar eller en kort punktlista) och `max_output_tokens: 400`.

## Utan nyckel (demo)
Om ingen `AI_API_KEY` är satt svarar backend med ett tydligt **MOCK-svar** (märkt "DEMO-läge") så att UI:t går att demonstrera utan nyckel. Statuslampan uppe till höger visar Live / Demo-läge.

## Anropsmönster
Backend speglar 2047:s beprövade mönster (`minnestest/server/index.js`): `openai`-paketet, `new OpenAI({ apiKey })`, `openai.responses.create({ model, instructions, input, reasoning, max_output_tokens })`, nyckel via `dotenv`. Frontend → `POST /chat` med hela konversationshistoriken → backend → OpenAI → kort svar.

## Portar
Default `8790`. Spelservern kör på `8765`, så de krockar inte. Ändra via `PORT` i `.env`.
