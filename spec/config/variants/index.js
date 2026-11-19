// spec/config/variants/index.js — register över versionskonfigurationerna (Etapp 3a).
// EN ingång för UI/bot/server att läsa varianter utan versionsspecifika specialfall (Etapp 3b).
// Alla tre är jämbördiga; ingen är standard.

import flash from './flash.js';
import mellan from './mellan.js';
import skola from './skola.js';

export const VARIANTS = { flash, mellan, skola };
export const VARIANT_IDS = Object.keys(VARIANTS);

// Hämta en variants config. Kastar vid okänt id (hellre tydligt fel än tyst fallback till "standard").
export function loadVariant(id) {
  const v = VARIANTS[id];
  if (!v) throw new Error(`okänd spelvariant: '${id}' (giltiga: ${VARIANT_IDS.join(', ')})`);
  return v;
}
