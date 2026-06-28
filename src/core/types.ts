/**
 * OIL2 — Shared Types
 *
 * Zentrale Type- und Interface-Definitionen. Leaf-Modul ohne eigene Imports;
 * wird von allen anderen Modulen referenziert. Enthält ausschließlich Typen,
 * keine Laufzeitlogik.
 *
 * @see SPEZIFIKATION.md §1
 */

// ============================================================================
// Consent Categories
// ============================================================================

/**
 * Die drei vom User steuerbaren Consent-Kategorien.
 * `necessary` ist nicht enthalten, da immer `granted` und nicht toggle-bar.
 */
export type ConsentCategory = 'functional' | 'analytics' | 'marketing';

/**
 * Aktueller Consent-Zustand der drei steuerbaren Kategorien.
 * Wird durch das gesamte System gereicht (Engine, Bridges, UI).
 */
export interface ConsentChoices {
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

/**
 * Art der Consent-Aktion. Landet im Consent-Log (`oil2_action`).
 * - `accept_all`  — User hat "Alle akzeptieren" geklickt
 * - `reject_all`  — User hat "Alle ablehnen" geklickt
 * - `custom`      — Auswahl im Preference Center gespeichert
 * - `update`      — programmatische Änderung via API
 * - `revoke`      — Widerruf via `OIL2.revoke()` (alle Kategorien denied)
 */
export type ConsentAction = 'accept_all' | 'reject_all' | 'custom' | 'update' | 'revoke';

// ============================================================================
// Cookie Payload
// ============================================================================

/**
 * Serialisierter Cookie-Inhalt (Base64-encoded JSON, ~60 Bytes).
 * Kurze Keys halten den Cookie klein. Identisches Format in `oil2` und
 * `oil2_srv`, damit sGTM Keeper/Restore 1:1 kopieren können.
 */
export interface CookiePayload {
  /** functional consent (0 = denied, 1 = granted) */
  f: 0 | 1;
  /** analytics consent (0 = denied, 1 = granted) */
  a: 0 | 1;
  /** marketing consent (0 = denied, 1 = granted) */
  m: 0 | 1;
  /** Unix-Timestamp in Sekunden */
  t: number;
  /** Config-Version (für Re-Consent-Abgleich) */
  v: number;
  /** A/B-Banner-Variante */
  ab: string;
}

// ============================================================================
// State Machine
// ============================================================================

/**
 * Zustände der Consent-State-Machine.
 *
 * INIT → WAITING → PENDING | RESTORED → GRANTED | DENIED → ACTIVE → UPDATING → ACTIVE
 *
 * @see PROJEKT.md §10
 */
export type ConsentState =
  | 'INIT'       // Stub hat Default gesetzt, OIL2 Main noch nicht geladen
  | 'WAITING'    // Cookie-Restore-Polling läuft (Safari ITP)
  | 'PENDING'    // Banner wird angezeigt, wartet auf User
  | 'RESTORED'   // Consent aus Cookie wiederhergestellt
  | 'GRANTED'    // User hat (teilweise) zugestimmt
  | 'DENIED'     // User hat alles abgelehnt
  | 'ACTIVE'     // Consent steht, normale Nutzung
  | 'UPDATING';  // Preference Center ist offen

// ============================================================================
// Events
// ============================================================================

/**
 * Öffentliche Events des Event Bus (`OIL2.on(...)`).
 */
export type OIL2Event =
  | 'consent:granted'
  | 'consent:denied'
  | 'consent:updated'
  | 'consent:restored'
  | 'banner:shown'
  | 'banner:hidden';

/** Callback-Signatur für Event-Listener. Erhält den aktuellen Consent-Zustand. */
export type EventCallback = (data: ConsentChoices) => void;

// ============================================================================
// Config
// ============================================================================

export type ConsentModeType = 'advanced' | 'basic';
export type ClarityCategory = 'marketing' | 'analytics';
export type ServerMode = 'same_origin' | 'own_cdn' | 'subdomain';
export type GeoScope = 'eu_only' | 'worldwide' | 'custom';
export type BannerPosition = 'bottom' | 'top' | 'center';
export type BannerTheme = 'light' | 'dark' | 'auto';

/**
 * Vollständige, immer gültige OIL2-Konfiguration (nach Deep-Merge mit Defaults).
 * `parseConfig()` garantiert, dass nie ein Partial zurückgegeben wird.
 *
 * @see CONFIG-SCHEMA.md
 */
export interface OIL2Config {
  /** Config-Version. Bei Änderung → Re-Consent. */
  _v: number;
  /** A/B-Banner-Variante (einzelner Großbuchstabe). */
  _ab: string;
  /** Google Consent Mode: 'advanced' (cookieless Pings) oder 'basic'. */
  consentMode: ConsentModeType;

  categories: {
    functional: CategoryConfig;
    analytics: CategoryConfig;
    marketing: CategoryConfig;
  };

  cookie: {
    /** Immer 'oil2' — hart kodiert für sGTM-Kompatibilität. */
    name: string;
    domain: string;
    days: number;
    sameSite: 'Lax' | 'Strict' | 'None';
  };

  server: {
    enabled: boolean;
    endpoint: string;
    mode: ServerMode;
    cookieKeeper: boolean;
    restoreCookie: boolean;
    /** Max. Wartezeit auf Cookie-Restore-Polling in ms (Default 500). */
    restoreTimeout: number;
    probeEndpoint: boolean;
    /** Consent-Beacon an /oil2/consent senden (sGTM Consent-Client, Stufe C). */
    consentBeacon: boolean;
  };

  google: {
    urlPassthrough: boolean;
    adsDataRedaction: boolean;
  };

  clarity: {
    category: ClarityCategory;
  };

  ui: UIConfig;

  consentLog: {
    enabled: boolean;
    dataLayerEvent: string;
  };

  geo: {
    scope: GeoScope;
    regions: string[];
    fallback: 'show_banner' | 'grant_all';
  };
}

/** Beschreibung und Default einer einzelnen Consent-Kategorie. */
export interface CategoryConfig {
  label: string;
  description: string;
  default: boolean;
}

/** UI-/Banner-Konfiguration. */
export interface UIConfig {
  position: BannerPosition;
  theme: BannerTheme;
  /** Alle Buttons gleichwertig stylen (DSGVO-empfohlen). */
  equalButtons: boolean;
  privacyUrl: string;
  imprintUrl: string;
  labels: UILabels;
}

/** Sichtbare Texte in Banner und Preference Center. */
export interface UILabels {
  title: string;
  description: string;
  acceptAll: string;
  rejectAll: string;
  customize: string;
  save: string;
}

// ============================================================================
// Google Consent Mode Signals
// ============================================================================

/**
 * Alle 7 Google-Consent-Mode-v2-Signale.
 * `security_storage` ist immer `granted` (notwendige Kategorie).
 */
export interface GoogleConsentState {
  analytics_storage: 'granted' | 'denied';
  ad_storage: 'granted' | 'denied';
  ad_user_data: 'granted' | 'denied';
  ad_personalization: 'granted' | 'denied';
  functionality_storage: 'granted' | 'denied';
  personalization_storage: 'granted' | 'denied';
  security_storage: 'granted';
}

// ============================================================================
// DataLayer Events
// ============================================================================

/**
 * Consent-Log-Event für die Analytics-Pipeline (dataLayer → sGTM → BigQuery).
 * Event-Name ist konfigurierbar (`consentLog.dataLayerEvent`, Default
 * `oil2_consent_log`).
 */
export interface ConsentLogEvent {
  event: string;
  oil2_consent_id: string;
  oil2_action: ConsentAction;
  oil2_functional: boolean;
  oil2_analytics: boolean;
  oil2_marketing: boolean;
  /** ISO 8601 Zeitstempel. */
  oil2_timestamp: string;
  oil2_url: string;
  oil2_referrer: string;
  oil2_config_version: number;
  oil2_banner_variant: string;
  oil2_version: string;
  /** Bildschirmauflösung als 'BREITExHÖHE'. */
  oil2_screen: string;
}

/**
 * Schlankes Consent-Update-Event für GTM-Trigger.
 */
export interface ConsentUpdateEvent {
  event: 'oil2_consent_update';
  oil2_functional: boolean;
  oil2_analytics: boolean;
  oil2_marketing: boolean;
}

// ============================================================================
// Internal
// ============================================================================

/**
 * Ergebnis eines Cookie-Restore-Versuchs (Polling oder Probe-Request).
 */
export interface RestoreResult {
  success: boolean;
  /** Woher der Consent kam. 'none' bei Fehlschlag. */
  source: 'cookie' | 'polling' | 'probe' | 'none';
  choices: ConsentChoices | null;
  /** Dauer des Versuchs in ms. */
  duration: number;
}
