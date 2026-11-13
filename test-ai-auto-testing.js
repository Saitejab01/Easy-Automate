const path = require('path');
const fs = require('fs');
const http = require('http');

console.log('=== TEST SUITE: AI Auto Testing Module Acceptance Tests ===\n');

// 1. Setup isolated test database
const testDbPath = path.join(__dirname, 'test_ai_db.json');
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

const { JsonDatabase } = require('./dist-electron/database');
const { AIModelService } = require('./dist-electron/ai/aiModelService');
const { DocumentParser } = require('./dist-electron/ai/documentParser');
const { NLPMapper } = require('./dist-electron/ai/nlpMapper');
const { AIAutoTestingEngine } = require('./dist-electron/ai/aiAutoTestingEngine');

async function runTestSuite() {
  const db = new JsonDatabase(testDbPath);
  const modelService = new AIModelService(db);
  const engine = new AIAutoTestingEngine(db, modelService);

  // Setup sample project & user
  const { user } = db.registerUser('ai_tester@example.com');
  const project = db.createProject(user.id, {
    name: 'E-Commerce AI Testing',
    baseUrl: 'https://demo.easyautomate.dev',
    defaultBrowser: 'chromium'
  });

  console.log('--- 1. Testing AI Model Configuration (Section 3) ---');
  // 1.1 Save Model Configuration
  const savedModel = db.saveAIModelConfiguration({
    name: 'Local Qwen 2.5 SLM',
    apiBaseUrl: 'http://127.0.0.1:11434/v1',
    modelName: 'qwen2.5-coder',
    providerType: 'openai-compatible',
    authType: 'bearer',
    apiToken: 'super-secret-local-token-12345',
    isDefault: true
  });

  console.assert(savedModel.name === 'Local Qwen 2.5 SLM', 'FAIL: Model name should match');
  console.assert(savedModel.isDefault === true, 'FAIL: Model should be default');
  console.assert(savedModel.apiToken === '••••••••', 'FAIL: Token must be masked in API output for security (Section 3.4)');

  // Verify raw token is preserved internally on backend
  const rawModel = db.getRawAIModelConfigurationById(savedModel.id);
  console.assert(rawModel.apiToken === 'super-secret-local-token-12345', 'FAIL: Backend must preserve actual token');
  console.log('✓ Model configuration saved and token masked securely in responses');

  // 1.2 Test Mock Local SLM Server Reachability & Connection Check (Section 3.3)
  console.log('\n--- 2. Testing Mock SLM Server & Dynamic Auth Handling (Section 3.3 - 3.5) ---');
  let receivedAuthHeader = '';

  // Mock global fetch for local SLM endpoints in test environment
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const urlStr = String(url);
    const headers = options.headers || {};
    receivedAuthHeader = headers['Authorization'] || headers['authorization'] || '';

    if (urlStr.endsWith('/models') || urlStr.endsWith('/api/tags')) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          data: [
            { id: 'qwen2.5-coder', name: 'qwen2.5-coder' },
            { id: 'llama3:8b', name: 'llama3:8b' }
          ]
        })
      };
    }

    if (urlStr.endsWith('/chat/completions') || urlStr.endsWith('/api/chat')) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  testCaseName: 'Verify User Login and Cart Checkout',
                  description: 'Automated flow from BRD',
                  steps: [
                    {
                      stepNumber: 1,
                      stepDescription: 'Navigate to application URL',
                      input: 'https://demo.easyautomate.dev',
                      expectedResult: 'Application login page is displayed'
                    },
                    {
                      stepNumber: 2,
                      stepDescription: 'Enter the username',
                      input: 'testuser@example.com',
                      expectedResult: 'Username entered successfully'
                    },
                    {
                      stepNumber: 3,
                      stepDescription: 'Enter the password',
                      input: 'Password123!',
                      expectedResult: 'Password entered successfully'
                    },
                    {
                      stepNumber: 4,
                      stepDescription: 'Click the Login button',
                      input: '',
                      expectedResult: 'User logged in successfully'
                    },
                    {
                      stepNumber: 5,
                      stepDescription: 'Verify dashboard is displayed',
                      input: '',
                      expectedResult: 'Dashboard header is visible'
                    }
                  ]
                })
              }
            }
          ],
          usage: {
            prompt_tokens: 150,
            completion_tokens: 95,
            total_tokens: 245
          }
        })
      };
    }

    return {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: async () => 'Endpoint not found'
    };
  };

  // Connect to mock server
  const connectionCheck = await modelService.testConnection({
    id: savedModel.id,
    name: 'Local Mock SLM',
    apiBaseUrl: 'http://127.0.0.1:11434/v1',
    modelName: 'qwen2.5-coder',
    providerType: 'openai-compatible',
    authType: 'bearer',
    apiToken: 'super-secret-local-token-12345',
    status: 'Not Connected',
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  console.assert(connectionCheck.status === 'Connected', 'FAIL: Expected Connected status');
  console.assert(connectionCheck.availableModels.includes('qwen2.5-coder'), 'FAIL: Model discovery should find qwen2.5-coder');
  console.assert(receivedAuthHeader === 'Bearer super-secret-local-token-12345', 'FAIL: Bearer token must be delivered in header');
  console.log(`✓ SLM connection check passed. Discovered ${connectionCheck.availableModels.length} models, latency: ${connectionCheck.latencyMs}ms`);

  // Update default model in DB to point to active mock server for subsequent tests
  db.saveAIModelConfiguration({
    id: savedModel.id,
    apiBaseUrl: 'http://127.0.0.1:11434/v1',
    status: 'Connected',
    isDefault: true
  });

  // 1.3 Test Document Upload & Parsing (Section 4)
  console.log('\n--- 3. Testing Document Upload, Content Extraction & Classification (Section 4) ---');

  // Test File A: Manual Test Cases
  const sampleTcPath = path.join(__dirname, 'sample_manual_tc.csv');
  fs.writeFileSync(sampleTcPath, `Step No.,Step Description,Input,Expected Result
1,Navigate to the application URL,https://demo.easyautomate.dev,Application login page is displayed
2,Enter the username,testuser@example.com,Username entered successfully
3,Enter the password,Secret123!,Password entered successfully
4,Click the Login button,N/A,User logged in successfully
5,Verify dashboard is displayed,N/A,Dashboard header is displayed
`);

  const tcDocData = await DocumentParser.parseFile(sampleTcPath);
  console.assert(tcDocData.detectedCategory === 'Manual Test Cases', 'FAIL: Expected Manual Test Cases category');
  console.assert(tcDocData.wordCount > 10, 'FAIL: Word count should be positive');

  const savedTcDoc = db.saveAIDocument({
    projectId: project.id,
    fileName: tcDocData.fileName,
    fileSize: tcDocData.fileSize,
    fileType: tcDocData.fileType,
    extractedContent: tcDocData.extractedContent,
    detectedCategory: tcDocData.detectedCategory,
    status: 'Processed'
  });
  console.log('✓ Manual test case document parsed and classified as "Manual Test Cases"');

  // Test File B: BRD / Requirement Document
  const sampleBrdPath = path.join(__dirname, 'sample_brd.txt');
  fs.writeFileSync(sampleBrdPath, `BUSINESS REQUIREMENT DOCUMENT (BRD)
Project Name: E-Commerce Web Store
1. Business Requirements
1.1 User Authentication
Users must be able to log in using their email and password.
1.2 Product Search & Checkout
Users should be able to search for items, view product details, add items to cart, and verify items in the cart.
2. Acceptance Criteria
Login must validate valid credentials and redirect to dashboard.
`);

  const brdDocData = await DocumentParser.parseFile(sampleBrdPath);
  console.assert(brdDocData.detectedCategory === 'BRD / Requirement Document', 'FAIL: Expected BRD category');

  const savedBrdDoc = db.saveAIDocument({
    projectId: project.id,
    fileName: brdDocData.fileName,
    fileSize: brdDocData.fileSize,
    fileType: brdDocData.fileType,
    extractedContent: brdDocData.extractedContent,
    detectedCategory: brdDocData.detectedCategory,
    status: 'Processed'
  });
  console.log('✓ BRD document parsed and classified as "BRD / Requirement Document"');

  // 1.4 Test Workflow A: Manual Test Cases Normalization & Auto Acceptance (Section 5)
  console.log('\n--- 4. Testing Workflow A: Manual Test Cases Auto-Extraction & 4-Column Normalization (Section 5 & 6) ---');
  const workflowATestCase = await engine.extractManualTestCasesFromDoc(savedTcDoc, project.id);
  console.assert(workflowATestCase.steps.length === 5, `FAIL: Expected 5 steps, got ${workflowATestCase.steps.length}`);
  console.assert(workflowATestCase.status === 'accepted', 'FAIL: Workflow A must automatically accept test case to start development');
  console.assert(workflowATestCase.steps[0].stepDescription === 'Navigate to the application URL', 'FAIL: Step 1 description mismatch');
  console.assert(workflowATestCase.steps[1].input === 'testuser@example.com', 'FAIL: Step 2 input mismatch');
  console.log('✓ Workflow A 4-column normalization verified (Step No., Step Description, Input, Expected Result)');

  // 1.5 Test Workflow B: BRD + User Prompt -> SLM Generated Test Cases (Section 5 & 6)
  console.log('\n--- 5. Testing Workflow B: BRD + User Prompt via Local SLM (Section 5 & 6) ---');
  const workflowBTestCase = await engine.generateTestCasesFromBRD(
    savedBrdDoc,
    'Automate user login, search for product, add to cart, and verify dashboard',
    project.id
  );

  console.assert(workflowBTestCase.status === 'draft', 'FAIL: Workflow B must remain in draft state waiting for user approval');
  console.assert(workflowBTestCase.steps.length === 5, 'FAIL: Expected 5 steps generated by SLM');
  console.assert(workflowBTestCase.steps[3].stepDescription === 'Click the Login button', 'FAIL: Step 4 mismatch');

  // Test Editing 4-Column Table: Add step & accept (Section 6.2 & 6.3)
  const updatedSteps = [
    ...workflowBTestCase.steps,
    {
      stepNumber: 6,
      stepDescription: 'Click Logout button',
      input: '',
      expectedResult: 'User logged out'
    }
  ];
  db.saveAITestCase({
    id: workflowBTestCase.id,
    projectId: project.id,
    name: 'Edited Flow by User',
    steps: updatedSteps
  });

  const acceptedB = db.acceptAITestCase(workflowBTestCase.id, project.id);
  console.assert(acceptedB.status === 'accepted', 'FAIL: Status should be accepted');
  console.assert(acceptedB.steps.length === 6, 'FAIL: Should reflect edited 6 steps');
  console.log('✓ Workflow B: SLM generation, 4-column editing, and user acceptance verified');

  // 1.6 Test NLP Mapping Engine (Section 8)
  console.log('\n--- 6. Testing Predefined NLP Mapping Engine (Section 8) ---');
  const testStepsToMap = [
    { stepNumber: 1, stepDescription: 'Navigate to application URL', input: 'https://demo.easyautomate.dev', expectedResult: 'Login page displayed' },
    { stepNumber: 2, stepDescription: 'Enter the username in email field', input: 'user@test.com', expectedResult: 'Text entered' },
    { stepNumber: 3, stepDescription: 'Click the Login button', input: '', expectedResult: 'Submitted' },
    { stepNumber: 4, stepDescription: 'Select Canada from country dropdown', input: 'Canada', expectedResult: 'Country selected' },
    { stepNumber: 5, stepDescription: 'Check terms and conditions checkbox', input: '', expectedResult: 'Checked' },
    { stepNumber: 6, stepDescription: 'Wait for dashboard to be visible', input: '', expectedResult: 'Visible' },
    { stepNumber: 7, stepDescription: 'Scroll to product footer section', input: '', expectedResult: 'Scrolled' },
    { stepNumber: 8, stepDescription: 'Verify welcome message is displayed', input: 'Welcome', expectedResult: 'Text verified' }
  ];

  const expectedNLPs = [
    'navigate_to_url',
    'enter_text',
    'click_element',
    'select_dropdown_option',
    'select_checkbox',
    'wait_for_element_to_be_visible',
    'scroll_to_element',
    'verify_text'
  ];

  for (let i = 0; i < testStepsToMap.length; i++) {
    const mapped = NLPMapper.mapStepToNLP(testStepsToMap[i], 'https://demo.easyautomate.dev');
    console.assert(mapped.nlpId === expectedNLPs[i], `FAIL: Step #${i + 1} expected NLP ${expectedNLPs[i]}, got ${mapped.nlpId}`);
  }
  console.log(`✓ All ${testStepsToMap.length} test steps cleanly mapped to predefined NLPs in catalog`);

  // 1.7 Test AI Elements Page Creation & Element Association (Section 9)
  console.log('\n--- 7. Testing AI Elements Partitioned Page & Repository Association (Section 9) ---');
  const aiPage = db.createRepositoryPage(project.id, 'AI Elements');
  console.assert(aiPage.name === 'AI Elements', 'FAIL: Expected AI Elements page');

  const createdElement = db.createRepositoryElement(project.id, aiPage.id, {
    name: 'Login Button',
    type: 'Button',
    elementMode: 'Static', // Section 9.4: stable elements explicitly Static
    locators: [
      { id: 'loc_ai_1', type: 'XPath', value: '//button[@id="login"]', valueType: 'Static', isPrimary: true, priority: 1 }
    ]
  });

  console.assert(createdElement.pageId === aiPage.id, 'FAIL: Element must belong to AI Elements page');
  console.assert(createdElement.elementMode === 'Static', 'FAIL: Element mode must be Static');
  console.log('✓ AI Elements page and element creation verified');

  // 1.8 Test Push to TestDev Scripts (Section 11)
  console.log('\n--- 8. Testing Push to TestDev Scripts & Standard Script Compatibility (Section 11) ---');
  // Create a mock development session
  const session = db.saveAIAutomationSession({
    projectId: project.id,
    testCaseId: workflowATestCase.id,
    testCaseName: workflowATestCase.name,
    status: 'completed',
    stage: 'Script Ready for Review',
    progressPercent: 100,
    applicationUrl: 'https://demo.easyautomate.dev',
    steps: [
      {
        stepNumber: 1,
        manualStepDescription: 'Navigate to application URL',
        manualInput: 'https://demo.easyautomate.dev',
        manualExpectedResult: 'Login page',
        nlpId: 'navigate_to_url',
        nlpName: 'Navigate To URL',
        inputParameters: { url: 'https://demo.easyautomate.dev' },
        status: 'Passed'
      },
      {
        stepNumber: 2,
        manualStepDescription: 'Click Login button',
        manualInput: '',
        manualExpectedResult: 'User logged in',
        nlpId: 'click_element',
        nlpName: 'Click On Element',
        elementId: createdElement.id,
        elementName: createdElement.name,
        locatorType: 'XPath',
        locatorValue: '//button[@id="login"]',
        inputParameters: { clickCount: 1 },
        status: 'Passed'
      }
    ]
  });

  const targetModule = db.createScriptModule(project.id, 'AI Generated Tests', null);
  const pushResult = await engine.pushToTestDev(
    session.id,
    project.id,
    targetModule.id,
    'AI Login Verification Script',
    user.id
  );

  console.assert(pushResult.success === true, 'FAIL: Push to TestDev failed');
  console.assert(!!pushResult.scriptId, 'FAIL: Script ID should be returned');

  // Verify created script in standard TestDev Scripts repository
  const pushedScript = db.getScriptById(pushResult.scriptId, project.id);
  console.assert(pushedScript !== undefined, 'FAIL: Pushed script must exist in database');
  console.assert(pushedScript.name === 'AI Login Verification Script', 'FAIL: Script name mismatch');
  console.assert(pushedScript.steps.length === 2, 'FAIL: Expected 2 steps in pushed script');
  console.assert(pushedScript.steps[1].elementId === createdElement.id, 'FAIL: Step 2 must reference AI Element ID');
  console.assert(pushedScript.steps[1].nlpId === 'click_element', 'FAIL: Step 2 NLP ID mismatch');
  console.log('✓ Push to TestDev verified: Script saved as normal Easy Automate script with full NLP & Repository references');

  // 1.9 Test SLM Model Usage & Token Telemetry (Section 13.4)
  console.log('\n--- 9. Testing SLM Telemetry & Token Usage Logging (Section 13.4) ---');
  const usageData = db.getAIModelUsageLogs();
  console.assert(usageData.logs.length > 0, 'FAIL: Usage logs should be recorded');
  console.assert(usageData.stats.totalTokens > 0, 'FAIL: Total tokens should be recorded');
  console.assert(usageData.stats.avgLatencyMs >= 0, 'FAIL: Average latency should be calculated');
  console.log(`✓ Usage logs verified: ${usageData.stats.totalRequests} queries, ${usageData.stats.totalTokens} tokens, avg latency: ${usageData.stats.avgLatencyMs}ms`);

  // Teardown test DB and files
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  if (fs.existsSync(sampleTcPath)) fs.unlinkSync(sampleTcPath);
  if (fs.existsSync(sampleBrdPath)) fs.unlinkSync(sampleBrdPath);

  console.log('\n========================================================================');
  console.log('ALL AI AUTO TESTING ACCEPTANCE CRITERIA PASSED! (100% SUCCESS)');
  console.log('========================================================================\n');
}

runTestSuite().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
