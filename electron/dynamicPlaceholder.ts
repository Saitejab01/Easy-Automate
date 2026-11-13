/**
 * Easy Automate – Centralized Dynamic Placeholder Parser and Resolver
 *
 * Implements:
 * 1. Element-level Static vs Dynamic mode handling
 * 2. Independent placeholder numbering per repository element
 * 3. Gap-filling next-available-number logic
 * 4. Exact placeholder substitution without global curly-brace replacement
 * 5. Missing value validation and error reporting
 */

export const DYNAMIC_PLACEHOLDER_REGEX = /\{dynamic\s+value\s*(\d+)\}/gi;

/**
 * Normalizes placeholder to canonical `{dynamic value N}` format
 */
export function normalizePlaceholder(placeholder: string): string {
  const match = placeholder.match(/\{dynamic\s+value\s*(\d+)\}/i);
  if (match) {
    return `{dynamic value ${parseInt(match[1], 10)}}`;
  }
  return placeholder.trim();
}

/**
 * Checks whether a string is a recognized dynamic placeholder
 */
export function isDynamicPlaceholder(str: string): boolean {
  return /^\{dynamic\s+value\s*\d+\}$/i.test(str.trim());
}

/**
 * Extracts all recognized dynamic placeholders from a locator string in order of appearance
 * Deduplicates multiple occurrences while preserving order
 */
export function parseDynamicPlaceholders(locatorValue?: string): string[] {
  if (!locatorValue || typeof locatorValue !== 'string') return [];
  const regex = new RegExp(DYNAMIC_PLACEHOLDER_REGEX.source, 'gi');
  const seen = new Set<string>();
  const result: string[] = [];
  let m: RegExpExecArray | null;

  while ((m = regex.exec(locatorValue)) !== null) {
    const canonical = `{dynamic value ${parseInt(m[1], 10)}}`;
    if (!seen.has(canonical)) {
      seen.add(canonical);
      result.push(canonical);
    }
  }

  return result;
}

/**
 * Scans all locators of a Repository Element and returns all used placeholder numbers
 */
export function getUsedPlaceholderNumbers(
  locators: Array<{ value?: string; [key: string]: any }> = []
): number[] {
  const numbers = new Set<number>();
  for (const loc of locators) {
    if (!loc || !loc.value) continue;
    const regex = new RegExp(DYNAMIC_PLACEHOLDER_REGEX.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = regex.exec(loc.value)) !== null) {
      const num = parseInt(m[1], 10);
      if (!isNaN(num) && num > 0) {
        numbers.add(num);
      }
    }
  }
  return Array.from(numbers).sort((a, b) => a - b);
}

/**
 * Gap-filling logic: finds the smallest unused positive integer (1, 2, 3...)
 * E.g., if used = [1, 3], next is 2.
 * If used = [1, 2, 3], next is 4.
 * If used = [], next is 1.
 */
export function getNextAvailablePlaceholderNumber(
  locators: Array<{ value?: string; [key: string]: any }> = []
): number {
  const used = new Set(getUsedPlaceholderNumbers(locators));
  let candidate = 1;
  while (used.has(candidate)) {
    candidate++;
  }
  return candidate;
}

/**
 * Returns the next available canonical placeholder string for an element
 * E.g., `{dynamic value 2}`
 */
export function getNextAvailablePlaceholder(
  locators: Array<{ value?: string; [key: string]: any }> = []
): string {
  return `{dynamic value ${getNextAvailablePlaceholderNumber(locators)}}`;
}

/**
 * Validates dynamic placeholder inputs for an element and locator
 * If elementMode === 'Static', returns isValid = true (never requires substitution)
 */
export function validateDynamicPlaceholders(
  locatorValue: string,
  elementMode: 'Static' | 'Dynamic' = 'Static',
  dynamicValues: Record<string, string> = {}
): {
  isValid: boolean;
  requiredPlaceholders: string[];
  missingPlaceholders: string[];
  errorMessage?: string;
} {
  if (elementMode === 'Static') {
    return {
      isValid: true,
      requiredPlaceholders: [],
      missingPlaceholders: []
    };
  }

  const requiredPlaceholders = parseDynamicPlaceholders(locatorValue);
  const missingPlaceholders: string[] = [];

  for (const placeholder of requiredPlaceholders) {
    const rawNum = placeholder.match(/\d+/)?.[0] || '';
    const cleanKey = placeholder.replace(/^\{|\}$/g, '').trim();

    // Check various casing/spacing keys in dynamicValues map
    const val =
      dynamicValues[placeholder] ??
      dynamicValues[cleanKey] ??
      dynamicValues[`dynamic value ${rawNum}`] ??
      dynamicValues[`dynamic value${rawNum}`] ??
      dynamicValues[`dynamicValue${rawNum}`];

    if (val === undefined || val === null || String(val).trim() === '') {
      missingPlaceholders.push(placeholder);
    }
  }

  if (missingPlaceholders.length > 0) {
    return {
      isValid: false,
      requiredPlaceholders,
      missingPlaceholders,
      errorMessage: `Missing runtime value for ${missingPlaceholders.join(', ')}`
    };
  }

  return {
    isValid: true,
    requiredPlaceholders,
    missingPlaceholders: []
  };
}

/**
 * Resolves a locator by substituting ONLY recognized dynamic placeholders.
 * If elementMode === 'Static', the locator is returned verbatim (never substituted).
 */
export function resolveDynamicPlaceholders(
  locatorValue: string,
  elementMode: 'Static' | 'Dynamic' = 'Static',
  dynamicValues: Record<string, string> = {}
): {
  resolvedValue: string;
  originalValue: string;
  appliedReplacements: Record<string, string>;
} {
  if (!locatorValue) {
    return {
      resolvedValue: '',
      originalValue: '',
      appliedReplacements: {}
    };
  }

  // Rule 2.1 & 6.1: Static elements must never be substituted
  if (elementMode === 'Static') {
    return {
      resolvedValue: locatorValue,
      originalValue: locatorValue,
      appliedReplacements: {}
    };
  }

  const recognized = parseDynamicPlaceholders(locatorValue);
  if (recognized.length === 0) {
    return {
      resolvedValue: locatorValue,
      originalValue: locatorValue,
      appliedReplacements: {}
    };
  }

  let resolved = locatorValue;
  const appliedReplacements: Record<string, string> = {};

  for (const placeholder of recognized) {
    const rawNum = placeholder.match(/\d+/)?.[0] || '';
    const cleanKey = placeholder.replace(/^\{|\}$/g, '').trim();

    const val =
      dynamicValues[placeholder] ??
      dynamicValues[cleanKey] ??
      dynamicValues[`dynamic value ${rawNum}`] ??
      dynamicValues[`dynamic value${rawNum}`] ??
      dynamicValues[`dynamicValue${rawNum}`] ??
      '';

    appliedReplacements[placeholder] = String(val);

    // Exact replacement of recognized placeholder pattern only
    // Support variations with whitespace: {dynamic value N}, {dynamic value  N}, {dynamic valueN}
    const escapedPattern = `\\{dynamic\\s+value\\s*${rawNum}\\}`;
    resolved = resolved.replace(new RegExp(escapedPattern, 'gi'), String(val));
  }

  return {
    resolvedValue: resolved,
    originalValue: locatorValue,
    appliedReplacements
  };
}

