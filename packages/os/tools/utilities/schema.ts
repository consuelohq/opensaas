import type { ToolSchemaContribution } from '../package';

export const toolSchemas = [
  {
    "name": "browser",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "browser",
      "methodPath": [
        "browser",
        "run"
      ],
      "description": "run the generic workspace browser wrapper command",
      "category": "utilities",
      "underlying": "workspace browser",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "BrowserInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "command": "open",
        "url": "https://example.com",
        "dryRun": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "browser.app",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "browser.app",
      "methodPath": [
        "browser",
        "app"
      ],
      "description": "open app.consuelohq.com with the browser wrapper",
      "category": "utilities",
      "underlying": "workspace browser.app",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "BrowserPageInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "preset": "desktop",
        "dryRun": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "browser.click",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "browser.click",
      "methodPath": [
        "browser",
        "click"
      ],
      "description": "click a browser element by ref",
      "category": "utilities",
      "underlying": "workspace browser.click",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "BrowserElementInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "ref": "@e1",
        "dryRun": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "browser.clipboard",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "browser.clipboard",
      "methodPath": [
        "browser",
        "clipboard"
      ],
      "description": "read from or write to the browser clipboard",
      "category": "utilities",
      "underlying": "workspace browser.clipboard",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "BrowserClipboardInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "action": "read",
        "dryRun": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "browser.close",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "browser.close",
      "methodPath": [
        "browser",
        "close"
      ],
      "description": "close active browser sessions",
      "category": "utilities",
      "underlying": "workspace browser.close",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "EmptyInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "browser.consuelo",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "browser.consuelo",
      "methodPath": [
        "browser",
        "consuelo"
      ],
      "description": "open consuelo.consuelohq.com with the browser wrapper",
      "category": "utilities",
      "underlying": "workspace browser.consuelo",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "BrowserPageInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "preset": "desktop",
        "dryRun": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "browser.cookies",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "browser.cookies",
      "methodPath": [
        "browser",
        "cookies"
      ],
      "description": "list, set, or clear browser cookies for the current browser session",
      "category": "utilities",
      "underlying": "workspace browser.cookies",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "BrowserCookiesInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "action": "list",
        "dryRun": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "browser.dialog",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "browser.dialog",
      "methodPath": [
        "browser",
        "dialog"
      ],
      "description": "accept or dismiss browser dialogs",
      "category": "utilities",
      "underlying": "workspace browser.dialog",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "BrowserDialogInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "action": "dismiss",
        "dryRun": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "browser.download",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "browser.download",
      "methodPath": [
        "browser",
        "download"
      ],
      "description": "click an element and save the triggered download to a path",
      "category": "utilities",
      "underlying": "workspace browser.download",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "BrowserDownloadInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "ref": "@e1",
        "path": "/tmp/download.bin",
        "dryRun": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "browser.eval",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "browser.eval",
      "methodPath": [
        "browser",
        "eval"
      ],
      "description": "execute JavaScript on the current browser page",
      "category": "utilities",
      "underlying": "workspace browser.eval",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "BrowserEvalInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "js": "document.title",
        "dryRun": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "browser.fill",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "browser.fill",
      "methodPath": [
        "browser",
        "fill"
      ],
      "description": "fill a browser input by ref",
      "category": "utilities",
      "underlying": "workspace browser.fill",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "BrowserFillInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "ref": "@e1",
        "text": "hello",
        "dryRun": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "browser.find",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "browser.find",
      "methodPath": [
        "browser",
        "find"
      ],
      "description": "find an element by role, text, label, placeholder, alt text, title, or test id and run an action",
      "category": "utilities",
      "underlying": "workspace browser.find",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "BrowserFindInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "by": "role",
        "value": "button",
        "action": "click",
        "name": "Submit",
        "dryRun": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "browser.get",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "browser.get",
      "methodPath": [
        "browser",
        "get"
      ],
      "description": "get text, html, value, attributes, title, or URL from the current page",
      "category": "utilities",
      "underlying": "workspace browser.get",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "BrowserGetInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "target": "title",
        "dryRun": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "browser.headed",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "browser.headed",
      "methodPath": [
        "browser",
        "headed"
      ],
      "description": "open the shared persistent browser visibly when the user must complete login, MFA, CAPTCHA, passkeys, or consent",
      "category": "utilities",
      "underlying": "workspace browser.headed",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "BrowserHeadedInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "url": "https://dash.cloudflare.com",
        "dryRun": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "browser.network",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "browser.network",
      "methodPath": [
        "browser",
        "network"
      ],
      "description": "inspect or manage browser network requests, routes, and HAR capture",
      "category": "utilities",
      "underlying": "workspace browser.network",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "BrowserNetworkInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "args": [
          "requests"
        ],
        "dryRun": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "browser.open",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "browser.open",
      "methodPath": [
        "browser",
        "open"
      ],
      "description": "open a URL with the browser wrapper",
      "category": "utilities",
      "underlying": "workspace browser.open",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "BrowserOpenInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "url": "https://example.com",
        "preset": "mobile",
        "full": true,
        "dryRun": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "browser.raw",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "browser.raw",
      "methodPath": [
        "browser",
        "raw"
      ],
      "description": "pass raw arguments through to agent-browser",
      "category": "utilities",
      "underlying": "workspace browser.raw",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "BrowserRawInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "args": [
          "tab",
          "list"
        ],
        "dryRun": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "browser.screenshot",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "browser.screenshot",
      "methodPath": [
        "browser",
        "screenshot"
      ],
      "description": "capture a browser screenshot",
      "category": "utilities",
      "underlying": "workspace browser.screenshot",
      "capabilities": {
        "readOnly": false,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "BrowserScreenshotInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "name": "mobile-check",
        "preset": "mobile",
        "dryRun": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "browser.snap",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "browser.snap",
      "methodPath": [
        "browser",
        "snap"
      ],
      "description": "capture an accessibility snapshot",
      "category": "utilities",
      "underlying": "workspace browser.snap",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 300000,
      "inputSchema": "EmptyInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "browser.status",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "browser.status",
      "methodPath": [
        "browser",
        "status"
      ],
      "description": "report safe browser daemon and page status without authentication values",
      "category": "utilities",
      "underlying": "workspace browser.status",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 300000,
      "inputSchema": "EmptyInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "dryRun": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "browser.tabs",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "browser.tabs",
      "methodPath": [
        "browser",
        "tabs"
      ],
      "description": "list, create, select, or close browser tabs with stable labels when needed",
      "category": "utilities",
      "underlying": "workspace browser.tabs",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "BrowserTabsInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "action": "list",
        "dryRun": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "browser.test",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "browser.test",
      "methodPath": [
        "browser",
        "test"
      ],
      "description": "open a URL, wait for load, snapshot, and screenshot",
      "category": "utilities",
      "underlying": "workspace browser.test",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "BrowserOpenInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "url": "https://example.com",
        "preset": "mobile",
        "full": true,
        "dryRun": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "browser.trace",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "browser.trace",
      "methodPath": [
        "browser",
        "trace"
      ],
      "description": "start or stop browser tracing and optionally write a trace file",
      "category": "utilities",
      "underlying": "workspace browser.trace",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "BrowserTraceInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "action": "start",
        "dryRun": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "browser.wait",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "browser.wait",
      "methodPath": [
        "browser",
        "wait"
      ],
      "description": "wait for a selector, duration, text, URL, load state, JavaScript condition, or download",
      "category": "utilities",
      "underlying": "workspace browser.wait",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 300000,
      "inputSchema": "BrowserWaitInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "load": "networkidle",
        "dryRun": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "doctor",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "doctor",
      "methodPath": [
        "doctor"
      ],
      "description": "run workspace diagnostics",
      "category": "utilities",
      "underlying": "workspace doctor",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 120000,
      "inputSchema": "EmptyInput",
      "outputSchema": "RawOutput",
      "exampleInput": {},
      "sessionRequired": false
    }
  },
  {
    "name": "git.status",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "git.status",
      "methodPath": [
        "git",
        "status"
      ],
      "description": "alias for status; use status directly in new code",
      "category": "utilities",
      "underlying": "workspace status",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 120000,
      "inputSchema": "EmptyInput",
      "outputSchema": "RawOutput",
      "exampleInput": {},
      "sessionRequired": false
    }
  },
  {
    "name": "research.ingest",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "research.ingest",
      "methodPath": [
        "research",
        "ingest"
      ],
      "description": "generate a local research packet and autosave its text bundle to memory",
      "category": "utilities",
      "underlying": "workspace research.ingest",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 600000,
      "inputSchema": "ResearchIngestInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "source": "https://example.com",
        "question": "What should I learn from this?",
        "dryRun": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "server",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "server",
      "methodPath": [
        "server"
      ],
      "description": "manage the workspace MCP server reload/status lifecycle",
      "category": "utilities",
      "underlying": "workspace server",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 120000,
      "inputSchema": "ServerInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "action": "status"
      },
      "sessionRequired": false
    }
  },
  {
    "name": "status",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "status",
      "methodPath": [
        "status"
      ],
      "description": "show compact workspace status",
      "category": "utilities",
      "underlying": "workspace status",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 120000,
      "inputSchema": "EmptyInput",
      "outputSchema": "RawOutput",
      "exampleInput": {},
      "sessionRequired": false
    }
  },
  {
    "name": "tmp",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "tmp",
      "methodPath": [
        "tmp"
      ],
      "description": "run the workspace temp-file helper",
      "category": "utilities",
      "underlying": "workspace tmp",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 60000,
      "inputSchema": "TmpInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "action": "write",
        "name": "example",
        "content": "hello",
        "dryRun": true
      },
      "sessionRequired": false
    }
  },
  {
    "name": "wait",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "search",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "wait",
      "methodPath": [
        "wait"
      ],
      "description": "sleep, create detached wait checkpoints, or wait for a PR/deploy",
      "category": "utilities",
      "underlying": "workspace wait",
      "capabilities": {
        "readOnly": true,
        "mutating": false,
        "deterministic": false,
        "safeToRetry": true
      },
      "defaultTimeout": 300000,
      "inputSchema": "WaitInput",
      "outputSchema": "RawOutput",
      "search": { "keywords": ["timed", "polling", "sleep", "delay", "seconds", "backoff"] },
      "exampleInput": {
        "duration": "24h",
        "detached": true,
        "reason": "wake after long-running external work"
      },
      "sessionRequired": false
    }
  },
  {
    "name": "website.deploy",
    "order": [
      "name",
      "methodPath",
      "description",
      "category",
      "underlying",
      "capabilities",
      "defaultTimeout",
      "inputSchema",
      "outputSchema",
      "command",
      "exampleInput",
      "sessionRequired"
    ],
    "definition": {
      "name": "website.deploy",
      "methodPath": [
        "website",
        "deploy"
      ],
      "description": "deploy the Consuelo website",
      "category": "utilities",
      "underlying": "workspace website.deploy",
      "capabilities": {
        "readOnly": false,
        "mutating": true,
        "deterministic": false,
        "safeToRetry": false
      },
      "defaultTimeout": 600000,
      "inputSchema": "WebsiteDeployInput",
      "outputSchema": "RawOutput",
      "exampleInput": {
        "buildOnly": true,
        "dryRun": true
      },
      "sessionRequired": false
    }
  }
] as const satisfies readonly ToolSchemaContribution[];
