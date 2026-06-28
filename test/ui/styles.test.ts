/**
 * OIL2 — Styles Tests
 *
 * happy-dom rendert CSS nicht visuell -> wir pruefen den generierten CSS-String
 * inhaltlich (Theme-Tokens, Positionierung, equalButtons, A11y).
 */

import { describe, it, expect } from 'vitest';
import { getBannerStyles, getPreferencesStyles } from '../../src/ui/styles';
import type { OIL2Config } from '../../src/core/types';

function cfg(ui: Partial<OIL2Config['ui']> = {}): OIL2Config {
  return {
    ui: { theme: 'light', position: 'bottom', equalButtons: true, ...ui },
  } as OIL2Config;
}

describe('getBannerStyles — Theming', () => {
  it('light: Light-Vars, kein Dark-Media-Query', () => {
    const css = getBannerStyles(cfg({ theme: 'light' }));
    expect(css).toContain('--oil2-bg: #ffffff');
    expect(css).not.toContain('prefers-color-scheme: dark');
  });

  it('dark: Dark-Override im :host', () => {
    const css = getBannerStyles(cfg({ theme: 'dark' }));
    expect(css).toContain('--oil2-bg: #1a1a18');
    expect(css).not.toContain('prefers-color-scheme: dark');
  });

  it('auto: Dark via prefers-color-scheme', () => {
    const css = getBannerStyles(cfg({ theme: 'auto' }));
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).toContain('--oil2-bg: #1a1a18');
  });
});

describe('getBannerStyles — Position', () => {
  it('bottom: am unteren Rand', () => {
    expect(getBannerStyles(cfg({ position: 'bottom' }))).toContain('bottom: 0;');
  });
  it('top: am oberen Rand', () => {
    expect(getBannerStyles(cfg({ position: 'top' }))).toContain('top: 0;');
  });
  it('center: Modal-Overlay', () => {
    const css = getBannerStyles(cfg({ position: 'center' }));
    expect(css).toContain('inset: 0');
    expect(css).toContain('rgba(0,0,0,.5)');
    expect(css).toContain('max-width: 520px');
  });
});

describe('getBannerStyles — equalButtons', () => {
  it('true: Accept nutzt sekundaeren (gleichwertigen) Style', () => {
    const css = getBannerStyles(cfg({ equalButtons: true }));
    expect(css).toContain('.oil2-btn-accept { background: var(--oil2-btn-sec-bg)');
  });
  it('false: Accept gefuellt (hervorgehoben)', () => {
    const css = getBannerStyles(cfg({ equalButtons: false }));
    expect(css).toContain('.oil2-btn-accept { background: var(--oil2-btn-bg)');
  });
});

describe('getBannerStyles — Accessibility', () => {
  it('44px Touch-Target (min-height)', () => {
    expect(getBannerStyles(cfg())).toContain('min-height: 44px');
  });
  it('focus-visible Outline', () => {
    expect(getBannerStyles(cfg())).toContain(':focus-visible');
  });
  it('prefers-reduced-motion respektiert', () => {
    expect(getBannerStyles(cfg())).toContain('prefers-reduced-motion: reduce');
  });
});

describe('getPreferencesStyles', () => {
  it('enthaelt Toggle und Modal', () => {
    const css = getPreferencesStyles(cfg());
    expect(css).toContain('.oil2-toggle');
    expect(css).toContain('.oil2-prefs');
    expect(css).toContain('rgba(0,0,0,.5)');
  });
  it('Toggle hat 44px Touch-Breite und disabled-State', () => {
    const css = getPreferencesStyles(cfg());
    expect(css).toContain('min-width: 44px');
    expect(css).toContain('.oil2-toggle:disabled');
  });
  it('respektiert Theme (dark)', () => {
    expect(getPreferencesStyles(cfg({ theme: 'dark' }))).toContain('--oil2-bg: #1a1a18');
  });
});
