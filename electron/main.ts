import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import { JsonDatabase } from './database';

let mainWindow: BrowserWindow | null = null;
const db = new JsonDatabase();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1080,
    minHeight: 720,
    title: 'Easy Automate',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#020617',
      symbolColor: '#94a3b8',
      height: 38,
    },
    backgroundColor: '#020617',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173').catch(() => {
      mainWindow?.loadFile(path.join(__dirname, '../dist/index.html'));
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Open external links in default system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Window control handlers
ipcMain.on('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window:close', () => {
  if (mainWindow) mainWindow.close();
});

// Authentication IPC handlers
ipcMain.handle('auth:register', async (_event, email: string) => {
  try {
    return { success: true, ...db.registerUser(email) };
  } catch (err: any) {
    return { success: false, error: err.message || 'Registration failed' };
  }
});

ipcMain.handle('auth:verifyToken', async (_event, token: string) => {
  try {
    return db.verifyActivationToken(token);
  } catch (err: any) {
    return { valid: false, error: err.message || 'Token verification failed' };
  }
});

ipcMain.handle('auth:activateAccount', async (_event, { token, password }: { token: string; password: string }) => {
  try {
    const user = db.activateAccount(token, password);
    const { passwordHash, ...safeUser } = user;
    return { success: true, user: safeUser };
  } catch (err: any) {
    return { success: false, error: err.message || 'Activation failed' };
  }
});

ipcMain.handle('auth:login', async (_event, { email, password }: { email: string; password: string }) => {
  try {
    const user = db.loginUser(email, password);
    const { passwordHash, ...safeUser } = user;
    return { success: true, user: safeUser };
  } catch (err: any) {
    return { success: false, error: err.message || 'Invalid credentials' };
  }
});

ipcMain.handle('auth:getUser', async (_event, userId: string) => {
  const user = db.findUserById(userId);
  if (!user) return null;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
});

// Projects IPC handlers
ipcMain.handle('projects:getAll', async (_event, userId: string) => {
  try {
    const projects = db.getProjects(userId);
    return { success: true, projects };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch projects' };
  }
});

ipcMain.handle('projects:getById', async (_event, { projectId, userId }: { projectId: string; userId: string }) => {
  try {
    const project = db.getProjectById(projectId, userId);
    if (!project) return { success: false, error: 'Project not found' };
    return { success: true, project };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch project' };
  }
});

ipcMain.handle('projects:create', async (_event, { userId, data }: { userId: string; data: any }) => {
  try {
    const project = db.createProject(userId, data);
    return { success: true, project };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create project' };
  }
});

ipcMain.handle('projects:update', async (_event, { projectId, userId, updates }: { projectId: string; userId: string; updates: any }) => {
  try {
    const project = db.updateProject(projectId, userId, updates);
    return { success: true, project };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update project' };
  }
});

ipcMain.handle('projects:delete', async (_event, { projectId, userId }: { projectId: string; userId: string }) => {
  try {
    db.deleteProject(projectId, userId);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete project' };
  }
});

// ================= Stage 2: Repository IPC Handlers ================= //

ipcMain.handle('repository:getPages', async (_event, projectId: string) => {
  try {
    const pages = db.getRepositoryPages(projectId);
    return { success: true, pages };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to get pages' };
  }
});

ipcMain.handle('repository:createPage', async (_event, { projectId, name, parentId }: { projectId: string; name: string; parentId?: string | null }) => {
  try {
    const page = db.createRepositoryPage(projectId, name, parentId);
    return { success: true, page };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create page' };
  }
});

ipcMain.handle('repository:updatePage', async (_event, { pageId, projectId, name }: { pageId: string; projectId: string; name: string }) => {
  try {
    const page = db.updateRepositoryPage(pageId, projectId, name);
    return { success: true, page };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update page' };
  }
});

ipcMain.handle('repository:deletePage', async (_event, { pageId, projectId }: { pageId: string; projectId: string }) => {
  try {
    db.deleteRepositoryPage(pageId, projectId);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete page' };
  }
});

ipcMain.handle('repository:getElements', async (_event, { projectId, pageId }: { projectId: string; pageId?: string }) => {
  try {
    const elements = db.getRepositoryElements(projectId, pageId);
    return { success: true, elements };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to get elements' };
  }
});

ipcMain.handle('repository:createElement', async (_event, { projectId, pageId, data }: { projectId: string; pageId: string; data: any }) => {
  try {
    const element = db.createRepositoryElement(projectId, pageId, data);
    return { success: true, element };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create element' };
  }
});

ipcMain.handle('repository:updateElement', async (_event, { elementId, projectId, data }: { elementId: string; projectId: string; data: any }) => {
  try {
    const element = db.updateRepositoryElement(elementId, projectId, data);
    return { success: true, element };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update element' };
  }
});

ipcMain.handle('repository:deleteElement', async (_event, { elementId, projectId }: { elementId: string; projectId: string }) => {
  try {
    db.deleteRepositoryElement(elementId, projectId);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete element' };
  }
});

// ================= Stage 2: Dashboard IPC Handlers ================= //

ipcMain.handle('dashboard:getStats', async (_event, projectId: string) => {
  try {
    const stats = db.getProjectDashboardStats(projectId);
    return { success: true, stats };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to get dashboard stats' };
  }
});

// Email simulator handlers
ipcMain.handle('email:getSimulatedEmails', async (_event, toEmail?: string) => {
  return db.getSimulatedEmails(toEmail);
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
