const { JsonDatabase } = require('./dist-electron/database');

async function run() {
  const db = new JsonDatabase();
  await db.load();

  const proj = db.createProject('user_demo_1', { name: 'Test Mode Proj ' + Date.now(), description: '' });
  const projId = proj.id;
  const page = db.createRepositoryPage(projId, 'Test Page');
  const pageId = page.id;

  // 1. Create a STATIC element that contains curly braces in its locator
  const staticElem = db.createRepositoryElement(projId, pageId, {
    name: 'Static Element With Braces',
    type: 'Button',
    locators: [
      { id: 'loc_1', type: 'XPath', value: "//button[@id='{static_brace}']", valueType: 'Static', isPrimary: true, priority: 1 }
    ]
  });

  console.log('1. Static element created:');
  console.log('   elementMode:', staticElem.elementMode);
  console.log('   locator[0].valueType:', staticElem.locators[0].valueType);

  if (staticElem.elementMode !== 'Static') {
    console.error('FAIL: Expected staticElem.elementMode to be Static, got:', staticElem.elementMode);
    process.exit(1);
  }

  // 2. Create a DYNAMIC element
  const dynamicElem = db.createRepositoryElement(projId, pageId, {
    name: 'Dynamic Element',
    type: 'Button',
    locators: [
      { id: 'loc_2', type: 'XPath', value: "//button[@name='{dynamic value 1}']", valueType: 'Dynamic', isPrimary: true, priority: 1 }
    ]
  });

  console.log('2. Dynamic element created:');
  console.log('   elementMode:', dynamicElem.elementMode);
  console.log('   locator[0].valueType:', dynamicElem.locators[0].valueType);

  if (dynamicElem.elementMode !== 'Dynamic') {
    console.error('FAIL: Expected dynamicElem.elementMode to be Dynamic, got:', dynamicElem.elementMode);
    process.exit(1);
  }

  // 3. Create a script and map the static element with braces to Step 1
  const mod = db.createScriptModule(projId, 'Test Module', 'user_demo_1');
  const script = db.createScript(projId, mod.id, 'Test Script', 'user_demo_1', '');

  const updatedScript = db.addScriptStep(script.id, projId, {
    nlpId: 'click_element',
    nlpName: 'Click On Element',
    nlpCategory: 'Browser Action',
    elementId: staticElem.id,
    elementName: staticElem.name,
    elementMode: staticElem.elementMode,
    locator: staticElem.locators[0],
    parameters: {}
  });

  console.log('3. Step mapped to Static element with braces:');
  console.log('   step.elementMode:', updatedScript.steps[0].elementMode);
  console.log('   step.locator.valueType:', updatedScript.steps[0].locator.valueType);
  console.log('   step.locator.value:', updatedScript.steps[0].locator.value);

  if (updatedScript.steps[0].elementMode !== 'Static') {
    console.error('FAIL: Step elementMode should be Static');
    process.exit(1);
  }

  // 4. Test updating the static element with braces to dynamic
  const updatedElem = db.updateRepositoryElement(staticElem.id, projId, {
    name: 'Static Element With Braces',
    type: 'Button',
    locators: [
      { id: 'loc_1', type: 'XPath', value: "//button[@id='{dynamic value 1}']", valueType: 'Dynamic', isPrimary: true, priority: 1 }
    ]
  });

  console.log('4. Updated element to Dynamic:');
  console.log('   elementMode:', updatedElem.elementMode);
  if (updatedElem.elementMode !== 'Dynamic') {
    console.error('FAIL: Expected updatedElem.elementMode to be Dynamic');
    process.exit(1);
  }

  const reloadedScript = db.getScriptById(script.id, projId);
  console.log('   synced step elementMode:', reloadedScript.steps[0].elementMode);
  if (reloadedScript.steps[0].elementMode !== 'Dynamic') {
    console.error('FAIL: Step elementMode should have auto-synced to Dynamic');
    process.exit(1);
  }

  // 5. Update back to Static with braces
  const backToStaticElem = db.updateRepositoryElement(staticElem.id, projId, {
    name: 'Static Element With Braces',
    type: 'Button',
    locators: [
      { id: 'loc_1', type: 'XPath', value: "//button[@id='{literal_braces}']", valueType: 'Static', isPrimary: true, priority: 1 }
    ]
  });

  console.log('5. Updated back to Static with braces:');
  console.log('   elementMode:', backToStaticElem.elementMode);
  const reloadedScript2 = db.getScriptById(script.id, projId);
  console.log('   synced step elementMode:', reloadedScript2.steps[0].elementMode);
  if (reloadedScript2.steps[0].elementMode !== 'Static') {
    console.error('FAIL: Step elementMode should have auto-synced back to Static');
    process.exit(1);
  }

  // Clean up test data
  db.deleteProject(projId, 'user_demo_1');
  console.log('====================================================');
  console.log(' ALL VALUE TYPE & INTEGRATION TESTS PASSED 100%!   ');
  console.log('====================================================');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
