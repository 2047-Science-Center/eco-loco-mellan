#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
#  touch-watch.sh — Självläkande touch-mappning i bakgrunden.
#  Startas automatiskt vid inloggning (via autostart, se install-base.sh) och
#  håller mappningen rätt trots inloggnings-reset, skärm-hotplug, strömblink.
#  Läser panel-paren ur touch.env. Kräver X11.
# ─────────────────────────────────────────────────────────────────────────
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$HERE/_lib.sh"

load_touch_env "$HERE" || exit 1

# Lämna över till map-touch.sh i självläkande watch-läge (loopar för alltid).
exec env \
  MAP_TOUCH_WATCH="${MAP_TOUCH_WATCH:-5}" \
  MAP_TOUCH_DELAY="${MAP_TOUCH_DELAY:-3}" \
  bash "$HERE/map-touch.sh" "${MAP_ARGS[@]}"
