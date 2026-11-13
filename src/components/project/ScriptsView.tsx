import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Code,
  Code2,
  Folder,
  FolderPlus,
  FolderOpen,
  Plus,
  Play,
  Settings,
  Trash2,
  Edit2,
  Copy,
  ArrowUp,
  ArrowDown,
  Search,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  Layers,
  Sparkles,
  FileCode,
  Sliders,
  DollarSign,
  Maximize2,
  Filter,
  Eye,
  Key,
  Shield,
  FileSpreadsheet,
  MousePointer,
  HelpCircle,
  ExternalLink,
  Zap,
  RefreshCw
} from 'lucide-react';
import { api } from '../../api/client';
import { generatePlaywrightCode } from '../../utils/playwrightCodeGenerator';
import {
  Project,
  ScriptModule,
  AutomationScript,
  ScriptStep,
  ScriptVariable,
  RunSettings,
  RepositoryPage,
  RepositoryElement,
  NlpDefinition,
  NlpCategory
} from '../../api/types';
import { NLP_CATALOG, NLP_CATEGORIES } from '../../api/nlpCatalog';
import { useAuth } from '../../context/AuthContext';
import {
  parseDynamicPlaceholders,
  resolveDynamicPlaceholders
} from '../../utils/dynamicPlaceholder';

export const extractDynamicPlaceholders = (
  locator?: { value?: string; valueType?: string },
  elementMode: 'Static' | 'Dynamic' = 'Static'
): string[] => {
  if (elementMode !== 'Dynamic' || !locator || !locator.value) return [];
  return parseDynamicPlaceholders(locator.value);
};

export const getResolvedLocatorPreview = (
  locator?: { value?: string; valueType?: string },
  dynamicValues?: Record<string, string>,
  elementMode: 'Static' | 'Dynamic' = 'Static'
): string => {
  if (!locator || !locator.value) return '';
  return resolveDynamicPlaceholders(locator.value, elementMode, dynamicValues).resolvedValue;
};

interface ScriptsViewProps {
  project: Project;
  onNavigateToExecution: (executionId?: string) => void;
}

export const ScriptsView: React.FC<ScriptsViewProps> = ({ project, onNavigateToExecution }) => {
  const { currentUser } = useAuth();

  // State
  const [modules, setModules] = useState<ScriptModule[]>([]);
  const [scripts, setScripts] = useState<AutomationScript[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [expandedModuleIds, setExpandedModuleIds] = useState<Set<string>>(new Set());

  // Active script opened in Script Development Slider/Panel (Section 3)
  const [activeScript, setActiveScript] = useState<AutomationScript | null>(null);

  // Variables & Run Settings
  const [variables, setVariables] = useState<ScriptVariable[]>([]);
  const [runSettings, setRunSettings] = useState<RunSettings>({
    browser: 'chromium',
    delayBetweenStepsMs: 500,
    globalWaitTimeMs: 3000,
    executionTimeoutSec: 30,
    screenshotOption: 'failed-only',
    screenRecording: false,
    isDefault: true,
    scope: 'project'
  });

  // Repository elements for mapping (Section 5)
  const [repoPages, setRepoPages] = useState<RepositoryPage[]>([]);
  const [repoElements, setRepoElements] = useState<RepositoryElement[]>([]);

  // Modals
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
  const [moduleParentId, setModuleParentId] = useState<string | null>(null);
  const [moduleNameInput, setModuleNameInput] = useState('');
  const [moduleModalError, setModuleModalError] = useState<string | null>(null);

  const [moduleToRename, setModuleToRename] = useState<ScriptModule | null>(null);
  const [renameModuleName, setRenameModuleName] = useState('');

  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  const [scriptNameInput, setScriptNameInput] = useState('');
  const [scriptDescInput, setScriptDescInput] = useState('');
  const [scriptModalError, setScriptModalError] = useState<string | null>(null);

  // NLP Search & Add Modal (Section 3.4)
  const [isNlpPickerOpen, setIsNlpPickerOpen] = useState(false);
  const [nlpSearchQuery, setNlpSearchQuery] = useState('');
  const [selectedNlpCategory, setSelectedNlpCategory] = useState<string>('All');
  const [insertAfterStepNum, setInsertAfterStepNum] = useState<number | undefined>(undefined);

  // Element Picker Modal (Section 5)
  const [isElementPickerOpen, setIsElementPickerOpen] = useState(false);
  const [elementPickerStepId, setElementPickerStepId] = useState<string | null>(null);
  const [elementSearchQuery, setElementSearchQuery] = useState('');
  const [elementPickerCategory, setElementPickerCategory] = useState<'All' | 'AI' | 'Repository'>('All');

  // Variables Drawer (Section 7)
  const [isVariablesModalOpen, setIsVariablesModalOpen] = useState(false);
  const [activeVarTab, setActiveVarTab] = useState<'Local' | 'Global'>('Local');
  const [newVarName, setNewVarName] = useState('');
  const [newVarValue, setNewVarValue] = useState('');
  const [newVarType, setNewVarType] = useState<'String' | 'Number' | 'Boolean' | 'Encrypted'>('String');
  const [newVarDesc, setNewVarDesc] = useState('');
  const [varError, setVarError] = useState<string | null>(null);

  // Run Settings Modal (Section 8)
  const [isRunSettingsOpen, setIsRunSettingsOpen] = useState(false);
  const [tempSettings, setTempSettings] = useState<RunSettings>(runSettings);
  const [isRunningScript, setIsRunningScript] = useState(false);

  // Playwright TypeScript Code Modal
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // Step Parameter Edit Drawer
  const [editingStep, setEditingStep] = useState<ScriptStep | null>(null);

  // Variable suggestion autocomplete state (Section 9.4)
  const [varAutoComplete, setVarAutoComplete] = useState<{
    inputId: string;
    currentValue: string;
    query: string;
    onSelect: (val: string) => void;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Accordion Step Management State (Single expanded step, default collapsed)
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [newlyAddedStepId, setNewlyAddedStepId] = useState<string | null>(null);
  const [draftStep, setDraftStep] = useState<ScriptStep | null>(null);
  const [originalStepBeforeEdit, setOriginalStepBeforeEdit] = useState<ScriptStep | null>(null);
  const [stepValidationError, setStepValidationError] = useState<string | null>(null);
  const [isSavingStep, setIsSavingStep] = useState(false);
  const [dirtyConfirmModal, setDirtyConfirmModal] = useState<{
    targetStepId: string | null;
    onProceed: () => void;
  } | null>(null);

  // Script Deletion Confirmation & Dependency Protection State
  const [scriptToDelete, setScriptToDelete] = useState<AutomationScript | null>(null);
  const [deleteScriptDependencyWarning, setDeleteScriptDependencyWarning] = useState<Array<{ id: string; name: string }> | null>(null);
  const [isDeletingScript, setIsDeletingScript] = useState(false);

  // Multi-select & Bulk Delete State
  const [selectedScriptIds, setSelectedScriptIds] = useState<Set<string>>(new Set());
  const [isBulkDeletingScripts, setIsBulkDeletingScripts] = useState(false);

  // Helper: Single source of truth for element mode from Repository (completely depending on valueType)
  const getStepElementMode = (step: ScriptStep): 'Static' | 'Dynamic' => {
    if (step.elementId) {
      const repoElem = repoElements.find(e => e.id === step.elementId);
      if (repoElem) {
        const primary = repoElem.locators?.find(l => l.isPrimary) || repoElem.locators?.[0];
        if (primary?.valueType) {
          return primary.valueType;
        }
        if (repoElem.elementMode) {
          return repoElem.elementMode;
        }
      }
    }
    if ((step.locator as any)?.valueType) {
      return (step.locator as any).valueType;
    }
    return step.elementMode || 'Static';
  };

  // Helper: Concise summary for collapsed accordion view
  const getStepSummary = (step: ScriptStep): string => {
    const repoElem = repoElements.find(e => e.id === step.elementId);
    const elemName = step.elementName || repoElem?.name;
    const stepNumStr = String(step.stepNumber).padStart(2, '0');

    if (step.nlpId === 'static_wait') {
      const dur = step.parameters?.waitDuration || 1;
      return `${stepNumStr}. Static Wait – ${dur} Second${Number(dur) === 1 ? '' : 's'}`;
    }
    if (step.nlpId === 'navigate_to_url') {
      return `${stepNumStr}. Navigate To URL – ${step.parameters?.url || 'URL not set'}`;
    }
    if (step.nlpId === 'enter_text') {
      const val = step.parameters?.text !== undefined ? step.parameters?.text : (step.parameters?.inputData || '');
      return `${stepNumStr}. Enter Text "${val}" – ${elemName || 'Element not set'}`;
    }
    if (step.nlpCategory === 'Wait') {
      const dur = step.parameters?.waitDuration;
      const durText = dur ? ` – ${dur}s Timeout` : '';
      return `${stepNumStr}. ${step.nlpName}${elemName ? ` – ${elemName}` : ''}${durText}`;
    }
    if (step.nlpCategory === 'Verification') {
      const dur = step.parameters?.waitDuration;
      const durText = dur ? ` (${dur}s max)` : '';
      return `${stepNumStr}. ${step.nlpName}${elemName ? ` – ${elemName}` : ''}${durText}`;
    }
    if (elemName) {
      return `${stepNumStr}. ${step.nlpName} – ${elemName}`;
    }
    return `${stepNumStr}. ${step.nlpName}`;
  };

  // Check if draft step has been modified
  const isStepModified = useMemo(() => {
    if (!draftStep || !originalStepBeforeEdit) return false;
    return JSON.stringify(draftStep) !== JSON.stringify(originalStepBeforeEdit);
  }, [draftStep, originalStepBeforeEdit]);

  useEffect(() => {
    loadAllData();
    // Application-wide automatic synchronization (Section 8)
    const unsub = api.repository.onElementChanged(async () => {
      try {
        const [elemRes, scrRes] = await Promise.all([
          api.repository.getElements(project.id),
          api.scripts.getScripts(project.id)
        ]);
        if (elemRes.success && elemRes.elements) {
          setRepoElements(elemRes.elements);
        }
        if (scrRes.success && scrRes.scripts) {
          setScripts(scrRes.scripts);
          setActiveScript(prev => prev ? (scrRes.scripts.find((s: AutomationScript) => s.id === prev.id) || prev) : null);
        }
      } catch (err) {
        console.error('Failed to auto-sync repository changes in scripts:', err);
      }
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [project.id]);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [modRes, scrRes, varRes, setRes, pagesRes, elemRes] = await Promise.all([
        api.scripts.getModules(project.id),
        api.scripts.getScripts(project.id),
        api.scripts.getVariables(project.id),
        api.scripts.getRunSettings(project.id),
        api.repository.getPages(project.id),
        api.repository.getElements(project.id)
      ]);

      if (modRes.success && modRes.modules) {
        setModules(modRes.modules);
        const rootIds = new Set<string>((modRes.modules || []).filter((m: ScriptModule) => !m.parentId).map((m: ScriptModule) => String(m.id)));
        setExpandedModuleIds(rootIds);
        setSelectedModuleId(prev => {
          if (prev && modRes.modules.some((m: ScriptModule) => m.id === prev)) {
            return prev;
          }
          const firstRoot = modRes.modules.find((m: ScriptModule) => !m.parentId);
          return firstRoot ? firstRoot.id : null;
        });
      }

      if (scrRes.success && scrRes.scripts) {
        setScripts(scrRes.scripts);
      }

      if (varRes.success && varRes.variables) {
        setVariables(varRes.variables);
      }

      if (setRes.success && setRes.settings) {
        setRunSettings(setRes.settings);
        setTempSettings(setRes.settings);
      }

      if (pagesRes.success && pagesRes.pages) {
        setRepoPages(pagesRes.pages);
      }

      if (elemRes.success && elemRes.elements) {
        setRepoElements(elemRes.elements);
      }
    } catch (err) {
      console.error('Failed to load TestDev scripts data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const showSuccessBanner = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 3500);
  };

  // --- Module Tree Operations ---
  const handleToggleExpand = (modId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedModuleIds(prev => {
      const next = new Set(prev);
      if (next.has(modId)) next.delete(modId);
      else next.add(modId);
      return next;
    });
  };

  const handleOpenCreateModule = (parentId: string | null = null, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const validParentId = parentId && modules.some(m => m.id === parentId) ? parentId : null;
    setModuleParentId(validParentId);
    setModuleNameInput('');
    setModuleModalError(null);
    setIsModuleModalOpen(true);
  };

  const handleCreateModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleNameInput.trim()) {
      setModuleModalError('Module name cannot be empty.');
      return;
    }
    try {
      const res = await api.scripts.createModule(project.id, moduleNameInput.trim(), moduleParentId);
      if (res.success && res.module) {
        setModules(prev => [...prev, res.module]);
        if (moduleParentId) {
          setExpandedModuleIds(prev => new Set([...prev, moduleParentId]));
        }
        setSelectedModuleId(res.module.id);
        setIsModuleModalOpen(false);
        showSuccessBanner(`Module "${res.module.name}" created successfully.`);
        await loadAllData();
      } else {
        setModuleModalError(res.error || 'Failed to create module.');
      }
    } catch (err: any) {
      setModuleModalError(err.message || 'Error creating module.');
    }
  };

  const handleRenameModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleToRename || !renameModuleName.trim()) return;
    try {
      const res = await api.scripts.updateModule(moduleToRename.id, project.id, renameModuleName.trim());
      if (res.success && res.module) {
        setModules(prev => prev.map(m => (m.id === res.module.id ? res.module : m)));
        setModuleToRename(null);
        showSuccessBanner(`Module renamed to "${res.module.name}".`);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to rename module.');
    }
  };

  const handleDeleteModule = async (module: ScriptModule, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete module "${module.name}"? All submodules and scripts inside will be deleted.`)) {
      return;
    }
    try {
      const res = await api.scripts.deleteModule(module.id, project.id);
      if (res.success) {
        setSelectedModuleId(null);
        setModuleParentId(null);
        if (activeScript && (activeScript.moduleId === module.id || !modules.some(m => m.id === activeScript.moduleId))) {
          setActiveScript(null);
        }
        await loadAllData();
        showSuccessBanner(`Module "${module.name}" and contained scripts deleted.`);
      } else {
        alert(res.error || 'Failed to delete module.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete module.');
    }
  };

  // --- Script Operations ---
  const handleOpenCreateScript = () => {
    if (modules.length === 0) {
      handleOpenCreateModule(null);
      return;
    }
    if (!selectedModuleId) {
      const firstRoot = modules.find(m => !m.parentId);
      if (firstRoot) {
        setSelectedModuleId(firstRoot.id);
      } else {
        handleOpenCreateModule(null);
        return;
      }
    }
    setScriptNameInput('');
    setScriptDescInput('');
    setScriptModalError(null);
    setIsScriptModalOpen(true);
  };

  const handleCreateScript = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedModuleId) return;
    if (!scriptNameInput.trim()) {
      setScriptModalError('Script name cannot be empty.');
      return;
    }
    try {
      const res = await api.scripts.createScript(
        project.id,
        selectedModuleId,
        scriptNameInput.trim(),
        currentUser?.email || 'User',
        scriptDescInput.trim()
      );
      if (res.success && res.script) {
        setScripts(prev => [...prev, res.script]);
        setIsScriptModalOpen(false);
        setActiveScript(res.script);
        showSuccessBanner(`Script "${res.script.name}" created.`);
      } else {
        setScriptModalError(res.error || 'Failed to create script.');
      }
    } catch (err: any) {
      setScriptModalError(err.message || 'Error creating script.');
    }
  };

  // --- Delete Script with Modal & Suite Dependency Protection ---
  const handleRequestDeleteScript = async (script: AutomationScript, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setScriptToDelete(script);
    setDeleteScriptDependencyWarning(null);
    try {
      const deps = await api.scripts.checkDependencies(script.id, project.id);
      if (deps.hasDependencies && deps.dependentSuites && deps.dependentSuites.length > 0) {
        setDeleteScriptDependencyWarning(deps.dependentSuites);
      }
    } catch (err) {
      console.error('Failed to check script dependencies:', err);
    }
  };

  const handleConfirmDeleteScript = async (force: boolean = false) => {
    if (!scriptToDelete) return;
    setIsDeletingScript(true);
    try {
      const res = await api.scripts.deleteScript(scriptToDelete.id, project.id, force);
      if (res.success) {
        setScripts(prev => prev.filter(s => s.id !== scriptToDelete.id));
        if (activeScript?.id === scriptToDelete.id) {
          setActiveScript(null);
        }
        showSuccessBanner(`Script "${scriptToDelete.name}" deleted successfully.`);
        setScriptToDelete(null);
        setDeleteScriptDependencyWarning(null);
      } else if (res.hasDependencies && res.dependentSuites) {
        setDeleteScriptDependencyWarning(res.dependentSuites);
      } else {
        alert(res.error || 'Failed to delete script');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete script');
    } finally {
      setIsDeletingScript(false);
    }
  };

  const handleToggleSelectScript = (scriptId: string, e: React.MouseEvent | React.ChangeEvent) => {
    e.stopPropagation();
    setSelectedScriptIds(prev => {
      const next = new Set(prev);
      if (next.has(scriptId)) next.delete(scriptId);
      else next.add(scriptId);
      return next;
    });
  };

  const handleToggleSelectAllScripts = () => {
    if (selectedScriptIds.size === filteredScripts.length) {
      setSelectedScriptIds(new Set());
    } else {
      setSelectedScriptIds(new Set(filteredScripts.map(s => s.id)));
    }
  };

  const handleBulkDeleteScripts = async () => {
    if (selectedScriptIds.size === 0) return;
    const count = selectedScriptIds.size;
    if (!window.confirm(`Are you sure you want to delete ${count} selected script(s)? This will also remove them from any suites.`)) {
      return;
    }

    setIsBulkDeletingScripts(true);
    try {
      for (const sId of Array.from(selectedScriptIds)) {
        await api.scripts.deleteScript(sId, project.id, true);
      }
      setScripts(prev => prev.filter(s => !selectedScriptIds.has(s.id)));
      if (activeScript && selectedScriptIds.has(activeScript.id)) {
        setActiveScript(null);
      }
      showSuccessBanner(`Successfully deleted ${count} script(s).`);
      setSelectedScriptIds(new Set());
    } catch (err: any) {
      alert(err.message || 'Error deleting scripts');
    } finally {
      setIsBulkDeletingScripts(false);
    }
  };

  // --- Accordion Step Validation ---
  const validateStep = (step: ScriptStep): string | null => {
    const nlpDef = NLP_CATALOG.find(n => n.id === step.nlpId);
    if (!nlpDef) return null;

    if (nlpDef.requiresElement && !step.elementId && !step.locator?.value) {
      return 'Element selection is mandatory for this step. Please select an element from the Repository.';
    }

    // Validate waitDuration for Wait and Verification NLPs
    if (nlpDef.category === 'Wait' || nlpDef.category === 'Verification') {
      const dur = step.parameters?.waitDuration;
      if (dur === undefined || dur === '' || isNaN(Number(dur)) || Number(dur) <= 0) {
        return 'Wait Duration is mandatory and must be a positive number greater than 0.';
      }
      if (Number(dur) > 300) {
        return 'Wait Duration cannot exceed 300 seconds.';
      }
    }

    for (const rp of nlpDef.requiredParams) {
      if (rp.name === 'waitDuration') continue;
      const val = step.parameters?.[rp.name];
      if (val === undefined || val === null || String(val).trim() === '') {
        return `"${rp.label}" is required.`;
      }
      if (rp.type === 'number') {
        const num = Number(val);
        if (isNaN(num)) return `"${rp.label}" must be a valid number.`;
        if ((rp as any).validation?.min !== undefined && num < (rp as any).validation.min) {
          return `"${rp.label}" must be at least ${(rp as any).validation.min}.`;
        }
        if ((rp as any).validation?.max !== undefined && num > (rp as any).validation.max) {
          return `"${rp.label}" cannot exceed ${(rp as any).validation.max}.`;
        }
      }
    }

    const stepMode = getStepElementMode(step);
    if (stepMode === 'Dynamic' && step.locator) {
      const placeholders = extractDynamicPlaceholders(step.locator, 'Dynamic');
      for (const ph of placeholders) {
        const dv = step.parameters?.dynamicValues?.[ph];
        if (dv === undefined || dv === null || String(dv).trim() === '') {
          return `Dynamic placeholder "${ph}" requires a runtime value.`;
        }
      }
    }

    return null;
  };

  // --- Step Management & Add Step Actions (Section 3.3 & 3.4) ---
  const handleOpenNlpPicker = (insertAfterStep?: number) => {
    setInsertAfterStepNum(insertAfterStep);
    setNlpSearchQuery('');
    setSelectedNlpCategory('All');
    setIsNlpPickerOpen(true);
  };

  const handleSelectNlp = async (nlp: NlpDefinition) => {
    if (!activeScript) return;
    setIsNlpPickerOpen(false);

    // Initial parameters with defaults or empty strings for required parameters
    const params: Record<string, any> = {};
    nlp.requiredParams.forEach(p => {
      params[p.name] = p.defaultValue !== undefined ? p.defaultValue : (p.name === 'waitDuration' ? 5 : '');
    });
    nlp.optionalParams?.forEach(p => {
      if (p.defaultValue !== undefined) params[p.name] = p.defaultValue;
    });

    try {
      const res = await api.scripts.addStep(
        activeScript.id,
        project.id,
        {
          nlpId: nlp.id,
          nlpName: nlp.name,
          nlpCategory: nlp.category,
          description: nlp.description,
          parameters: params,
          isEnabled: true
        },
        insertAfterStepNum
      );

      if (res.success && res.script) {
        setActiveScript(res.script);
        setScripts(prev => prev.map(s => (s.id === res.script.id ? res.script : s)));

        // Find the newly inserted step
        const newStepIndex = insertAfterStepNum !== undefined ? insertAfterStepNum : res.script.steps.length - 1;
        const targetStep = res.script.steps[newStepIndex];

        if (targetStep) {
          // Auto-expand ONLY the new step with [Save Step] and [Cancel]
          setExpandedStepId(targetStep.id);
          setNewlyAddedStepId(targetStep.id);
          setDraftStep(JSON.parse(JSON.stringify(targetStep)));
          setOriginalStepBeforeEdit(JSON.parse(JSON.stringify(targetStep)));
          setStepValidationError(null);

          // If NLP requires an element, also prompt element picker immediately
          if (nlp.requiresElement) {
            setElementPickerStepId(targetStep.id);
            setElementSearchQuery('');
            setIsElementPickerOpen(true);
          }
        }
        showSuccessBanner(`Added step "${nlp.name}". Configure parameters and click Save Step.`);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to add step.');
    }
  };

  // --- Accordion Step Expansion / Collapse Handlers ---
  const handleStepClick = (step: ScriptStep) => {
    if (expandedStepId === step.id) {
      handleRequestCollapse();
      return;
    }

    if (expandedStepId && isStepModified) {
      setDirtyConfirmModal({
        targetStepId: step.id,
        onProceed: () => {
          expandStep(step);
        }
      });
      return;
    }

    expandStep(step);
  };

  const expandStep = (step: ScriptStep) => {
    setExpandedStepId(step.id);
    setNewlyAddedStepId(null);
    setDraftStep(JSON.parse(JSON.stringify(step)));
    setOriginalStepBeforeEdit(JSON.parse(JSON.stringify(step)));
    setStepValidationError(null);
  };

  const handleRequestCollapse = () => {
    if (isStepModified) {
      setDirtyConfirmModal({
        targetStepId: null,
        onProceed: () => {
          collapseStep();
        }
      });
      return;
    }
    collapseStep();
  };

  const collapseStep = () => {
    if (newlyAddedStepId) {
      handleDeleteStep(newlyAddedStepId);
      setNewlyAddedStepId(null);
    }
    setExpandedStepId(null);
    setDraftStep(null);
    setOriginalStepBeforeEdit(null);
    setStepValidationError(null);
  };

  const handleDraftParamChange = (paramKey: string, val: any) => {
    if (!draftStep) return;
    setDraftStep({
      ...draftStep,
      parameters: {
        ...(draftStep.parameters || {}),
        [paramKey]: val
      }
    });
    if (stepValidationError) setStepValidationError(null);
  };

  const handleDraftDynamicValueChange = (placeholder: string, val: string) => {
    if (!draftStep) return;
    const curDyn = { ...(draftStep.parameters?.dynamicValues || {}) };
    curDyn[placeholder] = val;
    setDraftStep({
      ...draftStep,
      parameters: {
        ...(draftStep.parameters || {}),
        dynamicValues: curDyn
      }
    });
    if (stepValidationError) setStepValidationError(null);
  };

  const handleSaveStep = async (stepToSave: ScriptStep) => {
    if (!activeScript) return;
    const validationErr = validateStep(stepToSave);
    if (validationErr) {
      setStepValidationError(validationErr);
      return;
    }
    setStepValidationError(null);
    setIsSavingStep(true);

    try {
      const res = await api.scripts.updateStep(
        activeScript.id,
        project.id,
        stepToSave.id,
        {
          parameters: stepToSave.parameters,
          elementId: stepToSave.elementId,
          elementName: stepToSave.elementName,
          elementMode: stepToSave.elementMode,
          elementVersion: stepToSave.elementVersion,
          pageName: stepToSave.pageName,
          locator: stepToSave.locator
        }
      );

      if (res.success && res.script) {
        setActiveScript(res.script);
        setScripts(prev => prev.map(s => (s.id === res.script.id ? res.script : s)));
        showSuccessBanner(`Step "${stepToSave.nlpName}" ${newlyAddedStepId === stepToSave.id ? 'saved' : 'updated'} successfully.`);
        setExpandedStepId(null);
        setNewlyAddedStepId(null);
        setDraftStep(null);
        setOriginalStepBeforeEdit(null);
      } else {
        setStepValidationError(res.error || 'Failed to save step.');
      }
    } catch (err: any) {
      setStepValidationError(err.message || 'Error saving step.');
    } finally {
      setIsSavingStep(false);
    }
  };

  const handleCancelStep = (stepId: string) => {
    if (newlyAddedStepId === stepId) {
      handleDeleteStep(stepId);
      setNewlyAddedStepId(null);
      setExpandedStepId(null);
      setDraftStep(null);
      setOriginalStepBeforeEdit(null);
      setStepValidationError(null);
    } else {
      setExpandedStepId(null);
      setDraftStep(null);
      setOriginalStepBeforeEdit(null);
      setStepValidationError(null);
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    if (!activeScript) return;
    try {
      const res = await api.scripts.deleteStep(activeScript.id, project.id, stepId);
      if (res.success && res.script) {
        setActiveScript(res.script);
        setScripts(prev => prev.map(s => (s.id === res.script.id ? res.script : s)));
        showSuccessBanner('Step deleted.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete step.');
    }
  };

  const handleDuplicateStep = async (stepId: string) => {
    if (!activeScript) return;
    try {
      const res = await api.scripts.duplicateStep(activeScript.id, project.id, stepId);
      if (res.success && res.script) {
        setActiveScript(res.script);
        setScripts(prev => prev.map(s => (s.id === res.script.id ? res.script : s)));
        showSuccessBanner('Step duplicated.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to duplicate step.');
    }
  };

  const handleMoveStep = async (stepIndex: number, direction: 'up' | 'down') => {
    if (!activeScript) return;
    const targetIndex = direction === 'up' ? stepIndex - 1 : stepIndex + 1;
    if (targetIndex < 0 || targetIndex >= activeScript.steps.length) return;

    const newStepIds = [...activeScript.steps.map(s => s.id)];
    const temp = newStepIds[stepIndex];
    newStepIds[stepIndex] = newStepIds[targetIndex];
    newStepIds[targetIndex] = temp;

    try {
      const res = await api.scripts.reorderSteps(activeScript.id, project.id, newStepIds);
      if (res.success && res.script) {
        setActiveScript(res.script);
        setScripts(prev => prev.map(s => (s.id === res.script.id ? res.script : s)));
      }
    } catch (err: any) {
      console.error('Failed to move step:', err);
    }
  };

  const handleInlineParamChange = (stepId: string, paramKey: string, val: string) => {
    setActiveScript(prev => {
      if (!prev) return null;
      return {
        ...prev,
        steps: prev.steps.map(s => {
          if (s.id === stepId) {
            return {
              ...s,
              parameters: { ...(s.parameters || {}), [paramKey]: val }
            };
          }
          return s;
        })
      };
    });
  };

  const handleSaveInlineParam = async (stepId: string) => {
    if (!activeScript) return;
    const targetStep = activeScript.steps.find(s => s.id === stepId);
    if (!targetStep) return;
    try {
      await api.scripts.updateStep(activeScript.id, project.id, stepId, {
        parameters: targetStep.parameters
      });
    } catch (err: any) {
      console.warn('Failed to auto-save parameter:', err);
    }
  };

  const handleInlineUrlChange = (stepId: string, url: string) => handleInlineParamChange(stepId, 'url', url);
  const handleSaveInlineUrl = handleSaveInlineParam;

  const handleDynamicValueChange = (stepId: string, placeholderKey: string, val: string) => {
    setActiveScript(prev => {
      if (!prev) return null;
      return {
        ...prev,
        steps: prev.steps.map(s => {
          if (s.id === stepId) {
            const currentDyn = { ...(s.parameters?.dynamicValues || {}) };
            currentDyn[placeholderKey] = val;
            return {
              ...s,
              parameters: { ...(s.parameters || {}), dynamicValues: currentDyn }
            };
          }
          return s;
        })
      };
    });
  };

  const handleSaveDynamicValue = async (stepId: string, placeholderKey?: string, val?: string) => {
    if (!activeScript) return;
    const targetStep = activeScript.steps.find(s => s.id === stepId);
    if (!targetStep) return;
    try {
      const currentDyn = { ...(targetStep.parameters?.dynamicValues || {}) };
      if (placeholderKey !== undefined && val !== undefined) {
        currentDyn[placeholderKey] = val;
      }
      const updatedParams = {
        ...(targetStep.parameters || {}),
        dynamicValues: currentDyn
      };
      await api.scripts.updateStep(activeScript.id, project.id, stepId, {
        parameters: updatedParams
      });
    } catch (err: any) {
      console.warn('Failed to auto-save dynamic value:', err);
    }
  };

  // --- Repository Element Mapping (Section 5) ---
  const handleMapElementToStep = async (element: RepositoryElement) => {
    if (!activeScript || !elementPickerStepId) return;

    const page = repoPages.find(p => p.id === element.pageId);
    const primaryLoc = element.locators.find(l => l.isPrimary) || element.locators[0];
    const targetStep = activeScript.steps.find(s => s.id === elementPickerStepId);
    const elemMode: 'Static' | 'Dynamic' = primaryLoc?.valueType || element.elementMode || 'Static';

    const placeholders = extractDynamicPlaceholders(primaryLoc, elemMode);
    const updatedDynValues: Record<string, string> = { ...(targetStep?.parameters?.dynamicValues || {}) };
    placeholders.forEach(ph => {
      if (updatedDynValues[ph] === undefined) {
        updatedDynValues[ph] = '';
      }
    });

    const updatedParams = {
      ...(targetStep?.parameters || {}),
      ...(placeholders.length > 0 ? { dynamicValues: updatedDynValues } : {})
    };

    if (draftStep && draftStep.id === elementPickerStepId) {
      setDraftStep({
        ...draftStep,
        elementId: element.id,
        elementName: element.name,
        elementMode: elemMode,
        elementVersion: element.version || 1,
        pageName: page?.name || 'Repository Page',
        locator: primaryLoc,
        parameters: updatedParams
      });
    }

    try {
      const res = await api.scripts.updateStep(activeScript.id, project.id, elementPickerStepId, {
        elementId: element.id,
        elementName: element.name,
        elementMode: elemMode,
        elementVersion: element.version || 1,
        pageName: page?.name || 'Repository Page',
        locator: primaryLoc,
        parameters: updatedParams
      });

      if (res.success && res.script) {
        setActiveScript(res.script);
        setScripts(prev => prev.map(s => (s.id === res.script.id ? res.script : s)));
        setIsElementPickerOpen(false);
        setElementPickerStepId(null);
        if (placeholders.length > 0) {
          showSuccessBanner(`Dynamic element "${element.name}" mapped! Please enter the dynamic value below.`);
        } else {
          showSuccessBanner(`Mapped element "${element.name}" to step.`);
        }
      }
    } catch (err: any) {
      alert(err.message || 'Failed to map element.');
    }
  };

  // --- Variables Management (Section 7) ---
  const handleCreateVariable = async (e: React.FormEvent) => {
    e.preventDefault();
    setVarError(null);
    if (!newVarName.trim()) {
      setVarError('Variable name cannot be empty.');
      return;
    }
    try {
      const res = await api.scripts.createVariable(project.id, {
        name: newVarName.trim(),
        type: activeVarTab,
        dataType: newVarType,
        value: newVarValue,
        description: newVarDesc.trim(),
        scriptId: activeVarTab === 'Local' ? activeScript?.id : null
      });

      if (res.success && res.variable) {
        setVariables(prev => [...prev, res.variable]);
        setNewVarName('');
        setNewVarValue('');
        setNewVarDesc('');
        showSuccessBanner(`Created ${activeVarTab.toLowerCase()} variable "$${res.variable.name}".`);
      } else {
        setVarError(res.error || 'Failed to create variable.');
      }
    } catch (err: any) {
      setVarError(err.message || 'Error creating variable.');
    }
  };

  const handleDeleteVariable = async (varId: string) => {
    try {
      const res = await api.scripts.deleteVariable(varId, project.id);
      if (res.success) {
        setVariables(prev => prev.filter(v => v.id !== varId));
        showSuccessBanner('Variable deleted.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete variable.');
    }
  };

  // Autocomplete Variable Suggestion Trigger (Section 9.4)
  const handleInputWithVarSuggestions = (
    inputId: string,
    val: string,
    updateParamFn: (newVal: string) => void
  ) => {
    updateParamFn(val);
    const lastDollar = val.lastIndexOf('$');
    if (lastDollar !== -1) {
      const query = val.slice(lastDollar + 1).toLowerCase();
      if (!query.includes(' ') && !query.includes('/')) {
        setVarAutoComplete({
          inputId,
          currentValue: val,
          query,
          onSelect: updateParamFn
        });
        return;
      }
    }
    setVarAutoComplete(null);
  };

  const handleSelectVariable = (varName: string) => {
    if (!varAutoComplete) return;
    const val = varAutoComplete.currentValue;
    const lastDollar = val.lastIndexOf('$');
    const prefix = lastDollar >= 0 ? val.slice(0, lastDollar) : '';
    const newVal = `${prefix}$${varName}`;
    varAutoComplete.onSelect(newVal);
    setVarAutoComplete(null);
  };

  const renderVariableDropdown = (inputId: string) => {
    if (!varAutoComplete || varAutoComplete.inputId !== inputId) return null;

    const query = varAutoComplete.query;
    const currentLocal = variables.filter(
      v => v.type === 'Local' && (!v.scriptId || v.scriptId === activeScript?.id)
    );
    const currentGlobal = variables.filter(v => v.type === 'Global');

    const matchingLocal = query === ''
      ? currentLocal
      : currentLocal.filter(v => v.name.toLowerCase().includes(query));

    const matchingGlobal = query === ''
      ? currentGlobal
      : currentGlobal.filter(v => v.name.toLowerCase().includes(query));

    const hasAnyMatches = matchingLocal.length > 0 || matchingGlobal.length > 0;

    return (
      <div
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
        className="absolute left-0 right-0 top-full mt-1.5 bg-slate-900 border border-brand-500/60 rounded-2xl shadow-2xl p-2 z-50 max-h-64 overflow-y-auto divide-y divide-slate-800 animate-fadeIn font-sans"
      >
        <div className="flex items-center justify-between px-2 py-1 text-[10px] text-slate-400 font-semibold border-b border-slate-800/80 mb-1">
          <span>Variables matching &quot;${query}&quot;</span>
          <span className="text-slate-500 font-mono text-[9px]">Click to insert</span>
        </div>

        {matchingLocal.length > 0 && (
          <div className="py-1">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider px-2 py-0.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Local Variables ({matchingLocal.length})
            </span>
            <div className="space-y-0.5 mt-0.5">
              {matchingLocal.map(v => (
                <button
                  key={v.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelectVariable(v.name)}
                  className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-emerald-500/10 hover:border hover:border-emerald-500/30 text-xs text-slate-200 flex items-center justify-between group transition-all"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-mono text-emerald-400 font-bold group-hover:text-emerald-300">
                      ${v.name}
                    </span>
                    <span className="text-[11px] text-slate-400 truncate max-w-[160px]">
                      = {v.value || '(empty)'}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 shrink-0">
                    {v.dataType}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {matchingGlobal.length > 0 && (
          <div className="py-1">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider px-2 py-0.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              Global Variables ({matchingGlobal.length})
            </span>
            <div className="space-y-0.5 mt-0.5">
              {matchingGlobal.map(v => (
                <button
                  key={v.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelectVariable(v.name)}
                  className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-amber-500/10 hover:border hover:border-amber-500/30 text-xs text-slate-200 flex items-center justify-between group transition-all"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-mono text-amber-400 font-bold group-hover:text-amber-300">
                      ${v.name}
                    </span>
                    <span className="text-[11px] text-slate-400 truncate max-w-[160px]">
                      = {v.value || '(empty)'}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 shrink-0">
                    {v.dataType}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {!hasAnyMatches && (
          <div className="p-3 text-center text-xs text-slate-400">
            No variables matching <span className="text-amber-400 font-mono font-bold">&quot;${query}&quot;</span> found in this project.
          </div>
        )}

        <div className="p-1.5 border-t border-slate-800 bg-slate-950/40">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setIsVariablesModalOpen(true);
              setVarAutoComplete(null);
            }}
            className="w-full px-2.5 py-1.5 rounded-lg bg-brand-600/20 hover:bg-brand-600/30 border border-brand-500/30 text-[11px] text-brand-300 font-semibold flex items-center justify-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5 text-brand-400" />
            <span>Manage / Add Variables</span>
          </button>
        </div>
      </div>
    );
  };

  // --- Run Settings & Execution (Section 8 & 9) ---
  const handleSaveRunSettings = async (andRun: boolean = false) => {
    try {
      const res = await api.scripts.saveRunSettings(project.id, tempSettings);
      if (res.success && res.settings) {
        setRunSettings(res.settings);
        setIsRunSettingsOpen(false);
        showSuccessBanner('Run settings saved.');
        if (andRun && activeScript) {
          executeCurrentScript(res.settings);
        }
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save run settings.');
    }
  };

  const handleRunClick = () => {
    if (!activeScript) return;
    if (activeScript.steps.length === 0) {
      alert('Please add at least one step before running this script.');
      return;
    }
    // If settings already exist, run directly; otherwise open run settings panel (Section 8.3)
    executeCurrentScript(runSettings);
  };

  const executeCurrentScript = async (settingsToUse: RunSettings) => {
    if (!activeScript) return;
    setIsRunningScript(true);
    try {
      const res = await api.execution.executeScript(project.id, activeScript.id, settingsToUse);
      if (res.success && res.execution) {
        showSuccessBanner(`Execution ${res.execution.id} completed: ${res.execution.status}`);
        // Navigate to Execution module (Section 9)
        onNavigateToExecution(res.execution.id);
      } else {
        alert(res.error || 'Failed to execute script.');
      }
    } catch (err: any) {
      alert(err.message || 'Execution error.');
    } finally {
      setIsRunningScript(false);
    }
  };

  // Filtered lists
  const currentModule = modules.find(m => m.id === selectedModuleId);
  const filteredScripts = selectedModuleId ? scripts.filter(s => s.moduleId === selectedModuleId) : scripts;

  const filteredNlps = NLP_CATALOG.filter(nlp => {
    const matchesCat = selectedNlpCategory === 'All' || nlp.category === selectedNlpCategory;
    const matchesSearch =
      nlp.name.toLowerCase().includes(nlpSearchQuery.toLowerCase()) ||
      nlp.description.toLowerCase().includes(nlpSearchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const filteredElements = repoElements.filter(el => {
    const page = repoPages.find(p => p.id === el.pageId);
    const isAiElement = page?.name.toLowerCase() === 'ai elements' || el.description?.toLowerCase().includes('ai');

    if (elementPickerCategory === 'AI' && !isAiElement) return false;
    if (elementPickerCategory === 'Repository' && isAiElement) return false;

    return el.name.toLowerCase().includes(elementSearchQuery.toLowerCase()) ||
      el.locators.some(l => l.value.toLowerCase().includes(elementSearchQuery.toLowerCase()));
  });

  return (
    <div className="flex h-full bg-slate-950 text-slate-100 overflow-hidden relative">
      {/* Top Action Notification Banner */}
      {actionSuccess && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-medium shadow-2xl flex items-center gap-2 animate-fadeIn backdrop-blur-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* 1. Left Sidebar: Module & Submodule Hierarchy Explorer (Section 2.1) */}
      <aside className="w-72 bg-slate-900/90 border-r border-slate-800 flex flex-col shrink-0 select-none">
        {/* Module Header */}
        <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-brand-400" />
            <span className="text-xs font-bold text-white tracking-wide uppercase">Modules & Scripts</span>
          </div>
          <button
            type="button"
            onClick={() => handleOpenCreateModule(null)}
            className="p-1.5 rounded-lg bg-brand-600/20 hover:bg-brand-600/30 text-brand-300 hover:text-white border border-brand-500/30 transition-all text-xs flex items-center gap-1 font-medium"
            title="Create Root Module"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
        </div>

        {/* Tree Container */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {modules.length === 0 ? (
            <div className="p-4 text-center rounded-xl border border-dashed border-slate-800 bg-slate-900/40 my-4">
              <FolderPlus className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-xs text-slate-300 font-semibold">No modules created</p>
              <p className="text-[11px] text-slate-500 mt-0.5 mb-3">Create a root module to get started</p>
              <button
                type="button"
                onClick={() => handleOpenCreateModule(null)}
                className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-all shadow-md shadow-brand-600/30"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Module</span>
              </button>
            </div>
          ) : (
            modules.filter(m => !m.parentId).map(rootMod => {
            const submodules = modules.filter(m => m.parentId === rootMod.id);
            const isExpanded = expandedModuleIds.has(rootMod.id);
            const isSelected = selectedModuleId === rootMod.id;
            const scriptCount = scripts.filter(s => s.moduleId === rootMod.id || submodules.some(sub => sub.id === s.moduleId)).length;

            return (
              <div key={rootMod.id} className="space-y-0.5">
                {/* Root Module Item */}
                <div
                  onClick={() => setSelectedModuleId(rootMod.id)}
                  className={`group flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-brand-600/20 border border-brand-500/40 text-white font-semibold'
                      : 'hover:bg-slate-800/60 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <button
                      type="button"
                      onClick={(e) => handleToggleExpand(rootMod.id, e)}
                      className="p-0.5 hover:bg-slate-700/50 rounded text-slate-400"
                    >
                      {submodules.length > 0 ? (
                        isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />
                      ) : (
                        <span className="w-3.5 block" />
                      )}
                    </button>
                    {isExpanded ? (
                      <FolderOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    ) : (
                      <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                    <span className="truncate">{rootMod.name}</span>
                  </div>

                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setModuleToRename(rootMod);
                        setRenameModuleName(rootMod.name);
                      }}
                      className="p-1 text-slate-400 hover:text-amber-300 hover:bg-slate-700/50 rounded transition-colors"
                      title="Edit Module Name"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleOpenCreateModule(rootMod.id, e)}
                      className="p-1 text-slate-400 hover:text-brand-300 hover:bg-slate-700/50 rounded transition-colors"
                      title="Add Subfolder"
                    >
                      <FolderPlus className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedModuleId(rootMod.id);
                        setScriptNameInput('');
                        setScriptDescInput('');
                        setScriptModalError(null);
                        setIsScriptModalOpen(true);
                      }}
                      className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-700/50 rounded transition-colors"
                      title="Add Script"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteModule(rootMod, e)}
                      className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-700/50 rounded transition-colors"
                      title="Delete Module"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Submodules & Nested Scripts */}
                {isExpanded && (
                  <div className="pl-4 ml-2 border-l border-slate-800 space-y-0.5">
                    {submodules.map(subMod => {
                      const isSubSelected = selectedModuleId === subMod.id;
                      const subScripts = scripts.filter(s => s.moduleId === subMod.id);

                      return (
                        <div key={subMod.id} className="space-y-0.5">
                          <div
                            onClick={() => setSelectedModuleId(subMod.id)}
                            className={`group flex items-center justify-between px-2 py-1 rounded-lg text-xs cursor-pointer transition-all ${
                              isSubSelected
                                ? 'bg-brand-600/30 text-white font-medium border border-brand-500/30'
                                : 'hover:bg-slate-800/40 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <Folder className="w-3 h-3 text-brand-400 shrink-0" />
                              <span className="truncate">{subMod.name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setModuleToRename(subMod);
                                    setRenameModuleName(subMod.name);
                                  }}
                                  className="p-0.5 text-slate-400 hover:text-amber-300 hover:bg-slate-700/50 rounded transition-colors"
                                  title="Edit Submodule Name"
                                >
                                  <Edit2 className="w-2.5 h-2.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedModuleId(subMod.id);
                                    setScriptNameInput('');
                                    setScriptDescInput('');
                                    setScriptModalError(null);
                                    setIsScriptModalOpen(true);
                                  }}
                                  className="p-0.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-700/50 rounded transition-colors"
                                  title="Add Script"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteModule(subMod, e)}
                                  className="p-0.5 text-slate-400 hover:text-rose-400 hover:bg-slate-700/50 rounded transition-colors"
                                  title="Delete Submodule"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              </div>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {subScripts.length}
                              </span>
                            </div>
                          </div>

                          {/* Scripts under Submodule */}
                          {subScripts.length > 0 && (
                            <div className="pl-3 ml-2 border-l border-slate-800/60 space-y-0.5">
                              {subScripts.map(scr => (
                                <div
                                  key={scr.id}
                                  onClick={() => setActiveScript(scr)}
                                  className={`px-2 py-1 rounded-md text-[11px] cursor-pointer flex items-center justify-between transition-all ${
                                    activeScript?.id === scr.id
                                      ? 'bg-slate-800 text-brand-300 font-medium'
                                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 truncate">
                                    <FileCode className="w-3 h-3 text-purple-400 shrink-0" />
                                    <span className="truncate">{scr.name}</span>
                                  </div>
                                  {scr.lastExecutionStatus && (
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        scr.lastExecutionStatus === 'Passed' ? 'bg-emerald-400' : 'bg-rose-400'
                                      }`}
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

        {/* Global Variables Quick Access at bottom of left sidebar */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60">
          <button
            type="button"
            onClick={() => {
              setActiveVarTab('Global');
              setIsVariablesModalOpen(true);
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 transition-all border border-slate-800"
          >
            <div className="flex items-center gap-2">
              <DollarSign className="w-3.5 h-3.5 text-brand-400" />
              <span>Project Variables</span>
            </div>
            <span className="text-[10px] bg-slate-800 text-brand-300 px-1.5 py-0.5 rounded font-mono">
              {variables.filter(v => v.type === 'Global').length}
            </span>
          </button>
        </div>
      </aside>

      {/* 2. Middle Content Area: Scripts List or Dashboard */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-950">
        {/* Top Header */}
        <header className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>TestDev</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-white font-semibold">{currentModule?.name || 'All Modules'}</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight mt-0.5">
              Automation Scripts
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {filteredScripts.length > 0 && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filteredScripts.length > 0 && selectedScriptIds.size === filteredScripts.length}
                  onChange={handleToggleSelectAllScripts}
                  className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-brand-600 focus:ring-0 cursor-pointer"
                  title={selectedScriptIds.size === filteredScripts.length ? 'Deselect All' : 'Select All'}
                />
                <span className="text-xs text-slate-400">Select All</span>
              </div>
            )}
            <button
              type="button"
              onClick={handleOpenCreateScript}
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-brand-600/30 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create Script</span>
            </button>
          </div>
        </header>

        {/* Bulk Action Toolbar */}
        {selectedScriptIds.size > 0 && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-brand-950/40 border border-brand-500/30 flex items-center justify-between gap-3 shadow-lg animate-fadeIn">
            <div className="flex items-center gap-2 text-xs font-semibold text-brand-300">
              <CheckCircle2 className="w-4 h-4 text-brand-400" />
              <span>{selectedScriptIds.size} Scripts Selected</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBulkDeleteScripts}
                disabled={isBulkDeletingScripts}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-sm"
                title="Delete selected scripts"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected Scripts</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedScriptIds(new Set())}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
                title="Deselect All"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Scripts Grid */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {modules.length === 0 ? (
            <div className="h-96 flex flex-col items-center justify-center text-center p-8 rounded-2xl border border-dashed border-slate-800 bg-slate-900/20">
              <div className="w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mb-4">
                <FolderPlus className="w-7 h-7 text-brand-400" />
              </div>
              <h3 className="text-base font-bold text-white">No Modules in this Project</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md">
                Modules help you organize automation scripts hierarchically. Create your first module to get started.
              </p>
              <button
                type="button"
                onClick={() => handleOpenCreateModule(null)}
                className="mt-5 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-brand-600/30 transition-all hover:scale-[1.02]"
              >
                <FolderPlus className="w-4 h-4" />
                <span>Create First Module</span>
              </button>
            </div>
          ) : filteredScripts.length === 0 ? (
            <div className="h-96 flex flex-col items-center justify-center text-center p-8 rounded-2xl border border-dashed border-slate-800 bg-slate-900/20">
              <FileCode className="w-12 h-12 text-slate-600 mb-3" />
              <h3 className="text-sm font-semibold text-white">No scripts in this module</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Get started by creating your first automation script or select another module from the sidebar.
              </p>
              <button
                type="button"
                onClick={handleOpenCreateScript}
                className="mt-4 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create New Script</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredScripts.map(script => {
                const parentModule = modules.find(m => m.id === script.moduleId);
                const isChecked = selectedScriptIds.has(script.id);

                return (
                  <div
                    key={script.id}
                    onClick={() => setActiveScript(script)}
                    className={`p-5 rounded-2xl border cursor-pointer transition-all shadow-md group flex flex-col justify-between ${
                      isChecked
                        ? 'bg-brand-950/20 border-brand-500/50 shadow-brand-500/5'
                        : 'bg-slate-900/80 border-slate-800 hover:border-brand-500/50'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => handleToggleSelectScript(script.id, e)}
                            onClick={e => e.stopPropagation()}
                            className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-brand-600 focus:ring-0 cursor-pointer shrink-0"
                          />
                          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                            {script.id}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {script.lastExecutionStatus ? (
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                script.lastExecutionStatus === 'Passed'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              }`}
                            >
                              {script.lastExecutionStatus}
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                              Draft
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => handleRequestDeleteScript(script, e)}
                            className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete Script"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h3 className="text-sm font-bold text-white group-hover:text-brand-300 transition-colors">
                        {script.name}
                      </h3>
                      {script.description && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                          {script.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Code2 className="w-3.5 h-3.5 text-brand-400" />
                        <span className="text-slate-300 font-semibold">{script.steps.length} Steps</span>
                      </div>
                      <span className="font-mono text-slate-400">{parentModule?.name || 'General'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* 3. Script Development Slider / Panel (Section 3) */}
      {activeScript && (
        <div className="absolute inset-y-0 right-0 w-full max-w-4xl bg-slate-900 border-l border-slate-800 shadow-2xl z-40 flex flex-col animate-slideLeft">
          {/* 3.1 Script Header (Section 3.1) */}
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveScript(null)}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-all"
                title="Close Script Panel"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded-full">
                    {activeScript.id}
                  </span>
                  <span className="text-xs text-slate-400">
                    {modules.find(m => m.id === activeScript.moduleId)?.name}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white tracking-tight mt-0.5">
                  {activeScript.name}
                </h2>
              </div>
            </div>

            {/* Header Actions: Add NLP, Run, Run Settings, Variables */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenNlpPicker()}
                className="px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                title="Add NLP to end of script"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add NLP</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveVarTab('Local');
                  setIsVariablesModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-all"
                title="Manage Variables ($)"
              >
                <DollarSign className="w-3.5 h-3.5 text-brand-400" />
                <span>Variables</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCodeModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-all"
                title="View Playwright TypeScript Code"
              >
                <Code className="w-3.5 h-3.5 text-purple-400" />
                <span>Playwright TS</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTempSettings(runSettings);
                  setIsRunSettingsOpen(true);
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
                title="Run Settings"
              >
                <Sliders className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleRunClick}
                disabled={isRunningScript}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all"
                title="Execute Script"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isRunningScript ? 'Running...' : 'Run'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleRequestDeleteScript(activeScript)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-500/40 transition-all"
                title="Delete Script"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setActiveScript(null)}
                className="p-1.5 text-slate-400 hover:text-slate-200 ml-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Script Meta Bar */}
          <div className="px-6 py-2.5 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-slate-500" />
                Created: {new Date(activeScript.createdAt).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1.5">
                <Code2 className="w-3 h-3 text-brand-400" />
                Total Steps: <strong className="text-white">{activeScript.steps.length}</strong>
              </span>
            </div>
            {activeScript.lastExecutionDate && (
              <span className="font-mono text-slate-500">
                Last Run: {new Date(activeScript.lastExecutionDate).toLocaleTimeString()} ({activeScript.lastExecutionStatus})
              </span>
            )}
          </div>

          {/* 3.2 Step Management Area (Section 3.2) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-slate-950/40">
            {activeScript.steps.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-8 rounded-2xl border border-dashed border-slate-800 bg-slate-900/20">
                <Sparkles className="w-10 h-10 text-brand-400 mb-2" />
                <h4 className="text-sm font-bold text-white">No steps added yet</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Add your first natural-language Playwright instruction to automate this workflow.
                </p>
                <button
                  type="button"
                  onClick={() => handleOpenNlpPicker()}
                  className="mt-4 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add First Step</span>
                </button>
              </div>
            ) : (
              activeScript.steps.map((step, index) => {
                const isExpanded = expandedStepId === step.id;
                const activeEditingStep = isExpanded ? (draftStep || step) : step;
                const stepMode = getStepElementMode(activeEditingStep);
                const nlpDef = NLP_CATALOG.find(n => n.id === activeEditingStep.nlpId);
                const stepHasElement = !!(activeEditingStep.elementId || activeEditingStep.elementName);

                return (
                  <div key={step.id} className="relative group/step">
                    {!isExpanded ? (
                      /* Collapsed Step Row (Default View, Section 4) */
                      <div
                        onClick={() => handleStepClick(step)}
                        className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 cursor-pointer transition-all flex items-center justify-between gap-4 shadow-sm group/row"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-7 h-7 rounded-xl bg-slate-800 border border-slate-700 text-brand-300 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                            {String(step.stepNumber).padStart(2, '0')}
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-500 group-hover/row:text-slate-300 transition-transform shrink-0" />
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded-full shrink-0">
                            {step.nlpCategory}
                          </span>
                          <span className="text-xs font-bold text-white truncate font-sans">
                            {getStepSummary(step)}
                          </span>
                          {stepHasElement && (
                            <span
                              className={`text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider border shrink-0 ${
                                stepMode === 'Dynamic'
                                  ? 'text-purple-400 bg-purple-500/15 border-purple-500/40'
                                  : 'text-slate-400 bg-slate-800 border-slate-700'
                              }`}
                            >
                              {stepMode}
                            </span>
                          )}
                        </div>

                        {/* Collapsed Actions: Move Up, Move Down, Duplicate, Edit, Delete */}
                        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleMoveStep(index, 'up')}
                            disabled={index === 0}
                            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveStep(index, 'down')}
                            disabled={index === activeScript.steps.length - 1}
                            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicateStep(step.id)}
                            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                            title="Duplicate Step"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStepClick(step)}
                            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-brand-300"
                            title="Configure Step"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStep(step.id)}
                            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-400"
                            title="Delete Step"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Expanded Step Card (Single-Step Accordion View, Section 4) */
                      <div className="rounded-2xl bg-slate-900 border-2 border-brand-500/40 shadow-xl overflow-hidden animate-fadeIn">
                        {/* Expanded Header */}
                        <div
                          onClick={handleRequestCollapse}
                          className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between gap-4 cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-7 h-7 rounded-xl bg-brand-600 text-white font-mono text-xs font-bold flex items-center justify-center shrink-0">
                              {String(step.stepNumber).padStart(2, '0')}
                            </div>
                            <ChevronDown className="w-4 h-4 text-brand-400 shrink-0" />
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded-full shrink-0">
                              {activeEditingStep.nlpCategory}
                            </span>
                            <span className="text-sm font-bold text-white truncate font-sans">
                              {activeEditingStep.nlpName}
                            </span>
                            {newlyAddedStepId === step.id && (
                              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/40 px-2 py-0.5 rounded-full animate-pulse shrink-0">
                                New Step
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleMoveStep(index, 'up')}
                              disabled={index === 0}
                              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30"
                              title="Move Up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveStep(index, 'down')}
                              disabled={index === activeScript.steps.length - 1}
                              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30"
                              title="Move Down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateStep(step.id)}
                              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                              title="Duplicate Step"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteStep(step.id)}
                              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-400"
                              title="Delete Step"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Expanded Body */}
                        <div className="p-6 space-y-5 text-xs">
                          <p className="text-slate-400 leading-relaxed text-xs">
                            {activeEditingStep.description}
                          </p>

                          {/* Element Mapping Section */}
                          {nlpDef?.requiresElement && (
                            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                                  <MousePointer className="w-3.5 h-3.5 text-purple-400" />
                                  Target Element (Repository)
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setElementPickerStepId(activeEditingStep.id);
                                      setElementSearchQuery('');
                                      setElementPickerCategory('AI');
                                      setIsElementPickerOpen(true);
                                    }}
                                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 transition-all flex items-center gap-1.5"
                                    title="Explicitly assign an element captured by AI Auto Testing"
                                  >
                                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                                    <span>Assign AI Element</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setElementPickerStepId(activeEditingStep.id);
                                      setElementSearchQuery('');
                                      setElementPickerCategory('All');
                                      setIsElementPickerOpen(true);
                                    }}
                                    className="px-3 py-1 text-xs font-semibold rounded-lg bg-brand-600/20 hover:bg-brand-600/30 text-brand-300 border border-brand-500/30 transition-all"
                                  >
                                    {stepHasElement ? 'Change Element' : 'Select Element'}
                                  </button>
                                </div>
                              </div>

                              {stepHasElement ? (
                                <div className="space-y-2">
                                  {(() => {
                                    const assignedElem = repoElements.find(e => e.id === activeEditingStep.elementId);
                                    const isAiPage = activeEditingStep.pageName?.toLowerCase().includes('ai') || assignedElem?.description?.toLowerCase().includes('ai');

                                    return (
                                      <div className="space-y-1.5">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-sm font-bold text-white font-mono bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                                            {activeEditingStep.elementName}
                                          </span>
                                          {isAiPage && (
                                            <span className="text-[10px] font-semibold text-purple-300 bg-purple-500/20 border border-purple-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                                              <Sparkles className="w-3 h-3 text-purple-400" />
                                              AI Captured
                                            </span>
                                          )}
                                          <span
                                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                                              stepMode === 'Dynamic'
                                                ? 'text-purple-400 bg-purple-500/15 border-purple-500/40'
                                                : 'text-slate-400 bg-slate-800 border-slate-700'
                                            }`}
                                          >
                                            {stepMode}
                                          </span>
                                          <span className="text-xs text-slate-400 font-mono truncate max-w-md">
                                            {activeEditingStep.locator?.type}: {activeEditingStep.locator?.value}
                                          </span>
                                        </div>

                                        {assignedElem && assignedElem.locators && assignedElem.locators.length > 1 && (
                                          <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                                            <span className="text-amber-400 font-semibold flex items-center gap-1">
                                              <Zap className="w-3 h-3" />
                                              Auto-Prioritization:
                                            </span>
                                            <span className="font-mono text-slate-300">
                                              {[...assignedElem.locators]
                                                .sort((a, b) => (a.priority || 1) - (b.priority || 1))
                                                .map((l, i) => `#${l.priority || i + 1} ${l.type}`)
                                                .join(' → ')}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}

                                  {/* Dynamic Placeholders Input Fields (Dynamic Mode Only) */}
                                  {stepMode === 'Dynamic' && activeEditingStep.locator && (() => {
                                    const placeholders = extractDynamicPlaceholders(activeEditingStep.locator, 'Dynamic');
                                    if (placeholders.length === 0) return null;

                                    return (
                                      <div className="mt-3 space-y-2.5 pt-2 border-t border-slate-800/80">
                                        <div className="text-[11px] font-semibold text-purple-300 flex items-center gap-1.5">
                                          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                                          Dynamic Placeholders Detected
                                        </div>
                                        {placeholders.map(ph => {
                                          const rawValue = activeEditingStep.parameters?.dynamicValues?.[ph] || '';
                                          const preview = getResolvedLocatorPreview(activeEditingStep.locator, activeEditingStep.parameters?.dynamicValues, 'Dynamic');

                                          return (
                                            <div key={ph} className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-2">
                                              <div className="flex items-center justify-between gap-2">
                                                <label className="text-[11px] font-semibold text-purple-300 flex items-center gap-1.5">
                                                  <span>Value for</span>
                                                  <code className="text-purple-200 bg-purple-900/50 px-1.5 py-0.5 rounded font-mono border border-purple-500/30">
                                                    {ph}
                                                  </code>
                                                </label>
                                                {!rawValue ? (
                                                  <span className="text-[10px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                                    Value Required
                                                  </span>
                                                ) : (
                                                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                                    Ready
                                                  </span>
                                                )}
                                              </div>
                                              <div className="relative">
                                                <input
                                                  type="text"
                                                  placeholder={`Value to replace ${ph} (or type $ for variables)`}
                                                  value={rawValue}
                                                  onChange={(e) =>
                                                    handleInputWithVarSuggestions(
                                                      `accordion_dyn_${activeEditingStep.id}_${ph}`,
                                                      e.target.value,
                                                      (newV) => handleDraftDynamicValueChange(ph, newV)
                                                    )
                                                  }
                                                  onBlur={() => {
                                                    setTimeout(() => {
                                                      setVarAutoComplete(prev => prev?.inputId === `accordion_dyn_${activeEditingStep.id}_${ph}` ? null : prev);
                                                    }, 200);
                                                  }}
                                                  className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-purple-500/40 rounded-lg text-purple-200 placeholder:text-slate-600 focus:outline-none focus:border-purple-400 font-mono"
                                                />
                                                {renderVariableDropdown(`accordion_dyn_${activeEditingStep.id}_${ph}`)}
                                              </div>
                                              <div className="flex items-center gap-2 text-[11px] font-mono bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800/80 text-slate-400">
                                                <span className="text-slate-500 shrink-0 text-[10px] uppercase font-sans font-bold">Resolved:</span>
                                                <span className="text-purple-300 truncate" title={preview}>
                                                  {preview}
                                                </span>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    );
                                  })()}

                                  {/* Static Element Note */}
                                  {stepMode === 'Static' && (
                                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
                                      <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                                        <span>Static Element – Braces '{ }' are treated as literal characters. No dynamic input required.</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
                                  <span>This NLP action requires a target UI element from the Repository.</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setElementPickerStepId(activeEditingStep.id);
                                      setElementSearchQuery('');
                                      setIsElementPickerOpen(true);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-semibold text-xs"
                                  >
                                    Select Element
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* NLP Parameters Configuration */}
                          <div className="space-y-4">
                            {/* Wait Duration (Seconds) for Wait and Verification NLPs */}
                            {(activeEditingStep.nlpCategory === 'Wait' || activeEditingStep.nlpCategory === 'Verification') && (
                              <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30 space-y-2">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-semibold text-cyan-200 flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                                    <span>Wait Duration (Seconds)</span>
                                    <span className="text-rose-400">*</span>
                                  </label>
                                  <span className="text-[10px] text-cyan-400/80 font-mono">
                                    {activeEditingStep.nlpId === 'static_wait' ? 'Pause duration' : 'Max timeout'}
                                  </span>
                                </div>
                                <input
                                  type="number"
                                  min="0.1"
                                  max="300"
                                  step="1"
                                  value={activeEditingStep.parameters?.waitDuration !== undefined ? activeEditingStep.parameters.waitDuration : (activeEditingStep.nlpId === 'static_wait' ? 1 : 10)}
                                  onChange={(e) => handleDraftParamChange('waitDuration', e.target.value)}
                                  className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-cyan-500/40 rounded-lg text-cyan-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 font-mono"
                                  placeholder="e.g. 5 (seconds)"
                                />
                                <p className="text-[10px] text-slate-400">
                                  {activeEditingStep.nlpId === 'static_wait'
                                    ? 'Execution will pause for this exact duration in seconds.'
                                    : 'Condition will wait up to this duration in seconds and continue immediately once satisfied. Overrides Global Wait Time.'}
                                </p>
                              </div>
                            )}

                            {/* Other NLP parameters */}
                            {nlpDef?.requiredParams.filter(p => p.name !== 'waitDuration').map(param => {
                              const inputId = `accordion_param_${activeEditingStep.id}_${param.name}`;
                              return (
                                <div key={param.name} className="space-y-1.5">
                                  <label className="block text-xs font-semibold text-slate-300">
                                    {param.label} <span className="text-rose-400">*</span>
                                  </label>
                                  {param.options ? (
                                    <select
                                      value={activeEditingStep.parameters?.[param.name] ?? param.defaultValue ?? ''}
                                      onChange={(e) => handleDraftParamChange(param.name, e.target.value)}
                                      className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:border-brand-500"
                                    >
                                      {param.options.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <div className="relative">
                                      <input
                                        type={param.type === 'number' ? 'number' : 'text'}
                                        value={activeEditingStep.parameters?.[param.name] ?? ''}
                                        onChange={(e) =>
                                          handleInputWithVarSuggestions(
                                            inputId,
                                            e.target.value,
                                            (newV) => handleDraftParamChange(param.name, newV)
                                          )
                                        }
                                        onBlur={() => {
                                          setTimeout(() => {
                                            setVarAutoComplete(prev => prev?.inputId === inputId ? null : prev);
                                          }, 200);
                                        }}
                                        placeholder={param.placeholder || `Enter ${param.label} (type $ for variables)`}
                                        className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:border-brand-500 font-mono"
                                      />
                                      {renderVariableDropdown(inputId)}
                                    </div>
                                  )}
                                  {param.description && (
                                    <p className="text-[10px] text-slate-500">{param.description}</p>
                                  )}
                                </div>
                              );
                            })}

                            {nlpDef?.optionalParams?.filter(p => p.name !== 'waitDuration').map(param => {
                              const inputId = `accordion_opt_param_${activeEditingStep.id}_${param.name}`;
                              return (
                                <div key={param.name} className="space-y-1.5">
                                  <label className="block text-xs font-semibold text-slate-400">
                                    {param.label} <span className="text-[10px] text-slate-500 font-normal">(Optional)</span>
                                  </label>
                                  {param.options ? (
                                    <select
                                      value={activeEditingStep.parameters?.[param.name] ?? param.defaultValue ?? ''}
                                      onChange={(e) => handleDraftParamChange(param.name, e.target.value)}
                                      className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:border-brand-500"
                                    >
                                      {param.options.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <div className="relative">
                                      <input
                                        type={param.type === 'number' ? 'number' : 'text'}
                                        value={activeEditingStep.parameters?.[param.name] ?? ''}
                                        onChange={(e) =>
                                          handleInputWithVarSuggestions(
                                            inputId,
                                            e.target.value,
                                            (newV) => handleDraftParamChange(param.name, newV)
                                          )
                                        }
                                        onBlur={() => {
                                          setTimeout(() => {
                                            setVarAutoComplete(prev => prev?.inputId === inputId ? null : prev);
                                          }, 200);
                                        }}
                                        placeholder={param.placeholder || `Enter ${param.label} (type $ for variables)`}
                                        className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:border-brand-500 font-mono"
                                      />
                                      {renderVariableDropdown(inputId)}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Validation Error Alert */}
                          {stepValidationError && (
                            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-fadeIn">
                              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                              <span>{stepValidationError}</span>
                            </div>
                          )}

                          {/* Accordion Footer Action Bar */}
                          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => handleCancelStep(activeEditingStep.id)}
                              disabled={isSavingStep}
                              className="px-4 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            >
                              Cancel
                            </button>
                            {newlyAddedStepId === activeEditingStep.id ? (
                              <button
                                type="button"
                                onClick={() => handleSaveStep(activeEditingStep)}
                                disabled={isSavingStep}
                                className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/40 flex items-center gap-2 transition-all disabled:opacity-50"
                              >
                                {isSavingStep ? (
                                  <>
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    <span>Saving Step...</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Save Step</span>
                                  </>
                                )}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSaveStep(activeEditingStep)}
                                disabled={isSavingStep || !isStepModified}
                                className="px-5 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white shadow-md shadow-brand-900/40 flex items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {isSavingStep ? (
                                  <>
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    <span>Updating Step...</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Update Step</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Add Step (+) option directly below every step */}
                    <div className="h-4 flex items-center justify-center opacity-0 group-hover/step:opacity-100 transition-opacity py-1 my-0.5">
                      <button
                        type="button"
                        onClick={() => handleOpenNlpPicker(step.stepNumber)}
                        className="px-2.5 py-0.5 rounded-full bg-slate-800 hover:bg-brand-600 text-slate-400 hover:text-white text-[10px] font-semibold border border-slate-700 flex items-center gap-1 shadow-md transition-all z-10"
                        title={`Insert Step directly below Step ${step.stepNumber}`}
                      >
                        <Plus className="w-3 h-3" />
                        <span>Insert Step Below</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 4. NLP Search & Selection Modal (Section 3.4 & Section 4) */}
      {isNlpPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-brand-400" />
                  Select Natural Language Action (NLP)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {insertAfterStepNum !== undefined
                    ? `Inserting step immediately below Step ${insertAfterStepNum}`
                    : 'Adding new step at the end of the script'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNlpPickerOpen(false)}
                className="p-2 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Bar & Categories Filter */}
            <div className="p-6 pb-3 space-y-4 border-b border-slate-800 bg-slate-950/60">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Search NLPs by keyword (e.g. click, enter text, excel, verify, wait, scroll)..."
                  value={nlpSearchQuery}
                  onChange={(e) => setNlpSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:border-brand-500"
                  autoFocus
                />
              </div>

              {/* Categories Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setSelectedNlpCategory('All')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    selectedNlpCategory === 'All'
                      ? 'bg-brand-600 text-white font-semibold'
                      : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  All ({NLP_CATALOG.length})
                </button>
                {NLP_CATEGORIES.map(cat => {
                  const count = NLP_CATALOG.filter(n => n.category === cat).length;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedNlpCategory(cat)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                        selectedNlpCategory === cat
                          ? 'bg-brand-600 text-white font-semibold'
                          : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      {cat} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* NLP Catalog List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-2.5">
              {filteredNlps.map(nlp => (
                <div
                  key={nlp.id}
                  onClick={() => handleSelectNlp(nlp)}
                  className="p-3.5 rounded-2xl bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 hover:border-brand-500/50 cursor-pointer transition-all flex items-center justify-between group shadow-sm"
                >
                  <div className="space-y-1 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full border border-brand-500/20">
                        {nlp.category}
                      </span>
                      <h4 className="text-xs font-bold text-white group-hover:text-brand-300">
                        {nlp.name}
                      </h4>
                      {nlp.requiresElement && (
                        <span className="text-[10px] text-purple-400 font-mono flex items-center gap-1">
                          <MousePointer className="w-3 h-3" />
                          Element Required
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {nlp.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-xl bg-slate-900 group-hover:bg-brand-600 text-slate-300 group-hover:text-white text-xs font-medium shrink-0 transition-all"
                  >
                    Select
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. Repository Element Mapping Picker (Section 5) */}
      {isElementPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <MousePointer className="w-5 h-5 text-purple-400" />
                  Select Repository UI Element
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Bind this step to a centralized UI element from your project repository
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsElementPickerOpen(false)}
                className="p-2 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Element Search & Filter Tabs */}
            <div className="p-4 border-b border-slate-800 bg-slate-950/60 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Search repository elements by name or locator value..."
                  value={elementSearchQuery}
                  onChange={(e) => setElementSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:border-brand-500"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setElementPickerCategory('All')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    elementPickerCategory === 'All'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  All Elements ({repoElements.length})
                </button>
                <button
                  type="button"
                  onClick={() => setElementPickerCategory('AI')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    elementPickerCategory === 'AI'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-slate-900 text-purple-400 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  AI Captured ({repoElements.filter(e => {
                    const p = repoPages.find(page => page.id === e.pageId);
                    return p?.name.toLowerCase() === 'ai elements' || e.description?.toLowerCase().includes('ai');
                  }).length})
                </button>
                <button
                  type="button"
                  onClick={() => setElementPickerCategory('Repository')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    elementPickerCategory === 'Repository'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  Repository Pages ({repoElements.filter(e => {
                    const p = repoPages.find(page => page.id === e.pageId);
                    return p?.name.toLowerCase() !== 'ai elements' && !e.description?.toLowerCase().includes('ai');
                  }).length})
                </button>
              </div>
            </div>

            {/* Elements List grouped by page */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {filteredElements.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No elements found matching your search and category filter.
                </div>
              ) : (
                repoPages.map(page => {
                  const pageElems = filteredElements.filter(e => e.pageId === page.id);
                  if (pageElems.length === 0) return null;
                  const isAiPage = page.name.toLowerCase() === 'ai elements';

                  return (
                    <div key={page.id} className="space-y-2">
                      <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                        isAiPage ? 'text-purple-300' : 'text-slate-400'
                      }`}>
                        {isAiPage ? <Sparkles className="w-3.5 h-3.5 text-purple-400" /> : <Folder className="w-3.5 h-3.5 text-purple-400" />}
                        {page.name}
                        {isAiPage && (
                          <span className="text-[10px] lowercase font-normal px-2 py-0.2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300">
                            ai auto testing
                          </span>
                        )}
                      </span>

                      <div className="space-y-1.5 pl-2 border-l border-slate-800">
                        {pageElems.map(el => {
                          const prim = el.locators.find(l => l.isPrimary) || el.locators[0];
                          const sortedLocs = [...el.locators].sort((a, b) => (a.priority || 1) - (b.priority || 1));

                          return (
                            <div
                              key={el.id}
                              onClick={() => handleMapElementToStep(el)}
                              className="p-3 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800/80 hover:border-purple-500/50 cursor-pointer transition-all flex items-center justify-between group shadow-sm"
                            >
                              <div className="space-y-1 flex-1 min-w-0 pr-4">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-white group-hover:text-purple-300">
                                    {el.name}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-mono">({el.type})</span>
                                  {isAiPage && (
                                    <span className="text-[9px] font-semibold text-purple-300 bg-purple-500/20 border border-purple-500/30 px-1.5 py-0.2 rounded-full flex items-center gap-1">
                                      <Sparkles className="w-2.5 h-2.5" />
                                      AI Element
                                    </span>
                                  )}
                                  {prim && prim.valueType === 'Dynamic' && (
                                    <span className="text-[9px] font-semibold text-purple-400 bg-purple-500/10 border border-purple-500/30 px-1.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                                      Dynamic
                                    </span>
                                  )}
                                  {el.learnedLocator && (
                                    <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.2 rounded-full">
                                      Learned
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate max-w-md">
                                  {prim?.type}: {prim?.value}
                                </p>
                                {sortedLocs.length > 1 && (
                                  <p className="text-[10px] text-amber-400/90 font-mono flex items-center gap-1">
                                    <Zap className="w-3 h-3 text-amber-400 shrink-0" />
                                    <span>Priorities: {sortedLocs.map((l, i) => `#${l.priority || i + 1} ${l.type}`).join(' > ')}</span>
                                  </p>
                                )}
                              </div>

                              <button
                                type="button"
                                className="px-3 py-1 rounded-lg bg-slate-900 group-hover:bg-purple-600 text-slate-300 group-hover:text-white text-xs font-medium transition-all shrink-0"
                              >
                                Select
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. Variables Management Drawer / Modal (Section 7) */}
      {isVariablesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-brand-400" />
                  Variables Management
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Manage local script variables and reusable project-level global variables
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsVariablesModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scope Tabs */}
            <div className="px-6 pt-4 pb-2 border-b border-slate-800 flex items-center gap-2 bg-slate-950/60">
              <button
                type="button"
                onClick={() => setActiveVarTab('Local')}
                disabled={!activeScript}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeVarTab === 'Local'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                Local Variables ({variables.filter(v => v.type === 'Local' && v.scriptId === activeScript?.id).length})
              </button>
              <button
                type="button"
                onClick={() => setActiveVarTab('Global')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeVarTab === 'Global'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                Global Variables ({variables.filter(v => v.type === 'Global').length})
              </button>
            </div>

            {/* New Variable Form */}
            <form onSubmit={handleCreateVariable} className="p-6 border-b border-slate-800 space-y-3 bg-slate-950/40">
              {varError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{varError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Variable Name ($)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-brand-400 font-mono text-xs">$</span>
                    <input
                      type="text"
                      placeholder="e.g. username"
                      value={newVarName}
                      onChange={(e) => setNewVarName(e.target.value)}
                      className="w-full pl-7 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:border-brand-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Data Type</label>
                  <select
                    value={newVarType}
                    onChange={(e) => setNewVarType(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white"
                  >
                    <option value="String">String</option>
                    <option value="Number">Number</option>
                    <option value="Boolean">Boolean</option>
                    <option value="Encrypted">Encrypted / Secret</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Value</label>
                  <input
                    type={newVarType === 'Encrypted' ? 'password' : 'text'}
                    placeholder="Value"
                    value={newVarValue}
                    onChange={(e) => setNewVarValue(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <input
                  type="text"
                  placeholder="Optional description..."
                  value={newVarDesc}
                  onChange={(e) => setNewVarDesc(e.target.value)}
                  className="w-2/3 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 placeholder-slate-500"
                />
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Variable</span>
                </button>
              </div>
            </form>

            {/* Variable Table */}
            <div className="flex-1 overflow-y-auto p-6 space-y-2">
              {variables
                .filter(v => (activeVarTab === 'Local' ? v.type === 'Local' && v.scriptId === activeScript?.id : v.type === 'Global'))
                .map(v => (
                  <div
                    key={v.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-brand-300">${v.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 font-mono">
                        {v.dataType}
                      </span>
                      <span className="font-mono text-slate-300">
                        {v.dataType === 'Encrypted' ? '••••••••' : v.value}
                      </span>
                      {v.description && <span className="text-slate-500 italic text-[11px]">- {v.description}</span>}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteVariable(v.id)}
                      className="p-1 text-slate-400 hover:text-rose-400 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* 7. Run Settings Modal (Section 8) */}
      {isRunSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-brand-400" />
                  Execution Run Settings
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Configure browser engine, step delay, and artifact capture policies
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRunSettingsOpen(false)}
                className="p-2 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Browser Configuration */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">Browser Configuration</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['chromium', 'firefox', 'webkit'] as const).map(b => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setTempSettings(prev => ({ ...prev, browser: b }))}
                      className={`p-3 rounded-xl border text-center font-medium capitalize transition-all ${
                        tempSettings.browser === b
                          ? 'bg-brand-600/20 border-brand-500 text-white font-bold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              {/* Execution Delays */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Delay / Step (ms)</label>
                  <input
                    type="number"
                    value={tempSettings.delayBetweenStepsMs}
                    onChange={(e) => setTempSettings(prev => ({ ...prev, delayBetweenStepsMs: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Global Wait (ms)</label>
                  <input
                    type="number"
                    value={tempSettings.globalWaitTimeMs}
                    onChange={(e) => setTempSettings(prev => ({ ...prev, globalWaitTimeMs: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Timeout (s)</label>
                  <input
                    type="number"
                    value={tempSettings.executionTimeoutSec}
                    onChange={(e) => setTempSettings(prev => ({ ...prev, executionTimeoutSec: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                  />
                </div>
              </div>

              {/* Screenshot Configuration */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">Screenshot Configuration</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTempSettings(prev => ({ ...prev, screenshotOption: 'failed-only' }))}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      tempSettings.screenshotOption === 'failed-only'
                        ? 'bg-brand-600/20 border-brand-500 text-white font-medium'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <span className="block font-semibold">Failed steps only</span>
                    <span className="text-[10px] text-slate-500">Capture screenshots on assertion error</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTempSettings(prev => ({ ...prev, screenshotOption: 'every-step' }))}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      tempSettings.screenshotOption === 'every-step'
                        ? 'bg-brand-600/20 border-brand-500 text-white font-medium'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <span className="block font-semibold">Every step</span>
                    <span className="text-[10px] text-slate-500">Full visual execution playback trace</span>
                  </button>
                </div>
              </div>

              {/* Screen Recording Configuration */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">Screen Recording</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="recording"
                      checked={!tempSettings.screenRecording}
                      onChange={() => setTempSettings(prev => ({ ...prev, screenRecording: false }))}
                      className="text-brand-500"
                    />
                    <span>Disable screen recording</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="recording"
                      checked={tempSettings.screenRecording}
                      onChange={() => setTempSettings(prev => ({ ...prev, screenRecording: true }))}
                      className="text-brand-500"
                    />
                    <span>Enable screen recording</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Actions: Save, Save & Run, Cancel */}
            <div className="p-6 border-t border-slate-800 flex items-center justify-end gap-2 bg-slate-950">
              <button
                type="button"
                onClick={() => setIsRunSettingsOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveRunSettings(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => handleSaveRunSettings(true)}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Save and Run</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Step Parameter Edit Drawer */}
      {editingStep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-brand-400" />
                  Configure Step {editingStep.stepNumber}: {editingStep.nlpName}
                </h3>
                <p className="text-xs text-slate-400 mt-1">{editingStep.description}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingStep(null)}
                className="p-1.5 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const nlpDef = NLP_CATALOG.find(n => n.id === editingStep.nlpId);
              const allParamsToEdit: Array<{
                name: string;
                label: string;
                type: string;
                required: boolean;
                placeholder?: string;
                description?: string;
                options?: string[];
                currentValue: any;
              }> = [];

              const seenKeys = new Set<string>();

              if (nlpDef?.requiredParams) {
                nlpDef.requiredParams.forEach(p => {
                  seenKeys.add(p.name);
                  allParamsToEdit.push({
                    name: p.name,
                    label: p.label || p.name,
                    type: p.type || 'string',
                    required: true,
                    placeholder: p.placeholder || (p.name === 'url' ? 'https://example.com or $baseURL' : `Enter ${p.label || p.name}`),
                    description: p.description,
                    options: p.options,
                    currentValue: editingStep.parameters?.[p.name] ?? p.defaultValue ?? ''
                  });
                });
              }

              if (nlpDef?.optionalParams) {
                nlpDef.optionalParams.forEach(p => {
                  seenKeys.add(p.name);
                  allParamsToEdit.push({
                    name: p.name,
                    label: p.label || p.name,
                    type: p.type || 'string',
                    required: false,
                    placeholder: p.placeholder || `Enter ${p.label || p.name}`,
                    description: p.description,
                    options: p.options,
                    currentValue: editingStep.parameters?.[p.name] ?? p.defaultValue ?? ''
                  });
                });
              }

              // Any other keys already present in editingStep.parameters
              Object.entries(editingStep.parameters || {}).forEach(([k, v]) => {
                if (k === 'dynamicValues') return;
                if (!seenKeys.has(k)) {
                  allParamsToEdit.push({
                    name: k,
                    label: k,
                    type: typeof v === 'number' ? 'number' : 'string',
                    required: false,
                    placeholder: `Enter ${k}`,
                    currentValue: v ?? ''
                  });
                }
              });

              return (
                <div className="p-6 space-y-4 text-xs">
                  {/* Dynamic Locator Parameters Section */}
                  {editingStep.locator && (() => {
                    const stepMode: 'Static' | 'Dynamic' = editingStep.elementMode || repoElements.find(e => e.id === editingStep.elementId)?.elementMode || 'Static';
                    if (stepMode === 'Static') {
                      return (
                        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                            <span className="text-slate-300 font-medium">Static Element Mapped</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                            No runtime placeholder substitution required
                          </span>
                        </div>
                      );
                    }
                    const placeholders = extractDynamicPlaceholders(editingStep.locator, stepMode);
                    if (placeholders.length === 0) return null;

                    return (
                      <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-500/30 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                            <MousePointer className="w-3.5 h-3.5 text-purple-400" />
                            Dynamic Locator Parameters
                          </span>
                          <span className="text-[10px] font-semibold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20 uppercase tracking-wider">
                            Dynamic Element
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Template: <code className="text-purple-300 font-mono">{editingStep.locator.value}</code>
                        </p>

                        {placeholders.map(ph => {
                          const val = editingStep.parameters?.dynamicValues?.[ph] || '';
                          const inputId = `drawer_dyn_${ph}`;
                          return (
                            <div key={ph} className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                                <span>Value for <code className="text-purple-400 font-mono">{`{${ph}}`}</code>:</span>
                                <span className="text-[10px] text-slate-500">Supports $variables</span>
                              </label>
                              <div className="relative">
                                <input
                                  type="text"
                                  placeholder={`Enter value to replace {${ph}} or $variable`}
                                  value={val}
                                  onChange={(e) =>
                                    handleInputWithVarSuggestions(
                                      inputId,
                                      e.target.value,
                                      (newV) => {
                                        setEditingStep(prev => {
                                          if (!prev) return null;
                                          const dyn = { ...(prev.parameters?.dynamicValues || {}) };
                                          dyn[ph] = newV;
                                          return {
                                            ...prev,
                                            parameters: { ...(prev.parameters || {}), dynamicValues: dyn }
                                          };
                                        });
                                      }
                                    )
                                  }
                                  onBlur={() => {
                                    setTimeout(() => {
                                      setVarAutoComplete(prev => prev?.inputId === inputId ? null : prev);
                                    }, 200);
                                  }}
                                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-purple-500/40 text-xs text-purple-200 focus:border-purple-400 font-mono"
                                />
                                {renderVariableDropdown(inputId)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {allParamsToEdit.length === 0 && (!editingStep.locator || extractDynamicPlaceholders(editingStep.locator, editingStep.elementMode || repoElements.find(e => e.id === editingStep.elementId)?.elementMode || 'Static').length === 0) && (
                    <div className="py-6 text-center text-slate-400">
                      <p>This action does not require any additional parameters.</p>
                    </div>
                  )}

                  {allParamsToEdit.map(param => (
                    <div key={param.name} className="relative">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-slate-300 font-semibold flex items-center gap-1">
                          <span>{param.label}</span>
                          {param.required && <span className="text-rose-400 font-bold" title="Required">*</span>}
                        </label>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {param.name}
                        </span>
                      </div>
                      {param.description && (
                        <p className="text-[11px] text-slate-400 mb-1.5">{param.description}</p>
                      )}

                      {param.type === 'dropdown' && param.options && param.options.length > 0 ? (
                        <select
                          value={String(editingStep.parameters?.[param.name] ?? param.currentValue)}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditingStep(prev => prev ? {
                              ...prev,
                              parameters: { ...prev.parameters, [param.name]: val }
                            } : null);
                          }}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-brand-500 font-mono"
                        >
                          {param.options.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="relative">
                          <input
                            type={param.type === 'number' ? 'number' : 'text'}
                            placeholder={param.placeholder}
                            value={String(editingStep.parameters?.[param.name] ?? param.currentValue)}
                            onChange={(e) =>
                              handleInputWithVarSuggestions(
                                `drawer_${param.name}`,
                                e.target.value,
                                (newV) => {
                                  setEditingStep(prev => prev ? {
                                    ...prev,
                                    parameters: { ...prev.parameters, [param.name]: newV }
                                  } : null);
                                }
                              )
                            }
                            onBlur={() => {
                              setTimeout(() => {
                                setVarAutoComplete(prev => prev?.inputId === `drawer_${param.name}` ? null : prev);
                              }, 200);
                            }}
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-brand-500 font-mono"
                            autoFocus={param.required && !editingStep.parameters?.[param.name]}
                          />
                          {renderVariableDropdown(`drawer_${param.name}`)}
                        </div>
                      )}
                    </div>
                  ))}

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!activeScript) return;
                        await api.scripts.updateStep(activeScript.id, project.id, editingStep.id, {
                          parameters: editingStep.parameters
                        });
                        await loadAllData();
                        setActiveScript(prev => prev ? {
                          ...prev,
                          steps: prev.steps.map(s => s.id === editingStep.id ? editingStep : s)
                        } : null);
                        setEditingStep(null);
                        showSuccessBanner('Step parameters updated.');
                      }}
                      className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs transition-all shadow-lg shadow-brand-500/20"
                    >
                      Save Parameters
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* 9. Create Module Modal */}
      {isModuleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
          <form onSubmit={handleCreateModule} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-brand-400" />
              {moduleParentId ? 'Create New Submodule' : 'Create Root Module'}
            </h3>
            {moduleModalError && (
              <p className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                {moduleModalError}
              </p>
            )}
            <div>
              <label className="block text-xs text-slate-300 mb-1 font-semibold">Module Name</label>
              <input
                type="text"
                placeholder="e.g. Valid Login or Checkout Module"
                value={moduleNameInput}
                onChange={(e) => setModuleNameInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-brand-500"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsModuleModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 9.1 Rename Module Modal */}
      {moduleToRename && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
          <form onSubmit={handleRenameModule} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-amber-400" />
              Edit Module Name
            </h3>
            <div>
              <label className="block text-xs text-slate-300 mb-1 font-semibold">Module Name</label>
              <input
                type="text"
                placeholder="Enter module name"
                value={renameModuleName}
                onChange={(e) => setRenameModuleName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-brand-500"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModuleToRename(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 10. Create Script Modal */}
      {isScriptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
          <form onSubmit={handleCreateScript} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-brand-400" />
              Create Automation Script
            </h3>
            {scriptModalError && (
              <p className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded-lg border border-rose-500/20">
                {scriptModalError}
              </p>
            )}
            <div>
              <label className="block text-xs text-slate-300 mb-1 font-semibold">Script Name</label>
              <input
                type="text"
                placeholder="e.g. Login With Remember Me"
                value={scriptNameInput}
                onChange={(e) => setScriptNameInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-brand-500"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1 font-semibold">Description (Optional)</label>
              <textarea
                placeholder="Describe the test scenario or assertions..."
                value={scriptDescInput}
                onChange={(e) => setScriptDescInput(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-brand-500 resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsScriptModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold"
              >
                Create Script
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 11. Playwright TypeScript Code Modal */}
      {isCodeModalOpen && activeScript && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <Code className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Generated Playwright TypeScript Code</span>
                    <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      @playwright/test
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Direct internal Playwright TypeScript mapping executed on the machine
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const code = generatePlaywrightCode(activeScript, repoElements, variables);
                    navigator.clipboard.writeText(code);
                    setCodeCopied(true);
                    setTimeout(() => setCodeCopied(false), 2000);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1.5 border border-slate-700 transition-all font-medium"
                >
                  {codeCopied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                  <span>{codeCopied ? 'Copied to Clipboard' : 'Copy Code'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsCodeModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-slate-950">
              <pre className="font-mono text-xs text-purple-200 bg-slate-900/90 p-4 rounded-xl border border-slate-800/80 overflow-x-auto leading-relaxed selection:bg-purple-600/40">
                {generatePlaywrightCode(activeScript, repoElements, variables)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Delete Script Confirmation Modal with Suite Dependency Protection (Section 7) */}
      {scriptToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Delete Script?</h3>
              <p className="text-xs text-slate-400 mt-1">
                Are you sure you want to delete this script?
              </p>
              <div className="mt-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                <span className="text-slate-500 text-[11px] block mb-0.5">Script Name:</span>
                <span className="font-bold text-brand-300 font-mono text-sm">{scriptToDelete.name}</span>
              </div>

              {deleteScriptDependencyWarning && deleteScriptDependencyWarning.length > 0 && (
                <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs space-y-1.5 animate-fadeIn">
                  <div className="font-semibold flex items-center gap-1.5 text-amber-400">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Active Test Suite Dependencies Found</span>
                  </div>
                  <p className="text-[11px] text-amber-200/80">
                    This script is currently referenced by {deleteScriptDependencyWarning.length} suite(s):
                  </p>
                  <ul className="list-disc pl-5 text-[11px] space-y-0.5 text-amber-200/90 font-mono">
                    {deleteScriptDependencyWarning.map(s => (
                      <li key={s.id}>{s.name}</li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-amber-400/90 font-sans pt-1">
                    Deleting this script will safely remove its reference without corrupting affected suites.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setScriptToDelete(null);
                  setDeleteScriptDependencyWarning(null);
                }}
                disabled={isDeletingScript}
                className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDeleteScript(!!deleteScriptDependencyWarning)}
                disabled={isDeletingScript}
                className="px-4 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50"
              >
                {isDeletingScript ? 'Deleting...' : (deleteScriptDependencyWarning ? 'Confirm Force Delete' : 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dirty Draft Confirmation Modal (When switching/collapsing while unsaved modifications exist) */}
      {dirtyConfirmModal && draftStep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Unsaved Changes in Step {draftStep.stepNumber}</h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                You have modified parameters for step <strong className="text-slate-200">"{draftStep.nlpName}"</strong>. Would you like to save your modifications, discard them, or continue editing?
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDirtyConfirmModal(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                Continue Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  const onProceed = dirtyConfirmModal.onProceed;
                  setDirtyConfirmModal(null);
                  onProceed();
                }}
                className="px-3.5 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
              >
                Discard Changes
              </button>
              <button
                type="button"
                onClick={async () => {
                  const onProceed = dirtyConfirmModal.onProceed;
                  await handleSaveStep(draftStep);
                  setDirtyConfirmModal(null);
                  onProceed();
                }}
                className="px-4 py-1.5 text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white rounded-lg transition-colors shadow-sm"
              >
                Save & Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
