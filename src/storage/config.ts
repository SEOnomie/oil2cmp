/**
 * OIL2 — Config Parser
 *
 * Liest die JSON-Config aus dem DOM (`<script id="oil2-config">`), merged sie
 * tief mit den Defaults, validiert kritische Felder (Fallback + Warnung bei
 * Verstoß) und stellt den Versions-Abgleich für Re-Consent bereit.
 *
 * Wirft nie — bei jedem Fehler greift ein Default und es wird per
 * `console.warn('[OIL2] …')` geloggt.
 *
 * @see SPEZIFIKATION.md §2
 * @see CONFIG-SCHEMA.md §2 (Validierung) / §3 (Deep-Merge)
 */

import type { OIL2Config } from '../core/types';

// ============================================================================
// Default-Config
// ============================================================================

/**
 * Vollständige Default-Config. Jeder fehlende oder ungültige Wert der
 * User-Config fällt auf diese Werte zurück. Wird NIE direkt zurückgegeben —
 * `parseConfig()` liefert immer einen tiefen Klon.
 */
const DEFAULT_CONFIG: OIL2Config = {
  _v: 1,
  _ab: 'A',
  consentMode: 'advanced',
  categories: {
    functional: { label: 'Funktionale Cookies', description: 'Chat-Widgets, Videos, Karten.', default: false },
    analytics: { label: 'Statistik-Cookies', description: 'Anonyme Nutzungsanalyse.', default: false },
    marketing: { label: 'Marketing-Cookies', description: 'Werbung, Conversion-Messung.', default: false },
  },
  cookie: { name: 'oil2', domain: '', days: 365, sameSite: 'Lax' },
  server: {
    enabled: false,
    endpoint: '',
    mode: 'same_origin',
    cookieKeeper: true,
    restoreCookie: true,
    restoreTimeout: 500,
    probeEndpoint: true,
    consentBeacon: false,
  },
  google: { urlPassthrough: true, adsDataRedaction: false },
  clarity: { category: 'marketing' },
  ui: {
    position: 'bottom',
    theme: 'light',
    equalButtons: true,
    privacyUrl: '/datenschutz',
    imprintUrl: '/impressum',
    labels: {
      title: 'Cookie-Einstellungen',
      description: 'Wir nutzen Cookies zur Analyse und Verbesserung unserer Website.',
      acceptAll: 'Alle akzeptieren',
      rejectAll: 'Alle ablehnen',
      customize: 'Einstellungen',
      save: 'Auswahl speichern',
    },
  },
  consentLog: { enabled: true, dataLayerEvent: 'oil2_consent_log' },
  geo: { scope: 'eu_only', regions: [], fallback: 'show_banner' },
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Liest, merged und validiert die OIL2-Config aus dem DOM.
 *
 * Ablauf:
 * 1. `<script id="oil2-config">` suchen → fehlt: Default zurückgeben (+warn)
 * 2. `textContent` als JSON parsen → ungültig: Default zurückgeben (+warn)
 * 3. Deep-Merge in einen Klon der Defaults
 * 4. Validierung kritischer Felder (Fallback + warn bei Verstoß)
 * 5. Nicht-kritische Plausibilitäts-Warnungen
 *
 * @returns Immer ein vollständiges, gültiges {@link OIL2Config} (nie partial).
 */
export function parseConfig(): OIL2Config {
  const el = document.getElementById('oil2-config');
  if (!el) {
    _warn('Config element #oil2-config not found, using defaults');
    return _clone(DEFAULT_CONFIG);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(el.textContent ?? '');
  } catch {
    _warn('Invalid config JSON');
    return _clone(DEFAULT_CONFIG);
  }

  if (!_isPlainObject(parsed)) {
    _warn('Config must be a JSON object, using defaults');
    return _clone(DEFAULT_CONFIG);
  }

  const merged = _deepMerge(_clone(DEFAULT_CONFIG) as unknown as Record<string, unknown>, parsed);
  return _validate(merged);
}

/**
 * Liefert den Config-Hash für den Re-Consent-Abgleich. Kein komplexes Hashing —
 * die Versionsnummer `_v` IST der Hash.
 */
export function getConfigHash(config: OIL2Config): number {
  return config._v;
}

/**
 * Prüft, ob die Config-Version sich gegenüber dem im Cookie gespeicherten Wert
 * geändert hat. Bei `true` muss erneut Consent eingeholt werden.
 */
export function hasConfigChanged(storedVersion: number, currentConfig: OIL2Config): boolean {
  return storedVersion !== currentConfig._v;
}

// ============================================================================
// Deep-Merge
// ============================================================================

/**
 * Rekursiver Merge nach CONFIG-SCHEMA.md §3:
 * - Primitives: Override überschreibt Default
 * - Plain Objects: rekursiv mergen
 * - Arrays: Override ersetzt komplett (kein Element-Merge)
 * - null/undefined: als "nicht gesetzt" behandeln → Default bleibt
 *
 * Unbekannte Keys werden mitgeführt (harmlos, niemand liest sie) — das erfüllt
 * die Forward-Kompatibilität ohne Error.
 */
function _deepMerge(
  defaults: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...defaults };
  for (const key of Object.keys(overrides)) {
    const val = overrides[key];
    if (val === null || val === undefined) continue;
    const base = defaults[key];
    if (_isPlainObject(val) && _isPlainObject(base)) {
      result[key] = _deepMerge(base, val);
    } else {
      result[key] = val;
    }
  }
  return result;
}

// ============================================================================
// Validierung
// ============================================================================

/**
 * Validiert die gemergte Config in-place und castet sie auf {@link OIL2Config}.
 * Operiert auf einem Defaults-Klon — Mutation ist sicher.
 */
function _validate(cfg: Record<string, unknown>): OIL2Config {
  // --- Top-Level ---

  // _v: positive Ganzzahl ≥ 1
  if (!_isPosInt(cfg._v)) {
    _warn('_v must be a positive integer, falling back to ' + DEFAULT_CONFIG._v);
    cfg._v = DEFAULT_CONFIG._v;
  }

  // _ab: einzelner Großbuchstabe A–Z
  if (typeof cfg._ab !== 'string' || !/^[A-Z]$/.test(cfg._ab)) {
    _warn('_ab must be a single uppercase letter, falling back to "' + DEFAULT_CONFIG._ab + '"');
    cfg._ab = DEFAULT_CONFIG._ab;
  }

  // consentMode
  if (cfg.consentMode !== 'advanced' && cfg.consentMode !== 'basic') {
    _warn('consentMode invalid, falling back to "advanced"');
    cfg.consentMode = DEFAULT_CONFIG.consentMode;
  }

  // --- cookie ---
  const cookie = cfg.cookie as Record<string, unknown>;
  // Cookie-Name ist hart kodiert (sGTM-Kompatibilität) — stillschweigend erzwingen
  cookie.name = 'oil2';
  if (!_isInt(cookie.days) || (cookie.days as number) < 1 || (cookie.days as number) > 365) {
    _warn('cookie.days out of range (1-365), falling back to 365');
    cookie.days = DEFAULT_CONFIG.cookie.days;
  }
  if (cookie.sameSite !== 'Lax' && cookie.sameSite !== 'Strict' && cookie.sameSite !== 'None') {
    _warn('cookie.sameSite invalid, falling back to "Lax"');
    cookie.sameSite = DEFAULT_CONFIG.cookie.sameSite;
  }

  // --- server ---
  const server = cfg.server as Record<string, unknown>;
  if (server.mode !== 'same_origin' && server.mode !== 'own_cdn' && server.mode !== 'subdomain') {
    _warn('server.mode invalid, falling back to "same_origin"');
    server.mode = DEFAULT_CONFIG.server.mode;
  }
  if (!_isInt(server.restoreTimeout) || (server.restoreTimeout as number) < 100 || (server.restoreTimeout as number) > 2000) {
    _warn('server.restoreTimeout out of range (100-2000), falling back to 500');
    server.restoreTimeout = DEFAULT_CONFIG.server.restoreTimeout;
  }

  // --- clarity ---
  const clarity = cfg.clarity as Record<string, unknown>;
  if (clarity.category !== 'marketing' && clarity.category !== 'analytics') {
    _warn('clarity.category invalid, falling back to "marketing"');
    clarity.category = DEFAULT_CONFIG.clarity.category;
  }

  // --- ui ---
  const ui = cfg.ui as Record<string, unknown>;
  if (ui.position !== 'bottom' && ui.position !== 'top' && ui.position !== 'center') {
    _warn('ui.position invalid, falling back to "bottom"');
    ui.position = DEFAULT_CONFIG.ui.position;
  }
  if (ui.theme !== 'light' && ui.theme !== 'dark' && ui.theme !== 'auto') {
    _warn('ui.theme invalid, falling back to "light"');
    ui.theme = DEFAULT_CONFIG.ui.theme;
  }

  // --- geo ---
  const geo = cfg.geo as Record<string, unknown>;
  if (geo.scope !== 'eu_only' && geo.scope !== 'worldwide' && geo.scope !== 'custom') {
    _warn('geo.scope invalid, falling back to "eu_only"');
    geo.scope = DEFAULT_CONFIG.geo.scope;
  }
  // regions: nur gültige 2-Buchstaben ISO-Codes behalten
  if (!Array.isArray(geo.regions)) {
    geo.regions = [];
  } else {
    geo.regions = (geo.regions as unknown[]).filter(
      (r): r is string => typeof r === 'string' && /^[A-Z]{2}$/.test(r),
    );
  }
  if (geo.fallback !== 'show_banner' && geo.fallback !== 'grant_all') {
    _warn('geo.fallback invalid, falling back to "show_banner"');
    geo.fallback = DEFAULT_CONFIG.geo.fallback;
  }

  // --- Nicht-kritische Plausibilitäts-Warnungen ---
  if (server.enabled === true && server.endpoint === '') {
    _warn('Server enabled but no endpoint configured');
  }
  if (server.consentBeacon === true && (server.enabled !== true || server.endpoint === '')) {
    _warn('consentBeacon requires server.enabled and a server.endpoint');
  }
  if (server.mode === 'subdomain') {
    _warn('Subdomain mode does not bypass Safari ITP. Consider same_origin or own_cdn.');
  }
  if (cfg.consentMode === 'basic' && server.restoreCookie === true) {
    _warn('Basic mode limits cookie restore to probe requests only');
  }
  if (geo.scope === 'custom' && (geo.regions as unknown[]).length === 0) {
    _warn('Custom geo scope with empty regions list');
  }

  return cfg as unknown as OIL2Config;
}

// ============================================================================
// Helpers
// ============================================================================

/** Tiefer Klon einer JSON-serialisierbaren Config (universell kompatibel). */
function _clone(config: OIL2Config): OIL2Config {
  return JSON.parse(JSON.stringify(config)) as OIL2Config;
}

/** Plain Object (kein Array, kein null). */
function _isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Echte Ganzzahl (number-Typ, keine Strings). */
function _isInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v);
}

/** Positive Ganzzahl ≥ 1. */
function _isPosInt(v: unknown): v is number {
  return _isInt(v) && v >= 1;
}

/** Einheitliches Warn-Logging mit [OIL2]-Prefix. Wirft nie. */
function _warn(msg: string): void {
  console.warn('[OIL2] ' + msg);
}
