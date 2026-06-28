/**
 * OIL2 — Microsoft Clarity Bridge
 *
 * Sendet den Consent-Status an Microsoft Clarity via `clarity('consentv2', …)`.
 *
 * KRITISCH: Clarity nutzt CamelCase — `ad_Storage` und `analytics_Storage`
 * (großes S). Google und UET nutzen Kleinschreibung. Falsches Casing führt
 * dazu, dass Clarity den Consent stillschweigend ignoriert.
 *
 * Default-Kategorie ist `marketing` (konfigurierbar auf `analytics`).
 *
 * @see SPEZIFIKATION.md §8
 * @see PROJEKT.md §13.4
 */

import type { ConsentChoices, OIL2Config } from '../core/types';

/** Window-Erweiterung für die Clarity-API. */
interface ClarityWindow extends Window {
  clarity?: unknown;
}

/**
 * Pusht ein Clarity-ConsentV2-Update.
 *
 * Ist Clarity nicht geladen (oder `window.clarity` kein Funktionswert), wird
 * gewarnt und übersprungen — viele Kunden nutzen kein Clarity, das ist kein Fehler.
 */
export function pushClarityConsent(choices: ConsentChoices, config: OIL2Config): void {
  const w = window as ClarityWindow;

  // Deckt beides ab: nicht geladen (undefined) UND geladen-aber-kein-Funktionswert.
  if (typeof w.clarity !== 'function') {
    _warn('Clarity not loaded, skipping');
    return;
  }
  const clarity = w.clarity as (...args: unknown[]) => void;

  // CamelCase ist Pflicht — siehe Modul-Header.
  const clarityConsent: Record<string, string> = {
    ad_Storage: choices.marketing ? 'granted' : 'denied',
  };

  // analytics_Storage hängt an der konfigurierten Kategorie.
  if (config.clarity.category === 'marketing') {
    clarityConsent.analytics_Storage = choices.marketing ? 'granted' : 'denied';
  } else {
    clarityConsent.analytics_Storage = choices.analytics ? 'granted' : 'denied';
  }

  clarity('consentv2', clarityConsent);
}

function _warn(msg: string): void {
  console.warn('[OIL2] ' + msg);
}
