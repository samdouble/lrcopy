import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

export default defineConfig(({ mode }) => {
  const browser = mode === 'firefox' ? 'firefox' : 'chrome';

  return {
    plugins: [
      crx({
        manifest,
        browser,
      }),
    ],
    build: {
      outDir: `dist/${browser}`,
      emptyOutDir: true,
    },
    server: {
      cors: {
        origin: [/chrome-extension:\/\//],
      },
    },
  };
});
