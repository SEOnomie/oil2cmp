/**
 * OIL2 — Integration: Consent-Flow (TESTS.md §8, IT01–IT08)
 *
 * End-to-end durch die echte Engine: Banner -> Klick -> Cookie -> Bridges.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { wireEngine, makeConfig, findGcmUpdate, findEvent, bannerHost, bannerButton } from './wire';
import { readConsent } from '../../src/storage/cookies';
import { setCookie, makeCookiePayload, mockDataLayer, mockClarity, cleanup } from '../helpers';

beforeEach(() => {
  mockDataLayer();
  (window as unknown as { uetq?: unknown[] }).uetq = [];
  mockClarity();
});

afterEach(() => {
  document.getElementById('oil2-prefs-host')?.remove();
  cleanup();
  document.body.innerHTML = '';
});

describe('Erstbesuch', () => {
  it('IT01: Banner -> Accept All -> Cookie + Bridges granted -> Banner weg', async () => {
    const engine = wireEngine(makeConfig());
    await engine.init();
    expect(bannerHost()).not.toBeNull();
    expect(bannerHost()!.style.display).not.toBe('none');

    bannerButton('.oil2-btn-accept').click();

    const cookie = readConsent();
    expect(cookie).toMatchObject({ f: 1, a: 1, m: 1 });
    expect(findGcmUpdate()).toMatchObject({ analytics_storage: 'granted', ad_storage: 'granted' });
    expect(findEvent('oil2_consent_log')).not.toBeNull();
    expect(bannerHost()!.style.display).toBe('none');
    expect(engine.getConsent()).toEqual({ functional: true, analytics: true, marketing: true });
  });

  it('IT02: Banner -> Reject All -> Cookie (alles 0) + Bridges denied -> Banner weg', async () => {
    const engine = wireEngine(makeConfig());
    await engine.init();
    bannerButton('.oil2-btn-reject').click();

    expect(readConsent()).toMatchObject({ f: 0, a: 0, m: 0 });
    expect(findGcmUpdate()).toMatchObject({
      analytics_storage: 'denied',
      ad_storage: 'denied',
      security_storage: 'granted',
    });
    expect(bannerHost()!.style.display).toBe('none');
  });

  it('IT03: Banner -> Einstellungen -> Custom -> Save -> Cookie + Bridges', async () => {
    const engine = wireEngine(makeConfig());
    await engine.init();
    bannerButton('.oil2-btn-customize').click();

    await vi.waitFor(() => expect(document.getElementById('oil2-prefs-host')).not.toBeNull());
    const ps = document.getElementById('oil2-prefs-host')!.shadowRoot!;
    (ps.querySelector('#oil2-analytics') as HTMLInputElement).checked = true;
    (ps.querySelector('.oil2-prefs-save') as HTMLButtonElement).click();

    expect(readConsent()).toMatchObject({ f: 0, a: 1, m: 0 });
    expect(findGcmUpdate()).toMatchObject({ analytics_storage: 'granted', ad_storage: 'denied' });
    expect(engine.getConsent()).toEqual({ functional: false, analytics: true, marketing: false });
  });
});

describe('Wiederkehrender User', () => {
  it('IT04: Cookie vorhanden -> kein Banner -> Bridges sofort', async () => {
    setCookie('oil2', makeCookiePayload({ f: 1, a: 1, m: 0, v: 1 }));
    const engine = wireEngine(makeConfig());
    await engine.init();

    expect(bannerHost()).toBeNull();
    expect(findGcmUpdate()).toMatchObject({ analytics_storage: 'granted', ad_storage: 'denied' });
    expect(engine.getConsent()).toEqual({ functional: true, analytics: true, marketing: false });
  });

  it('IT05: OIL2.show() -> Banner -> Update -> neuer Cookie', async () => {
    setCookie('oil2', makeCookiePayload({ f: 0, a: 0, m: 0, v: 1 }));
    const engine = wireEngine(makeConfig());
    await engine.init();
    expect(bannerHost()).toBeNull();

    engine.show();
    expect(bannerHost()).not.toBeNull();
    bannerButton('.oil2-btn-accept').click();

    expect(readConsent()).toMatchObject({ f: 1, a: 1, m: 1 });
  });

  it('IT06: OIL2.revoke() -> Cookie weg -> Bridges denied -> Banner', async () => {
    setCookie('oil2', makeCookiePayload({ f: 1, a: 1, m: 1, v: 1 }));
    const engine = wireEngine(makeConfig());
    await engine.init();

    engine.revoke();
    expect(readConsent()).toBeNull();
    expect(findGcmUpdate()).toMatchObject({ analytics_storage: 'denied', ad_storage: 'denied' });
    expect(bannerHost()).not.toBeNull();
    expect(engine.getConsent()).toEqual({ functional: false, analytics: false, marketing: false });
  });

  it('IT07: Config-Version geändert -> Re-Consent trotz Cookie', async () => {
    setCookie('oil2', makeCookiePayload({ f: 1, a: 1, m: 1, v: 1 }));
    const engine = wireEngine(makeConfig({ _v: 2 }));
    await engine.init();

    expect(bannerHost()).not.toBeNull(); // Banner trotz vorhandenem (altem) Cookie
    expect(engine.getConsent()).toEqual({ functional: false, analytics: false, marketing: false });
  });
});

describe('Consent-Log', () => {
  it('IT08: consent_log Event enthält alle erwarteten Felder', async () => {
    const engine = wireEngine(makeConfig({ _ab: 'B', _v: 1 }));
    await engine.init();
    bannerButton('.oil2-btn-accept').click();

    const log = findEvent('oil2_consent_log') as Record<string, unknown>;
    expect(log).not.toBeNull();
    expect(log.oil2_action).toBe('accept_all');
    expect(log.oil2_functional).toBe(true);
    expect(log.oil2_analytics).toBe(true);
    expect(log.oil2_marketing).toBe(true);
    expect(String(log.oil2_consent_id)).toMatch(/^[0-9a-f-]{36}$/i);
    expect(String(log.oil2_timestamp)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(log.oil2_config_version).toBe(1);
    expect(log.oil2_banner_variant).toBe('B');
    expect(String(log.oil2_screen)).toMatch(/^\d+x\d+$/);
    expect(typeof log.oil2_version).toBe('string');
  });
});
