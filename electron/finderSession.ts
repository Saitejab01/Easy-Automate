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
  private mainWindow: BrowserWindow | null = null;

  public setMainWindow(win: BrowserWindow | null) {
    this.mainWindow = win;
  }

  public setCapturedSequence(seq: number) {
    this.capturedSequence = Math.max(0, Number(seq) || 0);
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
    if (!cleanUrl) cleanUrl = 'https://demo.playwright.dev';
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

      await this.page.goto(cleanUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
      await this.injectInspectorScript(this.page);

      this.status = 'capturing';
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
      this.capturedSequence += 1;

      const generatedStrategies = this.generateStrategiesForElement(data, ref);

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
        capturedAt: new Date().toISOString()
      };

      // Show floating preview in browser page
      await this.updateBrowserFloatingPreview(data, generatedStrategies);

      // Stream to Electron renderer window
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('finder:elementCaptured', capturedRecord);
      }
      return;
    }

    // Normal Capture Mode
    this.capturedSequence += 1;
    const generatedStrategies = this.generateStrategiesForElement(data);

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
      capturedAt: new Date().toISOString()
    };

    // Show floating preview in live browser
    await this.updateBrowserFloatingPreview(data, generatedStrategies);

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
    if (el.role || ['button', 'a', 'input'].includes(tag)) {
      const roleName = el.role || (tag === 'button' ? 'button' : tag === 'a' ? 'link' : 'textbox');
      const text = el.ariaLabel || el.textContent;
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

    // 7. Visible Text
    if (el.textContent && el.textContent.length <= 50) {
      list.push({ type: 'Text', value: el.textContent.trim() });
    }

    // 8. Clean CSS Selector
    if (el.className) {
      const cleanClasses = el.className.split(/\s+/).filter(c => !c.includes(':') && !c.includes('[')).slice(0, 2).join('.');
      if (cleanClasses) {
        list.push({ type: 'CSS Selector', value: `${tag}.${cleanClasses}` });
      }
    } else if (el.name) {
      list.push({ type: 'CSS Selector', value: `${tag}[name="${el.name}"]` });
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
    } else {
      list.push({ type: 'XPath', value: `//${tag}` });
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
        valueType: item.valueType || (/\{[^}]+\}/.test(item.value) ? 'Dynamic' : 'Static'),
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

  private async updateBrowserFloatingPreview(el: InspectedElementPayload, strategies: FinderStrategy[]) {
    if (!this.page || this.page.isClosed()) return;
    try {
      await this.page.evaluate(({ element, topLocators }: { element: any; topLocators: any[] }) => {
        if ((window as any).__ea_showFloatingPreview) {
          (window as any).__ea_showFloatingPreview(element, topLocators);
        }
      }, {
        element: {
          tagName: el.tagName,
          textContent: el.textContent,
          accessibleName: el.ariaLabel || el.name || el.textContent,
          id: el.id
        },
        topLocators: strategies.slice(0, 4).map(s => ({
          type: s.type,
          value: s.value,
          score: s.stabilityScore,
          stability: s.stability
        }))
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

        // 2. Floating Inspector Card (Live Locator Preview inside browser)
        const previewCard = document.createElement('div');
        previewCard.id = '__ea_locator_preview';
        previewCard.style.position = 'fixed';
        previewCard.style.bottom = '20px';
        previewCard.style.right = '20px';
        previewCard.style.zIndex = '2147483645';
        previewCard.style.width = '340px';
        previewCard.style.maxHeight = '480px';
        previewCard.style.background = 'rgba(15, 23, 42, 0.98)';
        previewCard.style.backdropFilter = 'blur(12px)';
        previewCard.style.border = '1px solid rgba(56, 189, 248, 0.35)';
        previewCard.style.borderRadius = '16px';
        previewCard.style.boxShadow = '0 20px 45px rgba(0, 0, 0, 0.85)';
        previewCard.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        previewCard.style.color = '#f8fafc';
        previewCard.style.display = 'none';
        previewCard.style.flexDirection = 'column';
        previewCard.style.overflow = 'hidden';
        previewCard.style.userSelect = 'none';
        document.body.appendChild(previewCard);

        let isMinimized = false;

        window.__ea_showFloatingPreview = (element, topLocators) => {
          previewCard.style.display = 'flex';
          isMinimized = false;
          previewCard.innerHTML = \`
            <div id="__ea_preview_drag_header" style="padding:10px 14px;background:#0f172a;border-bottom:1px solid #1e293b;cursor:move;display:flex;align-items:center;justify-between;gap:8px;">
              <div style="display:flex;align-items:center;gap:6px;min-width:0;flex:1;">
                <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#10b981;"></span>
                <span style="font-size:11px;font-weight:700;color:#38bdf8;text-transform:uppercase;letter-spacing:0.5px;">Captured</span>
                <span style="font-size:11px;font-weight:600;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">&lt;\${element.tagName}&gt; "\${(element.textContent || element.accessibleName || element.id || '').slice(0, 18)}"</span>
              </div>
              <div style="display:flex;align-items:center;gap:4px;">
                <button id="__ea_btn_min" style="background:transparent;border:none;color:#94a3b8;font-size:13px;cursor:pointer;padding:2px 6px;border-radius:4px;">_</button>
                <button id="__ea_btn_close" style="background:transparent;border:none;color:#94a3b8;font-size:13px;cursor:pointer;padding:2px 6px;border-radius:4px;">✕</button>
              </div>
            </div>
            <div id="__ea_preview_body" style="padding:12px;display:flex;flex-direction:column;gap:10px;overflow-y:auto;max-height:360px;">
              <div style="display:flex;align-items:center;justify-content:space-between;font-size:11px;color:#94a3b8;">
                <span>Top Locator Recommendations (\${topLocators.length})</span>
                <span style="color:#10b981;font-weight:600;">Active in Finder</span>
              </div>
              <div style="display:flex;flex-direction:column;gap:8px;">
                \${topLocators.map((l, i) => \`
                  <div style="background:#090d16;border:1px solid #1e293b;border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:4px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;">
                      <span style="font-size:10px;font-weight:700;background:rgba(56,189,248,0.15);color:#38bdf8;padding:2px 6px;border-radius:4px;">\${l.type}</span>
                      <span style="font-size:10px;color:\${l.stability === 'High' ? '#10b981' : l.stability === 'Moderate' ? '#f59e0b' : '#f43f5e'};font-weight:600;">\${l.stability} (\${l.score})</span>
                    </div>
                    <div style="font-family:monospace;font-size:11px;color:#cbd5e1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:2px 0;">\${l.value}</div>
                    <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;margin-top:2px;">
                      <button data-ea-copy="\${l.value}" style="font-size:10px;padding:3px 8px;background:#1e293b;border:1px solid #334155;color:#e2e8f0;border-radius:4px;cursor:pointer;">Copy</button>
                      <button data-ea-test-type="\${l.type}" data-ea-test-val="\${l.value}" style="font-size:10px;padding:3px 8px;background:rgba(16,185,129,0.2);border:1px solid rgba(16,185,129,0.4);color:#34d399;border-radius:4px;cursor:pointer;">Test</button>
                    </div>
                  </div>
                \`).join('')}
              </div>
              <div style="text-align:center;padding-top:4px;">
                <span style="font-size:10px;color:#64748b;">Click another element in page to capture next</span>
              </div>
            </div>
          \`;

          // Attach listeners to preview elements
          const btnClose = document.getElementById('__ea_btn_close');
          if (btnClose) {
            btnClose.onclick = (e) => {
              e.stopPropagation();
              previewCard.style.display = 'none';
            };
          }

          const btnMin = document.getElementById('__ea_btn_min');
          const body = document.getElementById('__ea_preview_body');
          if (btnMin && body) {
            btnMin.onclick = (e) => {
              e.stopPropagation();
              isMinimized = !isMinimized;
              body.style.display = isMinimized ? 'none' : 'flex';
              btnMin.innerText = isMinimized ? '□' : '_';
            };
          }

          // Copy buttons in preview
          previewCard.querySelectorAll('[data-ea-copy]').forEach(btn => {
            btn.onclick = (e) => {
              e.stopPropagation();
              const val = btn.getAttribute('data-ea-copy');
              if (window.__ea_onCopyLocator) {
                window.__ea_onCopyLocator(val);
                btn.innerText = '✓ Copied';
                setTimeout(() => { btn.innerText = 'Copy'; }, 1500);
              }
            };
          });

          // Test buttons in preview
          previewCard.querySelectorAll('[data-ea-test-type]').forEach(btn => {
            btn.onclick = async (e) => {
              e.stopPropagation();
              const type = btn.getAttribute('data-ea-test-type');
              const val = btn.getAttribute('data-ea-test-val');
              btn.innerText = 'Testing...';
              if (window.__ea_onTestLocatorFromPage) {
                const res = await window.__ea_onTestLocatorFromPage(type, val);
                btn.innerText = res && res.matchCount === 1 ? '✓ 1 Match' : (res ? '⚠️ ' + res.matchCount + ' Matches' : 'Failed');
                setTimeout(() => { btn.innerText = 'Test'; }, 2000);
              }
            };
          });

          // Dragging header logic
          const header = document.getElementById('__ea_preview_drag_header');
          if (header) {
            let isDragging = false, startX, startY, initLeft, initTop;
            header.onmousedown = (e) => {
              isDragging = true;
              startX = e.clientX;
              startY = e.clientY;
              const rect = previewCard.getBoundingClientRect();
              previewCard.style.bottom = 'auto';
              previewCard.style.right = 'auto';
              previewCard.style.left = rect.left + 'px';
              previewCard.style.top = rect.top + 'px';
              initLeft = rect.left;
              initTop = rect.top;
            };
            window.addEventListener('mousemove', (e) => {
              if (!isDragging) return;
              previewCard.style.left = (initLeft + e.clientX - startX) + 'px';
              previewCard.style.top = (initTop + e.clientY - startY) + 'px';
            });
            window.addEventListener('mouseup', () => { isDragging = false; });
          }
        };

        // Prevent preview clicks from triggering capture
        previewCard.addEventListener('click', (e) => {
          e.stopPropagation();
        }, true);
        previewCard.addEventListener('mouseover', (e) => {
          e.stopPropagation();
        }, true);

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
    `).catch(() => {});
  }
}

export const finderSession = new FinderSessionManager();

