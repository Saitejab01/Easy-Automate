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
  AlertCircle
} from 'lucide-react';
import { api } from '../../api/client';
import { Project, RepositoryPage, RepositoryElement, Locator, ElementType } from '../../api/types';
import { ElementDrawer } from './ElementDrawer';

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

  useEffect(() => {
    loadRepository();
  }, [project.id]);

  const loadRepository = async () => {
    setIsLoading(true);
    try {
      const [pagesRes, elementsRes] = await Promise.all([
        api.repository.getPages(project.id),
        api.repository.getElements(project.id)
      ]);

      if (pagesRes.success && pagesRes.pages) {
        setPages(pagesRes.pages);
        // Expand root pages by default
        const rootIds = new Set(pagesRes.pages.filter(p => !p.parentId).map(p => p.id));
        setExpandedPageIds(rootIds);

        // Select first page if none selected
        if (!selectedPageId && pagesRes.pages.length > 0) {
          setSelectedPageId(pagesRes.pages[0].id);
        }
      }

      if (elementsRes.success && elementsRes.elements) {
        setElements(elementsRes.elements);
      }
    } catch (err) {
      console.error('Failed to load repository:', err);
    } finally {
      setIsLoading(false);
    }
  };

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
    setExpandedPageIds(new Set(pages.map(p => p.id)));
  };

  const collapseAll = () => {
    setExpandedPageIds(new Set());
  };

  // Build hierarchical tree
  const rootPages = pages.filter(p => !p.parentId);
  const getSubpages = (parentId: string) => pages.filter(p => p.parentId === parentId);
  const getPageElements = (pageId: string) => elements.filter(e => e.pageId === pageId);

  // Selected Page Info & Elements
  const selectedPage = pages.find(p => p.id === selectedPageId) || pages[0];
  const activeElements = selectedPage
    ? elements.filter(e => e.pageId === selectedPage.id)
    : [];

  const filteredElements = activeElements.filter(e =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.locators.some(l => l.value.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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

  // Delete Action
  const handleConfirmDelete = async () => {
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
        }
      } else {
        const res = await api.repository.deleteElement(itemToDelete.id, project.id);
        if (res.success) {
          setElements(elements.filter(e => e.id !== itemToDelete.id));
        }
      }
      setItemToDelete(null);
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  };

  // Save Element from Drawer
  const handleSaveElement = async (elementData: {
    name: string;
    type: ElementType;
    description?: string;
    pageId: string;
    locators: Locator[];
  }) => {
    if (elementToEdit) {
      const res = await api.repository.updateElement(elementToEdit.id, project.id, elementData);
      if (res.success && res.element) {
        setElements(elements.map(e => (e.id === elementToEdit.id ? res.element! : e)));
        return { success: true };
      }
      return { success: false, error: res.error };
    } else {
      const res = await api.repository.createElement(project.id, elementData.pageId, elementData);
      if (res.success && res.element) {
        setElements([...elements, res.element]);
        setSelectedPageId(elementData.pageId);
        return { success: true };
      }
      return { success: false, error: res.error };
    }
  };

  // Render tree item recursively
  const renderTreePage = (page: RepositoryPage, depth = 0) => {
    const subpages = getSubpages(page.id);
    const pageElems = getPageElements(page.id);
    const isExpanded = expandedPageIds.has(page.id);
    const isSelected = selectedPageId === page.id;

    return (
      <div key={page.id} className="select-none">
        <div
          onClick={() => setSelectedPageId(page.id)}
          className={`group flex items-center justify-between py-1.5 px-2 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
            isSelected
              ? 'bg-brand-600/15 text-brand-300 border border-brand-500/30 font-semibold'
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

            <Folder className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-brand-400' : 'text-slate-500'}`} />
            <span className="truncate">{page.name}</span>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[10px] bg-slate-900 border border-slate-800 px-1.5 py-0.2 rounded-full text-slate-400 font-mono">
              {pageElems.length}
            </span>
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
            {subpages.map(sub => renderTreePage(sub, depth + 1))}
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

            {/* Filter Search Input */}
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

          {/* Elements List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {filteredElements.length === 0 ? (
              <div className="text-center py-20 px-4 border border-dashed border-slate-800 rounded-2xl bg-slate-950/40">
                <Component className="w-12 h-12 text-slate-600 mx-auto mb-3 stroke-[1.5]" />
                <h3 className="text-sm font-semibold text-slate-200">
                  {searchQuery ? 'No matching elements found' : 'No elements in this page yet'}
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  {searchQuery
                    ? `No element matched "${searchQuery}". Try a different search keyword.`
                    : 'Add UI element locators (Buttons, Input Fields, Links) to start building automation scripts.'}
                </p>
                {!searchQuery && selectedPage && (
                  <button
                    onClick={() => {
                      setElementToEdit(null);
                      setIsDrawerOpen(true);
                    }}
                    className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white shadow-sm transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add First Element to {selectedPage.name}</span>
                  </button>
                )}
              </div>
            ) : (
              filteredElements.map((el) => {
                const primaryLocator = el.locators.find(l => l.isPrimary) || el.locators[0];
                const hasDynamic = el.locators.some(l => l.valueType === 'Dynamic');

                return (
                  <div
                    key={el.id}
                    className="bg-slate-950/80 border border-slate-800/90 hover:border-slate-700 rounded-xl p-4.5 transition-all shadow-sm space-y-3"
                  >
                    {/* Element Card Top Row */}
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white tracking-tight">{el.name}</h4>
                          <span className="text-[10px] font-semibold text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded-full">
                            {el.type}
                          </span>
                          {hasDynamic && (
                            <span className="text-[10px] font-semibold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5" />
                              Dynamic Placeholders
                            </span>
                          )}
                        </div>
                        {el.description && (
                          <p className="text-xs text-slate-400 mt-0.5">{el.description}</p>
                        )}
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
                          onClick={() => setItemToDelete({ type: 'element', id: el.id, name: el.name })}
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
                            {primaryLocator.type}
                          </span>
                          <span className="text-brand-300 truncate">{primaryLocator.value}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 uppercase font-sans font-medium">
                          Primary
                        </span>
                      </div>
                    )}

                    {/* Other Configured Locators preview if multiple */}
                    {el.locators.length > 1 && (
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 pt-1">
                        <span className="text-slate-500">Other Locators ({el.locators.length - 1}):</span>
                        {el.locators
                          .filter(l => !l.isPrimary && l.id !== primaryLocator?.id)
                          .map((l, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 font-mono text-[10px]"
                            >
                              <strong>{l.type}:</strong> {l.value.slice(0, 32)}
                              {l.value.length > 32 ? '...' : ''}
                            </span>
                          ))}
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
      <ElementDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setElementToEdit(null);
        }}
        pages={pages}
        selectedPageId={selectedPageId}
        elementToEdit={elementToEdit}
        onSave={handleSaveElement}
      />

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

      {/* Delete Confirmation Dialog */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
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
            </div>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setItemToDelete(null)}
                className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
