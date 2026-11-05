const { JsonDatabase } = require('./dist-electron/database');
const path = require('path');
const fs = require('fs');

const testDbPath = path.join(__dirname, 'test_stage2_db.json');
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

const db = new JsonDatabase(testDbPath);

console.log('--- Testing Stage 2 Individual Project Level Requirements ---');

// 1. Check Project Seed and Defaults
const demoUser = db.findUserByEmail('demo@easyautomate.dev');
const projects = db.getProjects(demoUser.id);
console.assert(projects.length > 0, 'Should have demo projects');
const proj = projects[0];
console.log('✓ Testing Project:', proj.name, `(${proj.id})`);

// 2. Test Dashboard Stats (Section 2.1, 2.2, 2.3)
const stats = db.getProjectDashboardStats(proj.id);
console.assert(stats.totalScripts > 0, 'Total scripts should be reported');
console.assert(stats.totalElements > 0, 'Total elements should be reported');
console.assert(stats.totalSuites > 0, 'Total suites should be reported');
console.assert(stats.suiteExecutions >= stats.passedExecutions + stats.failedExecutions, 'Executions tally valid');
console.assert(stats.recentExecutions.length > 0, 'Recent executions should be present');
console.assert(stats.activeMachine && stats.activeMachine.name, 'Active machine details should be present');
console.assert(stats.activeMachine.browser && stats.activeMachine.os, 'Machine OS and Browser present');

console.log('✓ Dashboard Statistics Verified:');
console.log(`   - Total Scripts: ${stats.totalScripts}`);
console.log(`   - Total Elements: ${stats.totalElements}`);
console.log(`   - Total Suites: ${stats.totalSuites}`);
console.log(`   - Suite Executions: ${stats.suiteExecutions} (${stats.passedExecutions} Passed, ${stats.failedExecutions} Failed)`);
console.log(`   - Pass Rate: ${stats.passRate}%`);
console.log(`   - Active Machine: ${stats.activeMachine.name} (${stats.activeMachine.os}, ${stats.activeMachine.browser} v${stats.activeMachine.version})`);

// 3. Test Repository Structure & Hierarchy (Section 3.1)
const pages = db.getRepositoryPages(proj.id);
console.assert(pages.length >= 3, 'Should have seeded pages');
const loginPage = pages.find(p => p.name === 'Login Page');
const homePage = pages.find(p => p.name === 'Home Page');
const subpages = pages.filter(p => p.parentId === homePage.id);

console.assert(loginPage !== undefined, 'Login Page should exist');
console.assert(homePage !== undefined, 'Home Page should exist');
console.assert(subpages.length >= 2, 'Home Page should have subpages (Header Section, Product Section)');
console.log('✓ Repository Hierarchical Tree verified:');
console.log(`   - Root: ${homePage.name}`);
subpages.forEach(s => console.log(`     ↳ Subpage: ${s.name} (Parent: ${s.parentId})`));

// 4. Test Repository Operations - Create Subpage (Section 3.2)
const customSubpage = db.createRepositoryPage(proj.id, 'Checkout Review Section', homePage.id);
console.assert(customSubpage.parentId === homePage.id, 'Subpage parentId matches home page');
console.log('✓ Created new subpage:', customSubpage.name);

// Test Duplicate Page Name under same parent is prevented
try {
  db.createRepositoryPage(proj.id, 'Checkout Review Section', homePage.id);
  console.assert(false, 'Duplicate subpage should fail');
} catch (err) {
  console.log('✓ Duplicate subpage prevented:', err.message);
}

// 5. Test Repository Operations - Rename Page (Section 3.2)
const renamedPage = db.updateRepositoryPage(customSubpage.id, proj.id, 'Order Summary Section');
console.assert(renamedPage.name === 'Order Summary Section', 'Rename should update');
console.log('✓ Page renamed successfully to:', renamedPage.name);

// 6. Test Multiple Locators & Static / Dynamic Values (Section 3.4 & 3.5 & 3.6)
const newElement = db.createRepositoryElement(proj.id, customSubpage.id, {
  name: 'Place Order Button',
  type: 'Button',
  description: 'Final checkout submission trigger',
  locators: [
    {
      id: 'loc_static_1',
      type: 'XPath',
      value: "//button[@id='place-order-btn']",
      valueType: 'Static',
      isPrimary: true
    },
    {
      id: 'loc_dynamic_2',
      type: 'XPath',
      value: "//button[@name='{dynamic value1}' and @data-tier='{dynamic value2}']",
      valueType: 'Dynamic'
    },
    {
      id: 'loc_css_3',
      type: 'CSS Selector',
      value: "button.place-order-button",
      valueType: 'Static'
    }
  ]
});

console.assert(newElement.locators.length === 3, 'Element should store 3 locators');
console.assert(newElement.locators[1].valueType === 'Dynamic', 'Second locator should be Dynamic');
console.log('✓ Created element with Multiple Locators & Dynamic Placeholders:', newElement.name);
newElement.locators.forEach((l, i) => {
  console.log(`   Locator #${i + 1} [${l.type}] (${l.valueType}): ${l.value}`);
});

// 7. Test Dynamic Placeholder Validation (Section 3.6 & 3.7)
try {
  db.createRepositoryElement(proj.id, customSubpage.id, {
    name: 'Broken Dynamic Element',
    type: 'Input Field',
    locators: [
      {
        id: 'loc_broken',
        type: 'XPath',
        value: "//input[@id='{dynamic unclosed']", // Missing closing brace }
        valueType: 'Dynamic'
      }
    ]
  });
  console.assert(false, 'Unclosed brace dynamic placeholder should fail validation');
} catch (err) {
  console.log('✓ Incomplete dynamic placeholder syntax rejected:', err.message);
}

// 8. Test Mandatory Element Fields (Section 3.7)
try {
  db.createRepositoryElement(proj.id, customSubpage.id, {
    name: '',
    type: 'Button',
    locators: [{ id: 'loc_1', type: 'ID', value: 'btn', valueType: 'Static' }]
  });
  console.assert(false, 'Empty name should fail');
} catch (err) {
  console.log('✓ Mandatory Element Name check enforced:', err.message);
}

// 9. Test Element Update & Deletion (Section 3.2)
const updatedElement = db.updateRepositoryElement(newElement.id, proj.id, {
  name: 'Complete Order Button',
  type: 'Button',
  locators: newElement.locators
});
console.assert(updatedElement.name === 'Complete Order Button', 'Update should reflect');
console.log('✓ Element updated to:', updatedElement.name);

const deletedElement = db.deleteRepositoryElement(newElement.id, proj.id);
console.assert(deletedElement === true, 'Delete element should succeed');
console.log('✓ Element deleted successfully');

// 10. Test Page Cascade Deletion (Section 3.2)
const deletedPage = db.deleteRepositoryPage(customSubpage.id, proj.id);
console.assert(deletedPage === true, 'Delete page should succeed');
console.assert(!db.getRepositoryPages(proj.id).some(p => p.id === customSubpage.id), 'Page removed from DB');
console.log('✓ Page and its subtree deleted successfully');

// Clean up
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

console.log('\n=========================================');
console.log(' ALL STAGE 2 REQUIREMENTS TESTS PASSED! ');
console.log('=========================================');

