/**
 * OIL2 — Consent Beacon Tests (Stufe C)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { pushConsentBeacon } from '../../src/bridges/beacon';
import { parseConfig } from '../../src/storage/config';
import { injectConfig, cleanup } from '../helpers';
import type { OIL2Config, ConsentChoices } from '../../src/core/types';

function makeConfig(serverOverrides: Record<string, unknown> = {}): OIL2Config {
  injectConfig({
    server: { enabled: true, endpoint: '/metrics', consentBeacon: true, ...serverOverrides },
  } as Partial<OIL2Config>);
  const c = parseConfig();
  document.getElementById('oil2-config')?.remove();
  return c;
}

const CH: ConsentChoices = { functional: true, analytics: true, marketing: false };
const NONE: ConsentChoices = { functional: false, analytics: false, marketing: false };

let beaconMock: ReturnType<typeof vi.fn>;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  beaconMock = vi.fn(() => true);
  fetchMock = vi.fn(() => Promise.resolve({ ok: true }));
  vi.stubGlobal('navigator', { sendBeacon: beaconMock });
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  cleanup();
});

describe('pushConsentBeacon — Gating', () => {
  it('no-op wenn consentBeacon=false', () => {
    pushConsentBeacon(CH, 'accept_all', makeConfig({ consentBeacon: false }));
    expect(beaconMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('no-op wenn server.enabled=false', () => {
    pushConsentBeacon(CH, 'accept_all', makeConfig({ enabled: false }));
    expect(beaconMock).not.toHaveBeenCalled();
  });

  it('no-op wenn endpoint leer', () => {
    pushConsentBeacon(CH, 'accept_all', makeConfig({ endpoint: '' }));
    expect(beaconMock).not.toHaveBeenCalled();
  });
});

describe('pushConsentBeacon — sendBeacon', () => {
  it('sendet an <endpoint>/oil2/consent', () => {
    pushConsentBeacon(CH, 'accept_all', makeConfig());
    expect(beaconMock).toHaveBeenCalledTimes(1);
    expect(beaconMock.mock.calls[0][0]).toBe('/metrics/oil2/consent');
  });

  it('Transport ist text/plain (kein CORS-Preflight)', () => {
    pushConsentBeacon(CH, 'accept_all', makeConfig());
    const blob = beaconMock.mock.calls[0][1] as Blob;
    expect(blob.type).toBe('text/plain');
  });

  it('normalisiert Trailing-Slash am Endpoint', () => {
    pushConsentBeacon(CH, 'accept_all', makeConfig({ endpoint: '/metrics/' }));
    expect(beaconMock.mock.calls[0][0]).toBe('/metrics/oil2/consent');
  });
});

describe('pushConsentBeacon — Payload (über fetch-Fallback geprüft)', () => {
  it('Fallback auf fetch wenn sendBeacon false liefert', () => {
    beaconMock.mockReturnValue(false);
    pushConsentBeacon(CH, 'accept_all', makeConfig());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/metrics/oil2/consent');
    expect(opts.method).toBe('POST');
    expect(opts.keepalive).toBe(true);
    expect(opts.credentials).toBe('include');
  });

  it('Fallback auf fetch wenn sendBeacon fehlt', () => {
    vi.stubGlobal('navigator', {});
    pushConsentBeacon(CH, 'accept_all', makeConfig());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('Payload enthält action + base64-kodierten Consent', () => {
    beaconMock.mockReturnValue(false);
    pushConsentBeacon(CH, 'custom', makeConfig());
    const opts = fetchMock.mock.calls[0][1] as RequestInit;
    const payload = JSON.parse(opts.body as string) as { c: string; action: string };
    expect(payload.action).toBe('custom');
    const decoded = JSON.parse(atob(payload.c)) as { f: number; a: number; m: number };
    expect(decoded).toMatchObject({ f: 1, a: 1, m: 0 });
  });

  it('revoke wird als action durchgereicht', () => {
    beaconMock.mockReturnValue(false);
    pushConsentBeacon(NONE, 'revoke', makeConfig());
    const opts = fetchMock.mock.calls[0][1] as RequestInit;
    const payload = JSON.parse(opts.body as string) as { action: string };
    expect(payload.action).toBe('revoke');
  });
});
