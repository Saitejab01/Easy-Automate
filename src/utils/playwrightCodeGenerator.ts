/**
 * Generates executable Playwright TypeScript code corresponding to the automation script
 */
export function generatePlaywrightCode(
  script: any,
  elements: any[] = [],
  localVars: any[] = [],
  globalVars: any[] = []
): string {
  const lines: string[] = [];
  const scriptTitle = (script?.name || 'Automation Test').replace(/['"\\]/g, '\\$&');

  lines.push(`import { test, expect, chromium } from '@playwright/test';`);
  lines.push(``);
  lines.push(`/**`);
  lines.push(` * Easy Automate Generated Test`);
  lines.push(` * Script: ${script?.name || 'Unnamed Script'}`);
  lines.push(` * Description: ${script?.description || 'N/A'}`);
  lines.push(` * Generated at: ${new Date().toISOString()}`);
  lines.push(` */`);
  lines.push(`test('${scriptTitle}', async () => {`);
  lines.push(`  // 1. Launch Headful Browser`);
  lines.push(`  const browser = await chromium.launch({ headless: false, slowMo: 400, args: ['--window-size=1280,720', '--disable-blink-features=AutomationControlled'] });`);
  lines.push(`  const context = await browser.newContext({ viewport: null });`);
  lines.push(`  const page = await context.newPage();`);
  lines.push(`  page.setDefaultTimeout(10000);`);
  lines.push(``);
  lines.push(`  // Execution Variables Context`);
  lines.push(`  const testContext: Record<string, any> = {};`);
  lines.push(``);

  if (script?.steps && Array.isArray(script.steps)) {
    for (const step of script.steps) {
      if (!step.isEnabled) {
        lines.push(`  // Step ${step.stepNumber}: [DISABLED] ${step.nlpName}`);
        continue;
      }

      lines.push(`  // Step ${step.stepNumber}: ${step.nlpName} (${step.nlpCategory})`);

      // Resolve parameters with variables
      const resolvedParams: Record<string, any> = {};
      for (const [k, v] of Object.entries(step.parameters || {})) {
        if (typeof v === 'string') {
          resolvedParams[k] = resolveVariables(v, localVars, globalVars);
        } else {
          resolvedParams[k] = v;
        }
      }

      const codeDynValues: Record<string, string> = {};
      if (step.parameters?.dynamicValues && typeof step.parameters.dynamicValues === 'object') {
        for (const [dk, dv] of Object.entries(step.parameters.dynamicValues)) {
          codeDynValues[dk] = typeof dv === 'string'
            ? resolveVariables(dv, localVars, globalVars)
            : String(dv ?? '');
        }
      }
      const locatorCode = getPlaywrightLocatorCode(step.locator, codeDynValues);

      switch (step.nlpId) {
        // --- Browser NLPs ---
        case 'open_browser': {
          lines.push(`  // Browser launched and initialized`);
          break;
        }
        case 'close_browser': {
          lines.push(`  await browser.close();`);
          break;
        }
        case 'maximize_browser': {
          lines.push(`  // Maximize browser window to fit machine dimensions without zoom variation`);
          lines.push(`  try {`);
          lines.push(`    const session = await context.newCDPSession(page);`);
          lines.push(`    const { windowId } = await session.send('Browser.getWindowForTarget');`);
          lines.push(`    await session.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'maximized' } });`);
          lines.push(`    await session.send('Emulation.clearDeviceMetricsOverride');`);
          lines.push(`    await session.send('Emulation.resetPageScaleFactor');`);
          lines.push(`  } catch {`);
          lines.push(`    const dims = await page.evaluate(() => ({ width: window.screen.availWidth || window.screen.width, height: window.screen.availHeight || window.screen.height }));`);
          lines.push(`    await page.setViewportSize(dims);`);
          lines.push(`  }`);
          lines.push(`  await page.evaluate(() => { try { document.documentElement.style.zoom = '1'; } catch {} });`);
          break;
        }
        case 'minimize_browser': {
          lines.push(`  try {`);
          lines.push(`    const session = await context.newCDPSession(page);`);
          lines.push(`    const { windowId } = await session.send('Browser.getWindowForTarget');`);
          lines.push(`    await session.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'minimized' } });`);
          lines.push(`  } catch {}`);
          break;
        }
        case 'refresh_browser':
        case 'refresh_page': {
          lines.push(`  await page.reload();`);
          break;
        }
        case 'navigate_back': {
          lines.push(`  await page.goBack();`);
          break;
        }
        case 'navigate_forward': {
          lines.push(`  await page.goForward();`);
          break;
        }
        case 'navigate_to_url': {
          const url = resolvedParams.url || '';
          lines.push(`  await page.goto('${url}', { waitUntil: 'domcontentloaded' });`);
          break;
        }
        case 'get_current_url': {
          const varName = (resolvedParams.storeVariable || '$currentUrl').replace(/^\$/, '');
          lines.push(`  testContext['${varName}'] = page.url();`);
          break;
        }
        case 'get_page_title': {
          const varName = (resolvedParams.storeVariable || '$pageTitle').replace(/^\$/, '');
          lines.push(`  testContext['${varName}'] = await page.title();`);
          break;
        }

        // --- Browser Action NLPs ---
        case 'click_element': {
          const count = Number(resolvedParams.clickCount) || 1;
          lines.push(`  await ${locatorCode}.click({ clickCount: ${count} });`);
          break;
        }
        case 'double_click_element':
        case 'double_click': {
          lines.push(`  await ${locatorCode}.dblclick();`);
          break;
        }
        case 'right_click_element':
        case 'right_click': {
          lines.push(`  await ${locatorCode}.click({ button: 'right' });`);
          break;
        }
        case 'enter_text': {
          const rawText = resolvedParams.text !== undefined ? String(resolvedParams.text) : String(resolvedParams.inputData || '');
          const text = rawText.replace(/'/g, "\\'");
          if (resolvedParams.clearBeforeEnter || resolvedParams.clearBeforeTyping) {
            lines.push(`  await ${locatorCode}.clear();`);
          }
          lines.push(`  await ${locatorCode}.fill('${text}');`);
          break;
        }
        case 'clear_text': {
          lines.push(`  await ${locatorCode}.clear();`);
          break;
        }
        case 'mouse_hover': {
          lines.push(`  await ${locatorCode}.hover();`);
          break;
        }
        case 'drag_and_drop': {
          if (resolvedParams.targetElementId) {
            lines.push(`  await ${locatorCode}.dragTo(page.locator('#${resolvedParams.targetElementId}'));`);
          } else {
            lines.push(`  await ${locatorCode}.hover();`);
            lines.push(`  await page.mouse.down();`);
            lines.push(`  await page.mouse.move(${Number(resolvedParams.targetX) || 100}, ${Number(resolvedParams.targetY) || 100});`);
            lines.push(`  await page.mouse.up();`);
          }
          break;
        }
        case 'select_dropdown_by_text':
        case 'select_option_by_text': {
          const text = (resolvedParams.text || resolvedParams.optionText || '').replace(/'/g, "\\'");
          lines.push(`  await ${locatorCode}.selectOption({ label: '${text}' });`);
          break;
        }
        case 'select_dropdown_by_value':
        case 'select_option_by_value': {
          const val = (resolvedParams.value || resolvedParams.optionValue || '').replace(/'/g, "\\'");
          lines.push(`  await ${locatorCode}.selectOption({ value: '${val}' });`);
          break;
        }
        case 'select_multiple_options': {
          const opts = String(resolvedParams.options || '').split(',').map(s => `'${s.trim().replace(/'/g, "\\'")}'`).join(', ');
          lines.push(`  await ${locatorCode}.selectOption([${opts}]);`);
          break;
        }
        case 'select_checkbox':
        case 'check_checkbox': {
          lines.push(`  await ${locatorCode}.check();`);
          break;
        }
        case 'deselect_checkbox':
        case 'uncheck_checkbox': {
          lines.push(`  await ${locatorCode}.uncheck();`);
          break;
        }
        case 'press_keyboard_key':
        case 'press_key': {
          lines.push(`  await page.keyboard.press('${resolvedParams.key || 'Enter'}');`);
          break;
        }
        case 'upload_file': {
          lines.push(`  await ${locatorCode}.setInputFiles('${resolvedParams.filePath || ''}');`);
          break;
        }
        case 'download_file': {
          const varName = (resolvedParams.storeVariable || '$downloadedPath').replace(/^\$/, '');
          lines.push(`  const [download] = await Promise.all([`);
          lines.push(`    page.waitForEvent('download'),`);
          lines.push(`    ${locatorCode}.click()`);
          lines.push(`  ]);`);
          lines.push(`  testContext['${varName}'] = await download.path();`);
          break;
        }

        // --- Switching NLPs ---
        case 'switch_to_frame': {
          lines.push(`  const frame = page.frameLocator('${resolvedParams.frameLocator || 'iframe'}');`);
          break;
        }
        case 'switch_to_default_content':
        case 'switch_to_parent_frame': {
          lines.push(`  // Switched back to top-level content`);
          break;
        }
        case 'switch_to_new_tab': {
          lines.push(`  const pages = context.pages();`);
          lines.push(`  const newPage = pages[pages.length - 1];`);
          lines.push(`  await newPage.bringToFront();`);
          break;
        }
        case 'switch_to_tab_by_title': {
          lines.push(`  for (const p of context.pages()) {`);
          lines.push(`    if ((await p.title()).includes('${resolvedParams.tabTitle || ''}')) { await p.bringToFront(); break; }`);
          lines.push(`  }`);
          break;
        }
        case 'switch_to_tab_by_url': {
          lines.push(`  for (const p of context.pages()) {`);
          lines.push(`    if (p.url().includes('${resolvedParams.tabUrl || ''}')) { await p.bringToFront(); break; }`);
          lines.push(`  }`);
          break;
        }
        case 'close_current_tab': {
          lines.push(`  await page.close();`);
          break;
        }
        case 'switch_to_alert':
        case 'accept_alert': {
          lines.push(`  page.once('dialog', dialog => dialog.accept());`);
          break;
        }
        case 'dismiss_alert': {
          lines.push(`  page.once('dialog', dialog => dialog.dismiss());`);
          break;
        }
        case 'get_alert_text': {
          const varName = (resolvedParams.storeVariable || '$alertText').replace(/^\$/, '');
          lines.push(`  page.once('dialog', dialog => { testContext['${varName}'] = dialog.message(); dialog.accept(); });`);
          break;
        }

        // --- Verification NLPs ---
        case 'verify_element_is_displayed': {
          lines.push(`  await expect(${locatorCode}).toBeVisible();`);
          break;
        }
        case 'verify_element_is_not_displayed': {
          lines.push(`  await expect(${locatorCode}).toBeHidden();`);
          break;
        }
        case 'verify_element_is_present': {
          lines.push(`  await ${locatorCode}.waitFor({ state: 'attached' });`);
          break;
        }
        case 'verify_element_is_not_present': {
          lines.push(`  await ${locatorCode}.waitFor({ state: 'detached' });`);
          break;
        }
        case 'verify_element_is_enabled': {
          lines.push(`  await expect(${locatorCode}).toBeEnabled();`);
          break;
        }
        case 'verify_element_is_disabled': {
          lines.push(`  await expect(${locatorCode}).toBeDisabled();`);
          break;
        }
        case 'verify_text': {
          const expText = (resolvedParams.expectedText || '').replace(/'/g, "\\'");
          const mode = resolvedParams.comparisonType || 'Contains';
          if (mode === 'Equals') {
            lines.push(`  await expect(${locatorCode}).toHaveText('${expText}');`);
          } else {
            lines.push(`  await expect(${locatorCode}).toContainText('${expText}');`);
          }
          break;
        }
        case 'verify_attribute': {
          const attr = resolvedParams.attributeName || 'class';
          const val = (resolvedParams.expectedValue || '').replace(/'/g, "\\'");
          lines.push(`  await expect(${locatorCode}).toHaveAttribute('${attr}', '${val}');`);
          break;
        }
        case 'verify_page_title': {
          const title = (resolvedParams.expectedTitle || '').replace(/'/g, "\\'");
          lines.push(`  await expect(page).toHaveTitle(new RegExp('${title}', 'i'));`);
          break;
        }
        case 'verify_current_url':
        case 'verify_url': {
          const expUrl = (resolvedParams.expectedUrl || '').replace(/'/g, "\\'");
          lines.push(`  await expect(page).toHaveURL(new RegExp('${expUrl}', 'i'));`);
          break;
        }
        case 'verify_dropdown_value': {
          const expVal = (resolvedParams.expectedValue || '').replace(/'/g, "\\'");
          lines.push(`  await expect(${locatorCode}).toHaveValue('${expVal}');`);
          break;
        }

        // --- Wait NLPs (Uses Global Wait configuration) ---
        case 'wait_for_element_present':
        case 'wait_for_element': {
          lines.push(`  await ${locatorCode}.waitFor({ state: 'attached' });`);
          break;
        }
        case 'wait_for_element_to_be_visible':
        case 'wait_for_element_visible': {
          lines.push(`  await ${locatorCode}.waitFor({ state: 'visible' });`);
          break;
        }
        case 'wait_for_element_clickable': {
          lines.push(`  await ${locatorCode}.waitFor({ state: 'visible' });`);
          lines.push(`  await expect(${locatorCode}).toBeEnabled();`);
          break;
        }
        case 'wait_for_element_to_be_hidden':
        case 'wait_for_element_hidden': {
          lines.push(`  await ${locatorCode}.waitFor({ state: 'hidden' });`);
          break;
        }
        case 'wait_for_page_load':
        case 'wait_for_page_to_load':
        case 'wait_for_navigation': {
          lines.push(`  await page.waitForLoadState('load');`);
          break;
        }
        case 'wait_for_network_idle': {
          lines.push(`  await page.waitForLoadState('networkidle');`);
          break;
        }
        case 'static_wait': {
          lines.push(`  await page.waitForTimeout(1000);`);
          break;
        }
        case 'wait_for_text': {
          const text = (resolvedParams.expectedText || '').replace(/'/g, "\\'");
          lines.push(`  await page.getByText('${text}').first().waitFor({ state: 'visible' });`);
          break;
        }

        // --- Scroll NLPs ---
        case 'scroll_to_element': {
          lines.push(`  await ${locatorCode}.scrollIntoViewIfNeeded();`);
          break;
        }
        case 'scroll_to_bottom': {
          lines.push(`  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));`);
          break;
        }
        case 'scroll_to_top': {
          lines.push(`  await page.evaluate(() => window.scrollTo(0, 0));`);
          break;
        }
        case 'scroll_up': {
          lines.push(`  await page.evaluate(() => window.scrollBy(0, -${Number(resolvedParams.pixels) || 400}));`);
          break;
        }
        case 'scroll_down': {
          lines.push(`  await page.evaluate(() => window.scrollBy(0, ${Number(resolvedParams.pixels) || 400}));`);
          break;
        }
        case 'scroll_by_pixels': {
          lines.push(`  await page.evaluate(() => window.scrollBy(${Number(resolvedParams.xPixels) || 0}, ${Number(resolvedParams.yPixels) || 400}));`);
          break;
        }

        // --- Excel NLPs ---
        case 'get_data_from_excel': {
          const targetVar = (resolvedParams.targetVariable || '$testData').replace(/^\$/, '');
          lines.push(`  // Fetch row '${resolvedParams.uniqueData}' from Excel '${resolvedParams.fileName}' (${resolvedParams.sheetName})`);
          lines.push(`  testContext['${targetVar}'] = await readExcelRow('${resolvedParams.fileName}', '${resolvedParams.sheetName}', '${resolvedParams.uniqueData}');`);
          lines.push(`  Object.assign(testContext, testContext['${targetVar}']);`);
          break;
        }
        case 'write_data_to_excel': {
          lines.push(`  // Write '${resolvedParams.writeBackData}' to Excel file '${resolvedParams.fileName}' at [${resolvedParams.uniqueData}, ${resolvedParams.header}]`);
          lines.push(`  await writeExcelCell('${resolvedParams.fileName}', '${resolvedParams.sheetName}', '${resolvedParams.uniqueData}', '${resolvedParams.header}', '${resolvedParams.writeBackData}');`);
          break;
        }
        default: {
          lines.push(`  // ${step.nlpName} execution`);
          break;
        }
      }
      lines.push(``);
    }
  }

  lines.push(`  // Teardown`);
  lines.push(`  await context.close();`);
  lines.push(`  await browser.close();`);
  lines.push(`});`);

  return lines.join('\n');
}

function resolveVariables(text: string, localVars: any[] = [], globalVars: any[] = []): string {
  if (!text || typeof text !== 'string') return text;
  // Support dotted variable names: $testData.ProductName, ${testData.ProductName}
  const varRegex = /\$\{?([a-zA-Z0-9_.]+)\}?/g;
  return text.replace(varRegex, (match, varName) => {
    const localVar = (localVars || []).find(v => v.name === varName || v.name.toLowerCase() === varName.toLowerCase());
    if (localVar) return localVar.value;
    const globalVar = (globalVars || []).find(v => v.name === varName || v.name.toLowerCase() === varName.toLowerCase());
    if (globalVar) return globalVar.value;
    return match;
  });
}

function getPlaywrightLocatorCode(locator: any, dynamicValues?: Record<string, string>): string {
  if (!locator || !locator.value) return `page.locator('body')`;
  let val = locator.value;
  if (dynamicValues && Object.keys(dynamicValues).length > 0) {
    for (const [k, v] of Object.entries(dynamicValues)) {
      const cleanKey = k.replace(/^\{|\}$/g, '').trim();
      val = val.split(`{${cleanKey}}`).join(String(v ?? ''));
      val = val.split(`{${k}}`).join(String(v ?? ''));
    }
    const remainingMatches = val.match(/\{([^}]+)\}/g);
    if (remainingMatches && Object.keys(dynamicValues).length === 1) {
      const singleVal = Object.values(dynamicValues)[0];
      val = val.split(remainingMatches[0]).join(String(singleVal ?? ''));
    }
  }
  const escaped = val.replace(/'/g, "\\'");

  switch (locator.type) {
    case 'ID':
      return `page.locator('#${escaped}')`;
    case 'CSS Selector':
      return `page.locator('${escaped}')`;
    case 'XPath':
      return `page.locator('xpath=${escaped}')`;
    case 'Name':
      return `page.locator('[name="${escaped}"]')`;
    case 'Class Name':
      return `page.locator('.${escaped.trim().replace(/\\s+/g, '.')}')`;
    case 'Link Text':
    case 'Partial Link Text':
      return `page.locator('a:has-text("${escaped}")')`;
    case 'Tag Name':
      return `page.locator('${escaped}')`;
    case 'Text':
      return `page.getByText('${escaped}')`;
    case 'Role':
      return `page.locator('${escaped}')`;
    case 'Placeholder':
      return `page.getByPlaceholder('${escaped}')`;
    case 'Label':
      return `page.getByLabel('${escaped}')`;
    case 'Test ID':
      return `page.getByTestId('${escaped}')`;
    default:
      return `page.locator('${escaped}')`;
  }
}
