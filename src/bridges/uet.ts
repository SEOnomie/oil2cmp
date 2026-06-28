/**
 * OIL2 — Microsoft UET Bridge
 *
 * Sendet den Consent-Status an Microsoft UET. UET kennt ausschließlich
 * `ad_storage` — kein analytics_storage, kein functionality_storage.
 *
 * Ist das UET-Script noch nicht geladen, bleibt `uetq` ein Array und die Events
 * werden gequeued (UET-eigenes Verhalten) und bei Ladung nachgeholt.
 *
 * @see SPEZIFIKATION.md §7
 */

import type { ConsentChoices } from '../core/types';

/** Window-Erweiterung für die UET-Queue. */
interface UetWindow extends Window {
  uetq?: unknown[];
}

/**
 * Pusht ein UET-Consent-Update in `window.uetq`. Legt die Queue an, falls sie
 * noch nicht existiert.
 */
export function pushUETConsent(choices: ConsentChoices): void {
  const w = window as UetWindow;
  const uetq = Array.isArray(w.uetq) ? w.uetq : (w.uetq = []);
  uetq.push('consent', 'update', {
    ad_storage: choices.marketing ? 'granted' : 'denied',
  });
}
