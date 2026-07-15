import {
  MENU_ID,
  compressBlob,
  formatBytes,
  getJpegQuality,
  getMaxEdge,
  type CompressedPayload,
  type CopyJob,
} from './shared';

let currentJob: CopyJob = { status: 'idle' };

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Copy smaller image',
      contexts: ['image'],
    });
  });
});

async function flashBadge(text: string, color: string) {
  await chrome.action.setBadgeBackgroundColor({ color });
  await chrome.action.setBadgeText({ text });
  setTimeout(() => {
    void chrome.action.setBadgeText({ text: '' });
  }, 2500);
}

type InPageCompressResult =
  | { ok: true; payload: CompressedPayload }
  | { ok: false; error: string }

async function compressInPage(
  tabId: number,
  srcUrl: string,
  maxEdge: number,
  quality: number,
): Promise<InPageCompressResult> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      args: [srcUrl, maxEdge, quality],
      func: async (src: string, maxEdge: number, quality: number) => {
        const scaleDimensions = (width: number, height: number) => {
          const longest = Math.max(width, height);
          if (longest <= maxEdge) return { width, height };
          const scale = maxEdge / longest;
          return {
            width: Math.max(1, Math.round(width * scale)),
            height: Math.max(1, Math.round(height * scale)),
          };
        };

        const blobToBase64 = async (blob: Blob) => {
          const buffer = await blob.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          return btoa(binary);
        };

        const canvasToJpeg = async (
          source: CanvasImageSource,
          sourceWidth: number,
          sourceHeight: number,
          inputBytes: number,
        ) => {
          const { width, height } = scaleDimensions(sourceWidth, sourceHeight);
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Could not create canvas context.');

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(source, 0, 0, width, height);

          const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
              (result) =>
                result ? resolve(result) : reject(new Error('JPEG encode failed.')),
              'image/jpeg',
              quality,
            );
          });

          return {
            base64: await blobToBase64(blob),
            mimeType: 'image/jpeg',
            bytes: blob.size,
            width,
            height,
            inputBytes,
          };
        };

        const collectImages = (root: ParentNode): HTMLImageElement[] => {
          const images = Array.from(root.querySelectorAll('img'));
          for (const el of root.querySelectorAll('*')) {
            if (el.shadowRoot) {
              images.push(...collectImages(el.shadowRoot));
            }
          }
          return images;
        };

        const findImage = () =>
          collectImages(document).find(
            (image) => image.currentSrc === src || image.src === src,
          ) ?? null;

        // 1) Use the pixels already decoded in the page (no network).
        const existing = findImage();
        if (existing && existing.naturalWidth > 0) {
          try {
            const payload = await canvasToJpeg(
              existing,
              existing.naturalWidth,
              existing.naturalHeight,
              existing.naturalWidth * existing.naturalHeight * 4,
            );
            return { ok: true as const, payload };
          } catch (error) {
            // Try fetching from the page next
            console.warn('Canvas export failed', error);
          }
        }

        // 2) Re-fetch with the page's cookies / referrer
        try {
          const response = await fetch(src, {
            credentials: 'include',
            cache: 'force-cache',
          });
          if (!response.ok) {
            throw new Error(`Page fetch failed (${response.status}).`);
          }
          const inputBlob = await response.blob();
          const bitmap = await createImageBitmap(inputBlob);
          try {
            const payload = await canvasToJpeg(
              bitmap,
              bitmap.width,
              bitmap.height,
              inputBlob.size,
            );
            return { ok: true as const, payload };
          } finally {
            bitmap.close();
          }
        } catch (error) {
          return {
            ok: false as const,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      },
    });

    const result = results[0]?.result;
    if (!result) {
      return { ok: false, error: 'In-page compression returned no result.' };
    }
    return result;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function fetchImageInWorker(srcUrl: string): Promise<Blob> {
  const response = await fetch(srcUrl, { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(`Worker fetch failed (${response.status}).`);
  }
  return response.blob();
}

async function compressImage(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab,
): Promise<CompressedPayload> {
  const srcUrl = info.srcUrl;
  if (!srcUrl) {
    throw new Error('No image URL on the clicked element.');
  }

  const [maxEdge, quality] = await Promise.all([getMaxEdge(), getJpegQuality()]);

  if (tab?.id != null) {
    const inPage = await compressInPage(tab.id, srcUrl, maxEdge, quality);
    if (inPage.ok) {
      return inPage.payload;
    }
    console.warn('In-page compression failed, trying extension fetch.', inPage.error);
  }

  if (srcUrl.startsWith('blob:') || srcUrl.startsWith('data:')) {
    if (srcUrl.startsWith('data:')) {
      const response = await fetch(srcUrl);
      return compressBlob(await response.blob(), maxEdge, quality);
    }
    throw new Error(
      'Could not read this image from the page. Try a normal http(s) image.',
    );
  }

  try {
    const inputBlob = await fetchImageInWorker(srcUrl);
    return await compressBlob(inputBlob, maxEdge, quality);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not download image (${srcUrl.slice(0, 120)}). ${message}`, {
      cause: error,
    });
  }
}

async function openCopyUi() {
  try {
    await chrome.action.openPopup();
    return;
  } catch (error) {
    console.warn('openPopup failed, falling back to a popup window.', error);
  }

  await chrome.windows.create({
    url: chrome.runtime.getURL('src/copy.html'),
    type: 'popup',
    focused: true,
    width: 300,
    height: 240,
  });
}

async function runCompression(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab,
) {
  try {
    const compressed = await compressImage(info, tab);

    currentJob = {
      status: 'ready',
      base64: compressed.base64,
      mimeType: compressed.mimeType,
      bytes: compressed.bytes,
      width: compressed.width,
      height: compressed.height,
      inputBytes: compressed.inputBytes,
    };

    console.info(
      `lrcopy: ${formatBytes(compressed.inputBytes)} → ${formatBytes(compressed.bytes)} ` +
        `(${compressed.width}×${compressed.height})`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(error);
    currentJob = { status: 'error', error: message };
    await flashBadge('!', '#c62828');
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID) return;

  currentJob = { status: 'compressing' };

  void openCopyUi();
  void runCompression(info, tab);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'get-job') {
    sendResponse(currentJob);
    return;
  }

  if (message?.type === 'copy-result') {
    void (async () => {
      if (message.ok && typeof message.bytes === 'number') {
        await flashBadge(formatBytes(message.bytes), '#2e7d32');
      } else {
        console.error('Clipboard write failed:', message.error);
        await flashBadge('!', '#c62828');
      }
      currentJob = { status: 'idle' };
      sendResponse({ ok: true });
    })();
    return true;
  }
});
