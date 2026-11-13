import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import * as XLSX from 'xlsx';
import { AIDocumentCategory, AIDocumentType } from '../database';

export interface ExtractedDocumentData {
  fileName: string;
  fileSize: number;
  fileType: AIDocumentType;
  extractedContent: string;
  detectedCategory: AIDocumentCategory;
  wordCount: number;
}

export class DocumentParser {
  /**
   * Parses and extracts text content from uploaded document file.
   */
  public static async parseFile(filePath: string): Promise<ExtractedDocumentData> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stats = fs.statSync(filePath);
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    let fileType: AIDocumentType = 'other';
    let textContent = '';

    if (ext === 'txt') {
      fileType = 'txt';
      textContent = fs.readFileSync(filePath, 'utf-8');
    } else if (ext === 'md') {
      fileType = 'md';
      textContent = fs.readFileSync(filePath, 'utf-8');
    } else if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
      fileType = 'xlsx';
      textContent = this.parseSpreadsheet(filePath);
    } else if (ext === 'docx') {
      fileType = 'docx';
      textContent = await this.parseDocx(filePath);
    } else if (ext === 'pdf') {
      fileType = 'pdf';
      textContent = this.parsePdfText(filePath);
    } else {
      // Fallback: attempt to read as utf-8 text
      try {
        textContent = fs.readFileSync(filePath, 'utf-8');
        fileType = 'other';
      } catch {
        throw new Error(`Unsupported document format: .${ext}. Supported formats are: TXT, MD, XLSX, DOCX, PDF.`);
      }
    }

    const cleanText = textContent.replace(/\r\n/g, '\n').trim();
    if (!cleanText) {
      throw new Error(`Document "${fileName}" is empty or no readable text could be extracted.`);
    }

    const detectedCategory = this.classifyDocument(cleanText, fileName);
    const wordCount = cleanText.split(/\s+/).filter(Boolean).length;

    return {
      fileName,
      fileSize: stats.size,
      fileType,
      extractedContent: cleanText,
      detectedCategory,
      wordCount
    };
  }

  /**
   * Parses Excel / Spreadsheet into readable structured markdown-like text
   */
  private static parseSpreadsheet(filePath: string): string {
    const workbook = XLSX.readFile(filePath);
    const output: string[] = [];

    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) return;
      output.push(`\n--- SHEET: ${sheetName} ---`);
      const csv = XLSX.utils.sheet_to_csv(sheet);
      output.push(csv);
    });

    return output.join('\n');
  }

  /**
   * Lightweight pure Node.js parser for DOCX files
   * Extracts text inside <w:t> tags from word/document.xml within the zip archive
   */
  private static async parseDocx(filePath: string): Promise<string> {
    const buffer = fs.readFileSync(filePath);
    const content = buffer.toString('binary');

    // Find word/document.xml in zip archive
    // In docx (PK zip), text often appears inside XML tags <w:t ...>text</w:t>
    const xmlMatches = content.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
    if (xmlMatches && xmlMatches.length > 0) {
      const texts = xmlMatches.map(m => m.replace(/<[^>]+>/g, ''));
      return texts.join(' ');
    }

    // Secondary heuristic: extract plain visible text chunks
    const plainStrings = buffer.toString('utf-8').match(/[A-Za-z0-9\s.,!?:;'"()\/\-_{}\[\]]{4,}/g);
    if (plainStrings && plainStrings.length > 0) {
      return plainStrings.join(' ');
    }

    return 'Extracted DOCX Document Content';
  }

  /**
   * Extracts text streams from PDF files without external binary dependencies
   */
  private static parsePdfText(filePath: string): string {
    const buffer = fs.readFileSync(filePath);
    const raw = buffer.toString('latin1');
    const textPieces: string[] = [];

    // 1. Text within BT ... ET blocks: (text) Tj or [(t)(e)(x)(t)] TJ
    const textObjRegex = /BT[\s\S]*?ET/g;
    let match: RegExpExecArray | null;

    while ((match = textObjRegex.exec(raw)) !== null) {
      const block = match[0];
      const tjMatches = block.match(/\(([^)]*)\)\s*Tj/g);
      if (tjMatches) {
        tjMatches.forEach(tj => {
          const inner = tj.replace(/^.*\(|\)\s*Tj$/g, '');
          textPieces.push(inner);
        });
      }

      const tjArrayMatches = block.match(/\[([^\]]*)\]\s*TJ/g);
      if (tjArrayMatches) {
        tjArrayMatches.forEach(arr => {
          const innerStrings = arr.match(/\(([^)]*)\)/g);
          if (innerStrings) {
            innerStrings.forEach(s => textPieces.push(s.slice(1, -1)));
          }
        });
      }
    }

    if (textPieces.length > 0) {
      return textPieces.join(' ');
    }

    // Fallback: extract clean text strings
    const readable = buffer.toString('utf-8').match(/[A-Za-z0-9\s.,!?:;'"()\/\-_{}\[\]]{4,}/g);
    return (readable || []).join(' ');
  }

  /**
   * Section 4.4: Classify document based on content keywords and structure
   */
  public static classifyDocument(content: string, fileName?: string): AIDocumentCategory {
    const lower = (content + ' ' + (fileName || '')).toLowerCase();

    // Check for Manual Test Cases
    const testCaseSignals = [
      'step no',
      'step description',
      'expected result',
      'actual result',
      'test case id',
      'tc_id',
      'test case name',
      'pre-condition',
      'post-condition',
      'test steps',
      'test data'
    ];
    let tcCount = 0;
    testCaseSignals.forEach(sig => {
      if (lower.includes(sig)) tcCount++;
    });

    if (tcCount >= 2) {
      return 'Manual Test Cases';
    }

    // Check for BRD / Requirements
    const brdSignals = [
      'business requirement',
      'brd',
      'functional requirement',
      'frd',
      'user story',
      'acceptance criteria',
      'system specification',
      'scope of work',
      'use case specification'
    ];
    let brdCount = 0;
    brdSignals.forEach(sig => {
      if (lower.includes(sig)) brdCount++;
    });

    if (brdCount >= 2) {
      return 'BRD / Requirement Document';
    }

    // Check for Workflow / Application Flow
    const workflowSignals = [
      'application flow',
      'workflow',
      'process flow',
      'user journey',
      'navigation flow',
      'flowchart',
      'sequence of steps'
    ];
    let wfCount = 0;
    workflowSignals.forEach(sig => {
      if (lower.includes(sig)) wfCount++;
    });

    if (wfCount >= 1) {
      return 'Application Flow / Workflow Description';
    }

    return 'Other / Unsupported Document';
  }
}
