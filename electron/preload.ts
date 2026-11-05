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
