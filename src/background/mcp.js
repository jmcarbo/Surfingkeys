/*
 * MCP (Model Context Protocol) WebSocket Server Integration
 * Exposes Surfingkeys functionality via WebSocket API
 */

const MCP_SERVER_URL = 'ws://localhost:8765';
const RECONNECT_INTERVAL = 5000;

let ws = null;
let reconnectTimer = null;
let messageHandlers = {};

// Initialize MCP server connection
function initMCPServer() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        return;
    }

    try {
        ws = new WebSocket(MCP_SERVER_URL);
        
        ws.onopen = () => {
            console.log('MCP server connected');
            clearTimeout(reconnectTimer);
            ws.send(JSON.stringify({
                type: 'connected',
                from: 'surfingkeys',
                version: '1.0.0'
            }));
        };

        ws.onmessage = handleMCPMessage;
        
        ws.onclose = () => {
            console.log('MCP server disconnected');
            scheduleReconnect();
        };

        ws.onerror = (error) => {
            console.error('MCP server error:', error);
        };
    } catch (error) {
        console.error('Failed to connect to MCP server:', error);
        scheduleReconnect();
    }
}

// Schedule reconnection attempt
function scheduleReconnect() {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
    }
    reconnectTimer = setTimeout(() => {
        console.log('Attempting to reconnect to MCP server...');
        initMCPServer();
    }, RECONNECT_INTERVAL);
}

// Handle incoming MCP messages
async function handleMCPMessage(event) {
    let message;
    try {
        message = JSON.parse(event.data);
    } catch (error) {
        console.error('Invalid MCP message format:', error);
        return;
    }

    const { id, command, params } = message;
    
    if (!id || !command) {
        console.error('Invalid MCP message: missing id or command');
        return;
    }

    try {
        const handler = messageHandlers[command];
        if (!handler) {
            throw new Error(`Unknown command: ${command}`);
        }

        const result = await handler(params || {});
        sendMCPResponse(id, { result });
    } catch (error) {
        sendMCPError(id, error.message);
    }
}

// Send successful response
function sendMCPResponse(id, data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            id,
            type: 'response',
            ...data
        }));
    }
}

// Send error response
function sendMCPError(id, error) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            id,
            type: 'error',
            error
        }));
    }
}

// Register a command handler
function registerCommand(command, handler) {
    messageHandlers[command] = handler;
}

// Helper to get current tab
async function getCurrentTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
}

// Helper to execute action in content script
async function executeInTab(tabId, action, params) {
    return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, {
            action,
            ...params
        }, (response) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError.message);
            } else {
                resolve(response);
            }
        });
    });
}

// Register Surfingkeys MCP Commands

// Navigation commands
registerCommand('surfingkeys.navigate', async (params) => {
    const { url, newTab = false, active = true, position = 'default' } = params;
    
    if (!url) {
        throw new Error('URL parameter is required');
    }

    return new Promise((resolve) => {
        self.openLink({
            url,
            newTab,
            active,
            position
        }, null, () => {
            resolve({ success: true, url });
        });
    });
});

registerCommand('surfingkeys.tabs.list', async () => {
    const tabs = await chrome.tabs.query({});
    return tabs.map(tab => ({
        id: tab.id,
        title: tab.title,
        url: tab.url,
        active: tab.active,
        pinned: tab.pinned,
        muted: tab.mutedInfo?.muted || false,
        index: tab.index,
        windowId: tab.windowId
    }));
});

registerCommand('surfingkeys.tabs.switch', async (params) => {
    const { tabId, index, direction } = params;
    
    if (tabId) {
        await chrome.tabs.update(tabId, { active: true });
    } else if (typeof index === 'number') {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const targetTab = tabs.find(t => t.index === index);
        if (targetTab) {
            await chrome.tabs.update(targetTab.id, { active: true });
        }
    } else if (direction === 'next') {
        self.nextTab();
    } else if (direction === 'previous') {
        self.previousTab();
    }
    
    return { success: true };
});

registerCommand('surfingkeys.tabs.close', async (params) => {
    const { tabId, pattern, position } = params;
    
    if (tabId) {
        await chrome.tabs.remove(tabId);
    } else if (position === 'left') {
        self.closeTabLeft();
    } else if (position === 'right') {
        self.closeTabRight();
    } else if (pattern) {
        const tabs = await chrome.tabs.query({});
        const toClose = tabs.filter(tab => 
            tab.url.includes(pattern) || tab.title.includes(pattern)
        );
        await chrome.tabs.remove(toClose.map(t => t.id));
    } else {
        const currentTab = await getCurrentTab();
        await chrome.tabs.remove(currentTab.id);
    }
    
    return { success: true };
});

// Hints commands
registerCommand('surfingkeys.hints.show', async (params) => {
    const { selector = '*[href], button, input, select, textarea', action = 'click' } = params;
    const tab = await getCurrentTab();
    
    return executeInTab(tab.id, 'showHints', {
        selector,
        action
    });
});

registerCommand('surfingkeys.hints.click', async (params) => {
    const { selector, text, index = 0 } = params;
    
    if (!selector && !text) {
        throw new Error('Either selector or text parameter is required');
    }
    
    const tab = await getCurrentTab();
    return executeInTab(tab.id, 'clickElement', {
        selector,
        text,
        index
    });
});

// Search commands
registerCommand('surfingkeys.search', async (params) => {
    const { query, engine = 'google', newTab = true } = params;
    
    if (!query) {
        throw new Error('Query parameter is required');
    }
    
    return new Promise((resolve) => {
        self.searchSelectedWith({
            se: engine,
            query,
            newTab
        }, null, () => {
            resolve({ success: true, query, engine });
        });
    });
});

registerCommand('surfingkeys.find', async (params) => {
    const { text, caseSensitive = false, wholeWord = false } = params;
    const tab = await getCurrentTab();
    
    return executeInTab(tab.id, 'findInPage', {
        text,
        caseSensitive,
        wholeWord
    });
});

// Clipboard commands
registerCommand('surfingkeys.clipboard.read', async () => {
    return new Promise((resolve, reject) => {
        Clipboard.read((text) => {
            if (text !== undefined) {
                resolve({ text });
            } else {
                reject('Failed to read clipboard');
            }
        });
    });
});

registerCommand('surfingkeys.clipboard.write', async (params) => {
    const { text, format = 'text' } = params;
    
    if (!text) {
        throw new Error('Text parameter is required');
    }
    
    Clipboard.write(text);
    return { success: true };
});

// Screenshot command
registerCommand('surfingkeys.screenshot', async (params) => {
    const { format = 'png', quality = 90 } = params;
    const tab = await getCurrentTab();
    
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format,
        quality
    });
    
    return { dataUrl };
});

// Scrolling commands
registerCommand('surfingkeys.scroll', async (params) => {
    const { direction = 'down', amount = 'normal' } = params;
    const tab = await getCurrentTab();
    
    const scrollTypes = {
        'down': 'down',
        'up': 'up',
        'left': 'left',
        'right': 'right',
        'top': 'top',
        'bottom': 'bottom',
        'pageDown': 'pageDown',
        'pageUp': 'pageUp'
    };
    
    const scrollType = scrollTypes[direction];
    if (!scrollType) {
        throw new Error(`Invalid scroll direction: ${direction}`);
    }
    
    return executeInTab(tab.id, 'scroll', {
        type: scrollType,
        smooth: params.smooth !== false
    });
});

// Omnibar commands
registerCommand('surfingkeys.omnibar', async (params) => {
    const { type = 'Commands', query = '' } = params;
    const tab = await getCurrentTab();
    
    const validTypes = ['Bookmarks', 'History', 'Commands', 'Tabs', 'SearchEngine', 'URLs'];
    if (!validTypes.includes(type)) {
        throw new Error(`Invalid omnibar type: ${type}`);
    }
    
    return executeInTab(tab.id, 'openOmnibar', {
        type,
        query
    });
});

// Visual mode commands
registerCommand('surfingkeys.visual.select', async (params) => {
    const { element = false } = params;
    const tab = await getCurrentTab();
    
    return executeInTab(tab.id, 'enterVisualMode', {
        selectElement: element
    });
});

// Export for use in other modules
export default {
    init: initMCPServer,
    registerCommand,
    sendMessage: (message) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }
};