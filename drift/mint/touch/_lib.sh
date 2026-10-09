#!/usr/bin/env bash
# Gemensam hjälp: läs touch.env och gör om TOUCH_PAIRS till argument
# för map-touch.sh. Sourceas av reset-touch.sh och touch-watch.sh.

# Läser touch.env bredvid detta skript och fyller den globala arrayen MAP_ARGS
# med  <ID_PATH> <OUTPUT> <ID_PATH> <OUTPUT> ...
load_touch_env() {
  local dir="$1" envf
  envf="$dir/touch.env"
  if [ ! -f "$envf" ]; then
    echo "Saknar $envf — kopiera touch.env.example till touch.env och fyll i." >&2
    return 1
  fi

  # shellcheck disable=SC1090
  . "$envf"

  MAP_ARGS=()
  local line key val
  while IFS= read -r line; do
    line="${line//$'\r'/}"                 # CRLF från Windows/redigerare
    line="${line//$'\xc2\xa0'/ }"          # non-breaking space (klistra-fällan)
    line="${line%%#*}"                     # kommentar
    # trimma yttre blanksteg
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [ -z "$line" ] && continue
    case "$line" in
      *=*)
        key="${line%%=*}"; val="${line#*=}"
        key="${key%"${key##*[![:space:]]}"}"        # trimma runt =
        val="${val#"${val%%[![:space:]]*}"}"
        [ -n "$key" ] && [ -n "$val" ] && MAP_ARGS+=("$key" "$val")
        ;;
    esac
  done <<< "${TOUCH_PAIRS:-}"

  if [ "${#MAP_ARGS[@]}" -eq 0 ]; then
    echo "TOUCH_PAIRS i $envf är tomt/ofyllt. Kör ./find-touch.sh och fyll i." >&2
    return 1
  fi
  return 0
}
