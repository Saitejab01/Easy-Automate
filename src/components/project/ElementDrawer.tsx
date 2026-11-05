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
  Info
} from 'lucide-react';
import {
  ElementType,
  LocatorType,
  ValueType,
  Locator,
  RepositoryElement,
  RepositoryPage
} from '../../api/types';

interface ElementDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  pages: RepositoryPage[];
  selectedPageId: string;
  elementToEdit?: RepositoryElement | null;
  onSave: (elementData: {
    name: string;
    type: ElementType;
    description?: string;
    pageId: string;
    locators: Locator[];
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
  onSave
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<ElementType>('Button');
  const [description, setDescription] = useState('');
  const [pageId, setPageId] = useState(selectedPageId);
  const [locators, setLocators] = useState<Locator[]>([
    { id: 'loc_1', type: 'XPath', value: '', valueType: 'Static', isPrimary: true }
  ]);

  // Suggestion popup state for dynamic value insertion
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState<number | null>(null);
  const [suggestionPosition, setSuggestionPosition] = useState<{ top: number; left: number } | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

  // Sync state when editing or opening
  useEffect(() => {
    if (elementToEdit) {
      setName(elementToEdit.name);
      setType(elementToEdit.type);
      setDescription(elementToEdit.description || '');
      setPageId(elementToEdit.pageId);
      setLocators(
        elementToEdit.locators.map(l => ({ ...l }))
      );
    } else {
      setName('');
      setType('Button');
      setDescription('');
      setPageId(selectedPageId);
      setLocators([
        { id: 'loc_' + Date.now(), type: 'XPath', value: '', valueType: 'Static', isPrimary: true }
      ]);
    }
    setFormError(null);
    setActiveSuggestionIdx(null);
  }, [elementToEdit, selectedPageId, isOpen]);

  if (!isOpen) return null;

  // Add another locator row
  const handleAddLocator = () => {
    const nextType: LocatorType =
      locators.some(l => l.type === 'XPath')
        ? locators.some(l => l.type === 'CSS Selector')
          ? 'ID'
          : 'CSS Selector'
        : 'XPath';

    setLocators([
      ...locators,
      {
        id: 'loc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
        type: nextType,
        value: '',
        valueType: 'Static',
        isPrimary: false
      }
    ]);
  };

  const handleRemoveLocator = (index: number) => {
    if (locators.length === 1) return;
    const next = locators.filter((_, i) => i !== index);
    if (next.length > 0 && !next.some(l => l.isPrimary)) {
      next[0].isPrimary = true;
    }
    setLocators(next);
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

  // Detect when user types "{" in locator value field
  const handleValueKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === '{') {
      // Show suggestions popup
      setActiveSuggestionIdx(index);
    }
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const val = e.target.value;
    handleLocatorChange(index, 'value', val);

    // If string ends with '{' or cursor is right after '{'
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

  // Generate unique placeholder name (e.g. {dynamic value1}, {dynamic value2})
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

    // If user just typed '{', replace the trailing '{' with '{nameToInsert}'
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

    // Re-focus input
    setTimeout(() => {
      input.focus();
    }, 50);
  };

  // Extract all dynamic placeholders from a string
  const extractPlaceholders = (val: string): string[] => {
    const matches = val.match(/\{([^}]+)\}/g);
    return matches ? matches.map(m => m.slice(1, -1)) : [];
  };

  // Validation before saving (Section 3.7)
  const validate = (): string | null => {
    if (!name.trim()) {
      return 'Element Name is mandatory.';
    }
    if (!type) {
      return 'Element Type is mandatory.';
    }
    if (!pageId) {
      return 'Page selection is mandatory.';
    }
    if (locators.length === 0) {
      return 'At least one locator configuration is required.';
    }

    for (let i = 0; i < locators.length; i++) {
      const loc = locators[i];
      if (!loc.type) {
        return `Locator #${i + 1}: Locator Type is mandatory.`;
      }
      if (!loc.value.trim()) {
        return `Locator #${i + 1}: Locator Value cannot be empty.`;
      }

      // Check placeholder syntax
      const openCount = (loc.value.match(/\{/g) || []).length;
      const closeCount = (loc.value.match(/\}/g) || []).length;
      if (openCount !== closeCount) {
        return `Locator #${i + 1}: Incomplete dynamic placeholder syntax. Braces '{' and '}' must match.`;
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = validate();
    if (error) {
      setFormError(error);
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    try {
      const res = await onSave({
        name: name.trim(),
        type,
        description: description.trim(),
        pageId,
        locators
      });

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
                Configure UI element attributes and multiple locator strategies
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
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.parentId ? `↳  ${p.name} (Subpage)` : `📄 ${p.name}`}
                </option>
              ))}
            </select>
          </div>

          {/* Element Name & Type Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Element Name (Mandatory) */}
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

            {/* Element Type (Mandatory) */}
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

          {/* 3.4 Multiple Locator Support */}
          <div className="space-y-4 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-brand-400" />
                  Locator Configurations ({locators.length})
                </h4>
                <p className="text-[11px] text-slate-400">
                  Configure multiple locator strategies (XPath, CSS, ID) with static or dynamic values
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddLocator}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-600/20 text-brand-400 border border-brand-500/30 hover:bg-brand-600/30 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Locator</span>
              </button>
            </div>

            {/* List of Locators */}
            <div className="space-y-3.5">
              {locators.map((loc, idx) => {
                const detectedPlaceholders = extractPlaceholders(loc.value);
                const isSuggestionOpen = activeSuggestionIdx === idx;

                return (
                  <div
                    key={loc.id || idx}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 relative space-y-3 hover:border-slate-700 transition-colors"
                  >
                    {/* Header Row */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-slate-400 font-bold">
                          #{idx + 1}
                        </span>
                        {idx === 0 && (
                          <span className="text-[10px] bg-brand-500/10 text-brand-400 border border-brand-500/30 px-2 py-0.2 rounded-full font-semibold">
                            Primary Strategy
                          </span>
                        )}
                        {loc.valueType === 'Dynamic' && (
                          <span className="text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/30 px-2 py-0.2 rounded-full font-semibold flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" />
                            Dynamic
                          </span>
                        )}
                      </div>

                      {locators.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLocator(idx)}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Remove locator"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
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
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 text-xs font-mono focus:border-brand-500 focus:outline-none"
                      />

                      {/* 3.6 Dynamic Value Suggestion Popup Dropdown */}
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
            onClick={handleSubmit}
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
    </div>
  );
};

