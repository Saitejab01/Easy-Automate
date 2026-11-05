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

// ================= Stage 4 & 5 Types: TestDev (Scripts & Execution) ================= //

export type NlpCategory =
  | 'Browser'
  | 'Browser Action'
  | 'Switching'
  | 'Verification'
  | 'Wait'
  | 'Scroll'
  | 'Excel';

export interface NlpDefinition {
  id: string;
  name: string;
  category: NlpCategory;
  description: string;
  requiresElement: boolean;
  requiredParams: Array<{
    name: string;
    label: string;
    type: 'string' | 'number' | 'boolean' | 'dropdown' | 'file';
    description?: string;
    options?: string[];
    defaultValue?: any;
    placeholder?: string;
  }>;
  optionalParams?: Array<{
    name: string;
    label: string;
    type: 'string' | 'number' | 'boolean' | 'dropdown';
    description?: string;
    options?: string[];
    defaultValue?: any;
    placeholder?: string;
  }>;
}

export interface ScriptModule {
  id: string;
  projectId: string;
  name: string;
  parentId: string | null; // null for root modules, string for submodules
  createdAt: string;
  updatedAt: string;
}

export type VariableType = 'Local' | 'Global';
export type VariableDataType = 'String' | 'Number' | 'Boolean' | 'Encrypted';

export interface ScriptVariable {
  id: string;
  projectId: string;
  scriptId?: string | null; // null for Global, scriptId for Local
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
  moduleId: string; // Module or Submodule ID
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
}

export interface DetailedExecutionRecord {
  id: string; // e.g. EXEC0001
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

export interface ModulesResponse {
  success: boolean;
  modules?: ScriptModule[];
  module?: ScriptModule;
  error?: string;
}

export interface ScriptsResponse {
  success: boolean;
  scripts?: AutomationScript[];
  script?: AutomationScript;
  error?: string;
}

export interface VariablesResponse {
  success: boolean;
  variables?: ScriptVariable[];
  variable?: ScriptVariable;
  error?: string;
}

export interface ExecutionsResponse {
  success: boolean;
  executions?: DetailedExecutionRecord[];
  execution?: DetailedExecutionRecord;
  error?: string;
}
