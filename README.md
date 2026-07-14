# lrcopy

Right-click any image → **Copy smaller image** to put a resized copy on the clipboard (max edge 1280px).

A small popup writes to the clipboard (Chromium requires a focused page for that), then closes. The toolbar badge shows the copied size (e.g. `240K`).

## Develop

```bash
npm install
npm run dev
```

Then open `chrome://extensions`, enable **Developer mode**, and load the unpacked `dist/` folder.

## Build

```bash
npm run build
```
