const { JsonDatabase } = require('./dist-electron/database.js');
const { AutomationEngine } = require('./dist-electron/engine/automationEngine.js');
const assert = require('assert');

async function runTests() {
  console.log('=== TEST 1: Deleting modules and creating a new module ===');
  const testDbPath = './easy_automate_db_test.json';
  const fs = require('fs');
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  const db = new JsonDatabase(testDbPath);
  const projectId = 'proj_ecommerce_01';

  // 1. Check initial seeded modules
  const initialModules = db.getScriptModules(projectId);
  console.log(`Initial modules count: ${initialModules.length}`);
  assert(initialModules.length > 0, 'Initial modules should be seeded once');

  // 2. Delete all modules
  console.log('Deleting all modules for project...');
  for (const mod of [...initialModules]) {
    try {
      db.deleteScriptModule(mod.id, projectId);
    } catch (e) {
      // descendant might have already been deleted
    }
  }

  const remainingAfterDelete = db.getScriptModules(projectId);
  console.log(`Modules after full deletion: ${remainingAfterDelete.length}`);
  assert.strictEqual(remainingAfterDelete.length, 0, 'All modules should be deleted');

  // 3. Test re-instantiation does NOT re-seed deleted modules
  const reloadedDb = new JsonDatabase(testDbPath);
  const modulesAfterReload = reloadedDb.getScriptModules(projectId);
  console.log(`Modules after database reload: ${modulesAfterReload.length}`);
  assert.strictEqual(modulesAfterReload.length, 0, 'Modules should STAY deleted and not re-seed silently');

  // 4. Test creating a new module with name (e.g. "Customer Auth Module")
  console.log('Creating new module after deletion...');
  const newMod = reloadedDb.createScriptModule(projectId, 'Customer Auth Module', null);
  console.log(`Created new module successfully: id=${newMod.id}, name="${newMod.name}"`);
  assert.strictEqual(newMod.name, 'Customer Auth Module');

  // 5. Test creating a submodule under the new module
  const subMod = reloadedDb.createScriptModule(projectId, 'Email Verification', newMod.id);
  console.log(`Created submodule: id=${subMod.id}, name="${subMod.name}", parentId=${subMod.parentId}`);
  assert.strictEqual(subMod.parentId, newMod.id);

  console.log('Module creation after deletion PASSED 100%!\n');

  console.log('=== TEST 2: Real Playwright Execution with NLP Mapping ===');
  // Create a script with real Playwright steps
  const script = reloadedDb.createScript(projectId, subMod.id, 'Verify Storefront Elements', 'test@user.dev', 'Smoke test');
  console.log(`Created script: ${script.id}`);

  // Step 1: Open browser / Navigate
  reloadedDb.addScriptStep(script.id, projectId, {
    nlpId: 'open_browser',
    nlpName: 'Open Browser',
    nlpCategory: 'Browser',
    description: 'Launch browser and open demo storefront page',
    parameters: { url: 'data:text/html,<html><head><title>Test Storefront</title></head><body><h1>Welcome to Easy Automate Storefront</h1><input id="email" placeholder="Enter email"/><button id="submitBtn">Submit</button></body></html>' },
    isEnabled: true
  });

  // Step 2: Enter Text
  reloadedDb.addScriptStep(script.id, projectId, {
    nlpId: 'enter_text',
    nlpName: 'Enter Text',
    nlpCategory: 'Browser Action',
    description: 'Type customer email into input field',
    locator: { type: 'ID', value: 'email', valueType: 'Static' },
    elementName: 'Email Input',
    parameters: { text: 'customer@demo.com' },
    isEnabled: true
  });

  // Step 3: Verify Element
  reloadedDb.addScriptStep(script.id, projectId, {
    nlpId: 'verify_element_is_displayed',
    nlpName: 'Verify Element Is Displayed',
    nlpCategory: 'Verification',
    description: 'Verify Submit Button is visible',
    locator: { type: 'ID', value: 'submitBtn', valueType: 'Static' },
    elementName: 'Submit Button',
    parameters: {},
    isEnabled: true
  });

  // Step 4: Verify Page Title
  reloadedDb.addScriptStep(script.id, projectId, {
    nlpId: 'verify_page_title',
    nlpName: 'Verify Page Title',
    nlpCategory: 'Verification',
    description: 'Verify title contains Test Storefront',
    parameters: { expectedTitle: 'Test Storefront' },
    isEnabled: true
  });

  // Step 5: Static Wait
  reloadedDb.addScriptStep(script.id, projectId, {
    nlpId: 'static_wait',
    nlpName: 'Static Wait',
    nlpCategory: 'Wait',
    description: 'Wait 500ms',
    parameters: { durationMs: 500 },
    isEnabled: true
  });

  console.log('Triggering execution (Run)...');
  const execution = await reloadedDb.executeScript(projectId, script.id, {
    browser: 'chromium',
    delayBetweenStepsMs: 200,
    globalWaitTimeMs: 5000,
    executionTimeoutSec: 30,
    screenshotOption: 'every-step',
    screenRecording: false
  });

  console.log(`Execution completed! ID: ${execution.id}`);
  console.log(`Execution Status: ${execution.status}`);
  console.log(`Execution Duration: ${execution.durationSeconds}s`);
  console.log(`Total Steps Executed: ${execution.scripts[0].steps.length}`);
  
  for (const step of execution.scripts[0].steps) {
    console.log(` - Step ${step.stepNumber}: ${step.nlpName} -> ${step.status} (${step.durationSeconds}s) Screenshot length: ${step.screenshot ? step.screenshot.length : 0}`);
    assert.strictEqual(step.status, 'Passed');
    assert(step.screenshot, 'Screenshot should be captured');
  }

  assert.strictEqual(execution.status, 'Passed');
  assert(execution.scripts[0].generatedPlaywrightCode, 'Internal Playwright TypeScript code should be generated');
  console.log('\n--- Generated Playwright TypeScript Code Sample ---');
  console.log(execution.scripts[0].generatedPlaywrightCode.split('\n').slice(0, 25).join('\n') + '\n...');

  // Clean up test db
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  console.log('\nALL VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
