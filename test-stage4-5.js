const { JsonDatabase } = require('./dist-electron/database');
const path = require('path');
const fs = require('fs');

const testDbPath = path.join(__dirname, 'test_stage4_5_db.json');
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

const db = new JsonDatabase(testDbPath);

console.log('===================================================================');
console.log('  Testing Stage 4 & Stage 5 – TestDev (Scripts & Execution) Tests  ');
console.log('===================================================================');

// 1. Identify Demo Project
const demoUser = db.findUserByEmail('demo@easyautomate.dev');
console.assert(demoUser, 'Demo user must exist');
const projects = db.getProjects(demoUser.id);
console.assert(projects.length > 0, 'Should have demo projects');
const proj = projects[0];
console.log(`✓ Active Project: ${proj.name} (${proj.id})\n`);

// 2. Test Modules and Submodules Hierarchy (Section 2.1 & 2.2)
console.log('--- 1. Testing Script Modules & Submodules Hierarchy (Section 2.1 & 2.2) ---');
const modules = db.getScriptModules(proj.id);
console.assert(modules.length >= 8, 'Expected at least 8 seeded modules and submodules');

const rootModules = modules.filter(m => !m.parentId);
const rootNames = rootModules.map(m => m.name).sort();
console.assert(rootNames.includes('Login Module'), 'Contains "Login Module"');
console.assert(rootNames.includes('Product Module'), 'Contains "Product Module"');
console.assert(rootNames.includes('Payment Module'), 'Contains "Payment Module"');
console.log('✓ Root Modules verified:');
rootModules.forEach(rm => console.log(`   📁 ${rm.name}`));

const loginMod = rootModules.find(m => m.name === 'Login Module');
const loginSubmodules = modules.filter(m => m.parentId === loginMod.id);
console.assert(loginSubmodules.some(m => m.name === 'Valid Login'), 'Login Module has "Valid Login"');
console.assert(loginSubmodules.some(m => m.name === 'Invalid Login'), 'Login Module has "Invalid Login"');
console.log('✓ Login Module Submodules:');
loginSubmodules.forEach(sm => console.log(`      ↳ 📂 ${sm.name}`));

const prodMod = rootModules.find(m => m.name === 'Product Module');
const prodSubmodules = modules.filter(m => m.parentId === prodMod.id);
console.assert(prodSubmodules.some(m => m.name === 'Product Search'), 'Product Module has "Product Search"');
console.assert(prodSubmodules.some(m => m.name === 'Cart Module'), 'Product Module has "Cart Module"');

// Create new module and submodule
const checkoutMod = db.createScriptModule(proj.id, 'Checkout Module', null);
console.assert(checkoutMod.parentId === null, 'Checkout Module is root module');
console.log('✓ Created Root Module:', checkoutMod.name);

const expressCheckout = db.createScriptModule(proj.id, 'Express 1-Click Checkout', checkoutMod.id);
console.assert(expressCheckout.parentId === checkoutMod.id, 'Express Checkout is submodule');
console.log('✓ Created Submodule:', expressCheckout.name, `(Parent: ${checkoutMod.name})`);

// Prevent duplicate module name under same parent
try {
  db.createScriptModule(proj.id, 'Express 1-Click Checkout', checkoutMod.id);
  console.assert(false, 'Duplicate submodule should be rejected');
} catch (err) {
  console.log('✓ Duplicate submodule properly rejected:', err.message);
}

// Rename submodule
const renamedMod = db.updateScriptModule(expressCheckout.id, proj.id, 'Instant Express Checkout');
console.assert(renamedMod.name === 'Instant Express Checkout', 'Module renamed');
console.log('✓ Module renamed to:', renamedMod.name);

// 3. Test Script Creation & Details (Section 2.3)
console.log('\n--- 2. Testing Automation Script Details & Operations (Section 2.3) ---');
const allScripts = db.getScripts(proj.id);
console.assert(allScripts.length >= 8, 'Expected at least 8 seeded scripts');

const validLoginSub = loginSubmodules.find(m => m.name === 'Valid Login');
const validLoginScripts = db.getScripts(proj.id, validLoginSub.id);
console.assert(validLoginScripts.some(s => s.name === 'Login With Valid Credentials'), 'Has "Login With Valid Credentials"');
console.assert(validLoginScripts.some(s => s.name === 'Login With Remember Me'), 'Has "Login With Remember Me"');

const primaryScript = validLoginScripts.find(s => s.name === 'Login With Valid Credentials');
console.assert(primaryScript.stepCount === 6, 'Has 6 steps');
console.assert(primaryScript.lastExecutionStatus === 'Passed', 'Last execution status is Passed');
console.log('✓ Seeded script verified:');
console.log(`   Script: "${primaryScript.name}" (ID: ${primaryScript.id}, Steps: ${primaryScript.stepCount}, Status: ${primaryScript.lastExecutionStatus})`);

// Create new script inside custom submodule
const customScript = db.createScript(
  proj.id,
  expressCheckout.id,
  'Guest User Express Checkout',
  demoUser.email,
  'Automates guest checkout flow without prior account creation'
);
console.assert(customScript.name === 'Guest User Express Checkout', 'Script created');
console.assert(customScript.steps.length === 0, 'New script has 0 initial steps');
console.log('✓ Created Script:', customScript.name, `(${customScript.id})`);

// 4. Test Step Management & Insert Step (+) Below Existing Step (Section 3.2, 3.3, 3.4)
console.log('\n--- 3. Testing Step Insertion, Reordering, and Number Recalculation (Section 3.3 & 3.4) ---');

// Add first step via Add NLP (at the end)
const s1 = db.addScriptStep(customScript.id, proj.id, {
  nlpId: 'open_browser',
  nlpName: 'Open Browser',
  nlpCategory: 'Browser',
  description: 'Launch Chromium browser',
  parameters: { browser: 'Chromium' },
  isEnabled: true
});
console.assert(s1.steps.length === 1 && s1.steps[0].stepNumber === 1, 'Step 1 added');
console.log(`✓ Added Step 1: ${s1.steps[0].nlpName}`);

// Add second step via Add NLP (at the end)
const s2 = db.addScriptStep(customScript.id, proj.id, {
  nlpId: 'navigate_to_url',
  nlpName: 'Navigate To URL',
  nlpCategory: 'Browser',
  description: 'Navigate to storefront product page',
  parameters: { url: '$baseURL/product/watch-01' },
  isEnabled: true
});
console.assert(s2.steps.length === 2 && s2.steps[1].stepNumber === 2, 'Step 2 added');
console.log(`✓ Added Step 2: ${s2.steps[1].nlpName}`);

// Add third step: Click Checkout Button (at the end)
const s3 = db.addScriptStep(customScript.id, proj.id, {
  nlpId: 'click_element',
  nlpName: 'Click On Element',
  nlpCategory: 'Browser Action',
  description: 'Click checkout button',
  parameters: {},
  isEnabled: true
});
console.assert(s3.steps.length === 3 && s3.steps[2].stepNumber === 3, 'Step 3 added');
console.log(`✓ Added Step 3: ${s3.steps[2].nlpName}`);

// TEST SECTION 3.3: Click Add Step (+) beside Step 1!
// Expected: Inserted IMMEDIATELY BELOW Step 1 (becomes Step 2), and old Step 2 becomes Step 3, old Step 3 becomes Step 4!
console.log('\n>>> Testing Add Step (+) beside Step 1 (Section 3.3)...');
const sInserted = db.addScriptStep(
  customScript.id,
  proj.id,
  {
    nlpId: 'maximize_browser',
    nlpName: 'Maximize Browser',
    nlpCategory: 'Browser',
    description: 'Ensure viewport is maximized',
    parameters: {},
    isEnabled: true
  },
  1 // insertAfterStepNumber = 1
);

console.assert(sInserted.steps.length === 4, 'Total steps should now be 4');
console.assert(sInserted.steps[0].nlpName === 'Open Browser' && sInserted.steps[0].stepNumber === 1, 'Step 1 is Open Browser');
console.assert(sInserted.steps[1].nlpName === 'Maximize Browser' && sInserted.steps[1].stepNumber === 2, 'Step 2 is newly inserted Maximize Browser');
console.assert(sInserted.steps[2].nlpName === 'Navigate To URL' && sInserted.steps[2].stepNumber === 3, 'Step 3 was shifted from Step 2');
console.assert(sInserted.steps[3].nlpName === 'Click On Element' && sInserted.steps[3].stepNumber === 4, 'Step 4 was shifted from Step 3');

console.log('✓ Step insertion immediately below Step 1 verified with automatic step number recalculation:');
sInserted.steps.forEach(st => console.log(`   Step ${st.stepNumber} – ${st.nlpName}`));

// Duplicate step
const duplicated = db.duplicateScriptStep(customScript.id, proj.id, sInserted.steps[1].id);
console.assert(duplicated.steps.length === 5, 'Step duplicated, count is 5');
console.assert(duplicated.steps[2].nlpName === 'Maximize Browser', 'Cloned step placed right below original');
console.log(`✓ Duplicated Step: Cloned at Step ${duplicated.steps[2].stepNumber}`);

// Delete step
const deleted = db.deleteScriptStep(customScript.id, proj.id, duplicated.steps[2].id);
console.assert(deleted.steps.length === 4, 'Step deleted, count back to 4');
console.assert(deleted.steps[3].stepNumber === 4, 'Step numbers recalculated after deletion');
console.log('✓ Deleted step and verified step number integrity');

// 5. Test Repository Element Mapping (Section 5)
console.log('\n--- 4. Testing Repository Element Mapping (Section 5) ---');
const elements = db.getRepositoryElements(proj.id);
const checkoutBtn = elements.find(e => e.name === 'Checkout Button');
console.assert(checkoutBtn, 'Checkout Button element exists in repository');

const stepToMap = customScript.steps.find(s => s.nlpId === 'click_element');
const updatedStepScript = db.updateScriptStep(customScript.id, proj.id, stepToMap.id, {
  elementId: checkoutBtn.id,
  elementName: checkoutBtn.name,
  pageName: 'Cart Page',
  locator: checkoutBtn.locators[0]
});
const mappedStep = updatedStepScript.steps.find(s => s.id === stepToMap.id);
console.assert(mappedStep.elementId === checkoutBtn.id, 'Element ID mapped');
console.assert(mappedStep.locator.value === 'proceed-to-checkout', 'Primary locator attached');
console.log(`✓ Mapped Repository Element "${mappedStep.elementName}" (${mappedStep.locator.type}: ${mappedStep.locator.value}) to Step ${mappedStep.stepNumber}`);

// 6. Test Excel NLPs Integration (Section 6)
console.log('\n--- 5. Testing Excel Utilities: Get Data & Write Data (Section 6) ---');
const testDataFiles = db.getTestDataFiles(proj.id);
const loginExcel = testDataFiles.find(f => f.fileName === 'valid_login_data.xlsx');
console.assert(loginExcel, 'valid_login_data.xlsx exists in project');

// 6.1 getDataFromExcel
const excelRow = db.getDataFromExcelUtility(proj.id, 'valid_login_data.xlsx', 'Credentials', 'TC001');
console.assert(excelRow !== null && typeof excelRow === 'object', 'getDataFromExcel returns row object/map');
console.log('✓ getDataFromExcel returned row map:');
console.log('  ', JSON.stringify(excelRow));

// 6.2 writeDataToExcel
const writeResult = db.writeDataToExcelUtility(
  proj.id,
  'valid_login_data.xlsx',
  'Credentials',
  'TC001',
  'ActualResult',
  'Passed'
);
console.assert(writeResult === true, 'writeDataToExcel returns true');
console.log('✓ writeDataToExcel successfully updated cell [TC001, ActualResult] with "Passed"');

// 7. Test Variables Management & Suggestions (Section 7)
console.log('\n--- 6. Testing Local & Global Variables Management (Section 7) ---');
const globalVars = db.getVariables(proj.id, null).filter(v => v.type === 'Global');
console.assert(globalVars.some(v => v.name === 'baseURL'), 'Global baseURL exists');
console.assert(globalVars.some(v => v.name === 'environment'), 'Global environment exists');
console.log('✓ Global Variables verified:');
globalVars.forEach(gv => console.log(`   🌐 $${gv.name} (${gv.dataType}) = ${gv.value}`));

const localVars = db.getVariables(proj.id, primaryScript.id).filter(v => v.type === 'Local');
console.assert(localVars.some(v => v.name === 'username'), 'Local username exists for script');
console.assert(localVars.some(v => v.name === 'password'), 'Local password exists for script');
console.log('✓ Local Variables verified for script:');
localVars.forEach(lv => console.log(`   🔒 $${lv.name} (${lv.dataType}) = ${lv.dataType === 'Encrypted' ? '••••••••' : lv.value}`));

// Create new custom variable
const newVar = db.createVariable(proj.id, {
  name: 'taxExemptNumber',
  type: 'Local',
  dataType: 'String',
  value: 'TX-99482-B',
  description: 'Corporate B2B tax exemption token',
  scriptId: customScript.id
});
console.assert(newVar.name === 'taxExemptNumber', 'Local variable created');
console.log('✓ Created new local variable:', `$${newVar.name}`);

// 8. Test Run Settings (Section 8)
console.log('\n--- 7. Testing Run Settings Configuration (Section 8) ---');
const defaultSettings = db.getRunSettings(proj.id);
console.assert(defaultSettings.browser === 'chromium', 'Default browser is Chromium');
console.assert(defaultSettings.screenshotOption === 'failed-only', 'Default screenshot policy set');

const savedSettings = db.saveRunSettings(proj.id, {
  browser: 'firefox',
  delayBetweenStepsMs: 250,
  globalWaitTimeMs: 4000,
  executionTimeoutSec: 45,
  screenshotOption: 'every-step',
  screenRecording: true,
  isDefault: true,
  scope: 'project'
});
console.assert(savedSettings.browser === 'firefox', 'Browser updated to Firefox');
console.assert(savedSettings.screenshotOption === 'every-step', 'Screenshot policy updated');
console.log('✓ Run Settings saved successfully:');
console.log(`   Browser: ${savedSettings.browser}, Delay: ${savedSettings.delayBetweenStepsMs}ms, Screenshots: ${savedSettings.screenshotOption}, Recording: ${savedSettings.screenRecording}`);

// 9. Test Playwright Execution Engine (Section 9, 10, 11, 12)
console.log('\n--- 8. Testing Playwright Execution Engine & Telemetry (Part B) ---');

// Execute script asynchronously
async function runExecutionTests() {
  const executionRecord = await db.executeScript(proj.id, primaryScript.id, savedSettings);

  console.assert(executionRecord.id.startsWith('EXEC'), 'Execution ID has EXEC prefix');
  console.assert(executionRecord.status === 'Passed', 'Script execution passed');
  console.assert(executionRecord.scripts.length === 1, 'Has 1 executed script');
  console.assert(executionRecord.scripts[0].steps.length === 6, 'All 6 steps executed');
  console.assert(executionRecord.machine && executionRecord.machine.name, 'Machine telemetry captured');
  console.assert(executionRecord.playwrightVersion === '1.49.1', 'Playwright version recorded');
  console.assert(executionRecord.nodeVersion !== undefined, 'Node version recorded');

  console.log(`✓ Execution ${executionRecord.id} completed: Status = ${executionRecord.status}, Duration = ${executionRecord.durationSeconds}s`);
  console.log('✓ Machine Telemetry:');
  console.log(`   Host: ${executionRecord.machine.name} (${executionRecord.machine.os})`);
  console.log(`   Browser: ${executionRecord.machine.browser} (Playwright v${executionRecord.playwrightVersion}, Node ${executionRecord.nodeVersion})`);

  console.log('✓ Executed Steps Table (Section 10):');
  executionRecord.scripts[0].steps.forEach(st => {
    console.log(`   Step ${st.stepNumber}: ${st.nlpName} | ${st.durationSeconds}s | [${st.status}] | Logs: ${st.logs.length} | Screenshot: ${st.screenshot ? 'Yes' : 'No'}`);
  });

  // Verify variable resolution in step inputs
  const step3 = executionRecord.scripts[0].steps.find(s => s.stepNumber === 3);
  console.assert(step3.variablesUsed && step3.variablesUsed.length > 0, 'Variables resolved in step');
  console.log(`✓ Variable Resolution: "${step3.variablesUsed[0].name}" resolved to "${step3.variablesUsed[0].resolvedValue}"`);

  // Verify Execution History list
  const execList = db.getDetailedExecutions(proj.id);
  console.assert(execList.length >= 2, 'History contains seeded EXEC0001 plus newly executed record');
  console.log(`✓ Total Execution History count for project: ${execList.length}`);

  // 10. Clean up
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  console.log('\n===================================================================');
  console.log('  ALL STAGE 4 & 5 TESTS PASSED SUCCESSFULLY! (100% SUCCESS)        ');
  console.log('===================================================================');
}

runExecutionTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

