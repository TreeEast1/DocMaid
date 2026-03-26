chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'DOCMAID_PING') {
    sendResponse({ ok: true, href: window.location.href });
  }
});
