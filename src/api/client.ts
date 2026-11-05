import { User, Project, SimulatedEmail, AuthResponse, TokenVerifyResponse, ProjectsResponse } from './types';

// Check if running inside Electron with contextBridge exposed API
const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

// Browser LocalStorage fallback database for development or browser preview
const LS_USERS = 'easy_automate_users';
const LS_PROJECTS = 'easy_automate_projects';
const LS_EMAILS = 'easy_automate_emails';

// Simple lightweight hashing for browser fallback (Electron uses bcryptjs in the Node main process)
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'h_' + Math.abs(hash).toString(16) + '_' + btoa(str).slice(0, 8);
}

function getLocalUsers(): any[] {
  try {
    const raw = localStorage.getItem(LS_USERS);
    if (!raw) {
      // Seed default demo user in web preview mode
      const demoUser = {
        id: 'usr_demo_101',
        email: 'demo@easyautomate.dev',
        passwordHash: simpleHash('P@ssword123'),
        isActivated: true,
        createdAt: new Date().toISOString(),
        activatedAt: new Date().toISOString(),
      };
      localStorage.setItem(LS_USERS, JSON.stringify([demoUser]));
      return [demoUser];
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalUsers(users: any[]) {
  localStorage.setItem(LS_USERS, JSON.stringify(users));
}

function getLocalProjects(): Project[] {
  try {
    const raw = localStorage.getItem(LS_PROJECTS);
    if (!raw) {
      const demoProjects: Project[] = [
        {
          id: 'proj_ecommerce_01',
          userId: 'usr_demo_101',
          name: 'E-Commerce Storefront Tests',
          description: 'End-to-end regression tests for checkout, cart, and authentication.',
          baseUrl: 'https://ecommerce-playground.demo',
          environment: 'staging',
          defaultBrowser: 'chromium',
          createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
          updatedAt: new Date(Date.now() - 86400000).toISOString(),
          testCasesCount: 14,
          lastExecutionStatus: 'passed'
        },
        {
          id: 'proj_crm_portal_02',
          userId: 'usr_demo_101',
          name: 'Customer CRM Portal',
          description: 'Playwright smoke tests for user onboarding and contact search filters.',
          baseUrl: 'https://crm-stage.internal',
          environment: 'development',
          defaultBrowser: 'chromium',
          createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
          updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          testCasesCount: 8,
          lastExecutionStatus: 'passed'
        }
      ];
      localStorage.setItem(LS_PROJECTS, JSON.stringify(demoProjects));
      return demoProjects;
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalProjects(projects: Project[]) {
  localStorage.setItem(LS_PROJECTS, JSON.stringify(projects));
}

function getLocalEmails(): SimulatedEmail[] {
  try {
    const raw = localStorage.getItem(LS_EMAILS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalEmails(emails: SimulatedEmail[]) {
  localStorage.setItem(LS_EMAILS, JSON.stringify(emails));
}

export const api = {
  isElectron,

  auth: {
    async register(email: string): Promise<AuthResponse> {
      if (isElectron) {
        return (window as any).electronAPI.auth.register(email);
      }

      // Local browser fallback
      const cleanEmail = email.trim().toLowerCase();
      const users = getLocalUsers();
      const existing = users.find(u => u.email.toLowerCase() === cleanEmail);

      const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const link = `#/activate?token=${token}&email=${encodeURIComponent(cleanEmail)}`;

      if (existing) {
        if (existing.isActivated) {
          return { success: false, error: 'This email is already registered and activated. Please log in.' };
        }
        existing.activationToken = token;
        existing.activationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        saveLocalUsers(users);

        const emailItem: SimulatedEmail = {
          id: 'eml_' + Math.random().toString(36).substring(2, 9),
          to: cleanEmail,
          subject: 'Activate Your Easy Automate Account',
          body: `Welcome to Easy Automate!\n\nPlease complete your account setup and choose your password by clicking the link below:\n\n${window.location.origin}${link}`,
          activationToken: token,
          activationLink: link,
          sentAt: new Date().toISOString(),
          read: false
        };
        const emails = getLocalEmails();
        emails.unshift(emailItem);
        saveLocalEmails(emails);

        return { success: true, user: existing, activationToken: token, activationLink: link };
      }

      const newUser = {
        id: 'usr_' + Math.random().toString(36).substring(2, 9),
        email: cleanEmail,
        isActivated: false,
        activationToken: token,
        activationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString()
      };
      users.push(newUser);
      saveLocalUsers(users);

      const emailItem: SimulatedEmail = {
        id: 'eml_' + Math.random().toString(36).substring(2, 9),
        to: cleanEmail,
        subject: 'Activate Your Easy Automate Account',
        body: `Welcome to Easy Automate!\n\nPlease complete your account setup and choose your password by clicking the link below:\n\n${window.location.origin}${link}`,
        activationToken: token,
        activationLink: link,
        sentAt: new Date().toISOString(),
        read: false
      };
      const emails = getLocalEmails();
      emails.unshift(emailItem);
      saveLocalEmails(emails);

      return { success: true, user: newUser, activationToken: token, activationLink: link };
    },

    async verifyToken(token: string): Promise<TokenVerifyResponse> {
      if (isElectron) {
        return (window as any).electronAPI.auth.verifyToken(token);
      }

      const users = getLocalUsers();
      const user = users.find(u => u.activationToken === token);
      if (!user) {
        return { valid: false, error: 'Invalid or expired activation link.' };
      }
      if (user.isActivated) {
        return { valid: false, error: 'This account has already been activated. Please log in.' };
      }
      return { valid: true, email: user.email };
    },

    async activateAccount(token: string, password: string): Promise<AuthResponse> {
      if (isElectron) {
        return (window as any).electronAPI.auth.activateAccount(token, password);
      }

      const users = getLocalUsers();
      const user = users.find(u => u.activationToken === token);
      if (!user) {
        return { success: false, error: 'Invalid or expired activation token.' };
      }

      user.passwordHash = simpleHash(password);
      user.isActivated = true;
      user.activatedAt = new Date().toISOString();
      delete user.activationToken;
      delete user.activationExpiresAt;

      saveLocalUsers(users);
      const { passwordHash, ...safeUser } = user;
      return { success: true, user: safeUser };
    },

    async login(email: string, password: string): Promise<AuthResponse> {
      if (isElectron) {
        return (window as any).electronAPI.auth.login(email, password);
      }

      const cleanEmail = email.trim().toLowerCase();
      const users = getLocalUsers();
      const user = users.find(u => u.email.toLowerCase() === cleanEmail);

      if (!user) {
        return { success: false, error: 'No account found with this email address.' };
      }
      if (!user.isActivated) {
        return { success: false, error: 'Account is not yet activated. Please complete activation via the email link.' };
      }
      if (!user.passwordHash) {
        return { success: false, error: 'Password not set. Please activate your account.' };
      }

      const expectedHash = simpleHash(password);
      if (user.passwordHash !== expectedHash) {
        return { success: false, error: 'Invalid email or password. Please try again.' };
      }

      const { passwordHash, ...safeUser } = user;
      return { success: true, user: safeUser };
    },

    async getUser(userId: string): Promise<User | null> {
      if (isElectron) {
        return (window as any).electronAPI.auth.getUser(userId);
      }

      const users = getLocalUsers();
      const user = users.find(u => u.id === userId);
      if (!user) return null;
      const { passwordHash, ...safeUser } = user;
      return safeUser;
    }
  },

  projects: {
    async getAll(userId: string): Promise<ProjectsResponse> {
      if (isElectron) {
        return (window as any).electronAPI.projects.getAll(userId);
      }

      const projects = getLocalProjects().filter(p => p.userId === userId);
      return { success: true, projects };
    },

    async getById(projectId: string, userId: string): Promise<ProjectsResponse> {
      if (isElectron) {
        return (window as any).electronAPI.projects.getById(projectId, userId);
      }

      const project = getLocalProjects().find(p => p.id === projectId && p.userId === userId);
      if (!project) return { success: false, error: 'Project not found.' };
      return { success: true, project };
    },

    async create(userId: string, data: { name: string; description?: string; baseUrl?: string; environment?: string; defaultBrowser?: string }): Promise<ProjectsResponse> {
      if (isElectron) {
        return (window as any).electronAPI.projects.create(userId, data);
      }

      const cleanName = data.name.trim();
      if (!cleanName || cleanName.length < 3) {
        return { success: false, error: 'Project name must be at least 3 characters long.' };
      }
      if (cleanName.length > 50) {
        return { success: false, error: 'Project name cannot exceed 50 characters.' };
      }

      const projects = getLocalProjects();
      const exists = projects.find(p => p.userId === userId && p.name.toLowerCase() === cleanName.toLowerCase());
      if (exists) {
        return { success: false, error: `A project named "${cleanName}" already exists.` };
      }

      const newProject: Project = {
        id: 'proj_' + Math.random().toString(36).substring(2, 9),
        userId,
        name: cleanName,
        description: data.description?.trim() || '',
        baseUrl: data.baseUrl?.trim() || 'https://demo.playwright.dev',
        environment: (data.environment as any) || 'development',
        defaultBrowser: (data.defaultBrowser as any) || 'chromium',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        testCasesCount: 0,
        lastExecutionStatus: 'idle'
      };

      projects.unshift(newProject);
      saveLocalProjects(projects);
      return { success: true, project: newProject };
    },

    async update(projectId: string, userId: string, updates: Partial<Project>): Promise<ProjectsResponse> {
      if (isElectron) {
        return (window as any).electronAPI.projects.update(projectId, userId, updates);
      }

      const projects = getLocalProjects();
      const project = projects.find(p => p.id === projectId && p.userId === userId);
      if (!project) return { success: false, error: 'Project not found.' };

      if (updates.name) {
        const cleanName = updates.name.trim();
        const exists = projects.find(p => p.userId === userId && p.id !== projectId && p.name.toLowerCase() === cleanName.toLowerCase());
        if (exists) {
          return { success: false, error: `A project named "${cleanName}" already exists.` };
        }
        project.name = cleanName;
      }
      if (updates.description !== undefined) project.description = updates.description;
      if (updates.baseUrl !== undefined) project.baseUrl = updates.baseUrl;
      if (updates.environment !== undefined) project.environment = updates.environment;
      if (updates.defaultBrowser !== undefined) project.defaultBrowser = updates.defaultBrowser;

      project.updatedAt = new Date().toISOString();
      saveLocalProjects(projects);
      return { success: true, project };
    },

    async delete(projectId: string, userId: string): Promise<{ success: boolean; error?: string }> {
      if (isElectron) {
        return (window as any).electronAPI.projects.delete(projectId, userId);
      }

      const projects = getLocalProjects();
      const index = projects.findIndex(p => p.id === projectId && p.userId === userId);
      if (index === -1) return { success: false, error: 'Project not found.' };

      projects.splice(index, 1);
      saveLocalProjects(projects);
      return { success: true };
    }
  },

  email: {
    async getSimulatedEmails(toEmail?: string): Promise<SimulatedEmail[]> {
      if (isElectron) {
        return (window as any).electronAPI.email.getSimulatedEmails(toEmail);
      }
      const emails = getLocalEmails();
      if (toEmail) {
        return emails.filter(e => e.to.toLowerCase() === toEmail.trim().toLowerCase());
      }
      return emails;
    }
  },

  window: {
    minimize: () => isElectron && (window as any).electronAPI.window.minimize(),
    maximize: () => isElectron && (window as any).electronAPI.window.maximize(),
    close: () => isElectron && (window as any).electronAPI.window.close(),
  }
};
