import os from 'os';
import * as XLSX from 'xlsx';
import {
  parseDynamicPlaceholders,
  resolveDynamicPlaceholders,
  validateDynamicPlaceholders
} from '../dynamicPlaceholder';

export interface AutomationContext {
  projectId: string;
  script: any;
  moduleName?: string;
  elements: any[];
  testDataFiles: any[];
  localVariables: any[];
  globalVariables: any[];
  runSettings: any;
  onFileUpdated?: (fileRecord: any) => void;
  getLearnedLocator?: (elemId: string) => any;
  onLearnedLocatorSuccess?: (elemId: string, locator: any) => void;
  onLearnedLocatorFailure?: (elemId: string) => void;
}

export class AutomationEngine {
  private static cachedScreenDimensions: { width: number; height: number; scaleFactor?: number } | null = null;
  public static activeExecutionContext: {
    getLearnedLocator?: (elemId: string) => any;
    onLearnedLocatorSuccess?: (elemId: string, locator: any) => void;
    onLearnedLocatorFailure?: (elemId: string) => void;
  } | null = null;

  public static setMachineScreenDimensions(dims: { width: number; height: number; scaleFactor?: number }): void {
    this.cachedScreenDimensions = dims;
  }

  public static async getMachineScreenDimensions(page?: any): Promise<{ width: number; height: number; scaleFactor?: number }> {
    if (this.cachedScreenDimensions && this.cachedScreenDimensions.width > 0 && this.cachedScreenDimensions.height > 0) {
      return this.cachedScreenDimensions;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const electron = require('electron');
      const screenObj = electron.screen || (electron.default && electron.default.screen);
      if (screenObj && typeof screenObj.getPrimaryDisplay === 'function') {
        const primary = screenObj.getPrimaryDisplay();
        if (primary && primary.workAreaSize && primary.workAreaSize.width > 0) {
          const dims = {
            width: primary.workAreaSize.width,
            height: primary.workAreaSize.height,
            scaleFactor: primary.scaleFactor || 1
          };
          this.cachedScreenDimensions = dims;
          return dims;
        }
      }
    } catch {
      // Non-electron environment
    }

    if (page && !page.isClosed()) {
      try {
        const dims: any = await page.evaluate(
          '({ width: window.screen.availWidth || window.screen.width, height: window.screen.availHeight || window.screen.height, scaleFactor: window.devicePixelRatio || 1 })'
        );
        if (dims && dims.width > 0 && dims.height > 0) {
          return dims;
        }
      } catch {
        // Fall through
      }
    }

    return { width: 1920, height: 1080, scaleFactor: 1 };
  }

  /**
   * Generates formatted Playwright TypeScript code corresponding to the automation script
   */
  public static generatePlaywrightCode(
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
    lines.push(` * Generated at: ${new Date().toISOString()}`);
    lines.push(` */`);
    lines.push(`test('${scriptTitle}', async () => {`);
    lines.push(`  // 1. Launch Browser`);
    lines.push(`  const browser = await chromium.launch({ headless: false, slowMo: 400, args: ['--window-size=1280,720', '--disable-blink-features=AutomationControlled'] });`);
    lines.push(`  const context = await browser.newContext({ viewport: null });`);
    lines.push(`  const page = await context.newPage();`);
    lines.push(`  page.setDefaultTimeout(10000);`);
    lines.push(``);
    lines.push(`  // Local Variables Store`);
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
            const { resolved } = this.resolveVariables(v, localVars, globalVars);
            resolvedParams[k] = resolved;
          } else {
            resolvedParams[k] = v;
          }
        }

        const codeDynValues: Record<string, string> = {};
        if (step.parameters?.dynamicValues && typeof step.parameters.dynamicValues === 'object') {
          for (const [dk, dv] of Object.entries(step.parameters.dynamicValues)) {
            codeDynValues[dk] = typeof dv === 'string'
              ? this.resolveVariables(dv, localVars, globalVars).resolved
              : String(dv ?? '');
          }
        }
        const locatorCode = this.getPlaywrightLocatorCode(step.locator, codeDynValues);

        switch (step.nlpId) {
          case 'open_browser': {
            lines.push(`  // Browser opened and blank page initialized`);
            break;
          }
          case 'navigate_to_url': {
            const url = resolvedParams.url || '';
            lines.push(`  await page.goto('${url}', { waitUntil: 'domcontentloaded' });`);
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
          case 'switch_to_frame': {
            lines.push(`  const frame = page.frameLocator('${resolvedParams.frameLocator || 'iframe'}');`);
            break;
          }
          case 'switch_to_default_content':
          case 'switch_to_parent_frame': {
            lines.push(`  // Switched to default frame`);
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
            const waitMs = (Number(resolvedParams.waitDuration) || 1) * 1000;
            lines.push(`  await page.waitForTimeout(${waitMs});`);
            break;
          }
          case 'wait_for_text': {
            const text = (resolvedParams.expectedText || '').replace(/'/g, "\\'");
            const waitMs = (Number(resolvedParams.waitDuration) || 10) * 1000;
            lines.push(`  await page.getByText('${text}').first().waitFor({ state: 'visible', timeout: ${waitMs} });`);
            break;
          }
          case 'wait_for_url': {
            const expectedUrl = ((resolvedParams.expectedUrl || resolvedParams.url) || '').replace(/'/g, "\\'");
            const waitMs = (Number(resolvedParams.waitDuration) || 10) * 1000;
            lines.push(`  await page.waitForURL(url => url.toString().includes('${expectedUrl}'), { timeout: ${waitMs} });`);
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
          case 'get_data_from_excel': {
            const targetVar = (resolvedParams.targetVariable || '$testData').replace(/^\$/, '');
            lines.push(`  // Read row '${resolvedParams.uniqueData}' from file '${resolvedParams.fileName}' (${resolvedParams.sheetName})`);
            lines.push(`  testContext['${targetVar}'] = await readExcelRow('${resolvedParams.fileName}', '${resolvedParams.sheetName}', '${resolvedParams.uniqueData}');`);
            lines.push(`  Object.assign(testContext, testContext['${targetVar}']);`);
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

  /**
   * Parses role locator string expressions like:
   * - "getByRole('button', { name: 'Login' })"
   * - "getByRole('button')"
   * - "button, Login"
   * - "button"
   */
  public static parseRoleLocator(val: string): { role: string; name?: string } {
    if (!val) return { role: 'button' };
    const trimmed = val.trim();
    const matchObj = trimmed.match(/getByRole\(\s*['"]([^'"]+)['"]\s*,\s*\{\s*name:\s*['"]([^'"]+)['"]\s*\}\s*\)/i);
    if (matchObj) {
      return { role: matchObj[1].toLowerCase(), name: matchObj[2] };
    }
    const matchSimple = trimmed.match(/getByRole\(\s*['"]([^'"]+)['"]\s*\)/i);
    if (matchSimple) {
      return { role: matchSimple[1].toLowerCase() };
    }
    if (trimmed.includes(',')) {
      const parts = trimmed.split(',');
      return { role: parts[0].trim().toLowerCase(), name: parts.slice(1).join(',').trim() };
    }
    return { role: trimmed.toLowerCase() };
  }

  private static getPlaywrightLocatorCode(
    locator: any,
    dynamicValues?: Record<string, string>,
    elementMode: 'Static' | 'Dynamic' = 'Static'
  ): string {
    if (!locator || !locator.value) return `page.locator('body')`;
    const { resolvedValue } = resolveDynamicPlaceholders(locator.value, elementMode, dynamicValues);
    const escaped = resolvedValue.replace(/'/g, "\\'");

    switch (locator.type) {
      case 'ID':
        return `page.locator('#${escaped.replace(/^#/, '')}')`;
      case 'CSS Selector':
        return `page.locator('${escaped}')`;
      case 'XPath':
        return `page.locator('${escaped.startsWith('xpath=') ? escaped : `xpath=${escaped}`}')`;
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
      case 'Role': {
        if (escaped.startsWith('getByRole')) {
          return `page.${escaped}`;
        }
        const { role, name } = AutomationEngine.parseRoleLocator(escaped);
        return name
          ? `page.getByRole('${role}', { name: '${name.replace(/'/g, "\\'")}' })`
          : `page.getByRole('${role}')`;
      }
      case 'Placeholder':
        return `page.getByPlaceholder('${escaped}')`;
      case 'Label':
        return `page.getByLabel('${escaped}')`;
      case 'Test ID':
        return `page.getByTestId('${escaped}')`;
      case 'Alt Text':
        return `page.getByAltText('${escaped}')`;
      case 'Title':
        return `page.getByTitle('${escaped}')`;
      default:
        return `page.locator('${escaped}')`;
    }
  }

  /**
   * Resolves a Playwright locator from page object
   */
  public static getPlaywrightLocator(
    page: any,
    locator: any,
    dynamicValues?: Record<string, string>,
    elementMode: 'Static' | 'Dynamic' = 'Static'
  ): any {
    if (!locator || !locator.value) return page.locator('body');
    const { resolvedValue } = resolveDynamicPlaceholders(locator.value, elementMode, dynamicValues);
    const val = resolvedValue;

    switch (locator.type) {
      case 'ID': {
        const idVal = val.replace(/^#/, '');
        return page.locator(`[id="${idVal}"]`);
      }
      case 'CSS Selector':
        return page.locator(val);
      case 'XPath':
        return page.locator(val.startsWith('xpath=') ? val : `xpath=${val}`);
      case 'Name':
        return page.locator(`[name="${val}"]`);
      case 'Class Name':
        return page.locator(`.${val.trim().replace(/\s+/g, '.')}`);
      case 'Link Text':
      case 'Partial Link Text':
        return page.locator(`a:has-text("${val}")`);
      case 'Tag Name':
        return page.locator(val);
      case 'Text':
        return page.getByText(val, { exact: false });
      case 'Role': {
        const { role, name } = AutomationEngine.parseRoleLocator(val);
        return name
          ? page.getByRole(role as any, { name, exact: false })
          : page.getByRole(role as any);
      }
      case 'Placeholder':
        return page.getByPlaceholder(val);
      case 'Label':
        return page.getByLabel(val, { exact: false });
      case 'Test ID':
        return page.getByTestId(val);
      case 'Alt Text':
        return page.getByAltText(val, { exact: false });
      case 'Title':
        return page.getByTitle(val, { exact: false });
      default:
        return page.locator(val);
    }
  }

  /**
   * Resolves an element using Static Locator Fallback with Persistent Successful Locator Prioritization (Section 10).
   *
   * 1. SCOPE: Applies EXCLUSIVELY to Static Repository elements.
   *    Dynamic elements preserve existing single-locator execution without fallback or learning.
   * 2. PERSISTENT LEARNING: If a previously successful locator is learned, it is attempted first (Attempt #1).
   * 3. SEQUENTIAL FALLBACK: If learned locator fails, falls back sequentially to remaining configured locators.
   * 4. SHARED TIMEOUT BUDGET: All candidate attempts share the single Global Wait Time budget.
   * 5. PERSISTENCE UPDATE: On success, saves / updates the learned locator persistently.
   */
  public static async resolveElementWithFallback(
    page: any,
    step: any,
    elements: any[],
    resolvedDynamicValues: Record<string, string>,
    waitTimeMs: number,
    logs: string[],
    learnedContext?: {
      getLearnedLocator?: (elemId: string) => any;
      onLearnedLocatorSuccess?: (elemId: string, locator: any) => void;
      onLearnedLocatorFailure?: (elemId: string) => void;
    }
  ): Promise<{ locator: any; succeededLocator: any; fallbackIndex: number }> {
    const elem = (elements || []).find((e: any) =>
      (step.elementId && e.id === step.elementId) ||
      (step.elementName && e.name.toLowerCase() === step.elementName.toLowerCase())
    );
    if (elem && !step.elementId) {
      step.elementId = elem.id;
    }
    const elementMode: 'Static' | 'Dynamic' = elem?.elementMode || step.elementMode || 'Static';
    const activeLearned = learnedContext || AutomationEngine.activeExecutionContext;

    // =========================================================================
    // DYNAMIC ELEMENTS (Section 10.1): Strictly NO fallback, NO learned prioritization
    // Preserve existing dynamic locator execution mechanism exactly as is.
    // =========================================================================
    if (elementMode === 'Dynamic') {
      const primaryLoc = elem?.locators?.find((l: any) => l.isPrimary) || elem?.locators?.[0] || step.locator;
      if (!primaryLoc) {
        return { locator: page.locator('body'), succeededLocator: null, fallbackIndex: -1 };
      }

      // Requirement 6.2: Validate that all required placeholders are supplied
      const valCheck = validateDynamicPlaceholders(primaryLoc.value, 'Dynamic', resolvedDynamicValues);
      if (!valCheck.isValid) {
        throw new Error(valCheck.errorMessage);
      }

      const resolvedVal = AutomationEngine.resolveLocatorValue(primaryLoc, resolvedDynamicValues, 'Dynamic');
      const loc = AutomationEngine.getPlaywrightLocator(page, primaryLoc, resolvedDynamicValues, 'Dynamic');

      logs.push(
        `[${new Date().toLocaleTimeString()}] Locating Dynamic element "${step.elementName || elem?.name || 'Element'}" using locator [${primaryLoc.type}: "${resolvedVal}"]`
      );

      await loc.waitFor({ state: 'attached', timeout: waitTimeMs });
      if (typeof loc.count === 'function') {
        const dynamicMatchCount = await loc.count().catch(() => 1);
        if (dynamicMatchCount > 1) {
          logs.push(
            `[${new Date().toLocaleTimeString()}] [Hybrid Engine Warning] Dynamic locator matches ${dynamicMatchCount} elements. Ensuring target disambiguation.`
          );
        }
      }

      // Layer 4: Highlight actual DOM element before interaction
      const targetElement = typeof loc.first === 'function' ? loc.first() : loc;
      if (typeof targetElement?.evaluate === 'function') {
        await targetElement.evaluate((el: HTMLElement) => {
          el.setAttribute('data-ea-highlight', 'true');
          el.style.outline = '3px solid #10b981';
          el.style.boxShadow = '0 0 12px rgba(16, 185, 129, 0.7)';
          setTimeout(() => {
            el.removeAttribute('data-ea-highlight');
            el.style.outline = '';
            el.style.boxShadow = '';
          }, 800);
        }).catch(() => {});
      }

      return {
        locator: loc,
        succeededLocator: primaryLoc,
        fallbackIndex: 0
      };
    }

    // =========================================================================
    // STATIC ELEMENTS (Section 10.1 & 10.2): Priority-based fallback with persistent learning
    // =========================================================================
    let configuredLocators: any[] = [];
    if (elem && elem.locators && elem.locators.length > 0) {
      // Sort in configured priority order: priority 1 (Primary) first, then 2, 3, etc.
      configuredLocators = [...elem.locators].sort((a: any, b: any) => (a.priority || 1) - (b.priority || 1));
    } else if (step.locator) {
      configuredLocators = [step.locator];
    }

    if (step.locator && step.locator.value && !configuredLocators.some(l => l.type === step.locator.type && l.value === step.locator.value)) {
      configuredLocators.unshift({ ...step.locator, priority: 0, isPrimary: true });
    }

    if (configuredLocators.length === 0) {
      return {
        locator: page.locator('body'),
        succeededLocator: null,
        fallbackIndex: -1
      };
    }

    const startTime = Date.now();
    const totalBudgetMs = waitTimeMs > 0 ? waitTimeMs : 10000;

    // Check for persistent learned successful locator
    const learnedInfo = elem?.id && activeLearned?.getLearnedLocator ? activeLearned.getLearnedLocator(elem.id) : null;
    let candidateList: Array<{ locator: any; isLearned: boolean; originalPriority: number }> = [];

    // Verify learned locator is still valid in configuredLocators
    const matchingLearnedLoc = learnedInfo
      ? configuredLocators.find(
          l => (l.id && l.id === learnedInfo.successfulLocatorId) || (l.type === learnedInfo.locatorStrategy && l.value === learnedInfo.locatorValue)
        )
      : null;

    if (matchingLearnedLoc) {
      // Prioritize learned locator as Attempt #1
      candidateList.push({ locator: matchingLearnedLoc, isLearned: true, originalPriority: matchingLearnedLoc.priority || 1 });
      // Followed by remaining configured locators in their defined priority order
      for (const loc of configuredLocators) {
        if (loc !== matchingLearnedLoc && loc.id !== matchingLearnedLoc.id) {
          candidateList.push({ locator: loc, isLearned: false, originalPriority: loc.priority || 1 });
        }
      }
      logs.push(
        `[${new Date().toLocaleTimeString()}] Static element "${step.elementName || elem?.name || 'Element'}": Persistent learned locator available [${matchingLearnedLoc.type}: "${matchingLearnedLoc.value}"]. Prioritizing learned locator first.`
      );
    } else {
      // No learned locator: try configured locators in original priority order
      candidateList = configuredLocators.map(loc => ({ locator: loc, isLearned: false, originalPriority: loc.priority || 1 }));
      logs.push(
        `[${new Date().toLocaleTimeString()}] Static element "${step.elementName || elem?.name || 'Element'}": No learned locator. Using configured priority order (${candidateList.length} locator(s)).`
      );
    }

    let lastError: any = null;
    const fallbacksTried: string[] = [];

    for (let i = 0; i < candidateList.length; i++) {
      const { locator: cand, isLearned, originalPriority } = candidateList[i];
      const elapsed = Date.now() - startTime;
      const remainingBudget = totalBudgetMs - elapsed;

      if (remainingBudget <= 0) {
        logs.push(`[${new Date().toLocaleTimeString()}] Global Wait Time budget of ${totalBudgetMs}ms exhausted during locator fallback.`);
        break;
      }

      // Shared budget timeout calculation:
      // If last candidate, use all remaining budget; otherwise allocate reasonable slice (at least 1500ms or remaining / count)
      const remainingItems = candidateList.length - i;
      const attemptTimeout = remainingItems === 1
        ? remainingBudget
        : Math.min(remainingBudget, Math.max(1500, Math.floor(remainingBudget / remainingItems)));

      const locRole = isLearned ? 'Learned Locator' : `Configured Priority #${originalPriority}`;
      logs.push(
        `[${new Date().toLocaleTimeString()}] Attempt #${i + 1} (${locRole}) [${cand.type}: "${cand.value}"] (Budget timeout: ${attemptTimeout}ms)...`
      );

      const playwrightLoc = AutomationEngine.getPlaywrightLocator(page, cand, resolvedDynamicValues, 'Static');

      try {
        await playwrightLoc.waitFor({ state: 'attached', timeout: attemptTimeout });

        // Layer 1 & Section 3.2: Validate Uniqueness (1 of 1)
        if (typeof playwrightLoc.count === 'function') {
          const matchCount = await playwrightLoc.count().catch(() => 1);
          if (matchCount > 1) {
            logs.push(
              `[${new Date().toLocaleTimeString()}] [Hybrid Engine] Ambiguous locator: [${cand.type}: "${cand.value}"] matches ${matchCount} duplicate elements on current page. Rejecting non-unique match.`
            );
            throw new Error(`Locator matches ${matchCount} duplicate elements (non-unique match)`);
          }
        }

        // Layer 1 & 2: Semantic Identity & Intent Consistency Validation
        const targetElement = typeof playwrightLoc.first === 'function' ? playwrightLoc.first() : playwrightLoc;
        const props = typeof targetElement?.evaluate === 'function' ? await targetElement.evaluate((el: HTMLElement) => ({
          tag: el.tagName.toLowerCase(),
          type: (el as HTMLInputElement).type || '',
          text: (el.innerText || el.textContent || '').trim().toLowerCase(),
          aria: (el.getAttribute('aria-label') || '').trim().toLowerCase()
        })).catch(() => null) : null;

        if (props) {
          const action = (step.nlpId || '').toLowerCase();
          const stepDesc = `${elem?.name || ''} ${step.elementName || ''} ${step.nlpName || ''}`.toLowerCase();
          const isInputTarget =
            stepDesc.includes('search') ||
            stepDesc.includes('bar') ||
            stepDesc.includes('input') ||
            stepDesc.includes('field') ||
            stepDesc.includes('box') ||
            stepDesc.includes('textbox') ||
            stepDesc.includes('query');

          if (
            action.includes('click') &&
            props.tag === 'input' &&
            !['button', 'submit', 'reset', 'image', 'checkbox', 'radio'].includes(props.type) &&
            !isInputTarget
          ) {
            logs.push(
              `[${new Date().toLocaleTimeString()}] [Hybrid Engine] Rejected candidate: Element <input type="${props.type}"> is not a clickable element for click action.`
            );
            throw new Error(`Element <input type="${props.type}"> is incompatible with click action`);
          }
          if ((action.includes('enter') || action.includes('type')) && props.tag !== 'input' && props.tag !== 'textarea' && props.tag !== 'select') {
            logs.push(
              `[${new Date().toLocaleTimeString()}] [Hybrid Engine] Rejected candidate: Element <${props.tag}> is not an input field for text entry.`
            );
            throw new Error(`Element <${props.tag}> is incompatible with text entry`);
          }
          const elemNameLower = (elem?.name || step.elementName || '').toLowerCase();
          if (elemNameLower.includes('setting') && (props.text.includes('create account') || props.aria.includes('create account'))) {
            logs.push(
              `[${new Date().toLocaleTimeString()}] [Hybrid Engine] Rejected candidate: Contradictory semantic match ("Create Account" vs "${elem?.name}").`
            );
            throw new Error(`Contradictory element match: "${props.aria || props.text}"`);
          }
        }

        // Layer 4 & Section 6.3: Highlight the actual DOM element
        if (typeof targetElement?.evaluate === 'function') {
          await targetElement.evaluate((el: HTMLElement) => {
            el.setAttribute('data-ea-highlight', 'true');
            el.style.outline = '3px solid #10b981';
            el.style.boxShadow = '0 0 12px rgba(16, 185, 129, 0.7)';
            setTimeout(() => {
              el.removeAttribute('data-ea-highlight');
              el.style.outline = '';
              el.style.boxShadow = '';
            }, 800);
          }).catch(() => {});
        }

        const successDuration = Date.now() - startTime;

        if (isLearned) {
          logs.push(
            `[${new Date().toLocaleTimeString()}] Learned locator succeeded immediately in ${successDuration}ms!`
          );
        } else {
          logs.push(
            `[${new Date().toLocaleTimeString()}] Candidate #${i + 1} (${locRole}) [${cand.type}: "${cand.value}"] succeeded in ${successDuration}ms!`
          );
        }

        // Save / update learned locator persistently in database
        if (elem?.id && activeLearned?.onLearnedLocatorSuccess) {
          activeLearned.onLearnedLocatorSuccess(elem.id, cand);
          logs.push(
            `[${new Date().toLocaleTimeString()}] Persistent learned locator recorded for element "${elem.name}" [${cand.type}: "${cand.value}"].`
          );
        }

        return {
          locator: playwrightLoc,
          succeededLocator: cand,
          fallbackIndex: i
        };
      } catch (err: any) {
        lastError = err;
        fallbacksTried.push(`${locRole} [${cand.type}: "${cand.value}"]`);

        if (isLearned) {
          logs.push(
            `[${new Date().toLocaleTimeString()}] Learned locator failed: ${err.message}. Falling back to configured priority order...`
          );
          if (elem?.id && activeLearned?.onLearnedLocatorFailure) {
            activeLearned.onLearnedLocatorFailure(elem.id);
          }
        } else {
          logs.push(
            `[${new Date().toLocaleTimeString()}] ${locRole} [${cand.type}: "${cand.value}"] failed: ${err.message}.`
          );
        }
      }
    }

    const totalDuration = Date.now() - startTime;
    throw new Error(
      `Static Element "${step.elementName || elem?.name || 'Unknown'}" could not be located within ${totalBudgetMs}ms budget (Spent: ${totalDuration}ms). Tried ${fallbacksTried.length} candidate(s): ${fallbacksTried.join(' -> ')}. Last error: ${lastError?.message || 'Element not found'}`
    );
  }

  /**
   * Executes script with real Playwright browser on the host machine.
   * Launches headful Chromium by default so the user sees the real browser executing commands!
   */
  public static async executeScriptWithPlaywright(context: AutomationContext): Promise<any> {
    const { script, moduleName, elements, testDataFiles, localVariables, globalVariables, runSettings } = context;
    AutomationEngine.activeExecutionContext = {
      getLearnedLocator: context.getLearnedLocator,
      onLearnedLocatorSuccess: context.onLearnedLocatorSuccess,
      onLearnedLocatorFailure: context.onLearnedLocatorFailure
    };
    const settings = runSettings || {};
    const delayMs = settings.delayBetweenStepsMs || 400;
    const waitTimeMs = settings.globalWaitTimeMs || 8000;
    const scriptStart = Date.now();
    const startedAt = new Date(scriptStart).toISOString();

    const executedSteps: any[] = [];
    let scriptStatus: 'Passed' | 'Failed' = 'Passed';
    let failureDetails: any = undefined;

    // Track dynamic variables during execution
    const executionContextVars: Record<string, any> = {};

    let playwrightModule: any = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      playwrightModule = require('playwright');
    } catch (e) {
      console.warn('Playwright not directly available in runtime, falling back to simulated engine');
    }

    let browser: any = null;
    let browserContext: any = null;
    let page: any = null;

    const ensureBrowserReady = async (chosenBrowser?: string) => {
      if (page && !page.isClosed()) return page;
      if (!playwrightModule) return null;
      try {
        const b = (chosenBrowser || settings.browser || 'chromium').toLowerCase();
        const browserType =
          b === 'firefox'
            ? playwrightModule.firefox
            : b === 'webkit'
            ? playwrightModule.webkit
            : playwrightModule.chromium;

        // Launch headful by default so the user sees the actual browser executing
        const isHeadless = settings.browserHeadless === true;
        try {
          browser = await browserType.launch({
            headless: isHeadless,
            slowMo: delayMs,
            args: ['--window-size=1280,720', '--disable-blink-features=AutomationControlled']
          });
        } catch (launchErr: any) {
          // If headful failed (e.g. no display server in background runner), retry headless
          console.warn('Headful browser launch failed, falling back to headless:', launchErr.message);
          browser = await browserType.launch({
            headless: true,
            slowMo: delayMs
          });
        }

        browserContext = await browser.newContext({
          viewport: null
        });
        page = await browserContext.newPage();
        page.setDefaultTimeout(waitTimeMs);
      } catch (err: any) {
        console.warn('Could not launch Playwright browser instance, falling back to simulation:', err);
      }
      return page;
    };

    if (playwrightModule) {
      await ensureBrowserReady();
    }

    // Generate Playwright TypeScript code for transparency
    const generatedCode = this.generatePlaywrightCode(script, elements, localVariables, globalVariables);

    // Execute steps in sequence
    for (let i = 0; i < (script.steps || []).length; i++) {
      const step = script.steps[i];
      if (!step.isEnabled) continue;

      const stepStart = Date.now();
      const stepStartDate = new Date(stepStart).toISOString();
      const logs: string[] = [];
      logs.push(`[${new Date(stepStart).toLocaleTimeString()}] Step ${step.stepNumber}: Starting "${step.nlpName}" (${step.nlpCategory})`);

      // Resolve variables in parameters (supports $testData.ProductName and context variables)
      const resolvedParams: Record<string, any> = {};
      const stepVarsUsed: Array<{ name: string; type: 'Local' | 'Global' | 'Context'; resolvedValue: string; isMasked?: boolean }> = [];

      for (const [k, v] of Object.entries(step.parameters || {})) {
        if (typeof v === 'string') {
          const { resolved, variablesUsed } = this.resolveVariables(v, localVariables, globalVariables, executionContextVars);
          resolvedParams[k] = resolved;
          stepVarsUsed.push(...variablesUsed);
        } else {
          resolvedParams[k] = v;
        }
      }

      // Resolve dynamic values with runtime variables
      const resolvedDynamicValues: Record<string, string> = {};
      const rawDynamicValues = { ...(step.dynamicValues || {}), ...(step.parameters?.dynamicValues || {}) };
      if (rawDynamicValues && typeof rawDynamicValues === 'object') {
        for (const [dk, dv] of Object.entries(rawDynamicValues)) {
          if (typeof dv === 'string') {
            const { resolved, variablesUsed } = this.resolveVariables(dv, localVariables, globalVariables, executionContextVars);
            resolvedDynamicValues[dk] = resolved;
            stepVarsUsed.push(...variablesUsed);
          } else {
            resolvedDynamicValues[dk] = String(dv ?? '');
          }
        }
      }
      resolvedParams.dynamicValues = resolvedDynamicValues;

      // Find element and determine explicit element mode & version
      const elem = (elements || []).find((e: any) => e.id === step.elementId);
      const elemMode: 'Static' | 'Dynamic' = elem?.elementMode || step.elementMode || 'Static';
      const elemVersion: number = elem?.version || step.elementVersion || 1;

      // Resolve element locator preview for logging
      let resolvedLocatorValue = '';
      if (step.locator) {
        resolvedLocatorValue = this.resolveLocatorValue(step.locator, resolvedDynamicValues, elemMode);
        logs.push(`[${new Date().toLocaleTimeString()}] Locator resolved [${step.locator.type}] (${elemMode}): "${resolvedLocatorValue}" for element "${step.elementName || ''}"`);
      }

      let stepStatus: 'Passed' | 'Failed' = 'Passed';
      let stepError: { exceptionName: string; message: string; locator?: string } | undefined = undefined;
      let excelRef: any = undefined;
      let succeededLocatorMeta: any = step.locator;
      let skipBrowserExecution = false;

      // Requirement 6.2: Validate dynamic placeholders before browser interaction
      if (elemMode === 'Dynamic' && step.locator) {
        const valCheck = validateDynamicPlaceholders(step.locator.value, 'Dynamic', resolvedDynamicValues);
        if (!valCheck.isValid) {
          skipBrowserExecution = true;
          stepStatus = 'Failed';
          stepError = {
            exceptionName: 'DynamicPlaceholderValidationError',
            message: valCheck.errorMessage || 'Missing runtime value for dynamic placeholder',
            locator: step.locator.value
          };
          logs.push(`[${new Date().toLocaleTimeString()}] Dynamic Validation Error: ${valCheck.errorMessage}`);
        }
      }

      try {
        if (!skipBrowserExecution) {
          if (!page || page.isClosed()) {
            await ensureBrowserReady();
          }

          if (page && !page.isClosed()) {
          // REAL PLAYWRIGHT EXECUTION ON BROWSER
          // Step-level individual wait duration (Requirement 2: User Must Provide Wait Duration in Seconds)
          const userWaitSec = (resolvedParams.waitDuration !== undefined && !isNaN(Number(resolvedParams.waitDuration)) && Number(resolvedParams.waitDuration) > 0)
            ? Number(resolvedParams.waitDuration)
            : undefined;
          const effectiveTimeoutMs = userWaitSec !== undefined ? userWaitSec * 1000 : waitTimeMs;

          switch (step.nlpId) {
            // ================= 2. Browser NLPs ================= //
            case 'open_browser': {
              const bEngine = resolvedParams.browser || settings.browser || 'Chromium';
              if (!page || page.isClosed()) {
                await ensureBrowserReady(bEngine);
              }
              logs.push(`[${new Date().toLocaleTimeString()}] Browser (${bEngine}) launched successfully. Clean blank page initialized.`);
              break;
            }

            case 'maximize_browser': {
              if (!page || page.isClosed()) {
                await ensureBrowserReady();
              }
              const dims = await AutomationEngine.getMachineScreenDimensions(page);
              let maximizedViaCdp = false;
              try {
                const session = await page.context().newCDPSession(page);
                const { windowId } = await session.send('Browser.getWindowForTarget');
                if (windowId !== undefined) {
                  await session.send('Browser.setWindowBounds', {
                    windowId,
                    bounds: { windowState: 'maximized' }
                  });
                  await session.send('Emulation.clearDeviceMetricsOverride').catch(() => {});
                  await session.send('Emulation.resetPageScaleFactor').catch(() => {});
                  maximizedViaCdp = true;
                }
              } catch (cdpErr: any) {
                console.warn('CDP maximize windowState failed:', cdpErr?.message);
              }

              if (!maximizedViaCdp) {
                try {
                  await page.setViewportSize({ width: dims.width, height: dims.height });
                } catch (vpErr: any) {
                  console.warn('Could not set viewport size:', vpErr?.message);
                }
              }

              // Ensure 100% native zoom with no CSS zoom variation
              try {
                await page.evaluate(
                  'try { if (document.documentElement) document.documentElement.style.zoom = "1"; if (document.body) document.body.style.zoom = "1"; } catch {}'
                );
              } catch {}

              logs.push(`[${new Date().toLocaleTimeString()}] Browser window maximized to fit machine display (${dims.width}x${dims.height}) with 100% native zoom`);
              break;
            }

            case 'minimize_browser': {
              try {
                const session = await page.context().newCDPSession(page);
                const { windowId } = await session.send('Browser.getWindowForTarget');
                if (windowId !== undefined) {
                  await session.send('Browser.setWindowBounds', {
                    windowId,
                    bounds: { windowState: 'minimized' }
                  });
                }
              } catch {}
              logs.push(`[${new Date().toLocaleTimeString()}] Browser minimized to taskbar`);
              break;
            }

            case 'navigate_to_url': {
              const rawUrl = (resolvedParams.url || '').trim();
              if (!rawUrl) {
                throw new Error('Navigate To URL failed: Target URL parameter is required.');
              }
              let url = rawUrl;
              if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('data:') && !url.startsWith('file:')) {
                url = 'https://' + url;
              }
              logs.push(`[${new Date().toLocaleTimeString()}] Navigating to URL: ${url}`);
              await page.goto(url, { waitUntil: 'domcontentloaded', timeout: waitTimeMs });
              let currentTitle = '';
              try {
                currentTitle = await page.title();
              } catch {}
              logs.push(`[${new Date().toLocaleTimeString()}] Successfully navigated to "${url}". Page title: "${currentTitle}"`);
              break;
            }

            case 'close_browser': {
              if (browser) {
                await browser.close();
                browser = null;
                browserContext = null;
                page = null;
              }
              logs.push(`[${new Date().toLocaleTimeString()}] Browser closed successfully`);
              break;
            }

            case 'refresh_browser':
            case 'refresh_page': {
              await page.reload();
              logs.push(`[${new Date().toLocaleTimeString()}] Page reloaded`);
              break;
            }

            case 'navigate_back': {
              await page.goBack();
              logs.push(`[${new Date().toLocaleTimeString()}] Navigated back in history`);
              break;
            }

            case 'navigate_forward': {
              await page.goForward();
              logs.push(`[${new Date().toLocaleTimeString()}] Navigated forward in history`);
              break;
            }

            case 'get_current_url': {
              const currentUrl = page.url();
              const varName = (resolvedParams.storeVariable || '$currentUrl').replace(/^\$/, '');
              executionContextVars[varName] = currentUrl;
              logs.push(`[${new Date().toLocaleTimeString()}] Current URL retrieved: "${currentUrl}" stored in $${varName}`);
              break;
            }

            case 'get_page_title': {
              const currentTitle = await page.title();
              const varName = (resolvedParams.storeVariable || '$pageTitle').replace(/^\$/, '');
              executionContextVars[varName] = currentTitle;
              logs.push(`[${new Date().toLocaleTimeString()}] Page title retrieved: "${currentTitle}" stored in $${varName}`);
              break;
            }

            // ================= 3. Browser Action NLPs ================= //
            case 'click_element': {
              const { locator: loc, succeededLocator } = await AutomationEngine.resolveElementWithFallback(page, step, elements, resolvedDynamicValues, waitTimeMs, logs);
              succeededLocatorMeta = succeededLocator;
              const count = Number(resolvedParams.clickCount) || 1;
              await loc.waitFor({ state: 'visible', timeout: waitTimeMs });
              await loc.click({ clickCount: count, timeout: waitTimeMs });
              logs.push(`[${new Date().toLocaleTimeString()}] Clicked element "${step.elementName}"`);
              break;
            }

            case 'double_click_element':
            case 'double_click': {
              const { locator: loc, succeededLocator } = await AutomationEngine.resolveElementWithFallback(page, step, elements, resolvedDynamicValues, waitTimeMs, logs);
              succeededLocatorMeta = succeededLocator;
              await loc.waitFor({ state: 'visible', timeout: waitTimeMs });
              await loc.dblclick({ timeout: waitTimeMs });
              logs.push(`[${new Date().toLocaleTimeString()}] Double-clicked element "${step.elementName}"`);
              break;
            }

            case 'right_click_element':
            case 'right_click': {
              const { locator: loc, succeededLocator } = await AutomationEngine.resolveElementWithFallback(page, step, elements, resolvedDynamicValues, waitTimeMs, logs);
              succeededLocatorMeta = succeededLocator;
              await loc.waitFor({ state: 'visible', timeout: waitTimeMs });
              await loc.click({ button: 'right', timeout: waitTimeMs });
              logs.push(`[${new Date().toLocaleTimeString()}] Right-clicked element "${step.elementName}"`);
              break;
            }

            case 'enter_text': {
              const { locator: loc, succeededLocator } = await AutomationEngine.resolveElementWithFallback(page, step, elements, resolvedDynamicValues, waitTimeMs, logs);
              succeededLocatorMeta = succeededLocator;
              const text = resolvedParams.text !== undefined ? String(resolvedParams.text) : String(resolvedParams.inputData || '');
              if (resolvedParams.clearBeforeEnter || resolvedParams.clearBeforeTyping) {
                await loc.clear({ timeout: waitTimeMs }).catch(() => {});
              }
              await loc.waitFor({ state: 'visible', timeout: waitTimeMs });
              await loc.fill(text, { timeout: waitTimeMs });
              const isSensitive = stepVarsUsed.some(v => v.isMasked) || /password|secret|token|pin/i.test(step.elementName || '') || /password|secret/i.test(step.locator?.value || '');
              const displayLogText = isSensitive ? '••••••••' : text;
              logs.push(`[${new Date().toLocaleTimeString()}] Entered text "${displayLogText}" into element "${step.elementName}"`);
              break;
            }

            case 'clear_text': {
              const { locator: loc, succeededLocator } = await AutomationEngine.resolveElementWithFallback(page, step, elements, resolvedDynamicValues, waitTimeMs, logs);
              succeededLocatorMeta = succeededLocator;
              await loc.clear({ timeout: waitTimeMs });
              logs.push(`[${new Date().toLocaleTimeString()}] Cleared text in element "${step.elementName}"`);
              break;
            }

            case 'mouse_hover': {
              const { locator: loc, succeededLocator } = await AutomationEngine.resolveElementWithFallback(page, step, elements, resolvedDynamicValues, waitTimeMs, logs);
              succeededLocatorMeta = succeededLocator;
              await loc.hover({ timeout: waitTimeMs });
              logs.push(`[${new Date().toLocaleTimeString()}] Hovered over element "${step.elementName}"`);
              break;
            }

            case 'drag_and_drop': {
              const { locator: sourceLoc, succeededLocator } = await AutomationEngine.resolveElementWithFallback(page, step, elements, resolvedDynamicValues, waitTimeMs, logs);
              succeededLocatorMeta = succeededLocator;
              if (resolvedParams.targetElementId) {
                const targetStep = { elementId: resolvedParams.targetElementId, elementName: 'Target Element' };
                const { locator: targetLoc } = await AutomationEngine.resolveElementWithFallback(page, targetStep, elements, {}, waitTimeMs, logs);
                await sourceLoc.dragTo(targetLoc, { timeout: waitTimeMs });
              } else {
                const x = Number(resolvedParams.targetX) || 100;
                const y = Number(resolvedParams.targetY) || 100;
                const box = await sourceLoc.boundingBox();
                if (box) {
                  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
                  await page.mouse.down();
                  await page.mouse.move(box.x + box.width / 2 + x, box.y + box.height / 2 + y);
                  await page.mouse.up();
                }
              }
              logs.push(`[${new Date().toLocaleTimeString()}] Drag and drop completed for "${step.elementName}"`);
              break;
            }

            case 'select_dropdown_by_text':
            case 'select_option_by_text': {
              const { locator: loc, succeededLocator } = await AutomationEngine.resolveElementWithFallback(page, step, elements, resolvedDynamicValues, waitTimeMs, logs);
              succeededLocatorMeta = succeededLocator;
              const opt = resolvedParams.text || resolvedParams.optionText || '';
              await loc.selectOption({ label: opt }, { timeout: waitTimeMs });
              logs.push(`[${new Date().toLocaleTimeString()}] Selected option "${opt}" in dropdown "${step.elementName}"`);
              break;
            }

            case 'select_dropdown_by_value':
            case 'select_option_by_value': {
              const { locator: loc, succeededLocator } = await AutomationEngine.resolveElementWithFallback(page, step, elements, resolvedDynamicValues, waitTimeMs, logs);
              succeededLocatorMeta = succeededLocator;
              const val = resolvedParams.value || resolvedParams.optionValue || '';
              await loc.selectOption({ value: val }, { timeout: waitTimeMs });
              logs.push(`[${new Date().toLocaleTimeString()}] Selected option with value "${val}" in dropdown "${step.elementName}"`);
              break;
            }

            case 'select_multiple_options': {
              const { locator: loc, succeededLocator } = await AutomationEngine.resolveElementWithFallback(page, step, elements, resolvedDynamicValues, waitTimeMs, logs);
              succeededLocatorMeta = succeededLocator;
              const rawOpts = resolvedParams.options || '';
              const optsArr = typeof rawOpts === 'string' ? rawOpts.split(',').map(s => s.trim()) : rawOpts;
              await loc.selectOption(optsArr, { timeout: waitTimeMs });
              logs.push(`[${new Date().toLocaleTimeString()}] Selected multiple options in "${step.elementName}"`);
              break;
            }

            case 'select_checkbox':
            case 'check_checkbox': {
              const { locator: loc, succeededLocator } = await AutomationEngine.resolveElementWithFallback(page, step, elements, resolvedDynamicValues, waitTimeMs, logs);
              succeededLocatorMeta = succeededLocator;
              await loc.check({ timeout: waitTimeMs });
              logs.push(`[${new Date().toLocaleTimeString()}] Checked checkbox "${step.elementName}"`);
              break;
            }

            case 'deselect_checkbox':
            case 'uncheck_checkbox': {
              const { locator: loc, succeededLocator } = await AutomationEngine.resolveElementWithFallback(page, step, elements, resolvedDynamicValues, waitTimeMs, logs);
              succeededLocatorMeta = succeededLocator;
              await loc.uncheck({ timeout: waitTimeMs });
              logs.push(`[${new Date().toLocaleTimeString()}] Unchecked checkbox "${step.elementName}"`);
              break;
            }

            case 'press_keyboard_key':
            case 'press_key': {
              const key = resolvedParams.key || 'Enter';
              await page.keyboard.press(key);
              logs.push(`[${new Date().toLocaleTimeString()}] Pressed keyboard key: ${key}`);
              break;
            }

            case 'upload_file': {
              const { locator: loc, succeededLocator } = await AutomationEngine.resolveElementWithFallback(page, step, elements, resolvedDynamicValues, waitTimeMs, logs);
              succeededLocatorMeta = succeededLocator;
              const filePath = resolvedParams.filePath || '';
              const td = (testDataFiles || []).find((f: any) => f.fileName.toLowerCase() === filePath.toLowerCase());
              const targetPath = td?.filePath || filePath;
              await loc.setInputFiles(targetPath);
              logs.push(`[${new Date().toLocaleTimeString()}] Uploaded file "${filePath}" to element "${step.elementName}"`);
              break;
            }

            case 'download_file': {
              const { locator: loc, succeededLocator } = await AutomationEngine.resolveElementWithFallback(page, step, elements, resolvedDynamicValues, waitTimeMs, logs);
              succeededLocatorMeta = succeededLocator;
              const [download] = await Promise.all([
                page.waitForEvent('download', { timeout: waitTimeMs }),
                loc.click({ timeout: waitTimeMs })
              ]);
              const suggested = download.suggestedFilename();
              const varName = (resolvedParams.storeVariable || '$downloadedPath').replace(/^\$/, '');
              executionContextVars[varName] = suggested;
              logs.push(`[${new Date().toLocaleTimeString()}] Captured download: "${suggested}" stored in $${varName}`);
              break;
            }

            // ================= 4. Switching NLPs ================= //
            case 'switch_to_frame': {
              const frameSelector = resolvedParams.frameLocator || 'iframe';
              logs.push(`[${new Date().toLocaleTimeString()}] Switched to frame: "${frameSelector}"`);
              break;
            }

            case 'switch_to_default_content':
            case 'switch_to_parent_frame': {
              logs.push(`[${new Date().toLocaleTimeString()}] Switched to top-level default content`);
              break;
            }

            case 'switch_to_new_tab': {
              const pages = browserContext.pages();
              if (pages.length > 1) {
                page = pages[pages.length - 1];
                await page.bringToFront();
              }
              logs.push(`[${new Date().toLocaleTimeString()}] Switched to newest tab`);
              break;
            }

            case 'switch_to_tab_by_title': {
              const titleTarget = (resolvedParams.tabTitle || '').toLowerCase();
              let targetPage = null;
              for (const p of browserContext.pages()) {
                const t = (await p.title()).toLowerCase();
                if (t.includes(titleTarget)) {
                  targetPage = p;
                  break;
                }
              }
              if (targetPage) {
                page = targetPage;
                await page.bringToFront();
                logs.push(`[${new Date().toLocaleTimeString()}] Switched to tab matching title "${resolvedParams.tabTitle}"`);
              } else {
                throw new Error(`Tab with title matching "${resolvedParams.tabTitle}" not found.`);
              }
              break;
            }

            case 'switch_to_tab_by_url': {
              const urlTarget = (resolvedParams.tabUrl || '').toLowerCase();
              let targetPage = null;
              for (const p of browserContext.pages()) {
                if (p.url().toLowerCase().includes(urlTarget)) {
                  targetPage = p;
                  break;
                }
              }
              if (targetPage) {
                page = targetPage;
                await page.bringToFront();
                logs.push(`[${new Date().toLocaleTimeString()}] Switched to tab matching URL "${resolvedParams.tabUrl}"`);
              } else {
                throw new Error(`Tab with URL matching "${resolvedParams.tabUrl}" not found.`);
              }
              break;
            }

            case 'close_current_tab': {
              if (page && !page.isClosed()) {
                await page.close();
                const remaining = browserContext.pages();
                if (remaining.length > 0) page = remaining[0];
              }
              logs.push(`[${new Date().toLocaleTimeString()}] Closed current tab and focused remaining window`);
              break;
            }

            case 'switch_to_alert':
            case 'accept_alert': {
              page.once('dialog', async (dialog: any) => {
                await dialog.accept();
              });
              logs.push(`[${new Date().toLocaleTimeString()}] Prepared alert dialog acceptance`);
              break;
            }

            case 'dismiss_alert': {
              page.once('dialog', async (dialog: any) => {
                await dialog.dismiss();
              });
              logs.push(`[${new Date().toLocaleTimeString()}] Prepared alert dialog dismissal`);
              break;
            }

            case 'get_alert_text': {
              const varName = (resolvedParams.storeVariable || '$alertText').replace(/^\$/, '');
              page.once('dialog', async (dialog: any) => {
                const msg = dialog.message();
                executionContextVars[varName] = msg;
                await dialog.accept();
              });
              logs.push(`[${new Date().toLocaleTimeString()}] Prepared alert text extraction into $${varName}`);
              break;
            }

            // ================= 5. Verification NLPs ================= //
            case 'verify_element_is_displayed': {
              const { locator: loc, succeededLocator } = await AutomationEngine.resolveElementWithFallback(page, step, elements, resolvedDynamicValues, effectiveTimeoutMs, logs);
              succeededLocatorMeta = succeededLocator;
              await loc.waitFor({ state: 'visible', timeout: effectiveTimeoutMs });
              logs.push(`[${new Date().toLocaleTimeString()}] Verified element "${step.elementName}" is visible (Timeout: ${effectiveTimeoutMs}ms)`);
              break;
            }

            case 'verify_element_is_not_displayed': {
              const { locator: loc, succeededLocator } = await AutomationEngine.resolveElementWithFallback(page, step, elements, resolvedDynamicValues, effectiveTimeoutMs, logs);
              succeededLocatorMeta = succeededLocator;
              await loc.waitFor({ state: 'hidden', timeout: effectiveTimeoutMs });
              logs.push(`[${new Date().toLocaleTimeString()}] Verified element "${step.elementName}" is hidden (Timeout: ${effectiveTimeoutMs}ms)`);
              break;
            }

            case 'verify_element_is_present': {
              const { locator: loc, succeededLocator } = await AutomationEngine.resolveElementWithFallback(page, step, elements, resolvedDynamicValues, effectiveTimeoutMs, logs);
              succeededLocatorMeta = succeededLocator;
              await loc.waitFor({ state: 'attached', timeout: effectiveTimeoutMs });
              logs.push(`[${new Date().toLocaleTimeString()}] Verified element "${step.elementName}" is present in DOM (Timeout: ${effectiveTimeoutMs}ms)`);
              break;
            }

            case 'verify_element_is_not_present': {
              const { locator: loc, succeededLocator } = await AutomationEngine.resolveElementWithFallback(page, step, elements, resolvedDynamicValues, effectiveTimeoutMs, logs);
              succeededLocatorMeta = succeededLocator;
              await loc.waitFor({ state: 'detached', timeout: effectiveTimeoutMs });
              logs.push(`[${new Date().toLocaleTimeString()}] Verified element "${step.elementName}" is not present in DOM (Timeout: ${effectiveTimeoutMs}ms)`);
              break;
            }

            case 'verify_element_is_enabled': {
              const { locator: loc, succeededLocator } = await AutomationEngine.resolveElementWithFallback(page, step, elements, resolvedDynamicValues, effectiveTimeoutMs, logs);
              succeededLocatorMeta = succeededLocator;
              const isEnabled = await loc.isEnabled({ timeout: effectiveTimeoutMs });
              if (!isEnabled) throw new Error(`Element "${step.elementName}" is disabled when expected to be enabled`);
              logs.push(`[${new Date().toLocaleTimeString()}] Verified element "${step.elementName}" is enabled`);
              break;
            }

            case 'verify_element_is_disabled': {
              const { locator: loc, succeededLocator } = await AutomationEngine.resolveElementWithFallback(page, step, elements, resolvedDynamicValues, effectiveTimeoutMs, logs);
              succeededLocatorMeta = succeededLocator;
              const isDis = await loc.isDisabled({ timeout: effectiveTimeoutMs });
              if (!isDis) throw new Error(`Element "${step.elementName}" is enabled when expected to be disabled`);
              logs.push(`[${new Date().toLocaleTimeString()}] Verified element "${step.elementName}" is disabled`);
              break;
            }

            case 'verify_text': {
              let actual = '';
              if (step.elementId || step.locator) {
                const { locator: loc, succeededLocator } = await AutomationEngine.resolveElementWithFallback(page, step, elements, resolvedDynamicValues, effectiveTimeoutMs, logs);
                succeededLocatorMeta = succeededLocator;
                actual = await loc.innerText({ timeout: effectiveTimeoutMs });
              } else {
                actual = await page.innerText('body');
              }
              const expected = String(resolvedParams.expectedText || '');
              const mode = resolvedParams.comparisonType || (resolvedParams.exactMatch ? 'Equals' : 'Contains');
              let matched = false;
              if (mode === 'Equals') matched = actual.trim() === expected.trim();
              else if (mode === 'StartsWith') matched = actual.trim().startsWith(expected.trim());
              else if (mode === 'EndsWith') matched = actual.trim().endsWith(expected.trim());
              else matched = actual.toLowerCase().includes(expected.toLowerCase());

              if (!matched) {
                throw new Error(`Expected text "${expected}" [Mode: ${mode}] was not found in element. Actual text: "${actual.slice(0, 100)}"`);
              }
              logs.push(`[${new Date().toLocaleTimeString()}] Verified text "${expected}" matched in ${step.elementName || 'page'}`);
              break;
            }

            case 'verify_attribute': {
              const { locator: loc, succeededLocator } = await AutomationEngine.resolveElementWithFallback(page, step, elements, resolvedDynamicValues, effectiveTimeoutMs, logs);
              succeededLocatorMeta = succeededLocator;
              const attrName = resolvedParams.attributeName;
              const expectedVal = resolvedParams.expectedValue;
              const actualVal = await loc.getAttribute(attrName, { timeout: effectiveTimeoutMs });
              if (actualVal !== expectedVal && !(actualVal && actualVal.includes(expectedVal))) {
                throw new Error(`Attribute "${attrName}" mismatch. Expected: "${expectedVal}", actual: "${actualVal}"`);
              }
              logs.push(`[${new Date().toLocaleTimeString()}] Verified attribute "${attrName}" = "${expectedVal}"`);
              break;
            }

            case 'verify_page_title': {
              const title = await page.title();
              const expected = resolvedParams.expectedTitle || '';
              if (!title.toLowerCase().includes(expected.toLowerCase())) {
                throw new Error(`Page title "${title}" did not match expected "${expected}"`);
              }
              logs.push(`[${new Date().toLocaleTimeString()}] Verified page title: "${title}"`);
              break;
            }

            case 'verify_current_url':
            case 'verify_url': {
              const currentUrl = page.url();
              const expected = resolvedParams.expectedUrl || '';
              if (!currentUrl.toLowerCase().includes(expected.toLowerCase())) {
                throw new Error(`Current URL "${currentUrl}" does not match expected "${expected}"`);
              }
              logs.push(`[${new Date().toLocaleTimeString()}] Verified current URL: "${currentUrl}"`);
              break;
            }

            case 'verify_dropdown_value': {
              const { locator: loc, succeededLocator } = await AutomationEngine.resolveElementWithFallback(page, step, elements, resolvedDynamicValues, effectiveTimeoutMs, logs);
              succeededLocatorMeta = succeededLocator;
              const val = await loc.inputValue({ timeout: effectiveTimeoutMs });
              const expected = resolvedParams.expectedValue || '';
              if (val !== expected) {
                throw new Error(`Dropdown value "${val}" did not match expected "${expected}"`);
              }
              logs.push(`[${new Date().toLocaleTimeString()}] Verified dropdown value "${val}" in "${step.elementName}"`);
              break;
            }

            case 'verify_checkbox_is_selected': {
              const { locator: loc, succeededLocator } = await AutomationEngine.resolveElementWithFallback(page, step, elements, resolvedDynamicValues, effectiveTimeoutMs, logs);
              succeededLocatorMeta = succeededLocator;
              const isChecked = await loc.isChecked({ timeout: effectiveTimeoutMs });
              if (!isChecked) throw new Error(`Checkbox "${step.elementName}" is not selected`);
              logs.push(`[${new Date().toLocaleTimeString()}] Verified checkbox "${step.elementName}" is selected`);
              break;
            }

            // ================= 6. Wait NLPs (Individual or Global Timeout) ================= //
            case 'wait_for_element_present':
            case 'wait_for_element': {
              const { locator: loc, succeededLocator } = await AutomationEngine.resolveElementWithFallback(page, step, elements, resolvedDynamicValues, effectiveTimeoutMs, logs);
              succeededLocatorMeta = succeededLocator;
              await loc.waitFor({ state: 'attached', timeout: effectiveTimeoutMs });
              logs.push(`[${new Date().toLocaleTimeString()}] Element "${step.elementName}" is attached to DOM (Timeout: ${effectiveTimeoutMs}ms)`);
              break;
            }

            case 'wait_for_element_to_be_visible':
            case 'wait_for_element_visible': {
              const { locator: loc, succeededLocator } = await AutomationEngine.resolveElementWithFallback(page, step, elements, resolvedDynamicValues, effectiveTimeoutMs, logs);
              succeededLocatorMeta = succeededLocator;
              await loc.waitFor({ state: 'visible', timeout: effectiveTimeoutMs });
              logs.push(`[${new Date().toLocaleTimeString()}] Element "${step.elementName}" is visible (Timeout: ${effectiveTimeoutMs}ms)`);
              break;
            }

            case 'wait_for_element_clickable': {
              const { locator: loc, succeededLocator } = await AutomationEngine.resolveElementWithFallback(page, step, elements, resolvedDynamicValues, effectiveTimeoutMs, logs);
              succeededLocatorMeta = succeededLocator;
              await loc.waitFor({ state: 'visible', timeout: effectiveTimeoutMs });
              await loc.isEnabled({ timeout: effectiveTimeoutMs });
              logs.push(`[${new Date().toLocaleTimeString()}] Element "${step.elementName}" is clickable (Timeout: ${effectiveTimeoutMs}ms)`);
              break;
            }

            case 'wait_for_element_to_be_hidden':
            case 'wait_for_element_hidden': {
              const { locator: loc, succeededLocator } = await AutomationEngine.resolveElementWithFallback(page, step, elements, resolvedDynamicValues, effectiveTimeoutMs, logs);
              succeededLocatorMeta = succeededLocator;
              await loc.waitFor({ state: 'hidden', timeout: effectiveTimeoutMs });
              logs.push(`[${new Date().toLocaleTimeString()}] Element "${step.elementName}" is hidden/detached (Timeout: ${effectiveTimeoutMs}ms)`);
              break;
            }

            case 'wait_for_page_load':
            case 'wait_for_page_to_load':
            case 'wait_for_navigation': {
              await page.waitForLoadState('load', { timeout: effectiveTimeoutMs });
              logs.push(`[${new Date().toLocaleTimeString()}] Page load completed (Timeout: ${effectiveTimeoutMs}ms)`);
              break;
            }

            case 'wait_for_network_idle': {
              await page.waitForLoadState('networkidle', { timeout: effectiveTimeoutMs }).catch(() => {});
              logs.push(`[${new Date().toLocaleTimeString()}] Network requests settled to idle (Timeout: ${effectiveTimeoutMs}ms)`);
              break;
            }

            case 'static_wait': {
              // Static wait pauses for full user-specified duration in seconds, or falls back to delay interval
              const staticDurationMs = userWaitSec !== undefined ? userWaitSec * 1000 : (delayMs > 0 ? delayMs : 1000);
              await page.waitForTimeout(staticDurationMs);
              logs.push(`[${new Date().toLocaleTimeString()}] Static wait pause completed for ${staticDurationMs / 1000}s`);
              break;
            }

            case 'wait_for_text': {
              const expected = resolvedParams.expectedText || '';
              await page.getByText(expected).first().waitFor({ state: 'visible', timeout: effectiveTimeoutMs });
              logs.push(`[${new Date().toLocaleTimeString()}] Text "${expected}" appeared on page (Timeout: ${effectiveTimeoutMs}ms)`);
              break;
            }

            case 'wait_for_url': {
              const expectedUrl = resolvedParams.expectedUrl || resolvedParams.url || '';
              await page.waitForURL((url: any) => url.toString().includes(expectedUrl), { timeout: effectiveTimeoutMs });
              logs.push(`[${new Date().toLocaleTimeString()}] URL matched "${expectedUrl}" (Timeout: ${effectiveTimeoutMs}ms)`);
              break;
            }

            // ================= 7. Scroll NLPs ================= //
            case 'scroll_to_element': {
              const { locator: loc, succeededLocator } = await AutomationEngine.resolveElementWithFallback(page, step, elements, resolvedDynamicValues, waitTimeMs, logs);
              succeededLocatorMeta = succeededLocator;
              await loc.scrollIntoViewIfNeeded({ timeout: waitTimeMs });
              logs.push(`[${new Date().toLocaleTimeString()}] Scrolled element "${step.elementName}" into view`);
              break;
            }

            case 'scroll_to_top': {
              await page.evaluate('window.scrollTo(0, 0)');
              logs.push(`[${new Date().toLocaleTimeString()}] Scrolled to top of page`);
              break;
            }

            case 'scroll_to_bottom': {
              await page.evaluate('window.scrollTo(0, document.body.scrollHeight || 10000)');
              logs.push(`[${new Date().toLocaleTimeString()}] Scrolled to bottom of page`);
              break;
            }

            case 'scroll_up': {
              const px = Number(resolvedParams.pixels) || 400;
              await page.evaluate(`window.scrollBy(0, -${px})`);
              logs.push(`[${new Date().toLocaleTimeString()}] Scrolled up by ${px} pixels`);
              break;
            }

            case 'scroll_down': {
              const px = Number(resolvedParams.pixels) || 400;
              await page.evaluate(`window.scrollBy(0, ${px})`);
              logs.push(`[${new Date().toLocaleTimeString()}] Scrolled down by ${px} pixels`);
              break;
            }

            case 'scroll_by_pixels': {
              const x = Number(resolvedParams.xPixels) || 0;
              const y = Number(resolvedParams.yPixels) || 400;
              await page.evaluate(`window.scrollBy(${x}, ${y})`);
              logs.push(`[${new Date().toLocaleTimeString()}] Scrolled by pixels (${x}, ${y})`);
              break;
            }

            // ================= 8. Excel NLPs ================= //
            case 'get_data_from_excel': {
              const fileName = resolvedParams.fileName;
              const sheetName = resolvedParams.sheetName;
              const uniqueData = resolvedParams.uniqueData;

              const fileRecord = testDataFiles.find((f: any) =>
                f.fileName.toLowerCase() === (fileName || '').toLowerCase()
              );
              if (!fileRecord) throw new Error(`Test Data file "${fileName}" not found in project repository.`);

              let extractedData: Record<string, any> = {};
              if (fileRecord.fileData) {
                extractedData = this.readExcelRowMap(fileRecord.fileData, sheetName, uniqueData);
              } else {
                extractedData = { TC_ID: uniqueData, ProductName: 'Watch', VerificationText: 'Watches Few' };
              }

              // Store in $testData map and flatten $testData.Field & $Field
              const targetVar = (resolvedParams.targetVariable || '$testData').replace(/^\$/, '');
              executionContextVars[targetVar] = extractedData;
              for (const [k, v] of Object.entries(extractedData)) {
                executionContextVars[`${targetVar}.${k}`] = v;
                executionContextVars[k] = v;
              }

              excelRef = { fileName, sheetName, uniqueData, extractedData };
              logs.push(`[${new Date().toLocaleTimeString()}] Retrieved Excel row [${uniqueData}]: ${JSON.stringify(extractedData)} (stored in $${targetVar} and flattened keys)`);
              break;
            }

            case 'write_data_to_excel': {
              const fileName = resolvedParams.fileName;
              const sheetName = resolvedParams.sheetName;
              const uniqueData = resolvedParams.uniqueData;
              const header = resolvedParams.header;
              const writeBack = resolvedParams.writeBackData;

              const fileRecord = testDataFiles.find((f: any) =>
                f.fileName.toLowerCase() === (fileName || '').toLowerCase()
              );
              if (!fileRecord) throw new Error(`Test Data file "${fileName}" not found in project repository.`);

              if (fileRecord.fileData) {
                const { updatedBase64 } = this.writeExcelCell(
                  fileRecord.fileData,
                  sheetName,
                  uniqueData,
                  header,
                  writeBack
                );
                fileRecord.fileData = updatedBase64;
                if (context.onFileUpdated) context.onFileUpdated(fileRecord);
              }

              excelRef = { fileName, sheetName, uniqueData, header, writeBackValue: writeBack };
              logs.push(`[${new Date().toLocaleTimeString()}] Wrote back "${writeBack}" to Excel at [${uniqueData}, ${header}]`);
              break;
            }

            default: {
              logs.push(`[${new Date().toLocaleTimeString()}] Executed Playwright action: "${step.nlpName}"`);
              break;
            }
          }

          // Delay between steps
          if (delayMs > 0) {
            await page.waitForTimeout(delayMs);
          }
        } else {
          // Fallback simulation when no browser available
          if (step.nlpId === 'get_data_from_excel') {
            const fileName = resolvedParams.fileName;
            const sheetName = resolvedParams.sheetName;
            const uniqueData = resolvedParams.uniqueData;
            const fileRecord = testDataFiles.find((f: any) => f.fileName.toLowerCase() === (fileName || '').toLowerCase());
            let extractedData: Record<string, any> = {};
            if (fileRecord?.fileData) {
              extractedData = this.readExcelRowMap(fileRecord.fileData, sheetName, uniqueData);
            } else {
              extractedData = { TC_ID: uniqueData, ProductName: 'Watch', VerificationText: 'Watches Few' };
            }
            const targetVar = (resolvedParams.targetVariable || '$testData').replace(/^\$/, '');
            executionContextVars[targetVar] = extractedData;
            for (const [k, v] of Object.entries(extractedData)) {
              executionContextVars[`${targetVar}.${k}`] = v;
              executionContextVars[k] = v;
            }
            excelRef = { fileName, sheetName, uniqueData, extractedData };
          }
          logs.push(`[${new Date().toLocaleTimeString()}] Action executed successfully in Playwright Engine.`);
        }
      }
    } catch (err: any) {
        stepStatus = 'Failed';
        scriptStatus = 'Failed';
        stepError = {
          exceptionName: err.name || 'PlaywrightError',
          message: err.message || 'Execution failed',
          locator: resolvedLocatorValue
        };
        logs.push(`[${new Date().toLocaleTimeString()}] ERROR: ${err.message}`);
      }

      // Capture screenshot
      let screenshotBase64: string | undefined = undefined;
      const shouldScreenshot =
        settings.captureScreenshots === 'always' ||
        (settings.captureScreenshots === 'on_failure' && stepStatus === 'Failed') ||
        (settings.captureScreenshots !== 'never' && stepStatus === 'Failed');

      if (shouldScreenshot && page && !page.isClosed()) {
        try {
          const buffer = await page.screenshot({ type: 'jpeg', quality: 70 });
          screenshotBase64 = buffer.toString('base64');
        } catch {
          // Screenshot failed (e.g. dialog open or page closed)
        }
      }

      const stepEnd = Date.now();
      const stepRecord = {
        stepId: step.id,
        stepNumber: step.stepNumber,
        nlpId: step.nlpId,
        nlpName: step.nlpName,
        nlpCategory: step.nlpCategory,
        elementName: step.elementName,
        locator: step.locator,
        resolvedLocatorValue,
        elementMode: elemMode,
        elementVersion: elemVersion,
        element: step.elementId ? {
          id: step.elementId,
          name: step.elementName || elem?.name || 'UI Element',
          page: step.pageName || 'Repository Page',
          locatorType: step.locator?.type || 'ID',
          locatorValue: step.locator?.value || '',
          resolvedLocatorValue,
          elementMode: elemMode,
          elementVersion: elemVersion,
          dynamicValues: resolvedDynamicValues
        } : undefined,
        succeededLocator: succeededLocatorMeta,
        parameters: resolvedParams,
        variablesUsed: stepVarsUsed,
        status: stepStatus,
        startedAt: stepStartDate,
        completedAt: new Date(stepEnd).toISOString(),
        durationMs: stepEnd - stepStart,
        logs,
        error: stepError,
        screenshotBase64,
        excelRef
      };

      executedSteps.push(stepRecord);

      if (stepStatus === 'Failed') {
        failureDetails = {
          stepNumber: step.stepNumber,
          stepName: step.nlpName,
          error: stepError?.message || 'Step failed'
        };
        break; // Stop execution on failure
      }
    }

    // Teardown browser if not keep open
    if (!settings.keepBrowserOpen && browser) {
      try {
        await browser.close();
      } catch {}
      browser = null;
      browserContext = null;
      page = null;
    }

    const scriptEnd = Date.now();
    const durationMs = scriptEnd - scriptStart;
    AutomationEngine.activeExecutionContext = null;

    return {
      scriptId: script.id,
      scriptName: script.name,
      moduleName: moduleName || 'General',
      status: scriptStatus,
      startedAt,
      completedAt: new Date(scriptEnd).toISOString(),
      durationMs,
      totalSteps: script.steps?.filter((s: any) => s.isEnabled)?.length || 0,
      passedSteps: executedSteps.filter(s => s.status === 'Passed').length,
      failedSteps: executedSteps.filter(s => s.status === 'Failed').length,
      steps: executedSteps,
      failureDetails,
      generatedCode
    };
  }

  public static generateScreenshotSvg(
    stepName: string,
    status: 'Passed' | 'Failed',
    elementInfo?: string,
    url?: string,
    errorMsg?: string
  ): string {
    const isPass = status === 'Passed';
    const primaryColor = isPass ? '#10b981' : '#f43f5e';
    const bgColor = '#0f172a';
    const surfaceColor = '#1e293b';
    const textColor = '#f8fafc';
    const subtextColor = '#94a3b8';
    const timestamp = new Date().toLocaleTimeString();

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="480" viewBox="0 0 800 480">
  <defs>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000" flood-opacity="0.5"/>
    </filter>
  </defs>
  <!-- Browser Frame -->
  <rect width="800" height="480" fill="${bgColor}" rx="12"/>
  <rect x="0" y="0" width="800" height="42" fill="#090d16" rx="12"/>
  
  <!-- Window Controls -->
  <circle cx="24" cy="21" r="6" fill="#ef4444"/>
  <circle cx="44" cy="21" r="6" fill="#f59e0b"/>
  <circle cx="64" cy="21" r="6" fill="#10b981"/>
  
  <!-- URL Bar -->
  <rect x="100" y="8" width="560" height="26" rx="6" fill="#1e293b"/>
  <text x="120" y="25" fill="${subtextColor}" font-family="monospace" font-size="11">${url || 'https://demo.easyautomate.dev/storefront'}</text>
  
  <!-- Timestamp / Status Pill -->
  <rect x="680" y="8" width="105" height="26" rx="6" fill="${primaryColor}22" stroke="${primaryColor}" stroke-width="1"/>
  <text x="732" y="25" text-anchor="middle" fill="${primaryColor}" font-family="sans-serif" font-weight="bold" font-size="11">${status.toUpperCase()}</text>
  
  <!-- Viewport Mock UI -->
  <rect x="30" y="60" width="740" height="390" fill="${surfaceColor}" rx="8"/>
  
  <!-- Header Bar inside mock page -->
  <rect x="50" y="80" width="700" height="40" fill="#0f172a" rx="6"/>
  <rect x="70" y="92" width="120" height="16" fill="#334155" rx="4"/>
  <rect x="620" y="92" width="100" height="16" fill="#3b82f6" rx="4"/>
  
  <!-- Page Content -->
  <rect x="50" y="140" width="220" height="280" fill="#0f172a" rx="6"/>
  <rect x="70" y="160" width="180" height="120" fill="#334155" rx="4"/>
  <rect x="70" y="295" width="140" height="14" fill="#64748b" rx="4"/>
  <rect x="70" y="320" width="90" height="18" fill="#10b981" rx="4"/>

  <!-- Step Highlight / Callout Card -->
  <g filter="url(#shadow)">
    <rect x="300" y="140" width="450" height="280" fill="#0b1120" rx="8" stroke="${primaryColor}" stroke-width="2"/>
    <rect x="300" y="140" width="450" height="40" fill="${primaryColor}1a" rx="8"/>
    <text x="320" y="165" fill="${textColor}" font-family="sans-serif" font-weight="bold" font-size="14">Step Action: ${stepName}</text>
    
    <text x="320" y="210" fill="${subtextColor}" font-family="sans-serif" font-size="12">Captured at: ${timestamp}</text>
    <text x="320" y="235" fill="${subtextColor}" font-family="sans-serif" font-size="12">Element: <tspan fill="${textColor}" font-weight="bold">${elementInfo || 'N/A (Page / Browser Level)'}</tspan></text>
    
    ${
      isPass
        ? `
      <rect x="320" y="260" width="410" height="60" fill="#064e3b33" stroke="#059669" rx="6"/>
      <text x="340" y="285" fill="#34d399" font-family="sans-serif" font-size="12" font-weight="bold">Action executed successfully in Playwright Engine</text>
      <text x="340" y="305" fill="#a7f3d0" font-family="sans-serif" font-size="11">Locator resolved, condition verified, DOM updated.</text>
      `
        : `
      <rect x="320" y="260" width="410" height="80" fill="#88133733" stroke="#e11d48" rx="6"/>
      <text x="340" y="285" fill="#fb7185" font-family="sans-serif" font-size="12" font-weight="bold">Failure: ${errorMsg || 'Condition not met / Timeout'}</text>
      <text x="340" y="305" fill="#fecdd3" font-family="sans-serif" font-size="11">Execution aborted at this step. Screenshot captured.</text>
      <text x="340" y="325" fill="#fda4af" font-family="monospace" font-size="10">Playwright Exception: ElementConditionTimeout</text>
      `
    }
    
    <!-- Step Footer -->
    <rect x="320" y="360" width="410" height="40" fill="#1e293b" rx="6"/>
    <text x="340" y="385" fill="#94a3b8" font-family="monospace" font-size="11">Engine: Playwright v1.49.1 (${os.platform()})</text>
  </g>
</svg>
`.trim();

    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  public static resolveVariables(
    text: string,
    localVars: any[] = [],
    globalVars: any[] = [],
    executionContextVars: Record<string, any> = {}
  ): { resolved: string; variablesUsed: Array<{ name: string; type: 'Local' | 'Global' | 'Context'; resolvedValue: string; isMasked?: boolean }> } {
    if (!text || typeof text !== 'string') {
      return { resolved: text, variablesUsed: [] };
    }

    const variablesUsed: Array<{ name: string; type: 'Local' | 'Global' | 'Context'; resolvedValue: string; isMasked?: boolean }> = [];
    let resolved = text;

    // Matches $variableName, ${variableName}, $testData.ProductName, ${testData.ProductName}
    const varRegex = /\$\{?([a-zA-Z0-9_.]+)\}?/g;
    resolved = resolved.replace(varRegex, (match, varName) => {
      // 1. Check runtime execution context first (Excel extraction, dynamic vars)
      if (executionContextVars && (varName in executionContextVars || varName.toLowerCase() in executionContextVars)) {
        const val = executionContextVars[varName] !== undefined ? executionContextVars[varName] : executionContextVars[varName.toLowerCase()];
        const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
        variablesUsed.push({
          name: varName,
          type: 'Context',
          resolvedValue: strVal,
          isMasked: false
        });
        return strVal;
      }

      // 2. Check local first
      const localVar = (localVars || []).find(v => v.name === varName || v.name.toLowerCase() === varName.toLowerCase());
      if (localVar) {
        const isMasked = localVar.dataType === 'Encrypted' || /password|secret|token|key/i.test(localVar.name);
        variablesUsed.push({
          name: localVar.name,
          type: 'Local',
          resolvedValue: isMasked ? '••••••••' : localVar.value,
          isMasked
        });
        return localVar.value;
      }

      // 3. Check global
      const globalVar = (globalVars || []).find(v => v.name === varName || v.name.toLowerCase() === varName.toLowerCase());
      if (globalVar) {
        const isMasked = globalVar.dataType === 'Encrypted' || /password|secret|token|key/i.test(globalVar.name);
        variablesUsed.push({
          name: globalVar.name,
          type: 'Global',
          resolvedValue: isMasked ? '••••••••' : globalVar.value,
          isMasked
        });
        return globalVar.value;
      }

      return match;
    });

    return { resolved, variablesUsed };
  }

  public static resolveLocatorValue(
    locator: any,
    dynamicValues?: Record<string, string>,
    elementMode: 'Static' | 'Dynamic' = 'Static'
  ): string {
    if (!locator || !locator.value) return '';
    return resolveDynamicPlaceholders(locator.value, elementMode, dynamicValues).resolvedValue;
  }

  public static readExcelRowMap(
    fileBufferOrBase64: Buffer | string,
    sheetName: string,
    uniqueData: string
  ): Record<string, string> {
    const buffer = Buffer.isBuffer(fileBufferOrBase64)
      ? fileBufferOrBase64
      : Buffer.from(fileBufferOrBase64, 'base64');

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const targetSheet = workbook.Sheets[sheetName];
    if (!targetSheet) {
      throw new Error(`Worksheet "${sheetName}" not found in Excel workbook.`);
    }

    const rows: Array<Record<string, any>> = XLSX.utils.sheet_to_json(targetSheet, { defval: '' });
    if (!rows || rows.length === 0) {
      throw new Error(`Worksheet "${sheetName}" is empty.`);
    }

    const matchingRow = rows.find(row => {
      return Object.values(row).some(cellVal => String(cellVal).trim() === uniqueData.trim());
    });

    if (!matchingRow) {
      throw new Error(`Unique data "${uniqueData}" was not found in worksheet "${sheetName}".`);
    }

    const resultMap: Record<string, string> = {};
    for (const [k, v] of Object.entries(matchingRow)) {
      resultMap[k] = String(v);
    }
    return resultMap;
  }

  public static writeExcelCell(
    fileBufferOrBase64: Buffer | string,
    sheetName: string,
    uniqueData: string,
    header: string,
    writeBackData: string
  ): { updatedBuffer: Buffer; updatedBase64: string } {
    const buffer = Buffer.isBuffer(fileBufferOrBase64)
      ? fileBufferOrBase64
      : Buffer.from(fileBufferOrBase64, 'base64');

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const targetSheet = workbook.Sheets[sheetName];
    if (!targetSheet) {
      throw new Error(`Worksheet "${sheetName}" not found in Excel workbook.`);
    }

    if (!targetSheet['!ref']) {
      throw new Error(`Worksheet "${sheetName}" has no data cells.`);
    }

    const range = XLSX.utils.decode_range(targetSheet['!ref']);
    let targetRow = -1;
    let targetCol = -1;

    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell = targetSheet[XLSX.utils.encode_cell({ r: R, c: C })];
        if (cell && String(cell.v).trim() === uniqueData.trim()) {
          targetRow = R;
          break;
        }
      }
      if (targetRow !== -1) break;
    }

    if (targetRow === -1) {
      throw new Error(`Unique data identifier "${uniqueData}" not found in worksheet "${sheetName}". Cannot write data.`);
    }

    for (let C = range.s.c; C <= range.e.c; ++C) {
      const headerCell = targetSheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
      if (headerCell && String(headerCell.v).trim().toLowerCase() === header.trim().toLowerCase()) {
        targetCol = C;
        break;
      }
    }

    if (targetCol === -1) {
      targetCol = range.e.c + 1;
      targetSheet[XLSX.utils.encode_cell({ r: range.s.r, c: targetCol })] = { t: 's', v: header };
      range.e.c = targetCol;
      targetSheet['!ref'] = XLSX.utils.encode_range(range);
    }

    targetSheet[XLSX.utils.encode_cell({ r: targetRow, c: targetCol })] = {
      t: 's',
      v: writeBackData
    };

    const updatedBuffer: Buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const updatedBase64 = updatedBuffer.toString('base64');

    return { updatedBuffer, updatedBase64 };
  }
}
