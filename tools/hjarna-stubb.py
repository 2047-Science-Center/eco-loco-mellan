#!/usr/bin/env python3
# hjarna-stubb.py — DIRIGENTEN (Blocks-ersättare, kastas när Blocks tar över).
# Lyssnar på semantiska cues (ecoloco/rigg/scen|ohalsa|award|wave|countdown|ceremoni|gm/#),
# översätter till granulärt (ecoloco/rigg/out/led|fx|spot) + spelar ljud.
# Mappningstabellerna nedan ÄR specen som Blocks sen implementerar (se RIGG-KONTRAKT.md).
#
# Noll pip-beroenden: mosquitto_sub/pub (installerat) + afplay (macOS).
#   BROKER=localhost ./tools/hjarna-stubb.py

import subprocess, json, os, threading, time, sys, shutil

BROKER = os.environ.get("BROKER", "localhost")
PORT   = os.environ.get("PORT", "1883")
AUDIO_DIR = os.environ.get("AUDIO_DIR",
            os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "audio", "rigg"))

# ---- MAPPNING: öhälsoläge -> look (samma på alla 4 sidor) ----
def oh_mode(v):
    v = int(float(v))
    if v <= 20: return "superdaligt"
    if v <= 40: return "daligt"
    if v <= 60: return "neutralt"
    if v <= 80: return "bra"
    return "mycketbra"

# TRAFIKLJUS-skala: grönt (friskt) → gult (mittemellan) → orange (dåligt).
# RÖTT (h=0) är RESERVERAT för KRIS (KRIS_LOOK nedan) så en kris ALLTID går att skilja
# från bara-låg-hälsa. Därför är sämsta hälso-läget djup orange, inte rött.
MODE_LOOK = {
    "superdaligt": {"h": 16,  "s": 100, "v": 95, "blink": 80},   # djup orange — sämst (ej kris-rött)
    "daligt":      {"h": 32,  "s": 100, "v": 80, "puls": 30},    # orange
    "neutralt":    {"h": 50,  "s": 100, "v": 75, "puls": 40},    # gult
    "bra":         {"h": 95,  "s": 90,  "v": 75},                # gulgrönt
    "mycketbra":   {"h": 125, "s": 100, "v": 80, "puls": 60},    # grönt
}
MODE_SOUND   = {"superdaligt": "kris.wav"}          # edge-triggat vid inträde i kris
ATTRACT_LOOK = {"h": 200, "s": 60, "v": 20, "puls": 25}
GREEN_LOOK   = {"h": 120, "s": 100, "v": 90}
OFF          = {"h": 0, "s": 0, "v": 0}
PAUS_LOOK    = {"h": 210, "s": 70, "v": 14, "puls": 0}   # lugn, nersläckt blå bas ("fryst") — wave sveper över
KRIS_LOOK    = {"h": 0, "s": 100, "v": 15, "puls": 40}   # svag, pulserande röd — krisen äger LED-listen tills den släpps
FINAL_WIN_LOOK  = {"h": 120, "s": 100, "v": 100}         # VINST: starkt firande grönt
FINAL_LOSE_LOOK = {"h": 0,   "s": 100, "v": 22}          # FÖRLUST: dystert mörkt rött
ROUND_GOLD      = {"h": 45,  "s": 65,  "v": 98, "puls": 70}   # NY RUNDA-flourish: guld (#C9A94F-accent) — MEDVETET ingen lagfärg och ingen öhälso-signalfärg (röd/gul/grön) så den ej kan misstolkas som ett resultat. Blocks gör en riktig sweep; stubben pulsar guld.
KRIS_BLANDARE_SEK = 15.0                                  # blandaren fyrar så länge, sen släcks BARA den (röda pulsen kvar)

# ---- MAPPNING: award -> vinnarsidans look + ljud ----
AWARD = {
    "sabotor":    {"look": {"h": 0,   "s": 100, "v": 100}, "sound": "award_sabotor.wav"},
    "foretagare": {"look": {"h": 110, "s": 90,  "v": 90},  "sound": "award_foretagare.wav"},
    "eldsjal":    {"look": {"h": 135, "s": 100, "v": 70},  "sound": "award_eldsjal.wav"},
}
LAG_SIDE = {"aker": 1, "skog": 2, "tundra": 3, "stad": 4}   # lag -> sida/spot

# ---- state ----
master  = False     # GM-master: ignorera spelets cues tills den släpps
crisis_active = False   # KRIS pågår: krisen äger LED-listen (apply_ohalsa/apply_scen får ej skriva över den)
crisis_timer  = None    # threading.Timer som släcker BARA blandaren efter KRIS_BLANDARE_SEK
cur_mode = None
last_oh  = None
last_sides = {1: None, 2: None, 3: None, 4: None}    # senaste look per sida (för exakt paus-återställning)
last_spots = {1: False, 2: False, 3: False, 4: False}
prev_sides = None   # snapshot vid paus (vad som visades innan) → återställs vid fortsätt
prev_spots = None
round_flourish_active = False   # NY RUNDA: sekvensen äger LED-listen tills den är klar (apply_ohalsa målar ej över)
round_flourish_timer  = []      # pågående fas-timers (avbryts om en ny runda hinner börja)
_last_flourish = 0.0            # debounce: dubbla scen='runda' (spelstart + climax) ska inte ge dubbel sekvens

# ---- granulär ut (till firmware) ----
def pub(topic, msg):
    subprocess.run(["mosquitto_pub", "-h", BROKER, "-p", PORT, "-t", topic, "-m", str(msg)])
def set_all(look):
    for n in (1, 2, 3, 4): set_side(n, look)
def set_side(n, look):
    last_sides[n] = look                       # spåra för exakt paus-återställning
    pub(f"ecoloco/rigg/out/led/{n}", json.dumps(look))
def set_fx(fx, speed=50):
    pub("ecoloco/rigg/out/fx", json.dumps({"fx": fx, "speed": speed}))
def set_spot(n, on):
    last_spots[n] = bool(on)
    pub(f"ecoloco/rigg/out/spot/{n}", "1" if on else "0")
def spots_off():
    for n in (1, 2, 3, 4): set_spot(n, False)
def set_blandare(on):
    pub("ecoloco/rigg/out/blandare", "1" if on else "0")

# ---- ljud (one-shot, graceful om filen saknas) ----
def resolve(fname):
    if not fname: return None
    base = os.path.join(AUDIO_DIR, fname)
    if os.path.exists(base): return base
    stem = os.path.splitext(base)[0]
    for ext in (".wav", ".mp3", ".m4a", ".aiff", ".aif"):
        if os.path.exists(stem + ext): return stem + ext
    return None
# Ljudspelare: afplay på macOS (dev), mpg123/ffplay på Linux (pilot på Mint).
# AUDIO_SINK (Linux): pinna RIGG-ljudet till en viss PulseAudio-sink, t.ex. Anker-högtalaren
# på NUC 1 — spelets webbläsar-klick ligger kvar på standard-sinken (skärm/annan högtalare).
IS_MAC = sys.platform == "darwin"
AUDIO_SINK = os.environ.get("AUDIO_SINK", "")
if AUDIO_SINK and not IS_MAC:
    os.environ["PULSE_SINK"] = AUDIO_SINK     # libpulse-klienter (mpg123/ffplay) ärver detta → rätt sink
def _mpg123_base():
    cmd = ["mpg123", "-q"]
    if AUDIO_SINK: cmd += ["-o", "pulse"]     # tvinga pulse-utgången så PULSE_SINK gäller
    return cmd
def _oneshot_cmd(path):
    if IS_MAC: return ["afplay", path]
    if shutil.which("mpg123"): return _mpg123_base() + [path]
    if shutil.which("ffplay"): return ["ffplay", "-nodisp", "-autoexit", "-loglevel", "quiet", path]
    return None

def play(fname):
    p = resolve(fname)
    if not p:
        if fname: print(f"[hjarna]   (ljud saknas: {fname})")
        return
    cmd = _oneshot_cmd(p)
    if cmd: subprocess.Popen(cmd)
    else: print("[hjarna]   (ingen ljudspelare — på Linux: sudo apt install mpg123)")

# ---- ambience: kontinuerlig soundscape-loop (halv volym), mixas med stingarna ----
AMB_VOL = os.environ.get("AMB_VOL", "0.8")   # höjt från 0.5 — stämningsljuden låg för lågt mot stingers (t.ex. countdown)
def _amb_cmd(path):   # kontinuerlig loop + volym, per plattform
    if IS_MAC: return ["afplay", "-v", AMB_VOL, path]                 # loopas av worker (wait→restart)
    if shutil.which("mpg123"):
        return _mpg123_base() + ["-f", str(int(float(AMB_VOL) * 32768)), "--loop", "-1", path]
    if shutil.which("ffplay"):
        return ["ffplay", "-nodisp", "-autoexit", "-loglevel", "quiet", "-volume", str(int(float(AMB_VOL) * 100)), "-loop", "0", path]
    return None
AMB_FILE = {
    "superdaligt": "soundscape_1.mp3",   # mörk/tung (öhälsa ≤20, kris)
    "daligt":      "soundscape_2.mp3",   # orolig/grå
    "neutralt":    "soundscape_3.mp3",   # balanserad/lugn (start)
    "bra":         "soundscape_4.mp3",   # varm/hoppfull
    "mycketbra":   "soundscape_5.mp3",   # ljus/blomstrande (öhälsa >80)
}
# Spelledarens manuella stämnings-presets (topic ecoloco/rigg/ambience "1".."5") = soundscape_1..5.
# 1 = mörkast/kris → 5 = ljusast/glad (samma skala som AUTO ovan).
AMB_PRESET = {
    "1": "soundscape_1.mp3", "2": "soundscape_2.mp3", "3": "soundscape_3.mp3",
    "4": "soundscape_4.mp3", "5": "soundscape_5.mp3",
    # Spelledar-MUSIK-alternativ jämte soundscapen (loopas som ambience):
    "bra": "musik_bra.mp3", "daligt": "musik_daligt.mp3",
}
amb_manual = None   # None = AUTO (ambiencen följer öhälsan); annars en fast preset-fil spelledaren valt
_amb_target = None   # resolverad sökväg, eller None = tyst
_amb_proc = None
def _amb_worker():
    global _amb_proc
    while True:
        target = _amb_target
        if target:
            cmd = _amb_cmd(target)
            if not cmd:
                time.sleep(1); continue
            try:
                _amb_proc = subprocess.Popen(cmd)
                _amb_proc.wait()          # loopa om (macOS) / tills kill (Linux native loop)
            except Exception:
                time.sleep(0.3)
            _amb_proc = None
        else:
            time.sleep(0.1)
def _amb_kill():
    p = _amb_proc
    if p and p.poll() is None:
        try: p.terminate()
        except Exception: pass
def set_ambience(fname):
    global _amb_target
    path = resolve(fname) if fname else None
    if fname and not path: print(f"[hjarna]   (soundscape saknas: {fname})")
    if _amb_target == path: return
    _amb_target = path
    _amb_kill()                           # byt/tysta direkt
def stop_ambience():
    global _amb_target
    if _amb_target is None: return
    _amb_target = None
    _amb_kill()
def apply_ambience(payload):   # SPELLEDARE: manuell stämningsväxel. "1".."5" = fast preset, "auto" = åter till öhälso-styrning.
    global amb_manual
    p = str(payload).strip()
    if p == "auto":
        amb_manual = None
        set_ambience(AMB_FILE.get(oh_mode(last_oh)))   # återgå till ambiencen för öhälso-läget just nu
    elif p in AMB_PRESET:
        amb_manual = AMB_PRESET[p]
        set_ambience(amb_manual)

# ---- handlers ----
_trailer_proc = None
def play_trailer(on):   # TRAILER-LJUD CENTRALT (skärmarna är tysta). "1" = spela, annat = stoppa.
    global _trailer_proc
    if _trailer_proc and _trailer_proc.poll() is None:
        try: _trailer_proc.terminate()
        except Exception: pass
    _trailer_proc = None
    if str(on).strip() == "1":
        stop_ambience()                      # tysta attract-loopen under trailern (ingen överlappning)
        path = resolve("trailer.mp3")
        if not path: print("[hjarna]   (trailer-ljud saknas: trailer.mp3)"); return
        cmd = _oneshot_cmd(path)
        if cmd: _trailer_proc = subprocess.Popen(cmd)

def apply_ohalsa(payload):
    global cur_mode, last_oh
    last_oh = payload
    m = oh_mode(payload)
    if not crisis_active and not round_flourish_active:   # KRIS/NY-RUNDA-puls äger LED-listen → rör ej looken (ohalsa kommer direkt efter scen='runda')
        set_fx("none"); set_all(MODE_LOOK[m]); spots_off()
    set_ambience(amb_manual or AMB_FILE.get(m))  # manuell preset vinner; annars följ öhälso-läget (loopar vidare även i kris)
    if m != cur_mode:
        if not crisis_active: play(MODE_SOUND.get(m))
        cur_mode = m

# NY RUNDA-flourish: en kort guldpuls (~1,2 s) över alla fyra sidor + round_start-ljud, sedan faller
# looken in på öhälsan. Debounce skyddar mot dubbla scen='runda' (spelstart + ceremoni-climax).
def start_round_flourish():
    global round_flourish_active, round_flourish_timer, _last_flourish
    if crisis_active: return
    now = time.time()
    if now - _last_flourish < 2.5: return      # debounce: dubbel scen='runda' (spelstart + ceremoni-climax) → bara en sekvens
    _last_flourish = now
    round_flourish_active = True               # sekvensen äger LED-listen tills den är klar (apply_ohalsa målar ej över)
    # TYDLIG ORDNING MED PAUSER så riggen hinner med varje steg:
    # FAS 1 (nu):    nollställ / avsluta prisutdelning → släck ALLT (pil, spots, fx, lampor av)
    set_fx("none"); spots_off(); set_all(OFF)
    # FAS 2 (+0,6 s): NY RUNDA → ljud + guldljus (sweep/puls)
    def _fas_ny_runda():
        if crisis_active: return
        play("round_start")                     # ett enda round_start-ljud, vid RÄTT tillfälle (ej längre från rigg.js roundStart)
        set_fx("sweep", speed=70); set_all(ROUND_GOLD)   # Blocks sveper guld; stubben pulsar guld
    # FAS 3 (+1,8 s): TILLBAKA TILL ÖHÄLSA → rundans vanliga look
    def _fas_ohalsa():
        global round_flourish_active
        round_flourish_active = False
        if crisis_active: return
        set_fx("none")
        if last_oh is not None: apply_ohalsa(last_oh)
        else: set_all(MODE_LOOK["neutralt"])
    for t in round_flourish_timer:
        try: t.cancel()
        except Exception: pass
    round_flourish_timer = []
    for sek, fn in ((0.6, _fas_ny_runda), (1.8, _fas_ohalsa)):
        tmr = threading.Timer(sek, fn); tmr.daemon = True; tmr.start()
        round_flourish_timer.append(tmr)

def apply_scen(payload):
    global cur_mode, amb_manual
    if payload == "attract":
        cur_mode = None; amb_manual = None; set_ambience("musik_attract.mp3")   # attract-MUSIK (ny grupp startar rent)
        if not crisis_active: set_fx("none"); set_all(ATTRACT_LOOK); spots_off()
    elif payload == "runda":
        cur_mode = None            # nästa ohalsa sätter look + ambience
        if not crisis_active:
            set_fx("none"); spots_off()      # rensa ev. award-pil/spot efter prisutdelningen
            start_round_flourish()           # NY RUNDA: guldpuls + round_start-ljud, sedan faller looken in på öhälsan
    elif payload == "awards":
        set_ambience("musik_award.mp3")   # award-MUSIK under ceremonin (tydligt avbrott); award-stingers spelas ovanpå
        if not crisis_active: set_fx("none")
    elif payload == "slut":
        stop_ambience()
        if not crisis_active: set_fx("none"); set_all(OFF); spots_off()

# KRIS (semantisk cue ecoloco/rigg/kris, 1/0) — "ett MQTT-kommando gör allt".
# '1': tänd saftblandaren + svag pulserande röd på alla fyra; starta 15 s-timer som släcker BARA
#      blandaren (röda pulsen ligger kvar). crisis_active = True → apply_ohalsa/apply_scen rör ej looken.
# '0': släck blandaren, nollställ timern, crisis_active = False, återställ ambient (nuvarande öhälso-look).
def apply_kris(payload):
    global crisis_active, crisis_timer
    if payload == "1":
        crisis_active = True
        set_blandare(True)
        set_fx("none"); set_all(KRIS_LOOK); spots_off()
        if crisis_timer is not None: crisis_timer.cancel()
        crisis_timer = threading.Timer(KRIS_BLANDARE_SEK, lambda: set_blandare(False))
        crisis_timer.daemon = True
        crisis_timer.start()
    else:
        crisis_active = False
        if crisis_timer is not None: crisis_timer.cancel(); crisis_timer = None
        set_blandare(False)
        # återställ ambient-looken för nuvarande läge (krisen släppte LED-listen)
        if last_oh is not None:
            apply_ohalsa(last_oh)
        else:
            set_fx("none"); set_all(ATTRACT_LOOK); spots_off()

# Paus (systemsignal, kringgår master): lugn blå bas + långsam wave = "fryst/väntar".
# Hålls tills paus=0. Ambiencen rörs INTE (soundscapet loopar vidare under pausen).
def apply_paus(payload):
    global prev_sides, prev_spots
    if payload == "1":
        prev_sides = dict(last_sides); prev_spots = dict(last_spots)   # spara exakt vad som visas nu (pris/runda)
        set_all(PAUS_LOOK); set_fx("wave", 15); spots_off(); play("paus")
    else:
        set_fx("none")
        if prev_sides and any(v is not None for v in prev_sides.values()):
            for n in (1, 2, 3, 4):              # lägg tillbaka exakt det som visades före pausen
                if prev_sides[n] is not None: set_side(n, prev_sides[n])
                set_spot(n, prev_spots.get(n, False))
        elif last_oh is not None:
            set_all(MODE_LOOK[oh_mode(last_oh)])
        else:
            set_all(ATTRACT_LOOK)
        prev_sides = prev_spots = None

# VINST/FÖRLUST-FINALE (systemceremoni, ecoloco/rigg/final = "win"/"lose"): distinkt look + ljud så
# gruppen får en tydlig positiv (vinst) resp. allvarlig (förlust) förstärkning. Håller tills nästa
# scen-cue (t.ex. slutdelen → scen 'slut', eller attract). Spelar i BÅDA lägena (ej gatad).
def apply_final(payload):
    global crisis_active
    crisis_active = False                     # ev. kvarvarande kris släpper → finalen äger LED-listen
    stop_ambience()
    if str(payload).strip() == "win":
        set_all(FINAL_WIN_LOOK); set_fx("wave", 35); play("win")   # firande grönt svall + vinst-ljud
    else:
        set_fx("none"); set_all(FINAL_LOSE_LOOK); play("lose")     # dystert rött + förlust-ljud

def apply_award(payload):
    d = json.loads(payload)
    a = AWARD.get(d.get("typ")); side = LAG_SIDE.get(d.get("lag"))
    if not a or not side:
        # ingen vinnare (typ "ingen" / INGEN BOV, eller ceremonins avslutande clear) → släck pilen helt,
        # ingen ny spot; visa en lugn grön "ön andas ut" på alla sidor (scen=runda/ohalsa sätter sedan looken).
        if not crisis_active:
            set_fx("none"); spots_off(); set_all({"h": 130, "s": 60, "v": 70})
        return
    set_fx("none")
    for n in (1, 2, 3, 4):
        set_side(n, a["look"] if n == side else OFF)
        set_spot(n, n == side)
    play(a["sound"])

# ÅTERSTÄLL RIGGEN TILL AUTOMATIK (spelledarens "ångra"-knapp): släpp master + ev. kris-lås +
# manuell stämning, släck blandare/spots/fx/ev. startceremoni-chase, och återgå till öhälso-looken
# som spelet senast sa. Efter detta lyssnar riggen på spelets cues (öhälsan) igen.
def reset_to_auto():
    global master, crisis_active, crisis_timer, amb_manual
    master = False
    crisis_active = False
    if crisis_timer is not None:
        crisis_timer.cancel(); crisis_timer = None
    ceremoni_stop.set()                 # stoppa ev. pågående startceremoni-chase
    set_blandare(False)
    set_fx("none"); spots_off()
    amb_manual = None                   # stämning åter till AUTO (följer hälsan)
    if last_oh is not None:
        apply_ohalsa(last_oh)           # öhälso-look + ambience för nuvarande läge
    else:
        set_all(ATTRACT_LOOK); set_ambience("attract.mp3")
    print("[hjarna] ÅTERSTÄLL → riggen lyssnar på spelet igen (auto)")

def handle_gm(sub, payload):
    global master
    if sub == "master":
        master = (payload == "1"); print(f"[hjarna] GM master = {master}")
    elif sub == "auto":                 # spelledarens återställningsknapp → tillbaka till spel-styrning
        reset_to_auto()
    elif sub == "alla_grona":
        if payload == "1":
            set_fx("none"); set_all(GREEN_LOOK); spots_off()
    elif sub.startswith("spot/"):
        set_spot(int(sub.split("/")[1]), payload == "1")
    elif sub == "blandare":
        set_blandare(payload == "1")
    elif sub == "ljud":
        play(payload if "." in payload else payload + ".wav")

# ---- MAPPNING: startceremoni (tutorial→runda 1) -> LED-chase 1–4 → vitt ljus 3 s ----
# Semantik: 'countdown' = spelstart-riser + chase (OBS skild från ecoloco/rigg/countdown = 10 s kvar i rundan).
ceremoni_stop = threading.Event()
def _chase_worker():
    while not ceremoni_stop.is_set():
        for n in (1, 2, 3, 4):
            set_side(n, {"h": 0, "s": 0, "v": 100})
            for m in (1, 2, 3, 4):
                if m != n: set_side(m, {"h": 0, "s": 0, "v": 22})
            if ceremoni_stop.wait(0.33): return
def apply_ceremoni(payload):
    global ceremoni_stop
    if payload == "countdown":        # spelstart: dramatisk nedräkning (tickande klocka + riser) + LED-chase (kulminerar i climax)
        stop_ambience(); play("countdown_start")   # mer dramatisk än gamla "spanning"; spanning.mp3 ligger kvar som reserv
        ceremoni_stop = threading.Event()
        threading.Thread(target=_chase_worker, daemon=True).start()
    elif payload == "climax":         # vitt ljus i 3 s, sedan rundans look (apply_scen('runda') gör guldpuls + round_start-ljud)
        ceremoni_stop.set()
        set_fx("none"); set_all({"h": 0, "s": 0, "v": 100})
        threading.Timer(3.0, lambda: apply_scen("runda")).start()
    elif payload == "runda1":         # skärmen bytte till runda 1 — säkra att chase är stoppad (vita ljuset hålls av climax-timern)
        ceremoni_stop.set()

def on_semantic(topic, payload):
    print(f"[hjarna] {topic}  {payload}")
    if topic.startswith("ecoloco/rigg/gm/"):
        handle_gm(topic[len("ecoloco/rigg/gm/"):], payload); return
    if topic == "ecoloco/rigg/paus":   # systemsignal: visas även i spelledar-/master-läge
        apply_paus(payload); return
    if topic == "ecoloco/rigg/ambience":   # spelledarens manuella stämningsväxel: gäller i både auto- och master-läge
        apply_ambience(payload); return
    if topic == "ecoloco/rigg/trailer":    # trailer-ljud centralt (skärmarna tysta) — systemceremoni, gäller alltid
        play_trailer(payload); return
    if topic == "ecoloco/rigg/final":      # vinst/förlust-finale (systemceremoni) — spelar i båda lägena
        apply_final(payload); return
    if master:
        return                      # GM har tagit över — ignorera spelets cues
    if   topic == "ecoloco/rigg/ohalsa":    apply_ohalsa(payload)
    elif topic == "ecoloco/rigg/scen":      apply_scen(payload)
    elif topic == "ecoloco/rigg/award":     apply_award(payload)
    elif topic == "ecoloco/rigg/ljud":      play(payload)   # central "show"-ljud: round_start/win/lose/relief/proposal_open/event_*
    elif topic == "ecoloco/rigg/wave":      set_fx("wave" if payload == "1" else "none")
    elif topic == "ecoloco/rigg/kris":      apply_kris(payload)
    elif topic == "ecoloco/rigg/blandare":  set_blandare(payload == "1")
    elif topic == "ecoloco/rigg/countdown":
        if payload == "1":
            stop_ambience(); set_all({"h": 0, "s": 0, "v": 80}); set_fx("countdown"); play("countdown.wav")
        else:
            set_fx("none")   # awards följer direkt → ambience startar om efter ceremonin
    elif topic == "ecoloco/rigg/ceremoni":  apply_ceremoni(payload)

def main():
    topics = ["ecoloco/rigg/scen", "ecoloco/rigg/ohalsa", "ecoloco/rigg/award",
              "ecoloco/rigg/wave", "ecoloco/rigg/countdown", "ecoloco/rigg/ceremoni",
              "ecoloco/rigg/kris", "ecoloco/rigg/blandare", "ecoloco/rigg/ljud", "ecoloco/rigg/paus", "ecoloco/rigg/ambience", "ecoloco/rigg/trailer", "ecoloco/rigg/final", "ecoloco/rigg/gm/#"]
    args = ["mosquitto_sub", "-h", BROKER, "-p", PORT, "-v"]
    for t in topics: args += ["-t", t]
    print(f"[hjarna] dirigent igång mot {BROKER}:{PORT}  (Ctrl-C för att avsluta)")
    threading.Thread(target=_amb_worker, daemon=True).start()
    apply_scen("attract")   # viloläge direkt vid start: attract-MUSIK + attract-look spelas tills ett parti börjar
    proc = subprocess.Popen(args, stdout=subprocess.PIPE, text=True)
    try:
        for line in proc.stdout:
            line = line.rstrip("\n")
            topic, _, payload = line.partition(" ")
            try: on_semantic(topic, payload)
            except Exception as e: print(f"[hjarna] fel: {e}")
    except KeyboardInterrupt:
        pass
    finally:
        stop_ambience()
        proc.terminate()

if __name__ == "__main__":
    main()
