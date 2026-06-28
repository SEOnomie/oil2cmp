/**
 * OIL2 — Consent Beacon (Stufe C)
 *
 * Schiebt eine Consent-ENTSCHEIDUNG sofort an den sGTM Consent-Client
 * (`<endpoint>/oil2/consent`). Der Client setzt `oil2` + `oil2_srv` autoritativ
 * serverseitig — der HttpOnly-Backup entsteht damit sofort (nicht erst beim
 * naechsten Request) und der Consent steht Server-Tags ab dem naechsten Hit
 * bereit.
 *
 * Fire-and-forget: `navigator.sendBeacon` (Fallback `fetch({keepalive})`).
 * Transport als `text/plain` -> CORS-"simple request", kein Preflight.
 *
 * WICHTIG: Feuert NUR bei echten Entscheidungen (setConsent/revoke), NIE bei
 * restore/init — sonst entstuende eine Schleife (Server setzt Cookie -> Client
 * restored -> Beacon -> Server setzt Cookie ...).
 *
 * Bei `action === 'revoke'` signalisiert die Payload dem Client, BEIDE Cookies
 * zu loeschen. Das schliesst eine Luecke: ohne diesen Schritt bliebe der
 * serverseitige `oil2_srv` (granted) erhalten und der Restore-Tag wuerde den
 * widerrufenen Consent beim naechsten Load wiederherstellen.
 *
 * @see sgtm/oil2-consent-client.tpl
 */

import type { ConsentChoices, ConsentAction, OIL2Config } from '../core/types';
import { choicesToPayload, encodeCookie } from '../storage/cookies';

interface BeaconPayload {
  c: string; // base64-kodierter oil2-Cookie-Wert
  action: ConsentAction;
}

export function pushConsentBeacon(
  choices: ConsentChoices,
  action: ConsentAction,
  config: OIL2Config,
): void {
  if (!config.server.enabled || !config.server.consentBeacon || !config.server.endpoint) {
    return;
  }

  const url = config.server.endpoint.replace(/\/+$/, '') + '/oil2/consent';
  const payload: BeaconPayload = {
    c: encodeCookie(choicesToPayload(choices, config)),
    action,
  };
  const body = JSON.stringify(payload);

  try {
    const nav = navigator as Navigator & {
      sendBeacon?: (url: string, data?: BodyInit) => boolean;
    };
    if (typeof nav.sendBeacon === 'function') {
      // text/plain -> "simple request" (kein CORS-Preflight).
      const blob = new Blob([body], { type: 'text/plain' });
      if (nav.sendBeacon(url, blob)) return;
      // sendBeacon kann false liefern (Queue voll) -> fetch-Fallback.
    }
    _fetchFallback(url, body);
  } catch (e) {
    _warn('Consent beacon failed: ' + e);
  }
}

function _fetchFallback(url: string, body: string): void {
  if (typeof fetch !== 'function') return;
  // keepalive: ueberlebt einen Page-Unload direkt nach dem Klick.
  void fetch(url, {
    method: 'POST',
    body,
    keepalive: true,
    credentials: 'include',
    headers: { 'Content-Type': 'text/plain' },
  }).catch(() => _warn('Consent beacon fetch fallback failed'));
}

function _warn(msg: string): void {
  console.warn('[OIL2] ' + msg);
}
