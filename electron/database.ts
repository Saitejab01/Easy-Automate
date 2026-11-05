import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

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

export interface DatabaseSchema {
  users: DbUser[];
  projects: Project[];
  simulatedEmails: SimulatedEmail[];
  pages: RepositoryPage[];
  elements: RepositoryElement[];
  executions: ExecutionRecord[];
  testDataFolders: TestDataFolder[];
  testDataFiles: TestDataFile[];
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
    testDataFiles: []
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
        if (!this.data.pages) this.data.pages = [];
        if (!this.data.elements) this.data.elements = [];
        if (!this.data.executions) this.data.executions = [];
        if (!this.data.testDataFolders) this.data.testDataFolders = [];
        if (!this.data.testDataFiles) this.data.testDataFiles = [];
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
      hasChanges = true;
    }

    // 2. Seed Repository Pages, Elements, Executions, and Stage 3 Test Data for projects if empty
    for (const proj of this.data.projects) {
      const existingPages = this.data.pages.filter(p => p.projectId === proj.id);
      if (existingPages.length === 0) {
        this.seedProjectRepository(proj.id);
        this.seedProjectExecutions(proj.id);
        hasChanges = true;
      }

      const existingTestData = this.data.testDataFolders.filter(f => f.projectId === proj.id);
      if (existingTestData.length === 0) {
        this.seedProjectTestData(proj.id, 'demo@easyautomate.dev');
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
    this.seedProjectRepository(newProject.id);
    this.seedProjectExecutions(newProject.id);
    this.seedProjectTestData(newProject.id, 'user@easyautomate.dev');
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
    const executions = this.data.executions
      .filter(e => e.projectId === projectId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    const totalScripts = 14;
    const totalSuites = 4;
    const suiteExecutions = executions.length;
    const passedExecutions = executions.filter(e => e.status === 'Passed').length;
    const failedExecutions = executions.filter(e => e.status === 'Failed').length;
    const passRate = suiteExecutions > 0 ? Math.round((passedExecutions / suiteExecutions) * 100) : 100;

    const defaultMachine = executions[0]?.machine || {
      name: 'LOCAL-WORKSTATION-X1',
      os: 'Windows 11 Pro 64-bit',
      browser: 'Chromium',
      version: '131.0.6778.86',
      environment: 'staging',
      status: 'Ready'
    };

    return {
      totalScripts,
      totalElements: elements.length,
      totalSuites,
      suiteExecutions,
      passedExecutions,
      failedExecutions,
      passRate,
      recentExecutions: executions,
      activeMachine: defaultMachine
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
}
