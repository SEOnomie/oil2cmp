/**
 * OIL2 — Integration: Safari ITP Cookie-Restore (TESTS.md §8, IT09–IT15)
 *
 * Simuliert das sGTM-Restore: der HttpOnly-`oil2_srv` ist fuer JS unsichtbar;
 * der `oil2`-JS-Cookie erscheint entweder waehrend des Pollings (sGTM Restore
 * Tag via Set-Cookie) oder durch den Probe-Request (gemockter fetch).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { wireEngine, makeConfig, findGcmUpdate, bannerHost } from './wire';
import { setCookie, makeCookiePayload, mockDataLayer, mockClarity, cleanup } from '../helpers';

const SERVER = { enabled: true, endpoint: '/metrics' };

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockDataLayer();
  (window as unknown as { uetq?: unknown[] }).uetq = [];
  mockClarity();
  fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
  (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('Cookie-Restore via Polling', () => {
  it('IT09: Cookie erscheint waehrend Polling -> restored, kein Banner', async () => {
    const engine = wireEngine(makeConfig({ server: SERVER }));
    // sGTM setzt oil2 nach ~70ms (Set-Cookie bei einem Request)
    setTimeout(() => setCookie('oil2', makeCookiePayload({ f: 1, a: 1, m: 1, v: 1 })), 70);
    await engine.init();

    expect(bannerHost()).toBeNull();
    expect(engine.getConsent()).toEqual({ functional: true, analytics: true, marketing: true });
  });

  it('IT13: Restore erfolgreich -> Bridges feuern mit restored Consent', async () => {
    mockClarity();
    const clarityFn = (window as unknown as { clarity: ReturnType<typeof vi.fn> }).clarity;
    const engine = wireEngine(makeConfig({ server: SERVER }));
    setTimeout(() => setCookie('oil2', makeCookiePayload({ f: 0, a: 1, m: 1, v: 1 })), 70);
    await engine.init();

    expect(findGcmUpdate()).toMatchObject({ analytics_storage: 'granted', ad_storage: 'granted' });
    // Clarity CamelCase
    expect(clarityFn).toHaveBeenCalledWith('consentv2', expect.objectContaining({ ad_Storage: 'granted' }));
  });

  it('IT14: Restore erfolgreich -> consent:restored Event', async () => {
    const engine = wireEngine(makeConfig({ server: SERVER }));
    const restored = vi.fn();
    engine.on('consent:restored', restored);
    setTimeout(() => setCookie('oil2', makeCookiePayload({ f: 1, a: 0, m: 0, v: 1 })), 70);
    await engine.init();

    expect(restored).toHaveBeenCalledTimes(1);
    expect(restored).toHaveBeenCalledWith({ functional: true, analytics: false, marketing: false });
  });

  it('IT15: erfolgreicher Polling-Restore < 500ms', async () => {
    const engine = wireEngine(makeConfig({ server: SERVER }));
    setTimeout(() => setCookie('oil2', makeCookiePayload({ v: 1 })), 70);
    const start = Date.now();
    await engine.init();
    expect(Date.now() - start).toBeLessThan(500);
  });
});

describe('Cookie-Restore via Probe-Request', () => {
  it('IT10: Polling-Timeout -> Probe-Request stellt Cookie wieder her', async () => {
    fetchMock.mockImplementation(async () => {
      // sGTM Probe-Client setzt oil2 via Set-Cookie
      setCookie('oil2', makeCookiePayload({ f: 1, a: 1, m: 1, v: 1 }));
      return { ok: true, status: 200 };
    });
    const engine = wireEngine(makeConfig({ server: { ...SERVER, restoreTimeout: 100 } }));
    await engine.init();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toBe('/metrics/oil2/restore');
    const opts = fetchMock.mock.calls[0][1] as { credentials?: string };
    expect(opts.credentials).toBe('include');
    expect(bannerHost()).toBeNull();
    expect(engine.getConsent()).toEqual({ functional: true, analytics: true, marketing: true });
  });

  it('IT11: Polling + Probe fehlgeschlagen -> Banner', async () => {
    fetchMock.mockImplementation(async () => ({ ok: true, status: 204 })); // kein Cookie gesetzt
    const engine = wireEngine(makeConfig({ server: { ...SERVER, restoreTimeout: 100 } }));
    await engine.init();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(bannerHost()).not.toBeNull();
    expect(engine.getConsent()).toEqual({ functional: false, analytics: false, marketing: false });
  });
});

describe('Kein Restore', () => {
  it('IT12: restoreCookie=false -> kein Polling -> Banner direkt', async () => {
    const engine = wireEngine(
      makeConfig({ server: { ...SERVER, restoreCookie: false } }),
    );
    await engine.init();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(bannerHost()).not.toBeNull();
  });
});
