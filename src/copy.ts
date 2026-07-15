import {
  JPEG_QUALITY,
  base64ToBlob,
  formatBytes,
  getJpegQuality,
  setJpegQuality,
  type CopyJob,
} from './shared'

const statusEl = document.getElementById('status')!
const detailEl = document.getElementById('detail')!
const settingsEl = document.getElementById('settings')!
const qualityEl = document.getElementById('quality') as HTMLInputElement
const qualityValueEl = document.getElementById('quality-value')!

function setUi(status: string, detail = '', isError = false) {
  statusEl.textContent = status
  detailEl.textContent = detail
  statusEl.classList.toggle('error', isError)
}

function qualityToPercent(quality: number): number {
  return Math.round(quality * 100)
}

function percentToQuality(percent: number): number {
  return percent / 100
}

function showQuality(quality: number) {
  const percent = qualityToPercent(quality)
  qualityEl.value = String(percent)
  qualityValueEl.textContent = `${percent}%`
}

function setSettingsVisible(visible: boolean) {
  settingsEl.hidden = !visible
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForJob(): Promise<CopyJob> {
  for (let i = 0; i < 200; i++) {
    const job = (await chrome.runtime.sendMessage({ type: 'get-job' })) as CopyJob
    if (!job || job.status === 'idle') {
      return { status: 'idle' }
    }
    if (job.status === 'ready' || job.status === 'error') {
      return job
    }
    setUi('Compressing…', 'Making a lighter copy')
    setSettingsVisible(false)
    await sleep(50)
  }
  return { status: 'error', error: 'Timed out while compressing the image.' }
}

async function writeToClipboard(job: CopyJob) {
  if (!job.base64 || !job.mimeType) {
    throw new Error('Missing compressed image data.')
  }

  const blob = base64ToBlob(job.base64, job.mimeType)

  try {
    await navigator.clipboard.write([
      new ClipboardItem({ [job.mimeType]: blob }),
    ])
    return
  } catch {
    const bitmap = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      throw new Error('PNG fallback canvas unavailable.')
    }
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()
    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) =>
          result ? resolve(result) : reject(new Error('PNG conversion failed.')),
        'image/png',
      )
    })
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
  }
}

async function initQualitySlider() {
  showQuality(await getJpegQuality().catch(() => JPEG_QUALITY))

  qualityEl.addEventListener('input', () => {
    const percent = Number(qualityEl.value)
    qualityValueEl.textContent = `${percent}%`
  })

  qualityEl.addEventListener('change', () => {
    void setJpegQuality(percentToQuality(Number(qualityEl.value)))
  })
}

async function main() {
  await initQualitySlider()
  const job = await waitForJob()

  if (job.status === 'idle') {
    setUi('lrcopy', 'Right-click an image → Copy smaller image')
    setSettingsVisible(true)
    return
  }

  setSettingsVisible(false)

  if (job.status === 'error') {
    setUi('Copy failed', job.error ?? 'Unknown error', true)
    await chrome.runtime.sendMessage({
      type: 'copy-result',
      ok: false,
      error: job.error,
    })
    return
  }

  try {
    setUi('Copying…')
    await writeToClipboard(job)
    setUi(
      `Copied ${formatBytes(job.bytes ?? 0)}`,
      `${job.width}×${job.height}` +
        (job.inputBytes
          ? ` · was ${formatBytes(job.inputBytes)}`
          : ''),
    )
    await chrome.runtime.sendMessage({
      type: 'copy-result',
      ok: true,
      bytes: job.bytes,
    })
    setTimeout(() => window.close(), 900)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    setUi('Copy failed', message, true)
    await chrome.runtime.sendMessage({
      type: 'copy-result',
      ok: false,
      error: message,
    })
  }
}

void main()
