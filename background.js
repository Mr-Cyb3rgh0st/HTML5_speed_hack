chrome.action.onClicked.addListener(async (tab) => {
    if (!tab.id) return;
    
    if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('https://chrome.google.com/webstore'))) {
        return;
    }

    try {
        await chrome.tabs.sendMessage(tab.id, { type: 'SPEEDHACK_TOGGLE_UI' });
    } catch (err) {

        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    window.postMessage({ type: 'SPEEDHACK_TOGGLE_UI' }, '*');
                }
            });
        } catch (scriptErr) {
            
        }
    }
});
