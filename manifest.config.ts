import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'lrcopy',
  version: '0.1.0',
  description: 'Right-click an image to copy a smaller, lighter version.',
  permissions: ['contextMenus', 'clipboardWrite', 'scripting', 'storage'],
  host_permissions: ['<all_urls>'],
  background: {
    service_worker: 'src/background.ts',
    type: 'module',
  },
  action: {
    default_title: 'lrcopy',
    default_popup: 'src/copy.html',
  },
});
