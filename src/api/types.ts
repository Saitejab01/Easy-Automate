export interface User {
  id: string;
  email: string;
  isActivated: boolean;
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

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
  activationToken?: string;
  activationLink?: string;
}

export interface TokenVerifyResponse {
  valid: boolean;
  email?: string;
  error?: string;
}

export interface ProjectsResponse {
  success: boolean;
  projects?: Project[];
  project?: Project;
  error?: string;
}

// ================= Stage 2 Types: Repository & Dashboard ================= //

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

// ================= Stage 3 Types: Test Data Management ================= //

export type ExcelFormat = '.xlsx' | '.xls';

export interface TestDataFolder {
  id: string;
  projectId: string;
  name: string;
  parentId: string | null; // null for root level folders
  createdAt: string;
  updatedAt: string;
}

export interface TestDataFile {
  id: string;
  projectId: string;
  folderId: string | null; // null for root level files
  fileName: string;
  fileFormat: ExcelFormat;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  uploadedBy: string;
  uploadedAt: string;
  fileData?: string; // base64 payload for download / persistence
  sheetNames?: string[];
  rowCount?: number;
  description?: string;
}

export interface TestDataFoldersResponse {
  success: boolean;
  folders?: TestDataFolder[];
  folder?: TestDataFolder;
  error?: string;
}

export interface TestDataFilesResponse {
  success: boolean;
  files?: TestDataFile[];
  file?: TestDataFile;
  error?: string;
}
