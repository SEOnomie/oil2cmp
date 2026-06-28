/**
 * OIL2 — Version-Konstante
 *
 * Wird beim Build via Vite `define` ersetzt (`__OIL2_VERSION__` → z. B. "0.1.0").
 * Ohne Build (Tests, Dev) greift der Fallback. Gemeinsame Quelle für
 * `datalayer.ts` (Consent-Log) und `index.ts` (Public-API `version`).
 */

declare const __OIL2_VERSION__: string | undefined;

export const OIL2_VERSION: string =
  typeof __OIL2_VERSION__ !== 'undefined' ? __OIL2_VERSION__ : '0.0.0-dev';
