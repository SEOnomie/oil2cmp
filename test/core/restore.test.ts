/**
 * OIL2 — Cookie Restore Tests
 * @see TESTS.md §5 (T01–T13)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { waitForCookieRestore, probeRestore } from '../../src/core/restore';
import { setCookie, makeCookiePayload, cleanup } from '../helpers';

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  cleanup();
});

// ---------------------------------------------------------------------------

describe('waitForCookieRestore', () => {
  it('T01: Cookie erscheint innerhalb Timeout → success, source = polling', async () => {
    vi.useFakeTimers();
    setCookie('oil2', makeCookiePayload());
    const p = waitForCookieRestore(500);
    await vi.advanceTimersByTimeAsync(50);
    const r = await p;
    expect(r.success).toBe(true);
    expect(r.source).toBe('polling');
    expect(r.choices).not.toBeNull();
  });

  it('T02: Cookie erscheint nicht → success = false, source = none', async () => {
    vi.useFakeTimers();
    const p = waitForCookieRestore(200);
    await vi.advanceTimersByTimeAsync(250);
    const r = await p;
    expect(r.success).toBe(false);
    expect(r.source).toBe('none');
    expect(r.choices).toBeNull();
  });

  it('T03: Cookie erscheint nach 200ms bei 500ms Timeout → success, duration ≈ 200', async () => {
    vi.useFakeTimers();
    const p = waitForCookieRestore(500, 50);
    await vi.advanceTimersByTimeAsync(150); // 50, 100, 150 — noch kein Cookie
    setCookie('oil2', makeCookiePayload());
    await vi.advanceTimersByTimeAsync(50); // Tick bei 200ms findet Cookie
    const r = await p;
    expect(r.success).toBe(true);
    expect(r.duration).toBeGreaterThanOrEqual(200);
    expect(r.duration).toBeLessThan(260);
  });

  it('T04: Timeout = 0 → sofort Failure', async () => {
    const r = await waitForCookieRestore(0);
    expect(r.success).toBe(false);
    expect(r.duration).toBe(0);
  });

  it('T05: Cookie exakt am Timeout-Punkt → akzeptieren (success = true)', async () => {
    vi.useFakeTimers();
    const p = waitForCookieRestore(200, 50);
    await vi.advanceTimersByTimeAsync(150);
    setCookie('oil2', makeCookiePayload()); // erscheint genau vor dem 200ms-Tick
    await vi.advanceTimersByTimeAsync(50); // Tick bei 200ms: Cookie-Check vor Timeout-Check
    const r = await p;
    expect(r.success).toBe(true);
  });

  it('T06: Interval-Timing: wird alle 50ms geprüft', async () => {
    vi.useFakeTimers();
    let reads = 0;
    vi.spyOn(document, 'cookie', 'get').mockImplementation(() => {
      reads++;
      return '';
    });
    const p = waitForCookieRestore(200, 50);
    await vi.advanceTimersByTimeAsync(200); // Ticks bei 50, 100, 150, 200
    await p;
    expect(reads).toBeGreaterThanOrEqual(4);
  });

  it('T07: Duration wird korrekt gemessen', async () => {
    vi.useFakeTimers();
    const p = waitForCookieRestore(150, 50);
    await vi.advanceTimersByTimeAsync(150);
    const r = await p;
    expect(r.duration).toBeGreaterThanOrEqual(150);
  });
});

describe('probeRestore', () => {
  it('T08: fetch wird mit credentials: include aufgerufen', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    await probeRestore('/metrics');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('T09: fetch URL = endpoint + /oil2/restore', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    await probeRestore('/metrics');
    expect(fetchMock).toHaveBeenCalledWith('/metrics/oil2/restore', expect.anything());
  });

  it('Y4: Trailing-Slash am Endpoint wird normalisiert (kein //)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    await probeRestore('/metrics/');
    expect(fetchMock).toHaveBeenCalledWith('/metrics/oil2/restore', expect.anything());
  });

  it('T10: Probe erfolgreich, Cookie erscheint → success, source = probe', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    setCookie('oil2', makeCookiePayload()); // Probe hat den Cookie gesetzt
    const r = await probeRestore('/metrics');
    expect(r.success).toBe(true);
    expect(r.source).toBe('probe');
  });

  it('T11: Probe erfolgreich, Cookie erscheint nicht → success = false', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    const r = await probeRestore('/metrics');
    expect(r.success).toBe(false);
  });

  it('T12: Netzwerkfehler → success = false, console.warn', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);
    const r = await probeRestore('/metrics');
    expect(r.success).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Probe'));
  });

  it('T13: 404 Response → success = false (Template nicht installiert)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal('fetch', fetchMock);
    // Kein Cookie gesetzt → kein Restore
    const r = await probeRestore('/metrics');
    expect(r.success).toBe(false);
  });
});
