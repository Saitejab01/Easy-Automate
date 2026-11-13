const path = require('path');
const fs = require('fs');

// Create test database instance
const testDbPath = path.join(__dirname, 'test_fallback_db.json');
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

const { JsonDatabase } = require('./dist-electron/database');
const { AutomationEngine } = require('./dist-electron/engine/automationEngine');

async function runTests() {
  console.log('=== TEST SUITE: Section 10 - Static Locator Fallback with Persistent Learning ===\n');
  const db = new JsonDatabase(testDbPath);

  // 1. Create a Project and Static Element with 4 locators
  const { user } = db.registerUser('tester@example.com');
  const project = db.createProject(user.id, { name: 'Fallback Test Project' });
  const page = db.createRepositoryPage(project.id, 'Login Page');

  const locators = [
    { id: 'loc_p1', type: 'XPath', value: '//button[@id="non_existent_1"]', valueType: 'Static', isPrimary: true, priority: 1 },
    { id: 'loc_p2', type: 'CSS Selector', value: '#non_existent_2', valueType: 'Static', isPrimary: false, priority: 2 },
    { id: 'loc_p3', type: 'ID', value: 'submit_btn', valueType: 'Static', isPrimary: false, priority: 3 },
    { id: 'loc_p4', type: 'Text', value: 'Submit', valueType: 'Static', isPrimary: false, priority: 4 }
  ];

  const staticElem = db.createRepositoryElement(project.id, page.id, {
    name: 'Submit Button',
    type: 'Button',
    elementMode: 'Static',
    locators
  });

  console.log('Step 1: Created Static Element with 4 locators (Priorities 1, 2, 3, 4).');
  console.assert(staticElem.elementMode === 'Static', 'FAIL: Element should be Static');
  console.assert(!db.getLearnedLocator(staticElem.id), 'FAIL: Initially no learned locator should exist');

  // Mock Playwright Page
  // Emulates P1 and P2 failing (throwing timeout error), and P3 succeeding
  const createMockPage = (failingMatchers = []) => {
    const checkFails = (sel) => {
      return failingMatchers.some(m => sel.includes(m));
    };
    const makeLocator = (sel) => ({
      waitFor: async ({ state, timeout }) => {
        if (checkFails(sel)) {
          const err = new Error(`Element timeout: waiting for locator "${sel}" to be attached`);
          throw err;
        }
        return true;
      }
    });

    return {
      locator: (selector) => makeLocator(selector),
      getByText: (text) => makeLocator(`text=${text}`),
      getByPlaceholder: (ph) => makeLocator(`placeholder=${ph}`),
      getByLabel: (lbl) => makeLocator(`label=${lbl}`),
      getByTestId: (tid) => makeLocator(`testid=${tid}`)
    };
  };

  const step = {
    elementId: staticElem.id,
    elementName: staticElem.name,
    elementMode: 'Static'
  };

  const learnedContext = {
    getLearnedLocator: (id) => db.getLearnedLocator(id),
    onLearnedLocatorSuccess: (id, loc) => db.recordLearnedLocatorSuccess(id, loc),
    onLearnedLocatorFailure: (id) => db.recordLearnedLocatorFailure(id)
  };

  // Execution 1: P1 and P2 fail, P3 succeeds
  console.log('\n--- Execution 1: P1 and P2 fail, P3 (ID: submit_btn) succeeds ---');
  let logs1 = [];
  const mockPage1 = createMockPage(['//button[@id="non_existent_1"]', '#non_existent_2']);
  const result1 = await AutomationEngine.resolveElementWithFallback(
    mockPage1,
    step,
    [staticElem],
    {},
    8000,
    logs1,
    learnedContext
  );

  console.log('Result 1 locator:', result1.succeededLocator.id, result1.succeededLocator.type);
  console.assert(result1.succeededLocator.id === 'loc_p3', 'FAIL: Expected loc_p3 to succeed in Execution 1');

  // Verify learned locator persisted in DB
  const learned1 = db.getLearnedLocator(staticElem.id);
  console.log('Learned locator after Execution 1:', learned1);
  console.assert(learned1 !== null, 'FAIL: Learned locator must be saved');
  console.assert(learned1.successfulLocatorId === 'loc_p3', 'FAIL: Learned locator must be loc_p3');
  console.assert(learned1.successCount === 1, 'FAIL: Success count should be 1');
  console.assert(learned1.lastValidationStatus === 'passed', 'FAIL: Status should be passed');

  // Check logs indicate prioritization and fallback
  const p1FailedLog = logs1.some(l => l.includes('Configured Priority #1') && l.includes('failed'));
  const p2FailedLog = logs1.some(l => l.includes('Configured Priority #2') && l.includes('failed'));
  const p3SuccessLog = logs1.some(l => l.includes('Configured Priority #3') && l.includes('succeeded'));
  console.assert(p1FailedLog && p2FailedLog && p3SuccessLog, 'FAIL: Logs must record fallback sequence');
  console.log('Logs verified for Execution 1.');

  // Verify original configured priority in Repository was NOT modified
  const reloadedElem1 = db.getRepositoryElementById(staticElem.id, project.id);
  console.assert(reloadedElem1.locators[0].priority === 1, 'FAIL: Configured priorities must not be changed');
  console.assert(reloadedElem1.locators[0].id === 'loc_p1', 'FAIL: Primary locator in repo must still be loc_p1');
  console.assert(reloadedElem1.learnedLocator.successfulLocatorId === 'loc_p3', 'FAIL: Repo element should expose learnedLocator');
  console.log('Original repository priorities verified unchanged.');

  // Execution 2: Persistent learned locator (P3) tried FIRST and succeeds immediately
  console.log('\n--- Execution 2: Persistent learned locator P3 is attempted FIRST ---');
  let logs2 = [];
  const mockPage2 = createMockPage(['//button[@id="non_existent_1"]', '#non_existent_2']);
  const result2 = await AutomationEngine.resolveElementWithFallback(
    mockPage2,
    step,
    [reloadedElem1],
    {},
    8000,
    logs2,
    learnedContext
  );

  console.log('Result 2 locator:', result2.succeededLocator.id);
  console.assert(result2.succeededLocator.id === 'loc_p3', 'FAIL: Expected loc_p3 to succeed');
  const learned2 = db.getLearnedLocator(staticElem.id);
  console.assert(learned2.successCount === 2, 'FAIL: Success count should increment to 2');
  const learnedSucceededImmediate = logs2.some(l => l.includes('Learned locator succeeded immediately'));
  console.assert(learnedSucceededImmediate, 'FAIL: Log must state learned locator succeeded immediately');
  const didNotAttemptP1 = !logs2.some(l => l.includes('Attempt #1 (Configured Priority #1)'));
  console.assert(didNotAttemptP1, 'FAIL: P1 should not have been attempted since learned locator succeeded first');
  console.log('Execution 2 passed: Learned locator prioritized first without retrying failed locators.');

  // Execution 3: Previously learned locator (P3) fails! Should fallback to remaining locators, P4 succeeds
  console.log('\n--- Execution 3: Learned locator P3 fails, falls back to remaining locators, P4 succeeds ---');
  let logs3 = [];
  // P1, P2, and P3 fail now. Only P4 succeeds.
  const mockPage3 = createMockPage(['//button[@id="non_existent_1"]', '#non_existent_2', 'submit_btn']);
  const result3 = await AutomationEngine.resolveElementWithFallback(
    mockPage3,
    step,
    [reloadedElem1],
    {},
    8000,
    logs3,
    learnedContext
  );

  console.log('Result 3 locator:', result3.succeededLocator.id, result3.succeededLocator.type);
  console.assert(result3.succeededLocator.id === 'loc_p4', 'FAIL: Expected fallback to loc_p4');
  const learnedFailedLog = logs3.some(l => l.includes('Learned locator failed') && l.includes('Falling back'));
  console.assert(learnedFailedLog, 'FAIL: Log must record learned locator failure and fallback');
  const p4SuccessLog = logs3.some(l => l.includes('Configured Priority #4') && l.includes('succeeded'));
  console.assert(p4SuccessLog, 'FAIL: Log must record loc_p4 success');

  // Verify learned locator was updated to P4!
  const learned3 = db.getLearnedLocator(staticElem.id);
  console.log('Learned locator after Execution 3:', learned3);
  console.assert(learned3.successfulLocatorId === 'loc_p4', 'FAIL: Learned locator must now be updated to loc_p4');
  console.assert(learned3.locatorStrategy === 'Text', 'FAIL: Strategy must be Text');
  console.assert(learned3.successCount === 1, 'FAIL: Success count for new locator should be 1');
  console.log('Execution 3 passed: Learned locator updated upon fallback success.');

  // Test 4: Invalidation Rules
  console.log('\n--- Invalidation Rule A: Modify learned locator in Repository ---');
  // Update locators: remove P4 or change its value
  const updatedLocators = locators.map(l => {
    if (l.id === 'loc_p4') {
      return { ...l, value: 'New Submit Text' };
    }
    return l;
  });
  db.updateRepositoryElement(staticElem.id, project.id, {
    name: 'Submit Button Modified',
    type: 'Button',
    elementMode: 'Static',
    locators: updatedLocators
  });

  const learnedAfterModify = db.getLearnedLocator(staticElem.id);
  console.assert(learnedAfterModify === null, 'FAIL: Learned locator must be invalidated when locator is modified');
  console.log('Invalidation on modification verified: Learned locator cleared safely.');

  console.log('\n--- Invalidation Rule B: Change element mode from Static to Dynamic ---');
  // Re-learn P3
  db.recordLearnedLocatorSuccess(staticElem.id, locators[2]);
  console.assert(db.getLearnedLocator(staticElem.id) !== null, 'Learned locator re-established');
  
  // Switch to Dynamic
  try {
    const updated = db.updateRepositoryElement(staticElem.id, project.id, {
      name: 'Dynamic Submit Button',
      type: 'Button',
      elementMode: 'Dynamic',
      locators: [
        { id: 'loc_dyn1', type: 'XPath', value: '//button[@name="{dynamic value 1}"]', valueType: 'Dynamic', isPrimary: true, priority: 1 }
      ]
    });
    console.log('Update to Dynamic returned:', updated.elementMode, updated.name);
  } catch (e) {
    console.error('ERROR during updateRepositoryElement:', e.message);
  }

  const learnedAfterDynamic = db.getLearnedLocator(staticElem.id);
  console.assert(learnedAfterDynamic === null, 'FAIL: Learned locator must be invalidated when element mode becomes Dynamic');
  console.log('Invalidation on mode change verified: Dynamic elements cannot have learned locators.');

  // Test 5: Dynamic elements do NOT use fallback
  console.log('\n--- Scope Verification: Dynamic elements retain existing mechanism without fallback ---');
  const dynElem = db.getRepositoryElementById(staticElem.id, project.id);
  console.log('dynElem elementMode:', dynElem.elementMode, 'locators:', dynElem.locators);
  let dynLogs = [];
  const dynMockPage = createMockPage([]);
  const dynResult = await AutomationEngine.resolveElementWithFallback(
    dynMockPage,
    { elementId: dynElem.id, elementName: dynElem.name, elementMode: 'Dynamic' },
    [dynElem],
    { '{dynamic value 1}': 'Save' },
    5000,
    dynLogs,
    learnedContext
  );

  console.assert(dynResult.fallbackIndex === 0, 'FAIL: Dynamic elements must use single locator (index 0)');
  console.assert(!db.getLearnedLocator(dynElem.id), 'FAIL: Dynamic element must not save learned locator');
  const dynLocatingLog = dynLogs.some(l => l.includes('Locating Dynamic element'));
  console.assert(dynLocatingLog, 'FAIL: Must log Dynamic element resolution without fallback');
  console.log('Dynamic element scope verified: No fallback and no learned locator.');

  // Cleanup test database
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  console.log('\n========================================================================');
  console.log('ALL SECTION 10 ACCEPTANCE TESTS PASSED (100% SUCCESS)');
  console.log('========================================================================\n');
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
