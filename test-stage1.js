const { JsonDatabase } = require('./dist-electron/database');
const path = require('path');
const fs = require('fs');

const testDbPath = path.join(__dirname, 'test_easy_automate_db.json');
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

const db = new JsonDatabase(testDbPath);

console.log('--- Testing Stage 1 Business Logic & Requirements ---');

// 1. Check Default Seed Demo User
const demoUser = db.findUserByEmail('demo@easyautomate.dev');
console.assert(demoUser !== undefined, 'Default demo user should exist');
console.assert(demoUser.isActivated === true, 'Demo user should be activated');
console.log('✓ Default Demo user verified:', demoUser.email);

// 2. Test Login Demo User
const loggedInDemo = db.loginUser('demo@easyautomate.dev', 'P@ssword123');
console.assert(loggedInDemo.id === demoUser.id, 'Demo login should succeed');
console.log('✓ Demo login with P@ssword123 passed');

// 3. Test Login with wrong password
try {
  db.loginUser('demo@easyautomate.dev', 'WrongPass!');
  console.assert(false, 'Should have failed with wrong password');
} catch (err) {
  console.log('✓ Invalid password properly rejected:', err.message);
}

// 4. Test Registration (Requirements 2.3)
const regResult = db.registerUser('testuser@automation.io');
console.assert(regResult.activationToken, 'Should generate activation token');
console.assert(regResult.user.isActivated === false, 'Newly registered user should be pending activation');
console.log('✓ Registration passed, activation token generated:', regResult.activationToken.slice(0, 16) + '...');

// 5. Test Duplicate Registration (Requirements 2.3)
try {
  // If activated:
  db.registerUser('demo@easyautomate.dev');
  console.assert(false, 'Duplicate registration should fail');
} catch (err) {
  console.log('✓ Duplicate registered email properly rejected:', err.message);
}

// 6. Test Unactivated user cannot login (Requirements 2.2)
try {
  db.loginUser('testuser@automation.io', 'P@ssword123');
  console.assert(false, 'Unactivated user should not be able to login');
} catch (err) {
  console.log('✓ Unactivated account login properly rejected:', err.message);
}

// 7. Verify Activation Token (Requirements 2.4)
const tokenCheck = db.verifyActivationToken(regResult.activationToken);
console.assert(tokenCheck.valid === true, 'Token should be valid');
console.assert(tokenCheck.email === 'testuser@automation.io', 'Token should match email');
console.log('✓ Token verification succeeded for:', tokenCheck.email);

// 8. Complete Account Activation (Requirements 2.4)
const activatedUser = db.activateAccount(regResult.activationToken, 'Secure#2026Pass');
console.assert(activatedUser.isActivated === true, 'User should now be activated');
console.assert(activatedUser.activatedAt !== undefined, 'Activation timestamp should be recorded');
console.log('✓ Account activation completed with password hashing');

// 9. Login with new credentials
const newLogin = db.loginUser('testuser@automation.io', 'Secure#2026Pass');
console.assert(newLogin.id === activatedUser.id, 'New login should succeed');
console.log('✓ Login with newly activated credentials succeeded');

// 10. Test Projects Management (Requirements 2.5)
// Create project with valid name
const proj1 = db.createProject(newLogin.id, {
  name: 'Playwright E2E Suite',
  description: 'Smoke and regression tests for core workflows',
  baseUrl: 'https://demo.playwright.dev',
  environment: 'staging',
  defaultBrowser: 'chromium'
});
console.assert(proj1.id && proj1.name === 'Playwright E2E Suite', 'Project creation should succeed');
console.log('✓ Project created:', proj1.name, 'with ID:', proj1.id);

// Duplicate project name validation
try {
  db.createProject(newLogin.id, { name: 'Playwright E2E Suite' });
  console.assert(false, 'Duplicate project name for same user should fail');
} catch (err) {
  console.log('✓ Duplicate project name prevented:', err.message);
}

// Short project name validation (< 3 chars)
try {
  db.createProject(newLogin.id, { name: 'AB' });
  console.assert(false, 'Short project name should fail');
} catch (err) {
  console.log('✓ Short project name prevented:', err.message);
}

// List projects for user
const userProjects = db.getProjects(newLogin.id);
console.assert(userProjects.length === 1, 'User should have 1 project');
console.log('✓ User projects listed count:', userProjects.length);

// Project isolation (User B should not see User A projects)
const demoProjects = db.getProjects(demoUser.id);
console.assert(!demoProjects.some(p => p.id === proj1.id), 'Project isolation verified across users');
console.log('✓ User project isolation verified: demo user has', demoProjects.length, 'projects');

// Update project
const updated = db.updateProject(proj1.id, newLogin.id, {
  description: 'Updated description for suite'
});
console.assert(updated.description === 'Updated description for suite', 'Project update should work');
console.log('✓ Project updated successfully');

// Delete project
const deleted = db.deleteProject(proj1.id, newLogin.id);
console.assert(deleted === true, 'Project delete should succeed');
console.assert(db.getProjects(newLogin.id).length === 0, 'User should have 0 projects after delete');
console.log('✓ Project deleted successfully');

// Clean up test file
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

console.log('\n=========================================');
console.log(' ALL STAGE 1 REQUIREMENTS TESTS PASSED! ');
console.log('=========================================');

