/**
 * OIL2 — Cookie Restore
 *
 * Stellt den `oil2` JS-Cookie wieder her, nachdem Safari ITP ihn gelöscht hat.
 * Zwei Strategien:
 *  1. Polling — wartet darauf, dass das sGTM Restore-Tag den Cookie via
 *     Set-Cookie-Header (auf einen ohnehin laufenden GA4-Request hin) zurücksetzt.
 *  2. Probe-Request — dedizierter `fetch` an `/oil2/restore` als Fallback, wenn
 *     im Basic Mode kein GA4-Ping rausgeht.
 *
 * Wirft nie: Netzwerk-/fetch-Fehler enden in einem Failure-Result.
 *
 * @see SPEZIFIKATION.md §5
 * @see PROJEKT.md §13.1 (Safari ITP Timing)
 */

import type { RestoreResult, ConsentChoices } from './types';
import { readConsent, payloadToChoices } from '../storage/cookies';

/** Default-Polling-Intervall (ms). */
const DEFAULT_INTERVAL = 50;

// ============================================================================
// Polling
// ============================================================================

/**
 * Pollt `document.cookie`, bis der `oil2` Cookie erscheint oder der Timeout
 * greift. Verwendet `setInterval` (nicht setTimeout-Rekursion) für konsistentes
 * Timing.
 *
 * @param timeout  Max. Wartezeit in ms. `<= 0` → sofortiges Failure (kein Polling).
 * @param interval Prüf-Intervall in ms (Default 50).
 */
export function waitForCookieRestore(timeout: number, interval = DEFAULT_INTERVAL): Promise<RestoreResult> {
  const start = Date.now();

  return new Promise<RestoreResult>((resolve) => {
    // Timeout = 0 → sofort, ohne Polling.
    if (timeout <= 0) {
      resolve(_fail(0));
      return;
    }

    const check = (): void => {
      // Cookie-Präsenz hat Priorität vor dem Timeout: erscheint der Cookie
      // exakt am Timeout-Punkt, gewinnt der Cookie (Restore akzeptieren).
      const choices = _readChoices();
      if (choices) {
        clearInterval(timer);
        resolve({ success: true, source: 'polling', choices, duration: Date.now() - start });
        return;
      }
      if (Date.now() - start >= timeout) {
        clearInterval(timer);
        resolve(_fail(Date.now() - start));
      }
    };

    // check() läuft erst nach dieser Zeile (deferred) — timer ist dann gesetzt.
    const timer = setInterval(check, interval);
  });
}

// ============================================================================
// Probe-Request
// ============================================================================

/**
 * Sendet einen dedizierten GET an `<endpoint>/oil2/restore`. Der sGTM Probe-
 * Client antwortet mit einem `Set-Cookie: oil2=…` Header. Die Response selbst
 * wird ignoriert — danach wird `document.cookie` geprüft.
 *
 * `credentials: 'include'` ist Pflicht, sonst wird der `oil2_srv` HttpOnly-
 * Cookie nicht mitgeschickt und der Server kann nichts wiederherstellen.
 */
export async function probeRestore(endpoint: string): Promise<RestoreResult> {
  const start = Date.now();

  if (typeof fetch !== 'function') {
    _warn('Probe request failed');
    return _fail(Date.now() - start);
  }

  // Trailing-Slash am Endpoint normalisieren ('/m/' -> '/m'), sonst entstuende
  // '/m//oil2/restore'.
  const base = endpoint.replace(/\/+$/, '');

  try {
    await fetch(base + '/oil2/restore', { method: 'GET', credentials: 'include' });
  } catch {
    // Netzwerkfehler, CORS, fetch nicht verfügbar → nicht crashen.
    _warn('Probe request failed');
    return _fail(Date.now() - start);
  }

  // Response-Status bewusst ignoriert (auch 404): entscheidend ist nur, ob der
  // Set-Cookie-Header den oil2 Cookie gesetzt hat.
  const choices = _readChoices();
  if (choices) {
    return { success: true, source: 'probe', choices, duration: Date.now() - start };
  }
  return _fail(Date.now() - start);
}

// ============================================================================
// Helpers
// ============================================================================

/** Liest den oil2 Cookie und gibt die Choices zurück (oder null bei fehlend/korrupt). */
function _readChoices(): ConsentChoices | null {
  const payload = readConsent();
  return payload ? payloadToChoices(payload) : null;
}

/** Einheitliches Failure-Result. */
function _fail(duration: number): RestoreResult {
  return { success: false, source: 'none', choices: null, duration };
}

function _warn(msg: string): void {
  console.warn('[OIL2] ' + msg);
}
