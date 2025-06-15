/*
 * MCP Content Script Handler
 * Handles MCP commands executed in the context of web pages
 */

function createMCPHandler(normal, hints, visual, front, clipboard) {
    const self = {};

    // Message handler for MCP commands from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (!request.action) {
            return;
        }

        // Handle MCP commands asynchronously
        (async () => {
            try {
                let result;
                
                switch (request.action) {
                    case 'showHints':
                        result = await showHints(request);
                        break;
                        
                    case 'clickElement':
                        result = await clickElement(request);
                        break;
                        
                    case 'findInPage':
                        result = await findInPage(request);
                        break;
                        
                    case 'scroll':
                        result = await performScroll(request);
                        break;
                        
                    case 'openOmnibar':
                        result = await openOmnibar(request);
                        break;
                        
                    case 'enterVisualMode':
                        result = await enterVisualMode(request);
                        break;
                        
                    default:
                        throw new Error(`Unknown MCP action: ${request.action}`);
                }
                
                sendResponse({ success: true, result });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        
        // Return true to indicate async response
        return true;
    });

    // Show hints for elements
    async function showHints(params) {
        const { selector, action } = params;
        
        return new Promise((resolve) => {
            // Map action to Surfingkeys hint type
            const hintActionMap = {
                'click': hints.dispatchMouseClick,
                'hover': (element) => {
                    element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
                },
                'focus': (element) => element.focus(),
                'copy': (element) => {
                    const url = element.href || element.src || element.textContent;
                    clipboard.write(url);
                }
            };
            
            const callback = hintActionMap[action] || hints.dispatchMouseClick;
            
            hints.create(selector, callback);
            
            // Return hint information
            const elements = document.querySelectorAll(selector);
            const hintsList = Array.from(elements).map((el, index) => ({
                index,
                text: el.textContent?.trim(),
                href: el.href,
                tagName: el.tagName.toLowerCase(),
                visible: isElementVisible(el)
            }));
            
            resolve({ hints: hintsList.filter(h => h.visible) });
        });
    }

    // Click a specific element
    async function clickElement(params) {
        const { selector, text, index } = params;
        
        let element;
        
        if (selector) {
            const elements = document.querySelectorAll(selector);
            element = elements[index || 0];
        } else if (text) {
            // Find element by text content
            const allElements = document.querySelectorAll('*');
            element = Array.from(allElements).find(el => 
                el.textContent?.trim() === text || 
                el.getAttribute('aria-label') === text
            );
        }
        
        if (!element) {
            throw new Error('Element not found');
        }
        
        // Use Surfingkeys' click dispatcher for better compatibility
        hints.dispatchMouseClick(element);
        
        return {
            clicked: true,
            element: {
                tagName: element.tagName.toLowerCase(),
                text: element.textContent?.trim(),
                href: element.href
            }
        };
    }

    // Find text in page
    async function findInPage(params) {
        const { text, caseSensitive, wholeWord } = params;
        
        if (!text) {
            throw new Error('Search text is required');
        }
        
        // Open Surfingkeys finder
        front.openFinder({
            caseSensitive,
            wholeWord
        });
        
        // Set search text
        setTimeout(() => {
            front.find(text);
        }, 100);
        
        return { searching: true, text };
    }

    // Perform scroll action
    async function performScroll(params) {
        const { type, smooth } = params;
        
        // Use Surfingkeys' scroll function
        normal.scroll(type);
        
        // Get current scroll position
        const scrollInfo = {
            x: window.scrollX,
            y: window.scrollY,
            maxX: document.documentElement.scrollWidth - window.innerWidth,
            maxY: document.documentElement.scrollHeight - window.innerHeight
        };
        
        return { scrolled: true, position: scrollInfo };
    }

    // Open omnibar
    async function openOmnibar(params) {
        const { type, query } = params;
        
        const omnibarTypes = {
            'Bookmarks': { type: 'Bookmarks' },
            'History': { type: 'History' },
            'Commands': { type: 'Commands' },
            'Tabs': { type: 'Tabs' },
            'SearchEngine': { type: 'SearchEngine' },
            'URLs': { type: 'UserURLs' }
        };
        
        const omnibarConfig = omnibarTypes[type];
        if (!omnibarConfig) {
            throw new Error(`Invalid omnibar type: ${type}`);
        }
        
        front.openOmnibar(omnibarConfig);
        
        // Pre-fill query if provided
        if (query) {
            setTimeout(() => {
                const input = document.querySelector('#sk_omnibar input');
                if (input) {
                    input.value = query;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }, 100);
        }
        
        return { opened: true, type };
    }

    // Enter visual mode
    async function enterVisualMode(params) {
        const { selectElement } = params;
        
        if (selectElement) {
            visual.selectElement();
        } else {
            visual.select();
        }
        
        return { visualMode: true, elementMode: selectElement };
    }
    
    return self;
}

// Helper function to check element visibility (if not available in dom.js)
function isElementVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    return rect.width > 0 && 
           rect.height > 0 && 
           style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0';
}

export default createMCPHandler;