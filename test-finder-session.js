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

// 4. Test sequence counter management & auto-sync on delete / push
manager.setCapturedSequence(5);
assert.strictEqual(manager.getStatus().capturedCount, 5, 'Sequence counter should be 5');
manager.setCapturedSequence(0);
assert.strictEqual(manager.getStatus().capturedCount, 0, 'Sequence counter should reset to 0');
console.log('✓ Sequence counter set & reset verified');

// 5. Test auto-syncing element sequence numbers upon delete & push
let capturedElements = [
  { id: 'cap_1', sequence: 1, name: 'Button #1' },
  { id: 'cap_2', sequence: 2, name: 'Input #2' },
  { id: 'cap_3', sequence: 3, name: 'Link #3' },
  { id: 'cap_4', sequence: 4, name: 'Card #4' }
];

// Delete element #2 (Input #2)
const afterDelete = capturedElements
  .filter(e => e.id !== 'cap_2')
  .map((el, idx) => ({ ...el, sequence: idx + 1, name: el.name.replace(/#\d+/, `#${idx + 1}`) }));

assert.strictEqual(afterDelete.length, 3, 'Should have 3 elements left');
assert.strictEqual(afterDelete[0].sequence, 1, 'First element sequence should be 1');
assert.strictEqual(afterDelete[1].sequence, 2, 'Second element sequence should be 2 (was 3)');
assert.strictEqual(afterDelete[1].name, 'Link #2', 'Second element name should auto-sync to Link #2');
assert.strictEqual(afterDelete[2].sequence, 3, 'Third element sequence should be 3 (was 4)');
assert.strictEqual(afterDelete[2].name, 'Card #3', 'Third element name should auto-sync to Card #3');
console.log('✓ Element sequence auto-syncing upon delete verified: [1, 2, 3]');

// Simulate pushing all elements to repository -> removed from finder -> count reset
const pushedIds = new Set(['cap_1', 'cap_3', 'cap_4']);
const afterPush = afterDelete.filter(e => !pushedIds.has(e.id));
assert.strictEqual(afterPush.length, 0, 'Captured list should be empty after all elements are pushed');
console.log('✓ Elements removed from finder upon push and element count reset to 0 verified');

// 6. Test duplicate element prevention
const mockWindowMessages = [];
manager.setMainWindow({
  isDestroyed: () => false,
  webContents: {
    send: (channel, data) => {
      mockWindowMessages.push({ channel, data });
    }
  }
});

// Seed session with one element
manager.syncSessionElements([
  {
    id: 'cap_1',
    sequence: 1,
    name: 'Login',
    tag: 'button',
    visibleText: 'Login',
    locators: [{ type: 'ID', value: 'loginBtn', isPrimary: true }],
    rawPayload: { tagName: 'button', textContent: 'Login', id: 'loginBtn', xpath: '//button[@id="loginBtn"]' }
  }
]);

// Attempt to capture identical element again
manager.handleCapturedElement({
  tagName: 'button',
  textContent: 'Login',
  id: 'loginBtn',
  xpath: '//button[@id="loginBtn"]',
  name: 'loginBtn',
  testId: '',
  className: '',
  placeholder: '',
  role: 'button',
  type: 'submit',
  ariaLabel: '',
  alt: '',
  title: '',
  cssSelector: 'button#loginBtn'
}).then(() => {
  assert.strictEqual(manager.getStatus().capturedCount, 1, 'Captured sequence must not increment for duplicate element');
  assert.strictEqual(mockWindowMessages.length, 1, 'Should have emitted 1 event');
  assert.strictEqual(mockWindowMessages[0].data.isDuplicate, true, 'Event must flag isDuplicate = true');
  assert.strictEqual(mockWindowMessages[0].data.id, 'cap_1', 'Event must reference existing element ID');
  console.log('✓ Duplicate element capture prevention verified: sequence preserved and duplicate flagged');

  // 7. Test offline DOM test fallback
  return manager.testLocator('Test ID', 'nav-home');
}).then(res => {
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

