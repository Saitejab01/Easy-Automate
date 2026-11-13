const assert = require('assert');
const { JsonDatabase } = require('./dist-electron/database');

console.log('=== TEST SUITE: Multi-Select & Bulk Operations Verification ===\n');

const db = new JsonDatabase();

// 1. Create Mock Data
console.log('--- 1. Creating mock project and items for bulk testing ---');
const project = db.createProject('u1', {
  name: 'Bulk Test Project ' + Date.now(),
  description: 'Testing bulk delete and bulk push'
});
const projectId = project.id;

// Create 3 AI Sessions
const session1 = {
  id: 'sess_bulk_1',
  projectId,
  testCaseName: 'Flow 1',
  stage: 'Ready to Push',
  progressPercent: 100,
  steps: [
    { stepNumber: 1, manualStepDescription: 'Open browser', nlpId: 'open_browser', status: 'Passed' }
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};
const session2 = {
  id: 'sess_bulk_2',
  projectId,
  testCaseName: 'Flow 2',
  stage: 'Ready to Push',
  progressPercent: 100,
  steps: [
    { stepNumber: 1, manualStepDescription: 'Navigate to URL', nlpId: 'navigate_to_url', status: 'Passed' }
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};
const session3 = {
  id: 'sess_bulk_3',
  projectId,
  testCaseName: 'Flow 3',
  stage: 'Ready to Push',
  progressPercent: 100,
  steps: [
    { stepNumber: 1, manualStepDescription: 'Click button', nlpId: 'click_element', status: 'Passed' }
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};
const saved1 = db.saveAIAutomationSession(session1);
const saved2 = db.saveAIAutomationSession(session2);
const saved3 = db.saveAIAutomationSession(session3);
assert.strictEqual(db.getAIAutomationSessions(projectId).length, 3);
console.log('✓ 3 AI sessions created');

// Create 3 Elements
const page = db.createRepositoryPage(projectId, 'AI Elements');
const elem1 = db.createRepositoryElement(projectId, page.id, { name: 'Btn 1', type: 'Button', locators: [{ id: 'l1', type: 'ID', value: 'btn1', isPrimary: true }] });
const elem2 = db.createRepositoryElement(projectId, page.id, { name: 'Btn 2', type: 'Button', locators: [{ id: 'l2', type: 'ID', value: 'btn2', isPrimary: true }] });
const elem3 = db.createRepositoryElement(projectId, page.id, { name: 'Btn 3', type: 'Button', locators: [{ id: 'l3', type: 'ID', value: 'btn3', isPrimary: true }] });
assert.strictEqual(db.getRepositoryElements(projectId).length, 3);
console.log('✓ 3 Repository elements created');

// Create 3 Scripts
const mod = db.createScriptModule(projectId, 'Regression');
const script1 = db.createScript(projectId, mod.id, 'Script 1', 'desc 1', 'u1');
const script2 = db.createScript(projectId, mod.id, 'Script 2', 'desc 2', 'u1');
const script3 = db.createScript(projectId, mod.id, 'Script 3', 'desc 3', 'u1');
assert.strictEqual(db.getScripts(projectId).length, 3);
console.log('✓ 3 Automation scripts created');

// Create 3 Detailed Executions (push to db.data.detailedExecutions)
const exec1 = { id: 'EXEC_B1', projectId, status: 'Passed', totalScripts: 1, passedScripts: 1, failedScripts: 0, durationSeconds: 5, startedAt: new Date().toISOString(), scripts: [] };
const exec2 = { id: 'EXEC_B2', projectId, status: 'Failed', totalScripts: 1, passedScripts: 0, failedScripts: 1, durationSeconds: 6, startedAt: new Date().toISOString(), scripts: [] };
const exec3 = { id: 'EXEC_B3', projectId, status: 'Passed', totalScripts: 1, passedScripts: 1, failedScripts: 0, durationSeconds: 4, startedAt: new Date().toISOString(), scripts: [] };
db.data.detailedExecutions.push(exec1, exec2, exec3);
db.save();
assert.strictEqual(db.getDetailedExecutions(projectId).length, 3);
console.log('✓ 3 Executions created');

// 2. Test Bulk Delete for AI Sessions
console.log('\n--- 2. Testing Bulk Delete for AI Sessions ---');
const sessionsToDelete = [saved1.id, saved3.id];
sessionsToDelete.forEach(id => db.deleteAIAutomationSession(id, projectId));
const remainingSessions = db.getAIAutomationSessions(projectId);
assert.strictEqual(remainingSessions.length, 1);
assert.strictEqual(remainingSessions[0].id, saved2.id);
console.log('✓ Bulk deleted 2 AI sessions. 1 remains.');

// 3. Test Bulk Delete for Repository Elements
console.log('\n--- 3. Testing Bulk Delete for Repository Elements ---');
const elementsToDelete = [elem1.id, elem2.id];
elementsToDelete.forEach(id => db.deleteRepositoryElement(id, projectId, true));
const remainingElements = db.getRepositoryElements(projectId);
assert.strictEqual(remainingElements.length, 1);
assert.strictEqual(remainingElements[0].id, elem3.id);
console.log('✓ Bulk deleted 2 Repository elements. 1 remains.');

// 4. Test Bulk Delete for TestDev Scripts
console.log('\n--- 4. Testing Bulk Delete for TestDev Scripts ---');
const scriptsToDelete = [script1.id, script2.id];
scriptsToDelete.forEach(id => db.deleteScript(id, projectId, true));
const remainingScripts = db.getScripts(projectId);
assert.strictEqual(remainingScripts.length, 1);
assert.strictEqual(remainingScripts[0].id, script3.id);
console.log('✓ Bulk deleted 2 TestDev scripts. 1 remains.');

// 5. Test Bulk Delete for Execution History
console.log('\n--- 5. Testing Bulk Delete for Execution History ---');
const execsToDelete = ['EXEC_B1', 'EXEC_B2'];
execsToDelete.forEach(id => db.deleteDetailedExecution(id, projectId));
const remainingExecs = db.getDetailedExecutions(projectId);
assert.strictEqual(remainingExecs.length, 1);
assert.strictEqual(remainingExecs[0].id, 'EXEC_B3');
console.log('✓ Bulk deleted 2 Execution runs. 1 remains.');

// Clean up test project
db.deleteProject(projectId, 'u1');
console.log('\n✓ Test project cleaned up.');
console.log('\n========================================================================');
console.log('ALL BULK OPERATIONS VERIFIED SUCCESSFULLY! (100% SUCCESS)');
console.log('========================================================================\n');
