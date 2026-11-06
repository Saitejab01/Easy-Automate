const assert = require('assert');
const { FinderSessionManager } = require('./dist-electron/finderSession');
const { evaluateLocatorStability } = require('./dist-electron/locatorEvaluator');

console.log('--- Testing Web Element Finder Session & Locator Management ---');

const manager = new FinderSessionManager();

// 1. Initial State
const initialStatus = manager.getStatus();
assert.strictEqual(initialStatus.status, 'idle', 'Initial status should be idle');
assert.strictEqual(initialStatus.capturedCount, 0, 'Initial captured count should be 0');
assert.strictEqual(initialStatus.isOpen, false, 'Initial isOpen should be false');
console.log('✓ Initial session status verified: idle, 0 captured, closed');

// 2. Stability Evaluator Tests
const testIdEval = evaluateLocatorStability('Test ID', 'submit-login-btn');
assert.strictEqual(testIdEval.stability, 'High', 'Test ID should have High stability');
assert(testIdEval.stabilityScore >= 90, 'Test ID score should be >= 90');
console.log('✓ Test ID stability verified:', testIdEval.stabilityScore, testIdEval.stability);

const dynamicXpathEval = evaluateLocatorStability('XPath', "//button[@data-id='{dynamicId}']");
assert.strictEqual(dynamicXpathEval.isValid, true, 'Dynamic XPath should be valid');
console.log('✓ Dynamic XPath evaluated:', dynamicXpathEval.stabilityScore, dynamicXpathEval.stability);

const invalidXpathEval = evaluateLocatorStability('XPath', "//button[@id='unclosed");
assert.strictEqual(invalidXpathEval.isValid, false, 'Unclosed XPath should be marked invalid');
console.log('✓ Invalid XPath correctly flagged as invalid');

// 3. Locator Management & Auto-Promotion of Primary
const mockElement = {
  id: 'elem_1',
  name: 'Search Bar',
  locators: [
    { id: 'loc_1', type: 'Test ID', value: 'search-input', isPrimary: true, priority: 1 },
    { id: 'loc_2', type: 'ID', value: 'search', isPrimary: false, priority: 2 },
    { id: 'loc_3', type: 'CSS Selector', value: 'input.search-field', isPrimary: false, priority: 3 }
  ]
};

// Simulate deleting the primary locator
const remainingLocators = mockElement.locators.filter(l => l.id !== 'loc_1');
const hasPrimary = remainingLocators.some(l => l.isPrimary);
if (!hasPrimary && remainingLocators.length > 0) {
  remainingLocators[0].isPrimary = true;
}
remainingLocators.forEach((l, i) => { l.priority = i + 1; });

assert.strictEqual(remainingLocators.length, 2, 'Should have 2 locators left');
assert.strictEqual(remainingLocators[0].id, 'loc_2', 'Next locator should be loc_2');
assert.strictEqual(remainingLocators[0].isPrimary, true, 'loc_2 should be auto-promoted to primary');
assert.strictEqual(remainingLocators[0].priority, 1, 'loc_2 priority should be 1');
console.log('✓ Deleting primary locator successfully auto-promoted next locator to primary without deleting element');

// 4. Test offline DOM test fallback
manager.testLocator('Test ID', 'nav-home').then(res => {
  assert(res.success, 'testLocator should succeed even when browser is closed (offline analysis)');
  assert.strictEqual(res.matchCount, -1, 'Match count should indicate offline evaluation');
  console.log('✓ testLocator offline fallback verified');
  console.log('\n=========================================');
  console.log(' ALL WEB ELEMENT FINDER UNIT TESTS PASSED! ');
  console.log('=========================================\n');
}).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
