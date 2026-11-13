import { app, BrowserWindow, ipcMain, shell, screen, dialog } from 'electron';
import path from 'path';
import { JsonDatabase } from './database';
import { AutomationEngine } from './engine/automationEngine';
import { evaluateLocatorStability } from './locatorEvaluator';
import { finderSession } from './finderSession';
import { AIModelService } from './ai/aiModelService';
import { AIAutoTestingEngine } from './ai/aiAutoTestingEngine';
import { DocumentParser } from './ai/documentParser';

let mainWindow: BrowserWindow | null = null;
const db = new JsonDatabase();
const aiModelService = new AIModelService(db);
const aiAutoTestingEngine = new AIAutoTestingEngine(db, aiModelService);

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
    finderSession.setMainWindow(null);
    aiAutoTestingEngine.setMainWindow(null);
  });

  finderSession.setMainWindow(mainWindow);
  aiAutoTestingEngine.setMainWindow(mainWindow);
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

ipcMain.handle('repository:checkDependencies', async (_event, { elementId, projectId }: { elementId: string; projectId: string }) => {
  try {
    const deps = db.checkElementDependencies(elementId, projectId);
    return { success: true, ...deps };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to check element dependencies' };
  }
});

ipcMain.handle('repository:createElement', async (_event, { projectId, pageId, data }: { projectId: string; pageId: string; data: any }) => {
  try {
    const element = db.createRepositoryElement(projectId, pageId, data);
    mainWindow?.webContents.send('repository:elementChanged', { action: 'created', element, projectId });
    return { success: true, element };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create element' };
  }
});

ipcMain.handle('repository:updateElement', async (_event, { elementId, projectId, data }: { elementId: string; projectId: string; data: any }) => {
  try {
    const element = db.updateRepositoryElement(elementId, projectId, data);
    mainWindow?.webContents.send('repository:elementChanged', { action: 'updated', element, projectId });
    return { success: true, element };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update element' };
  }
});

ipcMain.handle('repository:deleteElement', async (_event, { elementId, projectId, force }: { elementId: string; projectId: string; force?: boolean }) => {
  try {
    db.deleteRepositoryElement(elementId, projectId, force);
    mainWindow?.webContents.send('repository:elementChanged', { action: 'deleted', elementId, projectId });
    return { success: true };
  } catch (err: any) {
    const deps = db.checkElementDependencies(elementId, projectId);
    return {
      success: false,
      error: err.message || 'Failed to delete element',
      hasDependencies: deps.hasDependencies,
      dependentScripts: deps.dependentScripts
    };
  }
});

ipcMain.handle('repository:getLearnedLocator', async (_event, { elementId }: { elementId: string }) => {
  try {
    const learned = db.getLearnedLocator(elementId);
    return { success: true, learnedLocator: learned };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('repository:testLocator', async (_event, { locatorType, locatorValue }: { locatorType: string; locatorValue: string }) => {
  try {
    const result = evaluateLocatorStability(locatorType, locatorValue);
    return { success: true, ...result };
  } catch (err: any) {
    return { success: false, error: err.message || 'Locator testing failed' };
  }
});

// Interactive Locator Finder persistent element inspection & capture session
ipcMain.handle('repository:inspectElement', async (_event, { url }: { url: string }) => {
  return await finderSession.startSession(url, 'chromium', 'normal');
});

// ================= Finder Session IPC Handlers ================= //
ipcMain.handle('finder:startSession', async (_event, { url, browserType, captureMode }: { url: string; browserType?: 'chromium' | 'firefox' | 'webkit'; captureMode?: 'normal' | 'reference' }) => {
  return await finderSession.startSession(url, browserType, captureMode);
});

ipcMain.handle('finder:pauseCapture', async () => {
  return await finderSession.pauseCapture();
});

ipcMain.handle('finder:resumeCapture', async () => {
  return await finderSession.resumeCapture();
});

ipcMain.handle('finder:closeSession', async () => {
  return await finderSession.closeSession();
});

ipcMain.handle('finder:testLocator', async (_event, { locatorType, locatorValue }: { locatorType: string; locatorValue: string }) => {
  return await finderSession.testLocator(locatorType, locatorValue);
});

ipcMain.handle('finder:highlightLocator', async (_event, { locatorType, locatorValue }: { locatorType: string; locatorValue: string }) => {
  return await finderSession.highlightLocator(locatorType, locatorValue);
});

ipcMain.handle('finder:setCaptureMode', async (_event, mode: 'normal' | 'reference') => {
  finderSession.setCaptureMode(mode);
  return { success: true };
});

ipcMain.handle('finder:getStatus', async () => {
  return finderSession.getStatus();
});

ipcMain.handle('finder:setCapturedSequence', async (_event, count: number) => {
  finderSession.setCapturedSequence(count);
  return { success: true };
});

ipcMain.handle('finder:syncSessionElements', async (_event, elements: any[]) => {
  finderSession.syncSessionElements(elements);
  return { success: true };
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

// ================= Stage 3: Test Data Management IPC Handlers ================= //

ipcMain.handle('testData:getFolders', async (_event, projectId: string) => {
  try {
    const folders = db.getTestDataFolders(projectId);
    return { success: true, folders };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to get test data folders' };
  }
});

ipcMain.handle('testData:createFolder', async (_event, { projectId, name, parentId }: { projectId: string; name: string; parentId?: string | null }) => {
  try {
    const folder = db.createTestDataFolder(projectId, name, parentId);
    return { success: true, folder };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create test data folder' };
  }
});

ipcMain.handle('testData:updateFolder', async (_event, { folderId, projectId, name }: { folderId: string; projectId: string; name: string }) => {
  try {
    const folder = db.updateTestDataFolder(folderId, projectId, name);
    return { success: true, folder };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update test data folder' };
  }
});

ipcMain.handle('testData:deleteFolder', async (_event, { folderId, projectId }: { folderId: string; projectId: string }) => {
  try {
    db.deleteTestDataFolder(folderId, projectId);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete test data folder' };
  }
});

ipcMain.handle('testData:getFiles', async (_event, { projectId, folderId }: { projectId: string; folderId?: string | null }) => {
  try {
    const files = db.getTestDataFiles(projectId, folderId);
    return { success: true, files };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to get test data files' };
  }
});

ipcMain.handle('testData:getFileById', async (_event, { fileId, projectId }: { fileId: string; projectId: string }) => {
  try {
    const file = db.getTestDataFileById(fileId, projectId);
    if (!file) return { success: false, error: 'File not found' };
    return { success: true, file };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to get file' };
  }
});

ipcMain.handle('testData:uploadFile', async (_event, { projectId, folderId, file }: { projectId: string; folderId: string | null; file: any }) => {
  try {
    const uploaded = db.uploadTestDataFile(projectId, folderId, file);
    return { success: true, file: uploaded };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to upload file' };
  }
});

ipcMain.handle('testData:updateFile', async (_event, { fileId, projectId, updates }: { fileId: string; projectId: string; updates: any }) => {
  try {
    const updated = db.updateTestDataFile(fileId, projectId, updates);
    return { success: true, file: updated };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update file' };
  }
});

ipcMain.handle('testData:deleteFile', async (_event, { fileId, projectId }: { fileId: string; projectId: string }) => {
  try {
    db.deleteTestDataFile(fileId, projectId);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete file' };
  }
});

// ================= Stage 4 & 5: TestDev IPC Handlers ================= //

// Modules
ipcMain.handle('scripts:getModules', async (_event, projectId: string) => {
  try {
    const modules = db.getScriptModules(projectId);
    return { success: true, modules };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to get modules' };
  }
});

ipcMain.handle('scripts:createModule', async (_event, { projectId, name, parentId }: { projectId: string; name: string; parentId?: string | null }) => {
  try {
    const module = db.createScriptModule(projectId, name, parentId);
    return { success: true, module };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create module' };
  }
});

ipcMain.handle('scripts:updateModule', async (_event, { moduleId, projectId, name }: { moduleId: string; projectId: string; name: string }) => {
  try {
    const module = db.updateScriptModule(moduleId, projectId, name);
    return { success: true, module };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update module' };
  }
});

ipcMain.handle('scripts:deleteModule', async (_event, { moduleId, projectId }: { moduleId: string; projectId: string }) => {
  try {
    db.deleteScriptModule(moduleId, projectId);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete module' };
  }
});

// Scripts
ipcMain.handle('scripts:getScripts', async (_event, { projectId, moduleId }: { projectId: string; moduleId?: string }) => {
  try {
    const scripts = db.getScripts(projectId, moduleId);
    return { success: true, scripts };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to get scripts' };
  }
});

ipcMain.handle('scripts:getScriptById', async (_event, { scriptId, projectId }: { scriptId: string; projectId: string }) => {
  try {
    const script = db.getScriptById(scriptId, projectId);
    if (!script) return { success: false, error: 'Script not found' };
    return { success: true, script };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to get script' };
  }
});

ipcMain.handle('scripts:createScript', async (_event, { projectId, moduleId, name, createdBy, description }: { projectId: string; moduleId: string; name: string; createdBy: string; description?: string }) => {
  try {
    const script = db.createScript(projectId, moduleId, name, createdBy, description);
    return { success: true, script };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create script' };
  }
});

ipcMain.handle('scripts:updateScript', async (_event, { scriptId, projectId, updates }: { scriptId: string; projectId: string; updates: any }) => {
  try {
    const script = db.updateScript(scriptId, projectId, updates);
    return { success: true, script };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update script' };
  }
});

ipcMain.handle('scripts:deleteScript', async (_event, { scriptId, projectId, force }: { scriptId: string; projectId: string; force?: boolean }) => {
  try {
    const res = db.deleteScript(scriptId, projectId, force);
    return res;
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Failed to delete script',
      hasDependencies: err.hasDependencies,
      dependentSuites: err.dependentSuites
    };
  }
});

ipcMain.handle('scripts:checkDependencies', async (_event, { scriptId, projectId }: { scriptId: string; projectId: string }) => {
  try {
    const res = db.checkScriptDependencies(scriptId, projectId);
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to check script dependencies' };
  }
});

// Steps
ipcMain.handle('scripts:addStep', async (_event, { scriptId, projectId, step, insertAfterStepNumber }: { scriptId: string; projectId: string; step: any; insertAfterStepNumber?: number }) => {
  try {
    const script = db.addScriptStep(scriptId, projectId, step, insertAfterStepNumber);
    return { success: true, script };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to add step' };
  }
});

ipcMain.handle('scripts:updateStep', async (_event, { scriptId, projectId, stepId, updates }: { scriptId: string; projectId: string; stepId: string; updates: any }) => {
  try {
    const script = db.updateScriptStep(scriptId, projectId, stepId, updates);
    return { success: true, script };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update step' };
  }
});

ipcMain.handle('scripts:deleteStep', async (_event, { scriptId, projectId, stepId }: { scriptId: string; projectId: string; stepId: string }) => {
  try {
    const script = db.deleteScriptStep(scriptId, projectId, stepId);
    return { success: true, script };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete step' };
  }
});

ipcMain.handle('scripts:duplicateStep', async (_event, { scriptId, projectId, stepId }: { scriptId: string; projectId: string; stepId: string }) => {
  try {
    const script = db.duplicateScriptStep(scriptId, projectId, stepId);
    return { success: true, script };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to duplicate step' };
  }
});

ipcMain.handle('scripts:reorderSteps', async (_event, { scriptId, projectId, stepIds }: { scriptId: string; projectId: string; stepIds: string[] }) => {
  try {
    const script = db.reorderScriptSteps(scriptId, projectId, stepIds);
    return { success: true, script };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to reorder steps' };
  }
});

// Variables
ipcMain.handle('scripts:getVariables', async (_event, { projectId, scriptId }: { projectId: string; scriptId?: string | null }) => {
  try {
    const variables = db.getVariables(projectId, scriptId);
    return { success: true, variables };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to get variables' };
  }
});

ipcMain.handle('scripts:createVariable', async (_event, { projectId, data }: { projectId: string; data: any }) => {
  try {
    const variable = db.createVariable(projectId, data);
    return { success: true, variable };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create variable' };
  }
});

ipcMain.handle('scripts:updateVariable', async (_event, { variableId, projectId, updates }: { variableId: string; projectId: string; updates: any }) => {
  try {
    const variable = db.updateVariable(variableId, projectId, updates);
    return { success: true, variable };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update variable' };
  }
});

ipcMain.handle('scripts:deleteVariable', async (_event, { variableId, projectId }: { variableId: string; projectId: string }) => {
  try {
    db.deleteVariable(variableId, projectId);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete variable' };
  }
});

// Run Settings
ipcMain.handle('scripts:getRunSettings', async (_event, projectId: string) => {
  try {
    const settings = db.getRunSettings(projectId);
    return { success: true, settings };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to get run settings' };
  }
});

ipcMain.handle('scripts:saveRunSettings', async (_event, { projectId, settings }: { projectId: string; settings: any }) => {
  try {
    const saved = db.saveRunSettings(projectId, settings);
    return { success: true, settings: saved };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to save run settings' };
  }
});

// Execution
ipcMain.handle('execution:getExecutions', async (_event, projectId: string) => {
  try {
    const executions = db.getDetailedExecutions(projectId);
    return { success: true, executions };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to get executions' };
  }
});

ipcMain.handle('execution:getExecutionById', async (_event, { executionId, projectId }: { executionId: string; projectId: string }) => {
  try {
    const execution = db.getDetailedExecutionById(executionId, projectId);
    if (!execution) return { success: false, error: 'Execution not found' };
    return { success: true, execution };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to get execution' };
  }
});

ipcMain.handle('execution:executeScript', async (_event, { projectId, scriptId, customSettings }: { projectId: string; scriptId: string; customSettings?: any }) => {
  try {
    const execution = await db.executeScript(projectId, scriptId, customSettings);
    return { success: true, execution };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to execute script' };
  }
});

ipcMain.handle('execution:deleteExecution', async (_event, { executionId, projectId }: { executionId: string; projectId: string }) => {
  try {
    const success = db.deleteDetailedExecution(executionId, projectId);
    return { success };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete execution' };
  }
});

// Excel Utility
ipcMain.handle('excel:getData', async (_event, { projectId, fileName, sheetName, uniqueData }: { projectId: string; fileName: string; sheetName: string; uniqueData: string }) => {
  try {
    const data = db.getDataFromExcelUtility(projectId, fileName, sheetName, uniqueData);
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to get data from excel' };
  }
});

ipcMain.handle('excel:writeData', async (_event, { projectId, fileName, sheetName, uniqueData, header, writeBackData }: { projectId: string; fileName: string; sheetName: string; uniqueData: string; header: string; writeBackData: string }) => {
  try {
    db.writeDataToExcelUtility(projectId, fileName, sheetName, uniqueData, header, writeBackData);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to write data to excel' };
  }
});

// ================= AI Auto Testing IPC Handlers ================= //

// Pick document file from system dialog
ipcMain.handle('aiAutoTesting:selectFile', async () => {
  if (!mainWindow) return { canceled: true };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Application Document',
    properties: ['openFile'],
    filters: [
      { name: 'Application Documents', extensions: ['pdf', 'docx', 'xlsx', 'xls', 'csv', 'txt', 'md'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }
  return { canceled: false, filePath: result.filePaths[0] };
});

// AI Model Configuration
ipcMain.handle('aiAutoTesting:getModels', async () => {
  try {
    const models = db.getAIModelConfigurations();
    return { success: true, models };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('aiAutoTesting:saveModel', async (_event, config: any) => {
  try {
    const saved = db.saveAIModelConfiguration(config);
    return { success: true, model: saved };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('aiAutoTesting:deleteModel', async (_event, { modelId }: { modelId: string }) => {
  try {
    const success = db.deleteAIModelConfiguration(modelId);
    return { success };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('aiAutoTesting:setDefaultModel', async (_event, { modelId }: { modelId: string }) => {
  try {
    const success = db.setDefaultAIModelConfiguration(modelId);
    return { success };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('aiAutoTesting:testModelConnection', async (_event, { modelId, config }: { modelId?: string; config?: any }) => {
  try {
    const target = modelId || config;
    const result = await aiModelService.testConnection(target);
    return { success: result.status === 'Connected', ...result };
  } catch (err: any) {
    return { success: false, error: err.message, status: 'Connection Failed', latencyMs: 0, availableModels: [] };
  }
});

ipcMain.handle('aiAutoTesting:testModelPrompt', async (_event, { modelId, prompt }: { modelId: string; prompt: string }) => {
  try {
    const config = db.getRawAIModelConfigurationById(modelId);
    if (!config) throw new Error('Model configuration not found');
    const response = await aiModelService.testChatPrompt(config, prompt);
    return { success: true, testOutput: response };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Document Management
ipcMain.handle('aiAutoTesting:getDocuments', async (_event, { projectId }: { projectId: string }) => {
  try {
    const documents = db.getAIDocuments(projectId);
    return { success: true, documents };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('aiAutoTesting:uploadDocument', async (_event, { projectId, filePath }: { projectId: string; filePath: string }) => {
  try {
    const extracted = await DocumentParser.parseFile(filePath);
    const doc = db.saveAIDocument({
      projectId,
      fileName: extracted.fileName,
      fileSize: extracted.fileSize,
      fileType: extracted.fileType,
      extractedContent: extracted.extractedContent,
      detectedCategory: extracted.detectedCategory,
      status: 'Processed',
      metadata: {
        wordCount: extracted.wordCount
      }
    });
    return { success: true, document: doc };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('aiAutoTesting:updateDocumentCategory', async (_event, { documentId, projectId, userCategory }: { documentId: string; projectId: string; userCategory: any }) => {
  try {
    const doc = db.getAIDocumentById(documentId, projectId);
    if (!doc) throw new Error('Document not found');
    doc.userCategory = userCategory;
    const saved = db.saveAIDocument(doc);
    return { success: true, document: saved };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('aiAutoTesting:deleteDocument', async (_event, { documentId, projectId }: { documentId: string; projectId: string }) => {
  try {
    const success = db.deleteAIDocument(documentId, projectId);
    return { success };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Test Case Generation & Review
ipcMain.handle('aiAutoTesting:getTestCases', async (_event, { projectId }: { projectId: string }) => {
  try {
    const testCases = db.getAITestCases(projectId);
    return { success: true, testCases };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('aiAutoTesting:extractTestCasesFromDoc', async (_event, { documentId, projectId }: { documentId: string; projectId: string }) => {
  try {
    const doc = db.getAIDocumentById(documentId, projectId);
    if (!doc) throw new Error('Document not found');
    const tc = await aiAutoTestingEngine.extractManualTestCasesFromDoc(doc, projectId);
    return { success: true, testCase: tc };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('aiAutoTesting:generateTestCasesFromBRD', async (_event, { documentId, userPrompt, projectId }: { documentId: string; userPrompt: string; projectId: string }) => {
  try {
    const doc = db.getAIDocumentById(documentId, projectId);
    if (!doc) throw new Error('Document not found');
    const tc = await aiAutoTestingEngine.generateTestCasesFromBRD(doc, userPrompt, projectId);
    return { success: true, testCase: tc };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('aiAutoTesting:saveTestCase', async (_event, tcData: any) => {
  try {
    const saved = db.saveAITestCase(tcData);
    return { success: true, testCase: saved };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('aiAutoTesting:acceptTestCase', async (_event, { testCaseId, projectId }: { testCaseId: string; projectId: string }) => {
  try {
    const accepted = db.acceptAITestCase(testCaseId, projectId);
    return { success: true, testCase: accepted };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('aiAutoTesting:deleteTestCase', async (_event, { testCaseId, projectId }: { testCaseId: string; projectId: string }) => {
  try {
    const success = db.deleteAITestCase(testCaseId, projectId);
    return { success };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Automation Development & Execution
ipcMain.handle('aiAutoTesting:getSessions', async (_event, { projectId }: { projectId: string }) => {
  try {
    const sessions = db.getAIAutomationSessions(projectId);
    return { success: true, sessions };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('aiAutoTesting:startDevelopmentSession', async (_event, { testCaseId, projectId, customUrl }: { testCaseId: string; projectId: string; customUrl?: string }) => {
  try {
    const session = await aiAutoTestingEngine.startDevelopmentSession(testCaseId, projectId, customUrl);
    return { success: true, session };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('aiAutoTesting:pauseSession', async () => {
  try {
    const success = aiAutoTestingEngine.pauseSession();
    return { success };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('aiAutoTesting:resumeSession', async () => {
  try {
    const success = aiAutoTestingEngine.resumeSession();
    return { success };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('aiAutoTesting:stopSession', async () => {
  try {
    const success = await aiAutoTestingEngine.stopSession();
    return { success };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('aiAutoTesting:retryStep', async (_event, { sessionId, projectId, stepNumber }: { sessionId: string; projectId: string; stepNumber: number }) => {
  try {
    const success = await aiAutoTestingEngine.retryStep(sessionId, projectId, stepNumber);
    return { success };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Push to TestDev
ipcMain.handle('aiAutoTesting:pushToTestDev', async (_event, { sessionId, projectId, targetModuleId, scriptName, userId }: { sessionId: string; projectId: string; targetModuleId: string; scriptName: string; userId: string }) => {
  try {
    const result = await aiAutoTestingEngine.pushToTestDev(sessionId, projectId, targetModuleId, scriptName, userId);
    return result;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Save / Update AI Session (CRUD on generated script & steps)
ipcMain.handle('aiAutoTesting:saveSession', async (_event, session: any) => {
  try {
    const saved = db.saveAIAutomationSession(session);
    return { success: true, session: saved };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Delete AI Session
ipcMain.handle('aiAutoTesting:deleteSession', async (_event, { sessionId, projectId }: { sessionId: string; projectId: string }) => {
  try {
    const ok = db.deleteAIAutomationSession(sessionId, projectId);
    return { success: ok };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Model Usage Logs
ipcMain.handle('aiAutoTesting:getUsageLogs', async (_event, { modelId }: { modelId?: string }) => {
  try {
    const data = db.getAIModelUsageLogs(modelId);
    return { success: true, ...data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Section 8: Element Fingerprints IPC Handlers
ipcMain.handle('aiAutoTesting:getFingerprints', async (_event, { projectId }: { projectId?: string }) => {
  try {
    const fingerprints = db.getElementFingerprints(projectId);
    return { success: true, fingerprints };
  } catch (err: any) {
    return { success: false, error: err.message, fingerprints: [] };
  }
});

ipcMain.handle('aiAutoTesting:getFingerprint', async (_event, { elementId }: { elementId: string }) => {
  try {
    const fingerprint = db.getElementFingerprint(elementId);
    return { success: true, fingerprint };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('aiAutoTesting:deleteFingerprint', async (_event, { elementId }: { elementId: string }) => {
  try {
    const ok = db.deleteElementFingerprint(elementId);
    return { success: ok };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Email simulator handlers
ipcMain.handle('email:getSimulatedEmails', async (_event, toEmail?: string) => {
  return db.getSimulatedEmails(toEmail);
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  try {
    const primary = screen.getPrimaryDisplay();
    if (primary) {
      AutomationEngine.setMachineScreenDimensions({
        width: primary.workAreaSize.width,
        height: primary.workAreaSize.height,
        scaleFactor: primary.scaleFactor
      });
    }
  } catch (err) {
    console.warn('Could not cache machine screen dimensions:', err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', async () => {
  try {
    await finderSession.closeSession();
  } catch {}
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
