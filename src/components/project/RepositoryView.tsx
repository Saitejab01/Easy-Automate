import React, { useState, useEffect } from 'react';
import {
  FolderTree,
  Folder,
  FolderPlus,
  FileCode,
  Component,
  Plus,
  Edit2,
  Trash2,
  ChevronRight,
  ChevronDown,
  Search,
  Sparkles,
  Tag,
  CheckCircle2,
  Layers,
  Code2,
  AlertCircle,
  Crosshair,
  Zap,
  X
} from 'lucide-react';
import { api } from '../../api/client';
import { Project, RepositoryPage, RepositoryElement, Locator, ElementType } from '../../api/types';
import { ElementDrawer } from './ElementDrawer';
import { LocatorFinderModal } from './LocatorFinderModal';

interface RepositoryViewProps {
  project: Project;
}

export const RepositoryView: React.FC<RepositoryViewProps> = ({ project }) => {
  const [pages, setPages] = useState<RepositoryPage[]>([]);
  const [elements, setElements] = useState<RepositoryElement[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string>('');
  const [expandedPageIds, setExpandedPageIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modals & Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [elementToEdit, setElementToEdit] = useState<RepositoryElement | null>(null);
  const [isFinderOpen, setIsFinderOpen] = useState(false);

  // Page Modals
  const [isCreatePageModalOpen, setIsCreatePageModalOpen] = useState(false);
  const [newPageParentId, setNewPageParentId] = useState<string | null>(null);
  const [newPageName, setNewPageName] = useState('');
  const [pageModalError, setPageModalError] = useState<string | null>(null);

  const [pageToRename, setPageToRename] = useState<RepositoryPage | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const [itemToDelete, setItemToDelete] = useState<{
    type: 'page' | 'element';
    id: string;
    name: string;
  } | null>(null);
  const [deleteDependencyWarning, setDeleteDependencyWarning] = useState<{
    elementId: string;
    elementName: string;
    dependentScripts: Array<{ id: string; name: string; stepNumbers: number[] }>;
  } | null>(null);

  // Multi-select & Bulk Delete State
  const [selectedElementIds, setSelectedElementIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const loadRepository = async () => {
    setIsLoading(true);
    try {
      const [pagesRes, elementsRes] = await Promise.all([
        api.repository.getPages(project.id),
        api.repository.getElements(project.id)
      ]);

      const loadedPages = (pagesRes && pagesRes.success && Array.isArray(pagesRes.pages))
        ? pagesRes.pages
        : [];
      const loadedElements = (elementsRes && elementsRes.success && Array.isArray(elementsRes.elements))
        ? elementsRes.elements
        : [];

      setPages(loadedPages);
      setElements(loadedElements);

      // Expand root pages by default
      const rootIds = new Set(loadedPages.filter(p => p && !p.parentId).map(p => p.id));
      setExpandedPageIds(rootIds);

      // Select first page with elements, or first page if none selected
      setSelectedPageId(prev => {
        if (prev && loadedPages.some(p => p && p.id === prev)) return prev;
        const pageWithElements = loadedPages.find(p => loadedElements.some(e => e.pageId === p.id));
        return pageWithElements?.id || loadedPages[0]?.id || '';
      });
    } catch (err) {
      console.error('Failed to load repository:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRepository();
    // Application-wide automatic synchronization (Section 8)
    const unsub = api.repository.onElementChanged((data: any) => {
      loadRepository();
      if (data?.element?.pageId) {
        setSelectedPageId(data.element.pageId);
      }
    });
    return () => {
      unsub();
    };
  }, [project.id]);

  // Toggle page expanded/collapsed
  const toggleExpand = (pageId: string) => {
    const next = new Set(expandedPageIds);
    if (next.has(pageId)) {
      next.delete(pageId);
    } else {
      next.add(pageId);
    }
    setExpandedPageIds(next);
  };

  const expandAll = () => {
    setExpandedPageIds(new Set((pages || []).map(p => p.id)));
  };

  const collapseAll = () => {
    setExpandedPageIds(new Set());
  };

  const safePages = Array.isArray(pages) ? pages : [];
  const safeElements = Array.isArray(elements) ? elements : [];

  // Build hierarchical tree
  const rootPages = safePages.filter(p => p && !p.parentId);
  const getSubpages = (parentId: string) => safePages.filter(p => p && p.parentId === parentId);
  const getPageElements = (pageId: string) => safeElements.filter(e => e && e.pageId === pageId);

  // Selected Page Info & Elements
  const selectedPage = safePages.find(p => p && p.id === selectedPageId) || safePages[0] || null;
  const activeElements = selectedPage
    ? safeElements.filter(e => e && e.pageId === selectedPage.id)
    : [];

  const filteredElements = activeElements.filter(e => {
    if (!e) return false;
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return true;
    const nameMatch = (e.name || '').toLowerCase().includes(q);
    const typeMatch = (e.type || '').toLowerCase().includes(q);
    const locatorsMatch = Array.isArray(e.locators) && e.locators.some(l =>
      l && typeof l.value === 'string' && l.value.toLowerCase().includes(q)
    );
    return nameMatch || typeMatch || locatorsMatch;
  });

  // Create Page / Subpage
  const handleOpenCreatePage = (parentId?: string | null) => {
    setNewPageParentId(parentId || null);
    setNewPageName('');
    setPageModalError(null);
    setIsCreatePageModalOpen(true);
  };

  const handleCreatePageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPageName.trim()) {
      setPageModalError('Page name cannot be empty.');
      return;
    }

    try {
      const res = await api.repository.createPage(project.id, newPageName.trim(), newPageParentId);
      if (res.success && res.page) {
        setPages([...pages, res.page]);
        setSelectedPageId(res.page.id);
        if (newPageParentId) {
          setExpandedPageIds(new Set(expandedPageIds).add(newPageParentId));
        }
        setIsCreatePageModalOpen(false);
      } else {
        setPageModalError(res.error || 'Failed to create page.');
      }
    } catch (err: any) {
      setPageModalError(err.message || 'An error occurred.');
    }
  };

  // Rename Page
  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pageToRename || !renameValue.trim()) return;

    try {
      const res = await api.repository.updatePage(pageToRename.id, project.id, renameValue.trim());
      if (res.success && res.page) {
        setPages(pages.map(p => (p.id === pageToRename.id ? res.page! : p)));
        setPageToRename(null);
      }
    } catch (err: any) {
      console.error('Failed to rename page:', err);
    }
  };

  // Delete Action with Dependency Protection (Section 8.1)
  const handleConfirmDelete = async (force: boolean = false) => {
    if (!itemToDelete) return;

    try {
      if (itemToDelete.type === 'page') {
        const res = await api.repository.deletePage(itemToDelete.id, project.id);
        if (res.success) {
          const remainingPages = pages.filter(p => p.id !== itemToDelete.id && p.parentId !== itemToDelete.id);
          setPages(remainingPages);
          setElements(elements.filter(e => e.pageId !== itemToDelete.id));
          if (selectedPageId === itemToDelete.id) {
            setSelectedPageId(remainingPages[0]?.id || '');
          }
          setItemToDelete(null);
        }
      } else {
        const res = await api.repository.deleteElement(itemToDelete.id, project.id, force);
        if (res.success) {
          setElements(elements.filter(e => e.id !== itemToDelete.id));
          setItemToDelete(null);
          setDeleteDependencyWarning(null);
          await loadRepository();
        } else if (res.hasDependencies) {
          setDeleteDependencyWarning({
            elementId: itemToDelete.id,
            elementName: itemToDelete.name,
            dependentScripts: res.dependentScripts || []
          });
        } else {
          alert(res.error || 'Failed to delete element');
          setItemToDelete(null);
        }
      }
    } catch (err: any) {
      console.error('Failed to delete item:', err);
      alert(err.message || 'Failed to delete item');
    }
  };

  // Multi-select actions
  const handleToggleSelectElement = (elementId: string, e: React.MouseEvent | React.ChangeEvent) => {
    e.stopPropagation();
    setSelectedElementIds(prev => {
      const next = new Set(prev);
      if (next.has(elementId)) next.delete(elementId);
      else next.add(elementId);
      return next;
    });
  };

  const handleToggleSelectAllElements = () => {
    if (selectedElementIds.size === filteredElements.length) {
      setSelectedElementIds(new Set());
    } else {
      setSelectedElementIds(new Set(filteredElements.map(e => e.id)));
    }
  };

  const handleBulkDeleteElements = async () => {
    if (selectedElementIds.size === 0) return;
    const count = selectedElementIds.size;
    if (!window.confirm(`Are you sure you want to delete ${count} selected element(s)? Any script step referencing them will need updating.`)) {
      return;
    }

    setIsBulkDeleting(true);
    try {
      for (const elId of Array.from(selectedElementIds)) {
        await api.repository.deleteElement(elId, project.id, true);
      }
      setSelectedElementIds(new Set());
      await loadRepository();
    } catch (err: any) {
      alert(err.message || 'Error deleting elements');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Save Element from Drawer or Locator Finder
  const handleSaveElement = async (elementData: {
    name: string;
    type: ElementType;
    elementMode?: 'Static' | 'Dynamic';
    description?: string;
    pageId: string;
    locators: Locator[];
    overwriteElementId?: string;
  }) => {
    // Update if overwriteElementId is provided OR editing an existing element
    const targetId = elementData.overwriteElementId || elementToEdit?.id || null;
    if (targetId) {
      const res = await api.repository.updateElement(targetId, project.id, elementData);
      if (res.success && res.element) {
        setElements(prev => prev.map(e => (e.id === targetId ? res.element! : e)));
        if (elementData.pageId) {
          setSelectedPageId(elementData.pageId);
        }
        await loadRepository();
        return { success: true };
      }
      return { success: false, error: res.error };
    } else {
      const res = await api.repository.createElement(project.id, elementData.pageId, elementData);
      if (res.success && res.element) {
        setElements(prev => {
          const exists = prev.some(e => e.id === res.element!.id);
          return exists ? prev.map(e => (e.id === res.element!.id ? res.element! : e)) : [...prev, res.element!];
        });
        if (elementData.pageId) {
          setSelectedPageId(elementData.pageId);
        }
        await loadRepository();
        return { success: true };
      }
      return { success: false, error: res.error };
    }
  };

  // Render tree item recursively
  const renderTreePage = (page: RepositoryPage, depth = 0, visited = new Set<string>()) => {
    if (!page || !page.id || visited.has(page.id) || depth > 15) return null;
    visited.add(page.id);

    const subpages = getSubpages(page.id);
    const pageElems = getPageElements(page.id);
    const isExpanded = expandedPageIds instanceof Set ? expandedPageIds.has(page.id) : false;
    const isSelected = selectedPageId === page.id;
    const isAiPage = page.name?.toLowerCase() === 'ai elements';

    return (
      <div key={page.id} className="select-none">
        <div
          onClick={() => setSelectedPageId(page.id)}
          className={`group flex items-center justify-between py-1.5 px-2 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
            isSelected
              ? isAiPage ? 'bg-purple-600/15 text-purple-200 border border-purple-500/30 font-semibold' : 'bg-brand-600/15 text-brand-300 border border-brand-500/30 font-semibold'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          }`}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {subpages.length > 0 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(page.id);
                }}
                className="w-4 h-4 flex items-center justify-center text-slate-500 hover:text-slate-300"
              >
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <span className="w-4" />
            )}

            {isAiPage ? (
              <Sparkles className="w-3.5 h-3.5 shrink-0 text-purple-400" />
            ) : (
              <Folder className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-brand-400' : 'text-slate-500'}`} />
            )}
            <span className={`truncate ${isAiPage ? 'text-purple-300 font-semibold' : ''}`}>{page.name || 'Unnamed Page'}</span>
            {pageElems.length > 0 && (
              <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono border ml-1 ${
                isAiPage
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/30 font-semibold'
                  : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}>
                {pageElems.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenCreatePage(page.id);
              }}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded"
              title="Add Subpage"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPageToRename(page);
                setRenameValue(page.name);
              }}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded"
              title="Rename Page"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setItemToDelete({ type: 'page', id: page.id, name: page.name });
              }}
              className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded"
              title="Delete Page"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Nested Subpages */}
        {isExpanded && subpages.length > 0 && (
          <div className="space-y-0.5 mt-0.5">
            {subpages.map(sub => renderTreePage(sub, depth + 1, visited))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-400">Loading UI Element Repository tree...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            <span className="text-xs font-mono text-slate-400">Centralized UI Element Store (Section 3)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <FolderTree className="w-7 h-7 text-purple-400" />
            Repository
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Maintain hierarchical pages, subpages, and robust locator configurations with static and dynamic variables.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setElementToEdit(null);
              setIsFinderOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-600 via-indigo-600 to-brand-600 hover:from-purple-500 hover:to-brand-500 text-white shadow-md shadow-purple-600/25 transition-all hover:scale-[1.02]"
            title="Open Interactive Locator Finder & Inspector"
          >
            <Crosshair className="w-4 h-4" />
            <span>Locator Finder</span>
          </button>

          <button
            onClick={() => handleOpenCreatePage(null)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-200 transition-colors"
          >
            <FolderPlus className="w-4 h-4 text-brand-400" />
            <span>New Root Page</span>
          </button>

          <button
            onClick={() => {
              setElementToEdit(null);
              setIsDrawerOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white shadow-md shadow-brand-600/30 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            <span>Add Element (Drawer)</span>
          </button>
        </div>
      </div>

      {/* Main 2-Pane Workspace: Tree on Left, Elements on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[640px]">
        {/* Left Pane (4 Cols): 3.1 Hierarchical Tree View */}
        <div className="lg:col-span-4 bg-slate-900/80 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-lg">
          {/* Tree Toolbar */}
          <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <FolderTree className="w-3.5 h-3.5 text-brand-400" />
              Page Hierarchy
            </span>
            <div className="flex items-center space-x-1 text-[11px] text-slate-400">
              <button
                type="button"
                onClick={expandAll}
                className="hover:text-white px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors"
              >
                Expand
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={collapseAll}
                className="hover:text-white px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors"
              >
                Collapse
              </button>
            </div>
          </div>

          {/* Tree Nodes List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {rootPages.length === 0 ? (
              <div className="text-center py-12 px-4 text-xs text-slate-500">
                No pages created yet. Click "New Root Page" to begin structuring your application repository.
              </div>
            ) : (
              rootPages.map(p => renderTreePage(p, 0))
            )}
          </div>

          {/* Tree Footer Info */}
          <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-950/40 text-[11px] text-slate-500 flex items-center justify-between">
            <span>{pages.length} total pages / subpages</span>
            <span>{elements.length} stored elements</span>
          </div>
        </div>

        {/* Right Pane (8 Cols): Elements in Selected Page */}
        <div className="lg:col-span-8 bg-slate-900/80 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-lg">
          {/* Header & Search */}
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span>Repository</span>
                <span>/</span>
                <span className="font-semibold text-white">{selectedPage?.name || 'No Page Selected'}</span>
                {selectedPage?.parentId && (
                  <span className="text-[10px] text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2 py-0.2 rounded-full font-mono ml-1">
                    Subpage
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {activeElements.length} element{activeElements.length === 1 ? '' : 's'} mapped under this section
              </p>
            </div>

            {/* Filter Search Input & Select All */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {filteredElements.length > 0 && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filteredElements.length > 0 && selectedElementIds.size === filteredElements.length}
                    onChange={handleToggleSelectAllElements}
                    className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-brand-600 focus:ring-0 cursor-pointer"
                    title={selectedElementIds.size === filteredElements.length ? 'Deselect All' : 'Select All'}
                  />
                  <span className="text-xs text-slate-400 hidden md:inline">Select All</span>
                </div>
              )}
              <div className="relative w-full sm:w-64">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Search className="w-3.5 h-3.5" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter elements or locators..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>
          </div>

          {/* Bulk Action Toolbar */}
          {selectedElementIds.size > 0 && (
            <div className="mx-6 mt-4 p-3 rounded-xl bg-brand-950/40 border border-brand-500/30 flex items-center justify-between gap-3 shadow-lg animate-fadeIn">
              <div className="flex items-center gap-2 text-xs font-semibold text-brand-300">
                <CheckCircle2 className="w-4 h-4 text-brand-400" />
                <span>{selectedElementIds.size} Elements Selected</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBulkDeleteElements}
                  disabled={isBulkDeleting}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-sm"
                  title="Delete selected repository elements"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected Elements</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedElementIds(new Set())}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
                  title="Deselect All"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Elements List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {filteredElements.length === 0 ? (
              <div className="text-center py-20 px-4 border border-dashed border-slate-800 rounded-2xl bg-slate-950/40">
                <Component className="w-12 h-12 text-slate-600 mx-auto mb-3 stroke-[1.5]" />
                <h3 className="text-sm font-semibold text-slate-200">
                  {searchQuery ? 'No matching elements found' : (selectedPage ? 'No elements in this page yet' : 'No pages created yet')}
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  {searchQuery
                    ? `No element matched "${searchQuery}". Try a different search keyword.`
                    : (selectedPage
                        ? 'Add UI element locators (Buttons, Input Fields, Links) to start building automation scripts.'
                        : 'Create your first page from the sidebar or click "New Root Page" to begin structuring your application repository.')}
                </p>
                {!searchQuery && selectedPage && (
                  <div className="mt-5 flex items-center justify-center gap-3">
                    <button
                      onClick={() => setIsFinderOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-sm transition-all"
                    >
                      <Crosshair className="w-4 h-4" />
                      <span>Open Locator Finder</span>
                    </button>
                    <button
                      onClick={() => {
                        setElementToEdit(null);
                        setIsDrawerOpen(true);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 shadow-sm transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Manual Element Drawer</span>
                    </button>
                  </div>
                )}
                {!searchQuery && !selectedPage && (
                  <div className="mt-5 flex items-center justify-center">
                    <button
                      onClick={() => handleOpenCreatePage(null)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white shadow-md transition-all"
                    >
                      <FolderPlus className="w-4 h-4" />
                      <span>Create New Root Page</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              filteredElements.map((el) => {
                if (!el) return null;
                const locators = Array.isArray(el.locators) ? el.locators : [];
                const primaryLocator = locators.find(l => l && l.isPrimary) || locators[0] || null;
                const hasDynamic = locators.some(l => l && l.valueType === 'Dynamic');
                const isChecked = selectedElementIds.has(el.id);

                return (
                  <div
                    key={el.id}
                    className={`bg-slate-950/80 border rounded-xl p-4.5 transition-all shadow-sm space-y-3 ${
                      isChecked
                        ? 'border-brand-500/50 bg-brand-950/20 shadow-brand-500/5'
                        : 'border-slate-800/90 hover:border-slate-700'
                    }`}
                  >
                    {/* Element Card Top Row */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => handleToggleSelectElement(el.id, e)}
                          onClick={e => e.stopPropagation()}
                          className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-brand-600 focus:ring-0 cursor-pointer shrink-0 mt-0.5"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white tracking-tight">{el.name || 'Unnamed Element'}</h4>
                            {(selectedPage?.name.toLowerCase() === 'ai elements' || el.description?.toLowerCase().includes('ai')) && (
                              <span className="text-[10px] font-semibold text-purple-300 bg-purple-500/20 border border-purple-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-purple-400" />
                                AI Captured
                              </span>
                            )}
                            <span className="text-[10px] font-semibold text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded-full">
                              {el.type || 'Custom'}
                            </span>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                                el.elementMode === 'Dynamic'
                                  ? 'text-purple-400 bg-purple-500/10 border-purple-500/30'
                                  : 'text-slate-400 bg-slate-800/80 border-slate-700'
                              }`}
                            >
                              {el.elementMode === 'Dynamic' ? (
                                <>
                                  <Sparkles className="w-2.5 h-2.5" />
                                  Dynamic
                                </>
                              ) : (
                                'Static'
                              )}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500 bg-slate-900 border border-slate-800 px-1.5 py-0.2 rounded">
                              v{el.version || 1}
                            </span>
                          </div>
                          {el.description && (
                            <p className="text-xs text-slate-400 mt-0.5">{el.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setElementToEdit(el);
                            setIsDrawerOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          title="Edit Element & Locators"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setItemToDelete({ type: 'element', id: el.id, name: el.name || 'Element' })}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Delete Element"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Primary Locator Highlight */}
                    {primaryLocator && (
                      <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800/80 flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-2 truncate">
                          <span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-semibold">
                            {primaryLocator.type || 'Locator'}
                          </span>
                          <span className="text-brand-300 truncate">{primaryLocator.value || ''}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 uppercase font-sans font-medium">
                          Primary
                        </span>
                      </div>
                    )}

                    {/* Other Configured Locators preview if multiple */}
                    {locators.length > 1 && (
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 pt-1">
                        <span className="text-amber-400 font-semibold flex items-center gap-1">
                          <Zap className="w-3 h-3 text-amber-400" />
                          Auto-Prioritization ({locators.length}):
                        </span>
                        {locators
                          .filter(l => l && !l.isPrimary && l.id !== primaryLocator?.id)
                          .map((l, i) => {
                            const val = typeof l.value === 'string' ? l.value : String(l.value || '');
                            return (
                              <span
                                key={l.id || i}
                                className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[10px] text-slate-300"
                              >
                                <strong className="text-purple-300">#{l.priority || i + 2} {l.type || 'Locator'}:</strong> {val.slice(0, 32)}
                                {val.length > 32 ? '...' : ''}
                              </span>
                            );
                          })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Right-side Slider/Drawer (Section 3.3) */}
      {isDrawerOpen && (
        <ElementDrawer
          isOpen={isDrawerOpen}
          onClose={() => {
            setIsDrawerOpen(false);
            setElementToEdit(null);
          }}
          pages={pages}
          selectedPageId={selectedPageId}
          elementToEdit={elementToEdit}
          existingElements={elements}
          onSave={handleSaveElement}
          onOpenFinder={() => {
            setIsDrawerOpen(false);
            setIsFinderOpen(true);
          }}
        />
      )}

      {/* Interactive Locator Finder & Inspector Modal */}
      {isFinderOpen && (
        <LocatorFinderModal
          isOpen={isFinderOpen}
          onClose={() => {
            setIsFinderOpen(false);
            loadRepository();
          }}
          project={project}
          pages={pages}
          selectedPageId={selectedPageId}
          existingElements={elements}
          onSaveElement={handleSaveElement}
        />
      )}

      {/* Create Page / Subpage Modal */}
      {isCreatePageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center">
                <FolderPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {newPageParentId ? 'Create New Subpage' : 'Create New Root Page'}
                </h3>
                <p className="text-xs text-slate-400">
                  {newPageParentId
                    ? `Nested under: ${pages.find(p => p.id === newPageParentId)?.name}`
                    : 'Root section in your application repository'}
                </p>
              </div>
            </div>

            {pageModalError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                <span>{pageModalError}</span>
              </div>
            )}

            <form onSubmit={handleCreatePageSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Page Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={newPageName}
                  onChange={(e) => {
                    setNewPageName(e.target.value);
                    if (pageModalError) setPageModalError(null);
                  }}
                  placeholder="e.g. Checkout Page, Navigation Bar"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 text-slate-100 text-xs sm:text-sm"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatePageModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white rounded-xl shadow-md transition-all"
                >
                  Create Page
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Page Modal */}
      {pageToRename && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Rename Page</h3>
            <form onSubmit={handleRenameSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Page Name</label>
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 text-slate-100 text-xs sm:text-sm"
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPageToRename(null)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white rounded-xl"
                >
                  Save Rename
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog with Dependency Protection (Section 8.1) */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Delete {itemToDelete.type === 'page' ? 'Page' : 'Element'}?
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Are you sure you want to delete <strong className="text-slate-200">"{itemToDelete.name}"</strong>?
                {itemToDelete.type === 'page' && (
                  <span className="block text-rose-400 mt-1">
                    Warning: All subpages and elements under this page will also be removed.
                  </span>
                )}
              </p>

              {deleteDependencyWarning && (
                <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs space-y-1.5 animate-fadeIn">
                  <div className="font-semibold flex items-center gap-1.5 text-amber-400">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Active Script Dependencies Found</span>
                  </div>
                  <p className="text-[11px] text-amber-200/80">
                    This element is currently referenced by {deleteDependencyWarning.dependentScripts.length} script(s):
                  </p>
                  <ul className="list-disc pl-5 text-[11px] space-y-0.5 text-amber-200/90 font-mono">
                    {deleteDependencyWarning.dependentScripts.map(d => (
                      <li key={d.id}>
                        {d.name} (Step{d.stepNumbers.length > 1 ? 's' : ''}: {d.stepNumbers.join(', ')})
                      </li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-amber-400/90 font-sans pt-1">
                    Deleting this element will archive references without deleting your scripts.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => {
                  setItemToDelete(null);
                  setDeleteDependencyWarning(null);
                }}
                className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              {deleteDependencyWarning ? (
                <button
                  onClick={() => handleConfirmDelete(true)}
                  className="px-4 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors shadow-sm"
                >
                  Confirm Force Delete
                </button>
              ) : (
                <button
                  onClick={() => handleConfirmDelete(false)}
                  className="px-4 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

