(function () {
    'use strict';

    // Configuration
    const CONFIG = {
        defaultSpeed: 1.0,
        minSpeed: 0.001,
        maxSpeed: 100.0,
        maxCustomSpeed: Infinity,
        step: 0.001,
        uiUpdateInterval: 100,
        favoritePresets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50, 100]
    };

    // Global state
    let globalSpeed = CONFIG.defaultSpeed;
    let uiElement = null;
    let isInitialized = false;
    let startTime = Date.now();
    const __trackedSources = new Map();
    const globalState = {
        perfNow: false,
        dateNow: false,
        setTimeout: false,
        setInterval: false,
        raf: false,
        music: false,
        sfx: false,
        clearTimeouts: true,
        customPresets: [],
        debugLogging: false,
        autoInjectFrames: true,
        persistentUI: true,
        perfNowSpeed: 1.0,
        dateNowSpeed: 1.0,
        setTimeoutSpeed: 1.0,
        setIntervalSpeed: 1.0,
        rafSpeed: 1.0,
        musicSpeed: 1.0,
        sfxSpeed: 1.0,
        hideKey: 'KeyL'
    };

    function saveSettings() {
        const settings = {
            speed: globalSpeed,
            state: globalState,
            uiPosition: uiElement ? {
                left: uiElement.style.left,
                top: uiElement.style.top
            } : null
        };
        window.postMessage({ type: 'SPEEDHACK_SAVE_SETTINGS', settings }, '*');
    }

    // Listen for settings and toggle commands
    window.addEventListener('message', (event) => {
        if (event.source !== window || !event.data) return;

        if (event.data.type === 'SPEEDHACK_LOAD_SETTINGS') {
            const settings = event.data.settings;
            if (settings) {
                globalSpeed = settings.speed || CONFIG.defaultSpeed;
                Object.assign(globalState, settings.state || {});
                
                if (isInitialized) {
                    updateAllWindows();
                    if (uiElement) {
                        updateSliderFromSpeed(globalSpeed);
                        uiElement.querySelector('#toggle-perfnow').checked = globalState.perfNow;
                        uiElement.querySelector('#toggle-datenow').checked = globalState.dateNow;
                        uiElement.querySelector('#toggle-settimeout').checked = globalState.setTimeout;
                        uiElement.querySelector('#toggle-setinterval').checked = globalState.setInterval;
                        uiElement.querySelector('#toggle-raf').checked = globalState.raf;
                        updateSliderStates();
                    }
                }
            }
        } else if (event.data.type === 'SPEEDHACK_TOGGLE_UI') {
            __toggleSpeedhackUI();
        }
    });

    /* -------- UI toggle (L key) -------- */
    let __uiHidden = true;
    function __toggleSpeedhackUI() {
        if (!uiElement) {
            createUI();
            __uiHidden = false; // Start visible when first created
            return;
        }
        __uiHidden = !__uiHidden;
        uiElement.style.opacity = __uiHidden ? '0' : '1';
        uiElement.style.pointerEvents = __uiHidden ? 'none' : 'auto';
        uiElement.style.transform = __uiHidden ? 'scale(0.95)' : 'scale(1)';
    }

    document.addEventListener('keydown', (e) => {
        if (
            e.code === globalState.hideKey &&
            !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey &&
            e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA'
        ) {
            __toggleSpeedhackUI();
        }
    });

    function showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            background: ${type === 'error' ? 'rgba(244,67,54,0.95)' : type === 'warning' ? 'rgba(255,193,7,0.95)' : type === 'success' ? 'rgba(76,175,80,0.95)' : 'rgba(33,150,243,0.95)'};
            color: white; padding: 12px 20px; border-radius: 8px; font-size: 13px; font-weight: 500; z-index: 2147483649;
            backdrop-filter: blur(15px); box-shadow: 0 4px 20px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2);
            animation: speedhack-slideDown 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            max-width: 400px; text-align: center;
        `;
        if (!document.getElementById('speedhack-notif-style')) {
            const style = document.createElement('style');
            style.id = 'speedhack-notif-style';
            style.textContent = `
                @keyframes speedhack-slideDown { from { opacity: 0; transform: translateX(-50%) translateY(-30px) scale(0.8); } to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); } }
                @keyframes speedhack-slideUp { from { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); } to { opacity: 0; transform: translateX(-50%) translateY(-30px) scale(0.8); } }
                @keyframes speedhack-slideIn { from { opacity: 0; transform: translateX(30px) scale(0.9); } to { opacity: 1; transform: translateX(0) scale(1); } }
                @keyframes speedhack-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
                @keyframes speedhack-glow { 0%, 100% { box-shadow: 0 0 5px rgba(76,175,80,0.3); } 50% { box-shadow: 0 0 20px rgba(76,175,80,0.6); } }
            `;
            document.head.appendChild(style);
        }
        notification.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; gap: 8px;"><span>${type === 'error' ? '❌' : type === 'warning' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️'}</span><span>${message}</span></div>`;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.style.animation = 'speedhack-slideUp 0.3s ease-in forwards';
            setTimeout(() => { if (document.body.contains(notification)) document.body.removeChild(notification); }, 300);
        }, duration);
    }

    (function hookWebAudio() {
        const OriginalAudioContext = window.AudioContext || window.webkitAudioContext;
        if (!OriginalAudioContext) return;
        window.AudioContext = window.webkitAudioContext = function (...args) {
            const ctx = new OriginalAudioContext(...args);
            const originalCreateBufferSource = ctx.createBufferSource.bind(ctx);
            ctx.createBufferSource = function () {
                const source = originalCreateBufferSource();
                __trackedSources.set(source, false);
                Object.defineProperty(source, 'loop', {
                    get() { return this._loop || false; },
                    set(value) { this._loop = value; __trackedSources.set(source, value === true); }
                });
                return source;
            };
            return ctx;
        };
    })();

    // Permanent hooks version
    (function installHooks() {
        if (window.__speedHackInjected) return;
        window.__speedHackInjected = true;

        const realPerfNow = performance.now.bind(performance);
        const realDateNow = Date.now;
        const realSetTimeout = window.setTimeout;
        const realSetInterval = window.setInterval;
        const realClearInterval = window.clearInterval;
        const realRAF = window.requestAnimationFrame;

        let timers = [];
        let perfNowValue = null, prevPerfNowValue = null, perfNowOffset = 0;
        let dateNowValue = null, prevDateNowValue = null, dateNowOffset = 0;

        performance.now = function() {
            const originalValue = realPerfNow();
            if (perfNowValue === null) { perfNowValue = originalValue; prevPerfNowValue = originalValue; perfNowOffset = 0; }
            if (!globalState.perfNow) return originalValue + perfNowOffset;
            perfNowValue += (originalValue - prevPerfNowValue) * globalState.perfNowSpeed;
            prevPerfNowValue = originalValue;
            perfNowOffset = perfNowValue - originalValue;
            return perfNowValue;
        };

        Date.now = function() {
            const originalValue = realDateNow();
            if (dateNowValue === null) { dateNowValue = originalValue; prevDateNowValue = originalValue; dateNowOffset = 0; }
            if (!globalState.dateNow) return originalValue + dateNowOffset;
            dateNowValue += (originalValue - prevDateNowValue) * globalState.dateNowSpeed;
            prevDateNowValue = originalValue;
            dateNowOffset = dateNowValue - originalValue;
            return Math.floor(dateNowValue);
        };

        window.setTimeout = function(callback, delay, ...args) {
            const adjustedDelay = globalState.setTimeout ? Math.max(0, delay / globalState.setTimeoutSpeed) : delay;
            return realSetTimeout(callback, adjustedDelay, ...args);
        };

        const reloadTimers = () => {
            timers.forEach((timer) => {
                realClearInterval(timer.realId);
                if (timer.customId) realClearInterval(timer.customId);
                if (!timer.finished) {
                    const adjustedDelay = globalState.setInterval ? timer.delay / globalState.setIntervalSpeed : timer.delay;
                    timer.customId = realSetInterval(timer.callback, adjustedDelay, ...timer.args);
                }
            });
        };

        window.setInterval = function(callback, delay, ...args) {
            const adjustedDelay = globalState.setInterval ? Math.max(1, delay / globalState.setIntervalSpeed) : delay;
            const realId = realSetInterval(callback, adjustedDelay, ...args);
            timers.push({ realId, callback, delay: delay || 0, args, finished: false, customId: null });
            return realId;
        };

        let disableRAF = false;
        const rafCallbacks = [], rafTicks = [];
        window.requestAnimationFrame = function(callback) {
            if (disableRAF) return 1;
            return realRAF((timestamp) => {
                const index = rafCallbacks.indexOf(callback);
                if (index === -1) {
                    rafCallbacks.push(callback); rafTicks.push(0); callback(performance.now());
                } else if (globalState.raf) {
                    let tickFrame = rafTicks[index];
                    tickFrame += globalState.rafSpeed;
                    if (tickFrame >= 1) {
                        const start = realPerfNow();
                        while (tickFrame >= 1) {
                            try { callback(performance.now()); } catch (e) { console.error(e); }
                            disableRAF = true; tickFrame -= 1;
                            if (realPerfNow() - start > 15) { tickFrame = 0; break; }
                        }
                        disableRAF = false;
                    } else { window.requestAnimationFrame(callback); }
                    rafTicks[index] = tickFrame;
                } else { callback(performance.now()); }
            });
        };

        window.__updateSpeedConfig = function() {
            reloadTimers();
            if (globalState.debugLogging) console.log("[SpeedHack] Speed config updated");
        };
    })();

    function updateAllWindows() {
        if (window.__updateSpeedConfig) window.__updateSpeedConfig();
    }

    setInterval(() => {
        __trackedSources.forEach((isMusic, source) => {
            try {
                if (!source.playbackRate) return;
                if (isMusic && globalState.music) source.playbackRate.value = globalState.musicSpeed;
                else if (!isMusic && globalState.sfx) source.playbackRate.value = globalState.sfxSpeed;
                else source.playbackRate.value = 1;
            } catch { __trackedSources.delete(source); }
        });
    }, 100);

    function formatSpeed(speed) {
        if (speed >= 1000000) return (speed / 1000000).toFixed(1) + 'M';
        if (speed >= 1000) return (speed / 1000).toFixed(1) + 'K';
        return speed >= 1 ? speed.toFixed(3).replace(/\.?0+$/, '') : speed.toFixed(6).replace(/\.?0+$/, '');
    }

    function createUI() {
        if (uiElement || document.getElementById('speedhack-ui')) return;
        const ui = document.createElement('div');
        ui.id = 'speedhack-ui';
        ui.style.cssText = `
            position: fixed; top: 10px; right: 10px; padding: 18px;
            background: linear-gradient(135deg, rgba(0,0,0,0.96), rgba(30,30,30,0.96));
            color: #fff; z-index: 2147483647; border-radius: 16px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px; min-width: 300px; max-width: 350px;
            box-shadow: 0 12px 40px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2);
            backdrop-filter: blur(25px); user-select: none; 
            transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), top 0.3s ease, right 0.3s ease;
            animation: speedhack-slideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
            max-height: 90vh; overflow-y: auto; box-sizing: border-box; scrollbar-width: thin; scrollbar-color: #666 transparent;
        `;

        ui.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
                <div>
                    <strong style="color: #4CAF50; font-size: 15px; font-weight: 700;">⚡ HTML5 Speed Hack</strong>
                    <div style="font-size: 9px; color: #888; margin-top: 2px;">by <span style="color: #4CAF50; font-weight: 600;">Mr.Cyb3rgh0$t</span></div>
                    <div style="font-size: 9px; color: #888; margin-top: 2px;">Press <span id="hide-key-display" style="color: #4CAF50; font-weight: 600;">L</span> to hide UI</div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button id="speedhack-settings" style="background: rgba(255,255,255,0.1); border: none; color: #fff; cursor: pointer; font-size: 14px; padding: 6px 10px; border-radius: 6px; transition: all 0.2s;" onmouseover="this.style.background='rgba(76,175,80,0.3)'; this.style.transform='scale(1.1)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'; this.style.transform='scale(1)'">⚙️</button>
                    <button id="speedhack-minimize" style="background: rgba(255,255,255,0.1); border: none; color: #fff; cursor: pointer; font-size: 14px; padding: 6px 10px; border-radius: 6px; transition: all 0.2s;" onmouseover="this.style.background='rgba(76,175,80,0.3)'; this.style.transform='scale(1.1)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'; this.style.transform='scale(1)'">−</button>
                </div>
            </div>
            <div id="speedhack-content">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; margin-bottom: 14px;">
                    ${['perfNow', 'dateNow', 'setTimeout', 'setInterval', 'raf', 'music', 'sfx'].map(k => `
                        <label style="display: flex; align-items: center; cursor: pointer; padding: 6px 8px; border-radius: 6px; transition: all 0.2s; border: 1px solid transparent; color: #fff;" onmouseover="this.style.background='rgba(76,175,80,0.1)'; this.style.borderColor='rgba(76,175,80,0.3)'" onmouseout="this.style.background='transparent'; this.style.borderColor='transparent'">
                            <input type="checkbox" id="toggle-${k.toLowerCase()}" style="margin-right: 8px; accent-color: #4CAF50;"> ${k === 'raf' ? 'requestAnimationFrame' : (k === 'music' ? '🎵 Music' : (k === 'sfx' ? '🔊 Sound FX' : k + '()'))}
                        </label>
                    `).join('')}
                </div>
                <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.25); margin: 14px 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <span style="font-weight: 600; font-size: 14px;">Speed Control:</span>
                    <span id="speed-display" style="color: #4CAF50; font-weight: bold; font-size: 16px; text-shadow: 0 0 10px rgba(76,175,80,0.5);">${formatSpeed(globalSpeed)}x</span>
                </div>
                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                    <input type="number" id="speed-input" value="${globalSpeed}" step="any" style="flex: 1; padding: 8px 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.25); color: #fff; border-radius: 8px; font-size: 13px; outline: none;">
                    <button id="speed-apply" style="padding: 8px 16px; background: linear-gradient(135deg, #4CAF50, #45a049); border: none; color: white; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.2s; box-shadow: 0 2px 8px rgba(76,175,80,0.3);" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(76,175,80,0.5)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(76,175,80,0.3)'">Apply</button>
                </div>
                <input type="range" id="speed-slider" min="${Math.log(CONFIG.minSpeed)}" max="${Math.log(CONFIG.maxSpeed)}" value="${Math.log(globalSpeed)}" step="0.01" style="width: 100%; margin-bottom: 10px; accent-color: #4CAF50;">
                <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; margin-bottom: 10px;" id="presets-container"></div>
                <div style="display: flex; gap: 6px;">
                    <button id="speed-reset" style="flex: 1; padding: 8px; background: rgba(244,67,54,0.9); border-radius: 6px; border: none; color: #fff; font-size: 11px; cursor: pointer;">🔄 Reset</button>
                    <button id="speed-infinity" style="flex: 1; padding: 8px; background: rgba(156,39,176,0.9); border-radius: 6px; border: none; color: #fff; font-size: 11px; cursor: pointer;">∞ Max</button>
                </div>
            </div>
            <div id="speedhack-settings-panel" style="display: none; margin-top: 14px; padding: 14px; background: rgba(255,255,255,0.06); border-radius: 10px; border: 1px solid rgba(255,255,255,0.15);">
                <div style="font-weight: 600; margin-bottom: 10px; color: #4CAF50; font-size: 14px;">⚙️ Advanced Settings</div>
                <!-- Sliders for each function... simplified for now -->
            </div>
        `;

        document.body.appendChild(ui);
        uiElement = ui;
        
        // Ensure initial hidden state if created but not immediately shown
        if (__uiHidden) {
            ui.style.opacity = '0';
            ui.style.pointerEvents = 'none';
            ui.style.transform = 'scale(0.95)';
        }

        setupUIListeners(ui);
        updateSliderStates();
    }

    function setupUIListeners(ui) {
        const presets = [0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50, 100];
        const container = ui.querySelector('#presets-container');
        presets.forEach(s => {
            const btn = document.createElement('button');
            btn.textContent = s + 'x';
            btn.style.cssText = `padding: 6px 4px; font-size: 10px; background: #333; border: 1px solid #555; color: #fff; border-radius: 6px; cursor: pointer;`;
            btn.onclick = () => { globalSpeed = s; updateSliderFromSpeed(s); updateAllWindows(); saveSettings(); };
            container.appendChild(btn);
        });

        ui.querySelector('#speed-slider').oninput = (e) => {
            globalSpeed = Math.exp(parseFloat(e.target.value));
            updateSliderFromSpeed(globalSpeed);
            updateAllWindows();
            saveSettings();
        };

        ui.querySelector('#speed-apply').onclick = () => {
            const val = parseFloat(ui.querySelector('#speed-input').value);
            if (!isNaN(val) && val > 0) {
                globalSpeed = val;
                updateSliderFromSpeed(val);
                updateAllWindows();
                saveSettings();
            }
        };

        ui.querySelector('#speed-reset').onclick = () => { globalSpeed = 1.0; updateSliderFromSpeed(1.0); updateAllWindows(); saveSettings(); };
        
        ['perfnow', 'datenow', 'settimeout', 'setinterval', 'raf', 'music', 'sfx'].forEach(k => {
            ui.querySelector(`#toggle-${k}`).onclick = (e) => {
                const stateKey = k === 'perfnow' ? 'perfNow' : (k === 'datenow' ? 'dateNow' : (k === 'settimeout' ? 'setTimeout' : (k === 'setinterval' ? 'setInterval' : k)));
                globalState[stateKey] = e.target.checked;
                updateSliderStates();
                updateAllWindows();
                saveSettings();
            };
        });

        // Draggable
        let isDragging = false, offset = { x: 0, y: 0 };
        ui.onmousedown = (e) => {
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
                isDragging = true;
                offset = { x: e.clientX - ui.offsetLeft, y: e.clientY - ui.offsetTop };
            }
        };
        window.onmousemove = (e) => {
            if (isDragging) {
                ui.style.left = (e.clientX - offset.x) + 'px';
                ui.style.top = (e.clientY - offset.y) + 'px';
                ui.style.right = 'auto';
            }
        };
        window.onmouseup = () => isDragging = false;
    }

    function updateSliderFromSpeed(speed) {
        if (!uiElement) return;
        uiElement.querySelector('#speed-slider').value = Math.log(Math.min(speed, CONFIG.maxSpeed));
        uiElement.querySelector('#speed-display').textContent = formatSpeed(speed) + 'x';
        uiElement.querySelector('#speed-input').value = speed;

        // Sync individual function speeds to global speed
        ['perfNowSpeed', 'dateNowSpeed', 'setTimeoutSpeed', 'setIntervalSpeed', 'rafSpeed', 'musicSpeed', 'sfxSpeed'].forEach(key => {
            globalState[key] = speed;
        });
    }

    window.updateSliderStates = function() {
        if (!uiElement) return;
        ['perfnow', 'datenow', 'settimeout', 'setinterval', 'raf', 'music', 'sfx'].forEach(k => {
            const stateKey = k === 'perfnow' ? 'perfNow' : (k === 'datenow' ? 'dateNow' : (k === 'settimeout' ? 'setTimeout' : (k === 'setinterval' ? 'setInterval' : k)));
            uiElement.querySelector(`#toggle-${k}`).checked = globalState[stateKey];
        });
    };

    function initialize() {
        if (isInitialized) return;
        isInitialized = true;
        
        // Hooks are already installed during script execution.
        // We no longer call createUI() here to prevent auto-opening.
    }

    initialize();
})();
