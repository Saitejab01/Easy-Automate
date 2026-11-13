import { contextBridge, ipcRenderer } from 'electron';

export const electronAPI = {
  auth: {
    register: (email: string) => ipcRenderer.invoke('auth:register', email),
    verifyToken: (token: string) => ipcRenderer.invoke('auth:verifyToken', token),
    activateAccount: (token: string, password: string) => ipcRenderer.invoke('auth:activateAccount', { token, password }),
    login: (email: string, password: string) => ipcRenderer.invoke('auth:login', { email, password }),
    getUser: (userId: string) => ipcRenderer.invoke('auth:getUser', userId),
  },
  projects: {
    getAll: (userId: string) => ipcRenderer.invoke('projects:getAll', userId),
    getById: (projectId: string, userId: string) => ipcRenderer.invoke('projects:getById', { projectId, userId }),
    create: (userId: string, data: { name: string; description?: string; baseUrl?: string; environment?: string; defaultBrowser?: string }) =>
      ipcRenderer.invoke('projects:create', { userId, data }),
    update: (projectId: string, userId: string, updates: any) =>
      ipcRenderer.invoke('projects:update', { projectId, userId, updates }),
    delete: (projectId: string, userId: string) =>
      ipcRenderer.invoke('projects:delete', { projectId, userId }),
  },
  repository: {
    getPages: (projectId: string) => ipcRenderer.invoke('repository:getPages', projectId),
    createPage: (projectId: string, name: string, parentId?: string | null) =>
      ipcRenderer.invoke('repository:createPage', { projectId, name, parentId }),
    updatePage: (pageId: string, projectId: string, name: string) =>
      ipcRenderer.invoke('repository:updatePage', { pageId, projectId, name }),
    deletePage: (pageId: string, projectId: string) =>
      ipcRenderer.invoke('repository:deletePage', { pageId, projectId }),

    getElements: (projectId: string, pageId?: string) =>
      ipcRenderer.invoke('repository:getElements', { projectId, pageId }),
    createElement: (projectId: string, pageId: string, data: any) =>
      ipcRenderer.invoke('repository:createElement', { projectId, pageId, data }),
    updateElement: (elementId: string, projectId: string, data: any) =>
      ipcRenderer.invoke('repository:updateElement', { elementId, projectId, data }),
    deleteElement: (elementId: string, projectId: string, force?: boolean) =>
      ipcRenderer.invoke('repository:deleteElement', { elementId, projectId, force }),
    checkDependencies: (elementId: string, projectId: string) =>
      ipcRenderer.invoke('repository:checkDependencies', { elementId, projectId }),
    testLocator: (locatorType: string, locatorValue: string) =>
      ipcRenderer.invoke('repository:testLocator', { locatorType, locatorValue }),
    inspectElement: (url: string) =>
      ipcRenderer.invoke('repository:inspectElement', { url }),
    onElementChanged: (callback: (data: any) => void) => {
      const handler = (_: any, data: any) => callback(data);
      ipcRenderer.on('repository:elementChanged', handler);
      return () => {
        ipcRenderer.removeListener('repository:elementChanged', handler);
      };
    },
  },
  finder: {
    startSession: (url: string, browserType?: 'chromium' | 'firefox' | 'webkit', captureMode?: 'normal' | 'reference') =>
      ipcRenderer.invoke('finder:startSession', { url, browserType, captureMode }),
    pauseCapture: () =>
      ipcRenderer.invoke('finder:pauseCapture'),
    resumeCapture: () =>
      ipcRenderer.invoke('finder:resumeCapture'),
    closeSession: () =>
      ipcRenderer.invoke('finder:closeSession'),
    testLocator: (locatorType: string, locatorValue: string) =>
      ipcRenderer.invoke('finder:testLocator', { locatorType, locatorValue }),
    highlightLocator: (locatorType: string, locatorValue: string) =>
      ipcRenderer.invoke('finder:highlightLocator', { locatorType, locatorValue }),
    setCaptureMode: (mode: 'normal' | 'reference') =>
      ipcRenderer.invoke('finder:setCaptureMode', mode),
    getStatus: () =>
      ipcRenderer.invoke('finder:getStatus'),
    setCapturedSequence: (count: number) =>
      ipcRenderer.invoke('finder:setCapturedSequence', count),
    syncSessionElements: (elements: any[]) =>
      ipcRenderer.invoke('finder:syncSessionElements', elements),
    onElementCaptured: (callback: (element: any) => void) => {
      const subscription = (_event: any, data: any) => callback(data);
      ipcRenderer.on('finder:elementCaptured', subscription);
      return () => ipcRenderer.removeListener('finder:elementCaptured', subscription);
    },
    onBrowserDisconnected: (callback: () => void) => {
      const subscription = () => callback();
      ipcRenderer.on('finder:browserDisconnected', subscription);
      return () => ipcRenderer.removeListener('finder:browserDisconnected', subscription);
    }
  },
  testData: {
    getFolders: (projectId: string) => ipcRenderer.invoke('testData:getFolders', projectId),
    createFolder: (projectId: string, name: string, parentId?: string | null) =>
      ipcRenderer.invoke('testData:createFolder', { projectId, name, parentId }),
    updateFolder: (folderId: string, projectId: string, name: string) =>
      ipcRenderer.invoke('testData:updateFolder', { folderId, projectId, name }),
    deleteFolder: (folderId: string, projectId: string) =>
      ipcRenderer.invoke('testData:deleteFolder', { folderId, projectId }),

    getFiles: (projectId: string, folderId?: string | null) =>
      ipcRenderer.invoke('testData:getFiles', { projectId, folderId }),
    getFileById: (fileId: string, projectId: string) =>
      ipcRenderer.invoke('testData:getFileById', { fileId, projectId }),
    uploadFile: (projectId: string, folderId: string | null, file: any) =>
      ipcRenderer.invoke('testData:uploadFile', { projectId, folderId, file }),
    updateFile: (fileId: string, projectId: string, updates: any) =>
      ipcRenderer.invoke('testData:updateFile', { fileId, projectId, updates }),
    deleteFile: (fileId: string, projectId: string) =>
      ipcRenderer.invoke('testData:deleteFile', { fileId, projectId }),
  },
  scripts: {
    getModules: (projectId: string) => ipcRenderer.invoke('scripts:getModules', projectId),
    createModule: (projectId: string, name: string, parentId?: string | null) =>
      ipcRenderer.invoke('scripts:createModule', { projectId, name, parentId }),
    updateModule: (moduleId: string, projectId: string, name: string) =>
      ipcRenderer.invoke('scripts:updateModule', { moduleId, projectId, name }),
    deleteModule: (moduleId: string, projectId: string) =>
      ipcRenderer.invoke('scripts:deleteModule', { moduleId, projectId }),

    getScripts: (projectId: string, moduleId?: string) =>
      ipcRenderer.invoke('scripts:getScripts', { projectId, moduleId }),
    getScriptById: (scriptId: string, projectId: string) =>
      ipcRenderer.invoke('scripts:getScriptById', { scriptId, projectId }),
    createScript: (projectId: string, moduleId: string, name: string, createdBy: string, description?: string) =>
      ipcRenderer.invoke('scripts:createScript', { projectId, moduleId, name, createdBy, description }),
    updateScript: (scriptId: string, projectId: string, updates: any) =>
      ipcRenderer.invoke('scripts:updateScript', { scriptId, projectId, updates }),
    deleteScript: (scriptId: string, projectId: string, force?: boolean) =>
      ipcRenderer.invoke('scripts:deleteScript', { scriptId, projectId, force }),
    checkDependencies: (scriptId: string, projectId: string) =>
      ipcRenderer.invoke('scripts:checkDependencies', { scriptId, projectId }),

    addStep: (scriptId: string, projectId: string, step: any, insertAfterStepNumber?: number) =>
      ipcRenderer.invoke('scripts:addStep', { scriptId, projectId, step, insertAfterStepNumber }),
    updateStep: (scriptId: string, projectId: string, stepId: string, updates: any) =>
      ipcRenderer.invoke('scripts:updateStep', { scriptId, projectId, stepId, updates }),
    deleteStep: (scriptId: string, projectId: string, stepId: string) =>
      ipcRenderer.invoke('scripts:deleteStep', { scriptId, projectId, stepId }),
    duplicateStep: (scriptId: string, projectId: string, stepId: string) =>
      ipcRenderer.invoke('scripts:duplicateStep', { scriptId, projectId, stepId }),
    reorderSteps: (scriptId: string, projectId: string, stepIds: string[]) =>
      ipcRenderer.invoke('scripts:reorderSteps', { scriptId, projectId, stepIds }),

    getVariables: (projectId: string, scriptId?: string | null) =>
      ipcRenderer.invoke('scripts:getVariables', { projectId, scriptId }),
    createVariable: (projectId: string, data: any) =>
      ipcRenderer.invoke('scripts:createVariable', { projectId, data }),
    updateVariable: (variableId: string, projectId: string, updates: any) =>
      ipcRenderer.invoke('scripts:updateVariable', { variableId, projectId, updates }),
    deleteVariable: (variableId: string, projectId: string) =>
      ipcRenderer.invoke('scripts:deleteVariable', { variableId, projectId }),

    getRunSettings: (projectId: string) =>
      ipcRenderer.invoke('scripts:getRunSettings', projectId),
    saveRunSettings: (projectId: string, settings: any) =>
      ipcRenderer.invoke('scripts:saveRunSettings', { projectId, settings }),
  },
  execution: {
    getExecutions: (projectId: string) => ipcRenderer.invoke('execution:getExecutions', projectId),
    getExecutionById: (executionId: string, projectId: string) =>
      ipcRenderer.invoke('execution:getExecutionById', { executionId, projectId }),
    executeScript: (projectId: string, scriptId: string, customSettings?: any) =>
      ipcRenderer.invoke('execution:executeScript', { projectId, scriptId, customSettings }),
    deleteExecution: (executionId: string, projectId: string) =>
      ipcRenderer.invoke('execution:deleteExecution', { executionId, projectId }),
  },
  excel: {
    getData: (projectId: string, fileName: string, sheetName: string, uniqueData: string) =>
      ipcRenderer.invoke('excel:getData', { projectId, fileName, sheetName, uniqueData }),
    writeData: (projectId: string, fileName: string, sheetName: string, uniqueData: string, header: string, writeBackData: string) =>
      ipcRenderer.invoke('excel:writeData', { projectId, fileName, sheetName, uniqueData, header, writeBackData }),
  },
  dashboard: {
    getStats: (projectId: string) => ipcRenderer.invoke('dashboard:getStats', projectId),
  },
  email: {
    getSimulatedEmails: (toEmail?: string) => ipcRenderer.invoke('email:getSimulatedEmails', toEmail),
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
  },
  aiAutoTesting: {
    selectFile: () => ipcRenderer.invoke('aiAutoTesting:selectFile'),
    getModels: () => ipcRenderer.invoke('aiAutoTesting:getModels'),
    saveModel: (config: any) => ipcRenderer.invoke('aiAutoTesting:saveModel', config),
    deleteModel: (modelId: string) => ipcRenderer.invoke('aiAutoTesting:deleteModel', { modelId }),
    setDefaultModel: (modelId: string) => ipcRenderer.invoke('aiAutoTesting:setDefaultModel', { modelId }),
    testModelConnection: (modelId?: string, config?: any) =>
      ipcRenderer.invoke('aiAutoTesting:testModelConnection', { modelId, config }),
    testModelPrompt: (modelId: string, prompt: string) =>
      ipcRenderer.invoke('aiAutoTesting:testModelPrompt', { modelId, prompt }),

    getDocuments: (projectId: string) =>
      ipcRenderer.invoke('aiAutoTesting:getDocuments', { projectId }),
    uploadDocument: (projectId: string, filePath: string) =>
      ipcRenderer.invoke('aiAutoTesting:uploadDocument', { projectId, filePath }),
    updateDocumentCategory: (documentId: string, projectId: string, userCategory: any) =>
      ipcRenderer.invoke('aiAutoTesting:updateDocumentCategory', { documentId, projectId, userCategory }),
    deleteDocument: (documentId: string, projectId: string) =>
      ipcRenderer.invoke('aiAutoTesting:deleteDocument', { documentId, projectId }),

    getTestCases: (projectId: string) =>
      ipcRenderer.invoke('aiAutoTesting:getTestCases', { projectId }),
    extractTestCasesFromDoc: (documentId: string, projectId: string) =>
      ipcRenderer.invoke('aiAutoTesting:extractTestCasesFromDoc', { documentId, projectId }),
    generateTestCasesFromBRD: (documentId: string, userPrompt: string, projectId: string) =>
      ipcRenderer.invoke('aiAutoTesting:generateTestCasesFromBRD', { documentId, userPrompt, projectId }),
    saveTestCase: (tcData: any) =>
      ipcRenderer.invoke('aiAutoTesting:saveTestCase', tcData),
    acceptTestCase: (testCaseId: string, projectId: string) =>
      ipcRenderer.invoke('aiAutoTesting:acceptTestCase', { testCaseId, projectId }),
    deleteTestCase: (testCaseId: string, projectId: string) =>
      ipcRenderer.invoke('aiAutoTesting:deleteTestCase', { testCaseId, projectId }),

    getSessions: (projectId: string) =>
      ipcRenderer.invoke('aiAutoTesting:getSessions', { projectId }),
    startDevelopmentSession: (testCaseId: string, projectId: string, customUrl?: string) =>
      ipcRenderer.invoke('aiAutoTesting:startDevelopmentSession', { testCaseId, projectId, customUrl }),
    pauseSession: () => ipcRenderer.invoke('aiAutoTesting:pauseSession'),
    resumeSession: () => ipcRenderer.invoke('aiAutoTesting:resumeSession'),
    stopSession: () => ipcRenderer.invoke('aiAutoTesting:stopSession'),
    retryStep: (sessionId: string, projectId: string, stepNumber: number) =>
      ipcRenderer.invoke('aiAutoTesting:retryStep', { sessionId, projectId, stepNumber }),

    pushToTestDev: (sessionId: string, projectId: string, targetModuleId: string, scriptName: string, userId: string) =>
      ipcRenderer.invoke('aiAutoTesting:pushToTestDev', { sessionId, projectId, targetModuleId, scriptName, userId }),

    saveSession: (session: any) =>
      ipcRenderer.invoke('aiAutoTesting:saveSession', session),

    deleteSession: (sessionId: string, projectId: string) =>
      ipcRenderer.invoke('aiAutoTesting:deleteSession', { sessionId, projectId }),

    getUsageLogs: (modelId?: string) =>
      ipcRenderer.invoke('aiAutoTesting:getUsageLogs', { modelId }),

    getFingerprints: (projectId?: string) =>
      ipcRenderer.invoke('aiAutoTesting:getFingerprints', { projectId }),
    getFingerprint: (elementId: string) =>
      ipcRenderer.invoke('aiAutoTesting:getFingerprint', { elementId }),
    deleteFingerprint: (elementId: string) =>
      ipcRenderer.invoke('aiAutoTesting:deleteFingerprint', { elementId }),

    onSessionUpdate: (callback: (session: any) => void) => {
      const handler = (_event: any, session: any) => callback(session);
      ipcRenderer.on('aiAutoTesting:sessionUpdate', handler);
      return () => ipcRenderer.removeListener('aiAutoTesting:sessionUpdate', handler);
    }
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
