const { app, BrowserWindow, ipcMain, shell, dialog, globalShortcut, Menu } = require('electron');
const fs = require('fs');
const path = require('path');

// ---- Kam RAM sozlamalari ----
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=48');
app.commandLine.appendSwitch('disable-features', 'Translate,MediaRouter,OptimizationHints,AutofillServerCommunication');
app.commandLine.appendSwitch('disk-cache-size', '1');
app.commandLine.appendSwitch('renderer-process-limit', '1');
app.commandLine.appendSwitch('disable-background-networking');

if (!app.requestSingleInstanceLock()) app.quit();

let win;
const allowed = new Set();
const cfgFile = () => path.join(app.getPath('userData'), 'apps.json');

function readCustom() {
  try { return JSON.parse(fs.readFileSync(cfgFile(), 'utf8')); } catch (e) { return []; }
}

function scan(dir, out, depth) {
  let items;
  try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const e of items) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (depth < 3) scan(p, out, depth + 1); }
    else if (/\.(lnk|url)$/i.test(e.name) && !/uninstall|readme|help|license|o'chirish/i.test(e.name)) {
      out.push({ n: e.name.replace(/\.(lnk|url)$/i, ''), path: p });
    }
  }
}

function listApps() {
  const env = process.env, found = [];
  const roots = [
    path.join(env.ProgramData || 'C:\\ProgramData', 'Microsoft\\Windows\\Start Menu\\Programs'),
    path.join(env.APPDATA || '', 'Microsoft\\Windows\\Start Menu\\Programs'),
    path.join(env.USERPROFILE || '', 'Desktop'),
    path.join(env.PUBLIC || 'C:\\Users\\Public', 'Desktop')
  ];
  roots.forEach(r => scan(r, found, 0));
  readCustom().forEach(c => found.push(c));
  const seen = new Set(), res = [];
  for (const a of found) {
    const k = a.n.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k); res.push(a); allowed.add(a.path);
  }
  res.sort((a, b) => a.n.localeCompare(b.n));
  return res;
}

function createWindow() {
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    fullscreen: true, frame: false, show: false, backgroundColor: '#0b1020',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      devTools: false, spellcheck: false, backgroundThrottling: true
    }
  });
  win.loadFile(path.join(__dirname, 'launcher.html'));
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => app.quit());   // Alt+F4 -> to'liq chiqish
}

ipcMain.handle('list', () => listApps());

ipcMain.handle('icon', async (_e, p) => {
  if (!allowed.has(p)) return null;
  try { return (await app.getFileIcon(p, { size: 'normal' })).toDataURL(); } catch (e) { return null; }
});

ipcMain.handle('run', async (_e, p) => {
  if (!allowed.has(p)) return false;
  const err = await shell.openPath(p);   // alohida jarayon: launcher yopilmaydi
  if (!err && win) win.minimize();       // ilova oldinga chiqadi
  return !err;
});

ipcMain.handle('add', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return false;
  const p = r.filePaths[0], list = readCustom();
  if (!list.some(x => x.path === p)) list.push({ n: path.parse(p).name, path: p });
  fs.writeFileSync(cfgFile(), JSON.stringify(list));
  return true;
});

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

app.whenReady().then(() => {
  createWindow();
  // Launcherga qaytish: Ctrl+Alt+L (yoki taskbardan bosing)
  globalShortcut.register('CommandOrControl+Alt+L', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.setFullScreen(true); win.show(); win.focus();
  });
});
app.on('will-quit', () => globalShortcut.unregisterAll());
