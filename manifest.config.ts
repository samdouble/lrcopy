import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'lrcopy',
  version: '0.0.0',
  description: 'Does nothing — yet.',
  background: {
    service_worker: 'src/background.ts',
    type: 'module',
  },
})
