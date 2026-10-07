#!/usr/bin/env python3
# hjarna-stubb.py — DIRIGENTEN (Blocks-ersättare, kastas när Blocks tar över).
# Lyssnar på semantiska cues (ecoloco/rigg/scen|ohalsa|award|wave|countdown|gm/#),
# översätter till granulärt (ecoloco/rigg/out/led|fx|spot) + spelar ljud.
# Mappningstabellerna nedan ÄR specen som Blocks sen implementerar (se RIGG-KONTRAKT.md).
#
# Noll pip-beroenden: mosquitto_sub/pub (installerat) + afplay (macOS).
#   BROKER=localhost ./tools/hjarna-stubb.py

import subprocess, json, os, threading, time

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

MODE_LOOK = {
    "superdaligt": {"h": 0,   "s": 100, "v": 100, "blink": 80},
    "daligt":      {"h": 0,   "s": 100, "v": 50,  "puls": 30},
    "neutralt":    {"h": 50,  "s": 100, "v": 35,  "puls": 40},
    "bra":         {"h": 110, "s": 90,  "v": 70},
    "mycketbra":   {"h": 125, "s": 100, "v": 70,  "puls": 60},
}
MODE_SOUND   = {"superdaligt": "kris.wav"}          # edge-triggat vid inträde i kris
ATTRACT_LOOK = {"h": 200, "s": 60, "v": 20, "puls": 25}
GREEN_LOOK   = {"h": 120, "s": 100, "v": 90}
OFF          = {"h": 0, "s": 0, "v": 0}

# ---- MAPPNING: award -> vinnarsidans look + ljud ----
AWARD = {
    "sabotor":    {"look": {"h": 0,   "s": 100, "v": 100}, "sound": "award_sabotor.wav"},
    "foretagare": {"look": {"h": 110, "s": 90,  "v": 90},  "sound": "award_foretagare.wav"},
    "eldsjal":    {"look": {"h": 135, "s": 100, "v": 70},  "sound": "award_eldsjal.wav"},
}
LAG_SIDE = {"aker": 1, "skog": 2, "tundra": 3, "stad": 4}   # lag -> sida/spot

# ---- state ----
master  = False     # GM-master: ignorera spelets cues tills den släpps
cur_mode = None
last_oh  = None

# ---- granulär ut (till firmware) ----
def pub(topic, msg):
    subprocess.run(["mosquitto_pub", "-h", BROKER, "-p", PORT, "-t", topic, "-m", str(msg)])
def set_all(look):
    for n in (1, 2, 3, 4): pub(f"ecoloco/rigg/out/led/{n}", json.dumps(look))
def set_side(n, look):
    pub(f"ecoloco/rigg/out/led/{n}", json.dumps(look))
def set_fx(fx, speed=50):
    pub("ecoloco/rigg/out/fx", json.dumps({"fx": fx, "speed": speed}))
def set_spot(n, on):
    pub(f"ecoloco/rigg/out/spot/{n}", "1" if on else "0")
def spots_off():
    for n in (1, 2, 3, 4): set_spot(n, False)

# ---- ljud (one-shot, graceful om filen saknas) ----
def resolve(fname):
    if not fname: return None
    base = os.path.join(AUDIO_DIR, fname)
    if os.path.exists(base): return base
    stem = os.path.splitext(base)[0]
    for ext in (".wav", ".mp3", ".m4a", ".aiff", ".aif"):
        if os.path.exists(stem + ext): return stem + ext
    return None
def play(fname):
    p = resolve(fname)
    if p: subprocess.Popen(["afplay", p])
    elif fname: print(f"[hjarna]   (ljud saknas: {fname})")

# ---- ambience: kontinuerlig soundscape-loop (halv volym), mixas med stingarna ----
AMB_VOL = os.environ.get("AMB_VOL", "0.5")
AMB_FILE = {
    "superdaligt": "soundscape_1.mp3",   # upprorsstämning (öhälsa ≤20)
    "daligt":      "soundscape_2.mp3",
    "neutralt":    "soundscape_3.mp3",
    "bra":         "soundscape_4.mp3",
    "mycketbra":   "soundscape_5.mp3",   # glatt (öhälsa >80)
}
_amb_target = None   # resolverad sökväg, eller None = tyst
_amb_proc = None
def _amb_worker():
    global _amb_proc
    while True:
        target = _amb_target
        if target:
            try:
                _amb_proc = subprocess.Popen(["afplay", "-v", AMB_VOL, target])
                _amb_proc.wait()          # spela klart → loopa om (eller byt/stoppa)
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

# ---- handlers ----
def apply_ohalsa(payload):
    global cur_mode, last_oh
    last_oh = payload
    m = oh_mode(payload)
    set_fx("none"); set_all(MODE_LOOK[m]); spots_off()
    set_ambience(AMB_FILE.get(m))          # kontinuerlig soundscape för läget
    if m != cur_mode:
        play(MODE_SOUND.get(m)); cur_mode = m

def apply_scen(payload):
    global cur_mode
    if payload == "attract":
        set_fx("none"); set_all(ATTRACT_LOOK); spots_off(); cur_mode = None; set_ambience("attract.mp3")
    elif payload == "runda":
        cur_mode = None            # nästa ohalsa sätter look + ambience
    elif payload == "awards":
        set_fx("none"); stop_ambience()    # tyst under awards
    elif payload == "slut":
        set_fx("none"); set_all(OFF); spots_off(); stop_ambience()

def apply_award(payload):
    d = json.loads(payload)
    a = AWARD.get(d.get("typ")); side = LAG_SIDE.get(d.get("lag"))
    if not a or not side: return
    set_fx("none")
    for n in (1, 2, 3, 4):
        set_side(n, a["look"] if n == side else OFF)
        set_spot(n, n == side)
    play(a["sound"])

def handle_gm(sub, payload):
    global master
    if sub == "master":
        master = (payload == "1"); print(f"[hjarna] GM master = {master}")
    elif sub == "alla_grona":
        if payload == "1":
            set_fx("none"); set_all(GREEN_LOOK); spots_off()
    elif sub.startswith("spot/"):
        set_spot(int(sub.split("/")[1]), payload == "1")
    elif sub == "ljud":
        play(payload if "." in payload else payload + ".wav")

def on_semantic(topic, payload):
    print(f"[hjarna] {topic}  {payload}")
    if topic.startswith("ecoloco/rigg/gm/"):
        handle_gm(topic[len("ecoloco/rigg/gm/"):], payload); return
    if master:
        return                      # GM har tagit över — ignorera spelets cues
    if   topic == "ecoloco/rigg/ohalsa":    apply_ohalsa(payload)
    elif topic == "ecoloco/rigg/scen":      apply_scen(payload)
    elif topic == "ecoloco/rigg/award":     apply_award(payload)
    elif topic == "ecoloco/rigg/wave":      set_fx("wave" if payload == "1" else "none")
    elif topic == "ecoloco/rigg/countdown":
        if payload == "1":
            stop_ambience(); set_all({"h": 0, "s": 0, "v": 80}); set_fx("countdown"); play("countdown.wav")
        else:
            set_fx("none")   # awards följer direkt → ambience startar om efter ceremonin

def main():
    topics = ["ecoloco/rigg/scen", "ecoloco/rigg/ohalsa", "ecoloco/rigg/award",
              "ecoloco/rigg/wave", "ecoloco/rigg/countdown", "ecoloco/rigg/gm/#"]
    args = ["mosquitto_sub", "-h", BROKER, "-p", PORT, "-v"]
    for t in topics: args += ["-t", t]
    print(f"[hjarna] dirigent igång mot {BROKER}:{PORT}  (Ctrl-C för att avsluta)")
    threading.Thread(target=_amb_worker, daemon=True).start()
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
