import { defineConfig } from 'vite';

// Builds one IIFE script plus one stylesheet that scripts/build-artifact.mjs
// inlines into a single HTML file for publishing as a claude.ai artifact.
export default defineConfig({
  build: {
    outDir: 'dist-artifact',
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: 'src/artifact.ts',
      formats: ['iife'],
      name: 'PixelGambit',
      fileName: () => 'game.js',
      cssFileName: 'game',
    },
  },
});
