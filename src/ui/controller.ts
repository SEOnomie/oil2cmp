/**
 * OIL2 — UI Controller
 *
 * Orchestriert Banner und (lazy geladenes) Preference Center und uebersetzt
 * zwischen UI-Events und Engine-Aktionen. Implementiert das EngineUI-Interface
 * (showBanner / hideBanner / showPreferences), das der Engine antreibt; die
 * Widget-Callbacks (Accept/Reject/Customize, Save/Close) routen via `actions`
 * zurueck in die Engine.
 *
 * Late-Binding: `actions` referenziert die Engine, die ihrerseits diesen
 * Controller als ui-Dependency erhaelt. Da die Callbacks erst bei User-Inter-
 * aktion feuern (nach init), ist der Zirkelbezug unkritisch.
 *
 * @see SPEZIFIKATION.md §11, §12, §13
 */

import type { OIL2Config, ConsentChoices, ConsentAction } from '../core/types';
import { createBanner, type BannerInstance } from './banner';
import type { PreferenceInstance } from './preferences';

/** Engine-Aktionen, die das UI ausloest (late-bound an den Composition Root). */
export interface UIActions {
  setConsent: (choices: ConsentChoices, action: ConsentAction) => void;
  getConsent: () => ConsentChoices;
  openPreferences: () => void;
}

export interface UIController {
  showBanner(): void;
  hideBanner(): void;
  showPreferences(): void;
  destroy(): void;
}

function _all(value: boolean): ConsentChoices {
  return { functional: value, analytics: value, marketing: value };
}

export function createUIController(config: OIL2Config, actions: UIActions): UIController {
  let _banner: BannerInstance | null = null;
  let _prefs: PreferenceInstance | null = null;
  let _bannerVisible = false;

  function _ensureBanner(): BannerInstance {
    if (_banner) return _banner;
    _banner = createBanner(config, {
      onAcceptAll: () => actions.setConsent(_all(true), 'accept_all'),
      onRejectAll: () => actions.setConsent(_all(false), 'reject_all'),
      onCustomize: () => actions.openPreferences(),
    });
    return _banner;
  }

  function showBanner(): void {
    _ensureBanner().show();
    _bannerVisible = true;
  }

  function hideBanner(): void {
    if (_banner) _banner.hide();
    _bannerVisible = false;
  }

  function showPreferences(): void {
    // Merken, ob das Banner sichtbar war (Erstbesuch) -> beim Schliessen ohne
    // Speichern wieder zeigen, damit der User noch entscheiden kann (DSGVO).
    const reshowBannerOnClose = _bannerVisible;
    if (_banner) {
      _banner.hide();
      _bannerVisible = false;
    }

    // Lazy-Load: Preference Center ist ein separater Chunk (zaehlt nicht zum Core-Budget).
    void import('./preferences').then((mod) => {
      if (_prefs) _prefs.destroy();
      _prefs = mod.createPreferences(config, actions.getConsent(), {
        onSave: (choices) => {
          actions.setConsent(choices, 'custom');
          if (_prefs) _prefs.hide();
        },
        onClose: () => {
          if (_prefs) _prefs.hide();
          if (reshowBannerOnClose) showBanner();
        },
      });
      _prefs.show();
    });
  }

  function destroy(): void {
    if (_banner) {
      _banner.destroy();
      _banner = null;
    }
    if (_prefs) {
      _prefs.destroy();
      _prefs = null;
    }
    _bannerVisible = false;
  }

  return { showBanner, hideBanner, showPreferences, destroy };
}
