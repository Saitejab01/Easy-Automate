import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import os from 'os';
import * as XLSX from 'xlsx';
import { AutomationEngine } from './engine/automationEngine';

export interface DbUser {
  id: string;
  email: string;
  passwordHash?: string;
  isActivated: boolean;
  activationToken?: string;
  activationExpiresAt?: string;
  createdAt: string;
  activatedAt?: string;
}

export type ElementType =
  | 'Button'
  | 'Input Field'
  | 'Link'
  | 'Dropdown / Select'
  | 'Checkbox'
  | 'Radio Button'
  | 'Text / Label'
  | 'Image'
  | 'Table'
  | 'Modal'
  | 'Card'
  | 'Container'
  | 'Custom';

export type LocatorType =
  | 'ID'
  | 'Name'
  | 'XPath'
  | 'CSS Selector'
  | 'Class Name'
  | 'Link Text'
  | 'Partial Link Text'
  | 'Tag Name'
  | 'Text'
  | 'Role'
  | 'Placeholder'
  | 'Label'
  | 'Test ID';

export type ValueType = 'Static' | 'Dynamic';

export interface Locator {
  id: string;
  type: LocatorType;
  value: string;
  valueType: ValueType;
  isPrimary?: boolean;
  priority?: number;
}

export interface RepositoryElement {
  id: string;
  projectId: string;
  pageId: string;
  name: string;
  type: ElementType;
  description?: string;
  locators: Locator[];
  createdAt: string;
  updatedAt: string;
}

export interface RepositoryPage {
  id: string;
  projectId: string;
  name: string;
  parentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MachineDetails {
  name: string;
  os: string;
  browser: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  status: 'Online' | 'Ready' | 'Idle' | 'Busy';
}

export interface ExecutionRecord {
  id: string;
  projectId: string;
  suiteName: string;
  status: 'Passed' | 'Failed' | 'Running' | 'Aborted';
  startedAt: string;
  durationSeconds: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  environment: 'development' | 'staging' | 'production';
  machine: MachineDetails;
}

export interface ProjectStats {
  totalScripts: number;
  totalElements: number;
  totalSuites: number;
  suiteExecutions: number;
  passedExecutions: number;
  failedExecutions: number;
  passRate: number;
  recentExecutions: ExecutionRecord[];
  activeMachine: MachineDetails;
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

// Stage 3: Test Data Management Types
export type ExcelFormat = '.xlsx' | '.xls';

export interface TestDataFolder {
  id: string;
  projectId: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TestDataFile {
  id: string;
  projectId: string;
  folderId: string | null;
  fileName: string;
  fileFormat: ExcelFormat;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  uploadedBy: string;
  uploadedAt: string;
  fileData?: string; // Base64 content or simulation payload
  sheetNames?: string[];
  rowCount?: number;
  description?: string;
}

// Stage 4 & 5: TestDev (Scripts & Execution) Types
export type NlpCategory =
  | 'Browser'
  | 'Browser Action'
  | 'Switching'
  | 'Verification'
  | 'Wait'
  | 'Scroll'
  | 'Excel';

export interface ScriptModule {
  id: string;
  projectId: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type VariableType = 'Local' | 'Global';
export type VariableDataType = 'String' | 'Number' | 'Boolean' | 'Encrypted';

export interface ScriptVariable {
  id: string;
  projectId: string;
  scriptId?: string | null;
  name: string;
  type: VariableType;
  dataType: VariableDataType;
  value: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScriptStep {
  id: string;
  stepNumber: number;
  nlpId: string;
  nlpName: string;
  nlpCategory: NlpCategory;
  description: string;
  elementId?: string | null;
  elementName?: string;
  pageName?: string;
  locator?: {
    type: string;
    value: string;
    dynamicValues?: Record<string, string>;
  };
  parameters: Record<string, any>;
  variableMappings?: Record<string, string>;
  isEnabled: boolean;
}

export interface AutomationScript {
  id: string;
  projectId: string;
  moduleId: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  stepCount: number;
  lastExecutionStatus: 'Passed' | 'Failed' | 'Running' | 'Pending' | 'Aborted' | 'Skipped' | null;
  lastExecutionDate: string | null;
  steps: ScriptStep[];
}

export interface RunSettings {
  browser: 'chromium' | 'firefox' | 'webkit';
  delayBetweenStepsMs: number;
  globalWaitTimeMs: number;
  executionTimeoutSec: number;
  screenshotOption: 'every-step' | 'failed-only';
  screenRecording: boolean;
  isDefault?: boolean;
  scope?: 'project' | 'user';
}

export interface StepExecutionDetail {
  stepNumber: number;
  nlpName: string;
  nlpCategory: NlpCategory;
  description: string;
  status: 'Passed' | 'Failed' | 'Running' | 'Skipped';
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  element?: {
    id: string;
    name: string;
    page: string;
    locatorType: string;
    locatorValue: string;
    dynamicValues?: Record<string, string>;
  };
  variablesUsed?: Array<{
    name: string;
    type: VariableType;
    resolvedValue: string;
    isMasked?: boolean;
  }>;
  inputParameters: Record<string, any>;
  excelReference?: {
    fileName: string;
    sheetName: string;
    uniqueData: string;
    header?: string;
    extractedData?: Record<string, any>;
    writeBackValue?: string;
  };
  logs: string[];
  screenshot?: string;
  error?: {
    exceptionName: string;
    message: string;
    locator?: string;
  };
}

export interface ScriptExecutionDetail {
  scriptId: string;
  scriptName: string;
  moduleName: string;
  status: 'Passed' | 'Failed' | 'Running' | 'Aborted' | 'Skipped';
  startedAt: string;
  completedAt?: string;
  durationSeconds: number;
  steps: StepExecutionDetail[];
  failureDetails?: {
    reason: string;
    exceptionName: string;
    errorMessage: string;
    failedStepNumber: number;
    failedLocator?: string;
    screenshot?: string;
    logs: string[];
  };
  screenRecordingUrl?: string;
  generatedPlaywrightCode?: string;
}

export interface DetailedExecutionRecord {
  id: string;
  projectId: string;
  suiteName?: string;
  status: 'Passed' | 'Failed' | 'Running' | 'Pending' | 'Aborted' | 'Skipped';
  startedAt: string;
  completedAt?: string;
  durationSeconds: number;
  totalScripts: number;
  passedScripts: number;
  failedScripts: number;
  runSettings: RunSettings;
  machine: MachineDetails;
  nodeVersion: string;
  playwrightVersion: string;
  scripts: ScriptExecutionDetail[];
}

export interface DatabaseSchema {
  users: DbUser[];
  projects: Project[];
  simulatedEmails: SimulatedEmail[];
  pages: RepositoryPage[];
  elements: RepositoryElement[];
  executions: ExecutionRecord[];
  testDataFolders: TestDataFolder[];
  testDataFiles: TestDataFile[];
  scriptModules: ScriptModule[];
  scripts: AutomationScript[];
  variables: ScriptVariable[];
  detailedExecutions: DetailedExecutionRecord[];
  runSettings: Record<string, RunSettings>;
  executionCounter: number;
  scriptsSeededProjects?: string[];
  repositorySeededProjects?: string[];
  testDataSeededProjects?: string[];
}

export class JsonDatabase {
  private filePath: string;
  private data: DatabaseSchema = {
    users: [],
    projects: [],
    simulatedEmails: [],
    pages: [],
    elements: [],
    executions: [],
    testDataFolders: [],
    testDataFiles: [],
    scriptModules: [],
    scripts: [],
    variables: [],
    detailedExecutions: [],
    runSettings: {},
    executionCounter: 1,
    scriptsSeededProjects: [],
    repositorySeededProjects: [],
    testDataSeededProjects: []
  };

  constructor(customPath?: string) {
    if (customPath) {
      this.filePath = customPath;
    } else {
      const localWorkspacePath = path.join(process.cwd(), 'easy_automate_db.json');
      const dataDir = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Preferences' : '/var/local');
      const appDir = path.join(dataDir, 'easy-automate');

      try {
        if (!fs.existsSync(localWorkspacePath)) {
          fs.writeFileSync(localWorkspacePath, JSON.stringify({}), 'utf-8');
        }
        this.filePath = localWorkspacePath;
      } catch {
        if (!fs.existsSync(appDir)) {
          try {
            fs.mkdirSync(appDir, { recursive: true });
          } catch {}
        }
        this.filePath = path.join(appDir, 'easy_automate_db.json');
      }
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
        if (!this.data.pages) this.data.pages = [];
        if (!this.data.elements) this.data.elements = [];
        if (!this.data.executions) this.data.executions = [];
        if (!this.data.testDataFolders) this.data.testDataFolders = [];
        if (!this.data.testDataFiles) this.data.testDataFiles = [];
        if (!this.data.scriptModules) this.data.scriptModules = [];
        if (!this.data.scripts) this.data.scripts = [];
        if (!this.data.variables) this.data.variables = [];
        if (!this.data.detailedExecutions) this.data.detailedExecutions = [];
        if (!this.data.runSettings) this.data.runSettings = {};
        if (typeof this.data.executionCounter !== 'number') this.data.executionCounter = 1;
        if (!this.data.scriptsSeededProjects) this.data.scriptsSeededProjects = [];
        if (!this.data.repositorySeededProjects) this.data.repositorySeededProjects = [];
        if (!this.data.testDataSeededProjects) this.data.testDataSeededProjects = [];
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
    let hasChanges = false;

    // 1. Seed demo user if no users
    if (this.data.users.length === 0) {
      const demoUserId = 'usr_demo_101';
      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync('P@ssword123', salt);
      const now = new Date().toISOString();

      const demoUser: DbUser = {
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
      for (const p of demoProjects) {
        this.seedProjectRepository(p.id);
        this.seedProjectExecutions(p.id);
        this.seedProjectTestData(p.id, demoUser.email);
        this.seedProjectScripts(p.id, demoUser.email);
      }
      hasChanges = true;
    }

    // Ensure demo projects have repository pages if missing
    for (const p of this.data.projects) {
      const pPages = this.data.pages.filter(page => page.projectId === p.id);
      if (pPages.length === 0 && (p.id === 'proj_ecommerce_01' || p.id === 'proj_crm_portal_02')) {
        this.seedProjectRepository(p.id);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      this.save();
    }
  }

  public seedProjectRepository(projectId: string): void {
    const now = new Date().toISOString();

    const loginPageId = 'page_login_' + projectId.slice(-4);
    const homePageId = 'page_home_' + projectId.slice(-4);
    const cartPageId = 'page_cart_' + projectId.slice(-4);
    const headerSectionId = 'subpage_header_' + projectId.slice(-4);
    const productSectionId = 'subpage_product_' + projectId.slice(-4);

    const pages: RepositoryPage[] = [
      { id: loginPageId, projectId, name: 'Login Page', parentId: null, createdAt: now, updatedAt: now },
      { id: homePageId, projectId, name: 'Home Page', parentId: null, createdAt: now, updatedAt: now },
      { id: headerSectionId, projectId, name: 'Header Section', parentId: homePageId, createdAt: now, updatedAt: now },
      { id: productSectionId, projectId, name: 'Product Section', parentId: homePageId, createdAt: now, updatedAt: now },
      { id: cartPageId, projectId, name: 'Cart Page', parentId: null, createdAt: now, updatedAt: now }
    ];

    const elements: RepositoryElement[] = [
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

    this.data.pages.push(...pages);
    this.data.elements.push(...elements);
  }

  public seedProjectExecutions(projectId: string): void {
    const executions: ExecutionRecord[] = [
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
    ];

    this.data.executions.push(...executions);
  }

  // Stage 3: Seed Project Test Data structure matching Section 4.2 example
  public seedProjectTestData(projectId: string, userEmail: string): void {
    const now = new Date().toISOString();

    // 1. Folders:
    // Login Module (Valid Login, Invalid Login)
    // Product Module (Product Search, Add To Cart)
    // Payment Module (Credit Card, UPI)
    // Registration Module
    const fLogin = 'fld_login_' + projectId.slice(-4);
    const fLoginValid = 'fld_login_v_' + projectId.slice(-4);
    const fLoginInvalid = 'fld_login_i_' + projectId.slice(-4);

    const fProduct = 'fld_prod_' + projectId.slice(-4);
    const fProductSearch = 'fld_prod_s_' + projectId.slice(-4);
    const fProductCart = 'fld_prod_c_' + projectId.slice(-4);

    const fPayment = 'fld_pay_' + projectId.slice(-4);
    const fPaymentCC = 'fld_pay_cc_' + projectId.slice(-4);
    const fPaymentUPI = 'fld_pay_upi_' + projectId.slice(-4);

    const fRegistration = 'fld_reg_' + projectId.slice(-4);

    const folders: TestDataFolder[] = [
      { id: fLogin, projectId, name: 'Login Module', parentId: null, createdAt: now, updatedAt: now },
      { id: fLoginValid, projectId, name: 'Valid Login', parentId: fLogin, createdAt: now, updatedAt: now },
      { id: fLoginInvalid, projectId, name: 'Invalid Login', parentId: fLogin, createdAt: now, updatedAt: now },

      { id: fProduct, projectId, name: 'Product Module', parentId: null, createdAt: now, updatedAt: now },
      { id: fProductSearch, projectId, name: 'Product Search', parentId: fProduct, createdAt: now, updatedAt: now },
      { id: fProductCart, projectId, name: 'Add To Cart', parentId: fProduct, createdAt: now, updatedAt: now },

      { id: fPayment, projectId, name: 'Payment Module', parentId: null, createdAt: now, updatedAt: now },
      { id: fPaymentCC, projectId, name: 'Credit Card', parentId: fPayment, createdAt: now, updatedAt: now },
      { id: fPaymentUPI, projectId, name: 'UPI', parentId: fPayment, createdAt: now, updatedAt: now },

      { id: fRegistration, projectId, name: 'Registration Module', parentId: null, createdAt: now, updatedAt: now }
    ];

    // 2. Files matching Section 4.2
    const files: TestDataFile[] = [
      {
        id: 'file_01_' + projectId.slice(-4),
        projectId,
        folderId: fLoginValid,
        fileName: 'valid_login_data.xlsx',
        fileFormat: '.xlsx',
        fileSizeBytes: 24576,
        fileSizeFormatted: '24.0 KB',
        uploadedBy: userEmail,
        uploadedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        sheetNames: ['Credentials', 'Tokens'],
        rowCount: 12,
        description: 'Standard valid user credentials and expected dashboard headings'
      },
      {
        id: 'file_02_' + projectId.slice(-4),
        projectId,
        folderId: fLoginInvalid,
        fileName: 'invalid_login_data.xlsx',
        fileFormat: '.xlsx',
        fileSizeBytes: 18432,
        fileSizeFormatted: '18.0 KB',
        uploadedBy: userEmail,
        uploadedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        sheetNames: ['BadEmails', 'LockedAccounts'],
        rowCount: 20,
        description: 'Malformed emails, locked passwords, and error message assertions'
      },
      {
        id: 'file_03_' + projectId.slice(-4),
        projectId,
        folderId: fProductSearch,
        fileName: 'product_search_data.xlsx',
        fileFormat: '.xlsx',
        fileSizeBytes: 32768,
        fileSizeFormatted: '32.0 KB',
        uploadedBy: userEmail,
        uploadedAt: new Date(Date.now() - 86400000).toISOString(),
        sheetNames: ['SearchKeywords', 'Filters'],
        rowCount: 45,
        description: 'Product queries, SKUs, and category filter matrices'
      },
      {
        id: 'file_04_' + projectId.slice(-4),
        projectId,
        folderId: fProductCart,
        fileName: 'cart_valid_data.xlsx',
        fileFormat: '.xlsx',
        fileSizeBytes: 28672,
        fileSizeFormatted: '28.0 KB',
        uploadedBy: userEmail,
        uploadedAt: new Date(Date.now() - 86400000).toISOString(),
        sheetNames: ['Items', 'Coupons'],
        rowCount: 18,
        description: 'Cart additions, discounts, and quantity adjustments'
      },
      {
        id: 'file_05_' + projectId.slice(-4),
        projectId,
        folderId: fProductCart,
        fileName: 'cart_invalid_data.xlsx',
        fileFormat: '.xlsx',
        fileSizeBytes: 14336,
        fileSizeFormatted: '14.0 KB',
        uploadedBy: userEmail,
        uploadedAt: new Date(Date.now() - 86400000).toISOString(),
        sheetNames: ['OutOfStock', 'MaxLimit'],
        rowCount: 10,
        description: 'Out-of-stock items and quantity limit validation'
      },
      {
        id: 'file_06_' + projectId.slice(-4),
        projectId,
        folderId: fPaymentCC,
        fileName: 'credit_card_data.xlsx',
        fileFormat: '.xlsx',
        fileSizeBytes: 21504,
        fileSizeFormatted: '21.0 KB',
        uploadedBy: userEmail,
        uploadedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
        sheetNames: ['SandboxCards', 'CVV'],
        rowCount: 15,
        description: 'Test Visa, Mastercard, Amex numbers and CVV formats'
      },
      {
        id: 'file_07_' + projectId.slice(-4),
        projectId,
        folderId: fPaymentUPI,
        fileName: 'upi_data.xlsx',
        fileFormat: '.xlsx',
        fileSizeBytes: 16384,
        fileSizeFormatted: '16.0 KB',
        uploadedBy: userEmail,
        uploadedAt: new Date(Date.now() - 3600000 * 6).toISOString(),
        sheetNames: ['UPI_IDs', 'Timeouts'],
        rowCount: 14,
        description: 'Virtual payment addresses for mock gateway tests'
      },
      {
        id: 'file_08_' + projectId.slice(-4),
        projectId,
        folderId: fRegistration,
        fileName: 'registration_data.xlsx',
        fileFormat: '.xlsx',
        fileSizeBytes: 35840,
        fileSizeFormatted: '35.0 KB',
        uploadedBy: userEmail,
        uploadedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        sheetNames: ['NewUsers', 'Roles'],
        rowCount: 50,
        description: 'User registration profiles, passwords, and security questions'
      }
    ];

    this.data.testDataFolders.push(...folders);
    this.data.testDataFiles.push(...files);
  }

  // --- User / Auth Methods ---

  public findUserByEmail(email: string): DbUser | undefined {
    return this.data.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
  }

  public findUserById(id: string): DbUser | undefined {
    return this.data.users.find(u => u.id === id);
  }

  public registerUser(email: string): { user: DbUser; activationToken: string; activationLink: string } {
    const cleanEmail = email.trim().toLowerCase();
    const existing = this.findUserByEmail(cleanEmail);
    if (existing) {
      if (existing.isActivated) {
        throw new Error('This email is already registered and activated. Please log in.');
      } else {
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
    const newUser: DbUser = {
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

  public activateAccount(token: string, plainPassword: string): DbUser {
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

  public loginUser(email: string, plainPassword: string): DbUser {
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
    this.data.pages = this.data.pages.filter(p => p.projectId !== projectId);
    this.data.elements = this.data.elements.filter(e => e.projectId !== projectId);
    this.data.executions = this.data.executions.filter(e => e.projectId !== projectId);
    this.data.testDataFolders = this.data.testDataFolders.filter(f => f.projectId !== projectId);
    this.data.testDataFiles = this.data.testDataFiles.filter(f => f.projectId !== projectId);
    this.save();
    return true;
  }

  // ================= Stage 2: Repository Operations ================= //

  public getRepositoryPages(projectId: string): RepositoryPage[] {
    return this.data.pages.filter(p => p.projectId === projectId);
  }

  public createRepositoryPage(projectId: string, name: string, parentId?: string | null): RepositoryPage {
    const cleanName = name.trim();
    if (!cleanName) {
      throw new Error('Page name is required.');
    }

    const existing = this.data.pages.find(p =>
      p.projectId === projectId &&
      (p.parentId || null) === (parentId || null) &&
      p.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (existing) {
      throw new Error(`A page or subpage named "${cleanName}" already exists in this section.`);
    }

    const now = new Date().toISOString();
    const newPage: RepositoryPage = {
      id: 'page_' + crypto.randomUUID().slice(0, 8),
      projectId,
      name: cleanName,
      parentId: parentId || null,
      createdAt: now,
      updatedAt: now
    };

    this.data.pages.push(newPage);
    this.save();
    return newPage;
  }

  public updateRepositoryPage(pageId: string, projectId: string, name: string): RepositoryPage {
    const page = this.data.pages.find(p => p.id === pageId && p.projectId === projectId);
    if (!page) {
      throw new Error('Page not found.');
    }

    const cleanName = name.trim();
    if (!cleanName) {
      throw new Error('Page name cannot be empty.');
    }

    const duplicate = this.data.pages.find(p =>
      p.projectId === projectId &&
      p.id !== pageId &&
      (p.parentId || null) === (page.parentId || null) &&
      p.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicate) {
      throw new Error(`Another page with name "${cleanName}" already exists in this section.`);
    }

    page.name = cleanName;
    page.updatedAt = new Date().toISOString();
    this.save();
    return page;
  }

  public deleteRepositoryPage(pageId: string, projectId: string): boolean {
    const pageIndex = this.data.pages.findIndex(p => p.id === pageId && p.projectId === projectId);
    if (pageIndex === -1) {
      throw new Error('Page not found.');
    }

    const idsToDelete: string[] = [pageId];
    const findChildren = (parent: string) => {
      const children = this.data.pages.filter(p => p.parentId === parent);
      for (const c of children) {
        idsToDelete.push(c.id);
        findChildren(c.id);
      }
    };
    findChildren(pageId);

    this.data.pages = this.data.pages.filter(p => !idsToDelete.includes(p.id));
    this.data.elements = this.data.elements.filter(e => !idsToDelete.includes(e.pageId));
    this.save();
    return true;
  }

  public getRepositoryElements(projectId: string, pageId?: string): RepositoryElement[] {
    if (pageId) {
      return this.data.elements.filter(e => e.projectId === projectId && e.pageId === pageId);
    }
    return this.data.elements.filter(e => e.projectId === projectId);
  }

  public getRepositoryElementById(elementId: string, projectId: string): RepositoryElement | undefined {
    return this.data.elements.find(e => e.id === elementId && e.projectId === projectId);
  }

  public createRepositoryElement(
    projectId: string,
    pageId: string,
    data: { name: string; type: ElementType; description?: string; locators: Locator[] }
  ): RepositoryElement {
    const cleanName = data.name.trim();
    if (!cleanName) {
      throw new Error('Element Name is mandatory.');
    }
    if (!data.type) {
      throw new Error('Element Type is mandatory.');
    }
    if (!data.locators || data.locators.length === 0) {
      throw new Error('At least one locator configuration is required.');
    }

    data.locators.forEach((loc, idx) => {
      if (!loc.type) {
        throw new Error(`Locator #${idx + 1}: Locator Type is mandatory.`);
      }
      if (!loc.value || !loc.value.trim()) {
        throw new Error(`Locator #${idx + 1}: Locator Value cannot be empty.`);
      }
      const openCount = (loc.value.match(/\{/g) || []).length;
      const closeCount = (loc.value.match(/\}/g) || []).length;
      if (openCount !== closeCount) {
        throw new Error(`Locator #${idx + 1}: Incomplete dynamic placeholder syntax. Braces '{' and '}' must match.`);
      }
    });

    const now = new Date().toISOString();
    const newElement: RepositoryElement = {
      id: 'el_' + crypto.randomUUID().slice(0, 8),
      projectId,
      pageId,
      name: cleanName,
      type: data.type,
      description: data.description?.trim() || '',
      locators: data.locators.map((l, i) => ({
        ...l,
        id: l.id || 'loc_' + (i + 1) + '_' + crypto.randomUUID().slice(0, 4),
        isPrimary: i === 0
      })),
      createdAt: now,
      updatedAt: now
    };

    this.data.elements.push(newElement);
    this.save();
    return newElement;
  }

  public updateRepositoryElement(
    elementId: string,
    projectId: string,
    data: { name: string; type: ElementType; description?: string; pageId?: string; locators: Locator[] }
  ): RepositoryElement {
    const el = this.getRepositoryElementById(elementId, projectId);
    if (!el) {
      throw new Error('Element not found.');
    }

    const cleanName = data.name.trim();
    if (!cleanName) {
      throw new Error('Element Name is mandatory.');
    }
    if (!data.type) {
      throw new Error('Element Type is mandatory.');
    }
    if (!data.locators || data.locators.length === 0) {
      throw new Error('At least one locator configuration is required.');
    }

    data.locators.forEach((loc, idx) => {
      if (!loc.type) {
        throw new Error(`Locator #${idx + 1}: Locator Type is mandatory.`);
      }
      if (!loc.value || !loc.value.trim()) {
        throw new Error(`Locator #${idx + 1}: Locator Value cannot be empty.`);
      }
      const openCount = (loc.value.match(/\{/g) || []).length;
      const closeCount = (loc.value.match(/\}/g) || []).length;
      if (openCount !== closeCount) {
        throw new Error(`Locator #${idx + 1}: Incomplete dynamic placeholder syntax. Braces '{' and '}' must match.`);
      }
    });

    el.name = cleanName;
    el.type = data.type;
    if (data.description !== undefined) el.description = data.description.trim();
    if (data.pageId) el.pageId = data.pageId;
    el.locators = data.locators.map((l, i) => ({
      ...l,
      id: l.id || 'loc_' + (i + 1) + '_' + crypto.randomUUID().slice(0, 4),
      isPrimary: i === 0
    }));
    el.updatedAt = new Date().toISOString();

    this.save();
    return el;
  }

  public deleteRepositoryElement(elementId: string, projectId: string): boolean {
    const idx = this.data.elements.findIndex(e => e.id === elementId && e.projectId === projectId);
    if (idx === -1) {
      throw new Error('Element not found.');
    }
    this.data.elements.splice(idx, 1);
    this.save();
    return true;
  }

  // ================= Stage 2: Dashboard Statistics ================= //

  public getProjectDashboardStats(projectId: string): ProjectStats {
    const elements = this.data.elements.filter(e => e.projectId === projectId);
    const scripts = this.data.scripts.filter(s => s.projectId === projectId);

    // Map detailedExecutions into ExecutionRecord format
    const detailedRecords: ExecutionRecord[] = (this.data.detailedExecutions || [])
      .filter(e => e.projectId === projectId)
      .map(de => ({
        id: de.id,
        projectId: de.projectId,
        suiteName: de.suiteName || 'Script Execution',
        status: (de.status === 'Passed' ? 'Passed' : de.status === 'Failed' ? 'Failed' : 'Aborted') as any,
        startedAt: de.startedAt,
        durationSeconds: de.durationSeconds || 0,
        totalTests: de.totalScripts || 1,
        passedTests: de.passedScripts || (de.status === 'Passed' ? 1 : 0),
        failedTests: de.failedScripts || (de.status === 'Failed' ? 1 : 0),
        environment: 'development' as const,
        machine: (de.machine as any) || {
          name: 'LOCAL-WORKSTATION',
          os: 'Windows 11',
          browser: 'Chromium',
          version: 'Playwright Ready',
          environment: 'development' as const,
          status: 'Ready' as const
        }
      }));

    const standardRecords = (this.data.executions || [])
      .filter(e => e.projectId === projectId && !detailedRecords.some(dr => dr.id === e.id));

    const combinedExecutions = [...detailedRecords, ...standardRecords]
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    const totalScripts = scripts.length;
    const totalElements = elements.length;
    const totalSuites = 0;
    const suiteExecutions = combinedExecutions.length;
    const passedExecutions = combinedExecutions.filter(e => e.status === 'Passed').length;
    const failedExecutions = combinedExecutions.filter(e => e.status === 'Failed').length;
    const passRate = suiteExecutions > 0 ? Math.round((passedExecutions / suiteExecutions) * 100) : 0;

    let machine = combinedExecutions[0]?.machine;
    if (!machine) {
      const os = require('os');
      machine = {
        name: os.hostname(),
        os: `${os.type()} ${os.release()} (${os.arch()})`,
        browser: 'Chromium',
        version: 'Playwright Ready',
        environment: 'development',
        status: 'Ready'
      };
    }

    return {
      totalScripts,
      totalElements,
      totalSuites,
      suiteExecutions,
      passedExecutions,
      failedExecutions,
      passRate,
      recentExecutions: combinedExecutions,
      activeMachine: machine
    };
  }

  // ================= Stage 3: Test Data Management Methods ================= //

  public getTestDataFolders(projectId: string): TestDataFolder[] {
    return this.data.testDataFolders.filter(f => f.projectId === projectId);
  }

  public createTestDataFolder(projectId: string, name: string, parentId?: string | null): TestDataFolder {
    const cleanName = name.trim();
    if (!cleanName) {
      throw new Error('Folder name is required.');
    }

    const normParentId = parentId || null;
    const duplicate = this.data.testDataFolders.find(f =>
      f.projectId === projectId &&
      f.parentId === normParentId &&
      f.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicate) {
      throw new Error(`A folder named "${cleanName}" already exists in this directory.`);
    }

    const now = new Date().toISOString();
    const newFolder: TestDataFolder = {
      id: 'fld_' + crypto.randomUUID().slice(0, 8),
      projectId,
      name: cleanName,
      parentId: normParentId,
      createdAt: now,
      updatedAt: now
    };

    this.data.testDataFolders.push(newFolder);
    this.save();
    return newFolder;
  }

  public updateTestDataFolder(folderId: string, projectId: string, name: string): TestDataFolder {
    const folder = this.data.testDataFolders.find(f => f.id === folderId && f.projectId === projectId);
    if (!folder) {
      throw new Error('Folder not found.');
    }

    const cleanName = name.trim();
    if (!cleanName) {
      throw new Error('Folder name cannot be empty.');
    }

    const duplicate = this.data.testDataFolders.find(f =>
      f.projectId === projectId &&
      f.id !== folderId &&
      f.parentId === folder.parentId &&
      f.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicate) {
      throw new Error(`Another folder named "${cleanName}" already exists in this directory.`);
    }

    folder.name = cleanName;
    folder.updatedAt = new Date().toISOString();
    this.save();
    return folder;
  }

  public deleteTestDataFolder(folderId: string, projectId: string): boolean {
    const folderIndex = this.data.testDataFolders.findIndex(f => f.id === folderId && f.projectId === projectId);
    if (folderIndex === -1) {
      throw new Error('Folder not found.');
    }

    // Collect all child folder IDs recursively
    const idsToDelete: string[] = [folderId];
    const findChildren = (parent: string) => {
      const children = this.data.testDataFolders.filter(f => f.parentId === parent);
      for (const c of children) {
        idsToDelete.push(c.id);
        findChildren(c.id);
      }
    };
    findChildren(folderId);

    // Remove folders
    this.data.testDataFolders = this.data.testDataFolders.filter(f => !idsToDelete.includes(f.id));

    // Remove files in all these deleted folders
    this.data.testDataFiles = this.data.testDataFiles.filter(file => !file.folderId || !idsToDelete.includes(file.folderId));

    this.save();
    return true;
  }

  public getTestDataFiles(projectId: string, folderId?: string | null): TestDataFile[] {
    if (folderId !== undefined) {
      const normFolderId = folderId || null;
      return this.data.testDataFiles.filter(f => f.projectId === projectId && f.folderId === normFolderId);
    }
    return this.data.testDataFiles.filter(f => f.projectId === projectId);
  }

  public getTestDataFileById(fileId: string, projectId: string): TestDataFile | undefined {
    return this.data.testDataFiles.find(f => f.id === fileId && f.projectId === projectId);
  }

  public uploadTestDataFile(
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
  ): TestDataFile {
    const cleanFileName = file.fileName.trim();
    const ext = cleanFileName.slice(cleanFileName.lastIndexOf('.')).toLowerCase();

    // 4.4 Validation: Only .xlsx and .xls supported
    if (ext !== '.xlsx' && ext !== '.xls') {
      throw new Error(`Unsupported file format "${ext}". Only Excel files (.xlsx and .xls) are supported.`);
    }

    const normFolderId = folderId || null;

    // Check if file with same name exists in this folder (replace or error)
    const existingIndex = this.data.testDataFiles.findIndex(f =>
      f.projectId === projectId &&
      f.folderId === normFolderId &&
      f.fileName.toLowerCase() === cleanFileName.toLowerCase()
    );

    // Format file size
    const formatSize = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const now = new Date().toISOString();

    if (existingIndex !== -1) {
      // Replace existing file
      const existing = this.data.testDataFiles[existingIndex];
      existing.fileSizeBytes = file.fileSizeBytes;
      existing.fileSizeFormatted = formatSize(file.fileSizeBytes);
      existing.uploadedBy = file.uploadedBy;
      existing.uploadedAt = now;
      if (file.fileData) existing.fileData = file.fileData;
      if (file.sheetNames) existing.sheetNames = file.sheetNames;
      if (file.rowCount) existing.rowCount = file.rowCount;
      if (file.description) existing.description = file.description;

      this.save();
      return existing;
    }

    const newFile: TestDataFile = {
      id: 'file_' + crypto.randomUUID().slice(0, 8),
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
      rowCount: file.rowCount || 10,
      description: file.description || ''
    };

    this.data.testDataFiles.push(newFile);
    this.save();
    return newFile;
  }

  public updateTestDataFile(
    fileId: string,
    projectId: string,
    updates: { fileName?: string; description?: string; folderId?: string | null }
  ): TestDataFile {
    const file = this.getTestDataFileById(fileId, projectId);
    if (!file) {
      throw new Error('Test data file not found.');
    }

    if (updates.fileName !== undefined) {
      const cleanName = updates.fileName.trim();
      const ext = cleanName.slice(cleanName.lastIndexOf('.')).toLowerCase();
      if (ext !== '.xlsx' && ext !== '.xls') {
        throw new Error('File extension must remain .xlsx or .xls');
      }

      const targetFolder = updates.folderId !== undefined ? updates.folderId : file.folderId;
      const duplicate = this.data.testDataFiles.find(f =>
        f.projectId === projectId &&
        f.id !== fileId &&
        f.folderId === targetFolder &&
        f.fileName.toLowerCase() === cleanName.toLowerCase()
      );
      if (duplicate) {
        throw new Error(`Another file named "${cleanName}" already exists in this folder.`);
      }

      file.fileName = cleanName;
      file.fileFormat = ext as ExcelFormat;
    }

    if (updates.description !== undefined) file.description = updates.description.trim();
    if (updates.folderId !== undefined) file.folderId = updates.folderId;

    this.save();
    return file;
  }

  public deleteTestDataFile(fileId: string, projectId: string): boolean {
    const idx = this.data.testDataFiles.findIndex(f => f.id === fileId && f.projectId === projectId);
    if (idx === -1) {
      throw new Error('Test data file not found.');
    }
    this.data.testDataFiles.splice(idx, 1);
    this.save();
    return true;
  }

  // ================= Stage 4: TestDev Scripts & Modules ================= //

  public seedProjectScripts(projectId: string, userEmail: string): void {
    const now = new Date().toISOString();
    const suffix = projectId.slice(-4);

    // 1. Modules & Submodules matching Section 2.1
    const modLogin = 'mod_login_' + suffix;
    const modLoginVal = 'mod_login_val_' + suffix;
    const modLoginInval = 'mod_login_inval_' + suffix;

    const modProd = 'mod_prod_' + suffix;
    const modProdSearch = 'mod_prod_search_' + suffix;
    const modProdCart = 'mod_prod_cart_' + suffix;

    const modPay = 'mod_pay_' + suffix;
    const modPayVal = 'mod_pay_val_' + suffix;

    const modules: ScriptModule[] = [
      { id: modLogin, projectId, name: 'Login Module', parentId: null, createdAt: now, updatedAt: now },
      { id: modLoginVal, projectId, name: 'Valid Login', parentId: modLogin, createdAt: now, updatedAt: now },
      { id: modLoginInval, projectId, name: 'Invalid Login', parentId: modLogin, createdAt: now, updatedAt: now },

      { id: modProd, projectId, name: 'Product Module', parentId: null, createdAt: now, updatedAt: now },
      { id: modProdSearch, projectId, name: 'Product Search', parentId: modProd, createdAt: now, updatedAt: now },
      { id: modProdCart, projectId, name: 'Cart Module', parentId: modProd, createdAt: now, updatedAt: now },

      { id: modPay, projectId, name: 'Payment Module', parentId: null, createdAt: now, updatedAt: now },
      { id: modPayVal, projectId, name: 'Payment Validation', parentId: modPay, createdAt: now, updatedAt: now }
    ];

    // Find sample repo elements for mapping
    const emailElem = this.data.elements.find(e => e.projectId === projectId && e.name === 'Email Field');
    const passElem = this.data.elements.find(e => e.projectId === projectId && e.name === 'Password Field');
    const btnElem = this.data.elements.find(e => e.projectId === projectId && e.name === 'Login Button');
    const searchElem = this.data.elements.find(e => e.projectId === projectId && e.name === 'Search Field');
    const cartBtnElem = this.data.elements.find(e => e.projectId === projectId && e.name === 'Add To Cart Button');
    const checkoutBtnElem = this.data.elements.find(e => e.projectId === projectId && e.name === 'Checkout Button');

    const emailPage = emailElem ? this.data.pages.find(p => p.id === emailElem.pageId)?.name : 'Login Page';
    const homePage = searchElem ? this.data.pages.find(p => p.id === searchElem.pageId)?.name : 'Home Page';
    const cartPage = checkoutBtnElem ? this.data.pages.find(p => p.id === checkoutBtnElem.pageId)?.name : 'Cart Page';

    const scrValidLoginId = 'scr_01_' + suffix;
    const scrRememberMeId = 'scr_02_' + suffix;
    const scrInvalidPassId = 'scr_03_' + suffix;
    const scrInvalidEmailId = 'scr_04_' + suffix;
    const scrSearchValidId = 'scr_05_' + suffix;
    const scrSearchInvalidId = 'scr_06_' + suffix;
    const scrAddCartId = 'scr_07_' + suffix;
    const scrPaymentValId = 'scr_08_' + suffix;

    const scripts: AutomationScript[] = [
      {
        id: scrValidLoginId,
        projectId,
        moduleId: modLoginVal,
        name: 'Login With Valid Credentials',
        description: 'Verifies successful login using standard demo credentials and lands on dashboard',
        createdBy: userEmail,
        createdAt: now,
        updatedAt: now,
        stepCount: 6,
        lastExecutionStatus: 'Passed',
        lastExecutionDate: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
        steps: [
          {
            id: 'step_1_' + suffix,
            stepNumber: 1,
            nlpId: 'open_browser',
            nlpName: 'Open Browser',
            nlpCategory: 'Browser',
            description: 'Launch the configured browser (Chromium)',
            parameters: { browser: 'Chromium' },
            isEnabled: true
          },
          {
            id: 'step_2_' + suffix,
            stepNumber: 2,
            nlpId: 'navigate_to_url',
            nlpName: 'Navigate To URL',
            nlpCategory: 'Browser',
            description: 'Navigate to target login portal',
            parameters: { url: '$baseURL/login' },
            isEnabled: true
          },
          {
            id: 'step_3_' + suffix,
            stepNumber: 3,
            nlpId: 'enter_text',
            nlpName: 'Enter Text',
            nlpCategory: 'Browser Action',
            description: 'Fill in user email credential',
            elementId: emailElem?.id || null,
            elementName: emailElem?.name || 'Email Field',
            pageName: emailPage,
            locator: emailElem?.locators[0],
            parameters: { text: '$username', clearBeforeTyping: true },
            isEnabled: true
          },
          {
            id: 'step_4_' + suffix,
            stepNumber: 4,
            nlpId: 'enter_text',
            nlpName: 'Enter Text',
            nlpCategory: 'Browser Action',
            description: 'Fill in secure user password',
            elementId: passElem?.id || null,
            elementName: passElem?.name || 'Password Field',
            pageName: emailPage,
            locator: passElem?.locators[0],
            parameters: { text: '$password', clearBeforeTyping: true },
            isEnabled: true
          },
          {
            id: 'step_5_' + suffix,
            stepNumber: 5,
            nlpId: 'click_element',
            nlpName: 'Click On Element',
            nlpCategory: 'Browser Action',
            description: 'Submit credentials and initiate session',
            elementId: btnElem?.id || null,
            elementName: btnElem?.name || 'Login Button',
            pageName: emailPage,
            locator: btnElem?.locators[0],
            parameters: {},
            isEnabled: true
          },
          {
            id: 'step_6_' + suffix,
            stepNumber: 6,
            nlpId: 'verify_element_is_displayed',
            nlpName: 'Verify Element Is Displayed',
            nlpCategory: 'Verification',
            description: 'Assert dashboard user profile icon is visible',
            elementId: searchElem?.id || null,
            elementName: 'Profile Icon',
            pageName: homePage,
            locator: { type: 'ID', value: 'profile-icon' },
            parameters: {},
            isEnabled: true
          }
        ]
      },
      {
        id: scrRememberMeId,
        projectId,
        moduleId: modLoginVal,
        name: 'Login With Remember Me',
        description: 'Verifies persistent login cookie when Remember Me checkbox is checked',
        createdBy: userEmail,
        createdAt: now,
        updatedAt: now,
        stepCount: 5,
        lastExecutionStatus: 'Passed',
        lastExecutionDate: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        steps: [
          {
            id: 'step_21_' + suffix,
            stepNumber: 1,
            nlpId: 'open_browser',
            nlpName: 'Open Browser',
            nlpCategory: 'Browser',
            description: 'Launch browser',
            parameters: {},
            isEnabled: true
          },
          {
            id: 'step_22_' + suffix,
            stepNumber: 2,
            nlpId: 'navigate_to_url',
            nlpName: 'Navigate To URL',
            nlpCategory: 'Browser',
            description: 'Open login page',
            parameters: { url: '$baseURL/login' },
            isEnabled: true
          },
          {
            id: 'step_23_' + suffix,
            stepNumber: 3,
            nlpId: 'enter_text',
            nlpName: 'Enter Text',
            nlpCategory: 'Browser Action',
            description: 'Enter email',
            elementId: emailElem?.id || null,
            elementName: emailElem?.name || 'Email Field',
            pageName: emailPage,
            locator: emailElem?.locators[0],
            parameters: { text: '$username' },
            isEnabled: true
          },
          {
            id: 'step_24_' + suffix,
            stepNumber: 4,
            nlpId: 'select_checkbox',
            nlpName: 'Select Checkbox',
            nlpCategory: 'Browser Action',
            description: 'Check remember me checkbox',
            parameters: {},
            isEnabled: true
          },
          {
            id: 'step_25_' + suffix,
            stepNumber: 5,
            nlpId: 'click_element',
            nlpName: 'Click On Element',
            nlpCategory: 'Browser Action',
            description: 'Click login button',
            elementId: btnElem?.id || null,
            elementName: btnElem?.name || 'Login Button',
            pageName: emailPage,
            locator: btnElem?.locators[0],
            parameters: {},
            isEnabled: true
          }
        ]
      },
      {
        id: scrInvalidPassId,
        projectId,
        moduleId: modLoginInval,
        name: 'Login With Invalid Password',
        description: 'Negative test validating error toast when wrong password is supplied',
        createdBy: userEmail,
        createdAt: now,
        updatedAt: now,
        stepCount: 5,
        lastExecutionStatus: 'Passed',
        lastExecutionDate: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
        steps: [
          {
            id: 'step_31_' + suffix,
            stepNumber: 1,
            nlpId: 'open_browser',
            nlpName: 'Open Browser',
            nlpCategory: 'Browser',
            description: 'Open browser',
            parameters: {},
            isEnabled: true
          },
          {
            id: 'step_32_' + suffix,
            stepNumber: 2,
            nlpId: 'navigate_to_url',
            nlpName: 'Navigate To URL',
            nlpCategory: 'Browser',
            description: 'Navigate to login',
            parameters: { url: '$baseURL/login' },
            isEnabled: true
          },
          {
            id: 'step_33_' + suffix,
            stepNumber: 3,
            nlpId: 'enter_text',
            nlpName: 'Enter Text',
            nlpCategory: 'Browser Action',
            description: 'Enter email',
            elementId: emailElem?.id || null,
            elementName: emailElem?.name || 'Email Field',
            pageName: emailPage,
            locator: emailElem?.locators[0],
            parameters: { text: '$username' },
            isEnabled: true
          },
          {
            id: 'step_34_' + suffix,
            stepNumber: 4,
            nlpId: 'enter_text',
            nlpName: 'Enter Text',
            nlpCategory: 'Browser Action',
            description: 'Enter wrong password',
            elementId: passElem?.id || null,
            elementName: passElem?.name || 'Password Field',
            pageName: emailPage,
            locator: passElem?.locators[0],
            parameters: { text: 'WrongPassword999' },
            isEnabled: true
          },
          {
            id: 'step_35_' + suffix,
            stepNumber: 5,
            nlpId: 'click_element',
            nlpName: 'Click On Element',
            nlpCategory: 'Browser Action',
            description: 'Click login',
            elementId: btnElem?.id || null,
            elementName: btnElem?.name || 'Login Button',
            pageName: emailPage,
            locator: btnElem?.locators[0],
            parameters: {},
            isEnabled: true
          }
        ]
      },
      {
        id: scrInvalidEmailId,
        projectId,
        moduleId: modLoginInval,
        name: 'Login With Invalid Email',
        description: 'Negative test validating client-side email format regex check',
        createdBy: userEmail,
        createdAt: now,
        updatedAt: now,
        stepCount: 3,
        lastExecutionStatus: 'Passed',
        lastExecutionDate: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
        steps: [
          {
            id: 'step_41_' + suffix,
            stepNumber: 1,
            nlpId: 'open_browser',
            nlpName: 'Open Browser',
            nlpCategory: 'Browser',
            description: 'Open browser',
            parameters: {},
            isEnabled: true
          },
          {
            id: 'step_42_' + suffix,
            stepNumber: 2,
            nlpId: 'navigate_to_url',
            nlpName: 'Navigate To URL',
            nlpCategory: 'Browser',
            description: 'Open login page',
            parameters: { url: '$baseURL/login' },
            isEnabled: true
          },
          {
            id: 'step_43_' + suffix,
            stepNumber: 3,
            nlpId: 'enter_text',
            nlpName: 'Enter Text',
            nlpCategory: 'Browser Action',
            description: 'Enter malformed email string',
            elementId: emailElem?.id || null,
            elementName: emailElem?.name || 'Email Field',
            pageName: emailPage,
            locator: emailElem?.locators[0],
            parameters: { text: 'notanemail' },
            isEnabled: true
          }
        ]
      },
      {
        id: scrSearchValidId,
        projectId,
        moduleId: modProdSearch,
        name: 'Search With Valid Product',
        description: 'Queries product catalog using valid product keyword from variables',
        createdBy: userEmail,
        createdAt: now,
        updatedAt: now,
        stepCount: 4,
        lastExecutionStatus: 'Passed',
        lastExecutionDate: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        steps: [
          {
            id: 'step_51_' + suffix,
            stepNumber: 1,
            nlpId: 'open_browser',
            nlpName: 'Open Browser',
            nlpCategory: 'Browser',
            description: 'Open browser',
            parameters: {},
            isEnabled: true
          },
          {
            id: 'step_52_' + suffix,
            stepNumber: 2,
            nlpId: 'navigate_to_url',
            nlpName: 'Navigate To URL',
            nlpCategory: 'Browser',
            description: 'Navigate to storefront',
            parameters: { url: '$baseURL/storefront' },
            isEnabled: true
          },
          {
            id: 'step_53_' + suffix,
            stepNumber: 3,
            nlpId: 'enter_text',
            nlpName: 'Enter Text',
            nlpCategory: 'Browser Action',
            description: 'Enter search keyword',
            elementId: searchElem?.id || null,
            elementName: searchElem?.name || 'Search Field',
            pageName: homePage,
            locator: searchElem?.locators[0],
            parameters: { text: '$productName' },
            isEnabled: true
          },
          {
            id: 'step_54_' + suffix,
            stepNumber: 4,
            nlpId: 'press_keyboard_key',
            nlpName: 'Press Keyboard Key',
            nlpCategory: 'Browser Action',
            description: 'Press Enter to submit search',
            parameters: { key: 'Enter' },
            isEnabled: true
          }
        ]
      },
      {
        id: scrSearchInvalidId,
        projectId,
        moduleId: modProdSearch,
        name: 'Search With Invalid Product',
        description: 'Queries product catalog with non-existent SKU and asserts empty state',
        createdBy: userEmail,
        createdAt: now,
        updatedAt: now,
        stepCount: 3,
        lastExecutionStatus: 'Passed',
        lastExecutionDate: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
        steps: [
          {
            id: 'step_61_' + suffix,
            stepNumber: 1,
            nlpId: 'open_browser',
            nlpName: 'Open Browser',
            nlpCategory: 'Browser',
            description: 'Open browser',
            parameters: {},
            isEnabled: true
          },
          {
            id: 'step_62_' + suffix,
            stepNumber: 2,
            nlpId: 'navigate_to_url',
            nlpName: 'Navigate To URL',
            nlpCategory: 'Browser',
            description: 'Navigate to storefront',
            parameters: { url: '$baseURL/storefront' },
            isEnabled: true
          },
          {
            id: 'step_63_' + suffix,
            stepNumber: 3,
            nlpId: 'enter_text',
            nlpName: 'Enter Text',
            nlpCategory: 'Browser Action',
            description: 'Enter bogus SKU query',
            elementId: searchElem?.id || null,
            elementName: searchElem?.name || 'Search Field',
            pageName: homePage,
            locator: searchElem?.locators[0],
            parameters: { text: 'ZZZ999NONEXISTENT' },
            isEnabled: true
          }
        ]
      },
      {
        id: scrAddCartId,
        projectId,
        moduleId: modProdCart,
        name: 'Add Product To Cart',
        description: 'Adds item to shopping bag and validates cart quantity updates',
        createdBy: userEmail,
        createdAt: now,
        updatedAt: now,
        stepCount: 4,
        lastExecutionStatus: 'Passed',
        lastExecutionDate: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
        steps: [
          {
            id: 'step_71_' + suffix,
            stepNumber: 1,
            nlpId: 'open_browser',
            nlpName: 'Open Browser',
            nlpCategory: 'Browser',
            description: 'Launch browser',
            parameters: {},
            isEnabled: true
          },
          {
            id: 'step_72_' + suffix,
            stepNumber: 2,
            nlpId: 'navigate_to_url',
            nlpName: 'Navigate To URL',
            nlpCategory: 'Browser',
            description: 'Open product page',
            parameters: { url: '$baseURL/product/watch-01' },
            isEnabled: true
          },
          {
            id: 'step_73_' + suffix,
            stepNumber: 3,
            nlpId: 'click_element',
            nlpName: 'Click On Element',
            nlpCategory: 'Browser Action',
            description: 'Click add to cart button',
            elementId: cartBtnElem?.id || null,
            elementName: cartBtnElem?.name || 'Add To Cart Button',
            pageName: homePage,
            locator: cartBtnElem?.locators[0],
            parameters: {},
            isEnabled: true
          },
          {
            id: 'step_74_' + suffix,
            stepNumber: 4,
            nlpId: 'verify_element_is_displayed',
            nlpName: 'Verify Element Is Displayed',
            nlpCategory: 'Verification',
            description: 'Verify checkout button appears in cart slider',
            elementId: checkoutBtnElem?.id || null,
            elementName: checkoutBtnElem?.name || 'Checkout Button',
            pageName: cartPage,
            locator: checkoutBtnElem?.locators[0],
            parameters: {},
            isEnabled: true
          }
        ]
      },
      {
        id: scrPaymentValId,
        projectId,
        moduleId: modPayVal,
        name: 'Payment Validation',
        description: 'E2E checkout payment gateway token verification',
        createdBy: userEmail,
        createdAt: now,
        updatedAt: now,
        stepCount: 3,
        lastExecutionStatus: 'Passed',
        lastExecutionDate: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
        steps: [
          {
            id: 'step_81_' + suffix,
            stepNumber: 1,
            nlpId: 'open_browser',
            nlpName: 'Open Browser',
            nlpCategory: 'Browser',
            description: 'Launch browser',
            parameters: {},
            isEnabled: true
          },
          {
            id: 'step_82_' + suffix,
            stepNumber: 2,
            nlpId: 'navigate_to_url',
            nlpName: 'Navigate To URL',
            nlpCategory: 'Browser',
            description: 'Open checkout payment view',
            parameters: { url: '$baseURL/checkout' },
            isEnabled: true
          },
          {
            id: 'step_83_' + suffix,
            stepNumber: 3,
            nlpId: 'click_element',
            nlpName: 'Click On Element',
            nlpCategory: 'Browser Action',
            description: 'Click proceed to checkout',
            elementId: checkoutBtnElem?.id || null,
            elementName: checkoutBtnElem?.name || 'Checkout Button',
            pageName: cartPage,
            locator: checkoutBtnElem?.locators[0],
            parameters: {},
            isEnabled: true
          }
        ]
      }
    ];

    // 3. Variables (Section 7)
    const variables: ScriptVariable[] = [
      // Global Variables
      {
        id: 'var_glob_1_' + suffix,
        projectId,
        scriptId: null,
        name: 'baseURL',
        type: 'Global',
        dataType: 'String',
        value: 'https://demo.easyautomate.dev',
        description: 'Target test application base domain URL',
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'var_glob_2_' + suffix,
        projectId,
        scriptId: null,
        name: 'defaultTimeout',
        type: 'Global',
        dataType: 'Number',
        value: '5000',
        description: 'Global standard DOM synchronization wait duration in ms',
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'var_glob_3_' + suffix,
        projectId,
        scriptId: null,
        name: 'environment',
        type: 'Global',
        dataType: 'String',
        value: 'staging',
        description: 'Active test execution target environment tier',
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'var_glob_4_' + suffix,
        projectId,
        scriptId: null,
        name: 'productName',
        type: 'Global',
        dataType: 'String',
        value: 'Watch',
        description: 'Default e-commerce product query term',
        createdAt: now,
        updatedAt: now
      },
      // Local Variables for Login With Valid Credentials
      {
        id: 'var_loc_1_' + suffix,
        projectId,
        scriptId: scrValidLoginId,
        name: 'username',
        type: 'Local',
        dataType: 'String',
        value: 'admin@demo.com',
        description: 'Valid test account credentials',
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'var_loc_2_' + suffix,
        projectId,
        scriptId: scrValidLoginId,
        name: 'password',
        type: 'Local',
        dataType: 'Encrypted',
        value: 'P@ssword123',
        description: 'Encrypted password string masked during logs',
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'var_loc_3_' + suffix,
        projectId,
        scriptId: scrValidLoginId,
        name: 'isDisplayed',
        type: 'Local',
        dataType: 'Boolean',
        value: 'true',
        description: 'Expected flag for greeting visibility',
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'var_loc_4_' + suffix,
        projectId,
        scriptId: scrValidLoginId,
        name: 'isEnabled',
        type: 'Local',
        dataType: 'Boolean',
        value: 'true',
        description: 'Interactive button state flag',
        createdAt: now,
        updatedAt: now
      }
    ];

    // 4. Default Run Settings
    this.data.runSettings[projectId] = {
      browser: 'chromium',
      delayBetweenStepsMs: 500,
      globalWaitTimeMs: 3000,
      executionTimeoutSec: 30,
      screenshotOption: 'failed-only',
      screenRecording: false,
      isDefault: true,
      scope: 'project'
    };

    // 5. Seed Execution Record EXEC0001 matching Section 9.2
    const exec0001: DetailedExecutionRecord = {
      id: 'EXEC0001',
      projectId,
      suiteName: 'Regression Suite - Smoke & Catalog',
      status: 'Passed',
      startedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      completedAt: new Date(Date.now() - 1000 * 60 * 29 - 1000 * 45).toISOString(),
      durationSeconds: 15.4,
      totalScripts: 3,
      passedScripts: 2,
      failedScripts: 1,
      runSettings: {
        browser: 'chromium',
        delayBetweenStepsMs: 500,
        globalWaitTimeMs: 3000,
        executionTimeoutSec: 30,
        screenshotOption: 'every-step',
        screenRecording: false
      },
      machine: {
        name: 'WORKSTATION-QA-01',
        os: 'Windows 11 Pro 64-bit',
        browser: 'Chromium',
        version: '131.0.6778.86',
        environment: 'staging',
        status: 'Ready'
      },
      nodeVersion: process.version || 'v22.13.1',
      playwrightVersion: '1.49.1',
      scripts: [
        {
          scriptId: scrValidLoginId,
          scriptName: 'Login With Valid Credentials',
          moduleName: 'Valid Login',
          status: 'Passed',
          startedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          completedAt: new Date(Date.now() - 1000 * 60 * 30 + 1000 * 6).toISOString(),
          durationSeconds: 6.4,
          steps: [
            {
              stepNumber: 1,
              nlpName: 'Open Browser',
              nlpCategory: 'Browser',
              description: 'Launch browser',
              status: 'Passed',
              startedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
              completedAt: new Date(Date.now() - 1000 * 60 * 30 + 2500).toISOString(),
              durationSeconds: 2.5,
              inputParameters: { browser: 'Chromium' },
              logs: ['[00:00.000] Launching Chromium browser in headless mode', '[00:02.500] Browser context ready'],
              screenshot: AutomationEngine.generateScreenshotSvg('Open Browser', 'Passed', undefined, 'about:blank')
            },
            {
              stepNumber: 2,
              nlpName: 'Navigate To URL',
              nlpCategory: 'Browser',
              description: 'Navigate to login portal',
              status: 'Passed',
              startedAt: new Date(Date.now() - 1000 * 60 * 30 + 2500).toISOString(),
              completedAt: new Date(Date.now() - 1000 * 60 * 30 + 4300).toISOString(),
              durationSeconds: 1.8,
              inputParameters: { url: 'https://demo.easyautomate.dev/login' },
              variablesUsed: [{ name: 'baseURL', type: 'Global', resolvedValue: 'https://demo.easyautomate.dev' }],
              logs: ['[00:02.500] Navigating to https://demo.easyautomate.dev/login', '[00:04.300] Page load complete (HTTP 200)'],
              screenshot: AutomationEngine.generateScreenshotSvg('Navigate To URL', 'Passed', undefined, 'https://demo.easyautomate.dev/login')
            },
            {
              stepNumber: 3,
              nlpName: 'Enter Text',
              nlpCategory: 'Browser Action',
              description: 'Fill in username',
              status: 'Passed',
              startedAt: new Date(Date.now() - 1000 * 60 * 30 + 4300).toISOString(),
              completedAt: new Date(Date.now() - 1000 * 60 * 30 + 5200).toISOString(),
              durationSeconds: 0.9,
              element: {
                id: emailElem?.id || 'el_1',
                name: 'Email Field',
                page: 'Login Page',
                locatorType: 'ID',
                locatorValue: 'email'
              },
              variablesUsed: [{ name: 'username', type: 'Local', resolvedValue: 'admin@demo.com' }],
              inputParameters: { text: '$username' },
              logs: ['[00:04.300] Located element #email', '[00:05.200] Filled input with admin@demo.com'],
              screenshot: AutomationEngine.generateScreenshotSvg('Enter Text', 'Passed', 'Email Field (#email)', 'https://demo.easyautomate.dev/login')
            },
            {
              stepNumber: 4,
              nlpName: 'Click On Element',
              nlpCategory: 'Browser Action',
              description: 'Click login button',
              status: 'Passed',
              startedAt: new Date(Date.now() - 1000 * 60 * 30 + 5200).toISOString(),
              completedAt: new Date(Date.now() - 1000 * 60 * 30 + 6400).toISOString(),
              durationSeconds: 1.2,
              element: {
                id: btnElem?.id || 'el_2',
                name: 'Login Button',
                page: 'Login Page',
                locatorType: 'ID',
                locatorValue: 'login-button'
              },
              inputParameters: {},
              logs: ['[00:05.200] Located element #login-button', '[00:06.400] Click dispatched. Navigation detected.'],
              screenshot: AutomationEngine.generateScreenshotSvg('Click On Element', 'Passed', 'Login Button (#login-button)', 'https://demo.easyautomate.dev/dashboard')
            }
          ]
        },
        {
          scriptId: scrSearchValidId,
          scriptName: 'Product Search',
          moduleName: 'Product Search',
          status: 'Failed',
          startedAt: new Date(Date.now() - 1000 * 60 * 29 + 1000 * 20).toISOString(),
          completedAt: new Date(Date.now() - 1000 * 60 * 29 + 1000 * 27).toISOString(),
          durationSeconds: 7.2,
          failureDetails: {
            reason: 'Element condition timeout: Expected element "Product Card" was not displayed within 5000ms',
            exceptionName: 'ElementConditionTimeout',
            errorMessage: 'Timeout 5000ms exceeded waiting for locator(".product-card") to be visible',
            failedStepNumber: 3,
            failedLocator: '.product-card',
            screenshot: AutomationEngine.generateScreenshotSvg('Verify Product', 'Failed', 'Product Card (.product-card)', 'https://demo.easyautomate.dev/storefront', 'Timeout 5000ms waiting for .product-card'),
            logs: [
              '[00:00.000] Step 1: Search Product started',
              '[00:01.200] Step 2: Click Search submitted',
              '[00:02.200] Step 3: Waiting for element .product-card',
              '[00:07.200] Timeout 5000ms exceeded. Element not found in DOM.'
            ]
          },
          steps: [
            {
              stepNumber: 1,
              nlpName: 'Search Product',
              nlpCategory: 'Browser Action',
              description: 'Enter search product',
              status: 'Passed',
              startedAt: new Date(Date.now() - 1000 * 60 * 29 + 1000 * 20).toISOString(),
              completedAt: new Date(Date.now() - 1000 * 60 * 29 + 1000 * 21).toISOString(),
              durationSeconds: 1.1,
              inputParameters: { text: 'Watch' },
              logs: ['[00:00.000] Entered search query: Watch'],
              screenshot: AutomationEngine.generateScreenshotSvg('Search Product', 'Passed', 'Search Field', 'https://demo.easyautomate.dev/storefront')
            },
            {
              stepNumber: 2,
              nlpName: 'Click Search',
              nlpCategory: 'Browser Action',
              description: 'Trigger search query',
              status: 'Passed',
              startedAt: new Date(Date.now() - 1000 * 60 * 29 + 1000 * 21).toISOString(),
              completedAt: new Date(Date.now() - 1000 * 60 * 29 + 1000 * 22).toISOString(),
              durationSeconds: 1.0,
              inputParameters: {},
              logs: ['[00:01.000] Search button clicked'],
              screenshot: AutomationEngine.generateScreenshotSvg('Click Search', 'Passed', 'Search Button', 'https://demo.easyautomate.dev/storefront')
            },
            {
              stepNumber: 3,
              nlpName: 'Verify Product',
              nlpCategory: 'Verification',
              description: 'Verify search results product card is visible',
              status: 'Failed',
              startedAt: new Date(Date.now() - 1000 * 60 * 29 + 1000 * 22).toISOString(),
              completedAt: new Date(Date.now() - 1000 * 60 * 29 + 1000 * 27).toISOString(),
              durationSeconds: 5.1,
              element: {
                id: 'el_prod_card',
                name: 'Product Card',
                page: 'Product Section',
                locatorType: 'CSS Selector',
                locatorValue: '.product-card'
              },
              inputParameters: {},
              logs: ['[00:02.000] Polling locator .product-card', '[00:07.100] Timeout 5000ms exceeded. Element not found.'],
              screenshot: AutomationEngine.generateScreenshotSvg('Verify Product', 'Failed', 'Product Card (.product-card)', 'https://demo.easyautomate.dev/storefront', 'Timeout waiting for .product-card'),
              error: {
                exceptionName: 'ElementConditionTimeout',
                message: 'Timeout 5000ms exceeded waiting for locator(".product-card")',
                locator: '.product-card'
              }
            }
          ]
        },
        {
          scriptId: scrAddCartId,
          scriptName: 'Add Product To Cart',
          moduleName: 'Cart Module',
          status: 'Passed',
          startedAt: new Date(Date.now() - 1000 * 60 * 29 + 1000 * 28).toISOString(),
          completedAt: new Date(Date.now() - 1000 * 60 * 29 + 1000 * 30).toISOString(),
          durationSeconds: 1.8,
          steps: [
            {
              stepNumber: 1,
              nlpName: 'Open Product',
              nlpCategory: 'Browser Action',
              description: 'Navigate to product SKU page',
              status: 'Passed',
              startedAt: new Date(Date.now() - 1000 * 60 * 29 + 1000 * 28).toISOString(),
              completedAt: new Date(Date.now() - 1000 * 60 * 29 + 1000 * 29).toISOString(),
              durationSeconds: 1.0,
              inputParameters: { url: 'https://demo.easyautomate.dev/product/watch-01' },
              logs: ['[00:00.000] Product page opened'],
              screenshot: AutomationEngine.generateScreenshotSvg('Open Product', 'Passed', undefined, 'https://demo.easyautomate.dev/product/watch-01')
            },
            {
              stepNumber: 2,
              nlpName: 'Add To Cart',
              nlpCategory: 'Browser Action',
              description: 'Click add to cart button',
              status: 'Passed',
              startedAt: new Date(Date.now() - 1000 * 60 * 29 + 1000 * 29).toISOString(),
              completedAt: new Date(Date.now() - 1000 * 60 * 29 + 1000 * 30).toISOString(),
              durationSeconds: 0.8,
              element: {
                id: cartBtnElem?.id || 'el_cart',
                name: 'Add To Cart Button',
                page: 'Home Page',
                locatorType: 'ID',
                locatorValue: 'add-to-cart'
              },
              inputParameters: {},
              logs: ['[00:01.000] Clicked #add-to-cart', '[00:01.800] Cart drawer opened with item count: 1'],
              screenshot: AutomationEngine.generateScreenshotSvg('Add To Cart', 'Passed', 'Add To Cart (#add-to-cart)', 'https://demo.easyautomate.dev/cart')
            }
          ]
        }
      ]
    };

    this.data.scriptModules.push(...modules);
    this.data.scripts.push(...scripts);
    this.data.variables.push(...variables);
    this.data.detailedExecutions.push(exec0001);
    this.data.executionCounter = 2; // Next will be EXEC0002
  }

  // --- Module Operations (Section 2.2) ---

  public getScriptModules(projectId: string): ScriptModule[] {
    return this.data.scriptModules.filter(m => m.projectId === projectId);
  }

  public createScriptModule(projectId: string, name: string, parentId?: string | null): ScriptModule {
    const cleanName = name.trim();
    if (!cleanName || cleanName.length < 2) {
      throw new Error('Module name must be at least 2 characters long.');
    }

    let normParentId = parentId ? parentId.trim() : null;
    if (normParentId && !this.data.scriptModules.some(m => m.id === normParentId && m.projectId === projectId)) {
      normParentId = null;
    }

    const duplicate = this.data.scriptModules.find(m =>
      m.projectId === projectId &&
      m.parentId === normParentId &&
      m.name.toLowerCase() === cleanName.toLowerCase()
    );

    if (duplicate) {
      throw new Error(`A module named "${cleanName}" already exists at this level.`);
    }

    const now = new Date().toISOString();
    const newModule: ScriptModule = {
      id: 'mod_' + crypto.randomUUID().slice(0, 8),
      projectId,
      name: cleanName,
      parentId: normParentId,
      createdAt: now,
      updatedAt: now
    };

    this.data.scriptModules.push(newModule);
    this.save();
    return newModule;
  }

  public updateScriptModule(moduleId: string, projectId: string, name: string): ScriptModule {
    const mod = this.data.scriptModules.find(m => m.id === moduleId && m.projectId === projectId);
    if (!mod) throw new Error('Module not found.');

    const cleanName = name.trim();
    if (!cleanName || cleanName.length < 2) {
      throw new Error('Module name must be at least 2 characters long.');
    }

    const duplicate = this.data.scriptModules.find(m =>
      m.projectId === projectId &&
      m.id !== moduleId &&
      m.parentId === mod.parentId &&
      m.name.toLowerCase() === cleanName.toLowerCase()
    );

    if (duplicate) {
      throw new Error(`A module named "${cleanName}" already exists at this level.`);
    }

    mod.name = cleanName;
    mod.updatedAt = new Date().toISOString();
    this.save();
    return mod;
  }

  public deleteScriptModule(moduleId: string, projectId: string): boolean {
    const modIndex = this.data.scriptModules.findIndex(m => m.id === moduleId && m.projectId === projectId);
    if (modIndex === -1) throw new Error('Module not found.');

    // Recursively collect descendant submodule IDs
    const idsToDelete: string[] = [moduleId];
    const findDescendants = (parentId: string) => {
      const children = this.data.scriptModules.filter(m => m.parentId === parentId);
      for (const c of children) {
        idsToDelete.push(c.id);
        findDescendants(c.id);
      }
    };
    findDescendants(moduleId);

    // Delete modules
    this.data.scriptModules = this.data.scriptModules.filter(m => !idsToDelete.includes(m.id));

    // Delete scripts belonging to any of these modules
    this.data.scripts = this.data.scripts.filter(s => !idsToDelete.includes(s.moduleId));

    this.save();
    return true;
  }

  // --- Script Operations (Section 2.3) ---

  public getScripts(projectId: string, moduleId?: string): AutomationScript[] {
    if (moduleId) {
      return this.data.scripts.filter(s => s.projectId === projectId && s.moduleId === moduleId);
    }
    return this.data.scripts.filter(s => s.projectId === projectId);
  }

  public getScriptById(scriptId: string, projectId: string): AutomationScript | undefined {
    return this.data.scripts.find(s => s.id === scriptId && s.projectId === projectId);
  }

  public createScript(
    projectId: string,
    moduleId: string,
    name: string,
    createdBy: string,
    description?: string
  ): AutomationScript {
    const cleanName = name.trim();
    if (!cleanName || cleanName.length < 3) {
      throw new Error('Script name must be at least 3 characters long.');
    }

    const duplicate = this.data.scripts.find(s =>
      s.projectId === projectId &&
      s.moduleId === moduleId &&
      s.name.toLowerCase() === cleanName.toLowerCase()
    );

    if (duplicate) {
      throw new Error(`A script named "${cleanName}" already exists in this module.`);
    }

    const now = new Date().toISOString();
    const newScript: AutomationScript = {
      id: 'scr_' + crypto.randomUUID().slice(0, 8),
      projectId,
      moduleId,
      name: cleanName,
      description: description?.trim() || '',
      createdBy: createdBy || 'User',
      createdAt: now,
      updatedAt: now,
      stepCount: 0,
      lastExecutionStatus: null,
      lastExecutionDate: null,
      steps: []
    };

    this.data.scripts.push(newScript);
    this.save();
    return newScript;
  }

  public updateScript(
    scriptId: string,
    projectId: string,
    updates: Partial<AutomationScript>
  ): AutomationScript {
    const script = this.getScriptById(scriptId, projectId);
    if (!script) throw new Error('Script not found.');

    if (updates.name !== undefined) {
      const cleanName = updates.name.trim();
      if (!cleanName || cleanName.length < 3) {
        throw new Error('Script name must be at least 3 characters long.');
      }
      const targetModule = updates.moduleId !== undefined ? updates.moduleId : script.moduleId;
      const duplicate = this.data.scripts.find(s =>
        s.projectId === projectId &&
        s.id !== scriptId &&
        s.moduleId === targetModule &&
        s.name.toLowerCase() === cleanName.toLowerCase()
      );
      if (duplicate) {
        throw new Error(`A script named "${cleanName}" already exists in this module.`);
      }
      script.name = cleanName;
    }

    if (updates.description !== undefined) script.description = updates.description.trim();
    if (updates.moduleId !== undefined) script.moduleId = updates.moduleId;
    if (updates.lastExecutionStatus !== undefined) script.lastExecutionStatus = updates.lastExecutionStatus;
    if (updates.lastExecutionDate !== undefined) script.lastExecutionDate = updates.lastExecutionDate;

    script.updatedAt = new Date().toISOString();
    this.save();
    return script;
  }

  public deleteScript(scriptId: string, projectId: string): boolean {
    const idx = this.data.scripts.findIndex(s => s.id === scriptId && s.projectId === projectId);
    if (idx === -1) throw new Error('Script not found.');

    // Remove local variables for this script
    this.data.variables = this.data.variables.filter(v => v.scriptId !== scriptId);

    this.data.scripts.splice(idx, 1);
    this.save();
    return true;
  }

  // --- Step Management Area (Section 3.2, 3.3, 3.4) ---

  public addScriptStep(
    scriptId: string,
    projectId: string,
    stepData: Omit<ScriptStep, 'id' | 'stepNumber'>,
    insertAfterStepNumber?: number
  ): AutomationScript {
    const script = this.getScriptById(scriptId, projectId);
    if (!script) throw new Error('Script not found.');

    const newStep: ScriptStep = {
      id: 'step_' + crypto.randomUUID().slice(0, 8),
      stepNumber: 0, // Recalculated below
      nlpId: stepData.nlpId,
      nlpName: stepData.nlpName,
      nlpCategory: stepData.nlpCategory,
      description: stepData.description || stepData.nlpName,
      elementId: stepData.elementId || null,
      elementName: stepData.elementName,
      pageName: stepData.pageName,
      locator: stepData.locator,
      parameters: stepData.parameters || {},
      variableMappings: stepData.variableMappings,
      isEnabled: stepData.isEnabled !== false
    };

    if (typeof insertAfterStepNumber === 'number' && insertAfterStepNumber >= 1 && insertAfterStepNumber <= script.steps.length) {
      // Insert immediately below the specified step (Section 3.3)
      script.steps.splice(insertAfterStepNumber, 0, newStep);
    } else {
      // Add to end of script (Section 3.4)
      script.steps.push(newStep);
    }

    // Automatically recalculate sequential step numbers (Section 3.3)
    script.steps.forEach((step, idx) => {
      step.stepNumber = idx + 1;
    });

    script.stepCount = script.steps.length;
    script.updatedAt = new Date().toISOString();
    this.save();
    return script;
  }

  public updateScriptStep(
    scriptId: string,
    projectId: string,
    stepId: string,
    updates: Partial<ScriptStep>
  ): AutomationScript {
    const script = this.getScriptById(scriptId, projectId);
    if (!script) throw new Error('Script not found.');

    const step = script.steps.find(s => s.id === stepId);
    if (!step) throw new Error('Step not found.');

    if (updates.nlpName !== undefined) step.nlpName = updates.nlpName;
    if (updates.nlpCategory !== undefined) step.nlpCategory = updates.nlpCategory;
    if (updates.description !== undefined) step.description = updates.description;
    if (updates.elementId !== undefined) step.elementId = updates.elementId;
    if (updates.elementName !== undefined) step.elementName = updates.elementName;
    if (updates.pageName !== undefined) step.pageName = updates.pageName;
    if (updates.locator !== undefined) step.locator = updates.locator;
    if (updates.parameters !== undefined) step.parameters = updates.parameters;
    if (updates.variableMappings !== undefined) step.variableMappings = updates.variableMappings;
    if (updates.isEnabled !== undefined) step.isEnabled = updates.isEnabled;

    script.updatedAt = new Date().toISOString();
    this.save();
    return script;
  }

  public deleteScriptStep(scriptId: string, projectId: string, stepId: string): AutomationScript {
    const script = this.getScriptById(scriptId, projectId);
    if (!script) throw new Error('Script not found.');

    const idx = script.steps.findIndex(s => s.id === stepId);
    if (idx === -1) throw new Error('Step not found.');

    script.steps.splice(idx, 1);

    // Recalculate step numbers
    script.steps.forEach((s, i) => {
      s.stepNumber = i + 1;
    });

    script.stepCount = script.steps.length;
    script.updatedAt = new Date().toISOString();
    this.save();
    return script;
  }

  public duplicateScriptStep(scriptId: string, projectId: string, stepId: string): AutomationScript {
    const script = this.getScriptById(scriptId, projectId);
    if (!script) throw new Error('Script not found.');

    const idx = script.steps.findIndex(s => s.id === stepId);
    if (idx === -1) throw new Error('Step not found.');

    const original = script.steps[idx];
    const cloned: ScriptStep = {
      ...JSON.parse(JSON.stringify(original)),
      id: 'step_' + crypto.randomUUID().slice(0, 8),
      stepNumber: idx + 2
    };

    // Insert right after original
    script.steps.splice(idx + 1, 0, cloned);

    // Recalculate step numbers
    script.steps.forEach((s, i) => {
      s.stepNumber = i + 1;
    });

    script.stepCount = script.steps.length;
    script.updatedAt = new Date().toISOString();
    this.save();
    return script;
  }

  public reorderScriptSteps(scriptId: string, projectId: string, stepIds: string[]): AutomationScript {
    const script = this.getScriptById(scriptId, projectId);
    if (!script) throw new Error('Script not found.');

    const newSteps: ScriptStep[] = [];
    for (const id of stepIds) {
      const step = script.steps.find(s => s.id === id);
      if (step) newSteps.push(step);
    }

    // Add any missing steps
    for (const step of script.steps) {
      if (!newSteps.includes(step)) newSteps.push(step);
    }

    newSteps.forEach((s, idx) => {
      s.stepNumber = idx + 1;
    });

    script.steps = newSteps;
    script.updatedAt = new Date().toISOString();
    this.save();
    return script;
  }

  // --- Variables Management (Section 7) ---

  public getVariables(projectId: string, scriptId?: string | null): ScriptVariable[] {
    if (scriptId) {
      return this.data.variables.filter(v =>
        v.projectId === projectId && (v.type === 'Global' || v.scriptId === scriptId)
      );
    }
    return this.data.variables.filter(v => v.projectId === projectId);
  }

  public createVariable(
    projectId: string,
    data: {
      name: string;
      type: VariableType;
      dataType: VariableDataType;
      value: string;
      description?: string;
      scriptId?: string | null;
    }
  ): ScriptVariable {
    const cleanName = data.name.trim().replace(/^\$/, ''); // strip leading $ if entered
    if (!cleanName || !/^[a-zA-Z0-9_]+$/.test(cleanName)) {
      throw new Error('Variable name must be alphanumeric and contain no spaces.');
    }

    const normScriptId = data.type === 'Local' ? (data.scriptId || null) : null;

    // Check duplicate
    const duplicate = this.data.variables.find(v =>
      v.projectId === projectId &&
      v.name.toLowerCase() === cleanName.toLowerCase() &&
      v.type === data.type &&
      v.scriptId === normScriptId
    );

    if (duplicate) {
      throw new Error(`A ${data.type.toLowerCase()} variable named "$${cleanName}" already exists.`);
    }

    const now = new Date().toISOString();
    const newVar: ScriptVariable = {
      id: 'var_' + crypto.randomUUID().slice(0, 8),
      projectId,
      scriptId: normScriptId,
      name: cleanName,
      type: data.type,
      dataType: data.dataType,
      value: data.value,
      description: data.description?.trim() || '',
      createdAt: now,
      updatedAt: now
    };

    this.data.variables.push(newVar);
    this.save();
    return newVar;
  }

  public updateVariable(
    variableId: string,
    projectId: string,
    updates: { name?: string; value?: string; dataType?: VariableDataType; description?: string }
  ): ScriptVariable {
    const variable = this.data.variables.find(v => v.id === variableId && v.projectId === projectId);
    if (!variable) throw new Error('Variable not found.');

    if (updates.name !== undefined) {
      const cleanName = updates.name.trim().replace(/^\$/, '');
      if (!cleanName || !/^[a-zA-Z0-9_]+$/.test(cleanName)) {
        throw new Error('Variable name must be alphanumeric.');
      }
      const duplicate = this.data.variables.find(v =>
        v.projectId === projectId &&
        v.id !== variableId &&
        v.name.toLowerCase() === cleanName.toLowerCase() &&
        v.type === variable.type &&
        v.scriptId === variable.scriptId
      );
      if (duplicate) {
        throw new Error(`A ${variable.type.toLowerCase()} variable named "$${cleanName}" already exists.`);
      }
      variable.name = cleanName;
    }

    if (updates.value !== undefined) variable.value = updates.value;
    if (updates.dataType !== undefined) variable.dataType = updates.dataType;
    if (updates.description !== undefined) variable.description = updates.description.trim();

    variable.updatedAt = new Date().toISOString();
    this.save();
    return variable;
  }

  public deleteVariable(variableId: string, projectId: string): boolean {
    const idx = this.data.variables.findIndex(v => v.id === variableId && v.projectId === projectId);
    if (idx === -1) throw new Error('Variable not found.');
    this.data.variables.splice(idx, 1);
    this.save();
    return true;
  }

  // --- Run Settings (Section 8) ---

  public getRunSettings(projectId: string): RunSettings {
    if (this.data.runSettings[projectId]) {
      return this.data.runSettings[projectId];
    }
    const defaults: RunSettings = {
      browser: 'chromium',
      delayBetweenStepsMs: 500,
      globalWaitTimeMs: 3000,
      executionTimeoutSec: 30,
      screenshotOption: 'failed-only',
      screenRecording: false,
      isDefault: true,
      scope: 'project'
    };
    this.data.runSettings[projectId] = defaults;
    this.save();
    return defaults;
  }

  public saveRunSettings(projectId: string, settings: RunSettings): RunSettings {
    this.data.runSettings[projectId] = { ...settings };
    this.save();
    return this.data.runSettings[projectId];
  }

  // --- Execution Management & Engine (Section 9, 10, 11, 12) ---

  public getDetailedExecutions(projectId: string): DetailedExecutionRecord[] {
    return this.data.detailedExecutions
      .filter(e => e.projectId === projectId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  public getDetailedExecutionById(executionId: string, projectId: string): DetailedExecutionRecord | undefined {
    return this.data.detailedExecutions.find(e => e.id === executionId && e.projectId === projectId);
  }

  public async executeScript(
    projectId: string,
    scriptId: string,
    customSettings?: RunSettings
  ): Promise<DetailedExecutionRecord> {
    const script = this.getScriptById(scriptId, projectId);
    if (!script) throw new Error('Script not found for execution.');

    const settings = customSettings || this.getRunSettings(projectId);
    const localVars = this.data.variables.filter(v => v.scriptId === scriptId);
    const globalVars = this.data.variables.filter(v => v.projectId === projectId && v.type === 'Global');
    const module = this.data.scriptModules.find(m => m.id === script.moduleId);

    // Generate unique sequential Execution ID: EXEC0001, EXEC0002... (Section 9)
    const execNum = this.data.executionCounter || 1;
    this.data.executionCounter = execNum + 1;
    const executionId = `EXEC${String(execNum).padStart(4, '0')}`;

    // Execute through Playwright Engine with real browser launch and TypeScript mapping
    const scriptExecution = await AutomationEngine.executeScriptWithPlaywright({
      projectId,
      script,
      moduleName: module?.name || 'General Module',
      elements: this.data.elements.filter(e => e.projectId === projectId),
      testDataFiles: this.data.testDataFiles.filter(f => f.projectId === projectId),
      localVariables: localVars,
      globalVariables: globalVars,
      runSettings: settings,
      onFileUpdated: (updatedFile) => {
        const idx = this.data.testDataFiles.findIndex(f => f.id === updatedFile.id);
        if (idx !== -1) {
          this.data.testDataFiles[idx] = updatedFile;
          this.save();
        }
      }
    });

    const completedAt = scriptExecution.completedAt || new Date().toISOString();

    // Update script last execution stats
    script.lastExecutionStatus = scriptExecution.status;
    script.lastExecutionDate = completedAt;

    const executionRecord: DetailedExecutionRecord = {
      id: executionId,
      projectId,
      suiteName: `Single Script: ${script.name}`,
      status: scriptExecution.status,
      startedAt: scriptExecution.startedAt,
      completedAt,
      durationSeconds: scriptExecution.durationSeconds,
      totalScripts: 1,
      passedScripts: scriptExecution.status === 'Passed' ? 1 : 0,
      failedScripts: scriptExecution.status === 'Failed' ? 1 : 0,
      runSettings: settings,
      machine: {
        name: os.hostname() || 'WORKSTATION-QA-01',
        os: `${os.type()} ${os.release()} ${os.arch()}`,
        browser: settings.browser === 'chromium' ? 'Chromium' : settings.browser === 'firefox' ? 'Firefox' : 'WebKit',
        version: '131.0.6778.86',
        environment: 'staging',
        status: 'Ready'
      },
      nodeVersion: process.version,
      playwrightVersion: '1.58.0',
      scripts: [scriptExecution]
    };

    this.data.detailedExecutions.unshift(executionRecord);
    if (this.data.detailedExecutions.length > 100) {
      this.data.detailedExecutions.pop();
    }
    this.save();
    return executionRecord;
  }

  // --- Excel Utilities for Testing & Engine (Section 6) ---

  public getDataFromExcelUtility(
    projectId: string,
    fileName: string,
    sheetName: string,
    uniqueData: string
  ): Record<string, string> {
    const file = this.data.testDataFiles.find(f =>
      f.projectId === projectId && f.fileName.toLowerCase() === fileName.toLowerCase()
    );

    if (!file) throw new Error(`Excel file "${fileName}" not found.`);
    if (!file.fileData) {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        ['TC_ID', 'ProductName', 'VerificationText', 'ActualResult'],
        ['TC001', 'Watch', 'Watches Few', ''],
        ['TC002', 'Mobile', 'Mobile Details', ''],
        ['TC003', 'Laptop', 'Laptop Details', '']
      ]);
      XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Credentials');
      const buf: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      file.fileData = buf.toString('base64');
    }

    return AutomationEngine.readExcelRowMap(file.fileData, sheetName, uniqueData);
  }

  public writeDataToExcelUtility(
    projectId: string,
    fileName: string,
    sheetName: string,
    uniqueData: string,
    header: string,
    writeBackData: string
  ): boolean {
    const file = this.data.testDataFiles.find(f =>
      f.projectId === projectId && f.fileName.toLowerCase() === fileName.toLowerCase()
    );

    if (!file) throw new Error(`Excel file "${fileName}" not found.`);
    if (!file.fileData) {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        ['TC_ID', 'ProductName', 'VerificationText', 'ActualResult'],
        ['TC001', 'Watch', 'Watches Few', ''],
        ['TC002', 'Mobile', 'Mobile Details', ''],
        ['TC003', 'Laptop', 'Laptop Details', '']
      ]);
      XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Credentials');
      const buf: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      file.fileData = buf.toString('base64');
    }

    const { updatedBase64 } = AutomationEngine.writeExcelCell(
      file.fileData,
      sheetName,
      uniqueData,
      header,
      writeBackData
    );

    file.fileData = updatedBase64;
    file.uploadedAt = new Date().toISOString();
    this.save();
    return true;
  }
}
