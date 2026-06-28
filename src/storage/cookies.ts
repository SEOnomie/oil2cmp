/**
 * OIL2 — Cookie Storage
 *
 * Liest und schreibt den `oil2` JS-Cookie. Encode/Decode der Payload
 * (Base64-JSON). Kein Zugriff auf `oil2_srv` — der ist sGTM-only (HttpOnly).
 *
 * Wirft nie: korrupte Cookies führen zu `null`, nicht zu einem Crash.
 *
 * @see SPEZIFIKATION.md §3
 */

import type { CookiePayload, ConsentChoices, OIL2Config } from '../core/types';

/** Cookie-Name ist hart kodiert (sGTM-Kompatibilität). */
const COOKIE_NAME = 'oil2';

/** Findet `oil2=…` nur an einer echten Cookie-Grenze (verhindert `notoil2=`-Match). */
const COOKIE_RE = /(?:^|;\s*)oil2=([^;]+)/;

// ============================================================================
// Read / Write
// ============================================================================

/**
 * Liest den aktuellen Consent aus dem `oil2` Cookie.
 * @returns Dekodierte {@link CookiePayload} oder `null`, wenn kein gültiger
 *          Cookie existiert.
 */
export function readConsent(): CookiePayload | null {
  const match = document.cookie.match(COOKIE_RE);
  if (!match) return null;
  return decodeCookie(match[1]);
}

/**
 * Schreibt den Consent als `oil2` Cookie (Base64-JSON-Payload).
 * Setzt `SameSite`, `Secure`, `max-age` und optional `domain` aus der Config.
 */
export function writeConsent(choices: ConsentChoices, config: OIL2Config): void {
  const encoded = encodeCookie(choicesToPayload(choices, config));
  const maxAge = config.cookie.days * 86400;
  let cookie =
    COOKIE_NAME + '=' + encoded +
    '; max-age=' + maxAge +
    '; path=/' +
    '; SameSite=' + config.cookie.sameSite +
    '; Secure';
  if (config.cookie.domain) {
    cookie += '; domain=' + config.cookie.domain;
  }
  document.cookie = cookie;
}

/**
 * Löscht den `oil2` Cookie (max-age=0). Gibt die Domain mit an, falls gesetzt —
 * sonst lässt sich ein domain-gebundener Cookie nicht zuverlässig löschen.
 */
export function deleteConsent(config: OIL2Config): void {
  let cookie = COOKIE_NAME + '=; max-age=0; path=/';
  if (config.cookie.domain) {
    cookie += '; domain=' + config.cookie.domain;
  }
  document.cookie = cookie;
}

// ============================================================================
// Encode / Decode
// ============================================================================

/** Serialisiert eine Payload zu Base64-JSON. */
export function encodeCookie(payload: CookiePayload): string {
  return btoa(JSON.stringify(payload));
}

/**
 * Dekodiert und validiert einen Base64-JSON-Cookie-Wert.
 *
 * Validierung (SPEZIFIKATION.md §3): `f`/`a`/`m` ∈ {0,1}, `t` > 0, `v` > 0.
 * Bei jedem Fehler (Base64, JSON, Struktur) → `console.warn` + `null`.
 * Leerer/null Input → `null` (ohne Warnung — das ist "kein Cookie", nicht korrupt).
 * Unbekannte Extra-Felder werden verworfen (sauberer Rebuild).
 */
export function decodeCookie(raw: string): CookiePayload | null {
  if (!raw) return null;

  let obj: unknown;
  try {
    obj = JSON.parse(atob(raw));
  } catch {
    _warn('Corrupt cookie payload');
    return null;
  }

  if (!_isValidPayload(obj)) {
    _warn('Corrupt cookie payload');
    return null;
  }

  // Sauberer Rebuild: nur bekannte Felder, `ab` auf String normalisiert.
  return {
    f: obj.f,
    a: obj.a,
    m: obj.m,
    t: obj.t,
    v: obj.v,
    ab: typeof obj.ab === 'string' ? obj.ab : '',
  };
}

// ============================================================================
// Payload <-> Choices
// ============================================================================

/** Baut eine Payload aus den Consent-Choices (+ Timestamp, Version, A/B). */
export function choicesToPayload(choices: ConsentChoices, config: OIL2Config): CookiePayload {
  return {
    f: choices.functional ? 1 : 0,
    a: choices.analytics ? 1 : 0,
    m: choices.marketing ? 1 : 0,
    t: Math.floor(Date.now() / 1000),
    v: config._v,
    ab: config._ab,
  };
}

/** Extrahiert die Consent-Choices aus einer Payload. */
export function payloadToChoices(payload: CookiePayload): ConsentChoices {
  return {
    functional: payload.f === 1,
    analytics: payload.a === 1,
    marketing: payload.m === 1,
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Type-Guard: prüft die Kern-Felder einer Payload.
 * `ab` wird hier bewusst NICHT geprüft (Spec listet nur f/a/m/t/v) und beim
 * Rebuild normalisiert.
 */
function _isValidPayload(o: unknown): o is { f: 0 | 1; a: 0 | 1; m: 0 | 1; t: number; v: number; ab?: unknown } {
  if (typeof o !== 'object' || o === null || Array.isArray(o)) return false;
  const p = o as Record<string, unknown>;
  return (
    (p.f === 0 || p.f === 1) &&
    (p.a === 0 || p.a === 1) &&
    (p.m === 0 || p.m === 1) &&
    typeof p.t === 'number' && p.t > 0 &&
    typeof p.v === 'number' && p.v > 0
  );
}

/** Einheitliches Warn-Logging mit [OIL2]-Prefix. Wirft nie. */
function _warn(msg: string): void {
  console.warn('[OIL2] ' + msg);
}
