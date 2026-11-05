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
  lines.push(`  const browser = await chromium.launch({ headless: false, slowMo: 400 });`);
  lines.push(`  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });`);
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

      const locatorCode = getPlaywrightLocatorCode(step.locator, step.parameters?.dynamicValues);

      switch (step.nlpId) {
        case 'open_browser': {
          lines.push(`  // Browser launched and initialized`);
          break;
        }
        case 'navigate_to_url': {
          const url = resolvedParams.url || '';
          lines.push(`  await page.goto('${url}', { waitUntil: 'domcontentloaded' });`);
          break;
        }
        case 'maximize_browser': {
          lines.push(`  await page.setViewportSize({ width: 1920, height: 1080 });`);
          break;
        }
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
        case 'clear_browser_cache': {
          lines.push(`  await context.clearCookies();`);
          break;
        }
        case 'accept_alert': {
          lines.push(`  page.once('dialog', dialog => dialog.accept());`);
          break;
        }
        case 'dismiss_alert': {
          lines.push(`  page.once('dialog', dialog => dialog.dismiss());`);
          break;
        }
        case 'click_element': {
          lines.push(`  await ${locatorCode}.click();`);
          break;
        }
        case 'enter_text': {
          const text = (resolvedParams.text || '').replace(/'/g, "\\'");
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
        case 'double_click': {
          lines.push(`  await ${locatorCode}.dblclick();`);
          break;
        }
        case 'right_click': {
          lines.push(`  await ${locatorCode}.click({ button: 'right' });`);
          break;
        }
        case 'select_option_by_text': {
          const text = (resolvedParams.optionText || resolvedParams.text || '').replace(/'/g, "\\'");
          lines.push(`  await ${locatorCode}.selectOption({ label: '${text}' });`);
          break;
        }
        case 'select_option_by_value': {
          const val = (resolvedParams.optionValue || resolvedParams.value || '').replace(/'/g, "\\'");
          lines.push(`  await ${locatorCode}.selectOption({ value: '${val}' });`);
          break;
        }
        case 'select_option_by_index': {
          lines.push(`  await ${locatorCode}.selectOption({ index: ${resolvedParams.index || 0} });`);
          break;
        }
        case 'check_checkbox': {
          lines.push(`  await ${locatorCode}.check();`);
          break;
        }
        case 'uncheck_checkbox': {
          lines.push(`  await ${locatorCode}.uncheck();`);
          break;
        }
        case 'press_key': {
          lines.push(`  await page.keyboard.press('${resolvedParams.key || 'Enter'}');`);
          break;
        }
        case 'verify_element_is_displayed': {
          lines.push(`  await ${locatorCode}.waitFor({ state: 'visible', timeout: 5000 });`);
          break;
        }
        case 'verify_element_is_not_displayed': {
          lines.push(`  await ${locatorCode}.waitFor({ state: 'hidden', timeout: 5000 });`);
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
          lines.push(`  await expect(${locatorCode}).toContainText('${expText}');`);
          break;
        }
        case 'verify_page_title': {
          const title = (resolvedParams.expectedTitle || '').replace(/'/g, "\\'");
          lines.push(`  await expect(page).toHaveTitle(new RegExp('${title}', 'i'));`);
          break;
        }
        case 'verify_current_url': {
          const expUrl = (resolvedParams.expectedUrl || '').replace(/'/g, "\\'");
          lines.push(`  await expect(page).toHaveURL(new RegExp('${expUrl}', 'i'));`);
          break;
        }
        case 'verify_checkbox_is_checked': {
          lines.push(`  await expect(${locatorCode}).toBeChecked();`);
          break;
        }
        case 'verify_checkbox_is_unchecked': {
          lines.push(`  await expect(${locatorCode}).not.toBeChecked();`);
          break;
        }
        case 'static_wait': {
          lines.push(`  await page.waitForTimeout(${Number(resolvedParams.durationMs) || 1000});`);
          break;
        }
        case 'wait_for_element_visible': {
          lines.push(`  await ${locatorCode}.waitFor({ state: 'visible', timeout: ${Number(resolvedParams.waitTimeMs) || 5000} });`);
          break;
        }
        case 'wait_for_element_hidden': {
          lines.push(`  await ${locatorCode}.waitFor({ state: 'hidden', timeout: ${Number(resolvedParams.waitTimeMs) || 5000} });`);
          break;
        }
        case 'wait_for_page_to_load': {
          lines.push(`  await page.waitForLoadState('load');`);
          break;
        }
        case 'wait_for_network_idle': {
          lines.push(`  await page.waitForLoadState('networkidle');`);
          break;
        }
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
        case 'get_data_from_excel': {
          lines.push(`  // Read row '${resolvedParams.uniqueData}' from file '${resolvedParams.fileName}' (${resolvedParams.sheetName})`);
          lines.push(`  Object.assign(testContext, await readExcelRow('${resolvedParams.fileName}', '${resolvedParams.sheetName}', '${resolvedParams.uniqueData}'));`);
          break;
        }
        case 'write_data_to_excel': {
          lines.push(`  // Write '${resolvedParams.writeBackData}' to file '${resolvedParams.fileName}' at [${resolvedParams.uniqueData}, ${resolvedParams.header}]`);
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
  const varRegex = /\$\{?([a-zA-Z0-9_]+)\}?/g;
  return text.replace(varRegex, (match, varName) => {
    const localVar = (localVars || []).find(v => v.name === varName);
    if (localVar) return localVar.value;
    const globalVar = (globalVars || []).find(v => v.name === varName);
    if (globalVar) return globalVar.value;
    return match;
  });
}

function getPlaywrightLocatorCode(locator: any, dynamicValues?: Record<string, string>): string {
  if (!locator || !locator.value) return `page.locator('body')`;
  let val = locator.value;
  if (dynamicValues) {
    for (const [k, v] of Object.entries(dynamicValues)) {
      val = val.replace(`{${k}}`, v);
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

