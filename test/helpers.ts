/**
 * OIL2 — Test-Helpers
 *
 * Gemeinsame Utilities für alle Vitest-Suites. Adaptiert nach TESTS.md §1
 * (Vitest statt Jest: `vi.fn()` / `Mock`).
 */

import { vi, type Mock } from 'vitest';
import type { CookiePayload, OIL2Config } from '../src/core/types';

/** Simuliert document.cookie (setzt einen einzelnen Cookie). */
export function setCookie(name: string, value: string): void {
  document.cookie = `${name}=${value}; path=/`;
}

/** Entfernt alle Cookies. */
export function clearCookies(): void {
  document.cookie.split(';').forEach((c) => {
    document.cookie = c.trim().split('=')[0] + '=; max-age=0; path=/';
  });
}

/** Erstellt einen Base64-encodierten Cookie-Payload (mit optionalen Overrides). */
export function makeCookiePayload(overrides?: Partial<CookiePayload>): string {
  const payload: CookiePayload = {
    f: 1,
    a: 1,
    m: 0,
    t: Math.floor(Date.now() / 1000),
    v: 1,
    ab: 'A',
    ...overrides,
  };
  return btoa(JSON.stringify(payload));
}

/** Injiziert eine OIL2-Config als `<script id="oil2-config">` ins DOM. */
export function injectConfig(config: Partial<OIL2Config> | Record<string, unknown>): void {
  const el = document.createElement('script');
  el.id = 'oil2-config';
  el.type = 'application/json';
  el.textContent = JSON.stringify(config);
  document.head.appendChild(el);
}

/** Injiziert rohen (ggf. ungültigen) Config-Text ins DOM — für Parse-Error-Tests. */
export function injectRawConfig(raw: string): void {
  const el = document.createElement('script');
  el.id = 'oil2-config';
  el.type = 'application/json';
  el.textContent = raw;
  document.head.appendChild(el);
}

/** Cleanup nach jedem Test. */
export function cleanup(): void {
  clearCookies();
  document.getElementById('oil2-config')?.remove();
  document.getElementById('oil2-banner-host')?.remove();
  (window as unknown as Record<string, unknown>).dataLayer = undefined;
  (window as unknown as Record<string, unknown>).uetq = undefined;
  (window as unknown as Record<string, unknown>).clarity = undefined;
  (window as unknown as Record<string, unknown>).OIL2 = undefined;
}

/** Mock für window.dataLayer (gibt das Array zurück). */
export function mockDataLayer(): unknown[] {
  const dl: unknown[] = [];
  (window as unknown as Record<string, unknown>).dataLayer = dl;
  return dl;
}

/** Mock für window.clarity. */
export function mockClarity(): Mock {
  const fn = vi.fn();
  (window as unknown as Record<string, unknown>).clarity = fn;
  return fn;
}
