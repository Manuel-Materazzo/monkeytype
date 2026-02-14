import { app, BrowserWindow, protocol, session } from "electron";
import path from "node:path";
import fs from "node:fs";

const DIST_PATH = path.join(__dirname, "../dist");

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".webp": "image/webp",
  ".txt": "text/plain",
};

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "Monkeytype",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  void mainWindow.loadURL("app://monkeytype/");
}

async function onReady(): Promise<void> {
  protocol.handle("app", (request) => {
    const requestUrl = new URL(request.url);
    let filePath = decodeURIComponent(requestUrl.pathname);

    if (filePath === "/" || filePath === "") {
      filePath = "/index.html";
    }

    const fullPath = path.join(DIST_PATH, filePath);

    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      return new Response(fs.readFileSync(fullPath), {
        headers: { "Content-Type": getMimeType(fullPath) },
      });
    }

    return new Response(fs.readFileSync(path.join(DIST_PATH, "index.html")), {
      headers: { "Content-Type": "text/html" },
    });
  });

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self' app: https:; script-src 'self' app: 'unsafe-inline' https:; style-src 'self' app: 'unsafe-inline'; img-src 'self' app: data: https:; font-src 'self' app: data:; connect-src 'self' app: https:;",
        ],
      },
    });
  });

  createWindow();
}

void app.whenReady().then(onReady);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
