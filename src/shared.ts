export const MENU_ID = 'copy-smaller-image'

export const MAX_EDGE_PX = 1280
/** JPEG keeps paste weight down; we re-wrap as PNG only if a target rejects JPEG. */
export const JPEG_QUALITY = 0.72
export const JPEG_QUALITY_MIN = 0.1
export const JPEG_QUALITY_MAX = 1
export const JPEG_QUALITY_STORAGE_KEY = 'jpegQuality'

export function clampJpegQuality(quality: number): number {
  if (!Number.isFinite(quality)) return JPEG_QUALITY
  return Math.min(JPEG_QUALITY_MAX, Math.max(JPEG_QUALITY_MIN, quality))
}

export async function getJpegQuality(): Promise<number> {
  const result = await chrome.storage.sync.get(JPEG_QUALITY_STORAGE_KEY)
  const value = result[JPEG_QUALITY_STORAGE_KEY]
  return typeof value === 'number' ? clampJpegQuality(value) : JPEG_QUALITY
}

export async function setJpegQuality(quality: number): Promise<void> {
  await chrome.storage.sync.set({
    [JPEG_QUALITY_STORAGE_KEY]: clampJpegQuality(quality),
  })
}

export type JobStatus = 'compressing' | 'ready' | 'error' | 'idle'

export type CopyJob = {
  status: JobStatus
  error?: string
  base64?: string
  mimeType?: string
  bytes?: number
  width?: number
  height?: number
  inputBytes?: number
}

export type CompressedPayload = {
  base64: string
  mimeType: string
  bytes: number
  width: number
  height: number
  inputBytes: number
}

export function scaleDimensions(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= maxEdge) {
    return { width, height }
  }

  const scale = maxEdge / longest
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mimeType })
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}K`
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`
}

export async function compressBlob(
  inputBlob: Blob,
  maxEdge = MAX_EDGE_PX,
  quality = JPEG_QUALITY,
): Promise<CompressedPayload> {
  const bitmap = await createImageBitmap(inputBlob)
  const { width, height } = scaleDimensions(bitmap.width, bitmap.height, maxEdge)

  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Could not create canvas context.')
  }

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await canvas.convertToBlob({
    type: 'image/jpeg',
    quality,
  })

  return {
    base64: await blobToBase64(blob),
    mimeType: 'image/jpeg',
    bytes: blob.size,
    width,
    height,
    inputBytes: inputBlob.size,
  }
}
