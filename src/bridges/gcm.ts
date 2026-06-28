/**
 * OIL2 — Google Consent Mode v2 Bridge
 *
 * Sendet `gtag('consent', 'update', {...})` mit allen 7 Signalen in den
 * dataLayer. Optional `url_passthrough` und `ads_data_redaction`.
 *
 * @see SPEZIFIKATION.md §6
 * @see PROJEKT.md §8 (Signal-Mapping)
 */

import type { ConsentChoices, OIL2Config, GoogleConsentState } from '../core/types';

/** Window-Erweiterung für dataLayer + gtag. */
interface GtagWindow extends Window {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
}

/**
 * Pusht ein Google-Consent-Update in den dataLayer.
 *
 * Setzt voraus, dass der Stub den `dataLayer` bereits angelegt hat — fehlt er,
 * wird gewarnt und nichts gepusht (kein Crash).
 */
export function pushGoogleConsent(choices: ConsentChoices, config: OIL2Config): void {
  const w = window as GtagWindow;

  if (!Array.isArray(w.dataLayer)) {
    _warn('dataLayer not found');
    return;
  }
  const dataLayer = w.dataLayer;

  // gtag.js-Konvention: pusht das arguments-Objekt in den dataLayer. Existiert
  // bereits ein echtes gtag (Google-Library geladen), wird das verwendet.
  const gtag: (...args: unknown[]) => void =
    typeof w.gtag === 'function'
      ? w.gtag
      : function (): void {
          // eslint-disable-next-line prefer-rest-params
          dataLayer.push(arguments);
        };

  gtag('consent', 'update', buildGoogleConsentState(choices));

  if (config.google.urlPassthrough) {
    gtag('set', 'url_passthrough', true);
  }
  if (config.google.adsDataRedaction) {
    gtag('set', 'ads_data_redaction', true);
  }
}

/**
 * Baut das Google-Consent-State-Objekt aus den Choices.
 *
 * Mapping: `analytics` → analytics_storage; `marketing` → ad_storage +
 * ad_user_data + ad_personalization; `functional` → functionality_storage +
 * personalization_storage. `security_storage` ist immer granted.
 */
export function buildGoogleConsentState(choices: ConsentChoices): GoogleConsentState {
  return {
    analytics_storage: choices.analytics ? 'granted' : 'denied',
    ad_storage: choices.marketing ? 'granted' : 'denied',
    ad_user_data: choices.marketing ? 'granted' : 'denied',
    ad_personalization: choices.marketing ? 'granted' : 'denied',
    functionality_storage: choices.functional ? 'granted' : 'denied',
    personalization_storage: choices.functional ? 'granted' : 'denied',
    security_storage: 'granted',
  };
}

function _warn(msg: string): void {
  console.warn('[OIL2] ' + msg);
}
