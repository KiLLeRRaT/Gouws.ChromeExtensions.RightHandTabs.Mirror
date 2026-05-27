'use strict';

// ========================= Constants =========================

const GROUP_COLORS = {
  grey:   '#5f6368',
  blue:   '#1a73e8',
  red:    '#d93025',
  yellow: '#f9ab00',
  green:  '#188038',
  pink:   '#e52592',
  purple: '#a142f4',
  cyan:   '#007b83',
  orange: '#e8710a',
};

const NONE = chrome.tabGroups.TAB_GROUP_ID_NONE; // -1

// ========================= State =========================

const state = {
  tabs: [],
  groups: {},     // groupId (number) → tabGroup object
  windowId: null,
  dragTabId: null,
};

// ========================= Data Fetching =========================

async function refresh() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  tabs.sort((a, b) => a.index - b.index);

  if (tabs.length > 0) state.windowId = tabs[0].windowId;
  state.tabs = tabs;

  if (state.windowId != null) {
    const groups = await chrome.tabGroups.query({ windowId: state.windowId });
    state.groups = Object.fromEntries(groups.map(g => [g.id, g]));
  }

  render();
}

// ========================= Rendering =========================

function colorHex(name) {
  return GROUP_COLORS[name] ?? '#5f6368';
}

function render() {
  const root = document.getElementById('root');
  root.innerHTML = '';

  const pinned   = state.tabs.filter(t => t.pinned);
  const unpinned = state.tabs.filter(t => !t.pinned);

  if (pinned.length > 0) {
    root.appendChild(renderPinnedSection(pinned));
  }

  // Walk unpinned tabs in index order, emitting group sections when encountered.
  let i = 0;
  while (i < unpinned.length) {
    const tab = unpinned[i];
    if (tab.groupId !== NONE) {
      const gid = tab.groupId;
      const groupTabs = [];
      while (i < unpinned.length && unpinned[i].groupId === gid) {
        groupTabs.push(unpinned[i++]);
      }
      root.appendChild(renderGroupSection(state.groups[gid], groupTabs));
    } else {
      root.appendChild(renderTabItem(tab, null));
      i++;
    }
  }

  root.appendChild(renderNewTabButton());
}

// ---- Pinned ----

function renderPinnedSection(tabs) {
  const section = document.createElement('div');
  section.className = 'pinned-section';

  const label = document.createElement('div');
  label.className = 'section-label';
  label.textContent = 'Pinned';
  section.appendChild(label);

  const grid = document.createElement('div');
  grid.className = 'pinned-grid';
  for (const tab of tabs) grid.appendChild(renderPinnedTab(tab));
  section.appendChild(grid);

  return section;
}

function renderPinnedTab(tab) {
  const el = document.createElement('div');
  el.className = `pinned-tab${tab.active ? ' active' : ''}`;
  el.title = tab.title || '';
  el.dataset.tabId = tab.id;
  el.draggable = true;

  el.appendChild(renderFavicon(tab));
  el.addEventListener('click', () => chrome.tabs.update(tab.id, { active: true }));
  el.addEventListener('contextmenu', e => showContextMenu(e, tab));
  bindDrag(el, tab);
  bindDrop(el, tab);

  return el;
}

// ---- Group ----

function renderGroupSection(group, tabs) {
  if (!group) return document.createDocumentFragment(); // guard against stale groupId

  const section = document.createElement('div');
  section.className = 'group-section';
  section.dataset.groupId = group.id;

  section.appendChild(renderGroupHeader(group, tabs.length));

  if (!group.collapsed) {
    const container = document.createElement('div');
    container.className = 'group-tabs';
    for (const tab of tabs) container.appendChild(renderTabItem(tab, group));
    section.appendChild(container);
  }

  return section;
}

function renderGroupHeader(group, count) {
  const header = document.createElement('div');
  header.className = 'group-header';
  header.style.setProperty('--group-color', colorHex(group.color));

  // Collapse toggle
  const toggle = document.createElement('button');
  toggle.className = 'group-toggle';
  toggle.title = group.collapsed ? 'Expand group' : 'Collapse group';
  toggle.innerHTML = `<svg viewBox="0 0 24 24" class="collapse-icon${group.collapsed ? ' rotated' : ''}"><path d="M7 10l5 5 5-5z"/></svg>`;
  toggle.addEventListener('click', e => {
    e.stopPropagation();
    chrome.tabGroups.update(group.id, { collapsed: !group.collapsed });
  });
  header.appendChild(toggle);

  // Colour chip — click to open colour picker
  const chip = document.createElement('span');
  chip.className = 'group-chip';
  chip.style.background = colorHex(group.color);
  chip.title = 'Change colour';
  chip.addEventListener('click', e => { e.stopPropagation(); showColorPicker(e, group); });
  header.appendChild(chip);

  // Name — double-click to rename inline
  const name = document.createElement('span');
  name.className = 'group-name';
  name.textContent = group.title || 'Unnamed group';
  name.addEventListener('dblclick', e => startGroupRename(e, group, name));
  header.appendChild(name);

  // Tab count badge
  const badge = document.createElement('span');
  badge.className = 'group-badge';
  badge.textContent = count;
  header.appendChild(badge);

  // Drop target: drag a tab onto the header to add it to this group
  header.addEventListener('dragover', e => {
    if (state.dragTabId == null) return;
    e.preventDefault();
    header.classList.add('drag-over');
  });
  header.addEventListener('dragleave', e => {
    if (!header.contains(e.relatedTarget)) header.classList.remove('drag-over');
  });
  header.addEventListener('drop', async e => {
    e.preventDefault();
    header.classList.remove('drag-over');
    if (state.dragTabId == null) return;
    await chrome.tabs.group({ tabIds: state.dragTabId, groupId: group.id });
  });

  return header;
}

// ---- Tab Item ----

function renderTabItem(tab, group) {
  const el = document.createElement('div');
  el.className = `tab-item${tab.active ? ' active' : ''}${group ? ' grouped' : ''}`;
  el.dataset.tabId = tab.id;
  el.draggable = true;

  if (group) el.style.setProperty('--group-color', colorHex(group.color));

  el.appendChild(renderFavicon(tab));

  const title = document.createElement('span');
  title.className = 'tab-title';
  title.textContent = tab.title || 'New Tab';
  el.appendChild(title);

  if (tab.audible || tab.mutedInfo?.muted) {
    el.appendChild(renderAudioBtn(tab));
  }

  const closeBtn = document.createElement('button');
  closeBtn.className = 'close-btn';
  closeBtn.title = 'Close tab';
  closeBtn.innerHTML = SVG.close;
  closeBtn.addEventListener('click', e => { e.stopPropagation(); chrome.tabs.remove(tab.id); });
  el.appendChild(closeBtn);

  el.addEventListener('click', () => chrome.tabs.update(tab.id, { active: true }));
  el.addEventListener('contextmenu', e => showContextMenu(e, tab));
  bindDrag(el, tab);
  bindDrop(el, tab);

  return el;
}

// ---- Favicon ----

function renderFavicon(tab) {
  const wrap = document.createElement('div');
  wrap.className = 'favicon-wrap';

  if (tab.status === 'loading') {
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    wrap.appendChild(spinner);
    return wrap;
  }

  if (tab.favIconUrl && !tab.favIconUrl.startsWith('chrome://theme/')) {
    const img = document.createElement('img');
    img.className = 'favicon';
    img.src = tab.favIconUrl;
    img.alt = '';
    img.addEventListener('error', () => img.replaceWith(defaultFavicon()));
    wrap.appendChild(img);
  } else {
    wrap.appendChild(defaultFavicon());
  }

  return wrap;
}

function defaultFavicon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'favicon-default');
  svg.innerHTML = `<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>`;
  return svg;
}

// ---- Audio button ----

function renderAudioBtn(tab) {
  const muted = tab.mutedInfo?.muted ?? false;
  const btn = document.createElement('button');
  btn.className = `audio-btn${muted ? ' muted' : ''}`;
  btn.title = muted ? 'Unmute tab' : 'Mute tab';
  btn.innerHTML = muted ? SVG.muted : SVG.audio;
  btn.addEventListener('click', e => {
    e.stopPropagation();
    chrome.tabs.update(tab.id, { muted: !muted });
  });
  return btn;
}

// ---- New Tab button ----

function renderNewTabButton() {
  const btn = document.createElement('button');
  btn.className = 'new-tab-btn';
  btn.innerHTML = `${SVG.plus}<span>New tab</span>`;
  btn.addEventListener('click', () => chrome.tabs.create({}));
  return btn;
}

// ========================= SVG Icons =========================

const SVG = {
  close: `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
  audio: `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`,
  muted: `<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`,
  plus:  `<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`,
};

// ========================= Drag & Drop =========================

function bindDrag(el, tab) {
  el.addEventListener('dragstart', e => {
    state.dragTabId = tab.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(tab.id));
    // Defer so the ghost image renders before we dim the source element.
    requestAnimationFrame(() => el.classList.add('dragging'));
  });

  el.addEventListener('dragend', () => {
    state.dragTabId = null;
    el.classList.remove('dragging');
    clearDropIndicators();
  });
}

function bindDrop(el, tab) {
  el.addEventListener('dragover', e => {
    if (state.dragTabId == null || state.dragTabId === tab.id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const rect = el.getBoundingClientRect();
    const pos  = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    clearDropIndicators();
    el.classList.add(`drop-${pos}`);
  });

  el.addEventListener('dragleave', e => {
    if (!el.contains(e.relatedTarget)) {
      el.classList.remove('drop-before', 'drop-after');
    }
  });

  el.addEventListener('drop', async e => {
    e.preventDefault();
    clearDropIndicators();

    const dragTabId = state.dragTabId;
    if (dragTabId == null || dragTabId === tab.id) return;

    const dragTab = state.tabs.find(t => t.id === dragTabId);
    if (!dragTab) return;

    const rect   = el.getBoundingClientRect();
    const before = e.clientY < rect.top + rect.height / 2;

    // Calculate target index, accounting for the source moving out of its position.
    let targetIndex = tab.index + (before ? 0 : 1);
    if (dragTab.index < tab.index) targetIndex--;

    await chrome.tabs.move(dragTabId, { index: targetIndex });

    // Sync group membership when crossing group boundaries.
    if (tab.groupId !== dragTab.groupId) {
      if (tab.groupId === NONE) {
        await chrome.tabs.ungroup(dragTabId);
      } else {
        await chrome.tabs.group({ tabIds: dragTabId, groupId: tab.groupId });
      }
    }
  });
}

function clearDropIndicators() {
  document.querySelectorAll('.drop-before, .drop-after, .drag-over')
    .forEach(el => el.classList.remove('drop-before', 'drop-after', 'drag-over'));
}

// ========================= Popups (context menu + colour picker) =========================

let activePopup = null;

function closePopup() {
  activePopup?.remove();
  activePopup = null;
}

function positionPopup(el, x, y) {
  // Ensure the popup stays within the viewport.
  const w = el.offsetWidth  || 220;
  const h = el.offsetHeight || 200;
  el.style.left = Math.min(x, window.innerWidth  - w - 4) + 'px';
  el.style.top  = Math.min(y, window.innerHeight - h - 4) + 'px';
}

// ---- Context Menu ----

function showContextMenu(e, tab) {
  e.preventDefault();
  closePopup();

  const menu = document.createElement('div');
  menu.className = 'popup context-menu';
  activePopup = menu;

  const items = buildMenuItems(tab);
  for (const item of items) {
    if (item === null) {
      const sep = document.createElement('div');
      sep.className = 'menu-sep';
      menu.appendChild(sep);
    } else {
      const el = document.createElement('div');
      el.className = 'menu-item';
      el.textContent = item.label;
      el.addEventListener('click', () => { item.action(); closePopup(); });
      menu.appendChild(el);
    }
  }

  document.body.appendChild(menu);
  positionPopup(menu, e.clientX, e.clientY);

  // Close when clicking elsewhere.
  setTimeout(() => document.addEventListener('click', closePopup, { once: true }), 0);
}

function buildMenuItems(tab) {
  const otherGroups = Object.values(state.groups).filter(g => g.id !== tab.groupId);

  const items = [
    { label: tab.pinned ? 'Unpin tab' : 'Pin tab',
      action: () => chrome.tabs.update(tab.id, { pinned: !tab.pinned }) },
    { label: tab.mutedInfo?.muted ? 'Unmute tab' : 'Mute tab',
      action: () => chrome.tabs.update(tab.id, { muted: !tab.mutedInfo?.muted }) },
    null,
    { label: 'Duplicate tab',  action: () => chrome.tabs.duplicate(tab.id) },
    { label: 'Reload tab',     action: () => chrome.tabs.reload(tab.id) },
    null,
    { label: 'Add to new group',
      action: () => chrome.tabs.group({ tabIds: tab.id }) },
  ];

  if (tab.groupId !== NONE) {
    items.push({ label: 'Remove from group', action: () => chrome.tabs.ungroup(tab.id) });
  }

  for (const g of otherGroups) {
    items.push({
      label: `Move to "${g.title || 'Unnamed group'}"`,
      action: () => chrome.tabs.group({ tabIds: tab.id, groupId: g.id }),
    });
  }

  items.push(
    null,
    { label: 'Close tab',
      action: () => chrome.tabs.remove(tab.id) },
    { label: 'Close other tabs',
      action: () => chrome.tabs.remove(state.tabs.filter(t => t.id !== tab.id).map(t => t.id)) },
    { label: 'Close tabs to the right',
      action: () => chrome.tabs.remove(state.tabs.filter(t => t.index > tab.index).map(t => t.id)) },
  );

  return items;
}

// ---- Colour Picker ----

function showColorPicker(e, group) {
  closePopup();

  const picker = document.createElement('div');
  picker.className = 'popup color-picker';
  activePopup = picker;

  for (const [name, hex] of Object.entries(GROUP_COLORS)) {
    const chip = document.createElement('div');
    chip.className = `color-chip${group.color === name ? ' selected' : ''}`;
    chip.style.background = hex;
    chip.title = name;
    chip.addEventListener('click', () => { chrome.tabGroups.update(group.id, { color: name }); closePopup(); });
    picker.appendChild(chip);
  }

  document.body.appendChild(picker);
  const rect = e.target.getBoundingClientRect();
  picker.style.left = rect.left + 'px';
  picker.style.top  = (rect.bottom + 4) + 'px';

  setTimeout(() => document.addEventListener('click', closePopup, { once: true }), 0);
}

// ========================= Group Rename =========================

function startGroupRename(e, group, nameEl) {
  e.stopPropagation();

  const input = document.createElement('input');
  input.className = 'group-name-input';
  input.value = group.title || '';
  input.placeholder = 'Group name';
  nameEl.replaceWith(input);
  input.focus();
  input.select();

  const commit = () => chrome.tabGroups.update(group.id, { title: input.value.trim() });
  const cancel = () => { input.removeEventListener('blur', commit); refresh(); };

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  input.blur();
    if (e.key === 'Escape') cancel();
  });
}

// ========================= Chrome Event Listeners =========================

function setupListeners() {
  const rerender = () => refresh();

  chrome.tabs.onCreated.addListener(rerender);
  chrome.tabs.onUpdated.addListener(rerender);
  chrome.tabs.onRemoved.addListener(rerender);
  chrome.tabs.onMoved.addListener(rerender);
  chrome.tabs.onActivated.addListener(rerender);
  chrome.tabs.onAttached.addListener(rerender);
  chrome.tabs.onDetached.addListener(rerender);
  chrome.tabs.onReplaced.addListener(rerender);

  chrome.tabGroups.onCreated.addListener(rerender);
  chrome.tabGroups.onUpdated.addListener(rerender);
  chrome.tabGroups.onRemoved.addListener(rerender);
}

// ========================= Init =========================

document.addEventListener('DOMContentLoaded', async () => {
  setupListeners();
  await refresh();
});
