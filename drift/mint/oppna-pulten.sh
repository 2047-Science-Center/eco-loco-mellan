#!/usr/bin/env bash
# oppna-pulten.sh — öppnar spelledar-pulten i webbläsaren (helskärm = tryck F11 själv).
# Mål för skrivbordsknappen "Öppna spelledar-pulten". Körs bara meningsfullt på navet.
xdg-open "http://localhost:8765/spelledare.html" >/dev/null 2>&1 &
