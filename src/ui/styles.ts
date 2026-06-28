/**
 * OIL2 — CSS-in-JS (Shadow DOM Styles)
 *
 * Generiert CSS-Strings fuer die Shadow-DOM-Injection von Banner und Preference
 * Center. Theming ueber CSS Custom Properties (von aussen ueberschreibbar via
 * `#oil2-banner-host { --oil2-* }`). Self-contained: System-Fonts, kein
 * externes Font-Loading.
 *
 * @see SPEZIFIKATION.md §14
 * @see PROJEKT.md §13.3 (Shadow DOM CSS Isolation)
 */

import type { OIL2Config } from '../core/types';

// ============================================================================
// Theme-Tokens
// ============================================================================

/** Light-Theme Custom Properties (Default). */
const LIGHT_VARS = `
  --oil2-bg: #ffffff;
  --oil2-text: #1a1a1a;
  --oil2-text-muted: #6b6b67;
  --oil2-btn-bg: #1a1a1a;
  --oil2-btn-text: #ffffff;
  --oil2-btn-border: #1a1a1a;
  --oil2-btn-sec-bg: #f0f0ec;
  --oil2-btn-sec-text: #1a1a1a;
  --oil2-btn-sec-border: #d8d8d2;
  --oil2-link: #2563eb;
  --oil2-border: #e2e2dc;
  --oil2-shadow: 0 12px 40px rgba(0,0,0,.14), 0 4px 12px rgba(0,0,0,.08);
  --oil2-radius: 12px;
  --oil2-font: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --oil2-z: 999999;`;

/** Dark-Theme Custom Properties. */
const DARK_VARS = `
  --oil2-bg: #1a1a18;
  --oil2-text: #f5f5f0;
  --oil2-text-muted: #9a9a94;
  --oil2-btn-bg: #f5f5f0;
  --oil2-btn-text: #0d0d0b;
  --oil2-btn-border: #f5f5f0;
  --oil2-btn-sec-bg: #222220;
  --oil2-btn-sec-text: #f5f5f0;
  --oil2-btn-sec-border: #2a2a28;
  --oil2-link: #60a5fa;
  --oil2-border: #2a2a28;
  --oil2-shadow: 0 20px 60px rgba(0,0,0,.6);`;

/**
 * Baut den :host-Block inkl. Theme-Handling.
 * - light: nur Light-Vars
 * - dark:  Light-Vars + Dark-Override
 * - auto:  Light-Vars + Dark-Override via prefers-color-scheme
 */
function _hostVars(config: OIL2Config): string {
  const base = `:host {${LIGHT_VARS}\n}`;
  if (config.ui.theme === 'dark') {
    return base + `\n:host {${DARK_VARS}\n}`;
  }
  if (config.ui.theme === 'auto') {
    return base + `\n@media (prefers-color-scheme: dark) { :host {${DARK_VARS}\n} }`;
  }
  return base;
}

/** Positionierung des :host-Containers (bottom/top als Leiste, center als Modal). */
function _hostPosition(config: OIL2Config): string {
  const common = ':host { position: fixed; z-index: var(--oil2-z); font-family: var(--oil2-font); box-sizing: border-box; }';
  if (config.ui.position === 'center') {
    return (
      common +
      ':host { inset: 0; display: flex; align-items: center; justify-content: center; ' +
      'background: rgba(0,0,0,.5); padding: 16px; }'
    );
  }
  const edge = config.ui.position === 'top' ? 'top: 0;' : 'bottom: 0;';
  return common + ':host { left: 0; right: 0; ' + edge + ' }';
}

// ============================================================================
// Public API
// ============================================================================

/** CSS fuer das Shadow-DOM-Banner. */
export function getBannerStyles(config: OIL2Config): string {
  const equal = config.ui.equalButtons;

  // Accept-Button: bei equalButtons sekundaer (gleichwertig, DSGVO), sonst gefuellt.
  const acceptStyle = equal
    ? `.oil2-btn-accept { background: var(--oil2-btn-sec-bg); color: var(--oil2-btn-sec-text); border-color: var(--oil2-btn-sec-border); }`
    : `.oil2-btn-accept { background: var(--oil2-btn-bg); color: var(--oil2-btn-text); border-color: var(--oil2-btn-border); }`;

  const cardWidth = config.ui.position === 'center' ? 'max-width: 520px; border-radius: 16px;' : 'border-radius: 0;';

  return `
${_hostVars(config)}
${_hostPosition(config)}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.oil2-banner {
  background: var(--oil2-bg);
  color: var(--oil2-text);
  width: 100%;
  ${cardWidth}
  border: 1px solid var(--oil2-border);
  box-shadow: var(--oil2-shadow);
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 20px 24px;
  font-size: 14px;
  line-height: 1.6;
}

.oil2-banner-content { flex: 1; min-width: 0; }
.oil2-banner-title { font-size: 16px; font-weight: 700; margin-bottom: 6px; letter-spacing: -.01em; }
.oil2-banner-description { color: var(--oil2-text-muted); font-size: 13px; }
.oil2-banner-links { display: flex; gap: 16px; margin-top: 8px; font-size: 12px; }
.oil2-banner-links a { color: var(--oil2-link); text-decoration: none; }
.oil2-banner-links a:hover { text-decoration: underline; }

.oil2-banner-actions { display: flex; gap: 8px; flex-shrink: 0; }

.oil2-btn {
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  min-height: 44px;
  padding: 0 18px;
  border-radius: var(--oil2-radius);
  border: 1.5px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity .15s, background .15s, border-color .15s;
}
.oil2-btn-reject, .oil2-btn-customize {
  background: var(--oil2-btn-sec-bg);
  color: var(--oil2-btn-sec-text);
  border-color: var(--oil2-btn-sec-border);
}
${acceptStyle}
.oil2-btn:hover { opacity: .88; }
.oil2-btn:focus-visible { outline: 2px solid var(--oil2-link); outline-offset: 2px; }

@media (max-width: 768px) {
  .oil2-banner { flex-direction: column; align-items: stretch; gap: 16px; }
  .oil2-banner-actions { flex-direction: column; }
  .oil2-btn { width: 100%; }
}

@media (prefers-reduced-motion: reduce) {
  .oil2-btn { transition: none; }
}
`;
}

/** CSS fuer das Preference Center (Modal-Overlay). */
export function getPreferencesStyles(config: OIL2Config): string {
  return `
${_hostVars(config)}
:host {
  position: fixed; inset: 0; z-index: var(--oil2-z);
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,.5); padding: 16px;
  font-family: var(--oil2-font);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.oil2-prefs {
  background: var(--oil2-bg);
  color: var(--oil2-text);
  width: 100%;
  max-width: 480px;
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--oil2-border);
  border-radius: 16px;
  box-shadow: var(--oil2-shadow);
  overflow: hidden;
}

.oil2-prefs-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--oil2-border);
  display: flex; align-items: flex-start; justify-content: space-between;
}
.oil2-prefs-title { font-size: 17px; font-weight: 700; letter-spacing: -.01em; }
.oil2-prefs-close {
  width: 32px; height: 32px; min-width: 32px;
  border: 1px solid var(--oil2-border); border-radius: 8px;
  background: transparent; color: var(--oil2-text-muted);
  font-size: 18px; cursor: pointer; line-height: 1;
}
.oil2-prefs-close:focus-visible { outline: 2px solid var(--oil2-link); outline-offset: 2px; }

.oil2-prefs-body { padding: 4px 0; overflow-y: auto; flex: 1; }

.oil2-prefs-category {
  padding: 16px 24px;
  border-bottom: 1px solid var(--oil2-border);
  display: flex; gap: 14px; align-items: flex-start;
}
.oil2-prefs-category:last-child { border-bottom: none; }
.oil2-prefs-cat-info { flex: 1; }
.oil2-prefs-cat-label { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
.oil2-prefs-cat-desc { font-size: 13px; color: var(--oil2-text-muted); margin-top: 3px; }
.oil2-prefs-always {
  font-size: 11px; font-weight: 600; color: #16a34a;
  background: rgba(22,163,74,.1); padding: 2px 8px; border-radius: 20px;
}

/* Native checkbox als Toggle, aber zugaenglich (kein div-Hack) */
.oil2-toggle {
  appearance: none; -webkit-appearance: none;
  width: 44px; height: 24px; min-width: 44px;
  border-radius: 12px; background: var(--oil2-btn-sec-border);
  border: none; cursor: pointer; position: relative;
  transition: background .2s; flex-shrink: 0;
}
.oil2-toggle::after {
  content: ''; position: absolute; top: 3px; left: 3px;
  width: 18px; height: 18px; border-radius: 50%;
  background: #fff; transition: transform .2s; box-shadow: 0 1px 3px rgba(0,0,0,.3);
}
.oil2-toggle:checked { background: var(--oil2-btn-bg); }
.oil2-toggle:checked::after { transform: translateX(20px); }
.oil2-toggle:disabled { background: #16a34a; cursor: not-allowed; }
.oil2-toggle:focus-visible { outline: 2px solid var(--oil2-link); outline-offset: 2px; }

.oil2-prefs-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--oil2-border);
  display: flex; gap: 8px; align-items: center;
}
.oil2-prefs-footer-link { font-size: 12px; margin-right: auto; }
.oil2-prefs-footer-link a { color: var(--oil2-link); text-decoration: none; }

.oil2-prefs-save {
  font-family: inherit; font-size: 13px; font-weight: 600;
  min-height: 44px; padding: 0 20px;
  background: var(--oil2-btn-bg); color: var(--oil2-btn-text);
  border: none; border-radius: var(--oil2-radius); cursor: pointer;
}
.oil2-prefs-save:hover { opacity: .88; }
.oil2-prefs-save:focus-visible { outline: 2px solid var(--oil2-link); outline-offset: 2px; }

@media (prefers-reduced-motion: reduce) {
  .oil2-toggle, .oil2-toggle::after { transition: none; }
}
`;
}
