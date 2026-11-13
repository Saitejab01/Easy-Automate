/**
 * Test Suite: Dynamic Repository Elements, Runtime Value Substitution & Application-Wide Synchronization
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const {
  getNextAvailablePlaceholder,
  getNextAvailablePlaceholderNumber,
  parseDynamicPlaceholders,
  resolveDynamicPlaceholders,
  validateDynamicPlaceholders,
  isDynamicPlaceholder
} = require('./dist-electron/dynamicPlaceholder');

const { JsonDatabase } = require('./dist-electron/database');
const { AutomationEngine } = require('./dist-electron/engine/automationEngine');

async function runTests() {
  console.log('===================================================================');
  console.log(' Testing Dynamic Repository Elements & Application-Wide Auto-Sync ');
  console.log('===================================================================\n');

  // --- 1. Parser and Gap-Filling Unit Tests ---
  console.log('--- 1. Testing Dynamic Placeholder Gap-Filling Logic (Section 3.2) ---');

  // Gap filling: [1, 3] -> 2
  const locatorsWithGap = [
    { value: "//div[@id='{dynamic value 1}']" },
    { value: "//div[@data-ref='{dynamic value 3}']" }
  ];
  const nextNum = getNextAvailablePlaceholderNumber(locatorsWithGap);
  assert.strictEqual(nextNum, 2, 'Gap-filling must suggest 2 when 1 and 3 are present');
  console.log('✓ Gap-filling properly suggested {dynamic value 2} when 1 and 3 are present');

  // Full sequential: [1, 2, 3] -> 4
  const locatorsSequential = [
    { value: "//button[@id='{dynamic value 1}']" },
    { value: "//button[@name='{dynamic value 2}'] and [@data-idx='{dynamic value 3}']" }
  ];
  assert.strictEqual(getNextAvailablePlaceholderNumber(locatorsSequential), 4, 'Sequential must suggest 4');
  console.log('✓ Sequential suggestion properly suggested {dynamic value 4}');

  // Empty: [] -> 1
  assert.strictEqual(getNextAvailablePlaceholderNumber([]), 1, 'Empty locators must suggest 1');
  assert.strictEqual(getNextAvailablePlaceholder([]), '{dynamic value 1}');
  console.log('✓ Empty locators properly initialized to {dynamic value 1}');

  // --- 2. Element Mode Isolation & Static Curly Braces Verbatim ---
  console.log('\n--- 2. Testing Static vs Dynamic Element Mode Isolation (Section 2 & 4) ---');

  const staticLocator = "//input[@data-action='{loginButton}' and @id='user_{id}']";
  const staticResolved = resolveDynamicPlaceholders(staticLocator, 'Static', {
    '{loginButton}': 'replaced',
    '{id}': '123'
  }).resolvedValue;
  assert.strictEqual(staticResolved, staticLocator, 'Static elements must NEVER substitute curly braces');
  console.log('✓ Static element preserved curly braces verbatim without any substitution');

  const dynamicLocator = "//div[@id='{dynamic value 1}']//span[text()='{dynamic value 2}']";
  const dynamicResolved = resolveDynamicPlaceholders(dynamicLocator, 'Dynamic', {
    '{dynamic value 1}': 'card_container',
    '{dynamic value 2}': 'Save Changes'
  }).resolvedValue;
  assert.strictEqual(
    dynamicResolved,
    "//div[@id='card_container']//span[text()='Save Changes']",
    'Dynamic elements must substitute recognized dynamic placeholders'
  );
  console.log('✓ Dynamic element properly substituted recognized placeholders');

  // Shared occurrence resolution
  const sharedLocator = "//input[@name='{dynamic value 1}' and @aria-label='{dynamic value 1}']";
  const sharedResolved = resolveDynamicPlaceholders(sharedLocator, 'Dynamic', {
    '{dynamic value 1}': 'item_code'
  }).resolvedValue;
  assert.strictEqual(
    sharedResolved,
    "//input[@name='item_code' and @aria-label='item_code']",
    'Shared occurrences must resolve to the exact same value'
  );
  console.log('✓ Multiple occurrences of same placeholder resolved to identical value');

  // --- 3. Missing Runtime Value Validation (Section 6.2) ---
  console.log('\n--- 3. Testing Missing Runtime Value Validation & Error Reporting ---');

  const missingValCheck = validateDynamicPlaceholders(
    "//button[@id='{dynamic value 1}' and @data-tier='{dynamic value 2}']",
    'Dynamic',
    { '{dynamic value 1}': 'btn_active' }
  );
  assert.strictEqual(missingValCheck.isValid, false, 'Missing dynamic value 2 must fail validation');
  assert(
    missingValCheck.errorMessage.includes('Missing runtime value for {dynamic value 2}'),
    'Error message must state missing placeholder name'
  );
  console.log(`✓ Missing value blocked execution with message: "${missingValCheck.errorMessage}"`);

  // Static mode validation always passes regardless of curly braces
  const staticValCheck = validateDynamicPlaceholders("//button[@id='{loginButton}']", 'Static', {});
  assert.strictEqual(staticValCheck.isValid, true, 'Static mode with curly braces must pass validation');
  console.log('✓ Static mode with curly braces passed validation without requiring values');

  // --- 4. Database CRUD, Versioning, and Auto-Synchronization ---
  console.log('\n--- 4. Testing Application-Wide Auto-Synchronization & Dependency Protection ---');

  const db = new JsonDatabase();
  await db.load();

  const userId = 'user_default_01';
  const project = db.createProject(userId, {
    name: 'Sync Test Project ' + Date.now(),
    description: 'Testing auto synchronization',
    environment: 'staging',
    defaultBrowser: 'chromium'
  });
  const projectId = project.id;

  const pageRes = db.createRepositoryPage(projectId, 'Dashboard Page');
  const pageId = pageRes.id;

  // Create Dynamic Repository Element
  const elementRes = db.createRepositoryElement(projectId, pageId, {
    name: 'Product Card',
    type: 'Custom',
    elementMode: 'Dynamic',
    description: 'Dynamic grid card',
    locators: [
      {
        id: 'loc_dyn_1',
        type: 'XPath',
        value: "//div[@data-sku='{dynamic value 1}']//button[@class='{dynamic value 2}']",
        valueType: 'Dynamic',
        isPrimary: true,
        priority: 1
      }
    ]
  });

  assert.strictEqual(elementRes.elementMode, 'Dynamic', 'Element mode must be Dynamic');
  assert.strictEqual(elementRes.version, 1, 'Initial element version must be 1');
  console.log(`✓ Created Dynamic Repository Element: "${elementRes.name}" with mode=${elementRes.elementMode}, version=${elementRes.version}`);

  // Create Module and Script that depends on this element
  const moduleRes = db.createScriptModule(projectId, 'Orders Module');

  const scriptRes = db.createScript(
    projectId,
    moduleRes.id,
    'Add Dynamic Product to Cart',
    'Demo User',
    'Script with dynamic element dependency'
  );

  // Add step referencing the dynamic element
  db.addScriptStep(scriptRes.id, projectId, {
    nlpId: 'click_on_element',
    nlpName: 'Click On Element',
    nlpCategory: 'Action NLPs',
    elementId: elementRes.id,
    elementName: elementRes.name,
    pageName: 'Dashboard Page',
    locator: elementRes.locators[0],
    parameters: {
      dynamicValues: {
        '{dynamic value 1}': 'SKU_9942',
        '{dynamic value 2}': 'btn-buy'
      }
    }
  });

  console.log('✓ Created Automation Script with step referencing the Dynamic Element');

  // Verify dependency check
  const depCheck = db.checkElementDependencies(elementRes.id, projectId);
  assert.strictEqual(depCheck.hasDependencies, true, 'Dependency check must find dependent script');
  assert.strictEqual(depCheck.dependentScripts.length, 1);
  assert.strictEqual(depCheck.dependentScripts[0].name, 'Add Dynamic Product to Cart');
  console.log(`✓ Dependency check correctly detected script: "${depCheck.dependentScripts[0].name}" (Step 1)`);

  // Attempt delete without force must fail and protect script
  let deleteBlocked = false;
  try {
    db.deleteRepositoryElement(elementRes.id, projectId, false);
  } catch (err) {
    deleteBlocked = true;
    assert(err.hasDependencies, 'Error must indicate dependencies');
    assert(err.message.includes('Cannot delete element'), 'Error message must warn about active dependencies');
  }
  assert.strictEqual(deleteBlocked, true, 'Deleting element with dependencies without force must be blocked');
  console.log('✓ Deletion Protection successfully prevented accidental deletion of referenced element');

  // Update Element (Rename and update locator template)
  const updatedElem = db.updateRepositoryElement(elementRes.id, projectId, {
    name: 'Renamed Product Card',
    type: 'Custom',
    elementMode: 'Dynamic',
    locators: [
      {
        id: 'loc_dyn_1',
        type: 'XPath',
        value: "//div[@data-prod='{dynamic value 1}']//a[@class='{dynamic value 2}']",
        valueType: 'Dynamic',
        isPrimary: true,
        priority: 1
      }
    ]
  });

  assert.strictEqual(updatedElem.version, 2, 'Element version must increment to 2');
  console.log(`✓ Updated Element to "${updatedElem.name}", version incremented to v${updatedElem.version}`);

  // Verify automatic propagation to dependent script steps (Section 8.1)
  const reloadedScript = db.getScriptById(scriptRes.id, projectId);
  const updatedStep = reloadedScript.steps[0];
  assert.strictEqual(updatedStep.elementName, 'Renamed Product Card', 'Step elementName must auto-sync');
  assert.strictEqual(updatedStep.locator.value, updatedElem.locators[0].value, 'Step locator template must auto-sync');
  assert.strictEqual(updatedStep.elementVersion, 2, 'Step elementVersion must auto-sync to 2');
  console.log('✓ Automatic Synchronization verified: dependent step received updated elementName, locator, and elementVersion');

  // Force delete archives reference without deleting script (Section 8.1)
  db.deleteRepositoryElement(elementRes.id, projectId, true);
  const scriptAfterDelete = db.getScriptById(scriptRes.id, projectId);
  assert(scriptAfterDelete, 'Script must NOT be deleted when element is deleted');
  console.log('Script step elementName after delete:', scriptAfterDelete.steps[0].elementName);
  assert(scriptAfterDelete.steps[0].elementName.includes('(Archived'), 'Step element name marked archived');
  console.log('✓ Force deletion safely preserved script and marked referenced element as (Archived)');

  // Clean up test project
  db.deleteProject(projectId, userId);
  console.log('✓ Test project cleaned up');

  console.log('\n===================================================================');
  console.log(' ALL DYNAMIC ELEMENT & AUTO-SYNC TESTS PASSED! (100% SUCCESS)       ');
  console.log('===================================================================');
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
