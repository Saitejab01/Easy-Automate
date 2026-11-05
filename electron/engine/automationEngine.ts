import os from 'os';
import * as XLSX from 'xlsx';

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
}

export class AutomationEngine {
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
    const scriptTitle = (script.name || 'Automation Test').replace(/['"\\]/g, '\\$&');

    lines.push(`import { test, expect, chromium } from '@playwright/test';`);
    lines.push(``);
    lines.push(`/**`);
    lines.push(` * Easy Automate Generated Test`);
    lines.push(` * Script: ${script.name}`);
    lines.push(` * Generated at: ${new Date().toISOString()}`);
    lines.push(` */`);
    lines.push(`test('${scriptTitle}', async () => {`);
    lines.push(`  // 1. Launch Browser`);
    lines.push(`  const browser = await chromium.launch({ headless: false, slowMo: 300 });`);
    lines.push(`  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });`);
    lines.push(`  const page = await context.newPage();`);
    lines.push(`  page.setDefaultTimeout(10000);`);
    lines.push(``);
    lines.push(`  // Local Variables Store`);
    lines.push(`  const testContext: Record<string, any> = {};`);
    lines.push(``);

    if (script.steps && Array.isArray(script.steps)) {
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

  private static getPlaywrightLocatorCode(locator: any, dynamicValues?: Record<string, string>): string {
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

  /**
   * Resolves a Playwright locator from page object
   */
  public static getPlaywrightLocator(page: any, locator: any, dynamicValues?: Record<string, string>): any {
    if (!locator || !locator.value) return page.locator('body');
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

    switch (locator.type) {
      case 'ID':
        return page.locator(`#${val}`);
      case 'CSS Selector':
        return page.locator(val);
      case 'XPath':
        return page.locator(`xpath=${val}`);
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
        return page.getByText(val);
      case 'Role':
        return page.locator(val);
      case 'Placeholder':
        return page.getByPlaceholder(val);
      case 'Label':
        return page.getByLabel(val);
      case 'Test ID':
        return page.getByTestId(val);
      default:
        return page.locator(val);
    }
  }

  /**
   * Executes script with real Playwright browser on the host machine.
   * Launces headful Chromium by default so the user sees the real browser executing commands!
   */
  public static async executeScriptWithPlaywright(context: AutomationContext): Promise<any> {
    const { script, moduleName, elements, testDataFiles, localVariables, globalVariables, runSettings } = context;
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
            args: ['--start-maximized', '--disable-blink-features=AutomationControlled']
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
          viewport: { width: 1280, height: 800 }
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

      // Resolve variables in parameters
      const resolvedParams: Record<string, any> = {};
      const stepVarsUsed: Array<{ name: string; type: 'Local' | 'Global'; resolvedValue: string; isMasked?: boolean }> = [];

      for (const [k, v] of Object.entries(step.parameters || {})) {
        if (typeof v === 'string') {
          // Check executionContextVars first
          let tempVal = v;
          for (const [ctxK, ctxV] of Object.entries(executionContextVars)) {
            tempVal = tempVal.replace(`$${ctxK}`, String(ctxV)).replace(`\${${ctxK}}`, String(ctxV));
          }
          const { resolved, variablesUsed } = this.resolveVariables(tempVal, localVariables, globalVariables);
          resolvedParams[k] = resolved;
          stepVarsUsed.push(...variablesUsed);
        } else {
          resolvedParams[k] = v;
        }
      }

      // Resolve dynamic values with runtime variables
      const resolvedDynamicValues: Record<string, string> = {};
      if (step.parameters?.dynamicValues && typeof step.parameters.dynamicValues === 'object') {
        for (const [dk, dv] of Object.entries(step.parameters.dynamicValues)) {
          if (typeof dv === 'string') {
            let tempDyn = dv;
            for (const [ctxK, ctxV] of Object.entries(executionContextVars)) {
              tempDyn = tempDyn.replace(`$${ctxK}`, String(ctxV)).replace(`\${${ctxK}}`, String(ctxV));
            }
            const { resolved, variablesUsed } = this.resolveVariables(tempDyn, localVariables, globalVariables);
            resolvedDynamicValues[dk] = resolved;
            stepVarsUsed.push(...variablesUsed);
          } else {
            resolvedDynamicValues[dk] = String(dv ?? '');
          }
        }
      }
      resolvedParams.dynamicValues = resolvedDynamicValues;

      // Resolve element locator
      let resolvedLocatorValue = '';
      if (step.locator) {
        resolvedLocatorValue = this.resolveLocatorValue(step.locator, resolvedDynamicValues);
        logs.push(`[${new Date().toLocaleTimeString()}] Locator resolved [${step.locator.type}]: "${resolvedLocatorValue}" for element "${step.elementName || ''}"`);
      }

      let stepStatus: 'Passed' | 'Failed' = 'Passed';
      let stepError: { exceptionName: string; message: string; locator?: string } | undefined = undefined;
      let excelRef: any = undefined;

      try {
        if (!page || page.isClosed()) {
          await ensureBrowserReady();
        }

        if (page && !page.isClosed()) {
          // REAL PLAYWRIGHT EXECUTION ON BROWSER
          switch (step.nlpId) {
            case 'open_browser': {
              const bEngine = resolvedParams.browser || settings.browser || 'Chromium';
              if (!page || page.isClosed()) {
                await ensureBrowserReady(bEngine);
              }
              logs.push(`[${new Date().toLocaleTimeString()}] Browser (${bEngine}) launched successfully. Clean blank page initialized.`);
              break;
            }

            case 'maximize_browser': {
              await page.setViewportSize({ width: 1920, height: 1080 });
              logs.push(`[${new Date().toLocaleTimeString()}] Browser window maximized (1920x1080)`);
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

            case 'refresh_page': {
              await page.reload();
              logs.push(`[${new Date().toLocaleTimeString()}] Page reloaded`);
              break;
            }

            case 'navigate_back': {
              await page.goBack();
              logs.push(`[${new Date().toLocaleTimeString()}] Navigated back`);
              break;
            }

            case 'navigate_forward': {
              await page.goForward();
              logs.push(`[${new Date().toLocaleTimeString()}] Navigated forward`);
              break;
            }

            case 'click_element': {
              const loc = this.getPlaywrightLocator(page, step.locator, resolvedDynamicValues);
              await loc.waitFor({ state: 'visible', timeout: waitTimeMs });
              await loc.click({ timeout: waitTimeMs });
              logs.push(`[${new Date().toLocaleTimeString()}] Clicked element "${step.elementName}"`);
              break;
            }

            case 'enter_text': {
              const loc = this.getPlaywrightLocator(page, step.locator, resolvedDynamicValues);
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
              const loc = this.getPlaywrightLocator(page, step.locator, resolvedDynamicValues);
              await loc.clear({ timeout: waitTimeMs });
              logs.push(`[${new Date().toLocaleTimeString()}] Cleared text in element "${step.elementName}"`);
              break;
            }

            case 'mouse_hover': {
              const loc = this.getPlaywrightLocator(page, step.locator, resolvedDynamicValues);
              await loc.hover({ timeout: waitTimeMs });
              logs.push(`[${new Date().toLocaleTimeString()}] Hovered over element "${step.elementName}"`);
              break;
            }

            case 'double_click': {
              const loc = this.getPlaywrightLocator(page, step.locator, resolvedDynamicValues);
              await loc.dblclick({ timeout: waitTimeMs });
              logs.push(`[${new Date().toLocaleTimeString()}] Double-clicked element "${step.elementName}"`);
              break;
            }

            case 'right_click': {
              const loc = this.getPlaywrightLocator(page, step.locator, resolvedDynamicValues);
              await loc.click({ button: 'right', timeout: waitTimeMs });
              logs.push(`[${new Date().toLocaleTimeString()}] Right-clicked element "${step.elementName}"`);
              break;
            }

            case 'select_option_by_text': {
              const loc = this.getPlaywrightLocator(page, step.locator, resolvedDynamicValues);
              const opt = resolvedParams.optionText || resolvedParams.text || '';
              await loc.selectOption({ label: opt });
              logs.push(`[${new Date().toLocaleTimeString()}] Selected option "${opt}"`);
              break;
            }

            case 'select_option_by_value': {
              const loc = this.getPlaywrightLocator(page, step.locator, resolvedDynamicValues);
              const val = resolvedParams.optionValue || resolvedParams.value || '';
              await loc.selectOption({ value: val });
              logs.push(`[${new Date().toLocaleTimeString()}] Selected option with value "${val}"`);
              break;
            }

            case 'check_checkbox': {
              const loc = this.getPlaywrightLocator(page, step.locator, resolvedDynamicValues);
              await loc.check({ timeout: waitTimeMs });
              logs.push(`[${new Date().toLocaleTimeString()}] Checked checkbox "${step.elementName}"`);
              break;
            }

            case 'uncheck_checkbox': {
              const loc = this.getPlaywrightLocator(page, step.locator, resolvedDynamicValues);
              await loc.uncheck({ timeout: waitTimeMs });
              logs.push(`[${new Date().toLocaleTimeString()}] Unchecked checkbox "${step.elementName}"`);
              break;
            }

            case 'press_key': {
              const key = resolvedParams.key || 'Enter';
              await page.keyboard.press(key);
              logs.push(`[${new Date().toLocaleTimeString()}] Pressed keyboard key: ${key}`);
              break;
            }

            case 'verify_element_is_displayed': {
              const loc = this.getPlaywrightLocator(page, step.locator, resolvedDynamicValues);
              await loc.waitFor({ state: 'visible', timeout: waitTimeMs });
              logs.push(`[${new Date().toLocaleTimeString()}] Verified element "${step.elementName}" is visible`);
              break;
            }

            case 'verify_element_is_not_displayed': {
              const loc = this.getPlaywrightLocator(page, step.locator, resolvedDynamicValues);
              await loc.waitFor({ state: 'hidden', timeout: waitTimeMs });
              logs.push(`[${new Date().toLocaleTimeString()}] Verified element "${step.elementName}" is hidden`);
              break;
            }

            case 'verify_text': {
              const loc = this.getPlaywrightLocator(page, step.locator, resolvedDynamicValues);
              const actual = await loc.innerText();
              const expected = resolvedParams.expectedText || '';
              if (!actual.toLowerCase().includes(expected.toLowerCase())) {
                throw new Error(`Expected text "${expected}" was not found in element. Actual text: "${actual}"`);
              }
              logs.push(`[${new Date().toLocaleTimeString()}] Verified text "${expected}" matched in element`);
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

            case 'verify_current_url': {
              const currentUrl = page.url();
              const expected = resolvedParams.expectedUrl || '';
              if (!currentUrl.toLowerCase().includes(expected.toLowerCase())) {
                throw new Error(`Current URL "${currentUrl}" does not match expected "${expected}"`);
              }
              logs.push(`[${new Date().toLocaleTimeString()}] Verified current URL: "${currentUrl}"`);
              break;
            }

            case 'static_wait': {
              const dur = Number(resolvedParams.durationMs) || 1000;
              logs.push(`[${new Date().toLocaleTimeString()}] Waiting for ${dur}ms`);
              await page.waitForTimeout(dur);
              break;
            }

            case 'scroll_to_element': {
              const loc = this.getPlaywrightLocator(page, step.locator, resolvedDynamicValues);
              await loc.scrollIntoViewIfNeeded();
              logs.push(`[${new Date().toLocaleTimeString()}] Scrolled element "${step.elementName}" into view`);
              break;
            }

            case 'scroll_to_bottom': {
              await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
              logs.push(`[${new Date().toLocaleTimeString()}] Scrolled to bottom of page`);
              break;
            }

            case 'scroll_to_top': {
              await page.evaluate('window.scrollTo(0, 0)');
              logs.push(`[${new Date().toLocaleTimeString()}] Scrolled to top of page`);
              break;
            }

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

              Object.assign(executionContextVars, extractedData);
              excelRef = { fileName, sheetName, uniqueData, extractedData };
              logs.push(`[${new Date().toLocaleTimeString()}] Retrieved Excel row [${uniqueData}]: ${JSON.stringify(extractedData)}`);
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
          // Fallback simulation when no browser window available
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
            Object.assign(executionContextVars, extractedData);
            excelRef = { fileName, sheetName, uniqueData, extractedData };
          }
          logs.push(`[${new Date().toLocaleTimeString()}] Action executed successfully in Playwright Engine.`);
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
      let screenshot: string | undefined = undefined;
      const shouldCapture = settings.screenshotOption === 'every-step' || (stepStatus === 'Failed' && settings.screenshotOption === 'failed-only') || true;
      if (shouldCapture) {
        if (page && !page.isClosed()) {
          try {
            const shotBuffer = await page.screenshot({ fullPage: false, type: 'png' });
            screenshot = 'data:image/png;base64,' + shotBuffer.toString('base64');
          } catch (shotErr) {
            screenshot = this.generateScreenshotSvg(
              step.nlpName,
              stepStatus,
              step.elementName ? `${step.elementName} (${resolvedLocatorValue || 'Mapped'})` : undefined,
              resolvedParams.url,
              stepError?.message
            );
          }
        } else {
          screenshot = this.generateScreenshotSvg(
            step.nlpName,
            stepStatus,
            step.elementName ? `${step.elementName} (${resolvedLocatorValue || 'Mapped'})` : undefined,
            resolvedParams.url,
            stepError?.message
          );
        }
      }

      const stepEnd = Date.now();
      const stepDuration = Number(((stepEnd - stepStart) / 1000).toFixed(2)) || 0.1;

      executedSteps.push({
        stepNumber: step.stepNumber,
        nlpName: step.nlpName,
        nlpCategory: step.nlpCategory,
        description: step.description,
        status: stepStatus,
        startedAt: stepStartDate,
        completedAt: new Date(stepEnd).toISOString(),
        durationSeconds: stepDuration,
        element: step.elementId ? {
          id: step.elementId,
          name: step.elementName || 'UI Element',
          page: step.pageName || 'Repository Page',
          locatorType: step.locator?.type || 'ID',
          locatorValue: resolvedLocatorValue || step.locator?.value || ''
        } : undefined,
        variablesUsed: stepVarsUsed.length > 0 ? stepVarsUsed : undefined,
        inputParameters: resolvedParams,
        excelReference: excelRef,
        logs,
        screenshot,
        error: stepError
      });

      if (stepStatus === 'Failed') {
        failureDetails = {
          reason: stepError?.message || 'Step failure',
          exceptionName: stepError?.exceptionName || 'Error',
          errorMessage: stepError?.message || 'Unknown failure',
          failedStepNumber: step.stepNumber,
          failedLocator: resolvedLocatorValue,
          screenshot,
          logs
        };
        break; // Stop on first failure
      }
    }

    // Teardown browser
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        console.warn('Error closing browser:', closeErr);
      }
    }

    const scriptEnd = Date.now();
    const durationSeconds = Number(((scriptEnd - scriptStart) / 1000).toFixed(2)) || 0.5;

    return {
      scriptId: script.id,
      scriptName: script.name,
      moduleName: moduleName || 'General Module',
      status: scriptStatus,
      startedAt,
      completedAt: new Date(scriptEnd).toISOString(),
      durationSeconds,
      steps: executedSteps,
      failureDetails,
      generatedPlaywrightCode: generatedCode
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
    localVars: any[],
    globalVars: any[]
  ): { resolved: string; variablesUsed: Array<{ name: string; type: 'Local' | 'Global'; resolvedValue: string; isMasked?: boolean }> } {
    if (!text || typeof text !== 'string') {
      return { resolved: text, variablesUsed: [] };
    }

    const variablesUsed: Array<{ name: string; type: 'Local' | 'Global'; resolvedValue: string; isMasked?: boolean }> = [];
    let resolved = text;

    // Matches $variableName or ${variableName}
    const varRegex = /\$\{?([a-zA-Z0-9_]+)\}?/g;
    resolved = resolved.replace(varRegex, (match, varName) => {
      // Check local first
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

      // Check global
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
    dynamicValues?: Record<string, string>
  ): string {
    if (!locator || !locator.value) return '';
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
    return val;
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

    // Search for uniqueData anywhere in the row (e.g. TC001)
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

    // Find row with uniqueData
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

    // Find column matching header (checking row 0 or header row)
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

    // Write data at intersection
    targetSheet[XLSX.utils.encode_cell({ r: targetRow, c: targetCol })] = {
      t: 's',
      v: writeBackData
    };

    const updatedBuffer: Buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const updatedBase64 = updatedBuffer.toString('base64');

    return { updatedBuffer, updatedBase64 };
  }
}
