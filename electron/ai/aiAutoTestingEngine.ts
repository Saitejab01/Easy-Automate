import { BrowserWindow } from 'electron';
import * as crypto from 'crypto';
import {
  AIDocument,
  AIManualTestCase,
  AIManualTestCaseStep,
  AIAutomationSession,
  AIAutomationStepDetail,
  RepositoryPage,
  RepositoryElement,
  Locator,
  ElementType,
  JsonDatabase
} from '../database';
import { AIModelService } from './aiModelService';
import { NLPMapper, MappedNLPStep } from './nlpMapper';
import { AutomationEngine } from '../engine/automationEngine';
import { HybridElementIdentificationService, ElementIdentificationTarget } from './hybridElementIdentificationService';

export class AIAutoTestingEngine {
  private db: JsonDatabase;
  private modelService: AIModelService;
  private hybridService: HybridElementIdentificationService;
  private mainWindow: BrowserWindow | null = null;

  // Active Playwright instances during development
  private activeBrowser: any = null;
  private activeContext: any = null;
  private activePage: any = null;
  private activeSessionId: string | null = null;
  private isPaused: boolean = false;
  private isStopped: boolean = false;

  constructor(db: JsonDatabase, modelService: AIModelService) {
    this.db = db;
    this.modelService = modelService;
    this.hybridService = new HybridElementIdentificationService(db, modelService);
  }

  public setMainWindow(win: BrowserWindow | null) {
    this.mainWindow = win;
    this.hybridService.setMainWindow(win);
  }

  public getHybridService(): HybridElementIdentificationService {
    return this.hybridService;
  }

  /**
   * Broadcasts live progress/telemetry events to React frontend
   */
  private emitEvent(channel: string, payload: any) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, payload);
    }
  }

  // =========================================================================
  // WORKFLOW A & B: Test Case Extraction & Generation
  // =========================================================================

  /**
   * Workflow A: Extracts structured manual test cases directly from text/csv
   */
  public async extractManualTestCasesFromDoc(
    document: AIDocument,
    projectId: string
  ): Promise<AIManualTestCase> {
    const content = document.extractedContent;
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);

    const steps: AIManualTestCaseStep[] = [];
    let stepCount = 1;

    // Pattern 1: CSV format (from spreadsheets or tables)
    for (const line of lines) {
      if (line.startsWith('---') || line.toLowerCase().includes('step no') || line.toLowerCase().includes('step description')) {
        continue;
      }

      // Check CSV or tab separated
      const parts = line.includes('\t') ? line.split('\t') : line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      if (parts.length >= 2) {
        const desc = parts[1]?.replace(/^"|"$/g, '').trim() || parts[0]?.replace(/^"|"$/g, '').trim();
        const input = parts[2]?.replace(/^"|"$/g, '').trim() || '';
        const expected = parts[3]?.replace(/^"|"$/g, '').trim() || parts[parts.length - 1]?.replace(/^"|"$/g, '').trim() || 'Step completed successfully';

        if (desc && desc.length > 3 && !desc.toLowerCase().startsWith('step')) {
          steps.push({
            stepNumber: stepCount++,
            stepDescription: desc,
            input: input === 'N/A' || input === '-' ? '' : input,
            expectedResult: expected
          });
        }
      }
    }

    // Pattern 2: Numbered list format (e.g. 1. Click login, 2. Enter email)
    if (steps.length === 0) {
      for (const line of lines) {
        const match = line.match(/^(\d+)[\.\)]\s*(.+)/);
        if (match) {
          const fullText = match[2];
          // Look for "Input:" or "Expected:" inside the line
          let desc = fullText;
          let input = '';
          let expected = 'Action performed successfully';

          if (fullText.includes('|')) {
            const pipes = fullText.split('|').map(p => p.trim());
            desc = pipes[0] || fullText;
            input = pipes[1] || '';
            expected = pipes[2] || expected;
          }

          steps.push({
            stepNumber: stepCount++,
            stepDescription: desc,
            input,
            expectedResult: expected
          });
        }
      }
    }

    // Pattern 3: Fallback semantic split into logical action lines
    if (steps.length === 0) {
      const actionLines = lines.filter(l =>
        /^(open|navigate|enter|type|click|select|verify|assert|wait|scroll|check)\b/i.test(l)
      );
      actionLines.forEach(al => {
        steps.push({
          stepNumber: stepCount++,
          stepDescription: al,
          input: '',
          expectedResult: 'Verify step completed successfully'
        });
      });
    }

    const tcName = document.fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ') + ' - Automated Flow';

    return this.db.saveAITestCase({
      projectId,
      documentId: document.id,
      name: tcName,
      description: `Extracted automatically from document "${document.fileName}"`,
      status: 'accepted', // In Workflow A, manual test cases are automatically approved to start dev
      steps
    });
  }

  /**
   * Workflow B: Uses local SLM to understand BRD + User Prompt and generate 4-column manual test cases
   */
  public async generateTestCasesFromBRD(
    document: AIDocument,
    userPrompt: string,
    projectId: string
  ): Promise<AIManualTestCase> {
    const defaultModel = this.db.getDefaultAIModelConfiguration();
    if (!defaultModel) {
      throw new Error('No AI Model configured. Please configure an SLM endpoint in AI Model Configuration first.');
    }

    // Truncate document content to relevant excerpt to optimize tokens (Section 13.3)
    const excerpt = document.extractedContent.slice(0, 4000);

    const systemPrompt = `You are a Senior Test Automation Architect.
Analyze the following Business Requirement Document (BRD) and the user's specific automation request.
Generate manual test cases in a strict JSON array.
Each test step MUST contain EXACTLY these four fields:
1. "stepNumber": integer starting from 1
2. "stepDescription": clear actionable instruction (e.g. "Navigate to application URL", "Enter username", "Click Login button")
3. "input": explicit test data or value needed (e.g. "https://example.com", "testuser@example.com", or "" if not applicable)
4. "expectedResult": clear verification criteria (e.g. "Login page is displayed", "User is logged in successfully")

Return ONLY valid JSON matching this schema:
{
  "testCaseName": "string",
  "description": "string",
  "steps": [
    {
      "stepNumber": 1,
      "stepDescription": "string",
      "input": "string",
      "expectedResult": "string"
    }
  ]
}`;

    const userMessage = `DOCUMENT NAME: ${document.fileName}
DOCUMENT CONTENT EXCERPT:
${excerpt}

USER AUTOMATION REQUEST:
${userPrompt}

Generate the complete step-by-step test case now in the exact 4-column format.`;

    const response = await this.modelService.chatCompletion(defaultModel, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ], { jsonMode: true, temperature: 0.1 });

    const parsed = response.parsedJson;
    if (!parsed || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
      throw new Error('The configured SLM did not return a valid list of test steps. Please check your prompt or model status.');
    }

    const normalizedSteps: AIManualTestCaseStep[] = parsed.steps.map((s: any, idx: number) => ({
      stepNumber: idx + 1,
      stepDescription: s.stepDescription || s.description || `Step ${idx + 1}`,
      input: s.input || '',
      expectedResult: s.expectedResult || s.expected || 'Step completed successfully'
    }));

    return this.db.saveAITestCase({
      projectId,
      documentId: document.id,
      name: parsed.testCaseName || `${document.fileName} - ${userPrompt.slice(0, 30)}`,
      description: parsed.description || userPrompt,
      userPrompt,
      status: 'draft', // Workflow B waits for user review & approval
      steps: normalizedSteps
    });
  }

  // =========================================================================
  // BROWSER INITIALIZATION & AI AUTOMATION DEVELOPMENT ENGINE
  // =========================================================================

  /**
   * Section 7 & 10: Starts live Playwright browser development session
   */
  public async startDevelopmentSession(
    testCaseId: string,
    projectId: string,
    customUrl?: string
  ): Promise<AIAutomationSession> {
    const testCase = this.db.getAITestCaseById(testCaseId, projectId);
    if (!testCase) {
      throw new Error('Test case not found');
    }

    const project = this.db.getProjectById(projectId, '');
    const targetUrl = customUrl || project?.baseUrl || this.findUrlInSteps(testCase.steps) || 'https://demo.easyautomate.dev';

    // 1. Create or get existing "AI Elements" page in Repository (Section 9)
    const aiElementsPage = this.ensureAIElementsPage(projectId);

    // 2. Initialize development session record
    const session = this.db.saveAIAutomationSession({
      projectId,
      testCaseId,
      testCaseName: testCase.name,
      documentId: testCase.documentId,
      status: 'initializing_browser',
      stage: 'Browser Initialized',
      progressPercent: 5,
      currentStepIndex: 0,
      applicationUrl: targetUrl,
      browserType: project?.defaultBrowser || 'chromium',
      aiElementsPageId: aiElementsPage.id,
      steps: testCase.steps.map(s => ({
        stepNumber: s.stepNumber,
        manualStepDescription: s.stepDescription,
        manualInput: s.input,
        manualExpectedResult: s.expectedResult,
        status: 'Pending',
        logs: []
      }))
    });

    this.activeSessionId = session.id;
    this.isPaused = false;
    this.isStopped = false;

    // Run development asynchronously in background while streaming updates
    this.runDevelopmentLoop(session.id, projectId, testCase, targetUrl, aiElementsPage.id).catch(err => {
      console.error('Error in AI development loop:', err);
    });

    return session;
  }

  /**
   * Main execution loop: drives Playwright, element inspection, locator generation, execution
   */
  private async runDevelopmentLoop(
    sessionId: string,
    projectId: string,
    testCase: AIManualTestCase,
    targetUrl: string,
    aiElementsPageId: string
  ): Promise<void> {
    let session = this.db.getAIAutomationSessionById(sessionId, projectId);
    if (!session) return;

    let playwright: any = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      playwright = require('playwright');
    } catch (e: any) {
      this.failSession(session, `Playwright engine not available: ${e.message}`);
      return;
    }

    try {
      // Step 1: Launch real browser (headful so user can see it executing)
      const browserType = (session.browserType || 'chromium').toLowerCase();
      const engine = browserType === 'firefox' ? playwright.firefox : browserType === 'webkit' ? playwright.webkit : playwright.chromium;

      session.stage = 'Browser Initialized';
      this.emitEvent('aiAutoTesting:sessionUpdate', session);

      try {
        this.activeBrowser = await engine.launch({
          headless: false,
          args: ['--start-maximized', '--disable-blink-features=AutomationControlled']
        });
      } catch (launchErr: any) {
        console.warn('Headful browser launch failed, falling back to headless:', launchErr.message);
        this.activeBrowser = await engine.launch({ headless: true });
      }

      this.activeContext = await this.activeBrowser.newContext({ viewport: null });
      this.activePage = await this.activeContext.newPage();
      this.activePage.setDefaultTimeout(15000);

      // Maximize window immediately on startup
      await this.maximizeBrowserWindow(this.activePage);

      // Check if first steps already contain navigation
      const hasNavigationStep = session.steps.some(s => {
        const d = (s.manualStepDescription || '').toLowerCase();
        return d.includes('navigate') || d.includes('open url') || d.includes('go to') || /https?:\/\/|www\./i.test(d);
      });

      if (!hasNavigationStep && targetUrl) {
        session.stage = 'Application Opened';
        session.progressPercent = 15;
        this.emitEvent('aiAutoTesting:sessionUpdate', session);

        await this.activePage.goto(targetUrl, { waitUntil: 'load', timeout: 30000 }).catch(async () => {
          await this.activePage.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        });
        await this.activePage.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
        await this.activePage.waitForTimeout(2000);
      }

      // Step 3: Loop through manual test steps
      for (let i = 0; i < session.steps.length; i++) {
        if (this.isStopped) break;

        while (this.isPaused && !this.isStopped) {
          await new Promise(r => setTimeout(r, 500));
        }

        const stepDetail = session.steps[i];
        session.currentStepIndex = i;
        stepDetail.status = 'Identifying Element';
        this.emitEvent('aiAutoTesting:sessionUpdate', session);

        const startTime = Date.now();
        const { element, mappedNLP, verifiedLocator } = await this.analyzeDOMAndResolveElement(
          this.activePage,
          projectId,
          aiElementsPageId,
          stepDetail,
          targetUrl
        );

        stepDetail.nlpId = mappedNLP.nlpId;
        stepDetail.nlpName = mappedNLP.nlpName;
        stepDetail.inputParameters = mappedNLP.inputParameters;

        if (element) {
          stepDetail.elementId = element.id;
          stepDetail.elementName = element.name;
          stepDetail.locatorType = verifiedLocator?.type || element.locators[0]?.type;
          stepDetail.locatorValue = verifiedLocator?.value || element.locators[0]?.value;
          (stepDetail as any).candidateLocators = element.locators;
          stepDetail.logs?.push(
            `[${new Date().toLocaleTimeString()}] Runtime AI identified "${element.name}" [${stepDetail.locatorType}: ${stepDetail.locatorValue}]`
          );
        }

        // Execute step using Playwright
        stepDetail.status = 'Executing';
        this.emitEvent('aiAutoTesting:sessionUpdate', session);

        try {
          await this.executeLiveStep(this.activePage, mappedNLP, stepDetail, projectId);
          stepDetail.status = 'Passed';
          stepDetail.durationMs = Date.now() - startTime;
          stepDetail.logs?.push(`[${new Date().toLocaleTimeString()}] Step #${i + 1} passed successfully.`);
        } catch (err: any) {
          stepDetail.status = 'Failed';
          stepDetail.error = err.message;
          stepDetail.durationMs = Date.now() - startTime;
          stepDetail.logs?.push(`[${new Date().toLocaleTimeString()}] Step failed: ${err.message}`);

          // Capture failure screenshot
          try {
            const buf = await this.activePage.screenshot();
            stepDetail.screenshot = `data:image/png;base64,${buf.toString('base64')}`;
          } catch {}

          session.status = 'failed';
          session.failureDetails = {
            stepNumber: stepDetail.stepNumber,
            error: err.message,
            screenshot: stepDetail.screenshot
          };
          this.db.saveAIAutomationSession(session);
          this.emitEvent('aiAutoTesting:sessionUpdate', session);
          return; // Stop on failure (Section 10.1)
        }

        session.progressPercent = Math.min(95, Math.round(((i + 1) / session.steps.length) * 80) + 15);
        this.db.saveAIAutomationSession(session);
        this.emitEvent('aiAutoTesting:sessionUpdate', session);
      }

      // Completed all steps
      session.status = 'completed';
      session.stage = 'Script Ready for Review';
      session.progressPercent = 100;
      this.db.saveAIAutomationSession(session);
      this.emitEvent('aiAutoTesting:sessionUpdate', session);
    } catch (globalErr: any) {
      this.failSession(session, globalErr.message);
    }
  }

  /**
   * Section 7 & 10: Real-time Runtime AI DOM Analysis & Element Discovery
   * The local SLM analyzes live DOM elements extracted from the open browser in runtime
   * to discover elements, generate locators, and map actions.
   */
  private async analyzeDOMAndResolveElement(
    page: any,
    projectId: string,
    aiElementsPageId: string,
    stepDetail: AIAutomationStepDetail,
    targetUrl: string
  ): Promise<{
    element?: RepositoryElement;
    mappedNLP: MappedNLPStep;
    verifiedLocator?: { type: Locator['type']; value: string };
  }> {
    const desc = (stepDetail.manualStepDescription || '').toLowerCase();
    const inputVal = (stepDetail.manualInput || '').trim();

    // 1. Check if the step is purely browser-level (no DOM element needed)
    if (
      desc.includes('open browser') ||
      desc.includes('launch browser') ||
      desc.includes('maximize browser') ||
      desc.includes('maximize window') ||
      desc.includes('maximize the browser') ||
      desc.includes('navigate to') ||
      desc.includes('open url') ||
      desc.includes('go to url') ||
      desc.includes('static wait') ||
      desc.includes('wait for 5')
    ) {
      const mappedNLP = NLPMapper.mapStepToNLP(
        {
          stepNumber: stepDetail.stepNumber,
          stepDescription: stepDetail.manualStepDescription,
          input: stepDetail.manualInput,
          expectedResult: stepDetail.manualExpectedResult
        },
        targetUrl
      );
      return { mappedNLP };
    }

    // 2. Pre-compute tentative NLP intent upfront to guide DOM filtering and validation
    const tentativeNLP = NLPMapper.mapStepToNLP(
      {
        stepNumber: stepDetail.stepNumber,
        stepDescription: stepDetail.manualStepDescription,
        input: stepDetail.manualInput,
        expectedResult: stepDetail.manualExpectedResult
      },
      targetUrl
    );

    // Wait up to 4s for interactive elements to mount (React SPA hydration)
    if (page && !page.isClosed()) {
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForSelector('button, a, input, [role="button"], h1, h2, h3, h4', { state: 'visible', timeout: 4000 }).catch(() => {});
    }

    // 3. Extract live interactive elements from the current page
    let domSnapshot: Array<any> = [];
    for (let attempt = 0; attempt < 5; attempt++) {
      domSnapshot = await this.extractLiveDomElements(page);
      if (domSnapshot.length > 0) break;
      await page.waitForTimeout(500);
    }

    // Rank candidate elements specifically for this action intent
    const rankedCandidates = this.rankElementsForStep(domSnapshot, stepDetail, tentativeNLP.nlpId);
    const compactCandidatesForPrompt = this.formatElementsForSLM(rankedCandidates);

    // 3.5 Hybrid AI Element Identification Pipeline (Layers 1-4)
    const cleanHint = this.cleanElementHint(stepDetail.manualStepDescription, tentativeNLP.nlpId);
    const defaultModel = this.db.getDefaultAIModelConfiguration();

    // Synthesize Playwright locators for top ranked candidates extracted from current live page
    const liveCandidateLocators: Locator[] = [];
    for (const cand of rankedCandidates.slice(0, 8)) {
      const syn = this.synthesizePlaywrightCandidateLocators(cand);
      liveCandidateLocators.push(...syn);
    }

    const idTarget: ElementIdentificationTarget = {
      stepDescription: stepDetail.manualStepDescription,
      elementName: cleanHint,
      actionIntent: tentativeNLP.nlpId,
      configuredLocators: liveCandidateLocators,
      projectId,
      pageId: aiElementsPageId,
      manualInput: stepDetail.manualInput,
      manualExpectedResult: stepDetail.manualExpectedResult
    };

    const hybridResult = await this.hybridService.identifyAndVerifyElement(
      page,
      idTarget,
      defaultModel
    );
    stepDetail.identificationTelemetry = hybridResult.telemetry;

    // 4. Ask configured Local SLM to analyze DOM only if deterministic/hybrid analysis needs SLM guidance
    let slmResult: any = null;

    if (hybridResult.status !== 'IDENTIFIED' && hybridResult.status !== 'VISUAL_VERIFIED' && defaultModel && rankedCandidates.length > 0) {
      try {
        const pageTitle = await page.title().catch(() => '');
        const currentUrl = page.url ? page.url() : targetUrl;

        const systemPrompt = `You are an expert Web Test Automation Engineer analyzing live web page DOM in real-time.
Given the current manual test step and the list of visible interactive DOM candidates on the live page:
1. Identify which candidate corresponds to the intended manual test step action.
2. Provide a descriptive element name and type (Button, Input Field, Link, Dropdown / Select, Checkbox, Text / Label).
3. Generate accurate, Playwright-reliable locators (Role e.g. getByRole('button', { name: 'Login' }), Test ID, Label, Placeholder, ID, Name, Text, CSS Selector, XPath) using exact attributes from the candidate.
4. Map the action to one of our catalog NLPs: 'click_element', 'enter_text', 'clear_text', 'select_dropdown_option', 'select_checkbox', 'unselect_checkbox', 'hover_element', 'verify_element_displayed', 'verify_text'.
5. When the step is a verification step (e.g. 'Verify Shopper Login Text', 'Verify heading', 'Check message'):
   - For 'verify_text', provide "inputParameters": { "expectedText": "core text to verify, e.g. 'Shopper Login'" } without boilerplate words like 'verify' or 'should be displayed'.
   - For 'verify_element_displayed', provide "inputParameters": {}.

CRITICAL ELEMENT RULES:
- Action Intent Consistency:
  * For typing/entering text ('enter_text'): You MUST select an <input> or <textarea> element. NEVER select a button, div, or span.
  * For clicking ('click_element'): Select the requested element. If clicking an input field (e.g. search bar, text box, email input), select the <input> element. If clicking a button or link, select the <button> or <a>. Do NOT select an input field when the step asks for a button (e.g. do not select an email input when asked for Login button).
  * For text verification ('verify_text'): Select the heading or text element containing the expected text.
- Compound Concept Priority: When the user asks for multi-word concepts (e.g. 'Account Setting', 'Order History', 'Forgot Password'), match elements that satisfy ALL words or the exact compound concept.
- Contradictory Elements: Do NOT pick elements that only share one generic word but have opposite purposes:
  * 'Account Setting' / 'Account Settings' is user profile & settings. Do NOT pick 'Create Account' (which is registration/signup).
  * 'Search Button' is submitting a search. Do NOT pick 'Clear Search'.
  * 'Login' is signing in. Do NOT pick 'Sign Up' or 'Register'.
- Icon & Header Buttons: Many header buttons (Profile, Account Settings, Cart) have NO visible text and store their purpose in 'aria-label', 'title', or 'role'. Always check 'aria-label' and 'title' attributes!

FEW-SHOT EXAMPLES:
Example 1 (Input Field):
Step: "Enter email to Email Text"
Candidates:
[Candidate 1] <input id="Email" name="Email" type="email" placeholder="Email" />
[Candidate 2] <button id="Login" type="submit">LOGIN</button>
Decision: Select Candidate 1 (<input id="Email">).
Map to nlpId: "enter_text".

Example 2 (Disambiguation):
Step: "Verify Account Setting Button"
Candidates:
[Candidate 1] <button>Create Account</button>
[Candidate 2] <button aria-label="Account settings" role="button"></button>
Decision: Match Candidate 2 (aria-label: "Account settings"), NOT "Create Account".
Map to nlpId: "verify_element_displayed".

Example 3 (Verification):
Step: "Verify Shopper Login Text"
Expected: "Shopper Login should be displayed"
Candidates:
[Candidate 1] <h3>SHOPPER LOGIN</h3>
Decision: Match Candidate 1.
Map to nlpId: "verify_text", expectedText: "Shopper Login".

6. Return ONLY a valid JSON object matching this schema:
{
  "selectedCandidateNumber": 1,
  "matchedElement": {
    "name": "Human-readable element name",
    "type": "Button | Input Field | Link | Dropdown / Select | Checkbox | Text / Label",
    "locators": [
      { "type": "Role", "value": "getByRole('button', { name: 'Login' })", "isPrimary": true, "priority": 1 },
      { "type": "ID", "value": "loginBtn", "isPrimary": false, "priority": 2 },
      { "type": "Name", "value": "loginBtn", "isPrimary": false, "priority": 3 },
      { "type": "Text", "value": "Login", "isPrimary": false, "priority": 4 },
      { "type": "CSS Selector", "value": "button#loginBtn", "isPrimary": false, "priority": 5 },
      { "type": "XPath", "value": "//button[@id='loginBtn']", "isPrimary": false, "priority": 6 }
    ]
  },
  "mappedNLP": {
    "nlpId": "click_element | enter_text | verify_text | verify_element_displayed | ...",
    "nlpName": "Click On Element | Enter Text | Verify Text | ...",
    "inputParameters": {}
  }
}`;

        const userPrompt = `Page Title: "${pageTitle}"
Current Page URL: ${currentUrl}
Manual Test Step:
- Description: "${stepDetail.manualStepDescription}"
- Input: "${stepDetail.manualInput || ''}"
- Expected: "${stepDetail.manualExpectedResult || ''}"
- Expected Action Intent: "${tentativeNLP.nlpId}"

Live Page Candidate Elements:
${compactCandidatesForPrompt}`;

        const response = await this.modelService.chatCompletion(
          defaultModel,
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          { jsonMode: true, temperature: 0.1, maxTokens: 2048 }
        );

        slmResult = this.modelService.extractAndParseJson(response.content);
      } catch (err: any) {
        console.warn('Local SLM DOM analysis error, falling back to live DOM semantic resolver:', err.message);
      }
    }

    // 5. Validate or synthesize locators against the real page
    let finalElementName = slmResult?.matchedElement?.name || this.cleanElementHint(stepDetail.manualStepDescription, tentativeNLP.nlpId);
    if (!finalElementName || /human[- ]?readable|element[- ]?name/i.test(finalElementName)) {
      finalElementName = this.cleanElementHint(stepDetail.manualStepDescription, tentativeNLP.nlpId);
    }
    let finalElementType: ElementType = slmResult?.matchedElement?.type || (tentativeNLP.nlpId === 'enter_text' ? 'Input Field' : tentativeNLP.nlpId === 'verify_text' ? 'Text / Label' : 'Button');
    let candidateLocators: Locator[] = [];
    let verifiedLocator: { type: Locator['type']; value: string } | null = null;

    if (hybridResult && (hybridResult.status === 'IDENTIFIED' || hybridResult.status === 'VISUAL_VERIFIED') && hybridResult.locatorStrategy && hybridResult.locatorValue) {
      verifiedLocator = { type: hybridResult.locatorStrategy as Locator['type'], value: hybridResult.locatorValue };
      candidateLocators = [
        {
          id: `loc_1_${crypto.randomUUID().slice(0, 4)}`,
          type: verifiedLocator.type,
          value: verifiedLocator.value,
          valueType: 'Static',
          isPrimary: true,
          priority: 1
        }
      ];

      // Add backup locators if available from ranked candidates
      if (rankedCandidates.length > 0) {
        const synthesized = this.synthesizePlaywrightCandidateLocators(rankedCandidates[0]);
        for (const syn of synthesized) {
          if (syn.value !== verifiedLocator.value && !candidateLocators.some(c => c.value === syn.value)) {
            candidateLocators.push({
              id: `loc_${candidateLocators.length + 1}_${crypto.randomUUID().slice(0, 4)}`,
              type: syn.type,
              value: syn.value,
              valueType: 'Static',
              isPrimary: false,
              priority: candidateLocators.length + 1
            });
          }
        }
      }
    } else if (slmResult?.matchedElement?.locators && Array.isArray(slmResult.matchedElement.locators)) {
      const candIdx = (slmResult?.selectedCandidateNumber || 1) - 1;
      const matchedDomCand = rankedCandidates[candIdx] || rankedCandidates[0];
      const synthesizedLocs = matchedDomCand ? this.synthesizePlaywrightCandidateLocators(matchedDomCand) : [];

      const combined: Array<{ type: Locator['type']; value: string }> = [];
      const seenVals = new Set<string>();

      for (const loc of slmResult.matchedElement.locators) {
        if (loc.type && loc.value && !seenVals.has(loc.value.trim().toLowerCase())) {
          seenVals.add(loc.value.trim().toLowerCase());
          combined.push({ type: loc.type as Locator['type'], value: loc.value.trim() });
        }
      }
      for (const loc of synthesizedLocs) {
        if (loc.type && loc.value && !seenVals.has(loc.value.trim().toLowerCase())) {
          seenVals.add(loc.value.trim().toLowerCase());
          combined.push({ type: loc.type, value: loc.value.trim() });
        }
      }

      for (let idx = 0; idx < combined.length; idx++) {
        const candidate = combined[idx];
        if (candidate.type && candidate.value) {
          candidateLocators.push({
            id: `loc_${idx + 1}_${crypto.randomUUID().slice(0, 4)}`,
            type: candidate.type,
            value: candidate.value,
            valueType: 'Static',
            isPrimary: idx === 0,
            priority: idx + 1
          });

          // Test in Playwright live with action-intent semantic validation
          if (!verifiedLocator) {
            try {
              const pwLoc = this.resolvePlaywrightLocator(page, candidate.type, candidate.value).first();
              const count = await pwLoc.count();
              if (count > 0 && (await pwLoc.isVisible().catch(() => false))) {
                const elTag = await pwLoc.evaluate((el: HTMLElement) => el.tagName.toLowerCase()).catch(() => '');
                const elType = await pwLoc.evaluate((el: HTMLInputElement) => el.type || '').catch(() => '');
                const elText = await pwLoc.evaluate((el: HTMLElement) => (el.innerText || el.textContent || '').trim()).catch(() => '');
                const elAria = await pwLoc.evaluate((el: HTMLElement) => el.getAttribute('aria-label') || '').catch(() => '');

                let isValidForIntent = true;
                if (tentativeNLP.nlpId === 'enter_text' || tentativeNLP.nlpId === 'clear_text') {
                  if (elTag !== 'input' && elTag !== 'textarea') {
                    const innerInput = pwLoc.locator('input, textarea').first();
                    if ((await innerInput.count().catch(() => 0)) === 0) {
                      isValidForIntent = false; // Reject non-input for typing
                    }
                  }
                } else if (tentativeNLP.nlpId === 'click_element') {
                  if (elTag === 'input' && !['button', 'submit', 'image', 'reset'].includes(elType)) {
                    isValidForIntent = false; // Reject text input for clicking
                  }
                }

                if (desc.includes('setting') && (elText.toLowerCase().includes('create account') || elAria.toLowerCase().includes('create account'))) {
                  isValidForIntent = false;
                }

                if (isValidForIntent) {
                  verifiedLocator = { type: candidate.type, value: candidate.value };
                }
              }
            } catch {}
          }
        }
      }
    }

    // 6. If AI didn't find a working verified locator, perform live intent-aware DOM resolution
    if (!verifiedLocator) {
      const liveResolved = await this.resolveElementFromLiveDom(
        page,
        domSnapshot,
        stepDetail.manualStepDescription,
        tentativeNLP.nlpId,
        tentativeNLP.inputParameters,
        stepDetail.manualInput
      );
      if (liveResolved) {
        verifiedLocator = { type: liveResolved.primaryLocator.type, value: liveResolved.primaryLocator.value };
        finalElementName = liveResolved.name || finalElementName;
        finalElementType = liveResolved.type;
        candidateLocators = liveResolved.locators;
      } else {
        // Last resort fallback
        const cleanHint = this.cleanElementHint(stepDetail.manualStepDescription, tentativeNLP.nlpId);
        const tag = tentativeNLP.nlpId === 'enter_text' ? 'input' : tentativeNLP.nlpId === 'verify_text' ? 'h3' : 'button';
        candidateLocators = this.synthesizePlaywrightCandidateLocators({
          tag,
          text: cleanHint,
          ariaLabel: cleanHint,
          name: cleanHint.toLowerCase().replace(/\s+/g, '')
        });
        verifiedLocator = { type: candidateLocators[0].type, value: candidateLocators[0].value };
      }
    }

    // Ensure at least one primary locator is set
    candidateLocators.forEach((loc, idx) => {
      loc.isPrimary = verifiedLocator ? loc.value === verifiedLocator.value && loc.type === verifiedLocator.type : idx === 0;
    });

    // 7. Save or update element in the Repository "AI Elements" page
    const existingElements = this.db.getRepositoryElements(projectId, aiElementsPageId);
    let element = existingElements.find(
      e => e.name.toLowerCase() === finalElementName.toLowerCase()
    );

    if (element) {
      element.locators = candidateLocators;
      element = this.db.updateRepositoryElement(element.id, projectId, element);
      this.emitEvent('repository:elementChanged', { action: 'updated', element, projectId });
    } else {
      element = this.db.createRepositoryElement(projectId, aiElementsPageId, {
        name: finalElementName,
        type: finalElementType,
        elementMode: 'Static',
        description: `Discovered in runtime by AI Auto Testing for step "${stepDetail.manualStepDescription}"`,
        locators: candidateLocators
      });
      this.emitEvent('repository:elementChanged', { action: 'created', element, projectId });
    }

    // 8. Resolve NLP with consistency checks
    let mappedNLP: MappedNLPStep;
    if (slmResult?.mappedNLP?.nlpId) {
      const slmNlp = slmResult.mappedNLP.nlpId;
      const isConsistent =
        (tentativeNLP.nlpId === 'enter_text' && (slmNlp === 'enter_text' || slmNlp === 'clear_text')) ||
        (tentativeNLP.nlpId === 'click_element' && (slmNlp === 'click_element' || slmNlp === 'double_click_element')) ||
        (tentativeNLP.nlpId === 'verify_text' && (slmNlp === 'verify_text' || slmNlp === 'verify_element_displayed')) ||
        (tentativeNLP.nlpId === 'verify_element_displayed' && (slmNlp === 'verify_element_displayed' || slmNlp === 'verify_text')) ||
        (!['enter_text', 'click_element', 'verify_text', 'verify_element_displayed'].includes(tentativeNLP.nlpId));

      const chosenNlpId = isConsistent ? slmNlp : tentativeNLP.nlpId;
      mappedNLP = {
        nlpId: chosenNlpId,
        nlpName: slmResult.mappedNLP.nlpName || chosenNlpId.replace(/_/g, ' '),
        requiresElement: true,
        inputParameters: slmResult.mappedNLP.inputParameters || tentativeNLP.inputParameters || (inputVal ? { text: inputVal } : {}),
        confidence: slmResult.confidence || 0.95
      };
    } else {
      mappedNLP = tentativeNLP;
    }

    // Ensure parameters for enter_text and verify_text are present
    if (mappedNLP.nlpId === 'enter_text') {
      if (!mappedNLP.inputParameters?.text && inputVal) {
        mappedNLP.inputParameters = { ...(mappedNLP.inputParameters || {}), text: inputVal };
      }
    } else if (mappedNLP.nlpId === 'verify_text') {
      const extracted = NLPMapper.extractExpectedVerificationText({
        stepDescription: stepDetail.manualStepDescription,
        input: stepDetail.manualInput,
        expectedResult: stepDetail.manualExpectedResult
      });
      if (extracted) {
        mappedNLP.inputParameters.expectedText = extracted;
      }
    }

    return {
      element,
      mappedNLP,
      verifiedLocator: verifiedLocator || { type: candidateLocators[0].type, value: candidateLocators[0].value }
    };
  }

  /**
   * Ranks live DOM elements based on action intent, description keywords, and accessibility attributes.
   * Returns the top candidate elements for the SLM to analyze.
   */
  private rankElementsForStep(
    elements: Array<any>,
    stepDetail: AIAutomationStepDetail,
    tentativeIntent: string
  ): Array<any> {
    const desc = (stepDetail.manualStepDescription || '').toLowerCase();
    const inputVal = (stepDetail.manualInput || '').toLowerCase();
    const exp = (stepDetail.manualExpectedResult || '').toLowerCase();
    const fullContext = `${desc} ${exp} ${inputVal}`;

    const stopWords = new Set([
      'click', 'on', 'the', 'button', 'in', 'field', 'enter', 'input', 'select', 'verify',
      'to', 'is', 'should', 'be', 'displayed', 'text', 'please', 'for', 'with', 'into',
      'and', 'from', 'a', 'an', 'at', 'box', 'dropdown', 'checkbox', 'link', 'check', 'validate', 'assert'
    ]);

    const tokens = Array.from(new Set(
      desc
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => !stopWords.has(w) && w.length > 1)
    ));
    const fullPhrase = tokens.join(' ').trim();

    const scored = elements.map(el => {
      let score = 0;
      const tag = (el.tag || '').toLowerCase();
      const type = (el.type || '').toLowerCase();
      const id = (el.id || '').toLowerCase();
      const name = (el.name || '').toLowerCase();
      const placeholder = (el.placeholder || '').toLowerCase();
      const ariaLabel = (el.ariaLabel || '').toLowerCase();
      const title = (el.title || '').toLowerCase();
      const testId = (el.testId || '').toLowerCase();
      const text = (el.text || '').toLowerCase();
      const role = (el.role || '').toLowerCase();

      const combinedAttrs = `${id} ${name} ${placeholder} ${ariaLabel} ${title} ${testId} ${text}`;

      // 1. Tag & Action Intent Relevance
      if (tentativeIntent === 'enter_text' || tentativeIntent === 'clear_text') {
        if (tag === 'input' || tag === 'textarea') {
          score += 70;
          if (tokens.includes('email') || inputVal.includes('@')) {
            if (type === 'email' || id.includes('email') || name.includes('email') || placeholder.includes('email')) {
              score += 50;
            }
          }
          if (tokens.includes('password') || desc.includes('password')) {
            if (type === 'password' || id.includes('password') || name.includes('password') || placeholder.includes('password')) {
              score += 50;
            }
          }
        } else {
          score -= 60; // Heavily penalize non-inputs when entering text
        }
      } else if (
        tentativeIntent === 'click_element' ||
        tentativeIntent === 'double_click_element' ||
        tentativeIntent === 'right_click_element'
      ) {
        const isSearchOrInputIntent =
          desc.includes('search') ||
          desc.includes('bar') ||
          desc.includes('input') ||
          desc.includes('field') ||
          desc.includes('box') ||
          desc.includes('textbox');

        if (tag === 'button' || role === 'button' || tag === 'a' || (tag === 'input' && ['submit', 'button'].includes(type))) {
          score += isSearchOrInputIntent ? 40 : 60;
        } else if (tag === 'input' && ['text', 'search', 'email', 'password'].includes(type)) {
          if (isSearchOrInputIntent) {
            score += 70; // Prioritize input/search field when step asks for it
          } else {
            score -= 50; // Penalize text inputs when clicking an ordinary button/link
          }
        }
      } else if (tentativeIntent === 'verify_text') {
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'label'].includes(tag) || role === 'heading') {
          score += 50;
        }
      } else if (tentativeIntent === 'verify_element_displayed') {
        if (ariaLabel || title || tag === 'button' || role === 'button') {
          score += 40;
        }
      }

      // 2. Exact compound phrase match (e.g. "account setting", "shopper login")
      if (fullPhrase && combinedAttrs.includes(fullPhrase)) {
        score += 80;
      }

      // 3. Token matches
      let matchedTokens = 0;
      for (const t of tokens) {
        if (combinedAttrs.includes(t)) {
          matchedTokens++;
          if (ariaLabel.includes(t)) score += 30;
          if (title.includes(t)) score += 30;
          if (id.includes(t)) score += 30;
          if (name.includes(t)) score += 25;
          if (placeholder.includes(t)) score += 25;
          if (text.includes(t)) score += 20;
          if (testId.includes(t)) score += 20;
        }
      }
      if (tokens.length > 1 && matchedTokens === tokens.length) {
        score += 40; // All tokens matched bonus
      }

      // 4. Disambiguation & Contradiction Filters
      if (fullContext.includes('setting')) {
        if (combinedAttrs.includes('create account') || combinedAttrs.includes('signup') || combinedAttrs.includes('register')) {
          score -= 150;
        }
      }
      if (tokens.includes('login')) {
        if (combinedAttrs.includes('create account') || combinedAttrs.includes('signup') || combinedAttrs.includes('register')) {
          score -= 80;
        }
      }
      if (tokens.includes('email') && (id.includes('password') || name.includes('password'))) {
        score -= 70;
      }
      if (tokens.includes('password') && (id.includes('email') || name.includes('email'))) {
        score -= 70;
      }

      return { el, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 20).map(s => s.el);
  }

  /**
   * Formats top candidate elements into clean, compact pseudo-HTML for the local SLM
   */
  private formatElementsForSLM(elements: Array<any>): string {
    if (!elements || elements.length === 0) return 'No visible interactive elements found on the page.';
    return elements
      .map((el, idx) => {
        const parts: string[] = [];
        if (el.id) parts.push(`id="${el.id}"`);
        if (el.name) parts.push(`name="${el.name}"`);
        if (el.type) parts.push(`type="${el.type}"`);
        if (el.role) parts.push(`role="${el.role}"`);
        if (el.placeholder) parts.push(`placeholder="${el.placeholder}"`);
        if (el.ariaLabel) parts.push(`aria-label="${el.ariaLabel}"`);
        if (el.title) parts.push(`title="${el.title}"`);
        if (el.testId) parts.push(`data-testid="${el.testId}"`);
        const attrStr = parts.length > 0 ? ' ' + parts.join(' ') : '';
        const textVal = el.text ? el.text.slice(0, 60) : '';

        if (['input', 'img', 'br', 'hr'].includes(el.tag)) {
          return `[Candidate ${idx + 1}] <${el.tag}${attrStr} />`;
        }
        return `[Candidate ${idx + 1}] <${el.tag}${attrStr}>${textVal}</${el.tag}>`;
      })
      .join('\n');
  }

  private async resolveElementFromLiveDom(
    page: any,
    domElements: Array<any>,
    description: string,
    intent?: string,
    inputParams?: Record<string, any>,
    rawInput?: string
  ): Promise<{
    name: string;
    type: ElementType;
    primaryLocator: { type: Locator['type']; value: string };
    locators: Locator[];
  } | null> {
    const stopWords = new Set([
      'click', 'on', 'the', 'button', 'in', 'field', 'enter', 'input', 'select', 'verify',
      'to', 'is', 'should', 'be', 'displayed', 'text', 'please', 'for', 'with', 'into',
      'and', 'from', 'a', 'an', 'at', 'box', 'dropdown', 'checkbox', 'link', 'check', 'validate', 'assert'
    ]);

    const descTokens = description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => !stopWords.has(w) && w.length > 1);

    const rawTokens = Array.from(new Set(descTokens));
    const fullPhrase = rawTokens.join(' ').trim();
    const phraseVariants = new Set<string>();
    if (fullPhrase) {
      phraseVariants.add(fullPhrase);
      if (fullPhrase.endsWith('s')) {
        phraseVariants.add(fullPhrase.slice(0, -1));
      } else {
        phraseVariants.add(`${fullPhrase}s`);
      }
    }

    const testValue = (rawInput || inputParams?.text || '').toLowerCase();

    // 1. Direct Live Playwright DOM Query against active open page
    if (page && !page.isClosed()) {

      // BRANCH A: ENTER TEXT / CLEAR TEXT (Must target input or textarea)
      if (intent === 'enter_text' || intent === 'clear_text') {
        const inputQueries: Array<{ type: Locator['type']; value: string; hint: string }> = [];

        // Check if step is for email
        if (rawTokens.includes('email') || testValue.includes('@')) {
          inputQueries.push(
            { type: 'CSS Selector', value: 'input[type="email"]', hint: 'Email' },
            { type: 'CSS Selector', value: 'input#Email, input#email', hint: 'Email' },
            { type: 'CSS Selector', value: 'input[name="Email" i]', hint: 'Email' },
            { type: 'CSS Selector', value: 'input[placeholder*="email" i]', hint: 'Email' },
            { type: 'CSS Selector', value: 'input[id*="email" i]', hint: 'Email' },
            { type: 'CSS Selector', value: 'input[aria-label*="email" i]', hint: 'Email' }
          );
        }

        // Check if step is for password
        if (rawTokens.includes('password') || description.toLowerCase().includes('password')) {
          inputQueries.push(
            { type: 'CSS Selector', value: 'input[type="password"]', hint: 'Password' },
            { type: 'CSS Selector', value: 'input#Password, input#password', hint: 'Password' },
            { type: 'CSS Selector', value: 'input[name="Password" i]', hint: 'Password' },
            { type: 'CSS Selector', value: 'input[placeholder*="password" i]', hint: 'Password' },
            { type: 'CSS Selector', value: 'input[id*="password" i]', hint: 'Password' },
            { type: 'CSS Selector', value: 'input[aria-label*="password" i]', hint: 'Password' }
          );
        }

        // Generic token-based input queries
        for (const token of rawTokens) {
          inputQueries.push(
            { type: 'CSS Selector', value: `input[id="${token}" i], input#${token}`, hint: token },
            { type: 'CSS Selector', value: `input[name="${token}" i]`, hint: token },
            { type: 'CSS Selector', value: `input[placeholder*="${token}" i]`, hint: token },
            { type: 'CSS Selector', value: `input[id*="${token}" i]`, hint: token },
            { type: 'CSS Selector', value: `input[aria-label*="${token}" i]`, hint: token },
            { type: 'CSS Selector', value: `textarea[id*="${token}" i], textarea[name*="${token}" i]`, hint: token },
            { type: 'CSS Selector', value: `[data-testid*="${token}" i] input, [data-testid*="${token}" i]`, hint: token },
            { type: 'XPath', value: `//input[contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${token}') or contains(translate(@name, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${token}') or contains(translate(@placeholder, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${token}')]`, hint: token }
          );
        }

        // Execute input queries
        for (const q of inputQueries) {
          try {
            const loc = this.resolvePlaywrightLocator(page, q.type, q.value).first();
            const count = await loc.count();
            if (count > 0 && (await loc.isVisible().catch(() => false))) {
              const elInfo = await loc.evaluate((el: HTMLElement) => ({
                tag: el.tagName.toLowerCase(),
                id: el.id ? String(el.id).trim() : '',
                name: el.getAttribute('name') || '',
                testId: el.getAttribute('data-testid') || el.getAttribute('data-test') || '',
                placeholder: el.getAttribute('placeholder') || '',
                ariaLabel: el.getAttribute('aria-label') || '',
                title: el.getAttribute('title') || '',
                text: ((el as any).innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50),
                type: el.getAttribute('type') || ''
              })).catch(() => null);

              if (elInfo && (elInfo.tag === 'input' || elInfo.tag === 'textarea' || elInfo.tag === 'select')) {
                return this.buildResolvedElement(elInfo, q.hint, 'Input Field');
              }
            }
          } catch {}
        }
      }

      // BRANCH B: CLICK ELEMENT (Must target button, link, or clickable)
      if (
        intent === 'click_element' ||
        intent === 'double_click_element' ||
        intent === 'right_click_element' ||
        !intent
      ) {
        const clickQueries: Array<{ type: Locator['type']; value: string; hint: string }> = [];

        // Exact compound phrase
        for (const phrase of phraseVariants) {
          clickQueries.push(
            { type: 'CSS Selector', value: `button[aria-label*="${phrase}" i], [role="button"][aria-label*="${phrase}" i]`, hint: phrase },
            { type: 'CSS Selector', value: `button[title*="${phrase}" i], [title*="${phrase}" i]`, hint: phrase },
            { type: 'CSS Selector', value: `button:has-text("${phrase}"), [role="button"]:has-text("${phrase}"), a:has-text("${phrase}")`, hint: phrase },
            { type: 'CSS Selector', value: `button[id*="${phrase.replace(/\s+/g, '')}" i], button[id*="${phrase.replace(/\s+/g, '_')}" i]`, hint: phrase }
          );
        }

        // Token-based click queries
        for (const token of rawTokens) {
          // Special prioritization for login buttons:
          // Home page: #loginBtn
          // Dialog modal: #Login
          if (token === 'login') {
            clickQueries.push(
              { type: 'CSS Selector', value: 'button#loginBtn, #loginBtn', hint: 'Login' },
              { type: 'CSS Selector', value: 'button#Login, #Login', hint: 'Login' },
              { type: 'CSS Selector', value: 'button[name="Login" i]', hint: 'Login' },
              { type: 'CSS Selector', value: 'button:has-text("LOGIN")', hint: 'Login' },
              { type: 'CSS Selector', value: 'button:has-text("Login")', hint: 'Login' }
            );
          }

          clickQueries.push(
            { type: 'CSS Selector', value: `button[id="${token}" i], button#${token}`, hint: token },
            { type: 'CSS Selector', value: `button[id*="${token}" i], button[id*="${token}btn" i]`, hint: token },
            { type: 'CSS Selector', value: `button[aria-label*="${token}" i], [role="button"][aria-label*="${token}" i]`, hint: token },
            { type: 'CSS Selector', value: `button[title*="${token}" i]`, hint: token },
            { type: 'CSS Selector', value: `button:has-text("${token}"), [role="button"]:has-text("${token}"), a:has-text("${token}")`, hint: token },
            { type: 'CSS Selector', value: `[data-testid*="${token}" i] button, button[data-testid*="${token}" i]`, hint: token },
            { type: 'CSS Selector', value: `input[type="submit"][value*="${token}" i], input[type="button"][value*="${token}" i]`, hint: token },
            { type: 'XPath', value: `//button[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${token}') or contains(translate(@id, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${token}') or contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${token}')]`, hint: token }
          );
        }

        for (const cq of clickQueries) {
          try {
            const loc = this.resolvePlaywrightLocator(page, cq.type, cq.value).first();
            const count = await loc.count();
            if (count > 0 && (await loc.isVisible().catch(() => false))) {
              const elInfo = await loc.evaluate((el: HTMLElement) => ({
                tag: el.tagName.toLowerCase(),
                id: el.id ? String(el.id).trim() : '',
                name: el.getAttribute('name') || '',
                testId: el.getAttribute('data-testid') || el.getAttribute('data-test') || '',
                placeholder: el.getAttribute('placeholder') || '',
                ariaLabel: el.getAttribute('aria-label') || '',
                title: el.getAttribute('title') || '',
                text: ((el as any).innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50),
                type: el.getAttribute('type') || ''
              })).catch(() => null);

              if (elInfo) {
                // Reject contradictory matches
                const combined = `${elInfo.text} ${elInfo.ariaLabel} ${elInfo.title} ${elInfo.id} ${elInfo.name}`.toLowerCase();
                if (description.toLowerCase().includes('setting') && (combined.includes('create account') || combined.includes('register') || combined.includes('signup'))) {
                  continue;
                }
                // Reject text inputs when clicking
                if (elInfo.tag === 'input' && !['button', 'submit', 'image', 'reset'].includes(elInfo.type)) {
                  continue;
                }
                const elemType: ElementType = elInfo.tag === 'a' ? 'Link' : 'Button';
                return this.buildResolvedElement(elInfo, cq.hint, elemType);
              }
            }
          } catch {}
        }
      }

      // BRANCH C: VERIFY TEXT (Must target heading or text container)
      if (intent === 'verify_text') {
        const textQueries: Array<{ type: Locator['type']; value: string; hint: string }> = [];
        const cleanExpected = inputParams?.expectedText || NLPMapper.cleanVerificationText(description) || fullPhrase;

        textQueries.push(
          { type: 'CSS Selector', value: `h1:has-text("${cleanExpected}"), h2:has-text("${cleanExpected}"), h3:has-text("${cleanExpected}"), h4:has-text("${cleanExpected}")`, hint: cleanExpected },
          { type: 'CSS Selector', value: `[role="heading"]:has-text("${cleanExpected}")`, hint: cleanExpected },
          { type: 'CSS Selector', value: `p:has-text("${cleanExpected}"), span:has-text("${cleanExpected}"), label:has-text("${cleanExpected}")`, hint: cleanExpected },
          { type: 'CSS Selector', value: `[aria-label*="${cleanExpected}" i], [title*="${cleanExpected}" i]`, hint: cleanExpected },
          { type: 'XPath', value: `//*[(self::h1 or self::h2 or self::h3 or self::h4 or self::p or self::span or self::label or @role='heading') and contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${cleanExpected.toLowerCase()}')]`, hint: cleanExpected }
        );

        for (const tq of textQueries) {
          try {
            const loc = this.resolvePlaywrightLocator(page, tq.type, tq.value).first();
            const count = await loc.count();
            if (count > 0 && (await loc.isVisible().catch(() => false))) {
              const elInfo = await loc.evaluate((el: HTMLElement) => ({
                tag: el.tagName.toLowerCase(),
                id: el.id ? String(el.id).trim() : '',
                name: el.getAttribute('name') || '',
                testId: el.getAttribute('data-testid') || el.getAttribute('data-test') || '',
                placeholder: el.getAttribute('placeholder') || '',
                ariaLabel: el.getAttribute('aria-label') || '',
                title: el.getAttribute('title') || '',
                text: ((el as any).innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50),
                type: el.getAttribute('type') || ''
              })).catch(() => null);

              if (elInfo) {
                return this.buildResolvedElement(elInfo, tq.hint, 'Text / Label');
              }
            }
          } catch {}
        }
      }

      // BRANCH D: VERIFY ELEMENT DISPLAYED
      if (intent === 'verify_element_displayed') {
        const verifyQueries: Array<{ type: Locator['type']; value: string; hint: string }> = [];

        for (const phrase of phraseVariants) {
          verifyQueries.push(
            { type: 'CSS Selector', value: `[aria-label*="${phrase}" i]`, hint: phrase },
            { type: 'CSS Selector', value: `[title*="${phrase}" i]`, hint: phrase },
            { type: 'CSS Selector', value: `button[aria-label*="${phrase}" i], [role="button"][aria-label*="${phrase}" i]`, hint: phrase },
            { type: 'CSS Selector', value: `button:has-text("${phrase}"), a:has-text("${phrase}"), [role="button"]:has-text("${phrase}")`, hint: phrase },
            { type: 'CSS Selector', value: `h1:has-text("${phrase}"), h2:has-text("${phrase}"), h3:has-text("${phrase}"), span:has-text("${phrase}")`, hint: phrase },
            { type: 'XPath', value: `//*[(self::button or self::a or @role='button' or self::div or self::span) and (contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${phrase}') or contains(translate(@title, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${phrase}') or contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${phrase}'))]`, hint: phrase }
          );
        }

        for (const vq of verifyQueries) {
          try {
            const loc = this.resolvePlaywrightLocator(page, vq.type, vq.value).first();
            const count = await loc.count();
            if (count > 0 && (await loc.isVisible().catch(() => false))) {
              const elInfo = await loc.evaluate((el: HTMLElement) => ({
                tag: el.tagName.toLowerCase(),
                id: el.id ? String(el.id).trim() : '',
                name: el.getAttribute('name') || '',
                testId: el.getAttribute('data-testid') || el.getAttribute('data-test') || '',
                placeholder: el.getAttribute('placeholder') || '',
                ariaLabel: el.getAttribute('aria-label') || '',
                title: el.getAttribute('title') || '',
                text: ((el as any).innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 50),
                type: el.getAttribute('type') || ''
              })).catch(() => null);

              if (elInfo) {
                const combined = `${elInfo.text} ${elInfo.ariaLabel} ${elInfo.title} ${elInfo.id}`.toLowerCase();
                if (description.toLowerCase().includes('setting') && (combined.includes('create account') || combined.includes('signup') || combined.includes('register'))) {
                  continue; // Reject false positive!
                }
                const elemType: ElementType = elInfo.tag === 'button' || elInfo.ariaLabel ? 'Button' : 'Text / Label';
                return this.buildResolvedElement(elInfo, vq.hint, elemType);
              }
            }
          } catch {}
        }
      }
    }

    // 2. Fallback to scoring domElements snapshot with Multi-Token & Contradiction Weighting
    let bestMatch: any = null;
    let highestScore = 0;

    for (const el of domElements) {
      let score = 0;
      const combined = `${el.id || ''} ${el.name || ''} ${el.testId || ''} ${el.placeholder || ''} ${el.text || ''} ${el.ariaLabel || ''} ${el.title || ''}`.toLowerCase();

      // Check intent tag relevance
      if (intent === 'enter_text' || intent === 'clear_text') {
        if (el.tag === 'input' || el.tag === 'textarea') score += 50;
        else score -= 50;
      } else if (intent === 'click_element') {
        if (el.tag === 'button' || el.role === 'button' || el.tag === 'a') score += 40;
        else if (el.tag === 'input') score -= 30;
      }

      // Check full phrase match
      if (fullPhrase && combined.includes(fullPhrase)) {
        score += 60;
      }

      // Check token matches
      let matchedTokenCount = 0;
      for (const token of rawTokens) {
        if (combined.includes(token)) {
          score += 10;
          matchedTokenCount++;
        }
        if (el.text && el.text.toLowerCase().includes(token)) score += 15;
        if (el.ariaLabel && el.ariaLabel.toLowerCase().includes(token)) score += 20;
        if (el.title && el.title.toLowerCase().includes(token)) score += 20;
        if (el.id && el.id.toLowerCase().includes(token)) score += 20;
      }

      // All tokens matched bonus
      if (rawTokens.length > 1 && matchedTokenCount === rawTokens.length) {
        score += 40;
      }

      // Contradiction Penalty
      if (description.toLowerCase().includes('setting')) {
        if (combined.includes('create account') || combined.includes('signup') || combined.includes('register')) {
          score -= 100;
        }
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = el;
      }
    }

    if (!bestMatch) return null;

    const locs = this.synthesizePlaywrightCandidateLocators(bestMatch);

    const elemType: ElementType =
      bestMatch.tag === 'input' || bestMatch.tag === 'textarea'
        ? 'Input Field'
        : bestMatch.tag === 'select'
        ? 'Dropdown / Select'
        : bestMatch.tag === 'a'
        ? 'Link'
        : ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'label'].includes(bestMatch.tag)
        ? 'Text / Label'
        : 'Button';

    const cleanName = this.cleanElementHint(
      bestMatch.ariaLabel || bestMatch.title || bestMatch.name || bestMatch.id || fullPhrase,
      elemType
    );

    return {
      name: cleanName.slice(0, 40),
      type: elemType,
      primaryLocator: { type: locs[0]?.type || 'ID', value: locs[0]?.value || '' },
      locators: locs
    };
  }

  public synthesizePlaywrightCandidateLocators(elInfo: any): Locator[] {
    const list: Locator[] = [];
    let p = 1;

    const tag = (elInfo.tag || elInfo.tagName || 'button').toLowerCase();
    const id = (elInfo.id || '').trim();
    const name = (elInfo.name || '').trim();
    const testId = (elInfo.testId || elInfo['data-testid'] || elInfo['data-test'] || '').trim();
    const ariaLabel = (elInfo.ariaLabel || elInfo['aria-label'] || '').trim();
    const placeholder = (elInfo.placeholder || '').trim();
    const title = (elInfo.title || '').trim();
    const roleAttr = (elInfo.role || '').trim();
    const typeAttr = (elInfo.type || '').trim();
    const text = (elInfo.text || elInfo.textContent || '').trim().replace(/\s+/g, ' ');

    // 1. Role Locator (Top Playwright recommendation)
    let role = roleAttr;
    if (!role) {
      if (tag === 'button' || (tag === 'input' && ['submit', 'button', 'reset'].includes(typeAttr))) {
        role = 'button';
      } else if (tag === 'a') {
        role = 'link';
      } else if (tag === 'input' && typeAttr === 'checkbox') {
        role = 'checkbox';
      } else if (tag === 'input' && typeAttr === 'radio') {
        role = 'radio';
      } else if (tag === 'input' || tag === 'textarea') {
        role = 'textbox';
      } else if (tag === 'select') {
        role = 'combobox';
      } else if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
        role = 'heading';
      }
    }

    const accessibleName = ariaLabel || title || (text && text.length <= 40 ? text : '') || (name && name.length <= 30 ? name : '');
    if (role) {
      const roleVal = accessibleName
        ? `getByRole('${role}', { name: '${accessibleName.replace(/'/g, "\\'")}' })`
        : `getByRole('${role}')`;
      list.push({
        id: `loc_${p}_${crypto.randomUUID().slice(0, 4)}`,
        type: 'Role',
        value: roleVal,
        valueType: 'Static',
        isPrimary: p === 1,
        priority: p++
      });
    }

    // 2. Test ID
    if (testId) {
      list.push({
        id: `loc_${p}_${crypto.randomUUID().slice(0, 4)}`,
        type: 'Test ID',
        value: testId,
        valueType: 'Static',
        isPrimary: p === 1,
        priority: p++
      });
    }

    // 3. Accessible Label
    if (ariaLabel) {
      list.push({
        id: `loc_${p}_${crypto.randomUUID().slice(0, 4)}`,
        type: 'Label',
        value: ariaLabel,
        valueType: 'Static',
        isPrimary: p === 1,
        priority: p++
      });
    }

    // 4. Form Placeholder
    if (placeholder) {
      list.push({
        id: `loc_${p}_${crypto.randomUUID().slice(0, 4)}`,
        type: 'Placeholder',
        value: placeholder,
        valueType: 'Static',
        isPrimary: p === 1,
        priority: p++
      });
    }

    // 5. Clean Semantic ID
    if (id && !/^(root|app|__next|ember\d+|react-\d+|ng-\d+|\b\d{5,}\b)$/i.test(id)) {
      list.push({
        id: `loc_${p}_${crypto.randomUUID().slice(0, 4)}`,
        type: 'ID',
        value: id,
        valueType: 'Static',
        isPrimary: p === 1,
        priority: p++
      });
    }

    // 6. Name attribute
    if (name) {
      list.push({
        id: `loc_${p}_${crypto.randomUUID().slice(0, 4)}`,
        type: 'Name',
        value: name,
        valueType: 'Static',
        isPrimary: p === 1,
        priority: p++
      });
    }

    // 7. Visible Text
    if (text && text.length > 0 && text.length <= 50) {
      list.push({
        id: `loc_${p}_${crypto.randomUUID().slice(0, 4)}`,
        type: 'Text',
        value: text,
        valueType: 'Static',
        isPrimary: p === 1,
        priority: p++
      });
    }

    // 8. Clean CSS Selector
    let cssVal = '';
    if (id) {
      cssVal = `${tag}#${id}`;
    } else if (name) {
      cssVal = `${tag}[name="${name}"]`;
    } else if (ariaLabel) {
      cssVal = `${tag}[aria-label="${ariaLabel}"]`;
    } else if (placeholder) {
      cssVal = `${tag}[placeholder="${placeholder}"]`;
    } else if (text && text.length <= 30) {
      cssVal = `${tag}:has-text("${text}")`;
    } else {
      cssVal = tag;
    }
    list.push({
      id: `loc_${p}_${crypto.randomUUID().slice(0, 4)}`,
      type: 'CSS Selector',
      value: cssVal,
      valueType: 'Static',
      isPrimary: p === 1,
      priority: p++
    });

    // 9. XPath
    let xpathVal = '';
    if (id) {
      xpathVal = `//${tag}[@id='${id}']`;
    } else if (name) {
      xpathVal = `//${tag}[@name='${name}']`;
    } else if (ariaLabel) {
      xpathVal = `//${tag}[@aria-label='${ariaLabel}']`;
    } else if (text && text.length <= 30) {
      xpathVal = `//${tag}[contains(normalize-space(.), '${text.replace(/'/g, "\\'")}')]`;
    } else {
      xpathVal = `//${tag}`;
    }
    list.push({
      id: `loc_${p}_${crypto.randomUUID().slice(0, 4)}`,
      type: 'XPath',
      value: xpathVal,
      valueType: 'Static',
      isPrimary: p === 1,
      priority: p++
    });

    return list;
  }

  private buildResolvedElement(
    elInfo: any,
    hintToken: string,
    forcedType?: ElementType
  ): {
    name: string;
    type: ElementType;
    primaryLocator: { type: Locator['type']; value: string };
    locators: Locator[];
  } {
    const locs = this.synthesizePlaywrightCandidateLocators(elInfo);

    const calculatedType: ElementType =
      forcedType ||
      (elInfo.tag === 'input' || elInfo.tag === 'textarea'
        ? 'Input Field'
        : elInfo.tag === 'select'
        ? 'Dropdown / Select'
        : elInfo.tag === 'a'
        ? 'Link'
        : ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'label'].includes(elInfo.tag)
        ? 'Text / Label'
        : 'Button');

    const cleanName = this.cleanElementHint(
      hintToken || elInfo.ariaLabel || elInfo.title || elInfo.text || elInfo.name || elInfo.id || 'Element',
      calculatedType
    );

    return {
      name: cleanName.slice(0, 40),
      type: calculatedType,
      primaryLocator: { type: locs[0]?.type || 'ID', value: locs[0]?.value || '' },
      locators: locs
    };
  }

  private cleanElementHint(desc: string, forcedType?: ElementType | string): string {
    let clean = desc
      .replace(/^(click on|click|enter text in|enter text to|enter|type in|type|verify|select|check|uncheck|validate|assert)\s+/i, '')
      .replace(/\b(the|a|an|in|on|into|to|from|for|at|button|field|input|box|dropdown|checkbox|link|icon|text|message|label|heading|header|title)\b/gi, ' ')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!clean) clean = 'Target';

    const words = clean.split(/\s+/);
    const uniqueWords: string[] = [];
    for (const w of words) {
      if (!uniqueWords.some(uw => uw.toLowerCase() === w.toLowerCase())) {
        uniqueWords.push(w.charAt(0).toUpperCase() + w.slice(1));
      }
    }
    const baseName = uniqueWords.join(' ') || 'Target';

    if (forcedType) {
      const typeStr = String(forcedType);
      if (typeStr.includes('Input') && !baseName.toLowerCase().includes('input')) {
        return `${baseName} Input Field`;
      }
      if (typeStr.includes('Button') && !baseName.toLowerCase().includes('button')) {
        return `${baseName} Button`;
      }
      if (typeStr.includes('Text') && !baseName.toLowerCase().includes('text')) {
        return `${baseName} Text / Label`;
      }
      if (typeStr.includes('Link') && !baseName.toLowerCase().includes('link')) {
        return `${baseName} Link`;
      }
    }

    return baseName;
  }

  /**
   * Maximizes the live browser window to fit the machine's display using CDP and viewport
   */
  private async maximizeBrowserWindow(page: any): Promise<void> {
    if (!page || page.isClosed()) return;

    // 1. CDP maximize for Chrome/Chromium window frame
    try {
      const session = await page.context().newCDPSession(page);
      let targetId: string | undefined;
      try {
        const info = await session.send('Target.getTargetInfo');
        targetId = info?.targetInfo?.targetId;
      } catch {}

      const { windowId } = await session.send('Browser.getWindowForTarget', targetId ? { targetId } : {});
      if (windowId !== undefined) {
        await session.send('Browser.setWindowBounds', {
          windowId,
          bounds: { windowState: 'maximized' }
        });
        await session.send('Emulation.clearDeviceMetricsOverride').catch(() => {});
        await session.send('Emulation.resetPageScaleFactor').catch(() => {});
      }
    } catch (e: any) {
      console.warn('CDP maximize windowState failed:', e.message);
    }

    // 2. Adjust viewport size to match machine physical screen
    try {
      const dims = await page.evaluate(() => ({
        width: window.screen.availWidth || window.screen.width || 1920,
        height: window.screen.availHeight || window.screen.height || 1080
      }));
      if (dims.width && dims.height) {
        await page.setViewportSize({ width: dims.width, height: dims.height }).catch(() => {});
      }
    } catch {}

    // 3. Reset zoom variation
    try {
      await page.evaluate(() => {
        try {
          document.documentElement.style.zoom = '1';
        } catch {}
      });
    } catch {}
  }

  /**
   * Extracts visible interactive elements from the live page DOM
   */
  private async extractLiveDomElements(page: any): Promise<Array<any>> {
    try {
      return await page.evaluate(() => {
        // Collect interactive form controls, clickable elements, accessible buttons, and headings
        const priorityNodes = Array.from(
          document.querySelectorAll(
            'button, a, input, select, textarea, [role="button"], [role="link"], [role="menuitem"], [role="tab"], [aria-label], [title], [data-testid], [data-test], [id*="btn" i], [id*="login" i], [id*="account" i], [id*="setting" i], [class*="btn" i]'
          )
        );
        const headingAndTextNodes = Array.from(
          document.querySelectorAll('h1, h2, h3, h4, [role="heading"], label')
        );
        const combinedNodes = Array.from(new Set([...priorityNodes, ...headingAndTextNodes]));

        return combinedNodes
          .map(el => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            const isVisible =
              rect.width > 0 &&
              rect.height > 0 &&
              style.visibility !== 'hidden' &&
              style.display !== 'none' &&
              style.opacity !== '0';
            if (!isVisible) return null;

            const tag = el.tagName.toLowerCase();
            // Filter out container wrappers that have no interactive role or accessible label
            if (['div', 'section', 'article', 'header', 'footer', 'nav', 'main', 'aside', 'ul', 'ol'].includes(tag)) {
              const hasRole = !!el.getAttribute('role');
              const hasAria = !!el.getAttribute('aria-label');
              const hasTitle = !!el.getAttribute('title');
              if (!hasRole && !hasAria && !hasTitle) return null;
            }

            const text = ((el as any).innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
            const id = el.id ? String(el.id).trim() : '';
            const name = el.getAttribute('name') || '';
            const testId = el.getAttribute('data-testid') || el.getAttribute('data-test') || '';
            const placeholder = el.getAttribute('placeholder') || '';
            const ariaLabel = el.getAttribute('aria-label') || '';
            const title = el.getAttribute('title') || '';
            const role = el.getAttribute('role') || '';
            const type = el.getAttribute('type') || '';

            // Filter out purely empty non-form elements
            if (!text && !id && !name && !testId && !placeholder && !ariaLabel && !title) return null;

            return {
              tag,
              id: id || undefined,
              name: name || undefined,
              testId: testId || undefined,
              placeholder: placeholder || undefined,
              ariaLabel: ariaLabel || undefined,
              title: title || undefined,
              role: role || undefined,
              type: type || undefined,
              text: text || undefined
            };
          })
          .filter(Boolean)
          .slice(0, 100);
      });
    } catch {
      return [];
    }
  }

  /**
   * Section 10 Fallback: Resolves a working Playwright locator trying primary then configured candidate locators
   */
  private async getWorkingLocator(
    page: any,
    stepDetail: AIAutomationStepDetail,
    projectId?: string
  ): Promise<any> {
    const locatorsToTry: Array<{ type?: string; value?: string }> = [];

    // 1. Primary locator from stepDetail
    if (stepDetail.locatorValue) {
      locatorsToTry.push({ type: stepDetail.locatorType, value: stepDetail.locatorValue });
    }

    // 2. Fallback locators from repository element
    if (stepDetail.elementId && projectId) {
      try {
        const elem = this.db.getRepositoryElementById(stepDetail.elementId, projectId);
        if (elem && elem.locators) {
          for (const l of elem.locators) {
            if (l.value !== stepDetail.locatorValue) {
              locatorsToTry.push({ type: l.type, value: l.value });
            }
          }
        }
      } catch {}
    }

    // 3. Try each candidate locator
    for (const cand of locatorsToTry) {
      if (!cand.value) continue;
      try {
        const loc = this.resolvePlaywrightLocator(page, cand.type, cand.value).first();
        const count = await loc.count();
        if (count > 0 && (await loc.isVisible().catch(() => false))) {
          return loc;
        }
      } catch {}
    }

    // 4. Default to primary locator
    if (locatorsToTry.length > 0) {
      return this.resolvePlaywrightLocator(page, locatorsToTry[0].type, locatorsToTry[0].value).first();
    }
    return page.locator('body').first();
  }

  /**
   * Executes a single mapped step in the live Playwright browser
   */
  private async executeLiveStep(
    page: any,
    mappedNLP: MappedNLPStep,
    stepDetail: AIAutomationStepDetail,
    projectId?: string
  ): Promise<void> {
    const nlp = mappedNLP.nlpId;
    const params = stepDetail.inputParameters || {};

    switch (nlp) {
      case 'open_browser': {
        if (!this.activeBrowser || !page) {
          throw new Error('Browser is not open');
        }
        await this.maximizeBrowserWindow(page);
        break;
      }

      case 'maximize_browser': {
        await this.maximizeBrowserWindow(page);
        break;
      }

      case 'navigate_to_url': {
        const url = params.url || stepDetail.manualInput || 'https://demo.easyautomate.dev';
        await page.goto(url, { waitUntil: 'load', timeout: 30000 }).catch(async () => {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        });
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(2500);
        break;
      }

      case 'enter_text': {
        const text = params.text || stepDetail.manualInput || '';
        const loc = await this.getWorkingLocator(page, stepDetail, projectId);
        await loc.waitFor({ state: 'visible', timeout: 12000 });
        await loc.scrollIntoViewIfNeeded().catch(() => {});

        // Safety: check if element is input/textarea, or locate inner input/textarea
        let targetLoc = loc;
        const tag = await loc.evaluate((el: HTMLElement) => el.tagName.toLowerCase()).catch(() => '');
        if (tag !== 'input' && tag !== 'textarea') {
          const innerInput = loc.locator('input, textarea').first();
          if ((await innerInput.count().catch(() => 0)) > 0) {
            targetLoc = innerInput;
          }
        }

        try {
          await targetLoc.fill(text);
        } catch {
          await targetLoc.click({ force: true }).catch(() => {});
          await page.keyboard.type(text);
        }
        await page.waitForTimeout(500);
        break;
      }

      case 'click_element': {
        const loc = await this.getWorkingLocator(page, stepDetail, projectId);
        await loc.waitFor({ state: 'visible', timeout: 12000 });
        await loc.scrollIntoViewIfNeeded().catch(() => {});
        try {
          await loc.click({ timeout: 5000 });
        } catch {
          try {
            await loc.click({ force: true, timeout: 5000 });
          } catch {
            await loc.dispatchEvent('click');
          }
        }
        await page.waitForTimeout(1000);
        break;
      }

      case 'double_click_element': {
        const loc = await this.getWorkingLocator(page, stepDetail, projectId);
        await loc.waitFor({ state: 'visible', timeout: 8000 });
        await loc.dblclick();
        break;
      }

      case 'right_click_element': {
        const loc = await this.getWorkingLocator(page, stepDetail, projectId);
        await loc.waitFor({ state: 'visible', timeout: 8000 });
        await loc.click({ button: 'right' });
        break;
      }

      case 'hover_element': {
        const loc = await this.getWorkingLocator(page, stepDetail, projectId);
        await loc.waitFor({ state: 'visible', timeout: 8000 });
        await loc.hover();
        break;
      }

      case 'clear_text': {
        const loc = await this.getWorkingLocator(page, stepDetail, projectId);
        await loc.waitFor({ state: 'visible', timeout: 8000 });
        await loc.fill('');
        break;
      }

      case 'select_dropdown_option': {
        const opt = params.optionText || stepDetail.manualInput || '';
        const loc = await this.getWorkingLocator(page, stepDetail, projectId);
        await loc.waitFor({ state: 'visible', timeout: 8000 });
        await loc.selectOption({ label: opt }).catch(() => loc.selectOption({ value: opt }));
        break;
      }

      case 'select_checkbox': {
        const loc = await this.getWorkingLocator(page, stepDetail, projectId);
        await loc.waitFor({ state: 'visible', timeout: 8000 });
        await loc.check();
        break;
      }

      case 'unselect_checkbox': {
        const loc = await this.getWorkingLocator(page, stepDetail, projectId);
        await loc.waitFor({ state: 'visible', timeout: 8000 });
        await loc.uncheck();
        break;
      }

      case 'scroll_to_element': {
        const loc = await this.getWorkingLocator(page, stepDetail, projectId);
        await loc.scrollIntoViewIfNeeded();
        break;
      }

      case 'wait_for_element_to_be_visible': {
        const loc = await this.getWorkingLocator(page, stepDetail, projectId);
        await loc.waitFor({ state: 'visible', timeout: 10000 });
        break;
      }

      case 'verify_element_displayed': {
        const loc = await this.getWorkingLocator(page, stepDetail, projectId);
        await loc.waitFor({ state: 'visible', timeout: 8000 });
        const visible = await loc.isVisible();
        if (!visible) throw new Error(`Element "${stepDetail.elementName}" is not visible.`);
        break;
      }

      case 'verify_text': {
        const loc = await this.getWorkingLocator(page, stepDetail, projectId);
        await loc.waitFor({ state: 'visible', timeout: 8000 });
        const inner = (await loc.innerText().catch(() => '') || '').trim();
        const ariaLabel = (await loc.getAttribute('aria-label').catch(() => '') || '').trim();
        const title = (await loc.getAttribute('title').catch(() => '') || '').trim();
        const text = [inner, ariaLabel, title].filter(Boolean).join(' ');
        const rawExpected = params.expectedText || stepDetail.manualInput || stepDetail.manualExpectedResult || '';
        const cleanExpected = NLPMapper.cleanVerificationText(rawExpected) || rawExpected;

        const normActual = this.normalizeForComparison(text);
        const normExpected = this.normalizeForComparison(cleanExpected);

        const expectedWords = normExpected.split(' ').filter(w => w.length > 1);
        const allWordsFound = expectedWords.length > 0 && expectedWords.every(w => normActual.includes(w));

        const matches =
          normActual.includes(normExpected) ||
          normExpected.includes(normActual) ||
          allWordsFound;

        if (!matches) {
          throw new Error(`Text mismatch: Expected to contain "${cleanExpected}", but found "${text}"`);
        }
        break;
      }

      default: {
        // General interaction fallback
        if (stepDetail.locatorValue) {
          const loc = await this.getWorkingLocator(page, stepDetail, projectId);
          await loc.click().catch(() => {});
        }
        break;
      }
    }
  }

  private resolvePlaywrightLocator(page: any, type?: string, value?: string): any {
    if (!value) return page.locator('body');
    const trimmed = value.trim();
    switch (type) {
      case 'ID': {
        const idVal = trimmed.replace(/^#/, '');
        return page.locator(`[id="${idVal}"]`);
      }
      case 'Test ID': {
        return page.locator(`[data-testid="${trimmed}"], [data-test="${trimmed}"]`);
      }
      case 'CSS Selector': {
        return page.locator(trimmed);
      }
      case 'XPath': {
        return page.locator(trimmed.startsWith('xpath=') ? trimmed : `xpath=${trimmed}`);
      }
      case 'Text': {
        return page.getByText(trimmed, { exact: false });
      }
      case 'Placeholder': {
        return page.getByPlaceholder(trimmed);
      }
      case 'Label': {
        return page.getByLabel(trimmed, { exact: false });
      }
      case 'Name': {
        return page.locator(`[name="${trimmed}"]`);
      }
      case 'Role': {
        const { role, name } = AutomationEngine.parseRoleLocator(trimmed);
        return name
          ? page.getByRole(role as any, { name, exact: false })
          : page.getByRole(role as any);
      }
      default: {
        return page.locator(trimmed);
      }
    }
  }

  private normalizeForComparison(str: string): string {
    return (str || '')
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // =========================================================================
  // EXECUTION CONTROLS & SESSION LIFECYCLE
  // =========================================================================

  public pauseSession(): boolean {
    this.isPaused = true;
    return true;
  }

  public resumeSession(): boolean {
    this.isPaused = false;
    return true;
  }

  public async stopSession(): Promise<boolean> {
    this.isStopped = true;
    this.isPaused = false;
    if (this.activeBrowser) {
      try {
        await this.activeBrowser.close();
      } catch {}
      this.activeBrowser = null;
      this.activeContext = null;
      this.activePage = null;
    }
    return true;
  }

  public async retryStep(sessionId: string, projectId: string, stepNumber: number): Promise<boolean> {
    const session = this.db.getAIAutomationSessionById(sessionId, projectId);
    if (!session || !this.activePage) return false;

    const step = session.steps.find(s => s.stepNumber === stepNumber);
    if (!step) return false;

    step.status = 'Executing';
    this.emitEvent('aiAutoTesting:sessionUpdate', session);

    try {
      const mappedNLP = NLPMapper.mapStepToNLP(
        {
          stepNumber: step.stepNumber,
          stepDescription: step.manualStepDescription,
          input: step.manualInput,
          expectedResult: step.manualExpectedResult
        },
        session.applicationUrl
      );
      await this.executeLiveStep(this.activePage, mappedNLP, step);
      step.status = 'Passed';
      step.error = undefined;
      session.status = 'developing';
      this.db.saveAIAutomationSession(session);
      this.emitEvent('aiAutoTesting:sessionUpdate', session);
      return true;
    } catch (e: any) {
      step.status = 'Failed';
      step.error = e.message;
      this.db.saveAIAutomationSession(session);
      this.emitEvent('aiAutoTesting:sessionUpdate', session);
      return false;
    }
  }

  private failSession(session: AIAutomationSession, error: string) {
    session.status = 'failed';
    session.failureDetails = {
      stepNumber: session.currentStepIndex + 1,
      error
    };
    this.db.saveAIAutomationSession(session);
    this.emitEvent('aiAutoTesting:sessionUpdate', session);
  }

  // =========================================================================
  // PUSH TO TESTDEV SCRIPTS (Section 11)
  // =========================================================================

  /**
   * Section 11: Saves the generated AI automation as a normal Easy Automate script
   */
  public async pushToTestDev(
    sessionId: string,
    projectId: string,
    targetModuleId: string,
    scriptName: string,
    userId: string
  ): Promise<{ success: boolean; scriptId?: string; error?: string }> {
    const session = this.db.getAIAutomationSessionById(sessionId, projectId);
    if (!session) {
      return { success: false, error: 'AI session not found' };
    }

    if (session.steps.length === 0) {
      return { success: false, error: 'Session contains no steps to push' };
    }

    // 1. Ensure target module exists
    let moduleId = targetModuleId;
    const modules = this.db.getScriptModules(projectId);
    let targetMod = modules.find(m => m.id === targetModuleId);

    if (!targetMod) {
      // Create new module if not found
      targetMod = this.db.createScriptModule(projectId, 'AI Generated Tests', null);
      moduleId = targetMod.id;
    }

    // 2. Ensure "AI Elements" repository page exists and get existing elements
    const aiPage = this.ensureAIElementsPage(projectId);
    const existingRepoElements = this.db.getRepositoryElements(projectId);

    // 3. Ensure all interactive steps have persisted repository elements with prioritized locators
    for (const step of session.steps) {
      const isBrowserStep = !step.elementName && (!step.locatorType || !step.locatorValue) && [
        'open_browser', 'maximize_browser', 'navigate_to_url', 'static_wait', 'close_browser'
      ].includes(step.nlpId || '');

      if (!isBrowserStep && (step.elementName || (step.locatorType && step.locatorValue))) {
        let elName = step.elementName?.trim() || '';
        if (!elName || /human[- ]?readable|element[- ]?name/i.test(elName)) {
          elName = this.cleanElementHint(step.manualStepDescription || '', step.nlpId || 'click_element');
          step.elementName = elName;
        }

        let repoElem = existingRepoElements.find(e =>
          (step.elementId && e.id === step.elementId) ||
          (elName && e.name.toLowerCase() === elName.toLowerCase())
        );

        if (!repoElem && elName) {
          let locators: Locator[] = [];
          if ((step as any).candidateLocators && Array.isArray((step as any).candidateLocators) && (step as any).candidateLocators.length > 0) {
            locators = (step as any).candidateLocators;
          } else {
            let guessedTag = 'button';
            if (step.nlpId === 'enter_text' || step.nlpId === 'clear_text') guessedTag = 'input';
            else if (step.nlpId === 'verify_text' || step.nlpId === 'verify_element_displayed') guessedTag = 'h3';
            else if (step.nlpId === 'select_dropdown_option') guessedTag = 'select';

            locators = this.synthesizePlaywrightCandidateLocators({
              tag: guessedTag,
              id: step.locatorType === 'ID' ? step.locatorValue : undefined,
              name: step.locatorType === 'Name' ? step.locatorValue : undefined,
              testId: step.locatorType === 'Test ID' ? step.locatorValue : undefined,
              ariaLabel: step.locatorType === 'Label' ? step.locatorValue : undefined,
              placeholder: step.locatorType === 'Placeholder' ? step.locatorValue : undefined,
              text: step.locatorType === 'Text' ? step.locatorValue : elName,
              role: step.locatorType === 'Role' ? step.locatorValue : undefined
            });

            // Ensure the specific step locator is at the top if present
            if (step.locatorType && step.locatorValue) {
              const matchIdx = locators.findIndex(l => l.type === step.locatorType && l.value === step.locatorValue);
              if (matchIdx > -1) {
                const [targetLoc] = locators.splice(matchIdx, 1);
                locators.unshift(targetLoc);
              } else {
                locators.unshift({
                  id: `loc_1_${crypto.randomUUID().slice(0, 4)}`,
                  type: step.locatorType as Locator['type'],
                  value: step.locatorValue,
                  valueType: 'Static',
                  isPrimary: true,
                  priority: 1
                });
              }
              locators.forEach((l, idx) => {
                l.priority = idx + 1;
                l.isPrimary = idx === 0;
              });
            }
          }

          let guessedType: ElementType = 'Button';
          if (step.nlpId === 'enter_text' || step.nlpId === 'clear_text') guessedType = 'Input Field';
          else if (step.nlpId === 'verify_text' || step.nlpId === 'verify_element_displayed') guessedType = 'Text / Label';
          else if (step.nlpId === 'select_dropdown_option') guessedType = 'Dropdown / Select';
          else if (step.nlpId === 'select_checkbox' || step.nlpId === 'unselect_checkbox') guessedType = 'Checkbox';

          repoElem = this.db.createRepositoryElement(projectId, aiPage.id, {
            name: elName,
            type: guessedType,
            elementMode: 'Static',
            description: `Auto-captured by AI Auto Testing for step "${step.manualStepDescription || elName}"`,
            locators: locators.length > 0 ? locators : [
              {
                id: `loc_1_${crypto.randomUUID().slice(0, 4)}`,
                type: 'XPath',
                value: `//*[contains(text(), '${elName}')]`,
                valueType: 'Static',
                isPrimary: true,
                priority: 1
              }
            ]
          });
          existingRepoElements.push(repoElem);
        }

        if (repoElem) {
          step.elementId = repoElem.id;
          step.elementName = repoElem.name;
        }
      }
    }

    // 4. Create the AutomationScript
    const script = this.db.createScript(
      projectId,
      moduleId,
      scriptName.trim() || session.testCaseName || 'AI Automated Script',
      userId,
      `Generated by AI Auto Testing from Test Case "${session.testCaseName}"`
    );

    // 5. Add each step into the script
    session.steps.forEach((step, idx) => {
      const el = existingRepoElements.find(e => e.id === step.elementId);
      const primaryLoc = el?.locators?.find(l => l.isPrimary) || el?.locators?.[0] || (step.locatorType && step.locatorValue ? {
        type: step.locatorType,
        value: step.locatorValue,
        valueType: 'Static',
        isPrimary: true
      } : undefined);

      this.db.addScriptStep(script.id, projectId, {
        nlpId: step.nlpId || 'click_element',
        nlpName: step.nlpName || 'Click On Element',
        nlpCategory: 'Browser Action',
        description: step.manualStepDescription,
        elementId: el?.id || step.elementId,
        elementName: el?.name || step.elementName,
        pageName: aiPage.name,
        elementMode: 'Static',
        elementVersion: 1,
        locator: primaryLoc,
        parameters: step.inputParameters || {},
        isEnabled: true
      });
    });

    // 6. Update session record
    session.generatedScriptId = script.id;
    session.stage = 'Script Pushed to TestDev';
    this.db.saveAIAutomationSession(session);

    // 7. Notify renderer that repository elements and scripts changed
    this.emitEvent('repository:elementChanged', { action: 'created', projectId });

    return {
      success: true,
      scriptId: script.id
    };
  }

  // =========================================================================
  // REPOSITORY HELPERS (Section 9)
  // =========================================================================

  private ensureAIElementsPage(projectId: string): RepositoryPage {
    const pages = this.db.getRepositoryPages(projectId);
    const existing = pages.find(p => p.name.toLowerCase() === 'ai elements');
    if (existing) return existing;

    return this.db.createRepositoryPage(projectId, 'AI Elements');
  }

  private findUrlInSteps(steps: AIManualTestCaseStep[]): string | null {
    for (const s of steps) {
      const match = (s.input + ' ' + s.stepDescription).match(/https?:\/\/[^\s]+/i);
      if (match) return match[0];
    }
    return null;
  }
}
