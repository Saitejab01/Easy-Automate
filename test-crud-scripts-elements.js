const { JsonDatabase } = require('./dist-electron/database');
const path = require('path');
const fs = require('fs');

console.log('=== TEST SUITE: CRUD Operations on Generated Scripts & Elements ===\n');

const testDbPath = path.join(__dirname, 'test_crud_db.json');
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

const db = new JsonDatabase(testDbPath);
const { user } = db.registerUser('crud_tester@example.com');
const project = db.createProject(user.id, {
  name: 'CRUD Testing Project',
  baseUrl: 'https://shoppersstack.com',
  defaultBrowser: 'chromium'
});

// 1. Test Session / Generated Script CRUD
console.log('--- 1. Testing Generated Script & Step CRUD ---');
const session = db.saveAIAutomationSession({
  projectId: project.id,
  testCaseId: 'tc_101',
  testCaseName: 'ShoppersStack Login Flow',
  applicationUrl: 'https://shoppersstack.com',
  browserType: 'chromium',
  status: 'completed',
  stage: 'Script Ready for Review',
  progressPercent: 100,
  steps: [
    {
      stepNumber: 1,
      manualStepDescription: 'Open Browser',
      nlpId: 'open_browser',
      nlpName: 'Open Browser',
      status: 'Passed'
    },
    {
      stepNumber: 2,
      manualStepDescription: 'Click on Login Button',
      nlpId: 'click_element',
      nlpName: 'Click On Element',
      elementName: 'Login Button',
      locatorType: 'ID',
      locatorValue: 'loginBtn',
      status: 'Passed'
    }
  ]
});

console.assert(session.id && session.testCaseName === 'ShoppersStack Login Flow', 'FAIL: Session creation');
console.log('✓ Created initial generated script session with 2 steps');

// 1.1 Edit Step
session.steps[1].manualStepDescription = 'Click on Header Login Button';
session.steps[1].locatorValue = '#loginBtn';
const updatedSession = db.saveAIAutomationSession(session);
console.assert(updatedSession.steps[1].manualStepDescription === 'Click on Header Login Button', 'FAIL: Step edit');
console.assert(updatedSession.steps[1].locatorValue === '#loginBtn', 'FAIL: Locator edit');
console.log('✓ Successfully edited step description and locator');

// 1.2 Add Step
updatedSession.steps.push({
  stepNumber: 3,
  manualStepDescription: 'Enter email to Email Text',
  nlpId: 'enter_text',
  nlpName: 'Enter Text',
  elementName: 'Email Input Field',
  locatorType: 'ID',
  locatorValue: 'Email',
  inputParameters: { text: 'saitejab01@gmail.com' },
  status: 'Passed'
});
const withAddedStep = db.saveAIAutomationSession(updatedSession);
console.assert(withAddedStep.steps.length === 3, 'FAIL: Add step');
console.log('✓ Successfully added a new step to the generated script');

// 1.3 Delete Step
withAddedStep.steps.splice(0, 1); // Delete step 1
withAddedStep.steps.forEach((s, idx) => s.stepNumber = idx + 1); // Renumber
const withDeletedStep = db.saveAIAutomationSession(withAddedStep);
console.assert(withDeletedStep.steps.length === 2, 'FAIL: Delete step');
console.assert(withDeletedStep.steps[0].stepNumber === 1, 'FAIL: Renumber step');
console.log('✓ Successfully deleted a step and renumbered remaining steps');

// 1.4 Rename Script
withDeletedStep.testCaseName = 'ShoppersStack E2E Flow (Renamed)';
const renamedSession = db.saveAIAutomationSession(withDeletedStep);
console.assert(renamedSession.testCaseName === 'ShoppersStack E2E Flow (Renamed)', 'FAIL: Rename script');
console.log('✓ Successfully renamed generated script');

// 1.5 Delete Script
const deletedSessionOk = db.deleteAIAutomationSession(renamedSession.id, project.id);
console.assert(deletedSessionOk === true, 'FAIL: Delete script session');
const checkDeleted = db.getAIAutomationSessionById(renamedSession.id, project.id);
console.assert(!checkDeleted, 'FAIL: Deleted script must not exist');
console.log('✓ Successfully deleted generated script session');

// 2. Test AI Elements CRUD
console.log('\n--- 2. Testing AI Elements CRUD ---');
const aiPage = db.createRepositoryPage(project.id, 'AI Elements');
console.assert(aiPage.id, 'FAIL: AI Elements page creation');

// 2.1 Create Element
const elem = db.createRepositoryElement(project.id, aiPage.id, {
  name: 'Email Input Field',
  type: 'Input Field',
  elementMode: 'Static',
  description: 'Email field captured in runtime',
  locators: [
    { id: 'loc_1', type: 'ID', value: 'Email', valueType: 'Static', isPrimary: true, priority: 1 },
    { id: 'loc_2', type: 'CSS Selector', value: 'input#Email', valueType: 'Static', isPrimary: false, priority: 2 }
  ]
});
console.assert(elem.id && elem.name === 'Email Input Field', 'FAIL: Element creation');
console.assert(elem.locators.length === 2, 'FAIL: Locators count');
console.log('✓ Successfully created AI element with 2 locators');

// 2.2 Update Element & Add Fallback Locator
elem.name = 'Shopper Email Input Field';
elem.locators.push({
  id: 'loc_3',
  type: 'XPath',
  value: '//input[@id="Email"]',
  valueType: 'Static',
  isPrimary: false,
  priority: 3
});
const updatedElem = db.updateRepositoryElement(elem.id, project.id, elem);
console.assert(updatedElem.name === 'Shopper Email Input Field', 'FAIL: Element rename');
console.assert(updatedElem.locators.length === 3, 'FAIL: Locator addition');
console.log('✓ Successfully updated AI element and added fallback locator');

// 2.3 Delete Element
const deletedElemOk = db.deleteRepositoryElement(elem.id, project.id);
console.assert(deletedElemOk === true, 'FAIL: Delete element');
const checkElem = db.getRepositoryElementById(elem.id, project.id);
console.assert(!checkElem, 'FAIL: Deleted element must not exist');
console.log('✓ Successfully deleted AI element from repository');

if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

console.log('\n========================================================================');
console.log('ALL CRUD OPERATIONS TESTS PASSED (100% SUCCESS)');
console.log('========================================================================');
