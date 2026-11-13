import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Crosshair,
  Sparkles,
  Play,
  Pause,
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
  Check,
  Trash2,
  Star,
  Eye,
  Plus,
  ChevronRight,
  Search,
  CheckSquare,
  Square,
  AlertTriangle,
  Monitor
} from 'lucide-react';
import {
  Project,
  RepositoryPage,
  RepositoryElement,
  Locator,
  ElementType,
  LocatorType,
  FinderCapturedElement,
  FinderStrategy
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
    elementMode?: 'Static' | 'Dynamic';
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
  'Test ID',
  'Name',
  'Label',
  'Placeholder',
  'CSS Selector',
  'XPath',
  'Text',
  'Role',
  'Class Name',
  'Link Text',
  'Partial Link Text'
];

const SAMPLE_ELEMENTS = [
  {
    name: 'Login Submit Button',
    type: 'Button' as ElementType,
    tag: 'button',
    visibleText: 'Log In to Account',
    accessibleName: 'Submit credentials',
    description: 'Primary submission button for the login portal form',
    locators: [
      { type: 'Test ID' as LocatorType, value: 'login-submit-btn' },
      { type: 'ID' as LocatorType, value: 'loginButton' },
      { type: 'CSS Selector' as LocatorType, value: 'button.btn-primary.w-full' },
      { type: 'XPath' as LocatorType, value: "//button[@id='loginButton' and contains(., 'Log In')]" },
      { type: 'Label' as LocatorType, value: 'Submit credentials' }
    ]
  },
  {
    name: 'Email Input Field',
    type: 'Input Field' as ElementType,
    tag: 'input',
    visibleText: '',
    accessibleName: 'Email Address',
    description: 'User email entry field on authentication screen',
    locators: [
      { type: 'Test ID' as LocatorType, value: 'user-email-input' },
      { type: 'Name' as LocatorType, value: 'user_email' },
      { type: 'Placeholder' as LocatorType, value: 'name@company.com' },
      { type: 'CSS Selector' as LocatorType, value: 'input[name="user_email"]' },
      { type: 'XPath' as LocatorType, value: "//input[@placeholder='name@company.com']" }
    ]
  },
  {
    name: 'Add to Cart Dynamic',
    type: 'Button' as ElementType,
    tag: 'button',
    visibleText: 'Add to Cart',
    accessibleName: 'Add item to shopping cart',
    description: 'Dynamic button targeting variable product catalog item',
    locators: [
      { type: 'XPath' as LocatorType, value: "//button[@data-product-id='{dynamic product id}' and contains(., 'Add to Cart')]" },
      { type: 'CSS Selector' as LocatorType, value: "button[data-product-id='{dynamic product id}']" },
      { type: 'Test ID' as LocatorType, value: 'add-cart-action' }
    ]
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
  const defaultPageId = selectedPageId || ((pages && pages[0]?.id) || '');
  const storageKey = `ea_finder_captured_${project?.id || 'default'}`;

  // Browser configuration & session states
  const [inspectUrl, setInspectUrl] = useState(() => {
    try {
      const saved = localStorage.getItem(`ea_finder_url_${project?.id || 'default'}`);
      if (saved && saved.trim()) return saved.trim();
    } catch {}
    if (project?.baseUrl && project.baseUrl.trim()) return project.baseUrl.trim();
    return 'https://demo.playwright.dev/todomvc';
  });
  const [browserType, setBrowserType] = useState<'chromium' | 'firefox' | 'webkit'>('chromium');
  const [captureMode, setCaptureMode] = useState<'normal' | 'reference'>('normal');
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'capturing' | 'paused' | 'closed'>('idle');
  const [isStartingSession, setIsStartingSession] = useState(false);

  // Multi-element persistent capture collection
  const [capturedElements, setCapturedElements] = useState<FinderCapturedElement[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });

  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Per-locator interaction states
  const [highlightingLocatorId, setHighlightingLocatorId] = useState<string | null>(null);
  const [testingLocatorId, setTestingLocatorId] = useState<string | null>(null);
  const [copiedLocatorId, setCopiedLocatorId] = useState<string | null>(null);

  // Global messages & dialogs
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmittingSingle, setIsSubmittingSingle] = useState(false);

  // Review & Batch Push Dialog states
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedForPush, setSelectedForPush] = useState<Record<string, boolean>>({});
  const [targetPageOverrides, setTargetPageOverrides] = useState<Record<string, string>>({});
  const [isPushingBatch, setIsPushingBatch] = useState(false);

  // Persist captured elements whenever changed & sync with Electron backend
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(capturedElements));
    } catch {}
    api.finder.syncSessionElements(capturedElements).catch(() => {});
  }, [capturedElements, storageKey]);

  // Keep selectedElementId valid
  useEffect(() => {
    if (capturedElements.length > 0) {
      if (!selectedElementId || !capturedElements.some(e => e.id === selectedElementId)) {
        setSelectedElementId(capturedElements[0].id);
      }
    } else {
      setSelectedElementId(null);
    }
  }, [capturedElements, selectedElementId]);

  // Query live status and attach capture stream listener
  useEffect(() => {
    if (!isOpen) return;

    api.finder.getStatus().then((status: any) => {
      if (status && status.isOpen) {
        setSessionStatus(status.status || 'capturing');
      }
    }).catch(() => {});

    const unsubCapture = api.finder.onElementCaptured((capturedRecord: FinderCapturedElement & { isDuplicate?: boolean }) => {
      if (capturedRecord.isDuplicate) {
        setSelectedElementId(capturedRecord.id);
        setSuccessMsg(`Element already exists in session (#${capturedRecord.sequence}: "${capturedRecord.name}") — Selected.`);
        setErrorMsg(null);
        return;
      }

      setCapturedElements(prev => {
        // Double-check client-side against any existing elements in current session
        const duplicate = prev.find(item => {
          if (item.id === capturedRecord.id) return true;
          const itemPrimary = item.locators.find(l => l.isPrimary) || item.locators[0];
          const capPrimary = capturedRecord.locators.find(l => l.isPrimary) || capturedRecord.locators[0];
          if (
            itemPrimary &&
            capPrimary &&
            itemPrimary.type === capPrimary.type &&
            itemPrimary.value.trim().toLowerCase() === capPrimary.value.trim().toLowerCase()
          ) {
            return true;
          }
          if (
            item.tag?.toLowerCase() === capturedRecord.tag?.toLowerCase() &&
            item.name.trim().toLowerCase() === capturedRecord.name.trim().toLowerCase() &&
            (item.visibleText || '').trim().toLowerCase() === (capturedRecord.visibleText || '').trim().toLowerCase()
          ) {
            return true;
          }
          return false;
        });

        if (duplicate) {
          setSelectedElementId(duplicate.id);
          setSuccessMsg(`Element already exists in session (#${duplicate.sequence}: "${duplicate.name}") — Selected.`);
          setErrorMsg(null);
          return prev;
        }

        const nextSeq = prev.length + 1;
        const normalized: FinderCapturedElement = {
          ...capturedRecord,
          sequence: nextSeq,
          name: capturedRecord.name.includes('#')
            ? capturedRecord.name.replace(/#\d+/, `#${nextSeq}`)
            : capturedRecord.name,
          targetPageId: capturedRecord.targetPageId || defaultPageId
        };
        const next = [...prev, normalized];
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {}
        setSelectedElementId(normalized.id);
        setSuccessMsg(`Captured element (#${nextSeq}: "${normalized.name}") successfully! Live browser remains open.`);
        setErrorMsg(null);
        return next;
      });
    });

    const unsubDisconnect = api.finder.onBrowserDisconnected(() => {
      setSessionStatus('closed');
    });

    return () => {
      unsubCapture();
      unsubDisconnect();
    };
  }, [isOpen, defaultPageId]);

  // Auto-dismiss transient messages
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // Currently selected element object
  const selectedElement = useMemo(() => {
    return capturedElements.find(e => e.id === selectedElementId) || capturedElements[0] || null;
  }, [capturedElements, selectedElementId]);

  // Update a field on the currently selected element
  const updateSelectedElement = (partial: Partial<FinderCapturedElement>) => {
    if (!selectedElement) return;
    setCapturedElements(prev =>
      prev.map(el => (el.id === selectedElement.id ? { ...el, ...partial } : el))
    );
  };

  // Helper to construct a FinderStrategy
  const createFinderStrategy = (type: LocatorType, value: string, isPrimary: boolean, priority: number): FinderStrategy => {
    const evaluation = evaluateLocatorStability(type, value);
    return {
      id: 'strat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      type,
      value,
      valueType: 'Static',
      isPrimary,
      priority,
      selected: true,
      stabilityScore: evaluation.stabilityScore,
      stability: evaluation.stability,
      reasons: evaluation.reasons,
      feedback: evaluation.feedback,
      matchCount: 1
    };
  };

  // Create a new blank captured element manually
  const handleCreateElement = () => {
    const seq = capturedElements.length + 1;
    const defaultStrat = createFinderStrategy('ID', `element_${seq}`, true, 1);
    const newElement: FinderCapturedElement = {
      id: 'custom_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      sequence: seq,
      name: `Custom Element #${seq}`,
      type: 'Button',
      tag: 'button',
      visibleText: `Custom Element ${seq}`,
      accessibleName: `Custom Element ${seq}`,
      description: 'Manually created element in Locator Finder',
      locators: [defaultStrat],
      primaryLocatorId: defaultStrat.id,
      targetPageId: defaultPageId,
      pushed: false,
      capturedAt: new Date().toISOString()
    };
    const next = [...capturedElements, newElement];
    setCapturedElements(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
    api.finder.setCapturedSequence(next.length);
    setSelectedElementId(newElement.id);
    setSuccessMsg(`Created new element: "${newElement.name}"`);
  };

  // Load a built-in sample element
  const handleLoadSample = (sample: typeof SAMPLE_ELEMENTS[0]) => {
    const seq = capturedElements.length + 1;
    const strategies: FinderStrategy[] = sample.locators.map((loc, idx) =>
      createFinderStrategy(loc.type, loc.value, idx === 0, idx + 1)
    );

    const newElement: FinderCapturedElement = {
      id: 'sample_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      sequence: seq,
      name: `${sample.name} #${seq}`,
      type: sample.type,
      tag: sample.tag,
      visibleText: sample.visibleText,
      accessibleName: sample.accessibleName,
      description: sample.description,
      locators: strategies,
      primaryLocatorId: strategies[0]?.id || '',
      targetPageId: defaultPageId,
      pushed: false,
      capturedAt: new Date().toISOString()
    };

    const next = [...capturedElements, newElement];
    setCapturedElements(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
    api.finder.setCapturedSequence(next.length);
    setSelectedElementId(newElement.id);
    setSuccessMsg(`Added sample element: "${newElement.name}"`);
  };

  // Browser Session Controls
  const handleStartSession = async () => {
    setIsStartingSession(true);
    setErrorMsg(null);
    let target = inspectUrl.trim();
    if (!target || target === 'https://demo.playwright.dev' || target === 'demo.playwright.dev' || target === 'https://demo.playwright.dev/') {
      target = 'https://demo.playwright.dev/todomvc';
      setInspectUrl(target);
    }
    try {
      localStorage.setItem(`ea_finder_url_${project?.id || 'default'}`, target);
    } catch {}
    try {
      const res = await api.finder.startSession(target, browserType, captureMode);
      if (res.success) {
        setSessionStatus('capturing');
        setSuccessMsg('Live browser session active. Hover and click elements on the page to capture locators continuously.');
      } else {
        setErrorMsg(res.error || 'Failed to start browser session');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error launching browser');
    } finally {
      setIsStartingSession(false);
    }
  };

  const handlePauseSession = async () => {
    try {
      await api.finder.pauseCapture();
      setSessionStatus('paused');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to pause capture');
    }
  };

  const handleResumeSession = async () => {
    try {
      await api.finder.resumeCapture();
      setSessionStatus('capturing');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to resume capture');
    }
  };

  const handleCloseBrowser = async () => {
    try {
      await api.finder.closeSession();
      setSessionStatus('closed');
      setSuccessMsg('Browser session ended.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to close browser');
    }
  };

  const handleModeChange = async (mode: 'normal' | 'reference') => {
    setCaptureMode(mode);
    try {
      await api.finder.setCaptureMode(mode);
      if (mode === 'reference') {
        setSuccessMsg('Reference Mode active: First click the Reference element, then click the Target element.');
      }
    } catch (err: any) {
      console.warn('Could not update capture mode in browser:', err);
    }
  };

  // Locator Management Actions
  const handleSetPrimary = (locatorId: string) => {
    if (!selectedElement) return;
    const targetLoc = selectedElement.locators.find(l => l.id === locatorId);
    if (!targetLoc) return;

    const remaining = selectedElement.locators.filter(l => l.id !== locatorId);
    const reordered = [targetLoc, ...remaining].map((l, idx) => ({
      ...l,
      isPrimary: idx === 0,
      priority: idx + 1
    }));

    updateSelectedElement({
      locators: reordered,
      primaryLocatorId: targetLoc.id
    });
  };

  const handleMovePriority = (index: number, direction: 'up' | 'down') => {
    if (!selectedElement) return;
    const locators = [...selectedElement.locators];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= locators.length) return;

    const temp = locators[index];
    locators[index] = locators[targetIndex];
    locators[targetIndex] = temp;

    const updated = locators.map((l, i) => ({
      ...l,
      priority: i + 1,
      isPrimary: i === 0
    }));

    updateSelectedElement({
      locators: updated,
      primaryLocatorId: updated[0]?.id || ''
    });
  };

  const handleUpdateLocator = (locatorId: string, updates: Partial<FinderStrategy>) => {
    if (!selectedElement) return;
    const updatedLocators = selectedElement.locators.map(loc => {
      if (loc.id !== locatorId) return loc;
      const merged = { ...loc, ...updates };

      if (updates.value !== undefined || updates.type !== undefined) {
        const evalResult = evaluateLocatorStability(merged.type, merged.value);
        merged.stabilityScore = evalResult.stabilityScore;
        merged.stability = evalResult.stability;
        merged.reasons = evalResult.reasons;
        merged.feedback = evalResult.feedback;
      }
      if (updates.valueType !== undefined) {
        merged.valueType = updates.valueType;
      }
      return merged;
    });

    updateSelectedElement({ locators: updatedLocators });
  };

  const handleDeleteLocator = (locatorId: string) => {
    if (!selectedElement) return;
    if (selectedElement.locators.length <= 1) {
      setErrorMsg('Cannot delete the only remaining locator strategy. Each element requires at least one locator.');
      return;
    }

    const nextLocators = selectedElement.locators.filter(l => l.id !== locatorId);
    const hasPrimary = nextLocators.some(l => l.isPrimary);
    if (!hasPrimary && nextLocators.length > 0) {
      nextLocators[0].isPrimary = true;
    }

    nextLocators.forEach((l, i) => {
      l.priority = i + 1;
    });

    updateSelectedElement({
      locators: nextLocators,
      primaryLocatorId: nextLocators.find(l => l.isPrimary)?.id || nextLocators[0]?.id || ''
    });
    setSuccessMsg('Locator strategy removed.');
  };

  const handleAddCustomLocator = () => {
    if (!selectedElement) return;
    const newStrategy = createFinderStrategy(
      'XPath',
      `//${selectedElement.tag || 'div'}`,
      false,
      selectedElement.locators.length + 1
    );
    updateSelectedElement({
      locators: [...selectedElement.locators, newStrategy]
    });
  };

  const handleHighlightLocator = async (locator: FinderStrategy) => {
    setHighlightingLocatorId(locator.id);
    setErrorMsg(null);
    try {
      const res = await api.finder.highlightLocator(locator.type, locator.value);
      if (!res.success && res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg(`Highlighted ${res.matchCount} matching element(s) in browser`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Highlight failed');
    } finally {
      setTimeout(() => setHighlightingLocatorId(null), 1200);
    }
  };

  const handleTestLocator = async (locator: FinderStrategy) => {
    setTestingLocatorId(locator.id);
    setErrorMsg(null);
    try {
      const res = await api.finder.testLocator(locator.type, locator.value);
      if (res) {
        handleUpdateLocator(locator.id, {
          matchCount: res.matchCount,
          stabilityScore: res.stability?.stabilityScore ?? locator.stabilityScore,
          stability: res.stability?.stability ?? locator.stability,
          reasons: res.stability?.reasons ?? locator.reasons,
          feedback: res.stability?.feedback ?? locator.feedback
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Locator testing failed');
    } finally {
      setTestingLocatorId(null);
    }
  };

  const handleCopyLocator = (locator: FinderStrategy) => {
    try {
      navigator.clipboard.writeText(locator.value);
      setCopiedLocatorId(locator.id);
      setTimeout(() => setCopiedLocatorId(null), 1500);
    } catch {
      setErrorMsg('Could not access clipboard');
    }
  };

  const handleDeleteElement = (elementId: string) => {
    const next = capturedElements.filter(e => e.id !== elementId);
    const reindexed = next.map((el, idx) => ({
      ...el,
      sequence: idx + 1,
      name: el.name.replace(/#\d+/, `#${idx + 1}`)
    }));
    setCapturedElements(reindexed);
    try {
      localStorage.setItem(storageKey, JSON.stringify(reindexed));
    } catch {}
    api.finder.setCapturedSequence(reindexed.length);

    if (selectedElementId === elementId) {
      setSelectedElementId(reindexed[0]?.id || null);
    }
    setSuccessMsg('Element removed and element sequence auto-synced.');
  };

  const handleClearAll = () => {
    if (window.confirm('Clear all captured elements from this session?')) {
      setCapturedElements([]);
      setSelectedElementId(null);
      localStorage.removeItem(storageKey);
      api.finder.setCapturedSequence(0);
      setSuccessMsg('Captured elements cleared.');
    }
  };

  // Push Selected Elements to Repository
  const handlePushSingle = async () => {
    if (!selectedElement) return;
    const targetPage = selectedElement.targetPageId || defaultPageId;

    if (!selectedElement.name.trim()) {
      setErrorMsg('Element Name is required.');
      return;
    }
    if (!targetPage) {
      setErrorMsg('Please select a target repository page.');
      return;
    }

    const locatorsPayload: Locator[] = selectedElement.locators.map((s, idx) => ({
      id: s.id,
      type: s.type,
      value: s.value,
      valueType: s.valueType,
      isPrimary: s.isPrimary,
      priority: idx + 1
    }));

    if (locatorsPayload.length === 0) {
      setErrorMsg('Please provide at least one locator strategy.');
      return;
    }

    // Check duplicate
    const safeExisting = Array.isArray(existingElements) ? existingElements : [];
    const duplicate = safeExisting.find(
      e => e && e.pageId === targetPage && (e.name || '').trim().toLowerCase() === selectedElement.name.trim().toLowerCase()
    );

    setIsSubmittingSingle(true);
    setErrorMsg(null);
    try {
      const res = await onSaveElement({
        name: selectedElement.name.trim(),
        type: selectedElement.type,
        elementMode: selectedElement.elementMode || 'Static',
        description: selectedElement.description?.trim(),
        pageId: targetPage,
        locators: locatorsPayload,
        overwriteElementId: duplicate?.id
      });

      if (res && res.success) {
        // Once pushed, remove the element from the locator capture list
        const remaining = capturedElements.filter(e => e.id !== selectedElement.id);
        const reindexed = remaining.map((el, idx) => ({
          ...el,
          sequence: idx + 1,
          name: el.name.replace(/#\d+/, `#${idx + 1}`)
        }));
        setCapturedElements(reindexed);
        try {
          localStorage.setItem(storageKey, JSON.stringify(reindexed));
        } catch {}
        api.finder.setCapturedSequence(reindexed.length);
        setSelectedElementId(reindexed[0]?.id || null);
        setSuccessMsg(`Pushed "${selectedElement.name}" to Repository successfully and removed from Locator Finder.`);
      } else {
        setErrorMsg(res?.error || 'Failed to save element to repository');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error pushing element');
    } finally {
      setIsSubmittingSingle(false);
    }
  };

  // Batch Push Review Dialog handlers
  const openReviewModal = () => {
    const initialSelection: Record<string, boolean> = {};
    const initialPages: Record<string, string> = {};
    capturedElements.forEach(el => {
      initialSelection[el.id] = true;
      initialPages[el.id] = el.targetPageId || defaultPageId;
    });
    setSelectedForPush(initialSelection);
    setTargetPageOverrides(initialPages);
    setIsReviewModalOpen(true);
  };

  const handleToggleSelectAll = () => {
    const allSelected = capturedElements.every(e => selectedForPush[e.id]);
    const next: Record<string, boolean> = {};
    capturedElements.forEach(e => {
      next[e.id] = !allSelected;
    });
    setSelectedForPush(next);
  };

  const handlePushBatch = async () => {
    const toPush = capturedElements.filter(e => selectedForPush[e.id]);
    if (toPush.length === 0) {
      setErrorMsg('Please select at least one element to push.');
      return;
    }

    setIsPushingBatch(true);
    setErrorMsg(null);
    let successCount = 0;
    const pushedIds = new Set<string>();
    const safeExisting = Array.isArray(existingElements) ? existingElements : [];

    try {
      for (const item of toPush) {
        const targetPage = targetPageOverrides[item.id] || item.targetPageId || defaultPageId;
        const duplicate = safeExisting.find(
          e => e && e.pageId === targetPage && (e.name || '').trim().toLowerCase() === item.name.trim().toLowerCase()
        );

        const locatorsPayload: Locator[] = item.locators.map((s, idx) => ({
          id: s.id,
          type: s.type,
          value: s.value,
          valueType: s.valueType,
          isPrimary: s.isPrimary,
          priority: idx + 1
        }));

        const res = await onSaveElement({
          name: item.name.trim(),
          type: item.type,
          elementMode: item.elementMode || 'Static',
          description: item.description?.trim(),
          pageId: targetPage,
          locators: locatorsPayload,
          overwriteElementId: duplicate?.id
        });

        if (res && res.success) {
          successCount++;
          pushedIds.add(item.id);
        } else if (res && res.error) {
          console.warn(`Failed to push element "${item.name}":`, res.error);
        }
      }

      if (successCount > 0) {
        // Once pushed, remove all successfully pushed elements from locator capture list
        const remaining = capturedElements.filter(e => !pushedIds.has(e.id));
        const reindexed = remaining.map((el, idx) => ({
          ...el,
          sequence: idx + 1,
          name: el.name.replace(/#\d+/, `#${idx + 1}`)
        }));
        setCapturedElements(reindexed);
        try {
          localStorage.setItem(storageKey, JSON.stringify(reindexed));
        } catch {}
        api.finder.setCapturedSequence(reindexed.length);
        setSelectedElementId(reindexed[0]?.id || null);
        setSuccessMsg(`Pushed ${successCount} element(s) to Repository successfully and removed from Locator Finder!`);
      } else {
        setErrorMsg('Failed to push elements to repository. Please verify locator syntax and page selection.');
      }
      setIsReviewModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred during batch push');
    } finally {
      setIsPushingBatch(false);
    }
  };

  const filteredCapturedElements = useMemo(() => {
    if (!searchQuery.trim()) return capturedElements;
    const q = searchQuery.toLowerCase();
    return capturedElements.filter(
      e => e.name.toLowerCase().includes(q) || e.tag.toLowerCase().includes(q)
    );
  }, [capturedElements, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-[1440px] h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-800/80 bg-slate-900/90 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500/20 to-cyan-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 shadow-inner">
              <Crosshair className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Web Element Finder & Locator Studio
                </h2>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                  captureMode === 'reference'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-brand-500/10 border-brand-500/30 text-brand-400'
                }`}>
                  {captureMode === 'reference' ? 'Relative Reference Mode' : 'Continuous Capture Mode'}
                </span>
                {sessionStatus === 'capturing' && (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    Browser Active
                  </span>
                )}
                {sessionStatus === 'paused' && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400">
                    Capture Paused
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Click elements in the live browser to capture and manage locators continuously without losing session context.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/70 transition-colors"
              title="Close Locator Finder"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Browser Session Control Toolbar */}
        <div className="px-6 py-2.5 bg-slate-900/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center flex-1 min-w-[320px] max-w-2xl space-x-2">
            <div className="relative flex-1">
              <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={inspectUrl}
                onChange={e => {
                  const val = e.target.value;
                  setInspectUrl(val);
                  try {
                    localStorage.setItem(`ea_finder_url_${project?.id || 'default'}`, val);
                  } catch {}
                }}
                placeholder="https://example.com"
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 text-slate-200 text-xs transition-colors"
              />
            </div>

            <select
              value={browserType}
              onChange={e => setBrowserType(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:border-brand-500"
            >
              <option value="chromium">Chromium</option>
              <option value="firefox">Firefox</option>
              <option value="webkit">WebKit (Safari)</option>
            </select>

            <div className="flex items-center p-0.5 rounded-xl bg-slate-950 border border-slate-800">
              <button
                type="button"
                onClick={() => handleModeChange('normal')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  captureMode === 'normal'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('reference')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  captureMode === 'reference'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Capture relative locators between reference and target elements"
              >
                Reference
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            {sessionStatus === 'capturing' ? (
              <>
                <button
                  type="button"
                  onClick={handlePauseSession}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 flex items-center space-x-1.5 transition-all"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause Capture</span>
                </button>
                <button
                  type="button"
                  onClick={handleCloseBrowser}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-300 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/30 flex items-center space-x-1.5 transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Close Browser</span>
                </button>
              </>
            ) : sessionStatus === 'paused' ? (
              <>
                <button
                  type="button"
                  onClick={handleResumeSession}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center space-x-1.5 transition-all shadow-md shadow-emerald-900/30"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Resume Capture</span>
                </button>
                <button
                  type="button"
                  onClick={handleCloseBrowser}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-300 hover:bg-rose-500/20 hover:text-rose-300 transition-all"
                >
                  <span>Close</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleStartSession}
                disabled={isStartingSession}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-brand-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white flex items-center space-x-2 transition-all shadow-md shadow-brand-900/40 disabled:opacity-50"
              >
                {isStartingSession ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Launching Browser...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Launch & Start Capture</span>
                  </>
                )}
              </button>
            )}

            <div className="h-4 w-px bg-slate-800 mx-1" />

            <button
              type="button"
              onClick={openReviewModal}
              disabled={capturedElements.length === 0}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center space-x-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-cyan-900/30"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Review & Push ({capturedElements.length})</span>
            </button>
          </div>
        </div>

        {/* Global Banner Messages */}
        {errorMsg && (
          <div className="px-6 py-2 bg-rose-500/10 border-b border-rose-500/30 flex items-center justify-between text-xs text-rose-300 shrink-0">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="px-6 py-2 bg-emerald-500/10 border-b border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300 shrink-0">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Main Body Split Panel */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Captured Elements List */}
          <div className="w-80 sm:w-96 border-r border-slate-800/80 bg-slate-950/70 flex flex-col shrink-0">
            {/* Header with Search and Clear */}
            <div className="p-3.5 border-b border-slate-800/70 flex flex-col space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Current Session Elements
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                    {capturedElements.length}
                  </span>
                </div>

                <div className="flex items-center space-x-1.5">
                  <div className="relative group">
                    <button
                      type="button"
                      className="px-2 py-1 rounded-lg text-[11px] font-medium bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 flex items-center space-x-1 transition-colors"
                    >
                      <Plus className="w-3 h-3 text-brand-400" />
                      <span>Sample</span>
                    </button>
                    <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-20 w-48 py-1.5 bg-slate-900 border border-slate-800 rounded-xl shadow-xl">
                      {SAMPLE_ELEMENTS.map((s, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleLoadSample(s)}
                          className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-brand-600 hover:text-white transition-colors"
                        >
                          + {s.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={handleCreateElement}
                      className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-brand-500/10 border border-brand-500/20 text-brand-300 hover:bg-brand-500/20 transition-colors flex items-center space-x-1"
                      title="Add a custom element manually"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add</span>
                    </button>
                    {capturedElements.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAll}
                        className="px-2 py-0.5 rounded-lg text-[11px] text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Clear all captured elements"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Search filter */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Filter elements..."
                  className="w-full pl-8 pr-3 py-1 rounded-lg bg-slate-900 border border-slate-800 focus:border-brand-500 text-slate-300 text-xs"
                />
              </div>
            </div>

            {/* Elements Scrollable List */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
              {filteredCapturedElements.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-500">
                  <div className="w-12 h-12 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-center mb-3 text-slate-600">
                    <Crosshair className="w-6 h-6" />
                  </div>
                  <h4 className="text-xs font-semibold text-slate-300">No Elements Captured Yet</h4>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-[220px]">
                    Click "Launch & Start Capture" above and click any element in the live browser. Each click continuously records into this list.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleLoadSample(SAMPLE_ELEMENTS[0])}
                    className="mt-4 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 border border-slate-800 text-brand-400 hover:bg-brand-500/10 hover:border-brand-500/30 transition-colors"
                  >
                    + Load Demo Sample
                  </button>
                </div>
              ) : (
                filteredCapturedElements.map((el, idx) => {
                  const isSelected = el.id === selectedElementId;
                  return (
                    <div
                      key={el.id}
                      onClick={() => setSelectedElementId(el.id)}
                      className={`group relative p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-slate-900/90 border-brand-500/60 shadow-md shadow-brand-950/40 ring-1 ring-brand-500/30'
                          : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-900/70 hover:border-slate-700/80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-2 min-w-0">
                          <span className="w-5 h-5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-bold flex items-center justify-center shrink-0 border border-slate-700">
                            #{el.sequence || idx + 1}
                          </span>
                          <span className="text-xs font-bold text-white truncate group-hover:text-brand-300">
                            {el.name}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1 shrink-0">
                          {el.pushed ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                              <Check className="w-2.5 h-2.5" />
                              Pushed
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                              Ready
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              handleDeleteElement(el.id);
                            }}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Delete this element from capture session"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-800/60 text-[11px]">
                        <div className="flex items-center space-x-1.5 text-slate-400">
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                            &lt;{el.tag || 'div'}&gt;
                          </span>
                          <span className="text-slate-400">{el.type}</span>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-400">{el.locators.length} locators</span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedElementId(el.id);
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center space-x-1 transition-colors ${
                            isSelected
                              ? 'bg-brand-500/20 text-brand-300 border border-brand-500/40'
                              : 'bg-slate-800/80 text-slate-300 hover:bg-brand-500/10 hover:text-brand-300 border border-slate-700/60'
                          }`}
                        >
                          <Eye className="w-3 h-3" />
                          <span>{isSelected ? 'Viewing' : 'Open'}</span>
                        </button>
                      </div>

                      {el.referenceMode && el.referenceData && (
                        <div className="mt-1.5 text-[10px] text-amber-400/90 truncate">
                          Rel to &lt;{el.referenceData.refTag}&gt; "{el.referenceData.refText?.slice(0, 16)}"
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Panel: Selected Element Details & Locator Management */}
          <div className="flex-1 flex flex-col bg-slate-900/30 overflow-y-auto">
            {selectedElement ? (
              <div className="p-6 space-y-6">
                {/* Element Information Card */}
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-5 space-y-4 shadow-lg">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-xs">
                        #{selectedElement.sequence}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">Element Details & Target Configuration</h3>
                        <p className="text-[11px] text-slate-400">Configure element identity and destination page in repository</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleDeleteElement(selectedElement.id)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 flex items-center space-x-1.5 transition-colors"
                        title="Delete this element from session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                      <button
                        type="button"
                        onClick={handlePushSingle}
                        disabled={isSubmittingSingle}
                        className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white flex items-center space-x-1.5 transition-all shadow-md shadow-brand-900/40 disabled:opacity-50"
                      >
                        {isSubmittingSingle ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Pushing...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Push Element to Repository</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Element Name <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={selectedElement.name}
                        onChange={e => updateSelectedElement({ name: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-brand-500 text-slate-100 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Element Type <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={selectedElement.type}
                        onChange={e => updateSelectedElement({ type: e.target.value as ElementType })}
                        className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-brand-500 text-slate-100 text-xs"
                      >
                        {ELEMENT_TYPES.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Target Page in Repository <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={selectedElement.targetPageId || defaultPageId}
                        onChange={e => updateSelectedElement({ targetPageId: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-brand-500 text-slate-100 text-xs"
                      >
                        {pages.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Description & Notes
                    </label>
                    <input
                      type="text"
                      value={selectedElement.description || ''}
                      onChange={e => updateSelectedElement({ description: e.target.value })}
                      placeholder="Optional notes or context for automated test scripts..."
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-brand-500 text-slate-300 text-xs"
                    />
                  </div>

                  {/* Inspected Attributes & Metadata */}
                  <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-300">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-slate-500 font-medium">Tag:</span>
                      <span className="font-mono text-cyan-300 px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/50">&lt;{selectedElement.tag || 'button'}&gt;</span>
                    </div>
                    {selectedElement.visibleText && (
                      <div className="flex items-center space-x-1.5 max-w-[280px] truncate">
                        <span className="text-slate-500 font-medium">Text:</span>
                        <span className="text-slate-200 font-mono truncate" title={selectedElement.visibleText}>"{selectedElement.visibleText}"</span>
                      </div>
                    )}
                    {selectedElement.accessibleName && selectedElement.accessibleName !== selectedElement.visibleText && (
                      <div className="flex items-center space-x-1.5 max-w-[280px] truncate">
                        <span className="text-slate-500 font-medium">Accessible:</span>
                        <span className="text-slate-200 font-mono truncate" title={selectedElement.accessibleName}>"{selectedElement.accessibleName}"</span>
                      </div>
                    )}
                    <div className="flex items-center space-x-1.5">
                      <span className="text-slate-500 font-medium">Mode:</span>
                      <span className="text-slate-300 font-semibold">{selectedElement.elementMode || 'Static'}</span>
                    </div>
                    <div className="flex items-center space-x-1.5 ml-auto text-slate-500 text-[10px]">
                      <span>Captured:</span>
                      <span>{new Date(selectedElement.capturedAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>

                {/* Locator Strategies Management Section */}
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-5 space-y-4 shadow-lg">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs">
                        <Code2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-sm font-bold text-white">Locator Strategies & Prioritization</h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-cyan-400 border border-slate-700">
                            {selectedElement.locators.length} Strategies
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Primary locator is executed first by Playwright. Lower priority locators act as automatic self-healing fallbacks.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={handleAddCustomLocator}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 flex items-center space-x-1.5 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Add Custom Locator</span>
                      </button>
                    </div>
                  </div>

                  {/* Locator Table */}
                  <div className="border border-slate-800/90 rounded-xl overflow-hidden bg-slate-950">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-semibold text-[11px]">
                          <th className="py-2.5 px-3 w-10 text-center">Primary</th>
                          <th className="py-2.5 px-3 w-16 text-center">Priority</th>
                          <th className="py-2.5 px-3 w-36">Strategy Type</th>
                          <th className="py-2.5 px-3">Locator Value / Expression</th>
                          <th className="py-2.5 px-3 w-28 text-center">Stability</th>
                          <th className="py-2.5 px-3 w-24 text-center">DOM Match</th>
                          <th className="py-2.5 px-3 w-40 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {selectedElement.locators.map((loc, idx) => {
                          const isPrimary = loc.isPrimary;
                          const isTesting = testingLocatorId === loc.id;
                          const isHighlighting = highlightingLocatorId === loc.id;
                          const isCopied = copiedLocatorId === loc.id;

                          return (
                            <tr
                              key={loc.id}
                              className={`group hover:bg-slate-900/50 transition-colors ${
                                isPrimary ? 'bg-brand-500/[0.04]' : ''
                              }`}
                            >
                              {/* Primary Star */}
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleSetPrimary(loc.id)}
                                  className={`p-1 rounded-lg transition-transform hover:scale-110 ${
                                    isPrimary
                                      ? 'text-amber-400 hover:text-amber-300'
                                      : 'text-slate-600 hover:text-amber-400/80'
                                  }`}
                                  title={isPrimary ? 'Primary Locator (Target Priority 1)' : 'Click to set as Primary locator'}
                                >
                                  <Star className={`w-4 h-4 ${isPrimary ? 'fill-amber-400' : ''}`} />
                                </button>
                              </td>

                              {/* Priority controls */}
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center justify-center space-x-0.5">
                                  <span className="font-mono text-slate-400 text-xs font-bold w-4">
                                    {idx + 1}
                                  </span>
                                  <div className="flex flex-col">
                                    <button
                                      type="button"
                                      onClick={() => handleMovePriority(idx, 'up')}
                                      disabled={idx === 0}
                                      className="text-slate-500 hover:text-white disabled:opacity-20 disabled:hover:text-slate-500"
                                    >
                                      <ArrowUp className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleMovePriority(idx, 'down')}
                                      disabled={idx === selectedElement.locators.length - 1}
                                      className="text-slate-500 hover:text-white disabled:opacity-20 disabled:hover:text-slate-500"
                                    >
                                      <ArrowDown className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </td>

                              {/* Strategy Type Dropdown */}
                              <td className="py-2.5 px-3">
                                <select
                                  value={loc.type}
                                  onChange={e => handleUpdateLocator(loc.id, { type: e.target.value as LocatorType })}
                                  className="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs font-medium focus:border-brand-500"
                                >
                                  {LOCATOR_TYPES.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                  ))}
                                </select>
                              </td>

                              {/* Locator Value Input */}
                              <td className="py-2.5 px-3">
                                <div className="relative flex items-center">
                                  <input
                                    type="text"
                                    value={loc.value}
                                    onChange={e => handleUpdateLocator(loc.id, { value: e.target.value })}
                                    className="w-full font-mono text-xs px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-100 focus:border-brand-500 focus:bg-slate-900"
                                  />
                                  {loc.valueType === 'Dynamic' && (
                                    <span className="absolute right-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                      Dynamic
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Stability Badge with popover reasons */}
                              <td className="py-2.5 px-3 text-center">
                                <div className="relative group/stab inline-block">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold border cursor-help ${
                                      loc.stability === 'High'
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                        : loc.stability === 'Moderate'
                                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                    }`}
                                  >
                                    {loc.stabilityScore}/100 {loc.stability}
                                  </span>

                                  {/* Popover tooltip */}
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/stab:block z-30 w-56 p-2.5 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl text-left text-[11px] text-slate-300 pointer-events-none">
                                    <div className="font-bold text-white mb-1">Stability Assessment:</div>
                                    <ul className="list-disc list-inside space-y-0.5 text-slate-400">
                                      {(loc.reasons || ['Evaluated based on selector resilience']).map((r, i) => (
                                        <li key={i}>{r}</li>
                                      ))}
                                    </ul>
                                    {loc.feedback && (
                                      <div className="mt-1.5 pt-1.5 border-t border-slate-800 text-brand-300">
                                        💡 {loc.feedback}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* DOM Match Result */}
                              <td className="py-2.5 px-3 text-center">
                                {loc.matchCount === 1 ? (
                                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                    1 Unique
                                  </span>
                                ) : loc.matchCount > 1 ? (
                                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                    {loc.matchCount} Matches
                                  </span>
                                ) : loc.matchCount === 0 ? (
                                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                    0 Found
                                  </span>
                                ) : (
                                  <span className="text-slate-500 text-[11px]">Untested</span>
                                )}
                              </td>

                              {/* Action Buttons */}
                              <td className="py-2.5 px-3 text-right">
                                <div className="flex items-center justify-end space-x-1">
                                  {/* Highlight in live browser */}
                                  <button
                                    type="button"
                                    onClick={() => handleHighlightLocator(loc)}
                                    disabled={isHighlighting}
                                    className={`p-1.5 rounded-lg border text-slate-300 hover:text-white transition-all ${
                                      isHighlighting
                                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 animate-pulse'
                                        : 'bg-slate-900 border-slate-800 hover:bg-slate-800'
                                    }`}
                                    title="Highlight and pulse element in live browser"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Test Locator against live DOM */}
                                  <button
                                    type="button"
                                    onClick={() => handleTestLocator(loc)}
                                    disabled={isTesting}
                                    className={`p-1.5 rounded-lg border text-slate-300 hover:text-white transition-all ${
                                      isTesting
                                        ? 'bg-brand-500/20 border-brand-500/40 text-brand-300'
                                        : 'bg-slate-900 border-slate-800 hover:bg-slate-800'
                                    }`}
                                    title="Test locator against live browser DOM"
                                  >
                                    {isTesting ? (
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Play className="w-3.5 h-3.5" />
                                    )}
                                  </button>

                                  {/* Copy locator string */}
                                  <button
                                    type="button"
                                    onClick={() => handleCopyLocator(loc)}
                                    className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                                    title="Copy locator value to clipboard"
                                  >
                                    {isCopied ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>

                                  {/* Delete single locator */}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteLocator(loc.id)}
                                    className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-rose-500/10 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 transition-colors"
                                    title="Delete this locator only (does not delete element)"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                <Monitor className="w-12 h-12 text-slate-700 mb-3" />
                <h4 className="text-sm font-semibold text-slate-300">No Element Selected</h4>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Select an element from the left panel to review and manage its locators, or launch the browser to capture new elements.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Bottom Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>
              {capturedElements.length} elements in session ({capturedElements.filter(e => e.pushed).length} pushed to repository)
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-850 transition-colors"
            >
              Done & Exit
            </button>
            <button
              type="button"
              onClick={openReviewModal}
              disabled={capturedElements.length === 0}
              className="px-5 py-1.5 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-all shadow-md shadow-brand-900/40 disabled:opacity-40"
            >
              Review & Push Elements
            </button>
          </div>
        </div>
      </div>

      {/* Review & Batch Push Modal */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Review & Push to Repository</h3>
                  <p className="text-xs text-slate-400">
                    Select the elements to push into your project's repository pages
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-900/40 border-b border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="flex items-center space-x-2 text-xs text-slate-300 hover:text-white"
              >
                {capturedElements.every(e => selectedForPush[e.id]) ? (
                  <CheckSquare className="w-4 h-4 text-brand-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-500" />
                )}
                <span>Select All ({capturedElements.length} elements)</span>
              </button>

              <span className="text-xs text-slate-400">
                {Object.values(selectedForPush).filter(Boolean).length} of {capturedElements.length} selected
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {capturedElements.map(el => {
                const isChecked = !!selectedForPush[el.id];
                const pageId = targetPageOverrides[el.id] || el.targetPageId || defaultPageId;
                const safeExisting = Array.isArray(existingElements) ? existingElements : [];
                const duplicate = safeExisting.find(
                  e => e && e.pageId === pageId && (e.name || '').trim().toLowerCase() === el.name.trim().toLowerCase()
                );
                const primaryLoc = el.locators.find(l => l.isPrimary) || el.locators[0];

                return (
                  <div
                    key={el.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isChecked
                        ? 'bg-slate-900/80 border-slate-700'
                        : 'bg-slate-950 border-slate-850 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center space-x-3 min-w-0">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedForPush(prev => ({ ...prev, [el.id]: !prev[el.id] }))
                          }
                          className="text-slate-400 hover:text-white shrink-0"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-brand-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-500" />
                          )}
                        </button>

                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-white truncate">{el.name}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono">
                              &lt;{el.tag}&gt;
                            </span>
                            <span className="text-xs text-slate-400">({el.type})</span>
                          </div>
                          {primaryLoc && (
                            <div className="text-[11px] font-mono text-cyan-400 truncate mt-0.5">
                              {primaryLoc.type}: {primaryLoc.value}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 shrink-0">
                        {duplicate && (
                          <div className="flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-300">
                            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>Will Overwrite Existing</span>
                          </div>
                        )}

                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs text-slate-400">Page:</span>
                          <select
                            value={pageId}
                            onChange={e =>
                              setTargetPageOverrides(prev => ({ ...prev, [el.id]: e.target.value }))
                            }
                            className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:border-brand-500"
                          >
                            {pages.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-6 py-3.5 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePushBatch}
                disabled={isPushingBatch || Object.values(selectedForPush).filter(Boolean).length === 0}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white flex items-center space-x-2 transition-all shadow-md shadow-brand-900/40 disabled:opacity-50"
              >
                {isPushingBatch ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Pushing Elements to Repository...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Push ({Object.values(selectedForPush).filter(Boolean).length}) Elements to Repository</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
