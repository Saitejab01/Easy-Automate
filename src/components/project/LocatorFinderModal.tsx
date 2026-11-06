import React, { useState, useEffect } from 'react';
import {
  X,
  Crosshair,
  Sparkles,
  Play,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  ArrowUp,
  ArrowDown,
  Layers,
  Globe,
  ExternalLink,
  RefreshCw,
  FolderTree,
  Tag,
  Code2,
  Copy,
  Check
} from 'lucide-react';
import {
  Project,
  RepositoryPage,
  RepositoryElement,
  Locator,
  ElementType,
  LocatorType
} from '../../api/types';
import { api } from '../../api/client';
import { evaluateLocatorStability } from '../../utils/locatorEvaluator';

interface LocatorFinderModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  pages: RepositoryPage[];
  selectedPageId: string;
  existingElements: RepositoryElement[];
  onSaveElement: (elementData: {
    name: string;
    type: ElementType;
    description?: string;
    pageId: string;
    locators: Locator[];
    overwriteElementId?: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

interface GeneratedStrategy {
  id: string;
  type: LocatorType;
  value: string;
  valueType: 'Static' | 'Dynamic';
  isPrimary: boolean;
  priority: number;
  selected: boolean;
  stabilityScore: number;
  stability: 'High' | 'Moderate' | 'Low';
  reasons: string[];
  feedback: string;
  matchCount: number;
}

const SAMPLE_ELEMENTS = [
  {
    name: 'Login Submit Button',
    type: 'Button' as ElementType,
    tag: 'button',
    id: 'loginButton',
    nameAttr: 'login',
    testId: 'login-submit-btn',
    classes: 'btn btn-primary w-full',
    text: 'Log In to Account',
    ariaLabel: 'Submit login credentials'
  },
  {
    name: 'Email Input Field',
    type: 'Input Field' as ElementType,
    tag: 'input',
    id: 'user_email',
    nameAttr: 'email',
    testId: 'user-email-input',
    classes: 'form-control input-lg',
    text: '',
    placeholder: 'name@company.com'
  },
  {
    name: 'Product Add To Cart',
    type: 'Button' as ElementType,
    tag: 'button',
    id: '',
    nameAttr: '',
    testId: 'add-cart-action',
    classes: 'btn-add-cart cta-button',
    text: 'Add to Cart',
    customDynamic: "//button[@data-product-id='{dynamic product id}' and contains(., 'Add to Cart')]"
  },
  {
    name: 'Global Search Bar',
    type: 'Input Field' as ElementType,
    tag: 'input',
    id: 'store_search',
    nameAttr: 'q',
    testId: 'search-input',
    classes: 'search-field header-search',
    text: '',
    placeholder: 'Search products, brands...'
  },
  {
    name: 'Profile Dropdown Trigger',
    type: 'Button' as ElementType,
    tag: 'button',
    id: 'profile_menu_trigger',
    nameAttr: '',
    testId: 'user-avatar-menu',
    classes: 'avatar-btn rounded-full',
    text: '',
    ariaLabel: 'User Account Menu'
  }
];

export const LocatorFinderModal: React.FC<LocatorFinderModalProps> = ({
  isOpen,
  onClose,
  project,
  pages,
  selectedPageId,
  existingElements,
  onSaveElement
}) => {
  const [inspectUrl, setInspectUrl] = useState(project?.baseUrl || 'https://demo.playwright.dev');
  const [targetPageId, setTargetPageId] = useState(selectedPageId || ((pages && pages[0]?.id) || ''));
  const [elementName, setElementName] = useState('Login Submit Button');
  const [elementType, setElementType] = useState<ElementType>('Button');
  const [elementDescription, setElementDescription] = useState('Primary action button captured with Locator Finder');

  // Interactive Inspector States
  const [tag, setTag] = useState('button');
  const [idAttr, setIdAttr] = useState('loginButton');
  const [nameAttr, setNameAttr] = useState('login');
  const [testIdAttr, setTestIdAttr] = useState('login-submit-btn');
  const [classAttr, setClassAttr] = useState('btn btn-primary w-full');
  const [textAttr, setTextAttr] = useState('Log In to Account');
  const [placeholderAttr, setPlaceholderAttr] = useState('');
  const [ariaLabelAttr, setAriaLabelAttr] = useState('Submit login credentials');

  const [generatedStrategies, setGeneratedStrategies] = useState<GeneratedStrategy[]>([]);
  const [isInspectingBrowser, setIsInspectingBrowser] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [testingIdx, setTestingIdx] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Sync state when opening
  useEffect(() => {
    if (isOpen) {
      setTargetPageId(selectedPageId || ((pages && pages[0]?.id) || ''));
      setInspectUrl(project?.baseUrl || 'https://demo.playwright.dev');
      loadSample(SAMPLE_ELEMENTS[0]);
    }
  }, [isOpen, selectedPageId, pages, project?.baseUrl]);

  // Regenerate strategies whenever inspection attributes change
  useEffect(() => {
    generateAllStrategies();
  }, [tag, idAttr, nameAttr, testIdAttr, classAttr, textAttr, placeholderAttr, ariaLabelAttr]);

  if (!isOpen) return null;

  // Check if element with this name already exists in target page (Requirement 3: Synchronization)
  const safeExisting = Array.isArray(existingElements) ? existingElements : [];
  const existingDuplicate = safeExisting.find(
    e => e && e.pageId === targetPageId && (e.name || '').trim().toLowerCase() === (elementName || '').trim().toLowerCase()
  );

  const loadSample = (sample: typeof SAMPLE_ELEMENTS[0]) => {
    setElementName(sample.name);
    setElementType(sample.type);
    setTag(sample.tag);
    setIdAttr(sample.id);
    setNameAttr(sample.nameAttr);
    setTestIdAttr(sample.testId);
    setClassAttr(sample.classes);
    setTextAttr(sample.text);
    setPlaceholderAttr(sample.placeholder || '');
    setAriaLabelAttr(sample.ariaLabel || '');
  };

  const generateAllStrategies = () => {
    const list: Array<{ type: LocatorType; value: string; valueType?: 'Static' | 'Dynamic' }> = [];

    // 1. Test ID (Highest standard)
    if (testIdAttr.trim()) {
      list.push({ type: 'Test ID', value: testIdAttr.trim() });
    }

    // 2. Semantic ID
    if (idAttr.trim()) {
      list.push({ type: 'ID', value: idAttr.trim() });
    }

    // 3. Name Attribute
    if (nameAttr.trim()) {
      list.push({ type: 'Name', value: nameAttr.trim() });
    }

    // 4. Accessible Label / Role
    if (ariaLabelAttr.trim()) {
      list.push({ type: 'Label', value: ariaLabelAttr.trim() });
    }

    // 5. Placeholder
    if (placeholderAttr.trim()) {
      list.push({ type: 'Placeholder', value: placeholderAttr.trim() });
    }

    // 6. CSS Selector
    if (classAttr.trim()) {
      const cleanClasses = classAttr.trim().split(/\s+/).slice(0, 2).join('.');
      list.push({ type: 'CSS Selector', value: `${tag}.${cleanClasses}` });
    } else if (nameAttr.trim()) {
      list.push({ type: 'CSS Selector', value: `${tag}[name='${nameAttr.trim()}']` });
    }

    // 7. Relative XPath (Stable relative path with text or attributes)
    if (testIdAttr.trim()) {
      list.push({ type: 'XPath', value: `//${tag}[@data-testid='${testIdAttr.trim()}']` });
    } else if (nameAttr.trim()) {
      list.push({ type: 'XPath', value: `//${tag}[@name='${nameAttr.trim()}']` });
    } else if (textAttr.trim()) {
      list.push({ type: 'XPath', value: `//${tag}[contains(., '${textAttr.trim()}')]` });
    } else if (idAttr.trim()) {
      list.push({ type: 'XPath', value: `//${tag}[@id='${idAttr.trim()}']` });
    } else {
      list.push({ type: 'XPath', value: `//${tag}` });
    }

    // 8. Dynamic Element Template (if applicable)
    if (elementName.toLowerCase().includes('cart') || elementName.toLowerCase().includes('product')) {
      list.push({
        type: 'XPath',
        value: `//${tag}[@data-product-id='{dynamic product id}' and contains(., 'Add to Cart')]`,
        valueType: 'Dynamic'
      });
    }

    // Evaluate stability for each candidate
    const mapped: GeneratedStrategy[] = list.map((item, idx) => {
      const evaluation = evaluateLocatorStability(item.type, item.value);
      return {
        id: 'strat_' + idx + '_' + Math.random().toString(36).substring(2, 6),
        type: item.type,
        value: item.value,
        valueType: item.valueType || (/\{[^}]+\}/.test(item.value) ? 'Dynamic' : 'Static'),
        isPrimary: idx === 0,
        priority: idx + 1,
        selected: true,
        stabilityScore: evaluation.stabilityScore,
        stability: evaluation.stability,
        reasons: evaluation.reasons,
        feedback: evaluation.feedback,
        matchCount: 1
      };
    });

    setGeneratedStrategies(mapped);
  };

  // Launch live Playwright browser inspector
  const handleLaunchLiveInspector = async () => {
    setIsInspectingBrowser(true);
    setInspectError(null);
    try {
      const res = await api.repository.inspectElement(inspectUrl);
      if (res && res.success && res.element) {
        const el = res.element;
        setTag(el.tagName || 'button');
        setIdAttr(el.id || '');
        setNameAttr(el.name || '');
        setTestIdAttr(el.testId || '');
        setClassAttr(el.className || '');
        setTextAttr(el.textContent || '');
        setPlaceholderAttr(el.placeholder || '');
        setAriaLabelAttr(el.ariaLabel || '');
        if (el.textContent) {
          setElementName(el.textContent.slice(0, 30));
        } else if (el.id) {
          setElementName(el.id);
        } else if (el.name) {
          setElementName(el.name);
        }
      } else if (res && res.error) {
        setInspectError(res.error);
      }
    } catch (err: any) {
      setInspectError(err.message || 'Live inspector failed to connect');
    } finally {
      setIsInspectingBrowser(false);
    }
  };

  // Move priority up / down
  const movePriorityUp = (index: number) => {
    if (index === 0) return;
    const next = [...generatedStrategies];
    const temp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = temp;
    next.forEach((s, i) => {
      s.priority = i + 1;
      s.isPrimary = i === 0;
    });
    setGeneratedStrategies(next);
  };

  const movePriorityDown = (index: number) => {
    if (index === generatedStrategies.length - 1) return;
    const next = [...generatedStrategies];
    const temp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = temp;
    next.forEach((s, i) => {
      s.priority = i + 1;
      s.isPrimary = i === 0;
    });
    setGeneratedStrategies(next);
  };

  const toggleSelectStrategy = (index: number) => {
    const next = [...generatedStrategies];
    next[index].selected = !next[index].selected;
    setGeneratedStrategies(next);
  };

  // Live test locator button
  const handleTestLocator = async (index: number) => {
    const strat = generatedStrategies[index];
    setTestingIdx(index);
    try {
      const res = await api.repository.testLocator(strat.type, strat.value);
      if (res && res.stability) {
        const next = [...generatedStrategies];
        next[index] = {
          ...next[index],
          stabilityScore: res.stability.stabilityScore,
          stability: res.stability.stability,
          reasons: res.stability.reasons,
          feedback: res.stability.feedback,
          matchCount: res.matchCount >= 0 ? res.matchCount : 1
        };
        setGeneratedStrategies(next);
      }
    } catch (err) {
      console.error('Test locator failed:', err);
    } finally {
      setTestingIdx(null);
    }
  };

  // Push to Repository or Synchronize / Overwrite Existing
  const handlePushToRepository = async (forceOverwrite: boolean = false) => {
    if (!elementName.trim()) {
      setInspectError('Element Name is required.');
      return;
    }
    if (!targetPageId) {
      setInspectError('Please select a target repository page.');
      return;
    }

    const selectedLocators = generatedStrategies
      .filter(s => s.selected)
      .map((s, idx) => ({
        id: 'loc_' + Date.now() + '_' + idx,
        type: s.type,
        value: s.value,
        valueType: s.valueType,
        isPrimary: idx === 0,
        priority: idx + 1
      }));

    if (selectedLocators.length === 0) {
      setInspectError('Please select at least one locator strategy to push.');
      return;
    }

    setIsSubmitting(true);
    setInspectError(null);

    try {
      const overwriteId = forceOverwrite && existingDuplicate ? existingDuplicate.id : undefined;
      const res = await onSaveElement({
        name: elementName.trim(),
        type: elementType,
        description: elementDescription.trim(),
        pageId: targetPageId,
        locators: selectedLocators,
        overwriteElementId: overwriteId
      });

      if (res.success) {
        setSaveSuccessMsg(
          overwriteId
            ? `Repository synchronized! Element "${elementName}" updated with ${selectedLocators.length} locators.`
            : `Element "${elementName}" successfully pushed to repository.`
        );
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setInspectError(res.error || 'Failed to save element to repository.');
      }
    } catch (err: any) {
      setInspectError(err.message || 'Error occurred while saving to repository.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-2xl flex flex-col max-h-[92vh] shadow-2xl overflow-hidden animate-scaleUp">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
              <Crosshair className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Interactive Locator Finder</h3>
                <span className="text-[10px] bg-brand-500/10 text-brand-400 border border-brand-500/20 px-2 py-0.5 rounded-full font-semibold">
                  Multi-Strategy Generator & Evaluator
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Inspect UI elements, test stability scores, reorder fallback priority, and push directly to Repository
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

        {/* Top URL & Live Browser Bar */}
        <div className="px-6 py-3 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <Globe className="w-4 h-4 text-brand-400 shrink-0" />
            <input
              type="text"
              value={inspectUrl}
              onChange={(e) => setInspectUrl(e.target.value)}
              placeholder="https://your-app.com or project URL"
              className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs font-mono focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLaunchLiveInspector}
              disabled={isInspectingBrowser}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-600/30 flex items-center gap-1.5 transition-colors"
            >
              {isInspectingBrowser ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Inspecting Browser...</span>
                </>
              ) : (
                <>
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Launch Live Inspector</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {inspectError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{inspectError}</span>
            </div>
          )}

          {saveSuccessMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {/* Quick Element Presets Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Quick Element Presets / Sample Inspector
              </span>
              <span className="text-[10px] text-slate-500">Click any preset to simulate inspection</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_ELEMENTS.map((sample, sIdx) => (
                <button
                  key={sIdx}
                  type="button"
                  onClick={() => loadSample(sample)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    elementName === sample.name
                      ? 'bg-brand-600/20 text-brand-300 border-brand-500/40 shadow-sm'
                      : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  {sample.name}
                </button>
              ))}
            </div>
          </div>

          {/* Target Element Attributes & Target Repository Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-950 border border-slate-800">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Element Name in Repository <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={elementName}
                onChange={(e) => setElementName(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 text-xs font-medium focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Element Type <span className="text-rose-400">*</span>
              </label>
              <select
                value={elementType}
                onChange={(e) => setElementType(e.target.value as ElementType)}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs font-medium focus:border-brand-500"
              >
                <option value="Button">Button</option>
                <option value="Input Field">Input Field</option>
                <option value="Link">Link</option>
                <option value="Dropdown / Select">Dropdown / Select</option>
                <option value="Checkbox">Checkbox</option>
                <option value="Text / Label">Text / Label</option>
                <option value="Table">Table</option>
                <option value="Custom">Custom</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <FolderTree className="w-3 h-3 text-brand-400" />
                <span>Target Repository Page <span className="text-rose-400">*</span></span>
              </label>
              <select
                value={targetPageId}
                onChange={(e) => setTargetPageId(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs font-medium focus:border-brand-500"
              >
                {(pages || []).map(p => (
                  <option key={p.id} value={p.id}>
                    {p.parentId ? `↳ ${p.name} (Subpage)` : `📄 ${p.name}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Generated Locator Strategies & Fallback Priority (Requirements 1 & 2) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-brand-400" />
                  Generated Locator Strategies & Fallback Order ({generatedStrategies.length})
                </h4>
                <p className="text-[11px] text-slate-400">
                  Assess attribute stability, test matching elements in live browser, and configure priority fallback sequence.
                </p>
              </div>

              <span className="text-[10px] text-slate-500 font-mono">
                {generatedStrategies.filter(s => s.selected).length} strategies selected
              </span>
            </div>

            {/* List of Generated Strategies */}
            <div className="space-y-3">
              {generatedStrategies.map((strat, idx) => {
                const isTesting = testingIdx === idx;
                return (
                  <div
                    key={strat.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      strat.selected
                        ? 'bg-slate-950 border-slate-800 hover:border-slate-700'
                        : 'bg-slate-950/40 border-slate-900 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 text-xs mb-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={strat.selected}
                          onChange={() => toggleSelectStrategy(idx)}
                          className="w-4 h-4 rounded border-slate-700 text-brand-600 focus:ring-brand-500 bg-slate-900"
                        />

                        {idx === 0 ? (
                          <span className="text-[10px] bg-brand-500/20 text-brand-300 border border-brand-500/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
                            #1 Primary Strategy
                          </span>
                        ) : (
                          <span className="text-[10px] bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-full font-semibold">
                            #{idx + 1} Fallback Strategy #{idx}
                          </span>
                        )}

                        <span className="font-mono text-[11px] text-slate-300 font-semibold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          {strat.type}
                        </span>

                        {strat.valueType === 'Dynamic' && (
                          <span className="text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" />
                            Dynamic
                          </span>
                        )}
                      </div>

                      {/* Stability Badge & Score */}
                      <div className="flex items-center gap-2">
                        {strat.stability === 'High' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <ShieldCheck className="w-3 h-3" />
                            High Stability ({strat.stabilityScore}/100)
                          </span>
                        ) : strat.stability === 'Moderate' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            <ShieldAlert className="w-3 h-3" />
                            Moderate Stability ({strat.stabilityScore}/100)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                            <ShieldAlert className="w-3 h-3" />
                            Fragile Locator ({strat.stabilityScore}/100)
                          </span>
                        )}

                        <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                          {strat.matchCount === 1 ? '1 Match' : `${strat.matchCount} Matches`}
                        </span>

                        {/* Priority Reordering Buttons */}
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => movePriorityUp(idx)}
                          className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 hover:bg-slate-800 transition-colors"
                          title="Move Up in Priority"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          disabled={idx === generatedStrategies.length - 1}
                          onClick={() => movePriorityDown(idx)}
                          className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 hover:bg-slate-800 transition-colors"
                          title="Move Down in Priority"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Locator Expression Input & Live Test Button */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={strat.value}
                        readOnly
                        className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs font-mono select-all"
                      />

                      <button
                        type="button"
                        onClick={() => handleTestLocator(idx)}
                        disabled={isTesting}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 flex items-center gap-1.5 transition-colors shrink-0"
                        title="Test locator against DOM and evaluate match uniqueness"
                      >
                        {isTesting ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            <span>Testing...</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3" />
                            <span>Test Locator</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Stability breakdown & feedback */}
                    <div className="mt-2 pt-2 border-t border-slate-900 flex items-start justify-between text-[11px] text-slate-400">
                      <p className="font-medium text-slate-300">
                        {strat.feedback}
                      </p>
                      {strat.reasons.length > 0 && (
                        <span className="text-[10px] text-slate-500 italic shrink-0 ml-3">
                          {strat.reasons[0]}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Requirement 3: Repository Synchronization Alert Banner */}
          {existingDuplicate && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2 text-xs animate-fadeIn">
              <div className="flex items-center gap-2 text-amber-300 font-bold">
                <Layers className="w-4 h-4 text-amber-400" />
                <span>Element Already Exists in Selected Repository Page</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                An element named <strong className="text-white">"{elementName}"</strong> is already registered under this page.
                Choose <strong className="text-emerald-400">Update Repository</strong> to update and synchronize its locators with this new fallback strategy, or click <strong className="text-slate-200">Push as New</strong> to create a separate copy.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            {existingDuplicate ? (
              <>
                <button
                  type="button"
                  onClick={() => handlePushToRepository(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                >
                  Push as New (Duplicate)
                </button>

                <button
                  type="button"
                  onClick={() => handlePushToRepository(true)}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02] flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Update Repository (Synchronize Existing)</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => handlePushToRepository(false)}
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/30 transition-all hover:scale-[1.02] flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Push Element to Repository</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

