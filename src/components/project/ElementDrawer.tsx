import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  Trash2,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Code,
  Tag,
  FolderTree,
  ChevronDown,
  Info,
  ArrowUp,
  ArrowDown,
  Play,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Layers,
  Activity,
  Crosshair
} from 'lucide-react';
import {
  ElementType,
  LocatorType,
  ValueType,
  Locator,
  RepositoryElement,
  RepositoryPage
} from '../../api/types';
import { api } from '../../api/client';

interface ElementDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  pages: RepositoryPage[];
  selectedPageId: string;
  elementToEdit?: RepositoryElement | null;
  existingElements?: RepositoryElement[];
  onOpenFinder?: () => void;
  onSave: (elementData: {
    name: string;
    type: ElementType;
    description?: string;
    pageId: string;
    locators: Locator[];
    overwriteElementId?: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

const ELEMENT_TYPES: ElementType[] = [
  'Button',
  'Input Field',
  'Link',
  'Dropdown / Select',
  'Checkbox',
  'Radio Button',
  'Text / Label',
  'Image',
  'Table',
  'Modal',
  'Card',
  'Container',
  'Custom'
];

const LOCATOR_TYPES: LocatorType[] = [
  'ID',
  'Name',
  'XPath',
  'CSS Selector',
  'Class Name',
  'Link Text',
  'Partial Link Text',
  'Tag Name',
  'Text',
  'Role',
  'Placeholder',
  'Label',
  'Test ID'
];

export const ElementDrawer: React.FC<ElementDrawerProps> = ({
  isOpen,
  onClose,
  pages,
  selectedPageId,
  elementToEdit,
  existingElements = [],
  onOpenFinder,
  onSave
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<ElementType>('Button');
  const [description, setDescription] = useState('');
  const [pageId, setPageId] = useState(selectedPageId);
  const [locators, setLocators] = useState<Locator[]>([
    { id: 'loc_1', type: 'XPath', value: '', valueType: 'Static', isPrimary: true, priority: 1 }
  ]);

  // Suggestion popup state for dynamic value insertion
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState<number | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Testing locator states
  const [testingLocatorIdx, setTestingLocatorIdx] = useState<number | null>(null);
  const [locatorTestResults, setLocatorTestResults] = useState<{ [key: number]: any }>({});

  // Sync conflict modal state
  const [syncConflictModal, setSyncConflictModal] = useState<{
    isOpen: boolean;
    existingElement: RepositoryElement;
    payload: any;
  } | null>(null);

  const inputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

  // Sync state when editing or opening
  useEffect(() => {
    if (elementToEdit) {
      setName(elementToEdit.name);
      setType(elementToEdit.type);
      setDescription(elementToEdit.description || '');
      setPageId(elementToEdit.pageId);
      setLocators(
        (elementToEdit.locators || []).map((l, idx) => ({
          ...l,
          priority: l.priority || idx + 1,
          isPrimary: idx === 0
        }))
      );
    } else {
      setName('');
      setType('Button');
      setDescription('');
      setPageId(selectedPageId);
      setLocators([
        { id: 'loc_' + Date.now(), type: 'XPath', value: '', valueType: 'Static', isPrimary: true, priority: 1 }
      ]);
    }
    setFormError(null);
    setActiveSuggestionIdx(null);
    setLocatorTestResults({});
    setSyncConflictModal(null);
  }, [elementToEdit, selectedPageId, isOpen]);

  // Add another locator row
  const handleAddLocator = () => {
    const nextType: LocatorType =
      locators.some(l => l.type === 'XPath')
        ? locators.some(l => l.type === 'CSS Selector')
          ? 'ID'
          : 'CSS Selector'
        : 'XPath';

    const newLocators: Locator[] = [
      ...locators,
      {
        id: 'loc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
        type: nextType,
        value: '',
        valueType: 'Static',
        isPrimary: false,
        priority: locators.length + 1
      }
    ];

    setLocators(newLocators);
  };

  const handleRemoveLocator = (index: number) => {
    if (locators.length === 1) return;
    const next = locators.filter((_, i) => i !== index);
    const updated = next.map((l, i) => ({
      ...l,
      priority: i + 1,
      isPrimary: i === 0
    }));
    setLocators(updated);
    setLocatorTestResults(prev => {
      const copy = { ...prev };
      delete copy[index];
      return copy;
    });
  };

  const handleLocatorChange = (index: number, field: keyof Locator, value: any) => {
    const next = [...locators];
    next[index] = { ...next[index], [field]: value };

    // Auto-detect dynamic value type if {placeholder} is present
    if (field === 'value') {
      const hasDynamic = /\{[^}]*\}/.test(value);
      if (hasDynamic && next[index].valueType !== 'Dynamic') {
        next[index].valueType = 'Dynamic';
      }
    }

    setLocators(next);
  };

  // Reordering fallback priority
  const moveLocatorUp = (index: number) => {
    if (index === 0) return;
    const next = [...locators];
    const temp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = temp;
    const reordered = next.map((l, i) => ({
      ...l,
      priority: i + 1,
      isPrimary: i === 0
    }));
    setLocators(reordered);
    // Swap test results too
    setLocatorTestResults(prev => {
      const resA = prev[index];
      const resB = prev[index - 1];
      return {
        ...prev,
        [index - 1]: resA,
        [index]: resB
      };
    });
  };

  const moveLocatorDown = (index: number) => {
    if (index === locators.length - 1) return;
    const next = [...locators];
    const temp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = temp;
    const reordered = next.map((l, i) => ({
      ...l,
      priority: i + 1,
      isPrimary: i === 0
    }));
    setLocators(reordered);
    // Swap test results
    setLocatorTestResults(prev => {
      const resA = prev[index];
      const resB = prev[index + 1];
      return {
        ...prev,
        [index + 1]: resA,
        [index]: resB
      };
    });
  };

  const setAsPrimary = (index: number) => {
    if (index === 0) return;
    const next = [...locators];
    const [selected] = next.splice(index, 1);
    next.unshift(selected);
    const reordered = next.map((l, i) => ({
      ...l,
      priority: i + 1,
      isPrimary: i === 0
    }));
    setLocators(reordered);
    setLocatorTestResults({});
  };

  // Test Locator handler
  const handleTestLocator = async (index: number) => {
    const loc = locators[index];
    if (!loc.value.trim()) {
      setLocatorTestResults(prev => ({
        ...prev,
        [index]: {
          isValid: false,
          matchCount: 0,
          stability: 'Low',
          stabilityScore: 0,
          reasons: ['Locator value is empty'],
          feedback: 'Please enter a locator value to test'
        }
      }));
      return;
    }

    setTestingLocatorIdx(index);
    try {
      const res = await api.repository.testLocator(loc.type, loc.value);
      if (res && res.stability) {
        setLocatorTestResults(prev => ({
          ...prev,
          [index]: {
            ...res.stability,
            matchCount: res.matchCount
          }
        }));
      } else {
        setLocatorTestResults(prev => ({
          ...prev,
          [index]: {
            isValid: false,
            matchCount: 0,
            stability: 'Low',
            stabilityScore: 15,
            reasons: [res?.error || 'Validation failed'],
            feedback: 'Could not validate locator against browser DOM.'
          }
        }));
      }
    } catch (err: any) {
      setLocatorTestResults(prev => ({
        ...prev,
        [index]: {
          isValid: false,
          matchCount: 0,
          stability: 'Low',
          stabilityScore: 10,
          reasons: [err.message || 'Error executing locator test'],
          feedback: 'Execution error occurred during test.'
        }
      }));
    } finally {
      setTestingLocatorIdx(null);
    }
  };

  // Detect when user types "{" in locator value field
  const handleValueKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === '{') {
      setActiveSuggestionIdx(index);
    }
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const val = e.target.value;
    handleLocatorChange(index, 'value', val);

    const selectionStart = e.target.selectionStart || 0;
    const textBeforeCursor = val.slice(0, selectionStart);
    if (textBeforeCursor.endsWith('{')) {
      setActiveSuggestionIdx(index);
    } else if (!val.includes('{')) {
      if (activeSuggestionIdx === index) {
        setActiveSuggestionIdx(null);
      }
    }
  };

  // Generate unique placeholder name
  const getNextPlaceholderName = (currentValue: string): string => {
    const existing = currentValue.match(/\{dynamic value(\d+)\}/g) || [];
    let max = 0;
    existing.forEach(m => {
      const num = parseInt(m.replace(/\D/g, ''), 10);
      if (!isNaN(num) && num > max) max = num;
    });
    return `dynamic value${max + 1}`;
  };

  // Insert selected dynamic value
  const insertDynamicPlaceholder = (index: number, placeholderName?: string) => {
    const input = inputRefs.current[index];
    const loc = locators[index];
    if (!input || !loc) return;

    const currentVal = loc.value;
    const cursorPos = input.selectionStart || currentVal.length;

    const nameToInsert = placeholderName || getNextPlaceholderName(currentVal);
    const placeholderStr = `{${nameToInsert}}`;

    let newVal = '';
    const textBeforeCursor = currentVal.slice(0, cursorPos);
    const textAfterCursor = currentVal.slice(cursorPos);

    if (textBeforeCursor.endsWith('{')) {
      newVal = textBeforeCursor.slice(0, -1) + placeholderStr + textAfterCursor;
    } else {
      newVal = textBeforeCursor + placeholderStr + textAfterCursor;
    }

    const next = [...locators];
    next[index] = {
      ...next[index],
      value: newVal,
      valueType: 'Dynamic'
    };
    setLocators(next);
    setActiveSuggestionIdx(null);

    setTimeout(() => {
      input.focus();
    }, 50);
  };

  // Extract all dynamic placeholders from a string
  const extractPlaceholders = (val: string): string[] => {
    const matches = val.match(/\{([^}]+)\}/g);
    return matches ? matches.map(m => m.slice(1, -1)) : [];
  };

  // Validation before saving
  const validate = (): string | null => {
    if (!name.trim()) return 'Element Name is mandatory.';
    if (!type) return 'Element Type is mandatory.';
    if (!pageId) return 'Page selection is mandatory.';
    if (locators.length === 0) return 'At least one locator configuration is required.';

    for (let i = 0; i < locators.length; i++) {
      const loc = locators[i];
      if (!loc.type) return `Locator #${i + 1}: Locator Type is mandatory.`;
      if (!loc.value.trim()) return `Locator #${i + 1}: Locator Value cannot be empty.`;

      const openCount = (loc.value.match(/\{/g) || []).length;
      const closeCount = (loc.value.match(/\}/g) || []).length;
      if (openCount !== closeCount) {
        return `Locator #${i + 1}: Incomplete dynamic placeholder syntax. Braces '{' and '}' must match.`;
      }
    }

    return null;
  };

  const handleSubmit = async (e?: React.FormEvent, forceNew: boolean = false) => {
    if (e) e.preventDefault();
    const error = validate();
    if (error) {
      setFormError(error);
      return;
    }

    const payload = {
      name: name.trim(),
      type,
      description: description.trim(),
      pageId,
      locators: locators.map((l, idx) => ({
        ...l,
        priority: idx + 1,
        isPrimary: idx === 0
      }))
    };

    // Requirement 3: Repository synchronization check
    // If not editing this element and an element with the exact name exists in the page
    if (!elementToEdit && !forceNew && existingElements && existingElements.length > 0) {
      const duplicate = existingElements.find(
        el => el && el.pageId === pageId && (el.name || '').trim().toLowerCase() === (payload.name || '').trim().toLowerCase()
      );
      if (duplicate) {
        setSyncConflictModal({
          isOpen: true,
          existingElement: duplicate,
          payload
        });
        return;
      }
    }

    setFormError(null);
    setIsSubmitting(true);

    try {
      const res = await onSave(payload);
      if (res.success) {
        onClose();
      } else {
        setFormError(res.error || 'Failed to save element.');
      }
    } catch (err: any) {
      setFormError(err.message || 'An error occurred while saving.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Update Repository (Synchronization overwrite)
  const handleConfirmSyncUpdate = async () => {
    if (!syncConflictModal) return;
    setIsSubmitting(true);
    try {
      const res = await onSave({
        ...syncConflictModal.payload,
        overwriteElementId: syncConflictModal.existingElement.id
      });
      if (res.success) {
        setSyncConflictModal(null);
        onClose();
      } else {
        setFormError(res.error || 'Failed to update repository element.');
      }
    } catch (err: any) {
      setFormError(err.message || 'An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end animate-fadeIn">
      {/* Drawer Container */}
      <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl overflow-hidden animate-slideLeft">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
              <Code className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {elementToEdit ? 'Edit Repository Element' : 'Add New Element'}
              </h3>
              <p className="text-xs text-slate-400">
                Configure element attributes, locator testing, and fallback priorities
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {formError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* Target Page Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <FolderTree className="w-3.5 h-3.5 text-brand-400" />
              <span>Target Page or Subpage</span>
              <span className="text-rose-400">*</span>
            </label>
            <select
              value={pageId}
              onChange={(e) => setPageId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 text-slate-200 text-xs font-medium"
            >
              {(pages || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.parentId ? `↳  ${p.name} (Subpage)` : `📄 ${p.name}`}
                </option>
              ))}
            </select>
          </div>

          {/* Element Name & Type Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Element Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (formError) setFormError(null);
                }}
                placeholder="e.g. Login Button, Email Input"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 text-slate-100 text-xs sm:text-sm placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-500"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Element Type <span className="text-rose-400">*</span>
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ElementType)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 text-slate-200 text-xs sm:text-sm font-medium"
              >
                {ELEMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Description <span className="text-slate-500 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Primary call-to-action button in header modal"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 text-slate-200 text-xs placeholder:text-slate-600"
            />
          </div>

          {/* Multiple Locator Support with Fallback Order & Test Locator */}
          <div className="space-y-4 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-brand-400" />
                  Locator Fallback Order ({locators.length})
                </h4>
                <p className="text-[11px] text-slate-400">
                  Arranged in priority order. If primary fails during execution, engine automatically tries the next fallback.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {onOpenFinder && (
                  <button
                    type="button"
                    onClick={onOpenFinder}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-purple-600/20 to-indigo-600/20 text-purple-300 border border-purple-500/30 hover:bg-purple-600/30 transition-colors"
                    title="Launch Interactive Locator Finder & Inspector"
                  >
                    <Crosshair className="w-3.5 h-3.5 text-purple-400" />
                    <span>Launch Locator Finder</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleAddLocator}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-600/20 text-brand-400 border border-brand-500/30 hover:bg-brand-600/30 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Fallback</span>
                </button>
              </div>
            </div>

            {/* List of Locators */}
            <div className="space-y-4">
              {locators.map((loc, idx) => {
                const detectedPlaceholders = extractPlaceholders(loc?.value || '');
                const isSuggestionOpen = activeSuggestionIdx === idx;
                const testResult = locatorTestResults[idx];
                const isTesting = testingLocatorIdx === idx;

                return (
                  <div
                    key={loc.id || idx}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 relative space-y-3 hover:border-slate-700 transition-colors"
                  >
                    {/* Header Row: Priority Badge, Move Buttons, Delete */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        {idx === 0 ? (
                          <span className="text-[11px] bg-brand-500/20 text-brand-300 border border-brand-500/40 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
                            #1 Primary Strategy
                          </span>
                        ) : (
                          <span className="text-[11px] bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-0.5 rounded-full font-semibold">
                            #{idx + 1} Fallback Strategy #{idx}
                          </span>
                        )}

                        {loc.valueType === 'Dynamic' && (
                          <span className="text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" />
                            Dynamic
                          </span>
                        )}
                      </div>

                      {/* Action buttons: Move Up, Move Down, Set Primary, Remove */}
                      <div className="flex items-center gap-1">
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => setAsPrimary(idx)}
                            className="text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-brand-950 hover:text-brand-300 text-slate-300 border border-slate-700 transition-colors"
                            title="Promote to Primary Strategy #1"
                          >
                            Set Primary
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveLocatorUp(idx)}
                          className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 hover:bg-slate-800 transition-colors"
                          title="Move Priority Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          disabled={idx === locators.length - 1}
                          onClick={() => moveLocatorDown(idx)}
                          className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 hover:bg-slate-800 transition-colors"
                          title="Move Priority Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>

                        {locators.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveLocator(idx)}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors ml-1"
                            title="Remove locator"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Locator Type & Value Type Row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Locator Type</label>
                        <select
                          value={loc.type}
                          onChange={(e) => handleLocatorChange(idx, 'type', e.target.value as LocatorType)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs font-medium focus:border-brand-500"
                        >
                          {LOCATOR_TYPES.map((lt) => (
                            <option key={lt} value={lt}>
                              {lt}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Value Type</label>
                        <select
                          value={loc.valueType}
                          onChange={(e) => handleLocatorChange(idx, 'valueType', e.target.value as ValueType)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs font-medium focus:border-brand-500"
                        >
                          <option value="Static">Static</option>
                          <option value="Dynamic">Dynamic</option>
                        </select>
                      </div>
                    </div>

                    {/* Locator Value Input with Dynamic Placeholder Helper */}
                    <div className="relative">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] text-slate-400">
                          Locator Expression / Value <span className="text-rose-400">*</span>
                        </label>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => insertDynamicPlaceholder(idx)}
                            className="text-[10px] text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1 transition-colors"
                            title="Click to insert a dynamic variable placeholder like {dynamic value1}"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>+ Insert Dynamic Variable</span>
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          ref={(el) => (inputRefs.current[idx] = el)}
                          type="text"
                          value={loc.value}
                          onKeyDown={(e) => handleValueKeyDown(e, idx)}
                          onChange={(e) => handleValueChange(e, idx)}
                          placeholder={
                            loc.type === 'XPath'
                              ? "//button[@name='{dynamic value1}']"
                              : loc.type === 'CSS Selector'
                              ? "button.login-btn"
                              : loc.type === 'ID'
                              ? "loginButton"
                              : "Enter locator value..."
                          }
                          className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 text-xs font-mono focus:border-brand-500 focus:outline-none"
                        />

                        {/* Test Locator Button */}
                        <button
                          type="button"
                          onClick={() => handleTestLocator(idx)}
                          disabled={isTesting || !loc.value.trim()}
                          className="px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 disabled:opacity-40 flex items-center gap-1.5 transition-colors shrink-0"
                          title="Test locator against active browser and evaluate stability"
                        >
                          {isTesting ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Testing...</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5" />
                              <span>Test Locator</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Dynamic Value Suggestion Popup Dropdown */}
                      {isSuggestionOpen && (
                        <div className="absolute left-0 right-0 mt-1 z-30 bg-slate-900 border border-purple-500/40 rounded-xl shadow-2xl p-2 space-y-1 animate-fadeIn">
                          <div className="px-2 py-1 text-[10px] font-semibold text-purple-400 flex items-center justify-between border-b border-slate-800">
                            <span className="flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />
                              Dynamic Variable Suggestions
                            </span>
                            <button
                              type="button"
                              onClick={() => setActiveSuggestionIdx(null)}
                              className="text-slate-400 hover:text-white"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => insertDynamicPlaceholder(idx)}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-purple-950/60 text-xs text-slate-200 flex items-center justify-between group transition-colors"
                          >
                            <span className="font-mono text-purple-300 font-semibold">
                              {`{${getNextPlaceholderName(loc.value)}}`}
                            </span>
                            <span className="text-[10px] text-slate-400 group-hover:text-purple-300">
                              Insert Sequential Variable
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => insertDynamicPlaceholder(idx, 'dynamic text')}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-purple-950/60 text-xs text-slate-200 flex items-center justify-between group transition-colors"
                          >
                            <span className="font-mono text-purple-300 font-semibold">{'{dynamic text}'}</span>
                            <span className="text-[10px] text-slate-400 group-hover:text-purple-300">
                              Insert Text Variable
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => insertDynamicPlaceholder(idx, 'dynamic id')}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-purple-950/60 text-xs text-slate-200 flex items-center justify-between group transition-colors"
                          >
                            <span className="font-mono text-purple-300 font-semibold">{'{dynamic id}'}</span>
                            <span className="text-[10px] text-slate-400 group-hover:text-purple-300">
                              Insert ID Variable
                            </span>
                          </button>
                        </div>
                      )}

                      {/* Visual Pills for detected dynamic placeholders */}
                      {detectedPlaceholders.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] text-slate-500 font-medium">Detected Placeholders:</span>
                          {detectedPlaceholders.map((ph, pIdx) => (
                            <span
                              key={pIdx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30"
                            >
                              <Sparkles className="w-2.5 h-2.5 text-purple-400" />
                              {`{${ph}}`}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Test Locator Results Panel */}
                      {testResult && (
                        <div className="mt-2.5 p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2 animate-fadeIn text-xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {testResult.stability === 'High' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                  <ShieldCheck className="w-3 h-3" />
                                  High Stability ({testResult.stabilityScore || 90}/100)
                                </span>
                              ) : testResult.stability === 'Moderate' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                  <ShieldAlert className="w-3 h-3" />
                                  Moderate Stability ({testResult.stabilityScore || 70}/100)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                                  <ShieldAlert className="w-3 h-3" />
                                  Fragile Locator ({testResult.stabilityScore || 30}/100)
                                </span>
                              )}

                              {testResult.matchCount !== undefined && testResult.matchCount >= 0 && (
                                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                                  {testResult.matchCount === 1 ? '1 Element Matched' : `${testResult.matchCount} Elements Matched`}
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setLocatorTestResults(prev => {
                                  const copy = { ...prev };
                                  delete copy[idx];
                                  return copy;
                                });
                              }}
                              className="text-slate-500 hover:text-slate-300"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>

                          <p className="text-[11px] text-slate-300 font-medium">
                            {testResult.feedback}
                          </p>

                          {testResult.reasons && testResult.reasons.length > 0 && (
                            <ul className="space-y-1 pt-1 border-t border-slate-800/80">
                              {testResult.reasons.map((r: string, rIdx: number) => (
                                <li key={rIdx} className="text-[10px] text-slate-400 flex items-start gap-1.5">
                                  <span className="text-brand-400 mt-0.5">•</span>
                                  <span>{r}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={(e) => handleSubmit(e, false)}
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white shadow-lg shadow-brand-600/30 transition-all hover:scale-[1.02] flex items-center gap-2"
          >
            {isSubmitting ? (
              <span>Saving Element...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>{elementToEdit ? 'Save Changes' : 'Save Element to Repository'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Requirement 3: Repository Synchronization Conflict Modal */}
      {syncConflictModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Repository Synchronization</h3>
                <p className="text-xs text-slate-400">Element already exists in this repository section</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <p className="text-slate-200">
                An element named <strong className="text-brand-300">"{syncConflictModal.payload.name}"</strong> is already registered under this page.
              </p>
              <p className="text-slate-400 leading-relaxed">
                Choose <strong className="text-emerald-400">Update Repository</strong> to synchronize and update its locators. All existing test scripts mapped to this element will immediately benefit from the updated fallback strategies without broken references.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={handleConfirmSyncUpdate}
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Update Repository (Overwrite Existing)</span>
              </button>

              <button
                type="button"
                onClick={() => handleSubmit(undefined, true)}
                disabled={isSubmitting}
                className="w-full py-2 px-4 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              >
                Save as New (Create Duplicate)
              </button>

              <button
                type="button"
                onClick={() => setSyncConflictModal(null)}
                className="w-full py-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Cancel & Edit Name
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
