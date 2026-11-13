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
  priority?: number;
}

export interface FinderStrategy {
  id: string;
  type: LocatorType;
  value: string;
  valueType: ValueType;
  isPrimary: boolean;
  priority: number;
  selected: boolean;
  stabilityScore: number;
  stability: 'High' | 'Moderate' | 'Low';
  reasons: string[];
  feedback: string;
  matchCount: number;
}

export interface FinderCapturedElement {
  id: string;
  sequence: number;
  name: string;
  type: ElementType;
  tag: string;
  visibleText?: string;
  accessibleName?: string;
  description?: string;
  locators: FinderStrategy[];
  primaryLocatorId: string;
  targetPageId?: string;
  referenceMode?: boolean;
  referenceData?: {
    refTag: string;
    refText: string;
    refId: string;
  };
  pushed?: boolean;
  elementMode?: 'Static' | 'Dynamic';
  capturedAt: string;
}

export interface LearnedLocatorInfo {
  elementId: string;
  successfulLocatorId: string;
  locatorStrategy: LocatorType;
  locatorValue: string;
  lastSuccessfulExecutionTime: string;
  lastValidationStatus: 'passed' | 'failed';
  successCount: number;
  failureCount: number;
  updatedAt: string;
}

export interface RepositoryElement {
  id: string;
  projectId: string;
  pageId: string;
  name: string;
  type: ElementType;
  elementMode: 'Static' | 'Dynamic';
  version?: number;
  description?: string;
  locators: Locator[];
  learnedLocator?: LearnedLocatorInfo;
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

export interface TestSuite {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  scriptIds: string[];
  createdAt: string;
  updatedAt: string;
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
  elementMode?: 'Static' | 'Dynamic';
  elementVersion?: number;
  dynamicValues?: Record<string, string>;
  dynamicValueSources?: Record<string, { type: 'manual' | 'local_variable' | 'global_variable' | 'test_data'; source: string }>;
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
    resolvedLocatorValue?: string;
    elementMode?: 'Static' | 'Dynamic';
    elementVersion?: number;
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

// ================= AI Auto Testing Module Types ================= //

export type AIModelProviderType = 'openai-compatible' | 'ollama' | 'custom';
export type AIModelAuthType = 'none' | 'bearer' | 'api-key' | 'custom-header';
export type AIModelConnectionStatus =
  | 'Not Connected'
  | 'Connecting'
  | 'Connected'
  | 'Authentication Required'
  | 'Invalid API URL'
  | 'Authentication Failed'
  | 'Model Not Available'
  | 'Connection Failed';

export interface AIModelConfiguration {
  id: string;
  name: string;
  apiBaseUrl: string;
  modelName: string;
  providerType: AIModelProviderType;
  authType: AIModelAuthType;
  apiToken?: string;
  customHeaderName?: string;
  customHeaderValue?: string;
  additionalHeaders?: Record<string, string>;
  status: AIModelConnectionStatus;
  isDefault: boolean;
  lastTestedAt?: string;
  lastLatencyMs?: number;
  availableModels?: string[];
  createdAt: string;
  updatedAt: string;
}

export type AIDocumentType = 'pdf' | 'docx' | 'xlsx' | 'txt' | 'md' | 'other';
export type AIDocumentStatus = 'Uploaded' | 'Processing' | 'Processed' | 'Partially Processed' | 'Failed';
export type AIDocumentCategory =
  | 'Manual Test Cases'
  | 'BRD / Requirement Document'
  | 'Application Flow / Workflow Description'
  | 'Other / Unsupported Document';

export interface AIDocument {
  id: string;
  projectId: string;
  fileName: string;
  fileSize: number;
  fileType: AIDocumentType;
  uploadedAt: string;
  status: AIDocumentStatus;
  errorMessage?: string;
  extractedContent: string;
  detectedCategory: AIDocumentCategory;
  userCategory?: AIDocumentCategory;
  metadata?: {
    pagesCount?: number;
    wordCount?: number;
    testCasesDetected?: number;
  };
}

export interface AIManualTestCaseStep {
  stepNumber: number;
  stepDescription: string;
  input: string;
  expectedResult: string;
}

export interface AIManualTestCase {
  id: string;
  projectId: string;
  documentId?: string;
  name: string;
  description?: string;
  userPrompt?: string;
  version: number;
  status: 'draft' | 'accepted' | 'rejected';
  steps: AIManualTestCaseStep[];
  createdAt: string;
  acceptedAt?: string;
}

export type AIAutomationStage =
  | 'Document Uploaded'
  | 'Document Processed'
  | 'Test Cases Generated'
  | 'Waiting for User Approval'
  | 'Test Cases Accepted'
  | 'Browser Initialized'
  | 'Application Opened'
  | 'Elements Identified'
  | 'Locators Validated'
  | 'NLP Mapping Completed'
  | 'AI Elements Created'
  | 'Automation Generated'
  | 'Execution Completed'
  | 'Script Ready for Review'
  | 'Script Pushed to TestDev';

export type ElementIdentificationStatus =
  | 'IDENTIFIED'
  | 'NEEDS_VISUAL_VERIFICATION'
  | 'VISUAL_VERIFIED'
  | 'REJECTED'
  | 'AMBIGUOUS'
  | 'NOT_FOUND';

export interface ElementIdentificationTelemetry {
  manualTestCaseId?: string;
  stepNumber?: number;
  requestedElement?: string;
  elementMode?: 'Static' | 'Dynamic';
  strategyUsed?: string; // 'DOM_ACCESSIBILITY' | 'DOM_CONTEXT' | 'VISUAL_AI' | 'FINGERPRINT_REUSE'
  domAnalysisResult?: string; // 'Passed' | 'Ambiguous' | 'Mismatch' | 'Failed'
  contextAnalysisResult?: string; // 'Passed' | 'Ambiguous' | 'Not Applicable'
  visualAiInvoked: boolean;
  visualAiConfidence?: number;
  candidateLocators?: Array<{ type: string; value: string; matchCount: number; isValid: boolean; reason?: string }>;
  fingerprintValidationResult?: 'Passed' | 'Failed' | 'Not Found' | 'Invalidated';
  boundingBoxComparisonResult?: {
    visualBbox?: { x: number; y: number; width: number; height: number };
    domBbox?: { x: number; y: number; width: number; height: number };
    iou?: number;
    matched?: boolean;
  };
  highlightVerificationResult?: 'Passed' | 'Failed' | 'Skipped';
  highlightScreenshot?: string;
  finalSelectedLocator?: { type: string; value: string };
  confidenceScore?: number;
  totalIdentificationTimeMs?: number;
  modelResponseTimeMs?: number;
  retryCount?: number;
  failureReason?: string;
  status: ElementIdentificationStatus;
}

export interface ElementFingerprint {
  id: string;
  projectId: string;
  elementId: string;
  pageId?: string;
  urlPattern?: string;
  tagName: string;
  accessibleRole?: string;
  accessibleName?: string;
  visibleText?: string;
  attributes?: Record<string, string>;
  parentContext?: {
    containerTag?: string;
    containerClass?: string;
    containerText?: string;
    relationship?: string;
  };
  domRelationship?: string;
  locatorId?: string;
  locatorStrategy: string;
  locatorValue: string;
  lastVerifiedBoundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  lastVerifiedTimestamp: string;
  validationStatus: ElementIdentificationStatus;
  confidence?: number;
  invalidationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIAutomationStepDetail {
  stepNumber: number;
  manualStepDescription: string;
  manualInput: string;
  manualExpectedResult: string;
  browserOperation?: string;
  nlpId?: string;
  nlpName?: string;
  elementId?: string;
  elementName?: string;
  locatorType?: string;
  locatorValue?: string;
  candidateLocators?: Locator[];
  inputParameters?: Record<string, any>;
  status: 'Pending' | 'Identifying Element' | 'Executing' | 'Passed' | 'Failed' | 'Skipped';
  durationMs?: number;
  screenshot?: string;
  error?: string;
  logs?: string[];
  identificationTelemetry?: ElementIdentificationTelemetry;
}

export interface AIAutomationSession {
  id: string;
  projectId: string;
  testCaseId: string;
  testCaseName: string;
  documentId?: string;
  status: 'idle' | 'initializing_browser' | 'navigating' | 'developing' | 'executing' | 'completed' | 'failed' | 'paused';
  stage: AIAutomationStage;
  progressPercent: number;
  currentStepIndex: number;
  applicationUrl: string;
  browserType: 'chromium' | 'firefox' | 'webkit';
  steps: AIAutomationStepDetail[];
  generatedScriptId?: string;
  aiElementsPageId?: string;
  createdAt: string;
  updatedAt: string;
  failureDetails?: {
    stepNumber: number;
    error: string;
    screenshot?: string;
  };
}

export interface AIModelUsageLog {
  id: string;
  modelId: string;
  modelName: string;
  operation: 'document_classification' | 'test_case_generation' | 'step_interpretation' | 'nlp_mapping' | 'element_suggestion' | 'test_ping';
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs: number;
  status: 'success' | 'failure';
  timestamp: string;
  errorMessage?: string;
}

export interface AIModelResponse {
  success: boolean;
  status?: string;
  models?: AIModelConfiguration[];
  model?: AIModelConfiguration;
  latencyMs?: number;
  availableModels?: string[];
  testOutput?: string;
  error?: string;
}

export interface AIDocumentsResponse {
  success: boolean;
  documents?: AIDocument[];
  document?: AIDocument;
  error?: string;
}

export interface AITestCasesResponse {
  success: boolean;
  testCases?: AIManualTestCase[];
  testCase?: AIManualTestCase;
  error?: string;
}

export interface AIAutomationSessionResponse {
  success: boolean;
  sessions?: AIAutomationSession[];
  session?: AIAutomationSession;
  error?: string;
}

export interface AIModelUsageResponse {
  success: boolean;
  logs?: AIModelUsageLog[];
  stats?: {
    totalRequests: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalTokens: number;
    avgLatencyMs: number;
    failedRequests: number;
  };
  error?: string;
}
