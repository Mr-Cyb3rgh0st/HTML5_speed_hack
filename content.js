try {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("inject.js");
  (document.head || document.documentElement).appendChild(script);
  script.onload = () => script.remove();
} catch (e) {
  console.error("[SpeedHack] Injection failed:", e);
}

// Handle communication between inject.js (main world) and extension storage
window.addEventListener("message", (event) => {
  if (
    event.source !== window ||
    !event.data ||
    event.data.type !== "SPEEDHACK_SAVE_SETTINGS"
  )
    return;
    
  // Check if context is still valid
  if (!chrome.runtime || !chrome.runtime.id) {
      console.warn('[SpeedHack] Extension context invalidated. Please refresh the page.');
      return;
  }

  chrome.storage.local.set({ speedhack_settings: event.data.settings }, () => {
    if (chrome.runtime.lastError) {
      console.error(
        "[SpeedHack] Failed to save settings:",
        chrome.runtime.lastError,
      );
    }
  });
});

// Send settings to main world on load
if (chrome.runtime && chrome.runtime.id) {
  chrome.storage.local.get("speedhack_settings", (data) => {
    window.postMessage(
      { type: "SPEEDHACK_LOAD_SETTINGS", settings: data.speedhack_settings },
      "*",
    );
  });
}

// Listen for toggle command from background.js
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'SPEEDHACK_TOGGLE_UI') {
        window.postMessage({ type: 'SPEEDHACK_TOGGLE_UI' }, '*');
    }
});
