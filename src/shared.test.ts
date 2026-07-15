import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  JPEG_QUALITY,
  JPEG_QUALITY_STORAGE_KEY,
  MAX_EDGE_PX,
  MAX_EDGE_STORAGE_KEY,
  base64ToBlob,
  blobToBase64,
  clampJpegQuality,
  clampMaxEdge,
  compressBlob,
  formatBytes,
  getJpegQuality,
  getMaxEdge,
  scaleDimensions,
  setJpegQuality,
  setMaxEdge,
} from './shared';

describe('clampJpegQuality', () => {
  it('returns the default for non-finite values', () => {
    expect(clampJpegQuality(Number.NaN)).toBe(JPEG_QUALITY);
    expect(clampJpegQuality(Number.POSITIVE_INFINITY)).toBe(JPEG_QUALITY);
  });

  it('clamps values to the supported range', () => {
    expect(clampJpegQuality(0)).toBe(0.1);
    expect(clampJpegQuality(1.5)).toBe(1);
    expect(clampJpegQuality(0.5)).toBe(0.5);
  });
});

describe('clampMaxEdge', () => {
  it('returns the default for non-finite values', () => {
    expect(clampMaxEdge(Number.NaN)).toBe(MAX_EDGE_PX);
    expect(clampMaxEdge(Number.POSITIVE_INFINITY)).toBe(MAX_EDGE_PX);
  });

  it('clamps and rounds values to the supported range', () => {
    expect(clampMaxEdge(100)).toBe(640);
    expect(clampMaxEdge(5000)).toBe(4096);
    expect(clampMaxEdge(1280.4)).toBe(1280);
  });
});

describe('scaleDimensions', () => {
  it('keeps dimensions that already fit', () => {
    expect(scaleDimensions(800, 600, 1280)).toEqual({ width: 800, height: 600 });
  });

  it('scales down so the longest edge matches maxEdge', () => {
    expect(scaleDimensions(2560, 1440, 1280)).toEqual({ width: 1280, height: 720 });
    expect(scaleDimensions(1440, 2560, 1280)).toEqual({ width: 720, height: 1280 });
  });
});

describe('formatBytes', () => {
  it('formats bytes, kilobytes, and megabytes', () => {
    expect(formatBytes(512)).toBe('512B');
    expect(formatBytes(2048)).toBe('2K');
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5M');
  });
});

describe('blobToBase64 / base64ToBlob', () => {
  it('round-trips binary data', async () => {
    const original = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'application/octet-stream' });
    const base64 = await blobToBase64(original);
    const restored = base64ToBlob(base64, 'application/octet-stream');

    expect(restored.type).toBe('application/octet-stream');
    expect(new Uint8Array(await restored.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4]));
  });
});

describe('compressBlob', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('draws onto a canvas and returns a jpeg payload', async () => {
    const close = vi.fn();
    const fillRect = vi.fn();
    const drawImage = vi.fn();
    const convertToBlob = vi.fn().mockResolvedValue(
      new Blob([new Uint8Array([9, 8, 7])], { type: 'image/jpeg' }),
    );

    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({
        width: 2000,
        height: 1000,
        close,
      }),
    );
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        getContext() {
          return {
            fillStyle: '',
            fillRect,
            drawImage,
          };
        }

        convertToBlob = convertToBlob;
      },
    );

    const input = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
    const result = await compressBlob(input, 1280, 0.8);

    expect(result).toMatchObject({
      mimeType: 'image/jpeg',
      bytes: 3,
      width: 1280,
      height: 640,
      inputBytes: 3,
    });
    expect(result.base64).toBeTruthy();
    expect(fillRect).toHaveBeenCalledWith(0, 0, 1280, 640);
    expect(drawImage).toHaveBeenCalled();
    expect(convertToBlob).toHaveBeenCalledWith({ type: 'image/jpeg', quality: 0.8 });
    expect(close).toHaveBeenCalled();
  });

  it('throws when a canvas context cannot be created', async () => {
    const close = vi.fn();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({
        width: 10,
        height: 10,
        close,
      }),
    );
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        getContext() {
          return null;
        }
      },
    );

    await expect(compressBlob(new Blob(['x']))).rejects.toThrow(
      'Could not create canvas context.',
    );
    expect(close).toHaveBeenCalled();
  });
});

describe('jpeg quality storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads a stored quality value', async () => {
    vi.stubGlobal('chrome', {
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({ [JPEG_QUALITY_STORAGE_KEY]: 0.4 }),
        },
      },
    });

    await expect(getJpegQuality()).resolves.toBe(0.4);
  });

  it('falls back to the default when nothing is stored', async () => {
    vi.stubGlobal('chrome', {
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({}),
        },
      },
    });

    await expect(getJpegQuality()).resolves.toBe(JPEG_QUALITY);
  });

  it('stores a clamped quality value', async () => {
    const set = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('chrome', {
      storage: {
        sync: { set },
      },
    });

    await setJpegQuality(2);
    expect(set).toHaveBeenCalledWith({ [JPEG_QUALITY_STORAGE_KEY]: 1 });
  });
});

describe('max edge storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads a stored max edge value', async () => {
    vi.stubGlobal('chrome', {
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({ [MAX_EDGE_STORAGE_KEY]: 1920 }),
        },
      },
    });

    await expect(getMaxEdge()).resolves.toBe(1920);
  });

  it('falls back to the default when nothing is stored', async () => {
    vi.stubGlobal('chrome', {
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({}),
        },
      },
    });

    await expect(getMaxEdge()).resolves.toBe(MAX_EDGE_PX);
  });

  it('stores a clamped max edge value', async () => {
    const set = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('chrome', {
      storage: {
        sync: { set },
      },
    });

    await setMaxEdge(9000);
    expect(set).toHaveBeenCalledWith({ [MAX_EDGE_STORAGE_KEY]: 4096 });
  });
});
