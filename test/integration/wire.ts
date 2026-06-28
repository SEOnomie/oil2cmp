/**
 * OIL2 — Integration Test Wiring
 *
 * Verdrahtet die ECHTE Engine mit echten Bridges, echtem Restore und echtem
 * UI-Controller — identisch zum Composition Root in index.ts, aber ohne dessen
 * Auto-Init-Seiteneffekt. Damit laufen die Integrationstests end-to-end.
 */

import { createEngine, type OIL2Engine } from '../../src/core/engine';
import { createUIController } from '../../src/ui/controller';
import { pushGoogleConsent } from '../../src/bridges/gcm';
import { pushUETConsent } from '../../src/bridges/uet';
import { pushClarityConsent } from '../../src/bridges/clarity';
import { pushConsentUpdate, pushConsentLog } from '../../src/bridges/datalayer';
import { pushConsentBeacon } from '../../src/bridges/beacon';
import { waitForCookieRestore, probeRestore } from '../../src/core/restore';
import { parseConfig } from '../../src/storage/config';
import { injectConfig } from '../helpers';
import type { OIL2Config } from '../../src/core/types';

export function makeConfig(partial: Record<string, unknown> = {}): OIL2Config {
  injectConfig(partial as Partial<OIL2Config>);
  const c = parseConfig();
  document.getElementById('oil2-config')?.remove();
  return c;
}

export function wireEngine(config: OIL2Config): OIL2Engine {
  let engine: OIL2Engine;
  const ui = createUIController(config, {
    setConsent: (c, a) => engine.setConsent(c, a),
    getConsent: () => engine.getConsent(),
    openPreferences: () => engine.showPreferences(),
  });
  engine = createEngine(config, {
    bridges: {
      pushGoogleConsent,
      pushUETConsent,
      pushClarityConsent,
      pushConsentUpdate,
      pushConsentLog,
      pushConsentBeacon,
    },
    restore: { waitForCookieRestore, probeRestore },
    ui,
  });
  return engine;
}

// --- Assertions-Helfer ------------------------------------------------------

/** Findet das JÜNGSTE gtag-consent-update (arguments-Objekt) im dataLayer. */
export function findGcmUpdate(): Record<string, string> | null {
  const dl = (window as unknown as { dataLayer?: unknown[] }).dataLayer || [];
  let found: Record<string, string> | null = null;
  for (const entry of dl) {
    const args = entry as { [k: number]: unknown };
    if (args[0] === 'consent' && args[1] === 'update') {
      found = args[2] as Record<string, string>;
    }
  }
  return found;
}

/** Findet das JÜNGSTE dataLayer-Event nach Namen. */
export function findEvent(name: string): Record<string, unknown> | null {
  const dl = (window as unknown as { dataLayer?: unknown[] }).dataLayer || [];
  let found: Record<string, unknown> | null = null;
  for (const entry of dl) {
    const obj = entry as Record<string, unknown>;
    if (obj && obj.event === name) found = obj;
  }
  return found;
}

export function bannerHost(): HTMLElement | null {
  return document.getElementById('oil2-banner-host');
}

export function bannerButton(cls: string): HTMLButtonElement {
  return bannerHost()!.shadowRoot!.querySelector(cls) as HTMLButtonElement;
}
