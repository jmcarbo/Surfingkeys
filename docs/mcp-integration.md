# MCP (Model Context Protocol) Integration

This document describes the MCP WebSocket server integration in Surfingkeys, which exposes the extension's functionality for programmatic control.

## Overview

The MCP integration allows external applications and AI agents to control Surfingkeys through a WebSocket interface. This enables automation, testing, and integration with other tools.

## WebSocket Server

- **Default endpoint**: `ws://localhost:8765`
- **Automatic reconnection**: 5-second intervals
- **Protocol**: JSON-based message passing

## Message Format

### Request Format
```json
{
  "id": "unique-request-id",
  "command": "surfingkeys.commandName",
  "params": {
    // Command-specific parameters
  }
}
```

### Response Format
```json
{
  "id": "unique-request-id",
  "type": "response",
  "result": {
    // Command results
  }
}
```

### Error Format
```json
{
  "id": "unique-request-id",
  "type": "error",
  "error": "Error message"
}
```

## Available Commands

### Navigation Commands

#### `surfingkeys.navigate`
Open a URL with options.
```json
{
  "command": "surfingkeys.navigate",
  "params": {
    "url": "https://example.com",
    "newTab": true,
    "active": true,
    "position": "default"
  }
}
```

#### `surfingkeys.tabs.list`
List all open tabs.
```json
{
  "command": "surfingkeys.tabs.list",
  "params": {}
}
```

#### `surfingkeys.tabs.switch`
Switch between tabs.
```json
{
  "command": "surfingkeys.tabs.switch",
  "params": {
    "tabId": 123,
    // or
    "index": 2,
    // or
    "direction": "next" // or "previous"
  }
}
```

#### `surfingkeys.tabs.close`
Close tabs with various options.
```json
{
  "command": "surfingkeys.tabs.close",
  "params": {
    "tabId": 123,
    // or
    "position": "left", // or "right"
    // or
    "pattern": "example.com"
  }
}
```

### Hints Commands

#### `surfingkeys.hints.show`
Display hints for interactive elements.
```json
{
  "command": "surfingkeys.hints.show",
  "params": {
    "selector": "a, button",
    "action": "click" // or "hover", "focus", "copy"
  }
}
```

#### `surfingkeys.hints.click`
Click a specific element.
```json
{
  "command": "surfingkeys.hints.click",
  "params": {
    "selector": "button.submit",
    "index": 0,
    // or
    "text": "Submit"
  }
}
```

### Search Commands

#### `surfingkeys.search`
Search with various search engines.
```json
{
  "command": "surfingkeys.search",
  "params": {
    "query": "surfingkeys tips",
    "engine": "google",
    "newTab": true
  }
}
```

#### `surfingkeys.find`
Find text in the current page.
```json
{
  "command": "surfingkeys.find",
  "params": {
    "text": "search term",
    "caseSensitive": false,
    "wholeWord": false
  }
}
```

### Clipboard Commands

#### `surfingkeys.clipboard.read`
Read from the clipboard.
```json
{
  "command": "surfingkeys.clipboard.read",
  "params": {}
}
```

#### `surfingkeys.clipboard.write`
Write to the clipboard.
```json
{
  "command": "surfingkeys.clipboard.write",
  "params": {
    "text": "Content to copy",
    "format": "text"
  }
}
```

### Other Commands

#### `surfingkeys.screenshot`
Capture a screenshot of the visible area.
```json
{
  "command": "surfingkeys.screenshot",
  "params": {
    "format": "png",
    "quality": 90
  }
}
```

#### `surfingkeys.scroll`
Scroll the page in various directions.
```json
{
  "command": "surfingkeys.scroll",
  "params": {
    "direction": "down", // "up", "left", "right", "top", "bottom", "pageDown", "pageUp"
    "smooth": true
  }
}
```

#### `surfingkeys.omnibar`
Open the omnibar with different modes.
```json
{
  "command": "surfingkeys.omnibar",
  "params": {
    "type": "Commands", // "Bookmarks", "History", "Tabs", "SearchEngine", "URLs"
    "query": "initial query"
  }
}
```

#### `surfingkeys.visual.select`
Enter visual mode for text selection.
```json
{
  "command": "surfingkeys.visual.select",
  "params": {
    "element": false // true for element selection mode
  }
}
```

## Example Usage

### JavaScript WebSocket Client
```javascript
const ws = new WebSocket('ws://localhost:8765');

ws.onopen = () => {
    // Send a command
    ws.send(JSON.stringify({
        id: 'cmd-1',
        command: 'surfingkeys.navigate',
        params: {
            url: 'https://github.com',
            newTab: true
        }
    }));
};

ws.onmessage = (event) => {
    const response = JSON.parse(event.data);
    console.log('Response:', response);
};
```

### Python WebSocket Client
```python
import asyncio
import websockets
import json

async def test_surfingkeys():
    async with websockets.connect('ws://localhost:8765') as websocket:
        # List all tabs
        await websocket.send(json.dumps({
            'id': 'py-1',
            'command': 'surfingkeys.tabs.list',
            'params': {}
        }))
        
        response = await websocket.recv()
        print(json.loads(response))

asyncio.run(test_surfingkeys())
```

## Testing

A test page is available at `/test/mcp_test.html` to verify the MCP integration functionality. Open this file in a browser with Surfingkeys installed to test various commands.

## Architecture

The MCP integration consists of:
1. **Background Script** (`mcp.js`): WebSocket server connection and command routing
2. **Content Script Handler** (`mcp_handler.js`): Executes commands in page context
3. **Message Passing**: Uses Chrome extension messaging between background and content scripts

## Security Considerations

- The WebSocket server only accepts connections from localhost by default
- Commands are executed with the same permissions as the Surfingkeys extension
- No authentication is currently implemented (suitable for local development)

## Future Enhancements

- Authentication mechanism for production use
- Configuration for custom WebSocket endpoints
- Additional commands for advanced browser automation
- Event streaming for real-time updates