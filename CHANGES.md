# Changelog

## 0.1.2 — 2026-05-28

### Added

- Middle-click a tab to close it (press and release on the same tab; moving off before releasing cancels the action)
- `Alt+T` keyboard shortcut to toggle the side panel open/closed

## 0.1.1 — 2026-05-27

### Fixed

- New tab button now flows directly below the last tab instead of being pinned to the bottom of the panel
- Active tab title no longer turns blue; text colour stays consistent with the rest of the list

## 0.1.0 — 2026-05-27

Initial scaffold.

### Added

- Side panel opens on the right side of the browser via `chrome.sidePanel` API
- Vertical tab list with favicons, titles, active-tab highlight, and loading spinners
- **Pinned tabs** rendered as a compact icon grid at the top of the panel
- **Tab groups** with coloured left border, collapse/expand toggle, tab count badge
  - Double-click group name to rename inline
  - Click colour chip to change group colour via a colour picker popup
- **Drag & drop** reordering — move tabs within the list or between groups; drop a tab onto a group header to add it to that group
- **Audio indicator** button — shows when a tab is playing audio; click to mute/unmute
- **Close button** per tab (visible on hover / active tab)
- **Context menu** (right-click any tab):
  - Pin / Unpin
  - Mute / Unmute
  - Duplicate
  - Reload
  - Add to new group / Remove from group / Move to existing group
  - Close tab / Close other tabs / Close tabs to the right
- **New Tab** button pinned to the bottom of the panel
- Dark mode support via CSS `prefers-color-scheme`
- Real-time updates — all Chrome tab and group events trigger a re-render
