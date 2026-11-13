import { BrowserWindow, clipboard } from 'electron';
import { evaluateLocatorStability } from './locatorEvaluator';

export interface InspectedElementPayload {
  tagName: string;
  textContent: string;
  id: string;
  name: string;
  testId: string;
  className: string;
  placeholder: string;
  role: string;
  type: string;
  ariaLabel: string;
  alt: string;
  title: string;
  xpath: string;
  cssSelector: string;
  parentTag?: string;
  parentText?: string;
  parentTestId?: string;
}

export interface FinderStrategy {
  id: string;
  type: string;
  value: string;
  valueType: 'Static' | 'Dynamic';
  isPrimary: boolean;
  priority: number;
  selected: boolean;
  stabilityScore: number;
  stability: 'High' | 'Moderate' | 'Low';
  reasons: string[];
  feedback: string;
  matchCount: number;
}

export class FinderSessionManager {
  private browser: any = null;
  private context: any = null;
  private page: any = null;
  private currentUrl: string = '';
  private status: 'idle' | 'capturing' | 'paused' | 'closed' = 'idle';
  private captureMode: 'normal' | 'reference' = 'normal';
  private referenceElement: InspectedElementPayload | null = null;
  private capturedSequence: number = 0;
  private sessionCapturedElements: any[] = [];
  private mainWindow: BrowserWindow | null = null;

  public setMainWindow(win: BrowserWindow | null) {
    this.mainWindow = win;
  }

  public syncSessionElements(elements: any[]) {
    this.sessionCapturedElements = Array.isArray(elements) ? [...elements] : [];
    this.capturedSequence = this.sessionCapturedElements.length;
  }

  public setCapturedSequence(seq: number) {
    this.capturedSequence = Math.max(0, Number(seq) || 0);
    if (this.capturedSequence === 0) {
      this.sessionCapturedElements = [];
    } else if (this.sessionCapturedElements.length > this.capturedSequence) {
      this.sessionCapturedElements = this.sessionCapturedElements.slice(0, this.capturedSequence);
    }
  }

  public getStatus() {
    return {
      status: this.status,
      currentUrl: this.currentUrl,
      captureMode: this.captureMode,
      capturedCount: this.capturedSequence,
      hasReference: !!this.referenceElement,
      isOpen: !!(this.browser && this.page && !this.page.isClosed())
    };
  }

  public async startSession(
    url: string,
    browserType: 'chromium' | 'firefox' | 'webkit' = 'chromium',
    captureMode: 'normal' | 'reference' = 'normal'
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    let playwright: any = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      playwright = require('playwright');
    } catch (err: any) {
      return { success: false, error: 'Playwright engine not available: ' + err.message };
    }

    this.captureMode = captureMode;
    let cleanUrl = (url || '').trim();
    if (!cleanUrl || cleanUrl === 'https://demo.playwright.dev' || cleanUrl === 'demo.playwright.dev' || cleanUrl === 'https://demo.playwright.dev/') {
      cleanUrl = 'https://demo.playwright.dev/todomvc';
    }
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }
    this.currentUrl = cleanUrl;

    try {
      // If browser already exists and is open, reuse it and just navigate
      if (this.browser && this.page && !this.page.isClosed()) {
        try {
          await this.page.goto(cleanUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await this.injectInspectorScript(this.page);
          this.status = 'capturing';
          return { success: true, url: cleanUrl };
        } catch {
          // If existing page failed, proceed to recreate
        }
      }

      const launcher = (playwright as any)[browserType] || playwright.chromium;
      this.browser = await launcher.launch({
        headless: false,
        args: ['--window-size=1280,820', '--disable-blink-features=AutomationControlled']
      });

      this.context = await this.browser.newContext({ viewport: null });
      this.page = await this.context.newPage();

      this.browser.on('disconnected', () => {
        this.status = 'closed';
        this.browser = null;
        this.context = null;
        this.page = null;
        this.referenceElement = null;
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('finder:browserDisconnected');
        }
      });

      // Expose bridge functions for page -> Electron main communication
      await this.page.exposeFunction('__ea_onElementCaptured', async (data: InspectedElementPayload) => {
        await this.handleCapturedElement(data);
      }).catch(() => {});

      await this.page.exposeFunction('__ea_onCopyLocator', (text: string) => {
        clipboard.writeText(text);
      }).catch(() => {});

      await this.page.exposeFunction('__ea_onTestLocatorFromPage', async (type: string, value: string) => {
        return await this.testLocator(type, value);
      }).catch(() => {});

      this.page.on('domcontentloaded', async () => {
        try {
          await this.injectInspectorScript(this.page);
        } catch (e: any) {
          console.error('[Finder] domcontentloaded injection error:', e.message);
        }
      });

      this.status = 'capturing';
      await this.page.goto(cleanUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
      await this.injectInspectorScript(this.page);

      return { success: true, url: cleanUrl };
    } catch (err: any) {
      this.status = 'closed';
      return { success: false, error: err.message || 'Failed to start capture session' };
    }
  }

  public async pauseCapture(): Promise<{ success: boolean; error?: string }> {
    if (!this.page || this.page.isClosed()) {
      return { success: false, error: 'Browser not active' };
    }
    try {
      this.status = 'paused';
      await this.page.evaluate(() => {
        if ((window as any).__ea_setCaptureActive) {
          (window as any).__ea_setCaptureActive(false);
        }
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public async resumeCapture(): Promise<{ success: boolean; error?: string }> {
    if (!this.page || this.page.isClosed()) {
      return { success: false, error: 'Browser not active' };
    }
    try {
      this.status = 'capturing';
      await this.page.evaluate(() => {
        if ((window as any).__ea_setCaptureActive) {
          (window as any).__ea_setCaptureActive(true);
        }
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public setCaptureMode(mode: 'normal' | 'reference') {
    this.captureMode = mode;
    this.referenceElement = null;
    if (this.page && !this.page.isClosed()) {
      this.page.evaluate((m: string) => {
        if ((window as any).__ea_updateModeBanner) {
          (window as any).__ea_updateModeBanner(m);
        }
      }, mode).catch(() => {});
    }
  }

  public async closeSession(): Promise<{ success: boolean }> {
    this.status = 'closed';
    try {
      if (this.browser) {
        await this.browser.close();
      }
    } catch {}
    this.browser = null;
    this.context = null;
    this.page = null;
    this.referenceElement = null;
    this.sessionCapturedElements = [];
    return { success: true };
  }

  public async highlightLocator(type: string, value: string): Promise<{ success: boolean; matchCount: number; error?: string }> {
    if (!this.page || this.page.isClosed()) {
      return { success: false, matchCount: 0, error: 'Browser is not open' };
    }
    try {
      const res = await this.page.evaluate(({ t, v }: { t: string; v: string }) => {
        let elements: Element[] = [];
        try {
          if (t === 'ID') {
            const el = document.getElementById(v.replace(/^#/, ''));
            if (el) elements.push(el);
          } else if (t === 'CSS Selector') {
            elements = Array.from(document.querySelectorAll(v));
          } else if (t === 'XPath') {
            const xr = document.evaluate(v, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            for (let i = 0; i < xr.snapshotLength; i++) {
              const node = xr.snapshotItem(i);
              if (node instanceof Element) elements.push(node);
            }
          } else if (t === 'Test ID') {
            elements = Array.from(document.querySelectorAll(`[data-testid="${v}"], [data-test="${v}"], [data-cy="${v}"]`));
          } else if (t === 'Role') {
            const roleMatch = v.match(/getByRole\(['"]([^'"]+)['"](?:,\s*\{\s*name:\s*['"]([^'"]+)['"]\s*\})?/);
            const roleName = (roleMatch ? roleMatch[1] : v).toLowerCase();
            const accName = roleMatch && roleMatch[2] ? roleMatch[2].toLowerCase() : '';
            elements = Array.from(document.querySelectorAll('*')).filter(e => {
              const roleAttr = (e.getAttribute('role') || '').toLowerCase();
              const tag = e.tagName.toLowerCase();
              const matchesRole = roleAttr === roleName || 
                (roleName === 'button' && (tag === 'button' || (tag === 'input' && ['submit','button'].includes((e as any).type)))) ||
                (roleName === 'link' && tag === 'a') ||
                (roleName === 'textbox' && tag === 'input' && !['checkbox','radio','submit','button'].includes((e as any).type)) ||
                (roleName === 'heading' && /^h[1-6]$/.test(tag));
              if (!matchesRole) return false;
              if (accName) {
                const text = ((e as HTMLElement).innerText || e.getAttribute('aria-label') || '').trim().toLowerCase();
                return text.includes(accName);
              }
              return true;
            });
          } else if (t === 'Name') {
            elements = Array.from(document.querySelectorAll(`[name="${v}"]`));
          } else if (t === 'Placeholder') {
            elements = Array.from(document.querySelectorAll(`[placeholder="${v}"]`));
          } else if (t === 'Label') {
            elements = Array.from(document.querySelectorAll(`[aria-label="${v}"]`));
          } else if (t === 'Text') {
            const all = Array.from(document.querySelectorAll('*'));
            elements = all.filter(e => (e.textContent || '').trim() === v.trim() && e.children.length === 0);
          } else {
            elements = Array.from(document.querySelectorAll(v));
          }
        } catch {
          // ignore selector errors
        }

        if (elements.length > 0) {
          const first = elements[0];
          first.scrollIntoView({ behavior: 'smooth', block: 'center' });

          elements.forEach(el => {
            const htmlEl = el as HTMLElement;
            const originalOutline = htmlEl.style.outline;
            const originalOffset = htmlEl.style.outlineOffset;
            const originalTransition = htmlEl.style.transition;

            htmlEl.style.transition = 'all 0.2s ease-in-out';
            htmlEl.style.outline = '4px solid #10b981';
            htmlEl.style.outlineOffset = '2px';

            setTimeout(() => {
              htmlEl.style.outline = '4px solid #38bdf8';
            }, 300);

            setTimeout(() => {
              htmlEl.style.outline = '4px solid #10b981';
            }, 600);

            setTimeout(() => {
              htmlEl.style.outline = originalOutline;
              htmlEl.style.outlineOffset = originalOffset;
              htmlEl.style.transition = originalTransition;
            }, 2200);
          });
        }

        return { count: elements.length };
      }, { t: type, v: value });

      return { success: true, matchCount: res.count };
    } catch (err: any) {
      return { success: false, matchCount: 0, error: err.message };
    }
  }

  public async testLocator(type: string, value: string): Promise<{
    success: boolean;
    matchCount: number;
    isVisible: boolean;
    isUnique: boolean;
    stability: any;
    error?: string;
  }> {
    const stability = evaluateLocatorStability(type, value);

    if (!this.page || this.page.isClosed()) {
      return {
        success: true,
        matchCount: -1,
        isVisible: true,
        isUnique: stability.isUnique,
        stability
      };
    }

    try {
      const highlightRes = await this.highlightLocator(type, value);
      const matchCount = highlightRes.matchCount;

      let isVisible = false;
      if (matchCount > 0) {
        isVisible = await this.page.evaluate(({ t, v }: { t: string; v: string }) => {
          try {
            let el: Element | null = null;
            if (t === 'ID') el = document.getElementById(v.replace(/^#/, ''));
            else if (t === 'CSS Selector') el = document.querySelector(v);
            else if (t === 'XPath') {
              const res = document.evaluate(v, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
              el = res.singleNodeValue instanceof Element ? res.singleNodeValue : null;
            } else if (t === 'Test ID') {
              el = document.querySelector(`[data-testid="${v}"], [data-test="${v}"], [data-cy="${v}"]`);
            } else if (t === 'Role') {
              const roleMatch = v.match(/getByRole\(['"]([^'"]+)['"](?:,\s*\{\s*name:\s*['"]([^'"]+)['"]\s*\})?/);
              const roleName = (roleMatch ? roleMatch[1] : v).toLowerCase();
              const accName = roleMatch && roleMatch[2] ? roleMatch[2].toLowerCase() : '';
              const all = Array.from(document.querySelectorAll('*'));
              el = all.find(e => {
                const roleAttr = (e.getAttribute('role') || '').toLowerCase();
                const tag = e.tagName.toLowerCase();
                const matchesRole = roleAttr === roleName || 
                  (roleName === 'button' && (tag === 'button' || (tag === 'input' && ['submit','button'].includes((e as any).type)))) ||
                  (roleName === 'link' && tag === 'a') ||
                  (roleName === 'textbox' && tag === 'input' && !['checkbox','radio','submit','button'].includes((e as any).type)) ||
                  (roleName === 'heading' && /^h[1-6]$/.test(tag));
                if (!matchesRole) return false;
                if (accName) {
                  const text = ((e as HTMLElement).innerText || e.getAttribute('aria-label') || '').trim().toLowerCase();
                  return text.includes(accName);
                }
                return true;
              }) || null;
            } else {
              el = document.querySelector(v);
            }
            if (!el) return false;
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
          } catch {
            return false;
          }
        }, { t: type, v: value });
      }

      const finalStability = {
        ...stability,
        count: matchCount,
        isUnique: matchCount === 1,
        isValid: matchCount > 0
      };

      return {
        success: true,
        matchCount,
        isVisible,
        isUnique: matchCount === 1,
        stability: finalStability
      };
    } catch (err: any) {
      return {
        success: false,
        matchCount: 0,
        isVisible: false,
        isUnique: false,
        stability: { ...stability, isValid: false },
        error: err.message || 'Locator evaluation failed'
      };
    }
  }

  private findDuplicateElement(data: InspectedElementPayload, strategies: FinderStrategy[]): any | null {
    const tag = (data.tagName || '').toLowerCase().trim();
    const text = (data.textContent || '').replace(/\s+/g, ' ').toLowerCase().trim();
    const id = (data.id || '').trim();
    const testId = (data.testId || '').trim();
    const name = (data.name || '').trim();
    const xpath = (data.xpath || '').trim();
    const css = (data.cssSelector || '').trim();

    for (const existing of this.sessionCapturedElements) {
      const exRaw = existing.rawPayload || {};
      const exTag = (existing.tag || exRaw.tagName || '').toLowerCase().trim();
      const exText = (existing.visibleText || exRaw.textContent || '').replace(/\s+/g, ' ').toLowerCase().trim();
      const exId = (exRaw.id || '').trim();
      const exTestId = (exRaw.testId || '').trim();
      const exName = (exRaw.name || '').trim();
      const exXpath = (exRaw.xpath || '').trim();
      const exCss = (exRaw.cssSelector || '').trim();

      // 1. Same non-empty XPath
      if (xpath && exXpath && xpath === exXpath) {
        return existing;
      }

      // 2. Same CSS selector (if not generic tag)
      if (css && exCss && css === exCss && !['div', 'span', 'p', 'a', 'button'].includes(css)) {
        return existing;
      }

      // 3. Same Test ID
      if (testId && exTestId && testId === exTestId) {
        return existing;
      }

      // 4. Same non-empty ID and tag matches
      if (id && exId && id === exId && tag === exTag) {
        return existing;
      }

      // 5. Same name attribute and tag matches
      if (name && exName && name === exName && tag === exTag) {
        return existing;
      }

      // 6. Primary locator matches identically
      const primaryLoc = strategies.find(s => s.isPrimary) || strategies[0];
      if (primaryLoc && existing.locators && Array.isArray(existing.locators)) {
        const primaryMatch = existing.locators.find(
          (l: any) => l.isPrimary && l.type === primaryLoc.type && l.value.trim() === primaryLoc.value.trim()
        );
        if (primaryMatch) {
          return existing;
        }

        // Reliable high-priority locator matches (e.g. Test ID, ID, Role with same name, Label)
        const reliableTypes = ['Test ID', 'ID', 'Role', 'Label', 'Placeholder'];
        if (reliableTypes.includes(primaryLoc.type)) {
          const match = existing.locators.find(
            (l: any) => l.type === primaryLoc.type && l.value.trim() === primaryLoc.value.trim()
          );
          if (match) {
            return existing;
          }
        }
      }

      // 7. Same tag + exact same visible text (for buttons, links, headings)
      if (tag && exTag && tag === exTag && text && exText && text === exText) {
        if (['button', 'a', 'h1', 'h2', 'h3', 'h4', 'span', 'label'].includes(tag)) {
          return existing;
        }
      }
    }

    return null;
  }

  private async handleCapturedElement(data: InspectedElementPayload) {
    if (this.captureMode === 'reference') {
      if (!this.referenceElement) {
        // Step 1: Captured Reference Element
        this.referenceElement = data;
        if (this.page && !this.page.isClosed()) {
          await this.page.evaluate((ref: InspectedElementPayload) => {
            if ((window as any).__ea_setReferenceState) {
              (window as any).__ea_setReferenceState(ref);
            }
          }, data).catch(() => {});
        }
        return;
      }

      // Step 2: Captured Target Element relative to reference
      const ref = this.referenceElement;
      this.referenceElement = null;

      let generatedStrategies = this.generateStrategiesForElement(data, ref);
      generatedStrategies = await this.verifyAndRankStrategies(generatedStrategies);
      const duplicate = this.findDuplicateElement(data, generatedStrategies);
      if (duplicate) {
        await this.updateBrowserFloatingPreview(data, generatedStrategies, true, duplicate.sequence);
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('finder:elementCaptured', {
            ...duplicate,
            isDuplicate: true
          });
        }
        return;
      }

      this.capturedSequence += 1;
      const capturedRecord = {
        id: 'cap_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        sequence: this.capturedSequence,
        name: data.textContent ? `${data.textContent.slice(0, 24)} [Rel]` : `${data.tagName} #${this.capturedSequence}`,
        type: this.guessElementType(data.tagName, data.type),
        tag: data.tagName,
        visibleText: data.textContent,
        accessibleName: data.ariaLabel || data.name || data.textContent,
        description: `Captured relative to <${ref.tagName}> "${ref.textContent.slice(0, 20)}"`,
        locators: generatedStrategies,
        primaryLocatorId: generatedStrategies[0]?.id || '',
        referenceMode: true,
        referenceData: {
          refTag: ref.tagName,
          refText: ref.textContent,
          refId: ref.id
        },
        rawPayload: data,
        capturedAt: new Date().toISOString()
      };
      this.sessionCapturedElements.push(capturedRecord);

      // Show floating preview in browser page
      await this.updateBrowserFloatingPreview(data, generatedStrategies, false, this.capturedSequence);

      // Stream to Electron renderer window
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('finder:elementCaptured', capturedRecord);
      }
      return;
    }

    // Normal Capture Mode
    let generatedStrategies = this.generateStrategiesForElement(data);
    generatedStrategies = await this.verifyAndRankStrategies(generatedStrategies);
    const duplicate = this.findDuplicateElement(data, generatedStrategies);
    if (duplicate) {
      await this.updateBrowserFloatingPreview(data, generatedStrategies, true, duplicate.sequence);
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('finder:elementCaptured', {
          ...duplicate,
          isDuplicate: true
        });
      }
      return;
    }

    this.capturedSequence += 1;
    let elemName = data.textContent
      ? data.textContent.replace(/\s+/g, ' ').slice(0, 28)
      : data.name || data.id || `${data.tagName} #${this.capturedSequence}`;
    elemName = elemName.trim() || `Element #${this.capturedSequence}`;

    const capturedRecord = {
      id: 'cap_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      sequence: this.capturedSequence,
      name: elemName,
      type: this.guessElementType(data.tagName, data.type),
      tag: data.tagName,
      visibleText: data.textContent,
      accessibleName: data.ariaLabel || data.name || data.textContent,
      description: `Captured via Live Web Element Finder on ${new Date().toLocaleTimeString()}`,
      locators: generatedStrategies,
      primaryLocatorId: generatedStrategies[0]?.id || '',
      rawPayload: data,
      capturedAt: new Date().toISOString()
    };
    this.sessionCapturedElements.push(capturedRecord);

    // Show floating preview in live browser
    await this.updateBrowserFloatingPreview(data, generatedStrategies, false, this.capturedSequence);

    // Stream to Electron renderer window
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('finder:elementCaptured', capturedRecord);
    }
  }

  private guessElementType(tag: string, inputType?: string): any {
    const t = (tag || '').toLowerCase();
    const it = (inputType || '').toLowerCase();
    if (t === 'button' || it === 'submit' || it === 'button') return 'Button';
    if (t === 'input') {
      if (it === 'checkbox') return 'Checkbox';
      if (it === 'radio') return 'Radio Button';
      return 'Input Field';
    }
    if (t === 'a') return 'Link';
    if (t === 'select') return 'Dropdown / Select';
    if (t === 'table') return 'Table';
    if (['h1', 'h2', 'h3', 'p', 'span', 'label'].includes(t)) return 'Text / Label';
    return 'Button';
  }

  private generateStrategiesForElement(el: InspectedElementPayload, refEl?: InspectedElementPayload): FinderStrategy[] {
    const list: Array<{ type: string; value: string; valueType?: 'Static' | 'Dynamic' }> = [];
    const tag = el.tagName || 'button';

    // If Reference Mode: relative locators
    if (refEl) {
      if (refEl.id && el.name) {
        list.push({ type: 'CSS Selector', value: `#${refEl.id} [name="${el.name}"]` });
      }
      if (refEl.textContent && el.tagName) {
        const cleanRefText = refEl.textContent.slice(0, 20).replace(/'/g, "\\'");
        list.push({
          type: 'XPath',
          value: `//${refEl.tagName}[contains(., '${cleanRefText}')]//${tag}`
        });
        list.push({
          type: 'XPath',
          value: `//${refEl.tagName}[contains(., '${cleanRefText}')]/following-sibling::${tag}`
        });
      }
      if (refEl.testId && el.testId) {
        list.push({ type: 'CSS Selector', value: `[data-testid="${refEl.testId}"] [data-testid="${el.testId}"]` });
      }
    }

    // 1. Playwright getByRole / Role
    let roleName = el.role;
    if (!roleName) {
      if (tag === 'button' || (tag === 'input' && ['submit', 'button'].includes(el.type))) roleName = 'button';
      else if (tag === 'a') roleName = 'link';
      else if (tag === 'input' && !['checkbox', 'radio', 'submit', 'button'].includes(el.type)) roleName = 'textbox';
      else if (tag === 'textarea') roleName = 'textbox';
      else if (tag === 'select') roleName = 'combobox';
      else if (tag === 'input' && el.type === 'checkbox') roleName = 'checkbox';
      else if (tag === 'input' && el.type === 'radio') roleName = 'radio';
      else if (/^h[1-6]$/.test(tag)) roleName = 'heading';
      else if (tag === 'img') roleName = 'img';
      else if (tag === 'table') roleName = 'table';
      else if (tag === 'form') roleName = 'form';
    }

    if (roleName) {
      const text = (el.ariaLabel || el.textContent || '').trim();
      if (text && text.length <= 40) {
        list.push({ type: 'Role', value: `getByRole('${roleName}', { name: '${text.replace(/'/g, "\\'")}' })` });
      } else {
        list.push({ type: 'Role', value: `getByRole('${roleName}')` });
      }
    }

    // 2. Dedicated Automation Test ID (Highest standard)
    if (el.testId) {
      list.push({ type: 'Test ID', value: el.testId });
    }

    // 3. Accessible Label
    if (el.ariaLabel) {
      list.push({ type: 'Label', value: el.ariaLabel });
    }

    // 4. Form Placeholder
    if (el.placeholder) {
      list.push({ type: 'Placeholder', value: el.placeholder });
    }

    // 5. Semantic Clean ID
    if (el.id && !/ember\d+|react-\d+|ng-\d+|\b\d{5,}\b/i.test(el.id)) {
      list.push({ type: 'ID', value: el.id });
    }

    // 6. Name Attribute
    if (el.name) {
      list.push({ type: 'Name', value: el.name });
    }

    // 7. Clean Tag-Scoped XPath (Strict exact match)
    if (el.textContent && el.textContent.length <= 50) {
      const cleanText = el.textContent.trim().replace(/'/g, "\\'");
      list.push({ type: 'XPath', value: `//${tag}[normalize-space()='${cleanText}']` });
    }

    // 8. Clean CSS Selector
    if (el.className) {
      const cleanClasses = el.className.split(/\s+/).filter(c => !c.includes(':') && !c.includes('[')).slice(0, 2).join('.');
      if (cleanClasses) {
        list.push({ type: 'CSS Selector', value: `${tag}.${cleanClasses}` });
      }
    } else if (el.name) {
      list.push({ type: 'CSS Selector', value: `${tag}[name="${el.name}"]` });
    } else if (/^h[1-6]$/.test(tag)) {
      list.push({ type: 'CSS Selector', value: tag });
    }

    // 9. Short Relative XPath
    if (el.testId) {
      list.push({ type: 'XPath', value: `//${tag}[@data-testid='${el.testId}']` });
    } else if (el.id) {
      list.push({ type: 'XPath', value: `//${tag}[@id='${el.id}']` });
    } else if (el.name) {
      list.push({ type: 'XPath', value: `//${tag}[@name='${el.name}']` });
    } else if (el.textContent && el.textContent.length <= 35) {
      list.push({ type: 'XPath', value: `//${tag}[contains(., '${el.textContent.slice(0, 30).replace(/'/g, "\\'")}')]` });
    }

    // 10. Visible Text (Fallback)
    if (el.textContent && el.textContent.length <= 50) {
      list.push({ type: 'Text', value: el.textContent.trim() });
    }

    // Dynamic placeholder candidate
    if (/cart|product|item|tier|qty|price/i.test(el.name || el.id || el.textContent)) {
      list.push({
        type: 'XPath',
        value: `//${tag}[@data-item-id='{dynamic item id}' and contains(., '${el.textContent.slice(0, 20).replace(/'/g, "\\'")}')]`,
        valueType: 'Dynamic'
      });
    }

    // Deduplicate and evaluate stability
    const seen = new Set<string>();
    const unique = list.filter(item => {
      const key = `${item.type}:${item.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return unique.map((item, idx) => {
      const evaluation = evaluateLocatorStability(item.type, item.value);
      return {
        id: 'strat_' + idx + '_' + Math.random().toString(36).substring(2, 6),
        type: item.type as any,
        value: item.value,
        valueType: item.valueType || 'Static',
        isPrimary: idx === 0,
        priority: idx + 1,
        selected: true,
        stabilityScore: evaluation.stabilityScore,
        stability: evaluation.stability,
        reasons: evaluation.reasons,
        feedback: evaluation.feedback,
        matchCount: 1
      };
    });
  }

  private async verifyAndRankStrategies(strategies: FinderStrategy[]): Promise<FinderStrategy[]> {
    if (!this.page || this.page.isClosed()) return strategies;
    try {
      const counts = await this.page.evaluate((items: Array<{ type: string; value: string }>) => {
        return items.map(strat => {
          try {
            const t = strat.type;
            const v = strat.value;
            let elements: Element[] = [];
            if (t === 'ID') {
              const el = document.getElementById(v.replace(/^#/, ''));
              if (el) elements.push(el);
            } else if (t === 'CSS Selector') {
              elements = Array.from(document.querySelectorAll(v));
            } else if (t === 'XPath') {
              const xr = document.evaluate(v, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
              for (let i = 0; i < xr.snapshotLength; i++) {
                const node = xr.snapshotItem(i);
                if (node instanceof Element) elements.push(node);
              }
            } else if (t === 'Test ID') {
              elements = Array.from(document.querySelectorAll(`[data-testid="${v}"], [data-test="${v}"], [data-cy="${v}"]`));
            } else if (t === 'Role') {
              const roleMatch = v.match(/getByRole\(['"]([^'"]+)['"](?:,\s*\{\s*name:\s*['"]([^'"]+)['"]\s*\})?/);
              const roleName = (roleMatch ? roleMatch[1] : v).toLowerCase();
              const accName = roleMatch && roleMatch[2] ? roleMatch[2].toLowerCase() : '';
              elements = Array.from(document.querySelectorAll('*')).filter(e => {
                const roleAttr = (e.getAttribute('role') || '').toLowerCase();
                const tag = e.tagName.toLowerCase();
                const matchesRole = roleAttr === roleName || 
                  (roleName === 'button' && (tag === 'button' || (tag === 'input' && ['submit','button'].includes((e as any).type)))) ||
                  (roleName === 'link' && tag === 'a') ||
                  (roleName === 'textbox' && tag === 'input' && !['checkbox','radio','submit','button'].includes((e as any).type)) ||
                  (roleName === 'heading' && /^h[1-6]$/.test(tag));
                if (!matchesRole) return false;
                if (accName) {
                  const text = ((e as HTMLElement).innerText || e.getAttribute('aria-label') || '').trim().toLowerCase();
                  return text.includes(accName);
                }
                return true;
              });
            } else if (t === 'Text') {
              const all = Array.from(document.querySelectorAll('*'));
              elements = all.filter(e => (e.textContent || '').trim() === v.trim() && e.children.length === 0);
            } else {
              elements = Array.from(document.querySelectorAll(v));
            }
            return elements.length;
          } catch {
            return 0;
          }
        });
      }, strategies.map(s => ({ type: s.type, value: s.value })));

      const ranked = strategies.map((s, idx) => {
        const count = typeof counts[idx] === 'number' ? counts[idx] : 1;
        let score = s.stabilityScore;
        if (count === 1) {
          score = Math.min(100, score + 10);
        } else if (count > 1) {
          score = Math.max(15, score - 40); // heavily penalize duplicate matches
        } else {
          score = 10;
        }

        return {
          ...s,
          matchCount: count,
          stabilityScore: score,
          stability: (score >= 80 ? 'High' : score >= 50 ? 'Moderate' : 'Low') as any,
          reasons: count > 1 
            ? [`Ambiguous locator: matches ${count} duplicate elements on this page`, ...s.reasons]
            : count === 1
              ? ['Uniquely targets exactly 1 element', ...s.reasons]
              : s.reasons
        };
      });

      // Sort: Unique locators (matchCount === 1) ALWAYS first!
      ranked.sort((a, b) => {
        if (a.matchCount === 1 && b.matchCount !== 1) return -1;
        if (b.matchCount === 1 && a.matchCount !== 1) return 1;
        return b.stabilityScore - a.stabilityScore;
      });

      ranked.forEach((s, idx) => {
        s.priority = idx + 1;
        s.isPrimary = idx === 0 && s.matchCount === 1;
      });

      return ranked;
    } catch {
      return strategies;
    }
  }

  private async updateBrowserFloatingPreview(
    el: InspectedElementPayload,
    strategies: FinderStrategy[],
    isDuplicate: boolean = false,
    seq?: number
  ) {
    if (!this.page || this.page.isClosed()) return;
    try {
      await this.page.evaluate(({ element, topLocators, seq, isDuplicate }: { element: any; topLocators: any[]; seq: number; isDuplicate: boolean }) => {
        if ((window as any).__ea_showFloatingPreview) {
          (window as any).__ea_showFloatingPreview(element, topLocators, seq, isDuplicate);
        }
      }, {
        element: {
          tagName: el.tagName,
          textContent: el.textContent,
          accessibleName: el.ariaLabel || el.name || el.textContent,
          id: el.id
        },
        topLocators: strategies.slice(0, 5).map(s => ({
          type: s.type,
          value: s.value,
          score: s.stabilityScore,
          stability: s.stability,
          matchCount: typeof s.matchCount === 'number' ? s.matchCount : 1
        })),
        seq: seq || this.capturedSequence,
        isDuplicate
      });
    } catch {}
  }

  private async injectInspectorScript(page: any) {
    await page.evaluate(`
      (() => {
        // Prevent multiple injections
        if (window.__ea_inspector_installed) return;
        window.__ea_inspector_installed = true;

        let captureActive = true;
        let currentMode = 'normal';
        let referenceElement = null;

        window.__ea_setCaptureActive = (active) => {
          captureActive = active;
          const statusText = document.getElementById('__ea_banner_status');
          if (statusText) {
            statusText.innerText = active ? '● Capturing (Click element)' : '⏸ Paused (Click resume in app)';
            statusText.style.color = active ? '#38bdf8' : '#f59e0b';
          }
        };

        window.__ea_updateModeBanner = (mode) => {
          currentMode = mode;
          referenceElement = null;
          const modeBadge = document.getElementById('__ea_banner_mode');
          if (modeBadge) {
            modeBadge.innerText = mode === 'reference' ? '🔗 Reference Mode' : '🎯 Normal Mode';
            modeBadge.style.background = mode === 'reference' ? 'rgba(168,85,247,0.2)' : 'rgba(56,189,248,0.2)';
            modeBadge.style.color = mode === 'reference' ? '#c084fc' : '#38bdf8';
          }
        };

        window.__ea_setReferenceState = (ref) => {
          referenceElement = ref;
          const banner = document.getElementById('__ea_inspector_banner');
          if (banner) {
            banner.innerHTML = '📌 <strong>Reference Saved:</strong> &lt;' + ref.tagName + '&gt; "' + (ref.textContent || ref.id).slice(0,25) + '" — <em>Now Click the TARGET element</em>';
            banner.style.background = '#3b0764';
            banner.style.border = '2px solid #a855f7';
          }
        };

        // 1. Top Banner
        const banner = document.createElement('div');
        banner.id = '__ea_inspector_banner';
        banner.style.position = 'fixed';
        banner.style.top = '12px';
        banner.style.left = '50%';
        banner.style.transform = 'translateX(-50%)';
        banner.style.zIndex = '2147483640';
        banner.style.background = 'rgba(10, 15, 29, 0.95)';
        banner.style.backdropFilter = 'blur(8px)';
        banner.style.color = '#e2e8f0';
        banner.style.border = '1.5px solid #38bdf8';
        banner.style.borderRadius = '9999px';
        banner.style.padding = '6px 20px';
        banner.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        banner.style.fontSize = '12px';
        banner.style.fontWeight = '600';
        banner.style.boxShadow = '0 10px 30px rgba(0,0,0,0.6)';
        banner.style.pointerEvents = 'none';
        banner.style.display = 'flex';
        banner.style.alignItems = 'center';
        banner.style.gap = '12px';
        banner.innerHTML = '<span id="__ea_banner_mode" style="background:rgba(56,189,248,0.2);color:#38bdf8;padding:2px 8px;border-radius:12px;font-size:11px;">🎯 Normal Mode</span><span id="__ea_banner_status" style="color:#38bdf8;">● Capturing (Click any element)</span>';
        document.body.appendChild(banner);

        // 2. Responsive In-Browser Floating Preview Card
        let previewCard = document.getElementById('__ea_locator_preview');
        if (!previewCard) {
          previewCard = document.createElement('div');
          previewCard.id = '__ea_locator_preview';
          previewCard.style.position = 'fixed';
          previewCard.style.bottom = '20px';
          previewCard.style.right = '20px';
          previewCard.style.zIndex = '2147483647';
          previewCard.style.width = '350px';
          previewCard.style.maxHeight = '520px';
          previewCard.style.background = '#090d16';
          previewCard.style.color = '#f8fafc';
          previewCard.style.border = '1.5px solid rgba(56, 189, 248, 0.5)';
          previewCard.style.borderRadius = '14px';
          previewCard.style.boxShadow = '0 20px 45px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255,255,255,0.06)';
          previewCard.style.fontFamily = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          previewCard.style.fontSize = '12px';
          previewCard.style.display = 'none';
          previewCard.style.flexDirection = 'column';
          previewCard.style.overflow = 'hidden';
          previewCard.style.userSelect = 'none';
          document.body.appendChild(previewCard);

          // Card Event Delegation: Handles close, toggle, copy, test without capture interference
          previewCard.addEventListener('click', (e) => {
            e.stopPropagation();

            const btn = e.target.closest('button');
            if (!btn) return;

            const action = btn.getAttribute('data-ea-action');
            if (action === 'close') {
              previewCard.style.display = 'none';
            } else if (action === 'toggle') {
              const body = previewCard.querySelector('#__ea_preview_body');
              if (body) {
                const isHidden = body.style.display === 'none';
                body.style.display = isHidden ? 'flex' : 'none';
                btn.innerText = isHidden ? '−' : '□';
                btn.title = isHidden ? 'Minimize' : 'Expand';
              }
            } else if (action === 'copy') {
              const text = decodeURIComponent(btn.getAttribute('data-ea-val') || '');
              if (window.__ea_onCopyLocator) {
                window.__ea_onCopyLocator(text);
              }
              if (navigator.clipboard) {
                navigator.clipboard.writeText(text).catch(() => {});
              }
              const orig = btn.innerText;
              btn.innerText = '✓ Copied';
              btn.style.color = '#34d399';
              btn.style.borderColor = '#10b981';
              setTimeout(() => {
                btn.innerText = orig;
                btn.style.color = '';
                btn.style.borderColor = '';
              }, 1500);
            } else if (action === 'test') {
              const type = btn.getAttribute('data-ea-type') || '';
              const val = decodeURIComponent(btn.getAttribute('data-ea-val') || '');
              const orig = btn.innerText;
              btn.innerText = 'Testing...';
              btn.style.color = '#38bdf8';
              if (window.__ea_onTestLocatorFromPage) {
                window.__ea_onTestLocatorFromPage(type, val).then((res) => {
                  if (res && res.matchCount === 1) {
                    btn.innerText = '✓ Match (1)';
                    btn.style.color = '#34d399';
                    btn.style.borderColor = '#10b981';
                  } else if (res && res.matchCount > 1) {
                    btn.innerText = '⚠ Duplicate (' + res.matchCount + ')';
                    btn.style.color = '#f59e0b';
                    btn.style.borderColor = '#f59e0b';
                  } else {
                    btn.innerText = '✕ 0 Match';
                    btn.style.color = '#f87171';
                    btn.style.borderColor = '#ef4444';
                  }
                  setTimeout(() => {
                    btn.innerText = orig;
                    btn.style.color = '';
                    btn.style.borderColor = '';
                  }, 2500);
                }).catch(() => {
                  btn.innerText = orig;
                  btn.style.color = '';
                });
              }
            }
          });

          // Smooth drag by header
          let isDragging = false;
          let dragStartX = 0;
          let dragStartY = 0;
          let cardInitLeft = 0;
          let cardInitTop = 0;

          previewCard.addEventListener('mousedown', (e) => {
            const header = e.target.closest('#__ea_preview_drag_header');
            if (!header || e.target.closest('button')) return;
            isDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            const rect = previewCard.getBoundingClientRect();
            previewCard.style.bottom = 'auto';
            previewCard.style.right = 'auto';
            previewCard.style.left = rect.left + 'px';
            previewCard.style.top = rect.top + 'px';
            cardInitLeft = rect.left;
            cardInitTop = rect.top;
            e.preventDefault();
          });

          window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const newLeft = Math.max(10, Math.min(window.innerWidth - 360, cardInitLeft + e.clientX - dragStartX));
            const newTop = Math.max(10, Math.min(window.innerHeight - 80, cardInitTop + e.clientY - dragStartY));
            previewCard.style.left = newLeft + 'px';
            previewCard.style.top = newTop + 'px';
          });

          window.addEventListener('mouseup', () => {
            isDragging = false;
          });
        }

        const escapeHtml = (str) => {
          return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        };

        window.__ea_showFloatingPreview = (element, topLocators, seq, isDuplicate) => {
          // 1. Update top banner
          const banner = document.getElementById('__ea_inspector_banner');
          if (banner) {
            const tagName = element.tagName || 'element';
            const name = (element.textContent || element.accessibleName || element.id || '').trim().slice(0, 24);
            if (isDuplicate) {
              banner.style.background = 'rgba(15, 23, 42, 0.96)';
              banner.style.borderColor = '#f59e0b';
              banner.style.boxShadow = '0 10px 30px rgba(245, 158, 11, 0.4)';
              banner.innerHTML = '<span style="background:rgba(245,158,11,0.25);color:#fbbf24;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;">ℹ Already Captured</span> <span style="font-weight:600;color:#fff;">&lt;' + tagName + '&gt; "' + name + '"</span> <span style="color:#fde68a;font-size:11px;">(#' + seq + ') → Selected in Finder</span>';
            } else {
              banner.style.background = 'rgba(10, 15, 29, 0.95)';
              banner.style.borderColor = '#10b981';
              banner.style.boxShadow = '0 10px 30px rgba(16, 185, 129, 0.4)';
              banner.innerHTML = '<span style="background:rgba(16,185,129,0.25);color:#34d399;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;">✓ Captured</span> <span style="font-weight:600;color:#fff;">&lt;' + tagName + '&gt; "' + name + '"</span> <span style="color:#a7f3d0;font-size:11px;">→ Streamed to Locator Finder</span>';
            }
            setTimeout(() => {
              const currentBanner = document.getElementById('__ea_inspector_banner');
              if (currentBanner === banner) {
                banner.style.background = 'rgba(10, 15, 29, 0.95)';
                banner.style.borderColor = '#38bdf8';
                banner.style.boxShadow = '0 10px 30px rgba(0,0,0,0.6)';
                banner.innerHTML = '<span id="__ea_banner_mode" style="background:rgba(56,189,248,0.2);color:#38bdf8;padding:2px 8px;border-radius:12px;font-size:11px;">' + (currentMode === 'reference' ? '🔗 Reference Mode' : '🎯 Normal Mode') + '</span><span id="__ea_banner_status" style="color:#38bdf8;">● Capturing (Click any element)</span>';
              }
            }, 2500);
          }

          // 2. Render & Show Floating Preview Card
          if (previewCard) {
            previewCard.style.display = 'flex';
            if (isDuplicate) {
              previewCard.style.borderColor = 'rgba(245, 158, 11, 0.7)';
            } else {
              previewCard.style.borderColor = 'rgba(56, 189, 248, 0.5)';
            }
            const tagName = element.tagName || 'element';
            const rawName = (element.textContent || element.accessibleName || element.id || '').trim();
            const name = rawName.slice(0, 22) + (rawName.length > 22 ? '…' : '');
            const seqNum = seq || element.sequence || 1;

            let locatorsHtml = '';
            (topLocators || []).forEach(function(loc) {
              const isHigh = (loc.score >= 80) || loc.stability === 'High';
              const scoreColor = isHigh ? '#34d399' : (loc.score >= 50 ? '#f59e0b' : '#94a3b8');
              const badgeBg = loc.type === 'Role' ? 'rgba(56,189,248,0.2)' : 'rgba(148,163,184,0.15)';
              const badgeColor = loc.type === 'Role' ? '#38bdf8' : '#cbd5e1';
              const encodedVal = encodeURIComponent(loc.value);
              const matchBadge = loc.matchCount === 1
                ? '<span style="color:#34d399;font-size:10px;font-weight:700;">✓ 1 Match (Unique)</span>'
                : (loc.matchCount > 1
                  ? '<span style="color:#f59e0b;font-size:10px;font-weight:700;">⚠ ' + loc.matchCount + ' Matches (Duplicate)</span>'
                  : '<span style="font-size:10px;font-weight:700;color:' + scoreColor + ';">' + (loc.stability || 'Score') + ' (' + (loc.score || 80) + ')</span>');

              locatorsHtml += '<div style="background:rgba(15,23,42,0.95);border:1px solid rgba(51,65,85,0.7);border-radius:10px;padding:9px 11px;margin-bottom:8px;">'
                + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">'
                + '<span style="background:' + badgeBg + ';color:' + badgeColor + ';padding:2px 7px;border-radius:6px;font-size:10px;font-weight:700;font-family:monospace;">' + loc.type + '</span>'
                + matchBadge
                + '</div>'
                + '<div style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:11px;color:#f1f5f9;word-break:break-all;line-height:1.4;margin-bottom:7px;max-height:56px;overflow-y:auto;background:rgba(2,6,23,0.7);padding:5px 8px;border-radius:6px;border:1px solid rgba(30,41,59,0.8);user-select:text;">'
                + escapeHtml(loc.value)
                + '</div>'
                + '<div style="display:flex;justify-content:flex-end;gap:6px;">'
                + '<button data-ea-action="copy" data-ea-val="' + encodedVal + '" style="background:rgba(30,41,59,0.9);border:1px solid rgba(71,85,105,0.7);color:#cbd5e1;padding:3px 10px;border-radius:6px;font-size:10px;font-weight:600;cursor:pointer;transition:all 0.15s ease;">Copy</button>'
                + '<button data-ea-action="test" data-ea-type="' + loc.type + '" data-ea-val="' + encodedVal + '" style="background:rgba(6,78,59,0.5);border:1px solid rgba(16,185,129,0.6);color:#34d399;padding:3px 10px;border-radius:6px;font-size:10px;font-weight:600;cursor:pointer;transition:all 0.15s ease;">Test</button>'
                + '</div></div>';
            });

            const statusDotColor = isDuplicate ? '#f59e0b' : '#10b981';
            const statusTextColor = isDuplicate ? '#fbbf24' : '#38bdf8';
            const statusLabel = isDuplicate ? 'ALREADY CAPTURED' : 'CAPTURED';
            const seqLabel = isDuplicate ? '#' + seqNum + ' (In Session)' : '#' + seqNum;
            const activeIndicator = isDuplicate
              ? '<span style="font-size:10px;font-weight:700;color:#fbbf24;display:flex;align-items:center;gap:4px;"><span style="width:5px;height:5px;border-radius:50%;background:#f59e0b;"></span>Selected in Finder</span>'
              : '<span style="font-size:10px;font-weight:700;color:#38bdf8;display:flex;align-items:center;gap:4px;"><span style="width:5px;height:5px;border-radius:50%;background:#38bdf8;"></span>Active in Finder</span>';
            const footerSync = isDuplicate
              ? '<span>Already in Session (#' + seqNum + ')</span><span style="color:#fbbf24;font-weight:600;">✓ Selected</span>'
              : '<span>Streamed to Easy Automate App</span><span style="color:#10b981;font-weight:600;">✓ Synced</span>';

            previewCard.innerHTML = '<div id="__ea_preview_drag_header" style="background:#0f172a;border-bottom:1px solid rgba(51,65,85,0.7);padding:9px 12px;display:flex;align-items:center;justify-content:space-between;cursor:grab;user-select:none;">'
              + '<div style="display:flex;align-items:center;gap:7px;min-width:0;">'
              + '<span style="width:7px;height:7px;border-radius:50%;background:' + statusDotColor + ';box-shadow:0 0 8px ' + statusDotColor + ';shrink:0;"></span>'
              + '<span style="font-weight:800;font-size:11px;color:' + statusTextColor + ';text-transform:uppercase;letter-spacing:0.5px;">' + statusLabel + '</span>'
              + '<span style="font-size:11px;color:#e2e8f0;font-weight:600;max-width:145px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">&lt;' + tagName + '&gt; &quot;' + name + '&quot;</span>'
              + '</div>'
              + '<div style="display:flex;align-items:center;gap:3px;">'
              + '<span style="background:rgba(56,189,248,0.15);color:#38bdf8;border:1px solid rgba(56,189,248,0.3);padding:1px 6px;border-radius:6px;font-size:10px;font-weight:700;margin-right:3px;">' + seqLabel + '</span>'
              + '<button data-ea-action="toggle" title="Minimize/Expand" style="background:transparent;border:none;color:#94a3b8;cursor:pointer;font-size:14px;line-height:1;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:4px;">−</button>'
              + '<button data-ea-action="close" title="Close" style="background:transparent;border:none;color:#94a3b8;cursor:pointer;font-size:14px;line-height:1;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:4px;">✕</button>'
              + '</div></div>'
              + '<div id="__ea_preview_body" style="display:flex;flex-direction:column;max-height:430px;">'
              + '<div style="padding:8px 12px 6px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(30,41,59,0.5);">'
              + '<span style="font-size:11px;font-weight:600;color:#94a3b8;">Top Locator Recommendations (' + (topLocators || []).length + ')</span>'
              + activeIndicator
              + '</div>'
              + '<div style="padding:10px 12px 4px;overflow-y:auto;max-height:360px;">'
              + locatorsHtml
              + '</div>'
              + '<div style="padding:6px 12px;background:#050912;border-top:1px solid rgba(30,41,59,0.8);display:flex;align-items:center;justify-content:space-between;font-size:10px;color:#64748b;">'
              + footerSync
              + '</div></div>';
          }
        };

        // 3. Hover Outline
        let prevTarget = null;
        let prevOutline = '';

        document.addEventListener('mouseover', (e) => {
          if (!captureActive) return;
          if (e.target.closest('#__ea_inspector_banner') || e.target.closest('#__ea_locator_preview')) return;
          if (prevTarget && prevTarget !== e.target) {
            prevTarget.style.outline = prevOutline;
          }
          prevTarget = e.target;
          prevOutline = e.target.style.outline;
          e.target.style.outline = '3px solid #38bdf8';
        }, true);

        // 4. Click Capture Handler
        document.addEventListener('click', (e) => {
          if (!captureActive) return;
          if (e.target.closest('#__ea_inspector_banner') || e.target.closest('#__ea_locator_preview')) return;

          e.preventDefault();
          e.stopPropagation();

          const el = e.target;
          const tagName = el.tagName.toLowerCase();
          const textContent = (el.innerText || el.textContent || '').trim().slice(0, 100);
          const id = el.id || '';
          const name = el.getAttribute('name') || '';
          const testId = el.getAttribute('data-testid') || el.getAttribute('data-test') || el.getAttribute('data-cy') || el.getAttribute('data-qa') || '';
          const className = (el.className || '').toString().trim();
          const placeholder = el.getAttribute('placeholder') || '';
          const role = el.getAttribute('role') || '';
          const type = el.getAttribute('type') || '';
          const ariaLabel = el.getAttribute('aria-label') || '';
          const alt = el.getAttribute('alt') || '';
          const title = el.getAttribute('title') || '';

          // XPath
          let xpath = '//' + tagName;
          if (id) xpath += '[@id="' + id + '"]';
          else if (testId) xpath += '[@data-testid="' + testId + '"]';
          else if (name) xpath += '[@name="' + name + '"]';
          else if (textContent) xpath += '[contains(., "' + textContent.slice(0, 30).replace(/"/g, '') + '")]';

          // CSS Selector
          let cssSelector = tagName;
          if (id) cssSelector = '#' + id;
          else if (testId) cssSelector = '[data-testid="' + testId + '"]';
          else if (name) cssSelector = tagName + '[name="' + name + '"]';
          else if (className) {
            const cleanClasses = className.split(/\\s+/).filter(c => !c.includes(':') && !c.includes('[')).slice(0, 2).join('.');
            if (cleanClasses) cssSelector = tagName + '.' + cleanClasses;
          }

          // Parent info
          const parent = el.parentElement;
          const parentTag = parent ? parent.tagName.toLowerCase() : '';
          const parentText = parent ? (parent.innerText || '').slice(0, 30) : '';
          const parentTestId = parent ? (parent.getAttribute('data-testid') || '') : '';

          const payload = {
            tagName,
            textContent,
            id,
            name,
            testId,
            className,
            placeholder,
            role,
            type,
            ariaLabel,
            alt,
            title,
            xpath,
            cssSelector,
            parentTag,
            parentText,
            parentTestId
          };

          if (window.__ea_onElementCaptured) {
            window.__ea_onElementCaptured(payload);
          }
        }, true);
      })();
    `).catch((err: any) => {
      console.error('[Finder] Failed to evaluate inspector script in page:', err?.message || err);
    });
  }
}

export const finderSession = new FinderSessionManager();

