/**
 * OIL2 — UI Controller Tests
 *
 * Orchestrierung Banner <-> Engine-Aktionen <-> (lazy) Preference Center.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { createUIController, type UIActions, type UIController } from '../../src/ui/controller';
import { parseConfig } from '../../src/storage/config';
import { injectConfig, cleanup } from '../helpers';
import type { OIL2Config, ConsentChoices } from '../../src/core/types';

function makeConfig(partial: Record<string, unknown> = {}): OIL2Config {
  injectConfig(partial as Partial<OIL2Config>);
  const c = parseConfig();
  document.getElementById('oil2-config')?.remove();
  return c;
}

function makeActions(current: ConsentChoices): UIActions {
  return {
    setConsent: vi.fn(),
    getConsent: vi.fn(() => current),
    openPreferences: vi.fn(),
  };
}

const NONE: ConsentChoices = { functional: false, analytics: false, marketing: false };

function bannerShadow(): ShadowRoot | null {
  return document.getElementById('oil2-banner-host')?.shadowRoot ?? null;
}
function prefsShadow(): ShadowRoot | null {
  return document.getElementById('oil2-prefs-host')?.shadowRoot ?? null;
}

let ctrl: UIController | null = null;

afterEach(() => {
  ctrl?.destroy();
  ctrl = null;
  cleanup();
  document.body.innerHTML = '';
});

describe('Banner-Steuerung', () => {
  it('showBanner erzeugt und zeigt das Banner', () => {
    ctrl = createUIController(makeConfig(), makeActions(NONE));
    ctrl.showBanner();
    const host = document.getElementById('oil2-banner-host') as HTMLElement;
    expect(host).not.toBeNull();
    expect(host.style.display).not.toBe('none');
  });

  it('hideBanner versteckt das Banner', () => {
    ctrl = createUIController(makeConfig(), makeActions(NONE));
    ctrl.showBanner();
    ctrl.hideBanner();
    expect((document.getElementById('oil2-banner-host') as HTMLElement).style.display).toBe('none');
  });

  it('Accept routet zu setConsent(all true, accept_all)', () => {
    const actions = makeActions(NONE);
    ctrl = createUIController(makeConfig(), actions);
    ctrl.showBanner();
    (bannerShadow()!.querySelector('.oil2-btn-accept') as HTMLButtonElement).click();
    expect(actions.setConsent).toHaveBeenCalledWith(
      { functional: true, analytics: true, marketing: true },
      'accept_all',
    );
  });

  it('Reject routet zu setConsent(all false, reject_all)', () => {
    const actions = makeActions(NONE);
    ctrl = createUIController(makeConfig(), actions);
    ctrl.showBanner();
    (bannerShadow()!.querySelector('.oil2-btn-reject') as HTMLButtonElement).click();
    expect(actions.setConsent).toHaveBeenCalledWith(
      { functional: false, analytics: false, marketing: false },
      'reject_all',
    );
  });

  it('Customize routet zu openPreferences', () => {
    const actions = makeActions(NONE);
    ctrl = createUIController(makeConfig(), actions);
    ctrl.showBanner();
    (bannerShadow()!.querySelector('.oil2-btn-customize') as HTMLButtonElement).click();
    expect(actions.openPreferences).toHaveBeenCalledTimes(1);
  });
});

describe('Preference Center (lazy)', () => {
  it('showPreferences laedt und zeigt das Preference Center mit aktuellen Choices', async () => {
    const current: ConsentChoices = { functional: true, analytics: false, marketing: true };
    const actions = makeActions(current);
    ctrl = createUIController(makeConfig(), actions);
    ctrl.showPreferences();
    await vi.waitFor(() => expect(prefsShadow()).not.toBeNull());
    expect(actions.getConsent).toHaveBeenCalled();
    expect((prefsShadow()!.querySelector('#oil2-functional') as HTMLInputElement).checked).toBe(true);
    expect((prefsShadow()!.querySelector('#oil2-marketing') as HTMLInputElement).checked).toBe(true);
  });

  it('Save routet zu setConsent(custom) und schliesst das Center', async () => {
    const actions = makeActions(NONE);
    ctrl = createUIController(makeConfig(), actions);
    ctrl.showPreferences();
    await vi.waitFor(() => expect(prefsShadow()).not.toBeNull());
    (prefsShadow()!.querySelector('#oil2-analytics') as HTMLInputElement).checked = true;
    (prefsShadow()!.querySelector('.oil2-prefs-save') as HTMLButtonElement).click();
    expect(actions.setConsent).toHaveBeenCalledWith(
      { functional: false, analytics: true, marketing: false },
      'custom',
    );
    expect((document.getElementById('oil2-prefs-host') as HTMLElement).style.display).toBe('none');
  });

  it('Schliessen aus dem Erstbesuch-Flow zeigt das Banner wieder', async () => {
    const actions = makeActions(NONE);
    ctrl = createUIController(makeConfig(), actions);
    ctrl.showBanner(); // Banner sichtbar -> Erstbesuch
    ctrl.showPreferences();
    await vi.waitFor(() => expect(prefsShadow()).not.toBeNull());
    (prefsShadow()!.querySelector('.oil2-prefs-close') as HTMLButtonElement).click();
    expect((document.getElementById('oil2-banner-host') as HTMLElement).style.display).not.toBe(
      'none',
    );
  });

  it('Schliessen aus dem Footer-Flow zeigt KEIN Banner', async () => {
    const actions = makeActions(NONE);
    ctrl = createUIController(makeConfig(), actions);
    ctrl.showPreferences(); // ohne vorheriges showBanner -> Footer-Flow
    await vi.waitFor(() => expect(prefsShadow()).not.toBeNull());
    (prefsShadow()!.querySelector('.oil2-prefs-close') as HTMLButtonElement).click();
    expect(document.getElementById('oil2-banner-host')).toBeNull();
  });
});

describe('destroy', () => {
  it('entfernt Banner und Preference Center', async () => {
    ctrl = createUIController(makeConfig(), makeActions(NONE));
    ctrl.showBanner();
    ctrl.showPreferences();
    await vi.waitFor(() => expect(prefsShadow()).not.toBeNull());
    ctrl.destroy();
    ctrl = null;
    expect(document.getElementById('oil2-banner-host')).toBeNull();
    expect(document.getElementById('oil2-prefs-host')).toBeNull();
  });
});
