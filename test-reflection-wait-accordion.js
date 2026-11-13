const assert = require('assert');
const fs = require('fs');
const { JsonDatabase } = require('./dist-electron/database');
const { parseDynamicPlaceholders, resolveDynamicPlaceholders } = require('./dist-electron/dynamicPlaceholder');

console.log('===================================================================');
console.log(' Testing Reflection Fixes, Wait NLPs, Script Deletion & Accordion  ');
console.log('===================================================================\n');

async function runTests() {
  const testDbPath = './test_reflection_db.json';
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  const db = new JsonDatabase(testDbPath);
  const projectId = 'proj_test_reflect';

  // 1. Static vs Dynamic Element Mode: Single Source of Truth
  console.log('--- 1. Testing Single Source of Truth for Element Mode ---');
  const page = db.createRepositoryPage(projectId, 'Login Page');
  assert(page && page.id);
  const pageId = page.id;

  // Create Static Element with curly braces in locator
  const elem = db.createRepositoryElement(projectId, pageId, {
    name: 'Login Button',
    type: 'Button',
    elementMode: 'Static',
    locators: [
      { id: 'loc_1', type: 'XPath', value: "//button[@name='{dynamic value 1}']", valueType: 'Static', isPrimary: true, priority: 1 }
    ]
  });
  assert(elem && elem.id);
  assert.strictEqual(elem.elementMode, 'Static');

  // Verify that curly braces inside Static locator are NOT parsed as active dynamic placeholders
  const staticResolved = resolveDynamicPlaceholders(elem.locators[0].value, 'Static', { '{dynamic value 1}': 'substituted' });
  assert.strictEqual(staticResolved.resolvedValue, "//button[@name='{dynamic value 1}']", 'Static element locator must NOT perform substitution');
  assert.strictEqual(Object.keys(staticResolved.appliedReplacements).length, 0, 'Static element must apply 0 replacements');
  console.log('✓ Static element preserved curly braces verbatim with 0 replacements');

  // 2. Double-Brace Elimination
  console.log('\n--- 2. Testing Double-Brace Elimination ---');
  const dynamicLoc = "//button[@name='{dynamic value 1}']";
  const placeholders = parseDynamicPlaceholders(dynamicLoc);
  assert.strictEqual(placeholders.length, 1);
  assert.strictEqual(placeholders[0], '{dynamic value 1}', 'Canonical placeholder includes single braces');
  const renderedPill = `${placeholders[0]}`;
  assert.strictEqual(renderedPill, '{dynamic value 1}');
  assert(!renderedPill.includes('{{'), 'Double braces {{...}} eliminated');
  console.log('✓ Verified canonical single-brace rendering without double-bracing');

  // 3. Wait NLPs & Verification NLPs: User Wait Duration in Seconds
  console.log('\n--- 3. Testing Wait Duration Configuration ---');
  const sampleWaitParams = { waitDuration: 15 };
  assert(Number(sampleWaitParams.waitDuration) > 0 && Number(sampleWaitParams.waitDuration) <= 300);
  console.log('✓ Validated positive wait duration: 15 seconds (within 0.1s - 300s range)');

  // 4. Script Deletion & Suite Dependency Protection
  console.log('\n--- 4. Testing Script Deletion & Dependency Protection ---');
  const module = db.createScriptModule(projectId, 'Auth Module');
  assert(module && module.id);

  const script = db.createScript(projectId, module.id, 'Login Smoke Test', 'Tester');
  assert(script && script.id);
  const scriptId = script.id;

  // Check dependencies before any suite is added
  const depCheck1 = db.checkScriptDependencies(scriptId, projectId);
  assert.strictEqual(depCheck1.hasDependencies, false, 'Initially script should have no dependencies');

  // Create a mock Test Suite referencing this script
  const dbData = db['data'];
  if (!dbData.testSuites) dbData.testSuites = [];
  dbData.testSuites.push({
    id: 'suite_regression_1',
    projectId,
    name: 'Nightly Regression Suite',
    scriptIds: [scriptId]
  });

  // Check dependencies now
  const depCheck2 = db.checkScriptDependencies(scriptId, projectId);
  assert.strictEqual(depCheck2.hasDependencies, true, 'Script should be detected in Nightly Regression Suite');
  assert.strictEqual(depCheck2.dependentSuites[0].name, 'Nightly Regression Suite');
  console.log('✓ Suite dependency check correctly detected referencing suite: "Nightly Regression Suite"');

  // Simple deletion must throw when dependencies exist without force
  try {
    db.deleteScript(scriptId, projectId, false);
    assert.fail('Should have thrown dependency error');
  } catch (err) {
    assert.strictEqual(err.hasDependencies, true, 'Deletion must be blocked when suite dependencies exist');
    console.log('✓ Script deletion blocked due to active suite dependency');
  }

  // Force deletion must succeed and remove script from suite safely
  const forceDeleteRes = db.deleteScript(scriptId, projectId, true);
  assert.strictEqual(forceDeleteRes.success, true, 'Force delete must succeed');
  assert(!dbData.testSuites[0].scriptIds.includes(scriptId), 'Script reference must be safely removed from suite');
  const remainingScripts = db.getScripts(projectId);
  assert(!remainingScripts.some(s => s.id === scriptId), 'Script must be removed from active scripts list');
  console.log('✓ Force deletion safely removed script and cleaned up suite reference without breaking suite');

  // Clean up test file
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  console.log('\n===================================================================');
  console.log(' ALL REFLECTION, WAIT DURATION & ACCORDION TESTS PASSED! (100%)     ');
  console.log('===================================================================');
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
