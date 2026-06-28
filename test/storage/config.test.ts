/**
 * OIL2 — Config Parser Tests
 * @see TESTS.md §2 (T01–T23)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseConfig, getConfigHash, hasConfigChanged } from '../../src/storage/config';
import { injectConfig, injectRawConfig, cleanup } from '../helpers';

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
  cleanup();
});

describe('parseConfig', () => {
  it('T01: Config-Element vorhanden → gibt geparste Config zurück', () => {
    injectConfig({ _v: 2, consentMode: 'basic' });
    const cfg = parseConfig();
    expect(cfg._v).toBe(2);
    expect(cfg.consentMode).toBe('basic');
  });

  it('T02: Config-Element fehlt → Default-Config + console.warn', () => {
    const cfg = parseConfig();
    expect(cfg._v).toBe(1);
    expect(cfg.consentMode).toBe('advanced');
    expect(cfg.cookie.days).toBe(365);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
  });

  it('T03: leeres JSON {} → Default-Config', () => {
    injectConfig({});
    const cfg = parseConfig();
    expect(cfg._v).toBe(1);
    expect(cfg.ui.position).toBe('bottom');
    expect(cfg.clarity.category).toBe('marketing');
  });

  it('T04: ungültiges JSON → Default-Config + console.warn', () => {
    injectRawConfig('{ not valid json ::: ');
    const cfg = parseConfig();
    expect(cfg._v).toBe(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid config JSON'));
  });

  it('T05: Partial Config → mergt mit Defaults', () => {
    injectConfig({ consentMode: 'basic' });
    const cfg = parseConfig();
    expect(cfg.consentMode).toBe('basic');
    expect(cfg.cookie.days).toBe(365); // Default aufgefüllt
    expect(cfg.ui.theme).toBe('light'); // Default aufgefüllt
  });

  it('T06: Deep-Merge nested Objekte korrekt', () => {
    injectConfig({ ui: { labels: { title: 'Custom Title' } } } as Record<string, unknown>);
    const cfg = parseConfig();
    expect(cfg.ui.labels.title).toBe('Custom Title'); // überschrieben
    expect(cfg.ui.labels.acceptAll).toBe('Alle akzeptieren'); // Default erhalten
    expect(cfg.ui.position).toBe('bottom'); // Default erhalten
  });

  it('T07: Unbekannte Felder werden ignoriert (kein Error)', () => {
    injectConfig({ _v: 1, unknownField: 'foo', deep: { nested: true } } as Record<string, unknown>);
    expect(() => parseConfig()).not.toThrow();
    const cfg = parseConfig();
    expect(cfg._v).toBe(1);
  });

  it('T08: _v = 0 → Fallback auf 1 + warn', () => {
    injectConfig({ _v: 0 });
    const cfg = parseConfig();
    expect(cfg._v).toBe(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('_v'));
  });

  it('T09: _v = -5 → Fallback auf 1 + warn', () => {
    injectConfig({ _v: -5 });
    const cfg = parseConfig();
    expect(cfg._v).toBe(1);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("T10: _v = 'abc' → Fallback auf 1 + warn", () => {
    injectConfig({ _v: 'abc' } as Record<string, unknown>);
    const cfg = parseConfig();
    expect(cfg._v).toBe(1);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("T11: consentMode = 'invalid' → Fallback auf 'advanced' + warn", () => {
    injectConfig({ consentMode: 'invalid' } as Record<string, unknown>);
    const cfg = parseConfig();
    expect(cfg.consentMode).toBe('advanced');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('consentMode'));
  });

  it('T12: server.restoreTimeout = 50 (unter Minimum) → Fallback auf 500 + warn', () => {
    injectConfig({ server: { restoreTimeout: 50 } } as Record<string, unknown>);
    const cfg = parseConfig();
    expect(cfg.server.restoreTimeout).toBe(500);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('restoreTimeout'));
  });

  it('T13: server.restoreTimeout = 5000 (über Maximum) → Fallback auf 500 + warn', () => {
    injectConfig({ server: { restoreTimeout: 5000 } } as Record<string, unknown>);
    const cfg = parseConfig();
    expect(cfg.server.restoreTimeout).toBe(500);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('T14: cookie.days = 0 → Fallback auf 365 + warn', () => {
    injectConfig({ cookie: { days: 0 } } as Record<string, unknown>);
    const cfg = parseConfig();
    expect(cfg.cookie.days).toBe(365);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('cookie.days'));
  });

  it('T15: cookie.days = 400 → Fallback auf 365 + warn', () => {
    injectConfig({ cookie: { days: 400 } } as Record<string, unknown>);
    const cfg = parseConfig();
    expect(cfg.cookie.days).toBe(365);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("T16: clarity.category = 'invalid' → Fallback auf 'marketing' + warn", () => {
    injectConfig({ clarity: { category: 'invalid' } } as Record<string, unknown>);
    const cfg = parseConfig();
    expect(cfg.clarity.category).toBe('marketing');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('clarity.category'));
  });

  it('T17: server.enabled = true, endpoint = "" → Warn ausgeben', () => {
    injectConfig({ server: { enabled: true } } as Record<string, unknown>);
    parseConfig();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('endpoint'));
  });

  it('T18: server.mode = "subdomain" → Warn ausgeben (kein ITP Bypass)', () => {
    injectConfig({ server: { mode: 'subdomain' } } as Record<string, unknown>);
    const cfg = parseConfig();
    expect(cfg.server.mode).toBe('subdomain'); // gültiger Wert, kein Fallback
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Subdomain'));
  });

  it('Stufe C: server.consentBeacon default false', () => {
    injectConfig({});
    expect(parseConfig().server.consentBeacon).toBe(false);
  });

  it('Stufe C: consentBeacon übernommen wenn gesetzt', () => {
    injectConfig({ server: { enabled: true, endpoint: '/m', consentBeacon: true } } as Record<string, unknown>);
    expect(parseConfig().server.consentBeacon).toBe(true);
  });

  it('Stufe C: consentBeacon=true ohne endpoint → Warn', () => {
    injectConfig({ server: { consentBeacon: true } } as Record<string, unknown>);
    parseConfig();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('consentBeacon'));
  });
});

describe('getConfigHash', () => {
  it('T19: Gibt config._v als Hash zurück', () => {
    injectConfig({ _v: 5 });
    const cfg = parseConfig();
    expect(getConfigHash(cfg)).toBe(5);
  });

  it('T20: Verschiedene _v Werte → verschiedene Hashes', () => {
    injectConfig({ _v: 3 });
    const a = getConfigHash(parseConfig());
    cleanup();
    injectConfig({ _v: 7 });
    const b = getConfigHash(parseConfig());
    expect(a).not.toBe(b);
  });
});

describe('hasConfigChanged', () => {
  it('T21: storedVersion === config._v → false', () => {
    injectConfig({ _v: 4 });
    const cfg = parseConfig();
    expect(hasConfigChanged(4, cfg)).toBe(false);
  });

  it('T22: storedVersion !== config._v → true', () => {
    injectConfig({ _v: 4 });
    const cfg = parseConfig();
    expect(hasConfigChanged(2, cfg)).toBe(true);
  });

  it('T23: storedVersion = 0 (korrupter Cookie) → true', () => {
    injectConfig({ _v: 1 });
    const cfg = parseConfig();
    expect(hasConfigChanged(0, cfg)).toBe(true);
  });
});
