/**
 * OIL2 — dataLayer Bridge
 *
 * Pusht Consent-Events in den dataLayer für GTM und sGTM:
 *  - `pushConsentUpdate` — schlankes Trigger-Event bei jeder Consent-Änderung.
 *  - `pushConsentLog` — vollständiges Log-Event für die Analytics-Pipeline
 *    (dataLayer → sGTM → BigQuery → Looker Studio).
 *
 * Legt `window.dataLayer` an, falls es noch nicht existiert.
 *
 * @see SPEZIFIKATION.md §9
 */

import type { ConsentChoices, ConsentAction, OIL2Config, ConsentLogEvent } from '../core/types';
import { OIL2_VERSION } from '../version';

/** Window-Erweiterung für den dataLayer. */
interface DataLayerWindow extends Window {
  dataLayer?: unknown[];
}

/** Stellt den dataLayer sicher und gibt ihn zurück. */
function _dataLayer(): unknown[] {
  const w = window as DataLayerWindow;
  if (!Array.isArray(w.dataLayer)) {
    w.dataLayer = [];
  }
  return w.dataLayer;
}

/**
 * Pusht ein schlankes `oil2_consent_update` Event (Boolean-Werte) — gedacht als
 * GTM-Trigger für consent-abhängige Tags.
 */
export function pushConsentUpdate(choices: ConsentChoices): void {
  _dataLayer().push({
    event: 'oil2_consent_update',
    oil2_functional: choices.functional,
    oil2_analytics: choices.analytics,
    oil2_marketing: choices.marketing,
  });
}

/**
 * Pusht das vollständige Consent-Log-Event mit Consent-ID, Timestamp,
 * URL/Referrer, Config-Version, A/B-Variante, Build-Version und Auflösung.
 */
export function pushConsentLog(choices: ConsentChoices, action: ConsentAction, config: OIL2Config): void {
  const logEvent: ConsentLogEvent = {
    event: config.consentLog.dataLayerEvent,
    oil2_consent_id: _uuid(),
    oil2_action: action,
    oil2_functional: choices.functional,
    oil2_analytics: choices.analytics,
    oil2_marketing: choices.marketing,
    oil2_timestamp: new Date().toISOString(),
    oil2_url: location.href,
    oil2_referrer: document.referrer,
    oil2_config_version: config._v,
    oil2_banner_variant: config._ab,
    oil2_version: OIL2_VERSION,
    oil2_screen: screen.width + 'x' + screen.height,
  };
  _dataLayer().push(logEvent);
}

// ============================================================================
// Helpers
// ============================================================================

/** Erzeugt eine UUID. Nutzt `crypto.randomUUID`, sonst Math.random-Fallback (Pre-2021). */
function _uuid(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
