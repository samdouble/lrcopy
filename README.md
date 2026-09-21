<h1 align="center">LRcopy</h1>

<p align="center">
  <img src="icons/icon128.png" alt="lrcopy-logo" width="120px" height="120px"/>
  <br>
  <em>LRcopy, for "low-res copy", is a lightweight browser extension to copy images with a smaller size.</em>
  <br>
</p>

[![CI](https://github.com/samdouble/lrcopy/actions/workflows/extension-checks.yml/badge.svg)](https://github.com/samdouble/lrcopy/actions/workflows/extension-checks.yml?branch=master)
[![Coverage Status](https://coveralls.io/repos/github/samdouble/lrcopy/badge.svg?branch=master)](https://coveralls.io/github/samdouble/lrcopy?branch=master)

[![Node.js](https://img.shields.io/badge/Node.js-6DA55F?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=fff)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=fff)](https://vitejs.dev/)
[![Vitest](https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=fff)](https://vitest.dev/)
[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-4285F4?logo=chromewebstore&logoColor=white)](https://chromewebstore.google.com)
[![Firefox Add-Ons](https://img.shields.io/badge/Firefox_Add_Ons-20123A?logo=firefoxbrowser&logoColor=white)](https://addons.mozilla.org/en-US/firefox)

<hr />

The extension is available on the Chrome Web Store and [Firefox Add-Ons](https://addons.mozilla.org/en-US/firefox/addon/lrcopy/).

## Development

```bash
npm install
npm run dev
```

Then open `chrome://extensions`, enable **Developer mode**, and load the unpacked `dist/chrome` folder.

## Build

```bash
npm run build:chrome
npm run build:firefox
npm run build:all
```
