import React, { useState, useEffect } from 'react';
import {
  FileText,
  Upload,
  FileSpreadsheet,
  FileCode,
  File,
  Eye,
  Trash2,
  PlayCircle,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FolderOpen,
  Send,
  X,
  FileCheck2
} from 'lucide-react';
import { api } from '../../../api/client';
import { Project, AIDocument, AIDocumentCategory } from '../../../api/types';

interface AIDocumentsSectionProps {
  project: Project;
  onNavigateToTestCases: (testCaseId?: string) => void;
  onNavigateToDevelopment: (testCaseId: string) => Promise<void> | void;
}

export const AIDocumentsSection: React.FC<AIDocumentsSectionProps> = ({
  project,
  onNavigateToTestCases,
  onNavigateToDevelopment
}) => {
  const [documents, setDocuments] = useState<AIDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Preview Modal
  const [previewDoc, setPreviewDoc] = useState<AIDocument | null>(null);

  // Workflow B Prompt Modal
  const [promptDoc, setPromptDoc] = useState<AIDocument | null>(null);
  const [userPrompt, setUserPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, [project.id]);

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const res = await api.aiAutoTesting.getDocuments(project.id);
      if (res.success && res.documents) {
        setDocuments(res.documents);
      }
    } catch (e: any) {
      console.error('Failed to load documents:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAndUpload = async () => {
    setMessage(null);
    try {
      const fileRes = await api.aiAutoTesting.selectFile();
      if (fileRes.canceled || !fileRes.filePath) return;

      setIsUploading(true);
      const res = await api.aiAutoTesting.uploadDocument(project.id, fileRes.filePath);
      if (res.success && res.document) {
        setMessage({
          type: 'success',
          text: `Document "${res.document.fileName}" uploaded and classified as: ${res.document.detectedCategory}.`
        });
        await loadDocuments();
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to process document.' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCategoryChange = async (docId: string, newCat: AIDocumentCategory) => {
    try {
      await api.aiAutoTesting.updateDocumentCategory(docId, project.id, newCat);
      setDocuments(prev =>
        prev.map(d => (d.id === docId ? { ...d, userCategory: newCat } : d))
      );
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm('Are you sure you want to remove this document?')) return;
    try {
      await api.aiAutoTesting.deleteDocument(docId, project.id);
      await loadDocuments();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    }
  };

  // Workflow A: Manual Test Cases upload -> automatic extraction & development start
  const handleWorkflowA = async (doc: AIDocument) => {
    setMessage(null);
    try {
      const res = await api.aiAutoTesting.extractTestCasesFromDoc(doc.id, project.id);
      if (res.success && res.testCase) {
        // Automatically start development session (Section 5 - Workflow A)
        await onNavigateToDevelopment(res.testCase.id);
      } else {
        setMessage({ type: 'error', text: res.error || 'Could not extract test cases from document.' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    }
  };

  // Workflow B: BRD upload -> prompt modal -> SLM generates test cases -> User review
  const handleWorkflowBPromptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptDoc || !userPrompt.trim()) return;

    setIsGenerating(true);
    setMessage(null);
    try {
      const res = await api.aiAutoTesting.generateTestCasesFromBRD(
        promptDoc.id,
        userPrompt.trim(),
        project.id
      );
      if (res.success && res.testCase) {
        setPromptDoc(null);
        setUserPrompt('');
        onNavigateToTestCases(res.testCase.id);
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to generate test cases from BRD.' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'xlsx':
      case 'xls':
      case 'csv':
        return <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
      case 'pdf':
        return <FileText className="w-5 h-5 text-rose-400" />;
      case 'docx':
        return <FileText className="w-5 h-5 text-blue-400" />;
      case 'md':
      case 'txt':
        return <FileCode className="w-5 h-5 text-amber-400" />;
      default:
        return <File className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-brand-400" />
            <span>Application Requirements & Test Case Documents</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Upload your application specification, BRD, or manual test case spreadsheets (PDF, DOCX, XLSX, TXT, MD). The local SLM classifies the document and drives either automatic execution (Workflow A) or guided flow generation (Workflow B).
          </p>
        </div>

        <button
          onClick={handleSelectAndUpload}
          disabled={isUploading}
          className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white flex items-center gap-2 shadow-sm transition-colors shrink-0"
        >
          {isUploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          <span>Upload Document</span>
        </button>
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
            message.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
              : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Documents Table */}
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Uploaded Documents ({documents.length})
          </h3>
          <span className="text-[11px] text-slate-500">Project: {project.name}</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-500 text-xs">Loading documents...</div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <FolderOpen className="w-10 h-10 mx-auto text-slate-600" />
            <p className="text-sm font-semibold text-slate-300">No application documents uploaded yet</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Upload a Manual Test Cases sheet or a Business Requirement Document (BRD) to start generating Playwright automation scripts.
            </p>
            <button
              onClick={handleSelectAndUpload}
              className="mt-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl inline-flex items-center gap-2"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Select File</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {documents.map(doc => {
              const effectiveCategory = doc.userCategory || doc.detectedCategory;
              const isManualTC = effectiveCategory === 'Manual Test Cases';

              return (
                <div key={doc.id} className="p-4 hover:bg-slate-900/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 shrink-0">
                      {getFileIcon(doc.fileType)}
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs font-bold text-white truncate max-w-md">{doc.fileName}</h4>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 uppercase">
                          {doc.fileType}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {(doc.fileSize / 1024).toFixed(1)} KB
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-slate-400">Classification:</span>
                        <select
                          value={effectiveCategory}
                          onChange={e => handleCategoryChange(doc.id, e.target.value as any)}
                          className="bg-slate-950 border border-slate-800 text-[11px] text-brand-300 rounded-lg px-2 py-0.5 focus:border-brand-500"
                        >
                          <option value="Manual Test Cases">Manual Test Cases (Workflow A)</option>
                          <option value="BRD / Requirement Document">BRD / Requirement Document (Workflow B)</option>
                          <option value="Application Flow / Workflow Description">Application Flow / Workflow Description</option>
                          <option value="Other / Unsupported Document">Other / Unsupported</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
                    <button
                      onClick={() => setPreviewDoc(doc)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1.5 transition-colors"
                      title="Preview Extracted Content"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-400" />
                      <span>Preview</span>
                    </button>

                    {isManualTC ? (
                      <button
                        onClick={() => handleWorkflowA(doc)}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-sm transition-colors"
                      >
                        <PlayCircle className="w-3.5 h-3.5" />
                        <span>Auto-Develop Automation</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setPromptDoc(doc);
                          setUserPrompt(`Automate user flow described in ${doc.fileName}`);
                        }}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white flex items-center gap-1.5 shadow-sm transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-brand-200" />
                        <span>Generate Automation Flow</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                      title="Remove Document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl animate-scaleUp">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">{previewDoc.fileName}</h3>
                <p className="text-xs text-slate-400 mt-0.5">Extracted Document Preview ({previewDoc.metadata?.wordCount || 0} words)</p>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-950/60 m-4 rounded-xl border border-slate-800/80">
              {previewDoc.extractedContent}
            </div>
            <div className="p-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workflow B Prompt Modal (Section 5) */}
      {promptDoc && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl animate-scaleUp">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand-400" />
                  <span>Workflow B: Specify Application Flow to Automate</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Document: <span className="text-slate-200 font-semibold">{promptDoc.fileName}</span>
                </p>
              </div>
              <button
                onClick={() => setPromptDoc(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleWorkflowBPromptSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Describe the exact flow to automate:
                </label>
                <textarea
                  value={userPrompt}
                  onChange={e => setUserPrompt(e.target.value)}
                  rows={4}
                  placeholder="e.g. Automate the complete user login flow, search for product 'Watch', open product details, and verify 'Watches' is displayed."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 text-slate-100 text-xs leading-relaxed resize-none"
                  required
                />
                <p className="text-[11px] text-slate-500 mt-1.5">
                  The local SLM will analyze the uploaded requirement document alongside your prompt, generate 4-column manual test cases, and allow you to review/edit before browser automation begins.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPromptDoc(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGenerating || !userPrompt.trim()}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-sm transition-colors"
                >
                  {isGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Generate Test Cases (SLM)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
