import React, { useState, useEffect } from 'react';
import {
  Table,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertCircle,
  PlayCircle,
  Save,
  RotateCcw,
  Sparkles,
  FileCheck2,
  Calendar,
  Layers,
  X,
  Check
} from 'lucide-react';
import { api } from '../../../api/client';
import { Project, AIManualTestCase, AIManualTestCaseStep } from '../../../api/types';

interface AITestCaseReviewSectionProps {
  project: Project;
  initialTestCaseId?: string;
  onStartDevelopment: (testCaseId: string) => Promise<void> | void;
}

export const AITestCaseReviewSection: React.FC<AITestCaseReviewSectionProps> = ({
  project,
  initialTestCaseId,
  onStartDevelopment
}) => {
  const [testCases, setTestCases] = useState<AIManualTestCase[]>([]);
  const [selectedTestCase, setSelectedTestCase] = useState<AIManualTestCase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Editable steps state
  const [editableSteps, setEditableSteps] = useState<AIManualTestCaseStep[]>([]);
  const [testCaseName, setTestCaseName] = useState('');

  // Multi-select for Test Cases
  const [selectedTestCaseIds, setSelectedTestCaseIds] = useState<Set<string>>(new Set());
  const [isBulkDeletingTestCases, setIsBulkDeletingTestCases] = useState(false);
  const [isBulkAccepting, setIsBulkAccepting] = useState(false);

  // Multi-select for Steps within active test case
  const [selectedStepIndices, setSelectedStepIndices] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadTestCases();
  }, [project.id]);

  useEffect(() => {
    if (initialTestCaseId && testCases.length > 0) {
      const target = testCases.find(tc => tc.id === initialTestCaseId);
      if (target) selectTestCase(target);
    }
  }, [initialTestCaseId, testCases]);

  const loadTestCases = async () => {
    setIsLoading(true);
    try {
      const res = await api.aiAutoTesting.getTestCases(project.id);
      if (res.success && res.testCases) {
        setTestCases(res.testCases);
        if (res.testCases.length > 0 && !selectedTestCase) {
          const target = initialTestCaseId
            ? res.testCases.find((tc: AIManualTestCase) => tc.id === initialTestCaseId) || res.testCases[0]
            : res.testCases[0];
          selectTestCase(target);
        }
      }
    } catch (e: any) {
      console.error('Failed to load test cases:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const selectTestCase = (tc: AIManualTestCase) => {
    setSelectedTestCase(tc);
    setTestCaseName(tc.name);
    setEditableSteps(tc.steps || []);
    setSelectedStepIndices(new Set());
    setMessage(null);
  };

  const handleStepChange = (index: number, field: keyof AIManualTestCaseStep, value: string) => {
    setEditableSteps(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddStep = () => {
    const newStepNum = editableSteps.length + 1;
    setEditableSteps(prev => [
      ...prev,
      {
        stepNumber: newStepNum,
        stepDescription: 'New test step action',
        input: '',
        expectedResult: 'Verify action completed successfully'
      }
    ]);
  };

  const handleDeleteStep = (index: number) => {
    setEditableSteps(prev => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((s, i) => ({ ...s, stepNumber: i + 1 }));
    });
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === editableSteps.length - 1)) {
      return;
    }
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    setEditableSteps(prev => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIdx];
      next[targetIdx] = temp;
      return next.map((s, i) => ({ ...s, stepNumber: i + 1 }));
    });
  };

  const handleSave = async () => {
    if (!selectedTestCase) return;
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await api.aiAutoTesting.saveTestCase({
        id: selectedTestCase.id,
        projectId: project.id,
        name: testCaseName.trim() || selectedTestCase.name,
        steps: editableSteps
      });
      if (res.success && res.testCase) {
        setSelectedTestCase(res.testCase);
        setMessage({ type: 'success', text: 'Test case changes saved successfully.' });
        await loadTestCases();
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to save test case.' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  // Section 6.3: Acceptance Behavior
  const handleAcceptAndDevelop = async () => {
    if (!selectedTestCase) return;

    if (editableSteps.length === 0) {
      setMessage({ type: 'error', text: 'Test case must contain at least one step.' });
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      // 1. Save any pending edits
      await api.aiAutoTesting.saveTestCase({
        id: selectedTestCase.id,
        projectId: project.id,
        name: testCaseName.trim() || selectedTestCase.name,
        steps: editableSteps
      });

      // 2. Mark accepted
      const acceptRes = await api.aiAutoTesting.acceptTestCase(selectedTestCase.id, project.id);
      if (acceptRes.success && acceptRes.testCase) {
        setMessage({ type: 'success', text: 'Test case accepted! Launching Playwright browser session...' });
        // 3. Begin automation development
        await onStartDevelopment(selectedTestCase.id);
      } else {
        setMessage({ type: 'error', text: acceptRes.error || 'Failed to accept test case.' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTestCase = async (id: string) => {
    if (!confirm('Are you sure you want to delete this manual test case?')) return;
    try {
      await api.aiAutoTesting.deleteTestCase(id, project.id);
      setSelectedTestCase(null);
      await loadTestCases();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    }
  };

  // ---------------------------------------------------------------------------
  // MULTI-SELECT & BULK ACTIONS
  // ---------------------------------------------------------------------------

  const handleToggleSelectTestCase = (tcId: string, e: React.MouseEvent | React.ChangeEvent) => {
    e.stopPropagation();
    setSelectedTestCaseIds(prev => {
      const next = new Set(prev);
      if (next.has(tcId)) next.delete(tcId);
      else next.add(tcId);
      return next;
    });
  };

  const handleToggleSelectAllTestCases = () => {
    if (selectedTestCaseIds.size === testCases.length) {
      setSelectedTestCaseIds(new Set());
    } else {
      setSelectedTestCaseIds(new Set(testCases.map(tc => tc.id)));
    }
  };

  const handleBulkDeleteTestCases = async () => {
    if (selectedTestCaseIds.size === 0) return;
    const count = selectedTestCaseIds.size;
    if (!window.confirm(`Are you sure you want to delete ${count} selected test case(s)?`)) return;

    setIsBulkDeletingTestCases(true);
    try {
      for (const id of Array.from(selectedTestCaseIds)) {
        await api.aiAutoTesting.deleteTestCase(id, project.id);
      }
      const remaining = testCases.filter(tc => !selectedTestCaseIds.has(tc.id));
      setTestCases(remaining);
      if (selectedTestCase && selectedTestCaseIds.has(selectedTestCase.id)) {
        if (remaining.length > 0) {
          selectTestCase(remaining[0]);
        } else {
          setSelectedTestCase(null);
          setEditableSteps([]);
          setTestCaseName('');
        }
      }
      setSelectedTestCaseIds(new Set());
      setMessage({ type: 'success', text: `Successfully deleted ${count} test case(s).` });
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Error deleting test cases.' });
    } finally {
      setIsBulkDeletingTestCases(false);
    }
  };

  const handleBulkAcceptTestCases = async () => {
    if (selectedTestCaseIds.size === 0) return;
    const count = selectedTestCaseIds.size;
    setIsBulkAccepting(true);
    try {
      for (const id of Array.from(selectedTestCaseIds)) {
        await api.aiAutoTesting.acceptTestCase(id, project.id);
      }
      await loadTestCases();
      setSelectedTestCaseIds(new Set());
      setMessage({ type: 'success', text: `Successfully marked ${count} test case(s) as Accepted.` });
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Error accepting test cases.' });
    } finally {
      setIsBulkAccepting(false);
    }
  };

  // Steps Multi-select
  const handleToggleSelectStep = (idx: number, e: React.MouseEvent | React.ChangeEvent) => {
    e.stopPropagation();
    setSelectedStepIndices(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleToggleSelectAllSteps = () => {
    if (selectedStepIndices.size === editableSteps.length) {
      setSelectedStepIndices(new Set());
    } else {
      setSelectedStepIndices(new Set(editableSteps.map((_, i) => i)));
    }
  };

  const handleBulkDeleteSteps = () => {
    if (selectedStepIndices.size === 0) return;
    const count = selectedStepIndices.size;
    if (!window.confirm(`Are you sure you want to delete ${count} selected step(s)?`)) return;

    setEditableSteps(prev => {
      const remaining = prev.filter((_, idx) => !selectedStepIndices.has(idx));
      return remaining.map((s, i) => ({ ...s, stepNumber: i + 1 }));
    });
    setSelectedStepIndices(new Set());
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Table className="w-5 h-5 text-brand-400" />
            <span>Manual Test Case Review & Acceptance</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Review the 4-column structured test cases. You can edit actions, inputs, and expected results before accepting. Once accepted, Easy Automate develops the Playwright automation steps and maps elements live.
          </p>
        </div>

        {selectedTestCase && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Edits</span>
            </button>

            <button
              onClick={handleAcceptAndDevelop}
              disabled={isSaving}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 shadow-sm transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Accept & Start Development</span>
            </button>
          </div>
        )}
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

      {/* Main Layout: Test Cases Selector & Primary 4-Column Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Test Cases List (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={testCases.length > 0 && selectedTestCaseIds.size === testCases.length}
                onChange={handleToggleSelectAllTestCases}
                className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-brand-600 focus:ring-0 cursor-pointer"
                title={selectedTestCaseIds.size === testCases.length ? 'Deselect All' : 'Select All'}
              />
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Test Cases ({testCases.length})
              </h3>
            </div>
            {selectedTestCaseIds.size > 0 && (
              <span className="text-[11px] font-semibold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full border border-brand-500/20">
                {selectedTestCaseIds.size} selected
              </span>
            )}
          </div>

          {/* Bulk Action Toolbar */}
          {selectedTestCaseIds.size > 0 && (
            <div className="p-2.5 rounded-xl bg-brand-950/60 border border-brand-500/30 flex items-center justify-between gap-2 shadow-lg animate-fadeIn">
              <div className="text-xs font-semibold text-brand-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-400" />
                <span>{selectedTestCaseIds.size} Selected</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleBulkAcceptTestCases}
                  disabled={isBulkAccepting}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shadow-sm disabled:opacity-50"
                  title="Mark selected test cases as Accepted"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Accept</span>
                </button>
                <button
                  type="button"
                  onClick={handleBulkDeleteTestCases}
                  disabled={isBulkDeletingTestCases}
                  className="px-2.5 py-1 bg-rose-600/80 hover:bg-rose-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                  title="Delete selected test cases"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTestCaseIds(new Set())}
                  className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
                  title="Clear Selection"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="p-8 text-center text-slate-500 text-xs">Loading test cases...</div>
          ) : testCases.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/60 rounded-2xl border border-slate-800 text-slate-400 text-xs">
              No test cases generated yet. Upload a document in "Application Documents" to begin.
            </div>
          ) : (
            <div className="space-y-2">
              {testCases.map(tc => {
                const isSelected = selectedTestCase?.id === tc.id;
                const isChecked = selectedTestCaseIds.has(tc.id);

                return (
                  <div
                    key={tc.id}
                    onClick={() => selectTestCase(tc)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2 ${
                      isSelected
                        ? 'bg-brand-950/40 border-brand-500/50 shadow-md shadow-brand-500/10'
                        : isChecked
                        ? 'bg-slate-900/90 border-brand-500/30'
                        : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => handleToggleSelectTestCase(tc.id, e)}
                          onClick={e => e.stopPropagation()}
                          className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-brand-600 focus:ring-0 cursor-pointer shrink-0"
                        />
                        <h4 className="text-xs font-bold text-white truncate max-w-[170px]" title={tc.name}>
                          {tc.name}
                        </h4>
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                          tc.status === 'accepted'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {tc.status === 'accepted' ? 'Accepted' : 'Draft / Review'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>{tc.steps?.length || 0} step(s)</span>
                      <span className="text-slate-500 font-mono text-[10px]">v{tc.version || 1}</span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(tc.createdAt).toLocaleDateString()}
                      </span>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleDeleteTestCase(tc.id);
                        }}
                        className="text-slate-500 hover:text-rose-400 transition-colors"
                        title="Delete test case"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Primary 4-Column Table (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {selectedTestCase ? (
            <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden">
              {/* Header */}
              <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-950/40">
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Test Case Name
                  </label>
                  <input
                    type="text"
                    value={testCaseName}
                    onChange={e => setTestCaseName(e.target.value)}
                    className="w-full bg-transparent text-sm font-bold text-white border-b border-transparent hover:border-slate-700 focus:border-brand-500 outline-none pb-0.5 mt-0.5"
                  />
                </div>

                <div className="flex items-center gap-2">
                  {selectedStepIndices.size > 0 && (
                    <button
                      type="button"
                      onClick={handleBulkDeleteSteps}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600/80 hover:bg-rose-600 text-white flex items-center gap-1.5 transition-colors shadow-sm animate-fadeIn"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Selected ({selectedStepIndices.size})</span>
                    </button>
                  )}
                  <button
                    onClick={handleAddStep}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-brand-300 border border-slate-700 flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Step</span>
                  </button>
                </div>
              </div>

              {/* Exact 4-Column Primary Table (Section 6.1) */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                      <th className="py-3 px-3 w-20 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {editableSteps.length > 0 && (
                            <input
                              type="checkbox"
                              checked={editableSteps.length > 0 && selectedStepIndices.size === editableSteps.length}
                              onChange={handleToggleSelectAllSteps}
                              className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-brand-600 focus:ring-0 cursor-pointer"
                              title={selectedStepIndices.size === editableSteps.length ? 'Deselect All Steps' : 'Select All Steps'}
                            />
                          )}
                          <span>Step #</span>
                        </div>
                      </th>
                      <th className="py-3 px-4 w-[38%]">Step Description</th>
                      <th className="py-3 px-4 w-[24%]">Input</th>
                      <th className="py-3 px-4 w-[28%]">Expected Result</th>
                      <th className="py-3 px-3 w-16 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-200">
                    {editableSteps.map((step, idx) => {
                      const isStepChecked = selectedStepIndices.has(idx);

                      return (
                        <tr
                          key={idx}
                          className={`transition-colors group ${
                            isStepChecked ? 'bg-brand-950/20' : 'hover:bg-slate-900/50'
                          }`}
                        >
                          {/* 1. Step No. & Checkbox */}
                          <td className="py-2.5 px-3 text-center font-mono text-slate-400 font-semibold select-none">
                            <div className="flex items-center justify-center gap-2">
                              <input
                                type="checkbox"
                                checked={isStepChecked}
                                onChange={e => handleToggleSelectStep(idx, e)}
                                onClick={e => e.stopPropagation()}
                                className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-brand-600 focus:ring-0 cursor-pointer shrink-0"
                              />
                              <span>{step.stepNumber}</span>
                            </div>
                          </td>

                          {/* 2. Step Description */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={step.stepDescription}
                            onChange={e => handleStepChange(idx, 'stepDescription', e.target.value)}
                            placeholder="e.g. Click Login button"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800/80 focus:border-brand-500 text-slate-100 text-xs"
                          />
                        </td>

                        {/* 3. Input */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={step.input}
                            onChange={e => handleStepChange(idx, 'input', e.target.value)}
                            placeholder="Optional input or N/A"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800/80 focus:border-brand-500 text-slate-100 text-xs font-mono text-[11px]"
                          />
                        </td>

                        {/* 4. Expected Result */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={step.expectedResult}
                            onChange={e => handleStepChange(idx, 'expectedResult', e.target.value)}
                            placeholder="e.g. Dashboard is displayed"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800/80 focus:border-brand-500 text-slate-100 text-xs"
                          />
                        </td>

                        {/* Row Controls */}
                        <td className="py-2 px-2 text-center">
                          <div className="flex items-center justify-center gap-1 opacity-70 group-hover:opacity-100">
                            <button
                              onClick={() => handleMoveStep(idx, 'up')}
                              disabled={idx === 0}
                              className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                              title="Move step up"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleMoveStep(idx, 'down')}
                              disabled={idx === editableSteps.length - 1}
                              className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                              title="Move step down"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteStep(idx)}
                              className="p-1 text-slate-400 hover:text-rose-400"
                              title="Delete step"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  </tbody>
                </table>
              </div>

              {editableSteps.length === 0 && (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No steps defined in this test case. Click "Add Step" above.
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center bg-slate-900/60 rounded-2xl border border-slate-800 text-slate-400">
              Select or generate a test case to view and edit its steps.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
