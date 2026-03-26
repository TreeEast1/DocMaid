chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => undefined);
});

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status !== 'complete' || !tab.url) {
    return;
  }

  const enabled = /yuque\.com|feishu\.cn|larksuite\.com/.test(tab.url);
  await chrome.sidePanel.setOptions({
    tabId,
    path: 'src/sidepanel/index.html',
    enabled
  });
});
