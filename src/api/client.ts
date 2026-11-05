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
  ElementType
} from './types';

const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

// Browser LocalStorage fallback database keys
const LS_USERS = 'easy_automate_users';
const LS_PROJECTS = 'easy_automate_projects';
const LS_EMAILS = 'easy_automate_emails';
const LS_PAGES = 'easy_automate_pages';
const LS_ELEMENTS = 'easy_automate_elements';
const LS_EXECUTIONS = 'easy_automate_executions';

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
      // Seed default pages
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

export const api = {
  isElectron,

  auth: {
    async register(email: string): Promise<AuthResponse> {
      if (isElectron) {
        return (window as any).electronAPI.auth.register(email);
      }
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
      if (!user) return { valid: false, error: 'Invalid or expired activation link.' };
      if (user.isActivated) return { valid: false, error: 'This account has already been activated. Please log in.' };
      return { valid: true, email: user.email };
    },

    async activateAccount(token: string, password: string): Promise<AuthResponse> {
      if (isElectron) {
        return (window as any).electronAPI.auth.activateAccount(token, password);
      }
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
      if (isElectron) {
        return (window as any).electronAPI.auth.login(email, password);
      }
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
      if (isElectron) {
        return (window as any).electronAPI.projects.update(projectId, userId, updates);
      }
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

  // ================= Stage 2: Repository API ================= //

  repository: {
    async getPages(projectId: string): Promise<{ success: boolean; pages?: RepositoryPage[]; error?: string }> {
      if (isElectron) {
        return (window as any).electronAPI.repository.getPages(projectId);
      }
      return { success: true, pages: getLocalPages(projectId) };
    },

    async createPage(projectId: string, name: string, parentId?: string | null): Promise<{ success: boolean; page?: RepositoryPage; error?: string }> {
      if (isElectron) {
        return (window as any).electronAPI.repository.createPage(projectId, name, parentId);
      }
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
      if (isElectron) {
        return (window as any).electronAPI.repository.updatePage(pageId, projectId, name);
      }
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
      if (isElectron) {
        return (window as any).electronAPI.repository.deletePage(pageId, projectId);
      }
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
      if (isElectron) {
        return (window as any).electronAPI.repository.getElements(projectId, pageId);
      }
      let elements = getLocalElements(projectId);
      if (pageId) {
        elements = elements.filter(e => e.pageId === pageId);
      }
      return { success: true, elements };
    },

    async createElement(projectId: string, pageId: string, data: { name: string; type: ElementType; description?: string; locators: Locator[] }): Promise<{ success: boolean; element?: RepositoryElement; error?: string }> {
      if (isElectron) {
        return (window as any).electronAPI.repository.createElement(projectId, pageId, data);
      }
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
      if (isElectron) {
        return (window as any).electronAPI.repository.updateElement(elementId, projectId, data);
      }
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
      if (isElectron) {
        return (window as any).electronAPI.repository.deleteElement(elementId, projectId);
      }
      let elements = getLocalElements(projectId);
      const idx = elements.findIndex(e => e.id === elementId);
      if (idx === -1) return { success: false, error: 'Element not found.' };

      elements.splice(idx, 1);
      saveLocalElements(elements, projectId);
      return { success: true };
    }
  },

  // ================= Stage 2: Dashboard API ================= //

  dashboard: {
    async getStats(projectId: string): Promise<{ success: boolean; stats?: ProjectStats; error?: string }> {
      if (isElectron) {
        return (window as any).electronAPI.dashboard.getStats(projectId);
      }
      const elements = getLocalElements(projectId);
      const stats: ProjectStats = {
        totalScripts: 14,
        totalElements: elements.length,
        totalSuites: 4,
        suiteExecutions: 4,
        passedExecutions: 3,
        failedExecutions: 1,
        passRate: 75,
        recentExecutions: [
          {
            id: 'exec_01_' + projectId.slice(-4),
            projectId,
            suiteName: 'Regression Suite - Smoke & Checkout',
            status: 'Passed',
            startedAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
            durationSeconds: 94,
            totalTests: 18,
            passedTests: 18,
            failedTests: 0,
            environment: 'staging',
            machine: {
              name: 'WORKSTATION-QA-01',
              os: 'Windows 11 Pro 64-bit',
              browser: 'Chromium',
              version: '131.0.6778.86',
              environment: 'staging',
              status: 'Ready'
            }
          },
          {
            id: 'exec_02_' + projectId.slice(-4),
            projectId,
            suiteName: 'Authentication & Security Suite',
            status: 'Passed',
            startedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
            durationSeconds: 42,
            totalTests: 8,
            passedTests: 8,
            failedTests: 0,
            environment: 'development',
            machine: {
              name: 'WORKSTATION-QA-01',
              os: 'Windows 11 Pro 64-bit',
              browser: 'Chromium',
              version: '131.0.6778.86',
              environment: 'development',
              status: 'Ready'
            }
          },
          {
            id: 'exec_03_' + projectId.slice(-4),
            projectId,
            suiteName: 'Payment Gateway Integration Matrix',
            status: 'Failed',
            startedAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
            durationSeconds: 128,
            totalTests: 12,
            passedTests: 10,
            failedTests: 2,
            environment: 'staging',
            machine: {
              name: 'CI-RUNNER-LINUX-02',
              os: 'Ubuntu Linux 22.04 LTS',
              browser: 'Firefox',
              version: '133.0',
              environment: 'staging',
              status: 'Online'
            }
          },
          {
            id: 'exec_04_' + projectId.slice(-4),
            projectId,
            suiteName: 'Cross-Browser UI Visual Check',
            status: 'Passed',
            startedAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
            durationSeconds: 76,
            totalTests: 15,
            passedTests: 15,
            failedTests: 0,
            environment: 'staging',
            machine: {
              name: 'MAC-MINI-M2',
              os: 'macOS Sonoma 14.5',
              browser: 'WebKit',
              version: '18.2',
              environment: 'staging',
              status: 'Idle'
            }
          }
        ],
        activeMachine: {
          name: 'WORKSTATION-QA-01',
          os: 'Windows 11 Pro 64-bit',
          browser: 'Chromium',
          version: '131.0.6778.86',
          environment: 'staging',
          status: 'Ready'
        }
      };
      return { success: true, stats };
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
