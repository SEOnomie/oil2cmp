/**
 * OIL2 — dataLayer Bridge Tests
 * @see TESTS.md §6 (datalayer: T01–T12)
 */

import { describe, it, expect, afterEach } from 'vitest';
import { pushConsentUpdate, pushConsentLog } from '../../src/bridges/datalayer';
import { mockDataLayer, cleanup } from '../helpers';
import type { ConsentChoices, OIL2Config } from '../../src/core/types';

afterEach(() => {
  cleanup();
});

const C_TRUE: ConsentChoices = { functional: true, analytics: true, marketing: true };

function cfg(version = 3, ab = 'A'): OIL2Config {
  return {
    _v: version,
    _ab: ab,
    consentLog: { enabled: true, dataLayerEvent: 'oil2_consent_log' },
  } as OIL2Config;
}

function last(dl: unknown[]): Record<string, unknown> {
  return dl[dl.length - 1] as Record<string, unknown>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('pushConsentUpdate', () => {
  it('T01: pusht oil2_consent_update Event', () => {
    const dl = mockDataLayer();
    pushConsentUpdate(C_TRUE);
    expect(last(dl).event).toBe('oil2_consent_update');
  });

  it('T02: Event enthält oil2_functional/analytics/marketing', () => {
    const dl = mockDataLayer();
    pushConsentUpdate(C_TRUE);
    const e = last(dl);
    expect(e).toHaveProperty('oil2_functional');
    expect(e).toHaveProperty('oil2_analytics');
    expect(e).toHaveProperty('oil2_marketing');
  });

  it('T03: Boolean-Werte korrekt (true/false, nicht 0/1)', () => {
    const dl = mockDataLayer();
    pushConsentUpdate({ functional: true, analytics: false, marketing: true });
    const e = last(dl);
    expect(e.oil2_functional).toBe(true);
    expect(e.oil2_analytics).toBe(false);
    expect(e.oil2_marketing).toBe(true);
  });

  it('T04: dataLayer existiert nicht → wird als leeres Array initialisiert', () => {
    expect((window as unknown as { dataLayer?: unknown[] }).dataLayer).toBeUndefined();
    pushConsentUpdate(C_TRUE);
    expect(Array.isArray((window as unknown as { dataLayer: unknown[] }).dataLayer)).toBe(true);
  });
});

describe('pushConsentLog', () => {
  it('T05: pusht consent_log Event mit allen Feldern', () => {
    const dl = mockDataLayer();
    pushConsentLog(C_TRUE, 'accept_all', cfg());
    const e = last(dl);
    for (const k of [
      'event',
      'oil2_consent_id',
      'oil2_action',
      'oil2_functional',
      'oil2_analytics',
      'oil2_marketing',
      'oil2_timestamp',
      'oil2_url',
      'oil2_referrer',
      'oil2_config_version',
      'oil2_banner_variant',
      'oil2_version',
      'oil2_screen',
    ]) {
      expect(e).toHaveProperty(k);
    }
    expect(e.event).toBe('oil2_consent_log');
  });

  it('T06: oil2_consent_id ist gültige UUID', () => {
    const dl = mockDataLayer();
    pushConsentLog(C_TRUE, 'accept_all', cfg());
    expect(last(dl).oil2_consent_id as string).toMatch(UUID_RE);
  });

  it('T07: oil2_timestamp ist ISO 8601', () => {
    const dl = mockDataLayer();
    pushConsentLog(C_TRUE, 'accept_all', cfg());
    const ts = last(dl).oil2_timestamp as string;
    expect(new Date(ts).toISOString()).toBe(ts);
  });

  it('T08: oil2_action enthält die korrekte Action', () => {
    const dl = mockDataLayer();
    pushConsentLog(C_TRUE, 'reject_all', cfg());
    expect(last(dl).oil2_action).toBe('reject_all');
  });

  it('T09: oil2_config_version aus config._v', () => {
    const dl = mockDataLayer();
    pushConsentLog(C_TRUE, 'custom', cfg(7));
    expect(last(dl).oil2_config_version).toBe(7);
  });

  it('T10: oil2_banner_variant aus config._ab', () => {
    const dl = mockDataLayer();
    pushConsentLog(C_TRUE, 'custom', cfg(1, 'B'));
    expect(last(dl).oil2_banner_variant).toBe('B');
  });

  it('T11: oil2_url ist location.href', () => {
    const dl = mockDataLayer();
    pushConsentLog(C_TRUE, 'custom', cfg());
    expect(last(dl).oil2_url).toBe(location.href);
  });

  it('T12: oil2_screen ist widthxheight Format', () => {
    const dl = mockDataLayer();
    pushConsentLog(C_TRUE, 'custom', cfg());
    expect(last(dl).oil2_screen as string).toMatch(/^\d+x\d+$/);
  });
});
