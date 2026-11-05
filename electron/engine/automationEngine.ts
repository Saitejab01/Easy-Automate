import os from 'os';
import * as XLSX from 'xlsx';

export interface AutomationContext {
  projectId: string;
  script: any;
  elements: any[];
  testDataFiles: any[];
  localVariables: any[];
  globalVariables: any[];
  runSettings: any;
}

export class AutomationEngine {
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
      const localVar = localVars.find(v => v.name === varName);
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
      const globalVar = globalVars.find(v => v.name === varName);
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
    if (locator.valueType === 'Dynamic' && dynamicValues) {
      for (const [k, v] of Object.entries(dynamicValues)) {
        val = val.replace(`{${k}}`, v);
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
      // Header not found in existing row, append column at end of header row
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
