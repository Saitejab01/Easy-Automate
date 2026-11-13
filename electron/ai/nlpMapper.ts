import { AIManualTestCaseStep } from '../database';

export interface MappedNLPStep {
  nlpId: string;
  nlpName: string;
  requiresElement: boolean;
  elementHint?: string;
  inputParameters: Record<string, any>;
  verificationNlpId?: string;
  verificationNlpName?: string;
  verificationParameters?: Record<string, any>;
  confidence: number;
}

export class NLPMapper {
  /**
   * Section 8: Maps an accepted manual test step to a predefined NLP.
   */
  public static mapStepToNLP(step: AIManualTestCaseStep, applicationUrl?: string): MappedNLPStep {
    const desc = (step.stepDescription || '').toLowerCase();
    const inputVal = (step.input || '').trim();
    const expected = (step.expectedResult || '').toLowerCase();

    // 1. Navigation / Browser open
    if (desc.includes('open browser') || desc.includes('launch browser')) {
      return {
        nlpId: 'open_browser',
        nlpName: 'Open Browser',
        requiresElement: false,
        inputParameters: { browser: inputVal || 'Chromium' },
        confidence: 0.98
      };
    }

    if (
      desc.includes('maximize browser') ||
      desc.includes('maximize window') ||
      (desc.includes('maximize') && (desc.includes('browser') || desc.includes('window') || desc.includes('screen')))
    ) {
      return {
        nlpId: 'maximize_browser',
        nlpName: 'Maximize Browser',
        requiresElement: false,
        inputParameters: {},
        confidence: 0.98
      };
    }

    const urlPattern = /(https?:\/\/[^\s]+|www\.[^\s]+)/i;
    if (
      urlPattern.test(desc) ||
      urlPattern.test(inputVal) ||
      desc.includes('navigate to') ||
      desc.includes('open url') ||
      desc.includes('go to url') ||
      desc.includes('open the application') ||
      desc.includes('launch application') ||
      desc.includes('open website')
    ) {
      const url = this.extractUrl(desc) || this.extractUrl(inputVal) || applicationUrl || 'https://demo.easyautomate.dev';
      return {
        nlpId: 'navigate_to_url',
        nlpName: 'Navigate To URL',
        requiresElement: false,
        inputParameters: { url },
        confidence: 0.98
      };
    }

    // 2. Typing / Entering text
    if (
      desc.includes('enter') ||
      desc.includes('type') ||
      desc.includes('fill') ||
      desc.includes('input') ||
      desc.includes('provide') ||
      desc.includes('set text')
    ) {
      const fieldHint = this.extractFieldHint(desc, 'enter');
      return {
        nlpId: 'enter_text',
        nlpName: 'Enter Text',
        requiresElement: true,
        elementHint: fieldHint,
        inputParameters: {
          text: inputVal || 'test_input'
        },
        confidence: 0.92
      };
    }

    // 3. Clear text
    if (desc.includes('clear') && (desc.includes('field') || desc.includes('text') || desc.includes('box'))) {
      const fieldHint = this.extractFieldHint(desc, 'clear');
      return {
        nlpId: 'clear_text',
        nlpName: 'Clear Text',
        requiresElement: true,
        elementHint: fieldHint,
        inputParameters: {},
        confidence: 0.90
      };
    }

    // 4. Double click
    if (desc.includes('double click') || desc.includes('double-click')) {
      const fieldHint = this.extractFieldHint(desc, 'double click');
      return {
        nlpId: 'double_click_element',
        nlpName: 'Double Click On Element',
        requiresElement: true,
        elementHint: fieldHint,
        inputParameters: {},
        confidence: 0.92
      };
    }

    // 5. Right click
    if (desc.includes('right click') || desc.includes('right-click') || desc.includes('context menu')) {
      const fieldHint = this.extractFieldHint(desc, 'right click');
      return {
        nlpId: 'right_click_element',
        nlpName: 'Right Click On Element',
        requiresElement: true,
        elementHint: fieldHint,
        inputParameters: {},
        confidence: 0.92
      };
    }

    // 6. Hover
    if (desc.includes('hover') || desc.includes('mouse over') || desc.includes('move to')) {
      const fieldHint = this.extractFieldHint(desc, 'hover');
      return {
        nlpId: 'hover_element',
        nlpName: 'Hover Over Element',
        requiresElement: true,
        elementHint: fieldHint,
        inputParameters: {},
        confidence: 0.90
      };
    }

    // 7. Click / Press
    if (
      desc.includes('click') ||
      desc.includes('press') ||
      desc.includes('tap') ||
      desc.includes('hit') ||
      desc.includes('submit')
    ) {
      const fieldHint = this.extractFieldHint(desc, 'click');
      return {
        nlpId: 'click_element',
        nlpName: 'Click On Element',
        requiresElement: true,
        elementHint: fieldHint,
        inputParameters: { clickCount: 1 },
        confidence: 0.95
      };
    }

    // 8. Select dropdown option
    if (desc.includes('select') && (desc.includes('dropdown') || desc.includes('option') || desc.includes('from list'))) {
      const fieldHint = this.extractFieldHint(desc, 'select');
      return {
        nlpId: 'select_dropdown_option',
        nlpName: 'Select Dropdown Option',
        requiresElement: true,
        elementHint: fieldHint,
        inputParameters: { optionText: inputVal || 'Option' },
        confidence: 0.90
      };
    }

    // 9. Checkbox
    if (desc.includes('uncheck') || (desc.includes('deselect') && desc.includes('checkbox'))) {
      const fieldHint = this.extractFieldHint(desc, 'uncheck');
      return {
        nlpId: 'unselect_checkbox',
        nlpName: 'Unselect Checkbox',
        requiresElement: true,
        elementHint: fieldHint,
        inputParameters: {},
        confidence: 0.92
      };
    }

    if (desc.includes('check') || (desc.includes('select') && desc.includes('checkbox'))) {
      const fieldHint = this.extractFieldHint(desc, 'check');
      return {
        nlpId: 'select_checkbox',
        nlpName: 'Select Checkbox',
        requiresElement: true,
        elementHint: fieldHint,
        inputParameters: {},
        confidence: 0.92
      };
    }

    // 10. Wait condition
    if (desc.includes('wait') && (desc.includes('visible') || desc.includes('appear'))) {
      const fieldHint = this.extractFieldHint(desc, 'wait');
      return {
        nlpId: 'wait_for_element_to_be_visible',
        nlpName: 'Wait For Element To Be Visible',
        requiresElement: true,
        elementHint: fieldHint,
        inputParameters: { timeoutMs: 8000 },
        confidence: 0.90
      };
    }

    // 11. Scroll
    if (desc.includes('scroll to') || desc.includes('scroll down to')) {
      const fieldHint = this.extractFieldHint(desc, 'scroll to');
      return {
        nlpId: 'scroll_to_element',
        nlpName: 'Scroll To Element',
        requiresElement: true,
        elementHint: fieldHint,
        inputParameters: {},
        confidence: 0.88
      };
    }

    // 12. Verification steps
    if (
      desc.includes('verify') ||
      desc.includes('assert') ||
      desc.includes('check that') ||
      desc.includes('validate')
    ) {
      const expectedText = this.extractExpectedVerificationText(step);
      const fieldHint = this.extractFieldHint(desc, 'verify');

      if (desc.includes('text') || desc.includes('message') || desc.includes('contains') || expectedText) {
        return {
          nlpId: 'verify_text',
          nlpName: 'Verify Text',
          requiresElement: true,
          elementHint: fieldHint || expectedText,
          inputParameters: { expectedText: expectedText || 'Success' },
          confidence: 0.92
        };
      }

      return {
        nlpId: 'verify_element_displayed',
        nlpName: 'Verify Element Displayed',
        requiresElement: true,
        elementHint: fieldHint,
        inputParameters: {},
        confidence: 0.90
      };
    }

    // Fallback: If Expected Result indicates a verification
    if (expected.includes('displayed') || expected.includes('visible')) {
      const expectedText = this.extractExpectedVerificationText(step);
      const fieldHint = this.extractFieldHint(desc, '');
      if (expectedText && (desc.includes('text') || desc.includes('message'))) {
        return {
          nlpId: 'verify_text',
          nlpName: 'Verify Text',
          requiresElement: true,
          elementHint: fieldHint || expectedText,
          inputParameters: { expectedText },
          confidence: 0.88
        };
      }
      return {
        nlpId: 'verify_element_displayed',
        nlpName: 'Verify Element Displayed',
        requiresElement: true,
        elementHint: fieldHint,
        inputParameters: {},
        confidence: 0.80
      };
    }

    // Default general click / interact fallback
    return {
      nlpId: 'click_element',
      nlpName: 'Click On Element',
      requiresElement: true,
      elementHint: this.extractFieldHint(desc, ''),
      inputParameters: { clickCount: 1 },
      confidence: 0.70
    };
  }

  /**
   * Cleans text to extract the element purpose/name (e.g. "enter username in username field" -> "Username Field")
   */
  private static extractFieldHint(desc: string, actionKeyword: string): string {
    let clean = desc;
    if (actionKeyword) {
      const idx = clean.indexOf(actionKeyword);
      if (idx !== -1) {
        clean = clean.slice(idx + actionKeyword.length);
      }
    }

    clean = clean
      .replace(/\b(the|a|an|in|on|into|to|from|for|at|button|field|input|box|dropdown|checkbox|link)\b/gi, ' ')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!clean) return 'Target Element';

    // Capitalize words
    return clean
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .slice(0, 4)
      .join(' ');
  }

  private static extractUrl(text: string): string | null {
    if (!text) return null;
    const match = text.match(/https?:\/\/[^\s]+/i);
    if (match) return match[0];
    const plainDomain = text.match(/(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?/i);
    if (plainDomain) return `https://${plainDomain[0]}`;
    return null;
  }

  /**
   * Intelligently cleans verification text by stripping boilerplate phrases and UI element nouns
   * e.g. "Verify Shopper Login Text should be displayed" -> "Shopper Login"
   */
  public static cleanVerificationText(raw: string): string {
    if (!raw) return '';

    let text = raw.trim();

    // Check for explicit quotes: "Shopper Login" or 'Shopper Login'
    const quotedMatch = text.match(/["']([^"']+)["']/);
    if (quotedMatch && quotedMatch[1].trim()) {
      return quotedMatch[1].trim();
    }

    // Strip leading verification verbs and phrases
    text = text.replace(/^(verify|assert|validate|check that|check|ensure|confirm)\s+/i, '');

    // Strip leading "that" or "if" or "the"
    text = text.replace(/^(that|if|the|a|an)\s+/i, '');

    // Strip trailing assertion outcomes
    text = text.replace(
      /\s+(should\s+be\s+(displayed|visible|present|shown|entered|launched|maximized)|is\s+(displayed|visible|present|shown)|should\s+appear|appears|should\s+be\s+navigated)$/i,
      ''
    );

    // Strip trailing UI nouns
    text = text.replace(/\s+(text|header|heading|title|message|label|button|page|link|box|field)$/i, '');

    // Strip any remaining leading/trailing punctuation or whitespace
    text = text.replace(/^[^\w\s]+|[^\w\s]+$/g, '').trim();

    return text;
  }

  /**
   * Intelligently extracts the exact expected text to verify from a manual test step
   */
  public static extractExpectedVerificationText(step: {
    input?: string;
    stepDescription?: string;
    expectedResult?: string;
  }): string {
    const inputVal = (step.input || '').trim();
    // If input contains meaningful text (not N/A, optional, etc.)
    if (inputVal && !/^(n\/?a|none|null|optional(\s+input)?|false|true)$/i.test(inputVal)) {
      return this.cleanVerificationText(inputVal);
    }

    // Try description first if it has quotes
    const desc = (step.stepDescription || '').trim();
    const quotedInDesc = desc.match(/["']([^"']+)["']/);
    if (quotedInDesc && quotedInDesc[1].trim()) {
      return quotedInDesc[1].trim();
    }

    // Try expected result if it has quotes
    const exp = (step.expectedResult || '').trim();
    const quotedInExp = exp.match(/["']([^"']+)["']/);
    if (quotedInExp && quotedInExp[1].trim()) {
      return quotedInExp[1].trim();
    }

    // Clean description
    const cleanedDesc = this.cleanVerificationText(desc);
    if (cleanedDesc && cleanedDesc.length > 1) {
      return cleanedDesc;
    }

    // Clean expected result
    const cleanedExp = this.cleanVerificationText(exp);
    if (cleanedExp && cleanedExp.length > 1) {
      return cleanedExp;
    }

    return cleanedDesc || cleanedExp || '';
  }
}
