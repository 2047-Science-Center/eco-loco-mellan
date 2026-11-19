// server/variant-config.js — bygger motor-config för vald spelversion (Etapp 3b, Slice 1).
// Fristående + ren → testbar utan att starta servern. Servern (server.js) importerar detta.
//
// En variant är EN jämbördig config ovanpå manifestets bas-config (spec/assets.json → config).
// variantId = null → legacy/standard (bara manifestets config, dvs dagens Mellan-beteende).
// Ingen version är inbyggd standard i motorn; valet styrs av spelledaren och appliceras vid nästa parti.

import { loadVariant, VARIANT_IDS } from '../spec/config/variants/index.js';

export { VARIANT_IDS };

export function isValidVariant(id) {
  return id == null || VARIANT_IDS.includes(id);
}

// Slå ihop manifestets bas-config med variantens (varianten vinner på de versions-definierande fälten).
export function buildEngineConfig(manifestConfig = {}, variantId = null) {
  if (!variantId) return { ...manifestConfig };
  return { ...manifestConfig, ...loadVariant(variantId) };
}

// Fas-timers (sek) som servern använder. Variant anger cfg.phases → hämtas DÄRIFRÅN (inga hårdkodade
// tider åsidosätter configen). Legacy (ingen cfg.phases) → nuvarande konstanter (legacy-arg) oförändrat.
//   bygga         rundtimer (null → servern faller tillbaka på engine.timerSecFor).
//   propose/vote  Ö-rådets förslags-/röst-faser. politik delas på hälften (propose+vote); i dilemma-läge
//                 går hela politik-budgeten till A/B-rösten (ingen förslagsfas).
//   prisutdelning total ceremoni-tid i sek (null → per-steg legacy-takt).
export function phaseTimers(cfg = {}, legacy = {}) {
  const L = { propose: 30, vote: 30, ...legacy };
  const p = cfg.phases;
  if (!p) return { bygga: null, propose: L.propose, vote: L.vote, prisutdelning: null };
  const politik = p.politik;
  const dilemma = cfg.decisionSystem === 'dilemma';
  const half = politik != null ? Math.max(1, Math.round(politik / 2)) : null;
  return {
    bygga: p.bygga ?? null,
    prisutdelning: p.prisutdelning ?? null,
    propose: half ?? L.propose,
    vote: politik != null ? (dilemma ? politik : half) : L.vote,
  };
}
