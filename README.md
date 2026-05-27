# Right Hand Tabs

A Chrome extension that displays your tabs as a vertical panel on the **right** side of the browser window.

Chrome's native vertical tabs appear on the left. This extension opens a side panel on the right with full tab management support.

## Features

- **Vertical tab list** in Chrome's right-side panel
- **Tab groups** — coloured headers, collapse/expand, rename (double-click), change colour
- **Pinned tabs** — compact grid at the top of the panel
- **Drag & drop** — reorder tabs and move them between groups by dragging
- **Audio indicators** — mute/unmute tabs directly from the panel
- **Context menu** — pin/unpin, mute, duplicate, reload, move to group, close
- **New Tab button** at the bottom of the panel
- **Dark mode** support (follows system preference)
- Real-time sync — the panel updates instantly as tabs change

## Installation (development)

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select this directory
4. Click the extension's puzzle-piece icon in the toolbar to open the panel

> **Note:** The side panel opens on the right side of the browser window. You may want to hide or minimise Chrome's native top tab bar. There is currently no native Chrome API to hide the top tab bar from an extension — full-screen mode (`F11`) hides it, or you can use a theme that minimises its visual weight.

## Icons

The extension ships with `icons/icon.svg` as reference artwork. Chrome requires PNG icons for the toolbar and extension list. To generate them from the SVG:

```bash
# Using Inkscape (Linux/macOS/Windows)
for size in 16 32 48 128; do
  inkscape icons/icon.svg -w $size -h $size -o icons/icon${size}.png
done
```

Then update `manifest.json` to reference the PNG files:

```json
"action": {
  "default_title": "Open Right Hand Tabs",
  "default_icon": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
},
"icons": {
  "16": "icons/icon16.png",
  "48": "icons/icon48.png",
  "128": "icons/icon128.png"
}
```

## Project structure

```
manifest.json          Extension manifest (MV3)
background.js          Service worker — wires up the side panel action
icons/
  icon.svg             Reference icon artwork
sidepanel/
  index.html           Side panel shell
  styles.css           All styling (CSS variables, dark mode)
  app.js               All tab management logic
```

## Permissions used

| Permission   | Why |
|--------------|-----|
| `tabs`       | Read and manage tabs (title, favicon, index, groupId, state) |
| `tabGroups`  | Read and manage tab groups (name, colour, collapsed state) |
| `sidePanel`  | Open the side panel on the right when the action button is clicked |
