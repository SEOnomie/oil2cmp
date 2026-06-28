# SKILLS.md — oil2

<!-- MANUELL -->
## Manuelle Skills

<!-- /MANUELL -->

<!-- AUTO-GENERIERT — NICHT MANUELL BEARBEITEN -->
*Letzte Analyse: 2026-04-05 23:02*

# Bewährte Muster aus oil2 - Vite Konfiguration

## 1. Strikte Port-Konfiguration für Entwicklungsumgebung

**Muster**: Explizite Port-Definition mit `strictPort: true` verhindert automatische Port-Wechsel.

```typescript
// vite.config.ts
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5201,
    strictPort: true, // Verhindert automatischen Fallback auf anderen Port
  },
})
```

**Nutzen**: Garantiert konsistente URLs während der Entwicklung, wichtig für API-Endpunkte und CORS-Konfiguration.

## 2. Minimale Vite-Konfiguration

**Muster**: Nur notwendige Konfigurationen definieren, Standard-Verhalten von Vite nutzen.

```typescript
// vite.config.ts
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5201,
    strictPort: true,
  },
})
```

**Nutzen**: Reduziert Komplexität und potentielle Konflikte durch zu viele Custom-Einstellungen.

## 3. TypeScript-basierte Vite-Konfiguration

**Muster**: Verwendung von `.ts` Endung für Vite-Config mit `defineConfig` Helper.

```typescript
// vite.config.ts
import { defineConfig } from 'vite'

export default defineConfig({
  // TypeScript-Typen werden automatisch bereitgestellt
  server: {
    port: 5201,
    strictPort: true,
  },
})
```

**Nutzen**: IntelliSense und Typsicherheit für Konfigurationsoptionen.

<!-- AUTO-GENERIERT -->
```typescript
// Minimale Vite-Konfiguration mit strikter Port-Kontrolle
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5201,
    strictPort: true,
  },
})
```
<!-- /AUTO-GENERIERT -->
<!-- /AUTO-GENERIERT -->
