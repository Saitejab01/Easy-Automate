import {
  User,
  Project,
  SimulatedEmail,
  AuthResponse,
  TokenVerifyResponse,
  ProjectsResponse,
  RepositoryPage,
  RepositoryElement,
  ProjectStats,
  Locator,
  ElementType,
  TestDataFolder,
  TestDataFile,
  ExcelFormat,
  TestDataFoldersResponse,
  TestDataFilesResponse
} from './types';
import { evaluateLocatorStability } from '../utils/locatorEvaluator';

const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

// Browser LocalStorage fallback database keys
const LS_USERS = 'easy_automate_users';
const LS_PROJECTS = 'easy_automate_projects';
const LS_EMAILS = 'easy_automate_emails';
const LS_PAGES = 'easy_automate_pages';
const LS_ELEMENTS = 'easy_automate_elements';
const LS_TD_FOLDERS = 'easy_automate_td_folders';
const LS_TD_FILES = 'easy_automate_td_files';
const LS_SCRIPT_MODULES = 'easy_automate_script_modules';
const LS_SCRIPTS = 'easy_automate_scripts';
const LS_VARIABLES = 'easy_automate_variables';
const LS_RUN_SETTINGS = 'easy_automate_run_settings';
const LS_EXECUTIONS = 'easy_automate_executions';
const LS_SEEDED_SCRIPTS = 'easy_automate_seeded_scripts';

function getLocalModules(projectId: string): any[] {
  try {
    const raw = localStorage.getItem(LS_SCRIPT_MODULES);
    if (!raw) {
      const isSeeded = localStorage.getItem(LS_SEEDED_SCRIPTS + '_' + projectId);
      if (!isSeeded) {
        localStorage.setItem(LS_SEEDED_SCRIPTS + '_' + projectId, 'true');
        const defaultModules = [
          {
            id: 'mod_login_' + projectId.slice(-4),
            projectId,
            name: 'Login Module',
            parentId: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 'mod_checkout_' + projectId.slice(-4),
            projectId,
            name: 'Checkout Module',
            parentId: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ];
        localStorage.setItem(LS_SCRIPT_MODULES, JSON.stringify(defaultModules));
        return defaultModules;
      }
      return [];
    }
    const all = JSON.parse(raw);
    return all.filter((m: any) => m.projectId === projectId);
  } catch {
    return [];
  }
}

function saveLocalModules(projectId: string, modules: any[]) {
  try {
    const raw = localStorage.getItem(LS_SCRIPT_MODULES);
    const all = raw ? JSON.parse(raw) : [];
    const kept = all.filter((m: any) => m.projectId !== projectId);
    localStorage.setItem(LS_SCRIPT_MODULES, JSON.stringify([...kept, ...modules]));
  } catch {}
}

function getLocalScripts(projectId: string): any[] {
  try {
    const raw = localStorage.getItem(LS_SCRIPTS);
    if (!raw) return [];
    const all = JSON.parse(raw);
    return all.filter((s: any) => s.projectId === projectId);
  } catch {
    return [];
  }
}

function saveLocalScripts(projectId: string, scripts: any[]) {
  try {
    const raw = localStorage.getItem(LS_SCRIPTS);
    const all = raw ? JSON.parse(raw) : [];
    const kept = all.filter((s: any) => s.projectId !== projectId);
    localStorage.setItem(LS_SCRIPTS, JSON.stringify([...kept, ...scripts]));
  } catch {}
}

function getLocalVariables(projectId: string): any[] {
  try {
    const raw = localStorage.getItem(LS_VARIABLES);
    if (!raw) return [];
    const all = JSON.parse(raw);
    return all.filter((v: any) => v.projectId === projectId);
  } catch {
    return [];
  }
}

function saveLocalVariables(projectId: string, vars: any[]) {
  try {
    const raw = localStorage.getItem(LS_VARIABLES);
    const all = raw ? JSON.parse(raw) : [];
    const kept = all.filter((v: any) => v.projectId !== projectId);
    localStorage.setItem(LS_VARIABLES, JSON.stringify([...kept, ...vars]));
  } catch {}
}

function getLocalRunSettings(projectId: string): any {
  try {
    const raw = localStorage.getItem(LS_RUN_SETTINGS);
    const all = raw ? JSON.parse(raw) : {};
    return all[projectId] || {
      browser: 'chromium',
      delayBetweenStepsMs: 500,
      globalWaitTimeMs: 3000,
      executionTimeoutSec: 30,
      screenshotOption: 'failed-only',
      screenRecording: false,
      isDefault: true,
      scope: 'project'
    };
  } catch {
    return {
      browser: 'chromium',
      delayBetweenStepsMs: 500,
      globalWaitTimeMs: 3000,
      executionTimeoutSec: 30,
      screenshotOption: 'failed-only',
      screenRecording: false,
      isDefault: true,
      scope: 'project'
    };
  }
}

function saveLocalRunSettings(projectId: string, settings: any) {
  try {
    const raw = localStorage.getItem(LS_RUN_SETTINGS);
    const all = raw ? JSON.parse(raw) : {};
    all[projectId] = settings;
    localStorage.setItem(LS_RUN_SETTINGS, JSON.stringify(all));
  } catch {}
}

function getLocalExecutions(projectId: string): any[] {
  try {
    const raw = localStorage.getItem(LS_EXECUTIONS);
    if (!raw) return [];
    const all = JSON.parse(raw);
    return all.filter((e: any) => e.projectId === projectId);
  } catch {
    return [];
  }
}

function saveLocalExecutions(projectId: string, execs: any[]) {
  try {
    const raw = localStorage.getItem(LS_EXECUTIONS);
    const all = raw ? JSON.parse(raw) : [];
    const kept = all.filter((e: any) => e.projectId !== projectId);
    localStorage.setItem(LS_EXECUTIONS, JSON.stringify([...kept, ...execs]));
  } catch {}
}

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

function getLocalPages(projectId: string): RepositoryPage[] {
  try {
    const raw = localStorage.getItem(LS_PAGES);
    let allPages: RepositoryPage[] = raw ? JSON.parse(raw) : [];
    let projectPages = allPages.filter(p => p.projectId === projectId);
    if (projectPages.length === 0) {
      const now = new Date().toISOString();
      const loginPageId = 'page_login_' + projectId.slice(-4);
      const homePageId = 'page_home_' + projectId.slice(-4);
      const cartPageId = 'page_cart_' + projectId.slice(-4);
      const headerSectionId = 'subpage_header_' + projectId.slice(-4);
      const productSectionId = 'subpage_product_' + projectId.slice(-4);

      projectPages = [
        { id: loginPageId, projectId, name: 'Login Page', parentId: null, createdAt: now, updatedAt: now },
        { id: homePageId, projectId, name: 'Home Page', parentId: null, createdAt: now, updatedAt: now },
        { id: headerSectionId, projectId, name: 'Header Section', parentId: homePageId, createdAt: now, updatedAt: now },
        { id: productSectionId, projectId, name: 'Product Section', parentId: homePageId, createdAt: now, updatedAt: now },
        { id: cartPageId, projectId, name: 'Cart Page', parentId: null, createdAt: now, updatedAt: now }
      ];
      allPages.push(...projectPages);
      localStorage.setItem(LS_PAGES, JSON.stringify(allPages));
    }
    return projectPages;
  } catch {
    return [];
  }
}

function saveLocalPages(pages: RepositoryPage[], projectId: string) {
  try {
    const raw = localStorage.getItem(LS_PAGES);
    let allPages: RepositoryPage[] = raw ? JSON.parse(raw) : [];
    allPages = allPages.filter(p => p.projectId !== projectId).concat(pages);
    localStorage.setItem(LS_PAGES, JSON.stringify(allPages));
  } catch {}
}

function getLocalElements(projectId: string): RepositoryElement[] {
  try {
    const raw = localStorage.getItem(LS_ELEMENTS);
    let allElements: RepositoryElement[] = raw ? JSON.parse(raw) : [];
    let projectElements = allElements.filter(e => e.projectId === projectId);
    if (projectElements.length === 0) {
      const now = new Date().toISOString();
      const loginPageId = 'page_login_' + projectId.slice(-4);
      const headerSectionId = 'subpage_header_' + projectId.slice(-4);
      const productSectionId = 'subpage_product_' + projectId.slice(-4);
      const cartPageId = 'page_cart_' + projectId.slice(-4);

      projectElements = [
        {
          id: 'el_email_' + projectId.slice(-4),
          projectId,
          pageId: loginPageId,
          name: 'Email Field',
          type: 'Input Field',
          description: 'User email or username login input',
          locators: [
            { id: 'loc_1', type: 'ID', value: 'email', valueType: 'Static', isPrimary: true },
            { id: 'loc_2', type: 'CSS Selector', value: "input[type='email']", valueType: 'Static' },
            { id: 'loc_3', type: 'XPath', value: "//input[@placeholder='{dynamic email}']", valueType: 'Dynamic' }
          ],
          createdAt: now,
          updatedAt: now
        },
        {
          id: 'el_password_' + projectId.slice(-4),
          projectId,
          pageId: loginPageId,
          name: 'Password Field',
          type: 'Input Field',
          description: 'User password input mask',
          locators: [
            { id: 'loc_4', type: 'ID', value: 'password', valueType: 'Static', isPrimary: true },
            { id: 'loc_5', type: 'CSS Selector', value: "input[type='password']", valueType: 'Static' }
          ],
          createdAt: now,
          updatedAt: now
        },
        {
          id: 'el_login_btn_' + projectId.slice(-4),
          projectId,
          pageId: loginPageId,
          name: 'Login Button',
          type: 'Button',
          description: 'Primary submission button for login form',
          locators: [
            { id: 'loc_6', type: 'XPath', value: "//button[@name='login']", valueType: 'Static', isPrimary: true },
            { id: 'loc_7', type: 'CSS Selector', value: 'button.login-btn', valueType: 'Static' },
            { id: 'loc_8', type: 'ID', value: 'loginButton', valueType: 'Static' }
          ],
          createdAt: now,
          updatedAt: now
        },
        {
          id: 'el_forgot_pwd_' + projectId.slice(-4),
          projectId,
          pageId: loginPageId,
          name: 'Forgot Password Link',
          type: 'Link',
          description: 'Password recovery trigger link',
          locators: [
            { id: 'loc_9', type: 'Link Text', value: 'Forgot your password?', valueType: 'Static', isPrimary: true },
            { id: 'loc_10', type: 'CSS Selector', value: 'a.forgot-password', valueType: 'Static' }
          ],
          createdAt: now,
          updatedAt: now
        },
        {
          id: 'el_profile_icon_' + projectId.slice(-4),
          projectId,
          pageId: headerSectionId,
          name: 'Profile Icon',
          type: 'Button',
          description: 'Avatar dropdown opener in header',
          locators: [
            { id: 'loc_11', type: 'Test ID', value: 'user-profile-avatar', valueType: 'Static', isPrimary: true },
            { id: 'loc_12', type: 'CSS Selector', value: 'header .profile-menu-trigger', valueType: 'Static' }
          ],
          createdAt: now,
          updatedAt: now
        },
        {
          id: 'el_search_field_' + projectId.slice(-4),
          projectId,
          pageId: headerSectionId,
          name: 'Search Field',
          type: 'Input Field',
          description: 'Global storefront catalog search bar',
          locators: [
            { id: 'loc_13', type: 'Placeholder', value: 'Search products...', valueType: 'Static', isPrimary: true },
            { id: 'loc_14', type: 'XPath', value: "//input[@name='q' and @placeholder='{dynamic search placeholder}']", valueType: 'Dynamic' }
          ],
          createdAt: now,
          updatedAt: now
        },
        {
          id: 'el_prod_name_' + projectId.slice(-4),
          projectId,
          pageId: productSectionId,
          name: 'Product Name',
          type: 'Text / Label',
          description: 'Dynamic product title in catalog grid',
          locators: [
            { id: 'loc_15', type: 'XPath', value: "//h3[contains(@class, 'product-title') and text()='{dynamic product name}']", valueType: 'Dynamic', isPrimary: true },
            { id: 'loc_16', type: 'CSS Selector', value: '.product-card .title', valueType: 'Static' }
          ],
          createdAt: now,
          updatedAt: now
        },
        {
          id: 'el_add_cart_' + projectId.slice(-4),
          projectId,
          pageId: productSectionId,
          name: 'Add To Cart Button',
          type: 'Button',
          description: 'Call to action button for item purchase',
          locators: [
            { id: 'loc_17', type: 'XPath', value: "//button[@data-product-id='{dynamic product id}' and contains(., 'Add to Cart')]", valueType: 'Dynamic', isPrimary: true },
            { id: 'loc_18', type: 'Role', value: 'button[name="Add to Cart"]', valueType: 'Static' }
          ],
          createdAt: now,
          updatedAt: now
        },
        {
          id: 'el_cart_items_' + projectId.slice(-4),
          projectId,
          pageId: cartPageId,
          name: 'Cart Items Table',
          type: 'Table',
          description: 'List container of items in shopping cart',
          locators: [
            { id: 'loc_19', type: 'CSS Selector', value: '.cart-table tbody tr', valueType: 'Static', isPrimary: true },
            { id: 'loc_20', type: 'Test ID', value: 'cart-items-list', valueType: 'Static' }
          ],
          createdAt: now,
          updatedAt: now
        },
        {
          id: 'el_checkout_btn_' + projectId.slice(-4),
          projectId,
          pageId: cartPageId,
          name: 'Checkout Button',
          type: 'Button',
          description: 'Initiates payment and delivery flow',
          locators: [
            { id: 'loc_21', type: 'ID', value: 'proceed-to-checkout', valueType: 'Static', isPrimary: true },
            { id: 'loc_22', type: 'XPath', value: "//button[contains(@class, 'checkout-btn')]", valueType: 'Static' }
          ],
          createdAt: now,
          updatedAt: now
        }
      ];
      allElements.push(...projectElements);
      localStorage.setItem(LS_ELEMENTS, JSON.stringify(allElements));
    }
    return projectElements;
  } catch {
    return [];
  }
}

function saveLocalElements(elements: RepositoryElement[], projectId: string) {
  try {
    const raw = localStorage.getItem(LS_ELEMENTS);
    let allElements: RepositoryElement[] = raw ? JSON.parse(raw) : [];
    allElements = allElements.filter(e => e.projectId !== projectId).concat(elements);
    localStorage.setItem(LS_ELEMENTS, JSON.stringify(allElements));
  } catch {}
}

// Stage 3 Test Data Local Storage Helpers
function getLocalTestDataFolders(projectId: string): TestDataFolder[] {
  try {
    const raw = localStorage.getItem(LS_TD_FOLDERS);
    const allFolders: TestDataFolder[] = raw ? JSON.parse(raw) : [];
    return allFolders.filter(f => f.projectId === projectId);
  } catch {
    return [];
  }
}

function saveLocalTestDataFolders(folders: TestDataFolder[], projectId: string) {
  try {
    const raw = localStorage.getItem(LS_TD_FOLDERS);
    let allFolders: TestDataFolder[] = raw ? JSON.parse(raw) : [];
    allFolders = allFolders.filter(f => f.projectId !== projectId).concat(folders);
    localStorage.setItem(LS_TD_FOLDERS, JSON.stringify(allFolders));
  } catch {}
}

function getLocalTestDataFiles(projectId: string): TestDataFile[] {
  try {
    const raw = localStorage.getItem(LS_TD_FILES);
    const allFiles: TestDataFile[] = raw ? JSON.parse(raw) : [];
    return allFiles.filter(f => f.projectId === projectId);
  } catch {
    return [];
  }
}


function saveLocalTestDataFiles(files: TestDataFile[], projectId: string) {
  try {
    const raw = localStorage.getItem(LS_TD_FILES);
    let allFiles: TestDataFile[] = raw ? JSON.parse(raw) : [];
    allFiles = allFiles.filter(f => f.projectId !== projectId).concat(files);
    localStorage.setItem(LS_TD_FILES, JSON.stringify(allFiles));
  } catch {}
}

export const api = {
  isElectron,

  auth: {
    async register(email: string): Promise<AuthResponse> {
      if (isElectron) return (window as any).electronAPI.auth.register(email);
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
        const emails = getLocalEmails();
        emails.unshift({
          id: 'eml_' + Math.random().toString(36).substring(2, 9),
          to: cleanEmail,
          subject: 'Activate Your Easy Automate Account',
          body: `Welcome to Easy Automate!\n\nPlease complete your account setup:\n\n${window.location.origin}${link}`,
          activationToken: token,
          activationLink: link,
          sentAt: new Date().toISOString(),
          read: false
        });
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
      const emails = getLocalEmails();
      emails.unshift({
        id: 'eml_' + Math.random().toString(36).substring(2, 9),
        to: cleanEmail,
        subject: 'Activate Your Easy Automate Account',
        body: `Welcome to Easy Automate!\n\nPlease complete your account setup:\n\n${window.location.origin}${link}`,
        activationToken: token,
        activationLink: link,
        sentAt: new Date().toISOString(),
        read: false
      });
      saveLocalEmails(emails);
      return { success: true, user: newUser, activationToken: token, activationLink: link };
    },

    async verifyToken(token: string): Promise<TokenVerifyResponse> {
      if (isElectron) return (window as any).electronAPI.auth.verifyToken(token);
      const users = getLocalUsers();
      const user = users.find(u => u.activationToken === token);
      if (!user) return { valid: false, error: 'Invalid or expired activation link.' };
      if (user.isActivated) return { valid: false, error: 'This account has already been activated. Please log in.' };
      return { valid: true, email: user.email };
    },

    async activateAccount(token: string, password: string): Promise<AuthResponse> {
      if (isElectron) return (window as any).electronAPI.auth.activateAccount(token, password);
      const users = getLocalUsers();
      const user = users.find(u => u.activationToken === token);
      if (!user) return { success: false, error: 'Invalid or expired activation token.' };

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
      if (isElectron) return (window as any).electronAPI.auth.login(email, password);
      const cleanEmail = email.trim().toLowerCase();
      const users = getLocalUsers();
      const user = users.find(u => u.email.toLowerCase() === cleanEmail);

      if (!user) return { success: false, error: 'No account found with this email address.' };
      if (!user.isActivated) return { success: false, error: 'Account is not yet activated. Please complete activation via the email link.' };
      if (!user.passwordHash) return { success: false, error: 'Password not set. Please activate your account.' };

      const expectedHash = simpleHash(password);
      if (user.passwordHash !== expectedHash) {
        return { success: false, error: 'Invalid email or password. Please try again.' };
      }
      const { passwordHash, ...safeUser } = user;
      return { success: true, user: safeUser };
    },

    async getUser(userId: string): Promise<User | null> {
      if (isElectron) return (window as any).electronAPI.auth.getUser(userId);
      const users = getLocalUsers();
      const user = users.find(u => u.id === userId);
      if (!user) return null;
      const { passwordHash, ...safeUser } = user;
      return safeUser;
    }
  },

  projects: {
    async getAll(userId: string): Promise<ProjectsResponse> {
      if (isElectron) return (window as any).electronAPI.projects.getAll(userId);
      const projects = getLocalProjects().filter(p => p.userId === userId);
      return { success: true, projects };
    },

    async getById(projectId: string, userId: string): Promise<ProjectsResponse> {
      if (isElectron) return (window as any).electronAPI.projects.getById(projectId, userId);
      const project = getLocalProjects().find(p => p.id === projectId && p.userId === userId);
      if (!project) return { success: false, error: 'Project not found.' };
      return { success: true, project };
    },

    async create(userId: string, data: { name: string; description?: string; baseUrl?: string; environment?: string; defaultBrowser?: string }): Promise<ProjectsResponse> {
      if (isElectron) return (window as any).electronAPI.projects.create(userId, data);
      const cleanName = data.name.trim();
      if (!cleanName || cleanName.length < 3) return { success: false, error: 'Project name must be at least 3 characters long.' };
      if (cleanName.length > 50) return { success: false, error: 'Project name cannot exceed 50 characters.' };

      const projects = getLocalProjects();
      const exists = projects.find(p => p.userId === userId && p.name.toLowerCase() === cleanName.toLowerCase());
      if (exists) return { success: false, error: `A project named "${cleanName}" already exists.` };

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
      if (isElectron) return (window as any).electronAPI.projects.update(projectId, userId, updates);
      const projects = getLocalProjects();
      const project = projects.find(p => p.id === projectId && p.userId === userId);
      if (!project) return { success: false, error: 'Project not found.' };

      if (updates.name) {
        const cleanName = updates.name.trim();
        const exists = projects.find(p => p.userId === userId && p.id !== projectId && p.name.toLowerCase() === cleanName.toLowerCase());
        if (exists) return { success: false, error: `A project named "${cleanName}" already exists.` };
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
      if (isElectron) return (window as any).electronAPI.projects.delete(projectId, userId);
      const projects = getLocalProjects();
      const index = projects.findIndex(p => p.id === projectId && p.userId === userId);
      if (index === -1) return { success: false, error: 'Project not found.' };

      projects.splice(index, 1);
      saveLocalProjects(projects);
      return { success: true };
    }
  },

  // ================= Stage 2: Repository API ================= //

  repository: {
    async getPages(projectId: string): Promise<{ success: boolean; pages?: RepositoryPage[]; error?: string }> {
      if (isElectron) return (window as any).electronAPI.repository.getPages(projectId);
      return { success: true, pages: getLocalPages(projectId) };
    },

    async createPage(projectId: string, name: string, parentId?: string | null): Promise<{ success: boolean; page?: RepositoryPage; error?: string }> {
      if (isElectron) return (window as any).electronAPI.repository.createPage(projectId, name, parentId);
      const pages = getLocalPages(projectId);
      const cleanName = name.trim();
      if (!cleanName) return { success: false, error: 'Page name is required.' };
      const exists = pages.find(p => (p.parentId || null) === (parentId || null) && p.name.toLowerCase() === cleanName.toLowerCase());
      if (exists) return { success: false, error: `A page or subpage named "${cleanName}" already exists in this section.` };

      const now = new Date().toISOString();
      const newPage: RepositoryPage = {
        id: 'page_' + Math.random().toString(36).substring(2, 9),
        projectId,
        name: cleanName,
        parentId: parentId || null,
        createdAt: now,
        updatedAt: now
      };
      pages.push(newPage);
      saveLocalPages(pages, projectId);
      return { success: true, page: newPage };
    },

    async updatePage(pageId: string, projectId: string, name: string): Promise<{ success: boolean; page?: RepositoryPage; error?: string }> {
      if (isElectron) return (window as any).electronAPI.repository.updatePage(pageId, projectId, name);
      const pages = getLocalPages(projectId);
      const page = pages.find(p => p.id === pageId);
      if (!page) return { success: false, error: 'Page not found.' };

      const cleanName = name.trim();
      if (!cleanName) return { success: false, error: 'Page name cannot be empty.' };
      const exists = pages.find(p => p.id !== pageId && (p.parentId || null) === (page.parentId || null) && p.name.toLowerCase() === cleanName.toLowerCase());
      if (exists) return { success: false, error: `Another page with name "${cleanName}" already exists.` };

      page.name = cleanName;
      page.updatedAt = new Date().toISOString();
      saveLocalPages(pages, projectId);
      return { success: true, page };
    },

    async deletePage(pageId: string, projectId: string): Promise<{ success: boolean; error?: string }> {
      if (isElectron) return (window as any).electronAPI.repository.deletePage(pageId, projectId);
      let pages = getLocalPages(projectId);
      const idsToDelete: string[] = [pageId];
      const findChildren = (parent: string) => {
        pages.filter(p => p.parentId === parent).forEach(c => {
          idsToDelete.push(c.id);
          findChildren(c.id);
        });
      };
      findChildren(pageId);

      pages = pages.filter(p => !idsToDelete.includes(p.id));
      saveLocalPages(pages, projectId);

      let elements = getLocalElements(projectId);
      elements = elements.filter(e => !idsToDelete.includes(e.pageId));
      saveLocalElements(elements, projectId);
      return { success: true };
    },

    async getElements(projectId: string, pageId?: string): Promise<{ success: boolean; elements?: RepositoryElement[]; error?: string }> {
      if (isElectron) return (window as any).electronAPI.repository.getElements(projectId, pageId);
      let elements = getLocalElements(projectId);
      if (pageId) elements = elements.filter(e => e.pageId === pageId);
      return { success: true, elements };
    },

    async createElement(projectId: string, pageId: string, data: { name: string; type: ElementType; description?: string; locators: Locator[] }): Promise<{ success: boolean; element?: RepositoryElement; error?: string }> {
      if (isElectron) return (window as any).electronAPI.repository.createElement(projectId, pageId, data);
      const cleanName = data.name.trim();
      if (!cleanName) return { success: false, error: 'Element Name is mandatory.' };
      if (!data.type) return { success: false, error: 'Element Type is mandatory.' };
      if (!data.locators || data.locators.length === 0) return { success: false, error: 'At least one locator configuration is required.' };

      for (let i = 0; i < data.locators.length; i++) {
        const l = data.locators[i];
        if (!l.type) return { success: false, error: `Locator #${i + 1}: Locator Type is mandatory.` };
        if (!l.value || !l.value.trim()) return { success: false, error: `Locator #${i + 1}: Locator Value cannot be empty.` };
        const openCount = (l.value.match(/\{/g) || []).length;
        const closeCount = (l.value.match(/\}/g) || []).length;
        if (openCount !== closeCount) return { success: false, error: `Locator #${i + 1}: Incomplete dynamic placeholder syntax. Braces '{' and '}' must match.` };
      }

      const elements = getLocalElements(projectId);
      const now = new Date().toISOString();
      const newElement: RepositoryElement = {
        id: 'el_' + Math.random().toString(36).substring(2, 9),
        projectId,
        pageId,
        name: cleanName,
        type: data.type,
        description: data.description?.trim() || '',
        locators: data.locators.map((l, i) => ({
          ...l,
          id: l.id || 'loc_' + (i + 1) + '_' + Math.random().toString(36).substring(2, 6),
          isPrimary: i === 0
        })),
        createdAt: now,
        updatedAt: now
      };

      elements.push(newElement);
      saveLocalElements(elements, projectId);
      return { success: true, element: newElement };
    },

    async updateElement(elementId: string, projectId: string, data: { name: string; type: ElementType; description?: string; pageId?: string; locators: Locator[] }): Promise<{ success: boolean; element?: RepositoryElement; error?: string }> {
      if (isElectron) return (window as any).electronAPI.repository.updateElement(elementId, projectId, data);
      const elements = getLocalElements(projectId);
      const el = elements.find(e => e.id === elementId);
      if (!el) return { success: false, error: 'Element not found.' };

      const cleanName = data.name.trim();
      if (!cleanName) return { success: false, error: 'Element Name is mandatory.' };
      if (!data.type) return { success: false, error: 'Element Type is mandatory.' };
      if (!data.locators || data.locators.length === 0) return { success: false, error: 'At least one locator configuration is required.' };

      for (let i = 0; i < data.locators.length; i++) {
        const l = data.locators[i];
        if (!l.type) return { success: false, error: `Locator #${i + 1}: Locator Type is mandatory.` };
        if (!l.value || !l.value.trim()) return { success: false, error: `Locator #${i + 1}: Locator Value cannot be empty.` };
        const openCount = (l.value.match(/\{/g) || []).length;
        const closeCount = (l.value.match(/\}/g) || []).length;
        if (openCount !== closeCount) return { success: false, error: `Locator #${i + 1}: Incomplete dynamic placeholder syntax. Braces '{' and '}' must match.` };
      }

      el.name = cleanName;
      el.type = data.type;
      if (data.description !== undefined) el.description = data.description.trim();
      if (data.pageId) el.pageId = data.pageId;
      el.locators = data.locators.map((l, i) => ({
        ...l,
        id: l.id || 'loc_' + (i + 1) + '_' + Math.random().toString(36).substring(2, 6),
        isPrimary: i === 0
      }));
      el.updatedAt = new Date().toISOString();

      saveLocalElements(elements, projectId);
      return { success: true, element: el };
    },

    async deleteElement(elementId: string, projectId: string): Promise<{ success: boolean; error?: string }> {
      if (isElectron) return (window as any).electronAPI.repository.deleteElement(elementId, projectId);
      let elements = getLocalElements(projectId);
      const idx = elements.findIndex(e => e.id === elementId);
      if (idx === -1) return { success: false, error: 'Element not found.' };

      elements.splice(idx, 1);
      saveLocalElements(elements, projectId);
      return { success: true };
    },

    async testLocator(locatorType: string, locatorValue: string): Promise<{ success: boolean; matchCount: number; stability: any; error?: string }> {
      if (isElectron && (window as any).electronAPI?.repository?.testLocator) {
        return (window as any).electronAPI.repository.testLocator(locatorType, locatorValue);
      }
      try {
        const stability = evaluateLocatorStability(locatorType, locatorValue);
        return { success: true, matchCount: -1, stability };
      } catch (err: any) {
        return { success: false, matchCount: 0, stability: null, error: err.message };
      }
    },

    async inspectElement(url: string): Promise<{ success: boolean; element?: any; error?: string }> {
      if (isElectron && (window as any).electronAPI?.repository?.inspectElement) {
        return (window as any).electronAPI.repository.inspectElement(url);
      }
      return { success: false, error: 'Live Playwright inspection requires Electron desktop runtime' };
    }
  },

  // ================= Web Element Finder API ================= //
  finder: {
    async startSession(url: string, browserType: 'chromium' | 'firefox' | 'webkit' = 'chromium', captureMode: 'normal' | 'reference' = 'normal') {
      if (isElectron && (window as any).electronAPI?.finder?.startSession) {
        return (window as any).electronAPI.finder.startSession(url, browserType, captureMode);
      }
      return { success: false, error: 'Live finder session requires Electron desktop app' };
    },
    async pauseCapture() {
      if (isElectron && (window as any).electronAPI?.finder?.pauseCapture) {
        return (window as any).electronAPI.finder.pauseCapture();
      }
      return { success: true };
    },
    async resumeCapture() {
      if (isElectron && (window as any).electronAPI?.finder?.resumeCapture) {
        return (window as any).electronAPI.finder.resumeCapture();
      }
      return { success: true };
    },
    async closeSession() {
      if (isElectron && (window as any).electronAPI?.finder?.closeSession) {
        return (window as any).electronAPI.finder.closeSession();
      }
      return { success: true };
    },
    async testLocator(type: string, value: string) {
      if (isElectron && (window as any).electronAPI?.finder?.testLocator) {
        return (window as any).electronAPI.finder.testLocator(type, value);
      }
      const stability = evaluateLocatorStability(type, value);
      return { success: true, matchCount: -1, isVisible: true, isUnique: stability.isUnique, stability };
    },
    async highlightLocator(type: string, value: string) {
      if (isElectron && (window as any).electronAPI?.finder?.highlightLocator) {
        return (window as any).electronAPI.finder.highlightLocator(type, value);
      }
      return { success: true, matchCount: 1 };
    },
    async setCaptureMode(mode: 'normal' | 'reference') {
      if (isElectron && (window as any).electronAPI?.finder?.setCaptureMode) {
        return (window as any).electronAPI.finder.setCaptureMode(mode);
      }
      return { success: true };
    },
    async getStatus() {
      if (isElectron && (window as any).electronAPI?.finder?.getStatus) {
        return (window as any).electronAPI.finder.getStatus();
      }
      return { status: 'idle', isOpen: false, capturedCount: 0 };
    },
    onElementCaptured(callback: (elem: any) => void) {
      if (isElectron && (window as any).electronAPI?.finder?.onElementCaptured) {
        return (window as any).electronAPI.finder.onElementCaptured(callback);
      }
      return () => {};
    },
    onBrowserDisconnected(callback: () => void) {
      if (isElectron && (window as any).electronAPI?.finder?.onBrowserDisconnected) {
        return (window as any).electronAPI.finder.onBrowserDisconnected(callback);
      }
      return () => {};
    }
  },

  // ================= Stage 3: Test Data Management API ================= //

  testData: {
    async getFolders(projectId: string): Promise<TestDataFoldersResponse> {
      if (isElectron) return (window as any).electronAPI.testData.getFolders(projectId);
      return { success: true, folders: getLocalTestDataFolders(projectId) };
    },

    async createFolder(projectId: string, name: string, parentId?: string | null): Promise<TestDataFoldersResponse> {
      if (isElectron) return (window as any).electronAPI.testData.createFolder(projectId, name, parentId);
      const cleanName = name.trim();
      if (!cleanName) return { success: false, error: 'Folder name is required.' };

      const folders = getLocalTestDataFolders(projectId);
      const normParentId = parentId || null;
      const duplicate = folders.find(f => f.parentId === normParentId && f.name.toLowerCase() === cleanName.toLowerCase());
      if (duplicate) return { success: false, error: `A folder named "${cleanName}" already exists in this directory.` };

      const newFolder: TestDataFolder = {
        id: 'fld_' + Math.random().toString(36).substring(2, 9),
        projectId,
        name: cleanName,
        parentId: normParentId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      folders.push(newFolder);
      saveLocalTestDataFolders(folders, projectId);
      return { success: true, folder: newFolder };
    },

    async updateFolder(folderId: string, projectId: string, name: string): Promise<TestDataFoldersResponse> {
      if (isElectron) return (window as any).electronAPI.testData.updateFolder(folderId, projectId, name);
      const cleanName = name.trim();
      if (!cleanName) return { success: false, error: 'Folder name cannot be empty.' };

      const folders = getLocalTestDataFolders(projectId);
      const folder = folders.find(f => f.id === folderId);
      if (!folder) return { success: false, error: 'Folder not found.' };

      const duplicate = folders.find(f => f.id !== folderId && f.parentId === folder.parentId && f.name.toLowerCase() === cleanName.toLowerCase());
      if (duplicate) return { success: false, error: `Another folder named "${cleanName}" already exists in this directory.` };

      folder.name = cleanName;
      folder.updatedAt = new Date().toISOString();
      saveLocalTestDataFolders(folders, projectId);
      return { success: true, folder };
    },

    async deleteFolder(folderId: string, projectId: string): Promise<{ success: boolean; error?: string }> {
      if (isElectron) return (window as any).electronAPI.testData.deleteFolder(folderId, projectId);
      let folders = getLocalTestDataFolders(projectId);
      const idsToDelete: string[] = [folderId];
      const findChildren = (parent: string) => {
        folders.filter(f => f.parentId === parent).forEach(c => {
          idsToDelete.push(c.id);
          findChildren(c.id);
        });
      };
      findChildren(folderId);

      folders = folders.filter(f => !idsToDelete.includes(f.id));
      saveLocalTestDataFolders(folders, projectId);

      let files = getLocalTestDataFiles(projectId);
      files = files.filter(f => !f.folderId || !idsToDelete.includes(f.folderId));
      saveLocalTestDataFiles(files, projectId);

      return { success: true };
    },

    async getFiles(projectId: string, folderId?: string | null): Promise<TestDataFilesResponse> {
      if (isElectron) return (window as any).electronAPI.testData.getFiles(projectId, folderId);
      const files = getLocalTestDataFiles(projectId);
      if (folderId !== undefined) {
        const norm = folderId || null;
        return { success: true, files: files.filter(f => f.folderId === norm) };
      }
      return { success: true, files };
    },

    async getFileById(fileId: string, projectId: string): Promise<TestDataFilesResponse> {
      if (isElectron) return (window as any).electronAPI.testData.getFileById(fileId, projectId);
      const files = getLocalTestDataFiles(projectId);
      const file = files.find(f => f.id === fileId);
      if (!file) return { success: false, error: 'File not found.' };
      return { success: true, file };
    },

    async uploadFile(
      projectId: string,
      folderId: string | null,
      file: {
        fileName: string;
        fileSizeBytes: number;
        uploadedBy: string;
        fileData?: string;
        sheetNames?: string[];
        rowCount?: number;
        description?: string;
      }
    ): Promise<TestDataFilesResponse> {
      if (isElectron) return (window as any).electronAPI.testData.uploadFile(projectId, folderId, file);
      const cleanFileName = file.fileName.trim();
      const ext = cleanFileName.slice(cleanFileName.lastIndexOf('.')).toLowerCase();
      if (ext !== '.xlsx' && ext !== '.xls') {
        return { success: false, error: `Unsupported file format "${ext}". Only Excel files (.xlsx and .xls) are supported.` };
      }

      const files = getLocalTestDataFiles(projectId);
      const normFolderId = folderId || null;
      const formatSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      };

      const existingIndex = files.findIndex(f => f.folderId === normFolderId && f.fileName.toLowerCase() === cleanFileName.toLowerCase());
      const now = new Date().toISOString();

      if (existingIndex !== -1) {
        files[existingIndex] = {
          ...files[existingIndex],
          fileSizeBytes: file.fileSizeBytes,
          fileSizeFormatted: formatSize(file.fileSizeBytes),
          uploadedBy: file.uploadedBy,
          uploadedAt: now,
          fileData: file.fileData,
          sheetNames: file.sheetNames || ['Sheet1'],
          rowCount: file.rowCount || 12,
          description: file.description || files[existingIndex].description
        };
        saveLocalTestDataFiles(files, projectId);
        return { success: true, file: files[existingIndex] };
      }

      const newFile: TestDataFile = {
        id: 'file_' + Math.random().toString(36).substring(2, 9),
        projectId,
        folderId: normFolderId,
        fileName: cleanFileName,
        fileFormat: ext as ExcelFormat,
        fileSizeBytes: file.fileSizeBytes,
        fileSizeFormatted: formatSize(file.fileSizeBytes),
        uploadedBy: file.uploadedBy || 'User',
        uploadedAt: now,
        fileData: file.fileData || '',
        sheetNames: file.sheetNames || ['Sheet1'],
        rowCount: file.rowCount || 12,
        description: file.description || ''
      };

      files.push(newFile);
      saveLocalTestDataFiles(files, projectId);
      return { success: true, file: newFile };
    },

    async updateFile(
      fileId: string,
      projectId: string,
      updates: { fileName?: string; description?: string; folderId?: string | null }
    ): Promise<TestDataFilesResponse> {
      if (isElectron) return (window as any).electronAPI.testData.updateFile(fileId, projectId, updates);
      const files = getLocalTestDataFiles(projectId);
      const file = files.find(f => f.id === fileId);
      if (!file) return { success: false, error: 'File not found.' };

      if (updates.fileName !== undefined) {
        const cleanName = updates.fileName.trim();
        const ext = cleanName.slice(cleanName.lastIndexOf('.')).toLowerCase();
        if (ext !== '.xlsx' && ext !== '.xls') {
          return { success: false, error: 'File extension must remain .xlsx or .xls' };
        }
        const targetFolder = updates.folderId !== undefined ? updates.folderId : file.folderId;
        const duplicate = files.find(f => f.id !== fileId && f.folderId === targetFolder && f.fileName.toLowerCase() === cleanName.toLowerCase());
        if (duplicate) return { success: false, error: `Another file named "${cleanName}" already exists in this folder.` };
        file.fileName = cleanName;
        file.fileFormat = ext as ExcelFormat;
      }
      if (updates.description !== undefined) file.description = updates.description;
      if (updates.folderId !== undefined) file.folderId = updates.folderId;

      saveLocalTestDataFiles(files, projectId);
      return { success: true, file };
    },

    async deleteFile(fileId: string, projectId: string): Promise<{ success: boolean; error?: string }> {
      if (isElectron) return (window as any).electronAPI.testData.deleteFile(fileId, projectId);
      let files = getLocalTestDataFiles(projectId);
      const idx = files.findIndex(f => f.id === fileId);
      if (idx === -1) return { success: false, error: 'File not found.' };
      files.splice(idx, 1);
      saveLocalTestDataFiles(files, projectId);
      return { success: true };
    }
  },

  // ================= Stage 2: Dashboard API ================= //

  dashboard: {
    async getStats(projectId: string): Promise<{ success: boolean; stats?: ProjectStats; error?: string }> {
      if (isElectron) return (window as any).electronAPI.dashboard.getStats(projectId);
      const elements = getLocalElements(projectId);
      const scripts = getLocalScripts(projectId);
      const executions = getLocalExecutions(projectId);
      const suiteExecutions = executions.length;
      const passedExecutions = executions.filter((e: any) => e.status === 'Passed').length;
      const failedExecutions = executions.filter((e: any) => e.status === 'Failed').length;
      const passRate = suiteExecutions > 0 ? Math.round((passedExecutions / suiteExecutions) * 100) : 0;
      const stats: ProjectStats = {
        totalScripts: scripts.length,
        totalElements: elements.length,
        totalSuites: 0,
        suiteExecutions,
        passedExecutions,
        failedExecutions,
        passRate,
        recentExecutions: executions,
        activeMachine: {
          name: 'LOCAL-WORKSTATION',
          os: typeof navigator !== 'undefined' && navigator.userAgent.includes('Windows') ? 'Windows 11 Pro 64-bit' : 'Desktop OS',
          browser: 'Chromium',
          version: 'Playwright Ready',
          environment: 'development',
          status: 'Ready'
        }
      };
      return { success: true, stats };
    }
  },

  email: {
    async getSimulatedEmails(toEmail?: string): Promise<SimulatedEmail[]> {
      if (isElectron) return (window as any).electronAPI.email.getSimulatedEmails(toEmail);
      const emails = getLocalEmails();
      if (toEmail) return emails.filter(e => e.to.toLowerCase() === toEmail.trim().toLowerCase());
      return emails;
    }
  },

  // ================= Stage 4: TestDev Scripts ================= //
  scripts: {
    async getModules(projectId: string) {
      if (isElectron) return (window as any).electronAPI.scripts.getModules(projectId);
      const modules = getLocalModules(projectId);
      return { success: true, modules };
    },
    async createModule(projectId: string, name: string, parentId?: string | null) {
      if (isElectron) return (window as any).electronAPI.scripts.createModule(projectId, name, parentId);
      const cleanName = (name || '').trim();
      if (!cleanName || cleanName.length < 2) {
        return { success: false, error: 'Module name must be at least 2 characters long.' };
      }
      const modules = getLocalModules(projectId);
      const normParentId = parentId && modules.some((m: any) => m.id === parentId) ? parentId : null;
      const dup = modules.find((m: any) => m.parentId === normParentId && m.name.toLowerCase() === cleanName.toLowerCase());
      if (dup) {
        return { success: false, error: `A module named "${cleanName}" already exists at this level.` };
      }
      const newModule = {
        id: 'mod_' + Math.random().toString(36).substring(2, 10),
        projectId,
        name: cleanName,
        parentId: normParentId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      modules.push(newModule);
      saveLocalModules(projectId, modules);
      return { success: true, module: newModule };
    },
    async updateModule(moduleId: string, projectId: string, name: string) {
      if (isElectron) return (window as any).electronAPI.scripts.updateModule(moduleId, projectId, name);
      const cleanName = (name || '').trim();
      if (!cleanName || cleanName.length < 2) {
        return { success: false, error: 'Module name must be at least 2 characters long.' };
      }
      const modules = getLocalModules(projectId);
      const mod = modules.find((m: any) => m.id === moduleId);
      if (!mod) return { success: false, error: 'Module not found.' };
      const dup = modules.find((m: any) => m.id !== moduleId && m.parentId === mod.parentId && m.name.toLowerCase() === cleanName.toLowerCase());
      if (dup) {
        return { success: false, error: `A module named "${cleanName}" already exists at this level.` };
      }
      mod.name = cleanName;
      mod.updatedAt = new Date().toISOString();
      saveLocalModules(projectId, modules);
      return { success: true, module: mod };
    },
    async deleteModule(moduleId: string, projectId: string) {
      if (isElectron) return (window as any).electronAPI.scripts.deleteModule(moduleId, projectId);
      const modules = getLocalModules(projectId);
      const toDelete = [moduleId];
      const findDescendants = (pid: string) => {
        const children = modules.filter((m: any) => m.parentId === pid);
        for (const c of children) {
          toDelete.push(c.id);
          findDescendants(c.id);
        }
      };
      findDescendants(moduleId);
      const remainingModules = modules.filter((m: any) => !toDelete.includes(m.id));
      saveLocalModules(projectId, remainingModules);

      // Delete child scripts
      const scripts = getLocalScripts(projectId);
      const remainingScripts = scripts.filter((s: any) => !toDelete.includes(s.moduleId));
      saveLocalScripts(projectId, remainingScripts);
      return { success: true };
    },

    async getScripts(projectId: string, moduleId?: string) {
      if (isElectron) return (window as any).electronAPI.scripts.getScripts(projectId, moduleId);
      const scripts = getLocalScripts(projectId);
      if (moduleId) return { success: true, scripts: scripts.filter((s: any) => s.moduleId === moduleId) };
      return { success: true, scripts };
    },
    async getScriptById(scriptId: string, projectId: string) {
      if (isElectron) return (window as any).electronAPI.scripts.getScriptById(scriptId, projectId);
      const scripts = getLocalScripts(projectId);
      const script = scripts.find((s: any) => s.id === scriptId);
      if (!script) return { success: false, error: 'Script not found' };
      return { success: true, script };
    },
    async createScript(projectId: string, moduleId: string, name: string, createdBy: string, description?: string) {
      if (isElectron) return (window as any).electronAPI.scripts.createScript(projectId, moduleId, name, createdBy, description);
      const cleanName = (name || '').trim();
      if (!cleanName) return { success: false, error: 'Script name cannot be empty.' };
      const scripts = getLocalScripts(projectId);
      const newScript = {
        id: 'scr_' + Math.random().toString(36).substring(2, 10),
        projectId,
        moduleId,
        name: cleanName,
        description: description || '',
        createdBy: createdBy || 'User',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stepCount: 0,
        lastExecutionStatus: null,
        lastExecutionDate: null,
        steps: []
      };
      scripts.push(newScript);
      saveLocalScripts(projectId, scripts);
      return { success: true, script: newScript };
    },
    async updateScript(scriptId: string, projectId: string, updates: any) {
      if (isElectron) return (window as any).electronAPI.scripts.updateScript(scriptId, projectId, updates);
      const scripts = getLocalScripts(projectId);
      const script = scripts.find((s: any) => s.id === scriptId);
      if (!script) return { success: false, error: 'Script not found' };
      Object.assign(script, updates, { updatedAt: new Date().toISOString() });
      saveLocalScripts(projectId, scripts);
      return { success: true, script };
    },
    async deleteScript(scriptId: string, projectId: string) {
      if (isElectron) return (window as any).electronAPI.scripts.deleteScript(scriptId, projectId);
      const scripts = getLocalScripts(projectId);
      const remaining = scripts.filter((s: any) => s.id !== scriptId);
      saveLocalScripts(projectId, remaining);
      return { success: true };
    },

    async addStep(scriptId: string, projectId: string, step: any, insertAfterStepNumber?: number) {
      if (isElectron) return (window as any).electronAPI.scripts.addStep(scriptId, projectId, step, insertAfterStepNumber);
      const scripts = getLocalScripts(projectId);
      const script = scripts.find((s: any) => s.id === scriptId);
      if (!script) return { success: false, error: 'Script not found' };
      const steps = script.steps || [];
      const newStep = {
        id: 'step_' + Math.random().toString(36).substring(2, 10),
        ...step,
        isEnabled: step.isEnabled !== false
      };
      if (typeof insertAfterStepNumber === 'number' && insertAfterStepNumber >= 1 && insertAfterStepNumber <= steps.length) {
        steps.splice(insertAfterStepNumber, 0, newStep);
      } else {
        steps.push(newStep);
      }
      steps.forEach((s: any, idx: number) => { s.stepNumber = idx + 1; });
      script.steps = steps;
      script.stepCount = steps.length;
      script.updatedAt = new Date().toISOString();
      saveLocalScripts(projectId, scripts);
      return { success: true, script, step: newStep };
    },
    async updateStep(scriptId: string, projectId: string, stepId: string, updates: any) {
      if (isElectron) return (window as any).electronAPI.scripts.updateStep(scriptId, projectId, stepId, updates);
      const scripts = getLocalScripts(projectId);
      const script = scripts.find((s: any) => s.id === scriptId);
      if (!script) return { success: false, error: 'Script not found' };
      const step = (script.steps || []).find((s: any) => s.id === stepId);
      if (!step) return { success: false, error: 'Step not found' };
      Object.assign(step, updates);
      script.updatedAt = new Date().toISOString();
      saveLocalScripts(projectId, scripts);
      return { success: true, script };
    },
    async deleteStep(scriptId: string, projectId: string, stepId: string) {
      if (isElectron) return (window as any).electronAPI.scripts.deleteStep(scriptId, projectId, stepId);
      const scripts = getLocalScripts(projectId);
      const script = scripts.find((s: any) => s.id === scriptId);
      if (!script) return { success: false, error: 'Script not found' };
      script.steps = (script.steps || []).filter((s: any) => s.id !== stepId);
      script.steps.forEach((s: any, idx: number) => { s.stepNumber = idx + 1; });
      script.stepCount = script.steps.length;
      script.updatedAt = new Date().toISOString();
      saveLocalScripts(projectId, scripts);
      return { success: true, script };
    },
    async duplicateStep(scriptId: string, projectId: string, stepId: string) {
      if (isElectron) return (window as any).electronAPI.scripts.duplicateStep(scriptId, projectId, stepId);
      const scripts = getLocalScripts(projectId);
      const script = scripts.find((s: any) => s.id === scriptId);
      if (!script) return { success: false, error: 'Script not found' };
      const stepIndex = (script.steps || []).findIndex((s: any) => s.id === stepId);
      if (stepIndex === -1) return { success: false, error: 'Step not found' };
      const original = script.steps[stepIndex];
      const copy = { ...JSON.parse(JSON.stringify(original)), id: 'step_' + Math.random().toString(36).substring(2, 10) };
      script.steps.splice(stepIndex + 1, 0, copy);
      script.steps.forEach((s: any, idx: number) => { s.stepNumber = idx + 1; });
      script.stepCount = script.steps.length;
      script.updatedAt = new Date().toISOString();
      saveLocalScripts(projectId, scripts);
      return { success: true, script };
    },
    async reorderSteps(scriptId: string, projectId: string, stepIds: string[]) {
      if (isElectron) return (window as any).electronAPI.scripts.reorderSteps(scriptId, projectId, stepIds);
      const scripts = getLocalScripts(projectId);
      const script = scripts.find((s: any) => s.id === scriptId);
      if (!script) return { success: false, error: 'Script not found' };
      const map = new Map((script.steps || []).map((s: any) => [s.id, s]));
      const reordered: any[] = [];
      for (const id of stepIds) {
        const item = map.get(id);
        if (item) reordered.push(item);
      }
      reordered.forEach((s: any, idx: number) => { s.stepNumber = idx + 1; });
      script.steps = reordered;
      script.updatedAt = new Date().toISOString();
      saveLocalScripts(projectId, scripts);
      return { success: true, script };
    },

    async getVariables(projectId: string, scriptId?: string | null) {
      if (isElectron) return (window as any).electronAPI.scripts.getVariables(projectId, scriptId);
      const vars = getLocalVariables(projectId);
      if (scriptId) return { success: true, variables: vars.filter((v: any) => v.scriptId === scriptId || v.type === 'Global') };
      return { success: true, variables: vars };
    },
    async createVariable(projectId: string, data: any) {
      if (isElectron) return (window as any).electronAPI.scripts.createVariable(projectId, data);
      const vars = getLocalVariables(projectId);
      const newVar = {
        id: 'var_' + Math.random().toString(36).substring(2, 10),
        projectId,
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      vars.push(newVar);
      saveLocalVariables(projectId, vars);
      return { success: true, variable: newVar };
    },
    async updateVariable(variableId: string, projectId: string, updates: any) {
      if (isElectron) return (window as any).electronAPI.scripts.updateVariable(variableId, projectId, updates);
      const vars = getLocalVariables(projectId);
      const item = vars.find((v: any) => v.id === variableId);
      if (!item) return { success: false, error: 'Variable not found' };
      Object.assign(item, updates, { updatedAt: new Date().toISOString() });
      saveLocalVariables(projectId, vars);
      return { success: true, variable: item };
    },
    async deleteVariable(variableId: string, projectId: string) {
      if (isElectron) return (window as any).electronAPI.scripts.deleteVariable(variableId, projectId);
      const vars = getLocalVariables(projectId);
      const remaining = vars.filter((v: any) => v.id !== variableId);
      saveLocalVariables(projectId, remaining);
      return { success: true };
    },

    async getRunSettings(projectId: string) {
      if (isElectron) return (window as any).electronAPI.scripts.getRunSettings(projectId);
      const settings = getLocalRunSettings(projectId);
      return { success: true, settings };
    },
    async saveRunSettings(projectId: string, settings: any) {
      if (isElectron) return (window as any).electronAPI.scripts.saveRunSettings(projectId, settings);
      saveLocalRunSettings(projectId, settings);
      return { success: true, settings };
    }
  },

  // ================= Stage 5: Execution ================= //
  execution: {
    async getExecutions(projectId: string) {
      if (isElectron) return (window as any).electronAPI.execution.getExecutions(projectId);
      const execs = getLocalExecutions(projectId);
      return { success: true, executions: execs };
    },
    async getExecutionById(executionId: string, projectId: string) {
      if (isElectron) return (window as any).electronAPI.execution.getExecutionById(executionId, projectId);
      const execs = getLocalExecutions(projectId);
      const found = execs.find((e: any) => e.id === executionId);
      if (!found) return { success: false, error: 'Execution not found' };
      return { success: true, execution: found };
    },
    async executeScript(projectId: string, scriptId: string, customSettings?: any) {
      if (isElectron) return (window as any).electronAPI.execution.executeScript(projectId, scriptId, customSettings);
      const scripts = getLocalScripts(projectId);
      const script = scripts.find((s: any) => s.id === scriptId);
      if (!script) return { success: false, error: 'Script not found for execution.' };

      const settings = customSettings || getLocalRunSettings(projectId);
      const execs = getLocalExecutions(projectId);
      const execId = `EXEC${String(execs.length + 1).padStart(4, '0')}`;
      const now = new Date().toISOString();

      const executedSteps = (script.steps || []).map((st: any) => ({
        stepNumber: st.stepNumber,
        nlpName: st.nlpName,
        nlpCategory: st.nlpCategory,
        description: st.description,
        status: 'Passed',
        startedAt: now,
        completedAt: now,
        durationSeconds: 0.3,
        element: st.elementId ? {
          id: st.elementId,
          name: st.elementName || 'UI Element',
          page: st.pageName || 'Repository Page',
          locatorType: st.locator?.type || 'ID',
          locatorValue: st.locator?.value || ''
        } : undefined,
        inputParameters: st.parameters || {},
        logs: [`[${new Date().toLocaleTimeString()}] Executed Playwright action: "${st.nlpName}" successfully`]
      }));

      const executionRecord = {
        id: execId,
        projectId,
        suiteName: `Single Script: ${script.name}`,
        status: 'Passed',
        startedAt: now,
        completedAt: now,
        durationSeconds: Number((executedSteps.length * 0.3 + 0.2).toFixed(1)),
        totalScripts: 1,
        passedScripts: 1,
        failedScripts: 0,
        runSettings: settings,
        machine: {
          name: 'WORKSTATION-QA-01',
          os: 'Windows 11 Pro 64-bit',
          browser: settings.browser === 'firefox' ? 'Firefox' : 'Chromium',
          version: '131.0.6778.86',
          environment: 'staging',
          status: 'Ready'
        },
        nodeVersion: 'v20.18.0',
        playwrightVersion: '1.58.0',
        scripts: [
          {
            scriptId: script.id,
            scriptName: script.name,
            moduleName: 'General Module',
            status: 'Passed',
            startedAt: now,
            completedAt: now,
            durationSeconds: Number((executedSteps.length * 0.3 + 0.2).toFixed(1)),
            steps: executedSteps
          }
        ]
      };

      execs.unshift(executionRecord);
      saveLocalExecutions(projectId, execs);

      script.lastExecutionStatus = 'Passed';
      script.lastExecutionDate = now;
      saveLocalScripts(projectId, scripts);

      return { success: true, execution: executionRecord };
    }
  },

  // ================= Excel Utilities ================= //
  excel: {
    async getData(projectId: string, fileName: string, sheetName: string, uniqueData: string) {
      if (isElectron) return (window as any).electronAPI.excel.getData(projectId, fileName, sheetName, uniqueData);
      return { success: true, data: { TC_ID: uniqueData, ProductName: 'Watch', VerificationText: 'Watches Few' } };
    },
    async writeData(projectId: string, fileName: string, sheetName: string, uniqueData: string, header: string, writeBackData: string) {
      if (isElectron) return (window as any).electronAPI.excel.writeData(projectId, fileName, sheetName, uniqueData, header, writeBackData);
      return { success: true, result: { fileName, sheetName, uniqueData, header, writeBackValue: writeBackData } };
    }
  },

  window: {
    minimize: () => isElectron && (window as any).electronAPI.window.minimize(),
    maximize: () => isElectron && (window as any).electronAPI.window.maximize(),
    close: () => isElectron && (window as any).electronAPI.window.close(),
  }
};
