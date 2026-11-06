const assert = require('assert');
const { AutomationEngine } = require('./dist-electron/engine/automationEngine');

console.log('===================================================================');
console.log('  Testing Dynamic Element Handling & Value Replacement in NLPs   ');
console.log('===================================================================');

// 1. Placeholder Extraction
function extractDynamicPlaceholders(locator) {
  if (!locator || !locator.value) return [];
  const matches = locator.value.match(/\{([^}]+)\}/g);
  if (matches && matches.length > 0) {
    const set = new Set();
    matches.forEach(m => {
      const cleaned = m.slice(1, -1).trim();
      if (cleaned) set.add(cleaned);
    });
    return Array.from(set);
  }
  if (locator.valueType === 'Dynamic') {
    return ['dynamicValue'];
  }
  return [];
}

function getResolvedLocatorPreview(locator, dynamicValues) {
  if (!locator || !locator.value) return '';
  let preview = locator.value;
  if (!dynamicValues || Object.keys(dynamicValues).length === 0) return preview;

  for (const [k, v] of Object.entries(dynamicValues)) {
    const cleanK = k.replace(/^\{|\}$/g, '').trim();
    const replacement = v !== undefined && v !== '' ? v : `{${cleanK}}`;
    preview = preview.split(`{${cleanK}}`).join(replacement);
    preview = preview.split(`{${k}}`).join(replacement);
  }

  const remainingMatches = preview.match(/\{([^}]+)\}/g);
  if (remainingMatches && Object.keys(dynamicValues).length === 1) {
    const singleVal = Object.values(dynamicValues)[0];
    if (singleVal) {
      preview = preview.split(remainingMatches[0]).join(singleVal);
    }
  }

  return preview;
}

// Test Case 1: Dynamic element with {dynamic product name}
const loc1 = {
  type: 'XPath',
  value: "//h3[contains(@class, 'product-title') and text()='{dynamic product name}']",
  valueType: 'Dynamic'
};

const placeholders1 = extractDynamicPlaceholders(loc1);
console.log('1. Placeholders for loc1:', placeholders1);
assert.deepStrictEqual(placeholders1, ['dynamic product name'], 'Should extract "dynamic product name"');

const preview1 = getResolvedLocatorPreview(loc1, { 'dynamic product name': 'Apple MacBook Pro' });
console.log('2. Live Preview with value:', preview1);
assert.strictEqual(
  preview1,
  "//h3[contains(@class, 'product-title') and text()='Apple MacBook Pro']",
  'Preview should replace {dynamic product name} with entered value'
);

// Test Case 2: AutomationEngine.resolveLocatorValue
const resolvedLoc = AutomationEngine.resolveLocatorValue(loc1, { 'dynamic product name': 'Sony Headphones' });
console.log('3. AutomationEngine resolved locator:', resolvedLoc);
assert.strictEqual(
  resolvedLoc,
  "//h3[contains(@class, 'product-title') and text()='Sony Headphones']",
  'Engine should resolve locator template to concrete locator'
);

// Test Case 3: AutomationEngine.resolveLocatorValue with braces in key
const resolvedLocWithBraces = AutomationEngine.resolveLocatorValue(loc1, { '{dynamic product name}': 'Sony Headphones' });
console.log('4. Resolved with braces in key:', resolvedLocWithBraces);
assert.strictEqual(
  resolvedLocWithBraces,
  "//h3[contains(@class, 'product-title') and text()='Sony Headphones']",
  'Engine should handle dictionary keys passed with braces'
);

// Test Case 4: Multiple dynamic placeholders
const locMulti = {
  type: 'XPath',
  value: "//div[@data-category='{category}']//button[@id='btn-{btnId}']",
  valueType: 'Dynamic'
};
const placeholdersMulti = extractDynamicPlaceholders(locMulti);
console.log('5. Multiple placeholders:', placeholdersMulti);
assert.deepStrictEqual(placeholdersMulti, ['category', 'btnId'], 'Should extract multiple placeholders');

const previewMulti = getResolvedLocatorPreview(locMulti, {
  category: 'electronics',
  btnId: 'buy-now'
});
console.log('6. Multiple placeholders preview:', previewMulti);
assert.strictEqual(
  previewMulti,
  "//div[@data-category='electronics']//button[@id='btn-buy-now']",
  'Should replace multiple placeholders'
);

// Test Case 5: Variable resolution in dynamicValues
const localVars = [{ id: 'var1', name: 'productName', type: 'Local', dataType: 'String', value: 'Samsung Galaxy S24' }];
const globalVars = [{ id: 'var2', name: 'targetCategory', type: 'Global', dataType: 'String', value: 'smartphones' }];

const dynValuesWithVars = {
  category: '$targetCategory',
  btnId: '$productName'
};

const resolvedDynVars = {};
for (const [k, v] of Object.entries(dynValuesWithVars)) {
  const { resolved } = AutomationEngine.resolveVariables(v, localVars, globalVars);
  resolvedDynVars[k] = resolved;
}
console.log('7. Resolved dynamic values from variables:', resolvedDynVars);
assert.strictEqual(resolvedDynVars.category, 'smartphones');
assert.strictEqual(resolvedDynVars.btnId, 'Samsung Galaxy S24');

const resolvedLocWithVars = AutomationEngine.resolveLocatorValue(locMulti, resolvedDynVars);
console.log('8. Resolved locator using variables:', resolvedLocWithVars);
assert.strictEqual(
  resolvedLocWithVars,
  "//div[@data-category='smartphones']//button[@id='btn-Samsung Galaxy S24']"
);

// Test Case 6: Machine Screen Dimensions detection & maximize fitting
console.log('9. Testing Machine Screen Dimensions Detection...');
AutomationEngine.setMachineScreenDimensions({ width: 1536, height: 864, scaleFactor: 1.25 });
(async () => {
  const dims = await AutomationEngine.getMachineScreenDimensions();
  console.log('   Retrieved Machine Dimensions:', dims);
  assert.strictEqual(dims.width, 1536, 'Width should match machine work area');
  assert.strictEqual(dims.height, 864, 'Height should match machine work area');
  assert.strictEqual(dims.scaleFactor, 1.25, 'Scale factor should match machine scale factor');

  console.log('===================================================================');
  console.log('  ALL DYNAMIC ELEMENT & MAXIMIZE DIMENSION TESTS PASSED!           ');
  console.log('===================================================================');
})();

