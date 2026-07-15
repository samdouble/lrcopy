import { defineManifest } from '@crxjs/vite-plugin';
import packageJson from './package.json' with { type: 'json' };

const geckoId = 'lrcopy@samdouble';

export default defineManifest(({ mode }) => {
  const isFirefox = mode === 'firefox';

  return {
    manifest_version: 3,
    name: 'lrcopy',
    version: packageJson.version,
    description: 'Right-click an image to copy a smaller, lighter version.',
    permissions: ['contextMenus', 'clipboardWrite', 'scripting', 'storage'],
    host_permissions: ['<all_urls>'],
    background: isFirefox
      ? {
          scripts: ['src/background.ts'],
          type: 'module',
        }
      : {
          service_worker: 'src/background.ts',
          type: 'module',
        },
    action: {
      default_title: 'lrcopy',
      default_popup: 'src/copy.html',
    },
    ...(isFirefox
      ? {
          browser_specific_settings: {
            gecko: {
              id: geckoId,
              strict_min_version: '109.0',
              data_collection_permissions: {
                required: ['none'],
              },
            },
          },
        }
      : {}),
  };
});
