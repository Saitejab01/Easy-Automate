import React, { useState, useEffect } from 'react';
import {
  FileCode,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FolderTree,
  Code2,
  Layers,
  Send,
  Plus,
  X,
  ExternalLink,
  Sparkles,
  Zap,
  Calendar,
  RefreshCw,
  Edit3,
  Trash2,
  ArrowUp,
  ArrowDown,
  Check,
  Tag,
  Clock,
  ChevronRight
} from 'lucide-react';
import { api } from '../../../api/client';
import {
  Project,
  AIAutomationSession,
  AIAutomationStepDetail,
  ScriptModule,
  RepositoryElement,
  RepositoryPage,
  LocatorType
} from '../../../api/types';
import { useAuth } from '../../../context/AuthContext';

interface AIGeneratedScriptsSectionProps {
  project: Project;
  onNavigateToScriptsView?: () => void;
  initialSessionId?: string;
}

const COMMON_NLPS = [
  { id: 'open_browser', name: 'Open Browser', category: 'Browser' },
  { id: 'maximize_browser', name: 'Maximize Browser', category: 'Browser' },
  { id: 'navigate_to_url', name: 'Navigate To URL', category: 'Browser' },
  { id: 'click_element', name: 'Click On Element', category: 'Action' },
  { id: 'enter_text', name: 'Enter Text', category: 'Action' },
  { id: 'clear_text', name: 'Clear Text', category: 'Action' },
  { id: 'double_click_element', name: 'Double Click On Element', category: 'Action' },
  { id: 'right_click_element', name: 'Right Click On Element', category: 'Action' },
  { id: 'mouse_hover', name: 'Hover Over Element', category: 'Action' },
  { id: 'select_dropdown_by_text', name: 'Select Dropdown Option', category: 'Action' },
  { id: 'select_checkbox', name: 'Select Checkbox', category: 'Action' },
  { id: 'deselect_checkbox', name: 'Deselect Checkbox', category: 'Action' },
  { id: 'scroll_to_element', name: 'Scroll To Element', category: 'Action' },
  { id: 'verify_text', name: 'Verify Text', category: 'Verification' },
  { id: 'verify_element_is_displayed', name: 'Verify Element Is Displayed', category: 'Verification' },
  { id: 'wait_for_element_to_be_visible', name: 'Wait For Element Visible', category: 'Wait' },
  { id: 'static_wait', name: 'Static Wait', category: 'Wait' }
];

const LOCATOR_TYPES: LocatorType[] = [
  'ID',
  'Name',
  'XPath',
  'CSS Selector',
  'Class Name',
  'Link Text',
  'Tag Name',
  'Text',
  'Placeholder',
  'Test ID'
];

export const AIGeneratedScriptsSection: React.FC<AIGeneratedScriptsSectionProps> = ({
  project,
  onNavigateToScriptsView,
  initialSessionId
}) => {
  const { currentUser } = useAuth();
  const [sessions, setSessions] = useState<AIAutomationSession[]>([]);
  const [modules, setModules] = useState<ScriptModule[]>([]);
  const [availableElements, setAvailableElements] = useState<RepositoryElement[]>([]);
  const [pages, setPages] = useState<RepositoryPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<AIAutomationSession | null>(null);

  // Push Modal
  const [isPushModalOpen, setIsPushModalOpen] = useState(false);
  const [selectedModuleId, setSelectedModuleId] = useState<string>('');
  const [newModuleName, setNewModuleName] = useState('');
  const [isCreatingNewModule, setIsCreatingNewModule] = useState(false);
  const [scriptName, setScriptName] = useState('');
  const [isPushing, setIsPushing] = useState(false);
  const [pushSuccess, setPushSuccess] = useState<string | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);

  // Script Rename Modal / State
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  // Step Editor Modal
  const [isStepModalOpen, setIsStepModalOpen] = useState(false);
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [editingStep, setEditingStep] = useState<AIAutomationStepDetail | null>(null);

  // Deleting State
  const [isDeletingSession, setIsDeletingSession] = useState(false);

  // Multi-select & Bulk Operations State
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [isBulkPushModalOpen, setIsBulkPushModalOpen] = useState(false);
  const [bulkPushModuleId, setBulkPushModuleId] = useState<string>('');
  const [bulkPushNewModuleName, setBulkPushNewModuleName] = useState('');
  const [isBulkPushCreatingModule, setIsBulkPushCreatingModule] = useState(false);
  const [isBulkPushing, setIsBulkPushing] = useState(false);
  const [bulkPushProgress, setBulkPushProgress] = useState<{ current: number; total: number; currentName?: string } | null>(null);
  const [bulkPushSuccess, setBulkPushSuccess] = useState<string | null>(null);
  const [bulkPushError, setBulkPushError] = useState<string | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, [project.id]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [sessRes, modRes, pagesRes] = await Promise.all([
        api.aiAutoTesting.getSessions(project.id),
        api.scripts.getModules(project.id),
        api.repository.getPages(project.id)
      ]);

      if (sessRes.success && sessRes.sessions) {
        setSessions(sessRes.sessions);
        if (sessRes.sessions.length > 0) {
          if (initialSessionId) {
            const found = sessRes.sessions.find(s => s.id === initialSessionId);
            setSelectedSession(found || sessRes.sessions[0]);
          } else if (!selectedSession) {
            setSelectedSession(sessRes.sessions[0]);
          } else {
            // Keep currently selected session updated
            const refreshed = sessRes.sessions.find(s => s.id === selectedSession.id);
            setSelectedSession(refreshed || sessRes.sessions[0]);
          }
        }
      }

      if (modRes.success && modRes.modules) {
        setModules(modRes.modules);
        if (modRes.modules.length > 0) {
          setSelectedModuleId(modRes.modules[0].id);
        }
      }

      // Fetch all pages and repository elements for step association
      if (pagesRes.success && pagesRes.pages) {
        setPages(pagesRes.pages);
      }
      const elemRes = await api.repository.getElements(project.id);
      if (elemRes.success && elemRes.elements) {
        setAvailableElements(elemRes.elements);
      }
    } catch (e: any) {
      console.error('Failed to load generated scripts data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // SCRIPT CRUD
  // ---------------------------------------------------------------------------

  const handleOpenPushModal = (session: AIAutomationSession) => {
    setSelectedSession(session);
    setScriptName(session.testCaseName || 'AI Automated Script');
    setPushSuccess(null);
    setPushError(null);
    setIsPushModalOpen(true);
  };

  const handlePushSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession || !currentUser) return;

    setIsPushing(true);
    setPushError(null);
    setPushSuccess(null);

    try {
      let targetModId = selectedModuleId;

      if (isCreatingNewModule && newModuleName.trim()) {
        const createModRes = await api.scripts.createModule(project.id, newModuleName.trim(), null);
        if (createModRes.success && createModRes.module) {
          targetModId = createModRes.module.id;
        } else {
          throw new Error('Failed to create target module');
        }
      }

      const res = await api.aiAutoTesting.pushToTestDev(
        selectedSession.id,
        project.id,
        targetModId,
        scriptName.trim(),
        currentUser.id
      );

      if (res.success && res.scriptId) {
        setPushSuccess(`Script "${scriptName}" successfully pushed to TestDev Scripts!`);
        await loadData();
        setTimeout(() => {
          setIsPushModalOpen(false);
        }, 1200);
      } else {
        setPushError(res.error || 'Failed to push script to TestDev');
      }
    } catch (err: any) {
      setPushError(err.message || 'An error occurred during push');
    } finally {
      setIsPushing(false);
    }
  };

  const handleRenameScript = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession || !renameValue.trim()) return;

    const updatedSession = {
      ...selectedSession,
      testCaseName: renameValue.trim()
    };

    const res = await api.aiAutoTesting.saveSession(updatedSession);
    if (res.success) {
      setSelectedSession(updatedSession);
      setSessions(prev => prev.map(s => (s.id === updatedSession.id ? updatedSession : s)));
      setIsRenameModalOpen(false);
    } else {
      alert(res.error || 'Failed to rename script');
    }
  };

  const handleDeleteScript = async (session: AIAutomationSession) => {
    if (!window.confirm(`Are you sure you want to delete script "${session.testCaseName}"? This action cannot be undone.`)) {
      return;
    }

    setIsDeletingSession(true);
    try {
      const res = await api.aiAutoTesting.deleteSession(session.id, project.id);
      if (res.success) {
        const remaining = sessions.filter(s => s.id !== session.id);
        setSessions(remaining);
        if (selectedSession?.id === session.id) {
          setSelectedSession(remaining.length > 0 ? remaining[0] : null);
        }
      } else {
        alert(res.error || 'Failed to delete script');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting script');
    } finally {
      setIsDeletingSession(false);
    }
  };

  // ---------------------------------------------------------------------------
  // MULTI-SELECT & BULK ACTIONS
  // ---------------------------------------------------------------------------

  const handleToggleSelectSession = (sessionId: string, e: React.MouseEvent | React.ChangeEvent) => {
    e.stopPropagation();
    setSelectedSessionIds(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  };

  const handleToggleSelectAllSessions = () => {
    if (selectedSessionIds.size === sessions.length) {
      setSelectedSessionIds(new Set());
    } else {
      setSelectedSessionIds(new Set(sessions.map(s => s.id)));
    }
  };

  const handleBulkDeleteSessions = async () => {
    if (selectedSessionIds.size === 0) return;
    const count = selectedSessionIds.size;
    if (!window.confirm(`Are you sure you want to delete ${count} selected script(s)? This action cannot be undone.`)) {
      return;
    }

    setIsBulkDeleting(true);
    try {
      for (const sessionId of Array.from(selectedSessionIds)) {
        await api.aiAutoTesting.deleteSession(sessionId, project.id);
      }
      const remaining = sessions.filter(s => !selectedSessionIds.has(s.id));
      setSessions(remaining);
      if (selectedSession && selectedSessionIds.has(selectedSession.id)) {
        setSelectedSession(remaining.length > 0 ? remaining[0] : null);
      }
      setSelectedSessionIds(new Set());
    } catch (err: any) {
      alert(err.message || 'Error deleting selected scripts');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleOpenBulkPushModal = () => {
    if (selectedSessionIds.size === 0) return;
    setBulkPushSuccess(null);
    setBulkPushError(null);
    setBulkPushProgress(null);
    if (modules.length > 0 && !bulkPushModuleId) {
      setBulkPushModuleId(modules[0].id);
    }
    setIsBulkPushModalOpen(true);
  };

  const handleBulkPushSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSessionIds.size === 0 || !currentUser) return;

    let targetModuleId = bulkPushModuleId;
    if (isBulkPushCreatingModule) {
      if (!bulkPushNewModuleName.trim()) {
        setBulkPushError('Please enter a module name');
        return;
      }
      const createModRes = await api.scripts.createModule(project.id, bulkPushNewModuleName.trim(), null);
      if (createModRes.success && createModRes.module) {
        targetModuleId = createModRes.module.id;
        setModules(prev => [...prev, createModRes.module!]);
      } else {
        setBulkPushError(createModRes.error || 'Failed to create module');
        return;
      }
    }

    if (!targetModuleId) {
      setBulkPushError('Please select or create a destination module');
      return;
    }

    setIsBulkPushing(true);
    setBulkPushError(null);
    const selectedList = sessions.filter(s => selectedSessionIds.has(s.id));
    const total = selectedList.length;

    try {
      let successCount = 0;
      for (let i = 0; i < total; i++) {
        const s = selectedList[i];
        setBulkPushProgress({ current: i + 1, total, currentName: s.testCaseName });
        const res = await api.aiAutoTesting.pushToTestDev(
          s.id,
          project.id,
          targetModuleId,
          s.testCaseName,
          currentUser.id
        );
        if (res.success) successCount++;
      }

      setBulkPushSuccess(`Successfully pushed ${successCount} of ${total} script(s) to TestDev!`);
      await loadData();
      setSelectedSessionIds(new Set());
      setTimeout(() => {
        setIsBulkPushModalOpen(false);
        setBulkPushProgress(null);
      }, 1500);
    } catch (err: any) {
      setBulkPushError(err.message || 'Error occurred during bulk push');
    } finally {
      setIsBulkPushing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // STEP CRUD
  // ---------------------------------------------------------------------------

  const handleOpenStepModal = (step: AIAutomationStepDetail, index: number) => {
    setEditingStepIndex(index);
    setEditingStep(JSON.parse(JSON.stringify(step))); // Deep clone for safe editing
    setIsStepModalOpen(true);
  };

  const handleSaveStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession || editingStepIndex === null || !editingStep) return;

    const updatedSteps = [...selectedSession.steps];
    updatedSteps[editingStepIndex] = {
      ...editingStep,
      stepNumber: editingStepIndex + 1
    };

    const updatedSession: AIAutomationSession = {
      ...selectedSession,
      steps: updatedSteps
    };

    const res = await api.aiAutoTesting.saveSession(updatedSession);
    if (res.success) {
      setSelectedSession(updatedSession);
      setSessions(prev => prev.map(s => (s.id === updatedSession.id ? updatedSession : s)));
      setIsStepModalOpen(false);
      setEditingStep(null);
      setEditingStepIndex(null);
    } else {
      alert(res.error || 'Failed to save step changes');
    }
  };

  const handleDeleteStep = async (index: number) => {
    if (!selectedSession) return;
    if (!window.confirm(`Are you sure you want to delete Step #${index + 1}?`)) return;

    const updatedSteps = selectedSession.steps
      .filter((_, idx) => idx !== index)
      .map((s, idx) => ({ ...s, stepNumber: idx + 1 }));

    const updatedSession: AIAutomationSession = {
      ...selectedSession,
      steps: updatedSteps
    };

    const res = await api.aiAutoTesting.saveSession(updatedSession);
    if (res.success) {
      setSelectedSession(updatedSession);
      setSessions(prev => prev.map(s => (s.id === updatedSession.id ? updatedSession : s)));
    } else {
      alert(res.error || 'Failed to delete step');
    }
  };

  const handleAddStep = async () => {
    if (!selectedSession) return;

    const newStepNumber = selectedSession.steps.length + 1;
    const newStep: AIAutomationStepDetail = {
      stepNumber: newStepNumber,
      manualStepDescription: `New Step #${newStepNumber}`,
      manualInput: '',
      manualExpectedResult: '',
      nlpId: 'click_element',
      nlpName: 'Click On Element',
      status: 'Pending',
      inputParameters: {},
      logs: []
    };

    const updatedSteps = [...selectedSession.steps, newStep];
    const updatedSession: AIAutomationSession = {
      ...selectedSession,
      steps: updatedSteps
    };

    const res = await api.aiAutoTesting.saveSession(updatedSession);
    if (res.success) {
      setSelectedSession(updatedSession);
      setSessions(prev => prev.map(s => (s.id === updatedSession.id ? updatedSession : s)));
      // Open editor for new step
      handleOpenStepModal(newStep, updatedSteps.length - 1);
    }
  };

  const handleMoveStep = async (index: number, direction: 'up' | 'down') => {
    if (!selectedSession) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= selectedSession.steps.length) return;

    const updatedSteps = [...selectedSession.steps];
    const temp = updatedSteps[index];
    updatedSteps[index] = updatedSteps[targetIndex];
    updatedSteps[targetIndex] = temp;

    // Renumber steps
    const renumbered = updatedSteps.map((s, idx) => ({ ...s, stepNumber: idx + 1 }));

    const updatedSession: AIAutomationSession = {
      ...selectedSession,
      steps: renumbered
    };

    const res = await api.aiAutoTesting.saveSession(updatedSession);
    if (res.success) {
      setSelectedSession(updatedSession);
      setSessions(prev => prev.map(s => (s.id === updatedSession.id ? updatedSession : s)));
    }
  };

  const handleSelectElementForStep = (elementId: string) => {
    if (!editingStep) return;
    if (!elementId) {
      setEditingStep({
        ...editingStep,
        elementId: undefined,
        elementName: undefined
      });
      return;
    }

    const found = availableElements.find(e => e.id === elementId);
    if (found) {
      const primaryLoc = found.locators.find(l => l.isPrimary) || found.locators[0];
      setEditingStep({
        ...editingStep,
        elementId: found.id,
        elementName: found.name,
        locatorType: primaryLoc?.type || 'ID',
        locatorValue: primaryLoc?.value || ''
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-brand-400" />
            <h2 className="text-base font-bold text-white">Generated Automation Scripts & Full Step CRUD</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Review and edit runtime-generated automation scripts. Authenticated users can open and edit any step, change mapped NLPs, associate AI elements, modify locators, add new steps, or push ready scripts directly to TestDev.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {onNavigateToScriptsView && (
            <button
              onClick={onNavigateToScriptsView}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-brand-300 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors"
            >
              <span>Open TestDev Scripts</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={loadData}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Grid: Scripts List (4 cols) & Script Inspection & Step CRUD (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Scripts List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={sessions.length > 0 && selectedSessionIds.size === sessions.length}
                onChange={handleToggleSelectAllSessions}
                className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-brand-600 focus:ring-0 cursor-pointer"
                title={selectedSessionIds.size === sessions.length ? 'Deselect All' : 'Select All'}
              />
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Generated Scripts ({sessions.length})
              </h3>
            </div>
            {selectedSessionIds.size > 0 && (
              <span className="text-[11px] font-semibold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full border border-brand-500/20">
                {selectedSessionIds.size} selected
              </span>
            )}
          </div>

          {/* Bulk Action Toolbar */}
          {selectedSessionIds.size > 0 && (
            <div className="p-2.5 rounded-xl bg-brand-950/60 border border-brand-500/30 flex items-center justify-between gap-2 shadow-lg animate-fadeIn">
              <div className="text-xs font-semibold text-brand-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-400" />
                <span>{selectedSessionIds.size} Selected</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleOpenBulkPushModal}
                  className="px-2.5 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shadow-sm"
                  title="Push selected scripts to TestDev"
                >
                  <Send className="w-3 h-3" />
                  <span>Bulk Push</span>
                </button>
                <button
                  type="button"
                  onClick={handleBulkDeleteSessions}
                  disabled={isBulkDeleting}
                  className="px-2.5 py-1 bg-rose-600/80 hover:bg-rose-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                  title="Delete selected scripts"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSessionIds(new Set())}
                  className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
                  title="Clear Selection"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="p-8 text-center text-slate-500 text-xs">Loading scripts...</div>
          ) : sessions.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/60 rounded-2xl border border-slate-800 text-slate-400 text-xs">
              No developed scripts ready for review yet. Run an automation session in the "Automation Development" section first.
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map(s => {
                const isSelected = selectedSession?.id === s.id;
                const isChecked = selectedSessionIds.has(s.id);
                const isPushed = s.stage === 'Script Pushed to TestDev' || !!s.generatedScriptId;

                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedSession(s)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2 relative group ${
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
                          onChange={e => handleToggleSelectSession(s.id, e)}
                          onClick={e => e.stopPropagation()}
                          className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-brand-600 focus:ring-0 cursor-pointer shrink-0"
                        />
                        <h4 className="text-xs font-bold text-white truncate max-w-[155px]" title={s.testCaseName}>
                          {s.testCaseName}
                        </h4>
                      </div>
                      {isPushed ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 shrink-0">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Pushed
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                          Ready to Push
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>{s.steps.length} Steps</span>
                      <span>Progress: {s.progressPercent}%</span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(s.createdAt).toLocaleDateString()}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleDeleteScript(s);
                          }}
                          className="text-slate-500 hover:text-rose-400 p-0.5 rounded transition-colors"
                          title="Delete Script"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>

                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleOpenPushModal(s);
                          }}
                          className="text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1"
                        >
                          Push
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Script Steps Structure & Step CRUD */}
        <div className="lg:col-span-8 space-y-4">
          {selectedSession ? (
            <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 space-y-6">
              {/* Script Title & Management Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-base font-bold text-white">{selectedSession.testCaseName}</h3>
                    <button
                      onClick={() => {
                        setRenameValue(selectedSession.testCaseName);
                        setIsRenameModalOpen(true);
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-brand-300 hover:bg-slate-800 transition-colors"
                      title="Rename Script"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteScript(selectedSession)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                      title="Delete Script"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-400">
                    Stage: <span className="text-brand-300 font-semibold">{selectedSession.stage}</span> • Created:{' '}
                    {new Date(selectedSession.createdAt).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {selectedSession.generatedScriptId && onNavigateToScriptsView && (
                    <button
                      onClick={onNavigateToScriptsView}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Open in TestDev</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleOpenPushModal(selectedSession)}
                    className="px-5 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white flex items-center gap-2 shadow-sm transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Push to TestDev Scripts</span>
                  </button>
                </div>
              </div>

              {/* Steps breakdown & CRUD header */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <span>Script Steps ({selectedSession.steps.length})</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      Click any step to open details or edit
                    </span>
                  </h4>

                  <button
                    onClick={handleAddStep}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-500/10 hover:bg-brand-500/20 text-brand-300 border border-brand-500/30 flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Step</span>
                  </button>
                </div>

                {/* Steps List */}
                <div className="space-y-2">
                  {selectedSession.steps.map((st, sIdx) => (
                    <div
                      key={sIdx}
                      onClick={() => handleOpenStepModal(st, sIdx)}
                      className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-brand-500/50 cursor-pointer transition-all space-y-2 group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="w-5 h-5 rounded-md bg-slate-800 text-[11px] font-mono font-bold text-slate-300 flex items-center justify-center">
                            {st.stepNumber}
                          </span>
                          <span className="text-xs font-semibold text-white group-hover:text-brand-300 transition-colors">
                            {st.manualStepDescription}
                          </span>
                        </div>

                        {/* Step action buttons: Reorder, Edit, Delete */}
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleMoveStep(sIdx, 'up')}
                            disabled={sIdx === 0}
                            className="p-1 text-slate-500 hover:text-slate-200 disabled:opacity-20 transition-colors"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleMoveStep(sIdx, 'down')}
                            disabled={sIdx === selectedSession.steps.length - 1}
                            className="p-1 text-slate-500 hover:text-slate-200 disabled:opacity-20 transition-colors"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenStepModal(st, sIdx)}
                            className="p-1 text-slate-400 hover:text-brand-300 transition-colors ml-1"
                            title="Edit Step"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteStep(sIdx)}
                            className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                            title="Delete Step"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Step Attributes & Details */}
                      <div className="flex flex-wrap items-center gap-2.5 text-[11px] font-mono pt-1 text-slate-400">
                        <span className="px-2 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20 font-semibold flex items-center gap-1">
                          <Code2 className="w-3 h-3" />
                          NLP: {st.nlpName || 'Click On Element'}
                        </span>

                        {st.elementName && (
                          <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center gap-1 truncate max-w-xs">
                            <FolderTree className="w-3 h-3" />
                            {st.elementName}
                          </span>
                        )}

                        {st.locatorValue && (
                          <span className="px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/60 truncate max-w-sm">
                            [{st.locatorType}: {st.locatorValue}]
                          </span>
                        )}

                        {st.inputParameters && Object.keys(st.inputParameters).length > 0 && (
                          <span className="px-2 py-0.5 rounded bg-slate-900 text-amber-300 border border-amber-500/20">
                            {JSON.stringify(st.inputParameters)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-slate-900/60 rounded-2xl border border-slate-800 text-slate-400 text-xs">
              Select a generated script to review and edit its steps.
            </div>
          )}
        </div>
      </div>

      {/* Step Details & Editor Modal (Full Step CRUD) */}
      {isStepModalOpen && editingStep && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 space-y-5 shadow-2xl animate-scaleUp max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-brand-400" />
                  <span>Step #{editingStep.stepNumber} - Details & Configuration</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Update action NLP, element association, locators, and parameters
                </p>
              </div>
              <button
                onClick={() => setIsStepModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStep} className="space-y-4">
              {/* Step Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Manual Step Description *
                </label>
                <input
                  type="text"
                  value={editingStep.manualStepDescription || ''}
                  onChange={e => setEditingStep({ ...editingStep, manualStepDescription: e.target.value })}
                  placeholder="e.g. Click on Login Button"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-brand-500"
                  required
                />
              </div>

              {/* Action NLP Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Mapped NLP Action *
                </label>
                <select
                  value={editingStep.nlpId || 'click_element'}
                  onChange={e => {
                    const foundNlp = COMMON_NLPS.find(n => n.id === e.target.value);
                    setEditingStep({
                      ...editingStep,
                      nlpId: e.target.value,
                      nlpName: foundNlp?.name || e.target.value
                    });
                  }}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-brand-500"
                >
                  {COMMON_NLPS.map(nlp => (
                    <option key={nlp.id} value={nlp.id}>
                      [{nlp.category}] {nlp.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Associated Element */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Associated Element (Repository & AI Captured)
                </label>
                <select
                  value={editingStep.elementId || ''}
                  onChange={e => handleSelectElementForStep(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-brand-500"
                >
                  <option value="">-- None / Manual Custom Element --</option>
                  <optgroup label="AI Captured Elements">
                    {availableElements
                      .filter(el => {
                        const p = pages.find(page => page.id === el.pageId);
                        return p?.name.toLowerCase() === 'ai elements' || el.description?.toLowerCase().includes('ai');
                      })
                      .map(el => (
                        <option key={el.id} value={el.id}>
                          {el.name} ({el.type}) - {el.locators.length} locator(s)
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="Repository Elements">
                    {availableElements
                      .filter(el => {
                        const p = pages.find(page => page.id === el.pageId);
                        return p?.name.toLowerCase() !== 'ai elements' && !el.description?.toLowerCase().includes('ai');
                      })
                      .map(el => {
                        const p = pages.find(page => page.id === el.pageId);
                        return (
                          <option key={el.id} value={el.id}>
                            [{p?.name || 'Page'}] {el.name} ({el.type})
                          </option>
                        );
                      })}
                  </optgroup>
                </select>
              </div>

              {/* Display Candidate Locators for Auto-Prioritization */}
              {editingStep.elementId && (() => {
                const selEl = availableElements.find(e => e.id === editingStep.elementId);
                if (!selEl || !selEl.locators || selEl.locators.length === 0) return null;
                const sorted = [...selEl.locators].sort((a, b) => (a.priority || 1) - (b.priority || 1));
                return (
                  <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/30 space-y-1.5 text-xs animate-fadeIn">
                    <div className="flex items-center gap-1.5 text-purple-300 font-semibold">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>Configured Locators for Auto-Prioritization ({sorted.length}):</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {sorted.map((l, i) => (
                        <button
                          key={l.id || i}
                          type="button"
                          onClick={() => setEditingStep({ ...editingStep, locatorType: l.type as LocatorType, locatorValue: l.value })}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-all ${
                            editingStep.locatorType === l.type && editingStep.locatorValue === l.value
                              ? 'bg-purple-600 text-white border-purple-400 shadow-sm'
                              : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                          }`}
                          title="Click to select this locator as primary for this step"
                        >
                          Priority #{l.priority || i + 1} ({l.type}): {l.value}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Element Name if custom or manual */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Element Display Name
                </label>
                <input
                  type="text"
                  value={editingStep.elementName || ''}
                  onChange={e => setEditingStep({ ...editingStep, elementName: e.target.value })}
                  placeholder="e.g. Login Button"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-brand-500"
                />
              </div>

              {/* Locator Configuration */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Locator Strategy
                  </label>
                  <select
                    value={editingStep.locatorType || 'ID'}
                    onChange={e => setEditingStep({ ...editingStep, locatorType: e.target.value as LocatorType })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-brand-500"
                  >
                    {LOCATOR_TYPES.map(lt => (
                      <option key={lt} value={lt}>
                        {lt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Locator Value
                  </label>
                  <input
                    type="text"
                    value={editingStep.locatorValue || ''}
                    onChange={e => setEditingStep({ ...editingStep, locatorValue: e.target.value })}
                    placeholder="e.g. loginBtn or //button[@id='login']"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono focus:border-brand-500"
                  />
                </div>
              </div>

              {/* Dynamic Parameters based on NLP */}
              {(editingStep.nlpId === 'enter_text' || editingStep.nlpId === 'clear_text') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Input Text Value
                  </label>
                  <input
                    type="text"
                    value={editingStep.inputParameters?.text || editingStep.manualInput || ''}
                    onChange={e =>
                      setEditingStep({
                        ...editingStep,
                        manualInput: e.target.value,
                        inputParameters: { ...editingStep.inputParameters, text: e.target.value }
                      })
                    }
                    placeholder="Text to type into input field"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-brand-500"
                  />
                </div>
              )}

              {editingStep.nlpId === 'verify_text' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Expected Text to Verify *
                  </label>
                  <input
                    type="text"
                    value={editingStep.inputParameters?.expectedText || editingStep.manualExpectedResult || ''}
                    onChange={e =>
                      setEditingStep({
                        ...editingStep,
                        inputParameters: { ...editingStep.inputParameters, expectedText: e.target.value }
                      })
                    }
                    placeholder="e.g. Shopper Login"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-brand-500"
                    required
                  />
                </div>
              )}

              {editingStep.nlpId === 'navigate_to_url' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Navigation URL *
                  </label>
                  <input
                    type="text"
                    value={editingStep.inputParameters?.url || editingStep.manualInput || ''}
                    onChange={e =>
                      setEditingStep({
                        ...editingStep,
                        inputParameters: { ...editingStep.inputParameters, url: e.target.value }
                      })
                    }
                    placeholder="https://example.com"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-brand-500"
                    required
                  />
                </div>
              )}

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsStepModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white shadow-sm flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Step</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Script Rename Modal */}
      {isRenameModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-brand-400" />
                <span>Rename Generated Script</span>
              </h3>
              <button
                onClick={() => setIsRenameModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRenameScript} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Script Name *
                </label>
                <input
                  type="text"
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-brand-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRenameModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white"
                >
                  Save Name
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Push to TestDev Modal */}
      {isBulkPushModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Send className="w-4 h-4 text-brand-400" />
                  <span>Bulk Push to TestDev ({selectedSessionIds.size} Scripts)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select destination module to promote all selected scripts into TestDev
                </p>
              </div>
              <button
                onClick={() => setIsBulkPushModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {bulkPushSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{bulkPushSuccess}</span>
              </div>
            )}

            {bulkPushError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{bulkPushError}</span>
              </div>
            )}

            <form onSubmit={handleBulkPushSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">Target TestDev Module *</label>
                  <button
                    type="button"
                    onClick={() => setIsBulkPushCreatingModule(!isBulkPushCreatingModule)}
                    className="text-[11px] text-brand-400 hover:text-brand-300 font-semibold"
                  >
                    {isBulkPushCreatingModule ? 'Select Existing Module' : '+ New Module'}
                  </button>
                </div>

                {isBulkPushCreatingModule ? (
                  <input
                    type="text"
                    value={bulkPushNewModuleName}
                    onChange={e => setBulkPushNewModuleName(e.target.value)}
                    placeholder="e.g. Bulk Imported AI Flows"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-brand-500"
                    required
                  />
                ) : (
                  <select
                    value={bulkPushModuleId}
                    onChange={e => setBulkPushModuleId(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-brand-500"
                    required
                  >
                    {modules.map(mod => (
                      <option key={mod.id} value={mod.id}>
                        {mod.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Scripts List Preview */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Scripts to be promoted:
                </label>
                <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 bg-slate-950/70 rounded-xl border border-slate-800 text-xs">
                  {sessions
                    .filter(s => selectedSessionIds.has(s.id))
                    .map(s => (
                      <div key={s.id} className="flex items-center justify-between px-2 py-1 rounded bg-slate-900 border border-slate-800/80">
                        <span className="font-semibold text-white truncate max-w-[260px]">{s.testCaseName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{s.steps.length} steps</span>
                      </div>
                    ))}
                </div>
              </div>

              {bulkPushProgress && (
                <div className="p-3 bg-brand-950/50 border border-brand-500/30 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-brand-300 font-semibold">
                      Promoting ({bulkPushProgress.current}/{bulkPushProgress.total}): {bulkPushProgress.currentName}
                    </span>
                    <span className="font-mono text-brand-400">
                      {Math.round((bulkPushProgress.current / bulkPushProgress.total) * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 transition-all duration-300"
                      style={{ width: `${(bulkPushProgress.current / bulkPushProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBulkPushModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBulkPushing}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white flex items-center gap-1.5 disabled:opacity-50 shadow-md"
                >
                  {isBulkPushing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Promoting {bulkPushProgress?.current || 0} / {selectedSessionIds.size}...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Push {selectedSessionIds.size} Scripts</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Push to TestDev Modal */}
      {isPushModalOpen && selectedSession && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Send className="w-4 h-4 text-brand-400" />
                  <span>Push to TestDev Scripts</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Select destination module and script name</p>
              </div>
              <button
                onClick={() => setIsPushModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {pushSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{pushSuccess}</span>
              </div>
            )}

            {pushError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                <span>{pushError}</span>
              </div>
            )}

            <form onSubmit={handlePushSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Script Name *</label>
                <input
                  type="text"
                  value={scriptName}
                  onChange={e => setScriptName(e.target.value)}
                  placeholder="e.g. User Authentication Flow"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-brand-500"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">Target TestDev Module *</label>
                  <button
                    type="button"
                    onClick={() => setIsCreatingNewModule(!isCreatingNewModule)}
                    className="text-[11px] text-brand-400 hover:text-brand-300 font-semibold"
                  >
                    {isCreatingNewModule ? 'Select Existing Module' : '+ New Module'}
                  </button>
                </div>

                {isCreatingNewModule ? (
                  <input
                    type="text"
                    value={newModuleName}
                    onChange={e => setNewModuleName(e.target.value)}
                    placeholder="e.g. Authentication & Smoke Tests"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-brand-500"
                    required
                  />
                ) : (
                  <select
                    value={selectedModuleId}
                    onChange={e => setSelectedModuleId(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-brand-500"
                    required
                  >
                    {modules.map(mod => (
                      <option key={mod.id} value={mod.id}>
                        {mod.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center justify-between">
                  <span>Steps to convert:</span>
                  <strong className="text-white font-mono">{selectedSession.steps.length} Steps</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Associated Elements:</span>
                  <strong className="text-purple-300 font-mono">
                    {selectedSession.steps.filter(s => s.elementName).length} Elements
                  </strong>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPushModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPushing}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isPushing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Promoting Script...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Confirm & Promote Script</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Push to TestDev Modal */}
      {isBulkPushModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Send className="w-4 h-4 text-brand-400" />
                  <span>Bulk Push to TestDev ({selectedSessionIds.size} Scripts)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select destination module to promote all selected scripts into TestDev
                </p>
              </div>
              <button
                onClick={() => setIsBulkPushModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {bulkPushSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{bulkPushSuccess}</span>
              </div>
            )}

            {bulkPushError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{bulkPushError}</span>
              </div>
            )}

            <form onSubmit={handleBulkPushSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">Target TestDev Module *</label>
                  <button
                    type="button"
                    onClick={() => setIsBulkPushCreatingModule(!isBulkPushCreatingModule)}
                    className="text-[11px] text-brand-400 hover:text-brand-300 font-semibold"
                  >
                    {isBulkPushCreatingModule ? 'Select Existing Module' : '+ New Module'}
                  </button>
                </div>

                {isBulkPushCreatingModule ? (
                  <input
                    type="text"
                    value={bulkPushNewModuleName}
                    onChange={e => setBulkPushNewModuleName(e.target.value)}
                    placeholder="e.g. Bulk Imported AI Flows"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-brand-500"
                    required
                  />
                ) : (
                  <select
                    value={bulkPushModuleId}
                    onChange={e => setBulkPushModuleId(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:border-brand-500"
                    required
                  >
                    {modules.map(mod => (
                      <option key={mod.id} value={mod.id}>
                        {mod.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Scripts List Preview */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Scripts to be promoted:
                </label>
                <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 bg-slate-950/70 rounded-xl border border-slate-800 text-xs">
                  {sessions
                    .filter(s => selectedSessionIds.has(s.id))
                    .map(s => (
                      <div key={s.id} className="flex items-center justify-between px-2 py-1 rounded bg-slate-900 border border-slate-800/80">
                        <span className="font-semibold text-white truncate max-w-[260px]">{s.testCaseName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{s.steps.length} steps</span>
                      </div>
                    ))}
                </div>
              </div>

              {bulkPushProgress && (
                <div className="p-3 bg-brand-950/50 border border-brand-500/30 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-brand-300 font-semibold">
                      Promoting ({bulkPushProgress.current}/{bulkPushProgress.total}): {bulkPushProgress.currentName}
                    </span>
                    <span className="font-mono text-brand-400">
                      {Math.round((bulkPushProgress.current / bulkPushProgress.total) * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 transition-all duration-300"
                      style={{ width: `${(bulkPushProgress.current / bulkPushProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBulkPushModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBulkPushing}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white flex items-center gap-1.5 disabled:opacity-50 shadow-md"
                >
                  {isBulkPushing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Promoting {bulkPushProgress?.current || 0} / {selectedSessionIds.size}...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Push {selectedSessionIds.size} Scripts</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
