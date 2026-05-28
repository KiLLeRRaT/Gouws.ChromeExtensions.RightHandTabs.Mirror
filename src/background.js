'use strict';

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

const openPanels = new Set();

chrome.runtime.onConnect.addListener((port) => {
  if (!port.name.startsWith('panel-')) return;
  const windowId = parseInt(port.name.slice(6));
  openPanels.add(windowId);
  port.onDisconnect.addListener(() => openPanels.delete(windowId));
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== 'toggle-panel' || !tab?.windowId) return;
  if (openPanels.has(tab.windowId)) {
    openPanels.delete(tab.windowId);
    chrome.sidePanel.close({ windowId: tab.windowId });
  } else {
    chrome.sidePanel.open({ windowId: tab.windowId });
  }
});
