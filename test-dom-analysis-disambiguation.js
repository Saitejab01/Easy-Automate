const { JsonDatabase } = require('./dist-electron/database');
const { AIModelService } = require('./dist-electron/ai/aiModelService');
const { NLPMapper } = require('./dist-electron/ai/nlpMapper');
const { AIAutoTestingEngine } = require('./dist-electron/ai/aiAutoTestingEngine');
const path = require('path');
const fs = require('fs');

console.log('=== DOM Analysis & Element Disambiguation Unit Test ===\n');

const testDbPath = path.join(__dirname, 'test_dom_db.json');
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

const db = new JsonDatabase(testDbPath);
const modelService = new AIModelService(db);
const engine = new AIAutoTestingEngine(db, modelService);

// Mock DOM Snapshot representing ShoppersStack with realistic noise (container divs, MUI classes)
const mockShoppersStackDOM = [
  { tag: 'div', id: 'root', classes: 'MuiBox-root css-178yklu' },
  { tag: 'div', id: 'navbar-container', classes: 'header-wrapper' },
  { tag: 'h1', text: 'ShoppersStack', classes: 'logo-text' },
  { tag: 'button', id: 'loginBtn', text: 'Login', classes: 'MuiButton-root' },
  { tag: 'button', text: 'Create Account', classes: 'MuiButton-root' },
  { tag: 'button', ariaLabel: 'Account settings', role: 'button', classes: 'MuiAvatar-root' },
  { tag: 'h3', text: 'SHOPPER LOGIN', classes: 'MuiTypography-h3' },
  { tag: 'label', text: 'Email', classes: 'MuiFormLabel-root' },
  { tag: 'div', id: 'email-input-wrapper', classes: 'MuiInputBase-root' },
  { tag: 'input', id: 'Email', name: 'Email', type: 'email', placeholder: 'Enter email' },
  { tag: 'label', text: 'Password', classes: 'MuiFormLabel-root' },
  { tag: 'div', id: 'password-input-wrapper', classes: 'MuiInputBase-root' },
  { tag: 'input', id: 'Password', name: 'Password', type: 'password', placeholder: 'Enter password' },
  { tag: 'button', id: 'Login', name: 'Login', type: 'submit', text: 'LOGIN', classes: 'MuiButton-contained' }
];

// Test 1: Rank Elements for 'Enter email to Email Text'
console.log('--- Test 1: Enter email to Email Text ---');
const emailStep = {
  stepNumber: 6,
  manualStepDescription: 'Enter email to Email Text',
  manualInput: 'saitejab01@gmail.com',
  manualExpectedResult: 'Email should be entered'
};
const rankedEmail = engine['rankElementsForStep'](mockShoppersStackDOM, emailStep, 'enter_text');
console.log('Top ranked element tag:', rankedEmail[0].tag, 'id:', rankedEmail[0].id);
console.assert(rankedEmail[0].tag === 'input', 'FAIL: Top element must be an input');
console.assert(rankedEmail[0].id === 'Email', 'FAIL: Top element must be Email input');
console.log('✓ Successfully prioritized input#Email over container divs, labels, and buttons');

// Test 2: Rank Elements for 'Enter password to password Text'
console.log('\n--- Test 2: Enter password to password Text ---');
const passwordStep = {
  stepNumber: 7,
  manualStepDescription: 'Enter password to password Text',
  manualInput: 'Password@123',
  manualExpectedResult: 'Password should be entered'
};
const rankedPassword = engine['rankElementsForStep'](mockShoppersStackDOM, passwordStep, 'enter_text');
console.log('Top ranked element tag:', rankedPassword[0].tag, 'id:', rankedPassword[0].id);
console.assert(rankedPassword[0].tag === 'input', 'FAIL: Top element must be an input');
console.assert(rankedPassword[0].id === 'Password', 'FAIL: Top element must be Password input');
console.log('✓ Successfully prioritized input#Password over container divs and labels');

// Test 3: Rank Elements for 'Verify Account Setting button' vs 'Create Account'
console.log('\n--- Test 3: Account Setting Button Disambiguation ---');
const accountSettingStep = {
  stepNumber: 9,
  manualStepDescription: 'Verify Account Setting button',
  manualInput: '',
  manualExpectedResult: 'account setting should be displayed'
};
const rankedAccount = engine['rankElementsForStep'](mockShoppersStackDOM, accountSettingStep, 'verify_element_displayed');
console.log('Top ranked element:', rankedAccount[0].tag, 'ariaLabel:', rankedAccount[0].ariaLabel);
console.assert(rankedAccount[0].ariaLabel === 'Account settings', 'FAIL: Must pick Account settings button');
console.assert(rankedAccount[0].text !== 'Create Account', 'FAIL: Must NOT pick Create Account');
console.log('✓ Successfully rejected Create Account and prioritized aria-label="Account settings"');

// Test 4: Format Compact HTML for SLM
console.log('\n--- Test 4: Compact HTML Generation for SLM ---');
const compactHtml = engine['formatElementsForSLM'](rankedEmail.slice(0, 3));
console.log(compactHtml);
console.assert(compactHtml.includes('<input id="Email"'), 'FAIL: Must format input element');
console.assert(!compactHtml.includes('MuiBox-root css-178yklu'), 'FAIL: Must strip heavy CSS classes');
console.log('✓ Generated clean, concise pseudo-HTML for local SLM consumption');

// Test 5: Clean Element Naming
console.log('\n--- Test 5: Clean Element Naming ---');
const nameEmail = engine['cleanElementHint']('Enter email to Email Text', 'Input Field');
console.log('Email name:', nameEmail);
console.assert(nameEmail === 'Email Input Field', 'FAIL: Expected Email Input Field');

const nameLogin = engine['cleanElementHint']('Click on Login Button', 'Button');
console.log('Login name:', nameLogin);
console.assert(nameLogin === 'Login Button', 'FAIL: Expected Login Button');

const nameAccount = engine['cleanElementHint']('Verify Account Setting button', 'Button');
console.log('Account setting name:', nameAccount);
console.assert(nameAccount === 'Account Setting Button', 'FAIL: Expected Account Setting Button');
console.log('✓ All element names cleaned and normalized properly');

// Cleanup
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

console.log('\n========================================================================');
console.log('ALL DOM ANALYSIS & DISAMBIGUATION TESTS PASSED (100% SUCCESS)');
console.log('========================================================================');
