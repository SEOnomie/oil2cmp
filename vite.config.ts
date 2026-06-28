import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8')) as { version: string };

// Zwei-Pass-Build: IIFE und ES werden getrennt erzeugt, weil IIFE kein
// Code-Splitting beherrscht (Preferences ist ein dynamischer import()).
//   - IIFE (oil2.min.js): inlineDynamicImports -> ein selbst-gehostetes File
//     (kein fragiler Chunk-Pfad beim Laden via sGTM File Proxy).
//   - ES  (oil2.es.js):   splittet -> Preferences als Lazy-Chunk (zaehlt nicht
//     zum Core-Budget; Bundler der npm-Nutzer entscheiden ueber das Laden).
// Gesteuert ueber OIL2_FORMAT; das build-Script ruft beide Paesse auf.
const isES = process.env.OIL2_FORMAT === 'es';

export default defineConfig({
  define: {
    __OIL2_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    // ES laeuft als zweiter Pass -> dist nicht leeren (IIFE-Artefakte behalten).
    emptyOutDir: !isES,
    lib: {
      entry: 'src/index.ts',
      name: 'OIL2Bundle',
      formats: [isES ? 'es' : 'iife'],
      fileName: () => (isES ? 'oil2.es.js' : 'oil2.min.js'),
    },
    minify: 'terser',
    terserOptions: {
      compress: { passes: 2, pure_getters: true, unsafe_arrows: true },
      mangle: {
        properties: {
          regex: /^_/,
          reserved: ['_v', '_ab'],
        },
      },
    },
    rollupOptions: {
      output: { inlineDynamicImports: !isES },
    },
    sourcemap: true,
    target: 'es2020',
    reportCompressedSize: true,
  },
});
