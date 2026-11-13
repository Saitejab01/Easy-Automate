import { BrowserWindow } from 'electron';
import * as crypto from 'crypto';
import {
  JsonDatabase,
  AIModelConfiguration,
  RepositoryElement,
  Locator,
  ElementType,
  ElementFingerprint,
  ElementIdentificationStatus,
  ElementIdentificationTelemetry
} from '../database';
import { AIModelService } from './aiModelService';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ElementIdentificationTarget {
  stepDescription: string;
  elementName?: string;
  elementType?: ElementType;
  expectedText?: string;
  actionIntent?: string; // 'click_element' | 'enter_text' | 'clear_text' | 'verify_text' | 'verify_element_displayed' | ...
  elementId?: string;
  pageId?: string;
  projectId?: string;
  elementMode?: 'Static' | 'Dynamic';
  configuredLocators?: Locator[];
  candidateContainerText?: string;
  manualInput?: string;
  manualExpectedResult?: string;
}

export interface CandidateEvaluation {
  locator: { type: Locator['type']; value: string };
  matchCount: number;
  pwLocator?: any;
  isVisible: boolean;
  isEnabled: boolean;
  boundingBox?: BoundingBox;
  tagName: string;
  elementType: ElementType;
  accessibleRole?: string;
  accessibleName?: string;
  visibleText?: string;
  attributes: Record<string, string>;
  isIntentConsistent: boolean;
  isContradictory: boolean;
  containerInfo?: {
    tag?: string;
    text?: string;
    className?: string;
  };
  relationshipType?: string;
  confidence: number;
  rejectionReason?: string;
}

export interface VisualAiResult {
  element_found: boolean;
  element_description?: string;
  element_type?: string;
  visible_text?: string;
  coordinates?: { x: number; y: number };
  bounding_box?: BoundingBox;
  confidence?: number;
  reason?: string;
  screenshotBase64?: string;
}

export interface ElementIdentificationResult {
  status: ElementIdentificationStatus;
  elementId?: string;
  locatorId?: string;
  locatorStrategy?: string;
  locatorValue?: string;
  matchCount?: number;
  confidence?: number;
  visualVerified: boolean;
  fingerprintVerified: boolean;
  boundingBox?: BoundingBox;
  failureReason?: string;
  telemetry: ElementIdentificationTelemetry;
  resolvedLocator?: any;
}

export interface ConfidenceWeights {
  accessibleNameMatch: number; // 25%
  elementTypeMatch: number;    // 15%
  textAttributeMatch: number;  // 20%
  domRelationshipMatch: number;// 20%
  visualBboxMatch: number;     // 20%
}

export const DEFAULT_CONFIDENCE_WEIGHTS: ConfidenceWeights = {
  accessibleNameMatch: 0.25,
  elementTypeMatch: 0.15,
  textAttributeMatch: 0.20,
  domRelationshipMatch: 0.20,
  visualBboxMatch: 0.20
};

export class HybridElementIdentificationService {
  private db: JsonDatabase;
  private modelService: AIModelService;
  private weights: ConfidenceWeights = { ...DEFAULT_CONFIDENCE_WEIGHTS };
  private mainWindow: BrowserWindow | null = null;

  // In-memory cache for stable page states
  private pageIdentificationCache: Map<string, {
    url: string;
    timestamp: number;
    result: ElementIdentificationResult;
  }> = new Map();
  private lastKnownUrl: string = '';
  private lastPageInstance: any = null;

  constructor(db: JsonDatabase, modelService: AIModelService) {
    this.db = db;
    this.modelService = modelService;
  }

  public setMainWindow(win: BrowserWindow | null) {
    this.mainWindow = win;
  }

  public setWeights(customWeights: Partial<ConfidenceWeights>) {
    this.weights = { ...this.weights, ...customWeights };
  }

  /**
   * Section 9: Invalidate cache upon navigation or significant layout changes
   */
  public invalidateCache(reason?: string) {
    this.pageIdentificationCache.clear();
  }

  /**
   * Calculates Intersection over Union (IoU) between two bounding boxes
   */
  public static calculateIoU(boxA: BoundingBox, boxB: BoundingBox): number {
    const xA = Math.max(boxA.x, boxB.x);
    const yA = Math.max(boxA.y, boxB.y);
    const xB = Math.min(boxA.x + boxA.width, boxB.x + boxB.width);
    const yB = Math.min(boxA.y + boxA.height, boxB.y + boxB.height);

    const interW = Math.max(0, xB - xA);
    const interH = Math.max(0, yB - yA);
    const interArea = interW * interH;

    const boxAArea = boxA.width * boxA.height;
    const boxBArea = boxB.width * boxB.height;
    const unionArea = boxAArea + boxBArea - interArea;

    if (unionArea <= 0) return 0;
    return interArea / unionArea;
  }

  /**
   * Checks if two bounding boxes visually correspond (IoU threshold or center containment)
   */
  public static isBoundingBoxMatch(boxA: BoundingBox, boxB: BoundingBox, iouThreshold: number = 0.35): boolean {
    const iou = HybridElementIdentificationService.calculateIoU(boxA, boxB);
    if (iou >= iouThreshold) return true;

    // Center containment check with proximity tolerance
    const centerA = { x: boxA.x + boxA.width / 2, y: boxA.y + boxA.height / 2 };
    const insideB =
      centerA.x >= boxB.x - 20 &&
      centerA.x <= boxB.x + boxB.width + 20 &&
      centerA.y >= boxB.y - 20 &&
      centerA.y <= boxB.y + boxB.height + 20;

    const areaRatio = (boxA.width * boxA.height) / (boxB.width * boxB.height || 1);
    if (insideB && areaRatio >= 0.25 && areaRatio <= 4.0) {
      return true;
    }
    return false;
  }

  /**
   * Main Entry Point: Identifies and verifies the target element through the 4-layer pipeline.
   */
  public async identifyAndVerifyElement(
    page: any,
    target: ElementIdentificationTarget,
    modelConfig?: AIModelConfiguration
  ): Promise<ElementIdentificationResult> {
    const startTime = Date.now();
    let currentUrl = '';
    try {
      if (page && (typeof page.isClosed !== 'function' || !page.isClosed())) {
        const rawUrl = typeof page.url === 'function' ? page.url() : '';
        currentUrl = typeof rawUrl?.then === 'function' ? await rawUrl : (rawUrl || '');
      }
    } catch {
      currentUrl = '';
    }

    // Cache management: check for page URL change or page instance change
    if ((this.lastKnownUrl && this.lastKnownUrl !== currentUrl) || (this.lastPageInstance && this.lastPageInstance !== page)) {
      this.invalidateCache('Navigation or page instance changed');
    }
    this.lastKnownUrl = currentUrl;
    this.lastPageInstance = page;

    // =========================================================================
    // STEP 0: Check Persistent Element Fingerprint (Section 8)
    // =========================================================================
    if (target.elementId) {
      const fingerprint = this.db.getElementFingerprint(target.elementId);
      if (fingerprint && fingerprint.validationStatus !== 'REJECTED') {
        const fpResult = await this.verifyFingerprintReuse(page, fingerprint, target);
        if (fpResult && fpResult.isValid) {
          const telemetry: ElementIdentificationTelemetry = {
            manualTestCaseId: (target as any).testCaseId,
            stepNumber: (target as any).stepNumber,
            requestedElement: target.elementName || target.stepDescription,
            elementMode: target.elementMode || 'Static',
            strategyUsed: 'FINGERPRINT_REUSE',
            domAnalysisResult: 'Passed',
            contextAnalysisResult: 'Not Applicable',
            visualAiInvoked: false,
            fingerprintValidationResult: 'Passed',
            finalSelectedLocator: { type: fingerprint.locatorStrategy, value: fingerprint.locatorValue },
            confidenceScore: fingerprint.confidence || 0.95,
            status: 'IDENTIFIED',
            totalIdentificationTimeMs: Date.now() - startTime,
            retryCount: 0
          };

          await this.highlightDomElement(fpResult.pwLocator);
          telemetry.highlightVerificationResult = 'Passed';

          const result: ElementIdentificationResult = {
            status: 'IDENTIFIED',
            elementId: target.elementId,
            locatorId: fingerprint.locatorId,
            locatorStrategy: fingerprint.locatorStrategy,
            locatorValue: fingerprint.locatorValue,
            matchCount: 1,
            confidence: fingerprint.confidence || 0.95,
            visualVerified: false,
            fingerprintVerified: true,
            boundingBox: fpResult.boundingBox,
            telemetry,
            resolvedLocator: fpResult.pwLocator
          };

          return result;
        }
      }
    }

    const cacheKey = `${currentUrl}::${target.elementId || target.elementName || target.stepDescription}`;
    if (this.pageIdentificationCache.has(cacheKey)) {
      const cached = this.pageIdentificationCache.get(cacheKey)!;
      // Cached within 10s and on same page
      if (Date.now() - cached.timestamp < 10000 && cached.url === currentUrl) {
        return cached.result;
      }
    }

    const telemetry: ElementIdentificationTelemetry = {
      manualTestCaseId: (target as any).testCaseId,
      stepNumber: (target as any).stepNumber,
      requestedElement: target.elementName || target.stepDescription,
      elementMode: target.elementMode || 'Static',
      strategyUsed: 'DOM_ACCESSIBILITY',
      domAnalysisResult: 'Pending',
      contextAnalysisResult: 'Not Applicable',
      visualAiInvoked: false,
      status: 'NOT_FOUND',
      retryCount: 0
    };

    // =========================================================================
    // LAYER 1: DOM + Accessibility Tree Analysis (Section 3)
    // =========================================================================
    const layer1Candidates = await this.analyzeDomAndAccessibility(page, target);
    telemetry.candidateLocators = layer1Candidates.map(c => ({
      type: c.locator.type,
      value: c.locator.value,
      matchCount: c.matchCount,
      isValid: c.isIntentConsistent && !c.isContradictory && c.matchCount === 1,
      reason: c.rejectionReason
    }));

    // Find candidate that uniquely identifies the intended element
    const validLayer1 = layer1Candidates.filter(
      c => c.matchCount === 1 && c.isVisible && c.isIntentConsistent && !c.isContradictory && c.confidence >= 0.8
    );

    // Group valid candidates by underlying DOM element identity
    const uniqueElements = new Map<string, CandidateEvaluation>();
    for (const cand of validLayer1) {
      const elKey = cand.attributes.id
        ? `id_${cand.attributes.id}`
        : `${cand.tagName}::${cand.accessibleName || cand.visibleText}::${cand.boundingBox?.x || 0}_${cand.boundingBox?.y || 0}`;
      if (!uniqueElements.has(elKey) || cand.confidence > uniqueElements.get(elKey)!.confidence) {
        uniqueElements.set(elKey, cand);
      }
    }

    if (uniqueElements.size === 1) {
      const topCand = Array.from(uniqueElements.values())[0];
      telemetry.domAnalysisResult = 'Passed';
      telemetry.strategyUsed = 'DOM_ACCESSIBILITY';
      telemetry.confidenceScore = topCand.confidence;
      telemetry.finalSelectedLocator = { type: topCand.locator.type, value: topCand.locator.value };
      telemetry.status = 'IDENTIFIED';
      telemetry.boundingBoxComparisonResult = {
        domBbox: topCand.boundingBox,
        matched: true
      };

      // Perform DOM highlight verification (Section 6.3)
      await this.highlightDomElement(topCand.pwLocator);
      telemetry.highlightVerificationResult = 'Passed';

      // Save fingerprint for persistent reuse (Section 8)
      if (target.elementId) {
        this.saveElementFingerprint(target, topCand, 'IDENTIFIED');
      }

      telemetry.totalIdentificationTimeMs = Date.now() - startTime;
      const result: ElementIdentificationResult = {
        status: 'IDENTIFIED',
        elementId: target.elementId,
        locatorStrategy: topCand.locator.type,
        locatorValue: topCand.locator.value,
        matchCount: 1,
        confidence: topCand.confidence,
        visualVerified: false,
        fingerprintVerified: false,
        boundingBox: topCand.boundingBox,
        telemetry,
        resolvedLocator: topCand.pwLocator
      };

      this.pageIdentificationCache.set(cacheKey, { url: currentUrl, timestamp: Date.now(), result });
      return result;
    }

    telemetry.domAnalysisResult = validLayer1.length > 1 ? 'Ambiguous' : layer1Candidates.some(c => c.isContradictory) ? 'Mismatch' : 'Ambiguous';

    // =========================================================================
    // LAYER 2: DOM Context and Relationship Analysis (Section 4)
    // =========================================================================
    telemetry.contextAnalysisResult = 'Pending';
    const contextCandidate = await this.analyzeDomContextAndRelationships(page, target, layer1Candidates);

    if (contextCandidate && contextCandidate.matchCount === 1 && contextCandidate.isIntentConsistent && contextCandidate.confidence >= 0.8) {
      telemetry.contextAnalysisResult = 'Passed';
      telemetry.strategyUsed = 'DOM_CONTEXT';
      telemetry.confidenceScore = contextCandidate.confidence;
      telemetry.finalSelectedLocator = { type: contextCandidate.locator.type, value: contextCandidate.locator.value };
      telemetry.status = 'IDENTIFIED';
      telemetry.boundingBoxComparisonResult = {
        domBbox: contextCandidate.boundingBox,
        matched: true
      };

      await this.highlightDomElement(contextCandidate.pwLocator);
      telemetry.highlightVerificationResult = 'Passed';

      if (target.elementId) {
        this.saveElementFingerprint(target, contextCandidate, 'IDENTIFIED');
      }

      telemetry.totalIdentificationTimeMs = Date.now() - startTime;
      const result: ElementIdentificationResult = {
        status: 'IDENTIFIED',
        elementId: target.elementId,
        locatorStrategy: contextCandidate.locator.type,
        locatorValue: contextCandidate.locator.value,
        matchCount: 1,
        confidence: contextCandidate.confidence,
        visualVerified: false,
        fingerprintVerified: false,
        boundingBox: contextCandidate.boundingBox,
        telemetry,
        resolvedLocator: contextCandidate.pwLocator
      };

      this.pageIdentificationCache.set(cacheKey, { url: currentUrl, timestamp: Date.now(), result });
      return result;
    }

    telemetry.contextAnalysisResult = 'Ambiguous';

    // =========================================================================
    // LAYER 3 & 4: Visual AI Identification and Coordinate Validation (Sections 5 & 6)
    // Invoked ONLY when DOM & Context analysis are ambiguous or uncertain!
    // =========================================================================
    telemetry.visualAiInvoked = true;
    telemetry.strategyUsed = 'VISUAL_AI';

    const activeModel = modelConfig || this.db.getDefaultAIModelConfiguration();
    const visualStart = Date.now();
    const visualResult = await this.performVisualAiIdentification(page, target, activeModel);
    telemetry.modelResponseTimeMs = Date.now() - visualStart;

    if (!visualResult || !visualResult.element_found || !visualResult.bounding_box) {
      telemetry.status = 'NOT_FOUND';
      telemetry.failureReason = visualResult?.reason || 'Visual AI could not identify target element on page screenshot.';
      telemetry.totalIdentificationTimeMs = Date.now() - startTime;

      return {
        status: 'NOT_FOUND',
        elementId: target.elementId,
        matchCount: 0,
        confidence: 0,
        visualVerified: false,
        fingerprintVerified: false,
        failureReason: telemetry.failureReason,
        telemetry
      };
    }

    telemetry.visualAiConfidence = visualResult.confidence;

    // Layer 4: Coordinate and Fingerprint Validation
    const verifiedCandidate = await this.validateCoordinateAndFingerprint(
      page,
      visualResult,
      [...(contextCandidate ? [contextCandidate] : []), ...layer1Candidates],
      target
    );

    if (verifiedCandidate && verifiedCandidate.confidence >= 0.75) {
      telemetry.status = 'VISUAL_VERIFIED';
      telemetry.confidenceScore = verifiedCandidate.confidence;
      telemetry.finalSelectedLocator = { type: verifiedCandidate.locator.type, value: verifiedCandidate.locator.value };
      telemetry.boundingBoxComparisonResult = {
        visualBbox: visualResult.bounding_box,
        domBbox: verifiedCandidate.boundingBox,
        iou: verifiedCandidate.boundingBox && visualResult.bounding_box
          ? HybridElementIdentificationService.calculateIoU(visualResult.bounding_box, verifiedCandidate.boundingBox)
          : 0,
        matched: true
      };

      await this.highlightDomElement(verifiedCandidate.pwLocator);
      telemetry.highlightVerificationResult = 'Passed';

      if (target.elementId) {
        this.saveElementFingerprint(target, verifiedCandidate, 'VISUAL_VERIFIED');
      }

      telemetry.totalIdentificationTimeMs = Date.now() - startTime;
      const result: ElementIdentificationResult = {
        status: 'VISUAL_VERIFIED',
        elementId: target.elementId,
        locatorStrategy: verifiedCandidate.locator.type,
        locatorValue: verifiedCandidate.locator.value,
        matchCount: 1,
        confidence: verifiedCandidate.confidence,
        visualVerified: true,
        fingerprintVerified: false,
        boundingBox: verifiedCandidate.boundingBox,
        telemetry,
        resolvedLocator: verifiedCandidate.pwLocator
      };

      this.pageIdentificationCache.set(cacheKey, { url: currentUrl, timestamp: Date.now(), result });
      return result;
    }

    // Failed validation
    telemetry.status = 'REJECTED';
    telemetry.failureReason = 'Element failed visual bounding box / semantic identity validation.';
    telemetry.totalIdentificationTimeMs = Date.now() - startTime;

    return {
      status: 'REJECTED',
      elementId: target.elementId,
      matchCount: verifiedCandidate?.matchCount || 0,
      confidence: verifiedCandidate?.confidence || 0,
      visualVerified: false,
      fingerprintVerified: false,
      failureReason: telemetry.failureReason,
      telemetry
    };
  }

  // =========================================================================
  // Layer 1 Implementation
  // =========================================================================
  private async analyzeDomAndAccessibility(
    page: any,
    target: ElementIdentificationTarget
  ): Promise<CandidateEvaluation[]> {
    if (!page || page.isClosed()) return [];

    const candidates: CandidateEvaluation[] = [];
    const cleanName = (target.elementName || this.extractElementKeyword(target.stepDescription)).trim();
    const action = (target.actionIntent || '').toLowerCase();

    // 1. Generate semantic Playwright locator candidates
    const candidateLocators: Array<{ type: Locator['type']; value: string; strategy: string }> = [];

    // Semantic roles based on action or target type
    const role = this.determineAccessibleRole(target);
    if (role && cleanName) {
      candidateLocators.push({
        type: 'Role',
        value: `getByRole('${role}', { name: '${cleanName}' })`,
        strategy: 'role'
      });
      if (role === 'searchbox') {
        candidateLocators.push({
          type: 'Role',
          value: `getByRole('textbox', { name: '${cleanName}' })`,
          strategy: 'role'
        });
        candidateLocators.push({
          type: 'Role',
          value: `getByRole('searchbox')`,
          strategy: 'role'
        });
      }
    }

    if (cleanName) {
      candidateLocators.push({
        type: 'Label',
        value: cleanName,
        strategy: 'label'
      });
      candidateLocators.push({
        type: 'Placeholder',
        value: cleanName,
        strategy: 'placeholder'
      });
      candidateLocators.push({
        type: 'Test ID',
        value: cleanName.toLowerCase().replace(/\s+/g, '-'),
        strategy: 'testid'
      });
      candidateLocators.push({
        type: 'CSS Selector',
        value: `[alt="${cleanName}"], img[alt="${cleanName}"]`,
        strategy: 'alt'
      });
      candidateLocators.push({
        type: 'CSS Selector',
        value: `[title="${cleanName}"]`,
        strategy: 'title'
      });
      candidateLocators.push({
        type: 'Text',
        value: cleanName,
        strategy: 'text'
      });

      // Split into keywords for broader matching on real apps (e.g. "Search Bar" -> "Search")
      const keywords = cleanName.split(/\s+/).filter(w => w.length > 2 && !['the', 'and', 'bar', 'btn', 'for'].includes(w.toLowerCase()));
      for (const kw of keywords) {
        if (kw.toLowerCase() !== cleanName.toLowerCase()) {
          candidateLocators.push({ type: 'Label', value: kw, strategy: 'label' });
          candidateLocators.push({ type: 'Placeholder', value: kw, strategy: 'placeholder' });
          candidateLocators.push({ type: 'CSS Selector', value: `[title="${kw}"]`, strategy: 'title' });
        }
      }
    }

    // Include configured locators from repository/target
    if (target.configuredLocators && Array.isArray(target.configuredLocators)) {
      for (const loc of target.configuredLocators) {
        if (loc.type && loc.value && !candidateLocators.some(c => c.value === loc.value)) {
          candidateLocators.push({ type: loc.type, value: loc.value, strategy: 'configured' });
        }
      }
    }

    // 2. Evaluate candidates in Playwright DOM
    const seenLocators = new Set<string>();
    for (const cand of candidateLocators) {
      const key = `${cand.type}::${cand.value}`;
      if (seenLocators.has(key)) continue;
      seenLocators.add(key);

      try {
        const pwLoc = this.createPlaywrightLocator(page, cand.type, cand.value);
        const count = await pwLoc.count().catch(() => 0);

        if (count === 0) continue;

        // Note: Section 3.2 says do NOT use first() to hide multiple matches.
        // We only evaluate single match or record multiple match count accurately.
        const firstLoc = pwLoc.first();
        const isVisible = await firstLoc.isVisible().catch(() => false);
        const isEnabled = await firstLoc.isEnabled().catch(() => true);

        const props = await firstLoc.evaluate((el: HTMLElement) => {
          return {
            tagName: el.tagName.toLowerCase(),
            type: (el as HTMLInputElement).type || '',
            accessibleRole: el.getAttribute('role') || el.tagName.toLowerCase(),
            accessibleName: (el.getAttribute('aria-label') || el.title || el.innerText || el.textContent || '').trim(),
            visibleText: (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' '),
            id: el.id || '',
            name: el.getAttribute('name') || '',
            testId: el.getAttribute('data-testid') || el.getAttribute('data-test') || '',
            containerTag: el.parentElement?.tagName.toLowerCase() || '',
            containerClass: el.parentElement?.className || '',
            containerText: (el.parentElement?.innerText || '').slice(0, 100)
          };
        }).catch(() => null);

        if (!props) continue;

        const boundingBox = await firstLoc.boundingBox().catch(() => null);

        // Intent Consistency Check
        const isIntentConsistent = this.checkIntentConsistency(action, props.tagName, props.type, target.stepDescription, cleanName);
        const isContradictory = this.checkContradictorySemantic(cleanName, props.accessibleName, props.visibleText);

        // Section 7 Critical Mismatch Check:
        // An incorrect element type or contradictory name must immediately cause rejection (confidence = 0)
        let confidence = 0.2;
        if (!isIntentConsistent || isContradictory) {
          confidence = 0; // Immediate critical rejection
        } else {
          const reqName = cleanName.toLowerCase();
          const accName = (props.accessibleName || '').toLowerCase();
          const visText = (props.visibleText || '').toLowerCase();

          if (reqName && accName === reqName) {
            confidence += 0.35; // Exact accessible name match (25-35%)
          } else if (reqName && accName.includes(reqName)) {
            confidence += 0.25;
          }

          if (reqName && (visText === reqName || visText.includes(reqName))) {
            confidence += 0.25; // Visible text match (20-25%)
          }

          const expectedRole = this.determineAccessibleRole(target);
          if (expectedRole && (props.accessibleRole === expectedRole || props.tagName === expectedRole)) {
            confidence += 0.15; // Semantic role match (15%)
          }

          if (count === 1) confidence += 0.15; // Unique match
          if (count > 1) confidence -= 0.35;  // Ambiguity penalty
          if (isVisible) confidence += 0.1;   // Visibility check
        }

        confidence = Math.max(0, Math.min(1, confidence));

        let rejectionReason: string | undefined;
        if (count > 1) rejectionReason = `Matches ${count} duplicate elements (ambiguous)`;
        else if (!isIntentConsistent) rejectionReason = `Element tag <${props.tagName}> incompatible with action intent "${action}"`;
        else if (isContradictory) rejectionReason = `Contradictory element semantic: found "${props.accessibleName}" for requested "${cleanName}"`;

        candidates.push({
          locator: { type: cand.type, value: cand.value },
          matchCount: count,
          pwLocator: pwLoc,
          isVisible,
          isEnabled,
          boundingBox: boundingBox || undefined,
          tagName: props.tagName,
          elementType: this.mapTagToElementType(props.tagName, props.type),
          accessibleRole: props.accessibleRole,
          accessibleName: props.accessibleName,
          visibleText: props.visibleText,
          attributes: {
            id: props.id,
            name: props.name,
            testId: props.testId
          },
          isIntentConsistent,
          isContradictory,
          containerInfo: {
            tag: props.containerTag,
            className: props.containerClass,
            text: props.containerText
          },
          confidence,
          rejectionReason
        });
      } catch (err) {
        // Skip invalid locator syntax
      }
    }

    return candidates;
  }

  // =========================================================================
  // Layer 2 Implementation
  // =========================================================================
  private async analyzeDomContextAndRelationships(
    page: any,
    target: ElementIdentificationTarget,
    candidates: CandidateEvaluation[]
  ): Promise<CandidateEvaluation | null> {
    if (!page || page.isClosed()) return null;

    const desc = target.stepDescription;
    const cleanName = target.elementName || this.extractElementKeyword(desc);

    // Context Pattern 1: Container to Descendant (e.g. "Add the iPhone 17 to the cart")
    // Identify container clue (e.g. product name, item title)
    const containerClue = target.candidateContainerText || this.extractContainerClue(desc, cleanName);

    if (containerClue) {
      // Scoped Playwright locator: container containing containerClue, scoping descendant action
      const containerLocators = [
        page.locator('.product-card, .card, [data-testid*="product"], [data-testid*="item"], tr, li, div')
          .filter({ hasText: containerClue })
      ];

      for (const container of containerLocators) {
        try {
          const containerCount = await container.count().catch(() => 0);
          if (containerCount >= 1) {
            // Find action within container
            const role = this.determineAccessibleRole(target);
            const scopedAction = role && cleanName
              ? container.first().getByRole(role, { name: cleanName })
              : container.first().locator(`button:has-text("${cleanName}"), a:has-text("${cleanName}")`);

            const matchCount = await scopedAction.count().catch(() => 0);
            if (matchCount === 1 && (await scopedAction.isVisible().catch(() => false))) {
              const bbox = await scopedAction.boundingBox().catch(() => null);
              const props = await scopedAction.evaluate((el: HTMLElement) => ({
                tagName: el.tagName.toLowerCase(),
                type: (el as HTMLInputElement).type || '',
                accessibleName: (el.getAttribute('aria-label') || el.innerText || '').trim(),
                visibleText: (el.innerText || '').trim()
              })).catch(() => null);

              if (props) {
                const isIntentConsistent = this.checkIntentConsistency(target.actionIntent || '', props.tagName, props.type);
                if (isIntentConsistent) {
                  return {
                    locator: {
                      type: 'CSS Selector',
                      value: `.product-card:has-text("${containerClue}") >> ${role === 'button' ? 'button' : '*'}:has-text("${cleanName}")`
                    },
                    matchCount: 1,
                    pwLocator: scopedAction,
                    isVisible: true,
                    isEnabled: true,
                    boundingBox: bbox || undefined,
                    tagName: props.tagName,
                    elementType: this.mapTagToElementType(props.tagName, props.type),
                    accessibleName: props.accessibleName,
                    visibleText: props.visibleText,
                    attributes: {},
                    isIntentConsistent: true,
                    isContradictory: false,
                    relationshipType: 'Container to Descendant (Card -> Button)',
                    confidence: 0.92
                  };
                }
              }
            }
          }
        } catch {}
      }
    }

    // Context Pattern 2: Form Container Scoping (e.g. Login button in modal/form vs header)
    if (desc.toLowerCase().includes('login') || desc.toLowerCase().includes('form')) {
      try {
        const formScoped = page.locator('form, [role="dialog"], .modal, .login-container')
          .getByRole('button', { name: /login|sign in|submit/i });

        const count = await formScoped.count().catch(() => 0);
        if (count === 1 && (await formScoped.isVisible().catch(() => false))) {
          const bbox = await formScoped.boundingBox().catch(() => null);
          return {
            locator: { type: 'CSS Selector', value: `form >> button:has-text("${cleanName || 'Login'}")` },
            matchCount: 1,
            pwLocator: formScoped,
            isVisible: true,
            isEnabled: true,
            boundingBox: bbox || undefined,
            tagName: 'button',
            elementType: 'Button',
            accessibleName: cleanName || 'Login',
            attributes: {},
            isIntentConsistent: true,
            isContradictory: false,
            relationshipType: 'Form Scoped Action',
            confidence: 0.88
          };
        }
      } catch {}
    }

    return null;
  }

  // =========================================================================
  // Layer 3 Implementation: Visual AI Identification
  // =========================================================================
  private async performVisualAiIdentification(
    page: any,
    target: ElementIdentificationTarget,
    modelConfig?: AIModelConfiguration | null
  ): Promise<VisualAiResult | null> {
    if (!page || page.isClosed()) return null;

    try {
      // 1. Wait for page stability
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(300);

      // 2. Capture screenshot of current viewport
      const screenshotBuffer = await page.screenshot({ type: 'png', fullPage: false });
      const screenshotBase64 = screenshotBuffer.toString('base64');

      const viewport = page.viewportSize() || { width: 1280, height: 720 };
      const dsf = await page.evaluate(() => window.devicePixelRatio || 1).catch(() => 1);

      if (!modelConfig) {
        // Fallback: Model not configured, safe graceful stop
        return {
          element_found: false,
          reason: 'No local SLM / Vision model configured for visual identification.',
          screenshotBase64
        };
      }

      // 3. Call local SLM Vision model
      const prompt = `Current Test Step: "${target.stepDescription}"
Expected Action: "${target.actionIntent || 'interaction'}"
Viewport Dimensions: ${viewport.width}x${viewport.height} (DPR: ${dsf})`;

      const visionResponse = await this.modelService.identifyElementWithVision(
        modelConfig,
        prompt,
        screenshotBase64,
        {
          stepDescription: target.stepDescription,
          elementName: target.elementName,
          elementType: target.elementType
        }
      );

      if (!visionResponse || !visionResponse.element_found) {
        return {
          element_found: false,
          reason: visionResponse?.reason || 'Visual AI could not identify element on screen.',
          screenshotBase64
        };
      }

      // Convert / validate coordinates in viewport
      let bbox = visionResponse.bounding_box;
      if (!bbox && visionResponse.coordinates) {
        // Synthesize bounding box around center coordinates
        bbox = {
          x: Math.max(0, visionResponse.coordinates.x - 40),
          y: Math.max(0, visionResponse.coordinates.y - 20),
          width: 80,
          height: 40
        };
      }

      return {
        element_found: true,
        element_description: visionResponse.element_description,
        element_type: visionResponse.element_type,
        visible_text: visionResponse.visible_text,
        coordinates: visionResponse.coordinates,
        bounding_box: bbox,
        confidence: visionResponse.confidence || 0.85,
        reason: visionResponse.reason,
        screenshotBase64
      };
    } catch (err: any) {
      console.warn('[Visual AI] Error capturing screenshot or querying vision model:', err.message);
      return null;
    }
  }

  // =========================================================================
  // Layer 4 Implementation: Coordinate & Fingerprint Validation
  // =========================================================================
  private async validateCoordinateAndFingerprint(
    page: any,
    visualResult: VisualAiResult,
    candidates: CandidateEvaluation[],
    target: ElementIdentificationTarget
  ): Promise<CandidateEvaluation | null> {
    if (!visualResult.bounding_box) return null;

    const visualBox = visualResult.bounding_box;
    let bestCandidate: CandidateEvaluation | null = null;
    let highestScore = 0;

    for (const cand of candidates) {
      if (!cand.boundingBox) {
        try {
          cand.boundingBox = await cand.pwLocator.boundingBox();
        } catch {}
      }

      if (!cand.boundingBox) continue;

      // 1. Visual Bounding Box IoU & Match
      const iou = HybridElementIdentificationService.calculateIoU(visualBox, cand.boundingBox);
      const isBoxMatch = HybridElementIdentificationService.isBoundingBoxMatch(visualBox, cand.boundingBox);

      if (!isBoxMatch && iou < 0.2) {
        continue; // Visually unrelated candidate rejected
      }

      // 2. Critical Mismatch Checks
      if (cand.isContradictory || !cand.isIntentConsistent) {
        continue; // Critical semantic mismatch rejected
      }

      // 3. Calculate Weighted Confidence Score incorporating Visual AI verification
      let score = 0;
      // Visual AI model confidence contribution (up to 40%)
      const visualConf = visualResult.confidence || 0.85;
      score += visualConf * 0.4;

      // Visual Bounding Box IoU / Match (up to 25%)
      if (isBoxMatch || iou >= 0.35) {
        score += 0.25;
      } else {
        score += Math.max(0, iou) * 0.25;
      }

      // Element Type Intent Consistency (up to 15%)
      if (cand.isIntentConsistent) {
        score += this.weights.elementTypeMatch;
      }

      // Accessible Name / Semantic Match (up to 10%)
      const nameMatch = cand.accessibleName && target.elementName &&
        cand.accessibleName.toLowerCase().includes(target.elementName.toLowerCase());
      if (nameMatch) {
        score += 0.10;
      } else if (!cand.accessibleName && visualResult.element_description) {
        // If element lacks accessible name (e.g. icon/svg), Visual AI verified description
        score += 0.08;
      }

      // Text / Attribute Match (up to 10%)
      if (cand.visibleText && visualResult.visible_text &&
          cand.visibleText.toLowerCase().includes(visualResult.visible_text.toLowerCase())) {
        score += 0.10;
      } else if (cand.visibleText) {
        score += 0.05;
      } else {
        // Icon / SVG element without visible text
        score += 0.05;
      }

      const totalConfidence = Math.min(0.99, Number(score.toFixed(2)));

      if (totalConfidence > highestScore) {
        highestScore = totalConfidence;
        bestCandidate = {
          ...cand,
          confidence: totalConfidence
        };
      }
    }

    return bestCandidate;
  }

  // =========================================================================
  // DOM Highlighting Verification (Section 6.3)
  // =========================================================================
  private async highlightDomElement(pwLocator: any): Promise<void> {
    if (!pwLocator) return;
    try {
      await pwLocator.first().evaluate((el: HTMLElement) => {
        el.setAttribute('data-ea-highlight', 'true');
        const prevOutline = el.style.outline;
        const prevShadow = el.style.boxShadow;
        el.style.outline = '3px solid #10b981';
        el.style.boxShadow = '0 0 14px rgba(16, 185, 129, 0.8)';

        // Remove highlight after brief verification window
        setTimeout(() => {
          el.removeAttribute('data-ea-highlight');
          el.style.outline = prevOutline;
          el.style.boxShadow = prevShadow;
        }, 1200);
      }).catch(() => {});
    } catch {}
  }

  // =========================================================================
  // Fingerprinting & Persistent Reuse (Section 8)
  // =========================================================================
  private saveElementFingerprint(
    target: ElementIdentificationTarget,
    candidate: CandidateEvaluation,
    status: ElementIdentificationStatus
  ): ElementFingerprint {
    const fingerprint: ElementFingerprint = {
      id: `fp_${target.elementId || crypto.randomUUID().slice(0, 8)}`,
      projectId: target.projectId || 'unassigned',
      elementId: target.elementId!,
      pageId: target.pageId,
      urlPattern: this.lastKnownUrl,
      tagName: candidate.tagName,
      accessibleRole: candidate.accessibleRole,
      accessibleName: candidate.accessibleName,
      visibleText: candidate.visibleText,
      attributes: candidate.attributes,
      parentContext: {
        containerTag: candidate.containerInfo?.tag,
        containerClass: candidate.containerInfo?.className,
        containerText: candidate.containerInfo?.text,
        relationship: candidate.relationshipType
      },
      domRelationship: candidate.relationshipType,
      locatorStrategy: candidate.locator.type,
      locatorValue: candidate.locator.value,
      lastVerifiedBoundingBox: candidate.boundingBox,
      lastVerifiedTimestamp: new Date().toISOString(),
      validationStatus: status,
      confidence: candidate.confidence,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return this.db.saveElementFingerprint(fingerprint);
  }

  private async verifyFingerprintReuse(
    page: any,
    fingerprint: ElementFingerprint,
    target: ElementIdentificationTarget
  ): Promise<{ isValid: boolean; pwLocator?: any; boundingBox?: BoundingBox } | null> {
    if (!page || page.isClosed()) return null;

    try {
      const pwLoc = this.createPlaywrightLocator(page, fingerprint.locatorStrategy as Locator['type'], fingerprint.locatorValue);
      const count = await pwLoc.count().catch(() => 0);

      // Must be strictly unique (1 of 1)
      if (count !== 1) {
        this.db.invalidateElementFingerprint(fingerprint.elementId, `Locator match count is ${count} (expected 1)`);
        return null;
      }

      const isVisible = await pwLoc.first().isVisible().catch(() => false);
      if (!isVisible) {
        this.db.invalidateElementFingerprint(fingerprint.elementId, 'Element is not visible in DOM');
        return null;
      }

      const props = await pwLoc.first().evaluate((el: HTMLElement) => ({
        tagName: el.tagName.toLowerCase(),
        accessibleRole: el.getAttribute('role') || el.tagName.toLowerCase(),
        accessibleName: (el.getAttribute('aria-label') || el.innerText || '').trim(),
        visibleText: (el.innerText || '').trim()
      })).catch(() => null);

      if (!props) return null;

      // Identity check: tag, accessible role, or name must match stored fingerprint
      const isTagMatch = props.tagName === fingerprint.tagName.toLowerCase();
      const isRoleMatch = !fingerprint.accessibleRole || props.accessibleRole === fingerprint.accessibleRole;

      if (!isTagMatch || !isRoleMatch) {
        // Fingerprint invalidated due to UI/DOM change
        this.db.invalidateElementFingerprint(fingerprint.elementId, 'DOM properties changed');
        return null;
      }

      const bbox = await pwLoc.first().boundingBox().catch(() => null);
      return {
        isValid: true,
        pwLocator: pwLoc,
        boundingBox: bbox || undefined
      };
    } catch {
      return null;
    }
  }

  // =========================================================================
  // Helpers & Utility Methods
  // =========================================================================
  private createPlaywrightLocator(page: any, type: Locator['type'], value: string): any {
    switch (type) {
      case 'Role': {
        const match = value.match(/getByRole\(['"]([^'"]+)['"](?:,\s*\{\s*name:\s*['"]([^'"]+)['"]\s*\})?/);
        if (match) {
          const role = match[1];
          const name = match[2];
          return name ? page.getByRole(role, { name, exact: false }) : page.getByRole(role);
        }
        return page.locator(`[role="${value}"]`);
      }
      case 'Label':
        return page.getByLabel(value);
      case 'Placeholder':
        return page.getByPlaceholder(value);
      case 'Test ID':
        return page.getByTestId(value);
      case 'Text':
        return page.getByText(value, { exact: false });
      case 'ID':
        return page.locator(`#${value}`);
      case 'Name':
        return page.locator(`[name="${value}"]`);
      case 'CSS Selector':
        return page.locator(value);
      case 'XPath':
        return page.locator(value.startsWith('xpath=') ? value : `xpath=${value}`);
      default:
        return page.locator(value);
    }
  }

  private determineAccessibleRole(target: ElementIdentificationTarget): string | undefined {
    const action = (target.actionIntent || '').toLowerCase();
    const type = target.elementType;
    const desc = (target.stepDescription || '').toLowerCase();
    const elName = (target.elementName || '').toLowerCase();
    const combined = `${desc} ${elName}`;

    // Search bar / input
    if (
      combined.includes('search bar') ||
      combined.includes('search box') ||
      combined.includes('search input') ||
      (combined.includes('search') && (combined.includes('input') || combined.includes('bar') || combined.includes('box')))
    ) {
      return 'searchbox';
    }

    if (action.includes('enter') || action.includes('type') || action.includes('fill') || type === 'Input Field' || combined.includes('input') || combined.includes('textbox') || combined.includes('field')) {
      return 'textbox';
    }
    if (action.includes('check') || type === 'Checkbox' || combined.includes('checkbox')) {
      return 'checkbox';
    }
    if (action.includes('select') || type === 'Dropdown / Select' || combined.includes('dropdown')) {
      return 'combobox';
    }
    if (type === 'Link' || combined.includes('link')) {
      return 'link';
    }
    if (type === 'Button' || action.includes('click') || combined.includes('button')) {
      return 'button';
    }
    if (combined.includes('heading') || combined.includes('title')) {
      return 'heading';
    }
    return undefined;
  }

  private checkIntentConsistency(
    action: string,
    tagName: string,
    inputType: string,
    stepDesc: string = '',
    elementName: string = ''
  ): boolean {
    const act = (action || '').toLowerCase();
    const tag = (tagName || '').toLowerCase();
    const type = (inputType || '').toLowerCase();
    const fullDesc = `${stepDesc} ${elementName}`.toLowerCase();

    if (act.includes('enter') || act.includes('type') || act.includes('clear')) {
      // Must be input, textarea or select
      return tag === 'input' || tag === 'textarea' || tag === 'select';
    }

    if (act.includes('click')) {
      // If clicking, text inputs are allowed IF the step explicitly targets an input, search bar, or text box
      const isInputTarget =
        fullDesc.includes('search') ||
        fullDesc.includes('bar') ||
        fullDesc.includes('input') ||
        fullDesc.includes('field') ||
        fullDesc.includes('box') ||
        fullDesc.includes('textbox') ||
        fullDesc.includes('textarea') ||
        fullDesc.includes('query');

      if (tag === 'input' && !['button', 'submit', 'reset', 'image', 'checkbox', 'radio'].includes(type)) {
        return isInputTarget;
      }
      return true;
    }

    if (act.includes('check')) {
      return tag === 'input' && (type === 'checkbox' || type === 'radio');
    }

    return true;
  }

  private checkContradictorySemantic(requested: string, accessibleName: string, visibleText: string): boolean {
    const req = (requested || '').toLowerCase();
    const acc = (accessibleName || '').toLowerCase();
    const vis = (visibleText || '').toLowerCase();

    // Contradictory rules from Section 3.2
    if (req.includes('setting') && (acc.includes('create account') || vis.includes('create account'))) {
      return true;
    }
    if (req.includes('login') && (acc.includes('sign up') || acc.includes('register') || vis.includes('sign up'))) {
      return true;
    }
    if (req.includes('sign in') && (acc.includes('sign out') || acc.includes('logout') || vis.includes('sign out'))) {
      return true;
    }
    if (req.includes('search') && (acc.includes('clear') || vis.includes('clear search'))) {
      return true;
    }
    if ((req.includes('cart') || req.includes('buy')) && (acc.includes('remove') || acc.includes('delete') || vis.includes('remove'))) {
      return true;
    }
    if (req.includes('next') && (acc.includes('previous') || vis.includes('previous'))) {
      return true;
    }
    return false;
  }

  private mapTagToElementType(tag: string, inputType: string): ElementType {
    const t = tag.toLowerCase();
    const it = inputType.toLowerCase();

    if (t === 'button' || (t === 'input' && ['submit', 'button', 'reset'].includes(it))) return 'Button';
    if (t === 'input' && it === 'checkbox') return 'Checkbox';
    if (t === 'input' && it === 'radio') return 'Radio Button';
    if (t === 'input' || t === 'textarea') return 'Input Field';
    if (t === 'select') return 'Dropdown / Select';
    if (t === 'a') return 'Link';
    if (/^h[1-6]$/.test(t) || t === 'p' || t === 'span' || t === 'label') return 'Text / Label';
    return 'Custom';
  }

  private extractElementKeyword(stepDescription: string): string {
    let clean = (stepDescription || '')
      .replace(/^click (on|the)?/i, '')
      .replace(/^enter (text into|into)?/i, '')
      .replace(/^verify (that)?/i, '')
      .replace(/button$/i, '')
      .replace(/link$/i, '')
      .replace(/field$/i, '')
      .trim();

    const quoted = stepDescription.match(/["']([^"']+)["']/);
    if (quoted) return quoted[1].trim();

    return clean || 'Element';
  }

  private extractContainerClue(desc: string, elementName: string): string | null {
    // Look for phrases like "for <Item>", "in <Section>", "Add <Product> to"
    const addMatch = desc.match(/add (?:the )?([^to]+) to (?:the )?cart/i);
    if (addMatch && addMatch[1]) return addMatch[1].trim();

    const forMatch = desc.match(/for (?:the )?([a-zA-Z0-9\s]+) (?:click|select|enter)/i);
    if (forMatch && forMatch[1]) return forMatch[1].trim();

    const inMatch = desc.match(/in (?:the )?([a-zA-Z0-9\s]+) (?:section|card|row)/i);
    if (inMatch && inMatch[1]) return inMatch[1].trim();

    return null;
  }
}
