import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export interface User {
  id: string;
  email: string;
  passwordHash?: string;
  isActivated: boolean;
  activationToken?: string;
  activationExpiresAt?: string;
  createdAt: string;
  activatedAt?: string;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  description?: string;
  baseUrl?: string;
  environment?: 'development' | 'staging' | 'production';
  defaultBrowser?: 'chromium' | 'firefox' | 'webkit';
  createdAt: string;
  updatedAt: string;
  testCasesCount?: number;
  lastExecutionStatus?: 'passed' | 'failed' | 'running' | 'idle';
}

export interface SimulatedEmail {
  id: string;
  to: string;
  subject: string;
  body: string;
  activationToken: string;
  activationLink: string;
  sentAt: string;
  read: boolean;
}

export interface DatabaseSchema {
  users: User[];
  projects: Project[];
  simulatedEmails: SimulatedEmail[];
}

export class JsonDatabase {
  private filePath: string;
  private data: DatabaseSchema = {
    users: [],
    projects: [],
    simulatedEmails: []
  };

  constructor(customPath?: string) {
    if (customPath) {
      this.filePath = customPath;
    } else {
      const dataDir = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Preferences' : '/var/local');
      const appDir = path.join(dataDir, 'easy-automate');
      if (!fs.existsSync(appDir)) {
        try {
          fs.mkdirSync(appDir, { recursive: true });
        } catch {
          // Fallback to current working directory
        }
      }
      this.filePath = fs.existsSync(appDir) ? path.join(appDir, 'easy_automate_db.json') : path.join(process.cwd(), 'easy_automate_db.json');
    }
    this.load();
    this.seedDefaultsIfNeeded();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.data = JSON.parse(raw);
        if (!this.data.users) this.data.users = [];
        if (!this.data.projects) this.data.projects = [];
        if (!this.data.simulatedEmails) this.data.simulatedEmails = [];
      } else {
        this.save();
      }
    } catch (err) {
      console.error('Failed to load database file, initializing fresh:', err);
      this.save();
    }
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save database file:', err);
    }
  }

  private seedDefaultsIfNeeded(): void {
    // Optionally create a demo user if database is empty so tester can test immediately
    if (this.data.users.length === 0) {
      const demoUserId = 'usr_demo_101';
      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync('P@ssword123', salt);
      const now = new Date().toISOString();

      const demoUser: User = {
        id: demoUserId,
        email: 'demo@easyautomate.dev',
        passwordHash,
        isActivated: true,
        createdAt: now,
        activatedAt: now
      };

      const demoProjects: Project[] = [
        {
          id: 'proj_ecommerce_01',
          userId: demoUserId,
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
          userId: demoUserId,
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

      this.data.users.push(demoUser);
      this.data.projects.push(...demoProjects);
      this.save();
    }
  }

  // --- User / Auth Methods ---

  public findUserByEmail(email: string): User | undefined {
    return this.data.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
  }

  public findUserById(id: string): User | undefined {
    return this.data.users.find(u => u.id === id);
  }

  public registerUser(email: string): { user: User; activationToken: string; activationLink: string } {
    const cleanEmail = email.trim().toLowerCase();
    const existing = this.findUserByEmail(cleanEmail);
    if (existing) {
      if (existing.isActivated) {
        throw new Error('This email is already registered and activated. Please log in.');
      } else {
        // Regenerate activation token for pending user
        const token = crypto.randomBytes(32).toString('hex');
        existing.activationToken = token;
        existing.activationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const activationLink = `easyautomate://activate?token=${token}&email=${encodeURIComponent(cleanEmail)}`;

        this.addSimulatedEmail(cleanEmail, token, activationLink);
        this.save();
        return { user: existing, activationToken: token, activationLink };
      }
    }

    const token = crypto.randomBytes(32).toString('hex');
    const newUser: User = {
      id: 'usr_' + crypto.randomUUID().slice(0, 8),
      email: cleanEmail,
      isActivated: false,
      activationToken: token,
      activationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString()
    };

    this.data.users.push(newUser);
    const activationLink = `easyautomate://activate?token=${token}&email=${encodeURIComponent(cleanEmail)}`;
    this.addSimulatedEmail(cleanEmail, token, activationLink);
    this.save();

    return { user: newUser, activationToken: token, activationLink };
  }

  public verifyActivationToken(token: string): { valid: boolean; email?: string; error?: string } {
    const user = this.data.users.find(u => u.activationToken === token);
    if (!user) {
      return { valid: false, error: 'Invalid or expired activation link.' };
    }
    if (user.isActivated) {
      return { valid: false, error: 'This account has already been activated. Please log in.' };
    }
    if (user.activationExpiresAt && new Date(user.activationExpiresAt) < new Date()) {
      return { valid: false, error: 'Activation link has expired. Please register again to receive a fresh link.' };
    }
    return { valid: true, email: user.email };
  }

  public activateAccount(token: string, plainPassword: string): User {
    const user = this.data.users.find(u => u.activationToken === token);
    if (!user) {
      throw new Error('Invalid or expired activation token.');
    }
    if (user.isActivated) {
      throw new Error('Account is already activated. Please log in.');
    }

    const salt = bcrypt.genSaltSync(10);
    user.passwordHash = bcrypt.hashSync(plainPassword, salt);
    user.isActivated = true;
    user.activatedAt = new Date().toISOString();
    user.activationToken = undefined;
    user.activationExpiresAt = undefined;

    this.save();
    return user;
  }

  public loginUser(email: string, plainPassword: string): User {
    const cleanEmail = email.trim().toLowerCase();
    const user = this.findUserByEmail(cleanEmail);
    if (!user) {
      throw new Error('No account found with this email address.');
    }
    if (!user.isActivated) {
      throw new Error('Account is not yet activated. Please check your activation email or link.');
    }
    if (!user.passwordHash) {
      throw new Error('Account password has not been initialized. Please complete activation.');
    }

    const isMatch = bcrypt.compareSync(plainPassword, user.passwordHash);
    if (!isMatch) {
      throw new Error('Invalid password. Please check your credentials and try again.');
    }

    return user;
  }

  // --- Simulated Emails ---

  private addSimulatedEmail(to: string, token: string, link: string): void {
    const emailItem: SimulatedEmail = {
      id: 'eml_' + crypto.randomUUID().slice(0, 8),
      to,
      subject: 'Activate Your Easy Automate Account',
      body: `Welcome to Easy Automate!\n\nPlease complete your account setup and choose your password by clicking the link below:\n\n${link}\n\nThis link is valid for 24 hours.`,
      activationToken: token,
      activationLink: link,
      sentAt: new Date().toISOString(),
      read: false
    };
    this.data.simulatedEmails.unshift(emailItem);
  }

  public getSimulatedEmails(toEmail?: string): SimulatedEmail[] {
    if (toEmail) {
      return this.data.simulatedEmails.filter(e => e.to.toLowerCase() === toEmail.trim().toLowerCase());
    }
    return this.data.simulatedEmails;
  }

  // --- Projects Methods ---

  public getProjects(userId: string): Project[] {
    return this.data.projects
      .filter(p => p.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  public getProjectById(projectId: string, userId: string): Project | undefined {
    return this.data.projects.find(p => p.id === projectId && p.userId === userId);
  }

  public createProject(userId: string, data: { name: string; description?: string; baseUrl?: string; environment?: 'development' | 'staging' | 'production'; defaultBrowser?: 'chromium' | 'firefox' | 'webkit' }): Project {
    const cleanName = data.name.trim();
    if (!cleanName || cleanName.length < 3) {
      throw new Error('Project name must be at least 3 characters long.');
    }
    if (cleanName.length > 50) {
      throw new Error('Project name cannot exceed 50 characters.');
    }

    // Check duplicate name for this user
    const existing = this.data.projects.find(p => p.userId === userId && p.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) {
      throw new Error(`A project named "${cleanName}" already exists. Please choose a different name.`);
    }

    const now = new Date().toISOString();
    const newProject: Project = {
      id: 'proj_' + crypto.randomUUID().slice(0, 8),
      userId,
      name: cleanName,
      description: data.description?.trim() || '',
      baseUrl: data.baseUrl?.trim() || 'https://demo.playwright.dev',
      environment: data.environment || 'development',
      defaultBrowser: data.defaultBrowser || 'chromium',
      createdAt: now,
      updatedAt: now,
      testCasesCount: 0,
      lastExecutionStatus: 'idle'
    };

    this.data.projects.push(newProject);
    this.save();
    return newProject;
  }

  public updateProject(projectId: string, userId: string, updates: Partial<Pick<Project, 'name' | 'description' | 'baseUrl' | 'environment' | 'defaultBrowser'>>): Project {
    const project = this.getProjectById(projectId, userId);
    if (!project) {
      throw new Error('Project not found.');
    }

    if (updates.name !== undefined) {
      const cleanName = updates.name.trim();
      if (!cleanName || cleanName.length < 3) {
        throw new Error('Project name must be at least 3 characters long.');
      }
      if (cleanName.length > 50) {
        throw new Error('Project name cannot exceed 50 characters.');
      }
      const duplicate = this.data.projects.find(p => p.userId === userId && p.id !== projectId && p.name.toLowerCase() === cleanName.toLowerCase());
      if (duplicate) {
        throw new Error(`Another project with name "${cleanName}" already exists.`);
      }
      project.name = cleanName;
    }

    if (updates.description !== undefined) project.description = updates.description.trim();
    if (updates.baseUrl !== undefined) project.baseUrl = updates.baseUrl.trim();
    if (updates.environment !== undefined) project.environment = updates.environment;
    if (updates.defaultBrowser !== undefined) project.defaultBrowser = updates.defaultBrowser;

    project.updatedAt = new Date().toISOString();
    this.save();
    return project;
  }

  public deleteProject(projectId: string, userId: string): boolean {
    const index = this.data.projects.findIndex(p => p.id === projectId && p.userId === userId);
    if (index === -1) {
      throw new Error('Project not found or you do not have permission to delete it.');
    }
    this.data.projects.splice(index, 1);
    this.save();
    return true;
  }
}

