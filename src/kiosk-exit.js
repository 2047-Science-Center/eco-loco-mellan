// kiosk-exit.js — DOLD kiosk-avsluta för touch-skärmarna (inget tangentbord behövs).
// Håll uppe VÄNSTRA HÖRNET i 4 sekunder → bekräftelseruta → window.close().
// Osynlig i vila: en liten progress-ring dyker upp först efter ~1,2 s så korta tryck
// (en besökare som råkar nudda hörnet) aldrig gör något, och ingen visuell ledtråd syns.
//
// VIKTIGT: window.close() stänger bara fönstret om Chromium startats med --app (inte hård
// --kiosk). Ser du "kunde inte stängas"-texten: byt start-flaggan (se OVERLAMNING/README),
// eller använd OS-genvägen (t.ex. hot corner → pkill chrome).
(function () {
  'use strict';
  var HOLD_MS = 4000;        // hur länge man måste hålla
  var FEEDBACK_MS = 1200;    // när progress-ringen börjar synas
  var HOT = 64;              // hörnzonens storlek i px

  // ---- DOM (byggs här, inga element behövs i HTML) ----
  var hot = document.createElement('div');
  hot.style.cssText = 'position:fixed;top:0;left:0;width:' + HOT + 'px;height:' + HOT + 'px;z-index:2147483646;background:transparent;touch-action:none';

  var ring = document.createElement('div');
  ring.style.cssText = 'position:fixed;top:12px;left:12px;width:40px;height:40px;z-index:2147483646;' +
    'border:3px solid rgba(255,255,255,.85);border-top-color:transparent;border-radius:50%;' +
    'opacity:0;pointer-events:none;transition:opacity .2s;animation:kxspin 1s linear infinite';

  var box = document.createElement('div');
  box.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:none;background:rgba(8,7,5,.94);' +
    'align-items:center;justify-content:center;flex-direction:column;gap:22px;font-family:system-ui,sans-serif';
  box.innerHTML =
    '<div style="font:800 28px system-ui;color:#eee">Avsluta programmet?</div>' +
    '<div id="kx-hint" style="font:600 15px system-ui;color:#999;max-width:520px;text-align:center;line-height:1.5"></div>' +
    '<div style="display:flex;gap:16px">' +
      '<button id="kx-yes" style="font:800 20px system-ui;padding:16px 42px;border-radius:12px;border:0;background:#c0392b;color:#fff">AVSLUTA</button>' +
      '<button id="kx-no"  style="font:800 20px system-ui;padding:16px 42px;border-radius:12px;border:0;background:#333;color:#fff">AVBRYT</button>' +
    '</div>';

  var style = document.createElement('style');
  style.textContent = '@keyframes kxspin{to{transform:rotate(360deg)}}';

  function mount() {
    document.head.appendChild(style);
    document.body.appendChild(hot);
    document.body.appendChild(ring);
    document.body.appendChild(box);
    wire();
  }

  // ---- håll-logik ----
  var holdTmr = null, fbTmr = null, autoTmr = null;
  function clearHold() {
    clearTimeout(holdTmr); clearTimeout(fbTmr);
    holdTmr = fbTmr = null; ring.style.opacity = '0';
  }
  function onDown() {
    clearHold();
    fbTmr = setTimeout(function () { ring.style.opacity = '1'; }, FEEDBACK_MS);
    holdTmr = setTimeout(function () { clearHold(); openConfirm(); }, HOLD_MS);
  }
  function openConfirm() {
    box.querySelector('#kx-hint').textContent = '';
    box.style.display = 'flex';
    clearTimeout(autoTmr);
    autoTmr = setTimeout(closeConfirm, 10000);   // råkade man öppna den → stäng själv efter 10 s
  }
  function closeConfirm() { box.style.display = 'none'; clearTimeout(autoTmr); }

  function wire() {
    hot.addEventListener('pointerdown', onDown);
    hot.addEventListener('pointerup', clearHold);
    hot.addEventListener('pointerleave', clearHold);
    hot.addEventListener('pointercancel', clearHold);
    box.querySelector('#kx-no').addEventListener('click', closeConfirm);
    box.querySelector('#kx-yes').addEventListener('click', doExit);
  }

  function doExit() {
    try { window.close(); } catch (e) {}
    setTimeout(function () { try { window.open('', '_self'); window.close(); } catch (e) {} }, 120);
    // Stängdes inte (hård --kiosk / vanlig flik) → ge en tydlig ledtråd i stället för att låsa skärmen.
    setTimeout(function () {
      if (!document.hidden) {
        box.querySelector('#kx-hint').innerHTML =
          'Fönstret kunde inte stängas av appen. Starta Chromium med <b>--app</b> (inte hård <b>--kiosk</b>), ' +
          'eller lägg en OS-genväg (hot corner → <b>pkill chrome</b>).';
      }
    }, 900);
  }

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
