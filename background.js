chrome.action.onClicked.addListener(async (tab) => {
    if (!tab.id) return;
    
    // Skip restricted internal pages
    if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('https://chrome.google.com/webstore'))) {
        return;
    }

    try {
        await chrome.tabs.sendMessage(tab.id, { type: 'SPEEDHACK_TOGGLE_UI' });
    } catch (err) {
        // If message fails, it usually means the content script isn't ready.
        // We can try to relay the message directly to the page as a fallback.
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    window.postMessage({ type: 'SPEEDHACK_TOGGLE_UI' }, '*');
                }
            });
        } catch (scriptErr) {
            // Silently fail if re-injection is also blocked
        }
    }
});
