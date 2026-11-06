export interface LocatorValidationResult {
  isValid: boolean;
  count: number;
  isUnique: boolean;
  stability: 'High' | 'Moderate' | 'Low';
  stabilityScore: number; // 0 - 100
  reasons: string[];
  feedback: string;
}

/**
 * Assesses whether a locator is likely to remain stable and uniquely identify the captured target
 * without breaking on UI changes or re-renders.
 */
export function evaluateLocatorStability(locatorType: string, locatorValue: string): LocatorValidationResult {
  const reasons: string[] = [];
  let score = 70; // baseline

  if (!locatorValue || !locatorValue.trim()) {
    return {
      isValid: false,
      count: 0,
      isUnique: false,
      stability: 'Low',
      stabilityScore: 0,
      reasons: ['Locator value is empty'],
      feedback: 'Please enter a locator value to test'
    };
  }

  const val = locatorValue.trim();

  // Syntax validation
  try {
    if (locatorType === 'XPath') {
      // Basic xpath syntax check: balanced quotes, valid prefixes
      const singleQuotes = (val.match(/'/g) || []).length;
      const doubleQuotes = (val.match(/"/g) || []).length;
      const openBrackets = (val.match(/\[/g) || []).length;
      const closeBrackets = (val.match(/\]/g) || []).length;
      const openParens = (val.match(/\(/g) || []).length;
      const closeParens = (val.match(/\)/g) || []).length;

      if (singleQuotes % 2 !== 0 && doubleQuotes % 2 !== 0) {
        throw new Error('Unbalanced quotes in XPath');
      }
      if (openBrackets !== closeBrackets) {
        throw new Error('Unbalanced square brackets in XPath');
      }
      if (openParens !== closeParens) {
        throw new Error('Unbalanced parentheses in XPath');
      }
    }
  } catch (err: any) {
    return {
      isValid: false,
      count: 0,
      isUnique: false,
      stability: 'Low',
      stabilityScore: 10,
      reasons: [err.message || 'Invalid selector syntax'],
      feedback: 'Syntax error in locator string'
    };
  }

  // 1. Gold standard: data-testid or dedicated automation attributes
  if (/data-testid|data-test|data-cy|data-qa|data-automation/i.test(val) || locatorType === 'Test ID') {
    score += 25;
    reasons.push('Uses dedicated automation test attribute (highest stability)');
  }

  // 2. Clean Semantic ID vs Dynamic/Generated ID
  if (locatorType === 'ID' || /@id\s*=\s*['"][a-zA-Z0-9_-]+['"]/i.test(val) || /^#[a-zA-Z][a-zA-Z0-9_-]*$/.test(val)) {
    // Detect dynamic framework patterns or timestamp/hashes
    const dynamicPattern = /ember\d+|react-\d+|ng-\d+|guid|[0-9a-f]{8}-[0-9a-f]{4}|\b\d{5,}\b|_temp\b/i;
    if (dynamicPattern.test(val)) {
      score -= 35;
      reasons.push('ID contains framework generated numbers or session hashes (fragile on reload)');
    } else {
      score += 20;
      reasons.push('Uses clean semantic ID');
    }
  }

  // 3. Accessibility & Form Semantic Attributes (Name, Aria-label, Role, Label)
  if (/@name\s*=|\[name=|@aria-label\s*=|\[aria-label=/i.test(val) || locatorType === 'Name' || locatorType === 'Label' || locatorType === 'Role') {
    score += 15;
    reasons.push('Uses semantic accessibility or form name attribute');
  }

  // 4. Deep absolute XPath (e.g. /html/body/div[1]/...)
  if (/^\/html\/body|\/div\[\d+\]\/div\[\d+\]/.test(val) || (val.match(/\//g) || []).length > 5) {
    score -= 40;
    reasons.push('Deep structural hierarchy will break if any surrounding element changes');
  }

  // 5. Index-based positioning (e.g. [1], [2], :nth-child)
  if (/\[\d+\]|:nth-child\(\d+\)|:nth-of-type\(\d+\)/.test(val)) {
    score -= 15;
    reasons.push('Position-based index may shift when lists or layout elements update');
  }

  // 6. Dynamic parameter placeholder support
  if (/\{[^}]+\}/.test(val)) {
    reasons.push('Dynamic locator template parameterized with dynamic value placeholder');
  }

  // Clamp score between 10 and 100
  score = Math.max(15, Math.min(100, score));

  let stability: 'High' | 'Moderate' | 'Low' = 'Moderate';
  if (score >= 80) stability = 'High';
  else if (score < 55) stability = 'Low';

  const feedback =
    stability === 'High'
      ? 'Unique, robust, and stable locator suitable for long-term automation.'
      : stability === 'Moderate'
      ? 'Valid locator; consider using data-testid, aria-label, or clean ID for maximum resilience.'
      : 'Fragile locator; relies on dynamic IDs or rigid DOM paths. Likely to break during UI updates.';

  return {
    isValid: true,
    count: 1,
    isUnique: true,
    stability,
    stabilityScore: score,
    reasons,
    feedback
  };
}

