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
    deleteElement: (elementId: string, projectId: string) =>
      ipcRenderer.invoke('repository:deleteElement', { elementId, projectId }),
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
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
