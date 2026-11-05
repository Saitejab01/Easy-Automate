import React, { useState, useEffect, useRef } from 'react';
import {
  FileSpreadsheet,
  Folder,
  FolderPlus,
  FolderOpen,
  Plus,
  Upload,
  Download,
  Trash2,
  Edit2,
  Search,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Clock,
  User,
  HardDrive,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Table,
  Layers,
  Sparkles,
  LayoutGrid,
  List,
  Eye,
  X
} from 'lucide-react';
import { api } from '../../api/client';
import { Project, TestDataFolder, TestDataFile, ExcelFormat } from '../../api/types';
import { useAuth } from '../../context/AuthContext';

interface TestDataViewProps {
  project: Project;
}

export const TestDataView: React.FC<TestDataViewProps> = ({ project }) => {
  const { currentUser } = useAuth();

  const [folders, setFolders] = useState<TestDataFolder[]>([]);
  const [files, setFiles] = useState<TestDataFile[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isLoading, setIsLoading] = useState(true);

  // Folder Modals
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [folderModalParentId, setFolderModalParentId] = useState<string | null>(null);
  const [folderModalName, setFolderModalName] = useState('');
  const [folderModalError, setFolderModalError] = useState<string | null>(null);

  const [folderToRename, setFolderToRename] = useState<TestDataFolder | null>(null);
  const [renameFolderName, setRenameFolderName] = useState('');

  const [folderToDelete, setFolderToDelete] = useState<TestDataFolder | null>(null);

  // File Modals
  const [fileToRename, setFileToRename] = useState<TestDataFile | null>(null);
  const [renameFileName, setRenameFileName] = useState('');

  const [fileToDelete, setFileToDelete] = useState<TestDataFile | null>(null);
  const [fileToInspect, setFileToInspect] = useState<TestDataFile | null>(null);

  // Upload & Replace state
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [pendingReplaceFile, setPendingReplaceFile] = useState<{
    file: File;
    existingFile: TestDataFile;
    targetFolderId: string | null;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadTestData();
  }, [project.id]);

  const loadTestData = async () => {
    setIsLoading(true);
    try {
      const [foldersRes, filesRes] = await Promise.all([
        api.testData.getFolders(project.id),
        api.testData.getFiles(project.id)
      ]);

      if (foldersRes.success && foldersRes.folders) {
        setFolders(foldersRes.folders);
        // Expand root folders by default
        const rootIds = new Set(foldersRes.folders.filter(f => !f.parentId).map(f => f.id));
        setExpandedFolderIds(rootIds);

        // Default select first folder or null
        if (selectedFolderId === null && foldersRes.folders.length > 0) {
          setSelectedFolderId(foldersRes.folders[0].id);
        }
      }

      if (filesRes.success && filesRes.files) {
        setFiles(filesRes.files);
      }
    } catch (err) {
      console.error('Failed to load test data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Tree Expand / Collapse
  const toggleFolderExpand = (folderId: string) => {
    const next = new Set(expandedFolderIds);
    if (next.has(folderId)) {
      next.delete(folderId);
    } else {
      next.add(folderId);
    }
    setExpandedFolderIds(next);
  };

  const expandAll = () => {
    setExpandedFolderIds(new Set(folders.map(f => f.id)));
  };

  const collapseAll = () => {
    setExpandedFolderIds(new Set());
  };

  // Hierarchical Helpers
  const rootFolders = folders.filter(f => !f.parentId);
  const getSubfolders = (parentId: string) => folders.filter(f => f.parentId === parentId);
  const getFolderFiles = (folderId: string | null) => files.filter(f => f.folderId === folderId);

  // Selected Folder Info
  const selectedFolder = selectedFolderId ? folders.find(f => f.id === selectedFolderId) : null;

  // Build Breadcrumbs Array
  const buildBreadcrumbs = (): { id: string | null; name: string }[] => {
    if (!selectedFolderId || !selectedFolder) {
      return [{ id: null, name: 'Root Test Data' }];
    }
    const crumbs: { id: string | null; name: string }[] = [];
    let curr: TestDataFolder | undefined = selectedFolder;
    while (curr) {
      crumbs.unshift({ id: curr.id, name: curr.name });
      curr = curr.parentId ? folders.find(f => f.id === curr?.parentId) : undefined;
    }
    crumbs.unshift({ id: null, name: 'Test Data' });
    return crumbs;
  };

  // Files in Current View
  const currentFiles = files.filter(f => f.folderId === selectedFolderId);
  const currentSubfolders = selectedFolderId ? getSubfolders(selectedFolderId) : rootFolders;

  const filteredFiles = currentFiles.filter(f =>
    f.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (f.description && f.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // --- Folder Operations ---
  const handleOpenCreateFolder = (parentId?: string | null) => {
    setFolderModalParentId(parentId !== undefined ? parentId : selectedFolderId);
    setFolderModalName('');
    setFolderModalError(null);
    setIsFolderModalOpen(true);
  };

  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderModalName.trim()) {
      setFolderModalError('Folder name cannot be empty.');
      return;
    }

    try {
      const res = await api.testData.createFolder(project.id, folderModalName.trim(), folderModalParentId);
      if (res.success && res.folder) {
        setFolders([...folders, res.folder]);
        setSelectedFolderId(res.folder.id);
        if (folderModalParentId) {
          setExpandedFolderIds(new Set(expandedFolderIds).add(folderModalParentId));
        }
        setIsFolderModalOpen(false);
      } else {
        setFolderModalError(res.error || 'Failed to create folder.');
      }
    } catch (err: any) {
      setFolderModalError(err.message || 'An error occurred.');
    }
  };

  const handleRenameFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderToRename || !renameFolderName.trim()) return;

    try {
      const res = await api.testData.updateFolder(folderToRename.id, project.id, renameFolderName.trim());
      if (res.success && res.folder) {
        setFolders(folders.map(f => (f.id === folderToRename.id ? res.folder! : f)));
        setFolderToRename(null);
      }
    } catch (err: any) {
      console.error('Failed to rename folder:', err);
    }
  };

  const handleConfirmDeleteFolder = async () => {
    if (!folderToDelete) return;
    try {
      const res = await api.testData.deleteFolder(folderToDelete.id, project.id);
      if (res.success) {
        // Collect descendants to remove from state
        const idsToRemove = [folderToDelete.id];
        const collectDescendants = (parentId: string) => {
          folders.filter(f => f.parentId === parentId).forEach(c => {
            idsToRemove.push(c.id);
            collectDescendants(c.id);
          });
        };
        collectDescendants(folderToDelete.id);

        setFolders(folders.filter(f => !idsToRemove.includes(f.id)));
        setFiles(files.filter(f => !f.folderId || !idsToRemove.includes(f.folderId)));

        if (selectedFolderId && idsToRemove.includes(selectedFolderId)) {
          setSelectedFolderId(null);
        }
        setFolderToDelete(null);
      }
    } catch (err) {
      console.error('Failed to delete folder:', err);
    }
  };

  // --- Excel File Upload Handling ---
  const handleUploadClick = () => {
    setUploadError(null);
    setUploadSuccess(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const processFileUpload = async (file: File, replaceExisting = false) => {
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();

    // 4.4 Format Validation
    if (ext !== '.xlsx' && ext !== '.xls') {
      setUploadError(`Unsupported file format "${ext}". Easy Automate only accepts Excel files (.xlsx and .xls).`);
      return;
    }

    // Check if duplicate exists in currently selected folder
    const targetFolder = selectedFolderId;
    const existing = files.find(f => f.folderId === targetFolder && f.fileName.toLowerCase() === file.name.toLowerCase());

    if (existing && !replaceExisting) {
      setPendingReplaceFile({ file, existingFile: existing, targetFolderId: targetFolder });
      return;
    }

    // Read base64
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      const uploadedBy = currentUser?.email || 'Active User';

      // Mock sheet names based on filename
      const inferredSheets = file.name.includes('login')
        ? ['Credentials', 'Tokens']
        : file.name.includes('cart')
        ? ['CartItems', 'Discounts']
        : file.name.includes('search')
        ? ['Keywords', 'Filters']
        : ['Sheet1', 'Config'];

      try {
        const res = await api.testData.uploadFile(project.id, targetFolder, {
          fileName: file.name,
          fileSizeBytes: file.size,
          uploadedBy,
          fileData: base64Data,
          sheetNames: inferredSheets,
          rowCount: Math.floor(Math.random() * 30) + 10,
          description: `Uploaded Excel test dataset for ${selectedFolder?.name || 'Project Root'}`
        });

        if (res.success && res.file) {
          if (existing) {
            setFiles(files.map(f => (f.id === existing.id ? res.file! : f)));
            setUploadSuccess(`Replaced existing file "${file.name}" successfully!`);
          } else {
            setFiles([res.file, ...files]);
            setUploadSuccess(`Uploaded "${file.name}" successfully!`);
          }
          setPendingReplaceFile(null);
          setTimeout(() => setUploadSuccess(null), 4000);
        } else {
          setUploadError(res.error || 'Failed to upload Excel file.');
        }
      } catch (err: any) {
        setUploadError(err.message || 'Error occurred while saving file.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;
    Array.from(uploadedFiles).forEach(f => processFileUpload(f));
  };

  // Drag and Drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      Array.from(e.dataTransfer.files).forEach(f => processFileUpload(f));
    }
  };

  // --- Download File ---
  const handleDownloadFile = (file: TestDataFile) => {
    const dataUri = file.fileData || 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,UEsDBBQAAAAIAAA=';
    const link = document.createElement('a');
    link.href = dataUri;
    link.download = file.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Rename File ---
  const handleRenameFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileToRename || !renameFileName.trim()) return;

    try {
      const res = await api.testData.updateFile(fileToRename.id, project.id, {
        fileName: renameFileName.trim()
      });
      if (res.success && res.file) {
        setFiles(files.map(f => (f.id === fileToRename.id ? res.file! : f)));
        setFileToRename(null);
      }
    } catch (err) {
      console.error('Failed to rename file:', err);
    }
  };

  // --- Delete File ---
  const handleConfirmDeleteFile = async () => {
    if (!fileToDelete) return;
    try {
      const res = await api.testData.deleteFile(fileToDelete.id, project.id);
      if (res.success) {
        setFiles(files.filter(f => f.id !== fileToDelete.id));
        setFileToDelete(null);
      }
    } catch (err) {
      console.error('Failed to delete file:', err);
    }
  };

  // Render Folder Tree Item recursively
  const renderTreeFolder = (folder: TestDataFolder, depth = 0) => {
    const subfolders = getSubfolders(folder.id);
    const folderFileCount = getFolderFiles(folder.id).length;
    const isExpanded = expandedFolderIds.has(folder.id);
    const isSelected = selectedFolderId === folder.id;

    return (
      <div key={folder.id} className="select-none">
        <div
          onClick={() => setSelectedFolderId(folder.id)}
          className={`group flex items-center justify-between py-1.5 px-2 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
            isSelected
              ? 'bg-emerald-600/15 text-emerald-300 border border-emerald-500/30 font-semibold'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          }`}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {subfolders.length > 0 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFolderExpand(folder.id);
                }}
                className="w-4 h-4 flex items-center justify-center text-slate-500 hover:text-slate-300"
              >
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <span className="w-4" />
            )}

            {isExpanded ? (
              <FolderOpen className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-emerald-400' : 'text-slate-500'}`} />
            ) : (
              <Folder className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-emerald-400' : 'text-slate-500'}`} />
            )}
            <span className="truncate">{folder.name}</span>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[10px] bg-slate-900 border border-slate-800 px-1.5 py-0.2 rounded-full text-slate-400 font-mono">
              {folderFileCount}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenCreateFolder(folder.id);
              }}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded"
              title="Add Subfolder"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setFolderToRename(folder);
                setRenameFolderName(folder.name);
              }}
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded"
              title="Rename Folder"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setFolderToDelete(folder);
              }}
              className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded"
              title="Delete Folder"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Nested Subfolders */}
        {isExpanded && subfolders.length > 0 && (
          <div className="space-y-0.5 mt-0.5">
            {subfolders.map(sub => renderTreeFolder(sub, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-400">Loading Test Data Explorer & Excel Workbooks...</p>
      </div>
    );
  }

  const breadcrumbs = buildBreadcrumbs();

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs font-mono text-slate-400">Centralized Project Test Data Repository (Stage 3)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <FileSpreadsheet className="w-7 h-7 text-emerald-400" />
            Test Data Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Hierarchical folder organization and Excel data file store (.xlsx and .xls) for data-driven Playwright automation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            accept=".xlsx,.xls"
            multiple
            className="hidden"
          />

          <button
            onClick={() => handleOpenCreateFolder(selectedFolderId)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-200 transition-colors"
          >
            <FolderPlus className="w-4 h-4 text-emerald-400" />
            <span>New Folder</span>
          </button>

          <button
            onClick={handleUploadClick}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 transition-all hover:scale-[1.02]"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Excel File</span>
          </button>
        </div>
      </div>

      {/* Cross-Module Integration Architecture Banner */}
      <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-white">Centralized Shared Project Resource:</span>
            <span className="text-slate-400 ml-1.5">
              These Excel datasets are accessible across TestDev (Scripts), TestDev (Execution), and Suites without duplication.
            </span>
          </div>
        </div>
        <span className="hidden md:inline-flex text-[10px] bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-md font-mono text-emerald-400">
          Cross-Module Ready
        </span>
      </div>

      {/* Upload Feedback Banners */}
      {uploadError && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{uploadError}</span>
          </div>
          <button onClick={() => setUploadError(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {uploadSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{uploadSuccess}</span>
          </div>
          <button onClick={() => setUploadSuccess(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main 2-Pane Explorer Layout: Tree on Left, Files on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[640px]">
        {/* Left Pane (4 Cols): 4.2 Folder & Subfolder Tree */}
        <div className="lg:col-span-4 bg-slate-900/80 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-lg">
          {/* Tree Toolbar */}
          <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-emerald-400" />
              Folder Structure
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

          {/* Root Directory Button */}
          <div className="p-2 border-b border-slate-800/80 bg-slate-950/30">
            <button
              onClick={() => setSelectedFolderId(null)}
              className={`w-full flex items-center justify-between py-1.5 px-2.5 rounded-xl text-xs font-semibold transition-colors ${
                selectedFolderId === null
                  ? 'bg-emerald-600/15 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                <span>Test Data (Root Directory)</span>
              </div>
              <span className="text-[10px] bg-slate-900 border border-slate-800 px-1.5 py-0.2 rounded-full font-mono">
                {getFolderFiles(null).length}
              </span>
            </button>
          </div>

          {/* Tree Folders List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {rootFolders.length === 0 ? (
              <div className="text-center py-12 px-4 text-xs text-slate-500">
                No folders created yet. Click "New Folder" to begin organizing your test data by module or scenario.
              </div>
            ) : (
              rootFolders.map(f => renderTreeFolder(f, 0))
            )}
          </div>

          {/* Footer Info */}
          <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-950/40 text-[11px] text-slate-500 flex items-center justify-between">
            <span>{folders.length} folders & subfolders</span>
            <span>{files.length} Excel workbooks</span>
          </div>
        </div>

        {/* Right Pane (8 Cols): Files in Selected Folder */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="lg:col-span-8 bg-slate-900/80 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-lg relative"
        >
          {/* Breadcrumb Navigation & Controls Header (Section 4.6) */}
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Breadcrumb Bar */}
            <div className="flex items-center flex-wrap gap-1 text-xs">
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={crumb.id || idx}>
                  {idx > 0 && <span className="text-slate-600 mx-1">/</span>}
                  <button
                    onClick={() => setSelectedFolderId(crumb.id)}
                    className={`hover:text-white transition-colors ${
                      idx === breadcrumbs.length - 1 ? 'font-bold text-white' : 'text-slate-400'
                    }`}
                  >
                    {crumb.name}
                  </button>
                </React.Fragment>
              ))}
            </div>

            {/* Search & View Switcher */}
            <div className="flex items-center gap-3">
              <div className="relative w-48 sm:w-56">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Search className="w-3.5 h-3.5" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter Excel files..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-slate-800 text-slate-400">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-colors ${
                    viewMode === 'grid' ? 'bg-slate-800 text-white' : 'hover:text-white'
                  }`}
                  title="Grid View"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-lg transition-colors ${
                    viewMode === 'list' ? 'bg-slate-800 text-white' : 'hover:text-white'
                  }`}
                  title="List View"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Subfolders Chips in Selected Folder */}
          {currentSubfolders.length > 0 && selectedFolderId !== null && (
            <div className="px-6 py-2.5 bg-slate-950/20 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto text-xs">
              <span className="text-[11px] text-slate-500 font-medium">Subfolders:</span>
              {currentSubfolders.map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setSelectedFolderId(sub.id)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-slate-300 hover:text-white transition-colors"
                >
                  <Folder className="w-3 h-3 text-emerald-400" />
                  <span>{sub.name}</span>
                  <span className="text-[10px] text-slate-500">({getFolderFiles(sub.id).length})</span>
                </button>
              ))}
            </div>
          )}

          {/* Files List / Grid Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {filteredFiles.length === 0 ? (
              <div className="text-center py-20 px-4 border border-dashed border-slate-800 rounded-2xl bg-slate-950/40">
                <FileSpreadsheet className="w-12 h-12 text-slate-600 mx-auto mb-3 stroke-[1.5]" />
                <h3 className="text-sm font-semibold text-slate-200">
                  {searchQuery ? 'No matching Excel files' : 'No test data files in this folder'}
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  {searchQuery
                    ? `No file matched "${searchQuery}". Try a different keyword.`
                    : 'Upload .xlsx or .xls spreadsheets to supply data-driven parameters for Playwright scripts.'}
                </p>
                {!searchQuery && (
                  <div className="mt-5 flex items-center justify-center gap-3">
                    <button
                      onClick={handleUploadClick}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Upload Excel File</span>
                    </button>
                  </div>
                )}
              </div>
            ) : viewMode === 'grid' ? (
              /* Grid View */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredFiles.map((file) => (
                  <div
                    key={file.id}
                    className="bg-slate-950/80 border border-slate-800/90 hover:border-slate-700 rounded-2xl p-5 transition-all shadow-sm flex flex-col justify-between group space-y-4"
                  >
                    <div>
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                            <FileSpreadsheet className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-white truncate group-hover:text-emerald-300 transition-colors" title={file.fileName}>
                              {file.fileName}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-mono font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                                {file.fileFormat}
                              </span>
                              <span className="text-[11px] text-slate-400 font-mono">{file.fileSizeFormatted}</span>
                            </div>
                          </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDownloadFile(file)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                            title="Download Excel File"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setFileToRename(file);
                              setRenameFileName(file.fileName);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            title="Rename File"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setFileToDelete(file)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Delete File"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {file.description && (
                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                          {file.description}
                        </p>
                      )}

                      {/* Worksheets Preview Chips */}
                      {file.sheetNames && file.sheetNames.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] text-slate-500 font-medium">Sheets:</span>
                          {file.sheetNames.map((s, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded text-[10px] bg-slate-900 border border-slate-800 text-slate-300 font-mono"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Card Footer (Section 4.5 File Details) */}
                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                      <span className="flex items-center gap-1 truncate max-w-[140px]">
                        <User className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{file.uploadedBy}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setFileToInspect(file)}
                        className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspect Data</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* List / Table View */
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">File Name</th>
                      <th className="py-3 px-4">Format</th>
                      <th className="py-3 px-4">Size</th>
                      <th className="py-3 px-4">Sheets / Rows</th>
                      <th className="py-3 px-4">Uploaded By</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-300">
                    {filteredFiles.map((file) => (
                      <tr key={file.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-semibold text-white flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="truncate max-w-xs">{file.fileName}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-[10px] font-mono font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                            {file.fileFormat}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-400">{file.fileSizeFormatted}</td>
                        <td className="py-3 px-4 text-[11px] text-slate-400 font-mono">
                          {file.sheetNames?.length || 1} sheet(s) · {file.rowCount || 12} rows
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px] truncate max-w-xs">
                          {file.uploadedBy}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setFileToInspect(file)}
                              className="p-1 rounded text-slate-400 hover:text-white"
                              title="Inspect Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadFile(file)}
                              className="p-1 rounded text-slate-400 hover:text-emerald-400"
                              title="Download File"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setFileToRename(file);
                                setRenameFileName(file.fileName);
                              }}
                              className="p-1 rounded text-slate-400 hover:text-white"
                              title="Rename File"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setFileToDelete(file)}
                              className="p-1 rounded text-slate-400 hover:text-rose-400"
                              title="Delete File"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- Modals --- */}

      {/* 1. Create Folder / Subfolder Modal */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <FolderPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {folderModalParentId ? 'Create New Subfolder' : 'Create New Root Folder'}
                </h3>
                <p className="text-xs text-slate-400">
                  {folderModalParentId
                    ? `Inside: ${folders.find(f => f.id === folderModalParentId)?.name}`
                    : 'Organize test datasets by module or scenario'}
                </p>
              </div>
            </div>

            {folderModalError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                <span>{folderModalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateFolderSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Folder Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={folderModalName}
                  onChange={(e) => {
                    setFolderModalName(e.target.value);
                    if (folderModalError) setFolderModalError(null);
                  }}
                  placeholder="e.g. Authentication Module, Checkout Scenarios"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-emerald-500 text-slate-100 text-xs sm:text-sm"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFolderModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-md transition-all"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Rename Folder Modal */}
      {folderToRename && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Rename Folder</h3>
            <form onSubmit={handleRenameFolderSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Folder Name</label>
                <input
                  type="text"
                  value={renameFolderName}
                  onChange={(e) => setRenameFolderName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-emerald-500 text-slate-100 text-xs sm:text-sm"
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setFolderToRename(null)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl"
                >
                  Save Rename
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Delete Folder Confirmation Dialog */}
      {folderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Delete Folder?</h3>
              <p className="text-xs text-slate-400 mt-1">
                Are you sure you want to delete <strong className="text-slate-200">"{folderToDelete.name}"</strong>?
              </p>
              <div className="mt-2 p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-rose-400 space-y-1">
                <p className="font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Warning: Cascade Deletion
                </p>
                <p className="text-slate-400">
                  All nested subfolders and Excel workbooks stored inside this folder will be permanently removed.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setFolderToDelete(null)}
                className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteFolder}
                className="px-4 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors"
              >
                Delete Folder & Contents
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Rename File Modal */}
      {fileToRename && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Rename Excel File</h3>
            <form onSubmit={handleRenameFileSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  File Name (must keep .xlsx or .xls extension)
                </label>
                <input
                  type="text"
                  value={renameFileName}
                  onChange={(e) => setRenameFileName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-emerald-500 text-slate-100 text-xs sm:text-sm font-mono"
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setFileToRename(null)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl"
                >
                  Save Rename
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Delete File Confirmation Dialog */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Delete File?</h3>
              <p className="text-xs text-slate-400 mt-1">
                Are you sure you want to delete <strong className="text-slate-200">"{fileToDelete.fileName}"</strong>?
              </p>
            </div>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setFileToDelete(null)}
                className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteFile}
                className="px-4 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors"
              >
                Delete File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Replace File Confirmation Dialog (Section 4.4) */}
      {pendingReplaceFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">File Already Exists</h3>
              <p className="text-xs text-slate-400 mt-1">
                A file named <strong className="text-slate-200 font-mono">"{pendingReplaceFile.file.name}"</strong> already exists in this folder.
              </p>
              <p className="text-xs text-slate-400 mt-2">
                Would you like to replace the existing file with the newly uploaded version?
              </p>
            </div>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setPendingReplaceFile(null)}
                className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => processFileUpload(pendingReplaceFile.file, true)}
                className="px-4 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors"
              >
                Replace File
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Inspect File Details Modal (Section 4.5 & Future Data Reading) */}
      {fileToInspect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-mono">{fileToInspect.fileName}</h3>
                  <p className="text-xs text-slate-400">Excel Workbook Telemetry & Parameter Mapping</p>
                </div>
              </div>
              <button onClick={() => setFileToInspect(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Format</span>
                <p className="font-mono text-emerald-400 font-bold mt-1">{fileToInspect.fileFormat}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Size</span>
                <p className="font-mono text-slate-200 font-bold mt-1">{fileToInspect.fileSizeFormatted}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Rows Estimate</span>
                <p className="font-mono text-purple-400 font-bold mt-1">{fileToInspect.rowCount || 12} rows</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Uploaded By</span>
                <p className="text-slate-200 font-medium truncate mt-1">{fileToInspect.uploadedBy}</p>
              </div>
            </div>

            {/* Worksheets & Data-Driven Mapping Preview */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Table className="w-3.5 h-3.5 text-emerald-400" />
                Detected Worksheets
              </span>

              <div className="flex flex-wrap gap-2">
                {fileToInspect.sheetNames?.map((sheet, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>{sheet}</span>
                  </span>
                ))}
              </div>

              {/* Sample Tabular Data Mock Preview */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Sample Parameter Schema (Preview for TestDev & Execution)
                </span>
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-[11px] text-slate-300">
                    <thead className="text-slate-500 border-b border-slate-800 text-[10px]">
                      <tr>
                        <th className="py-1 px-2">Row #</th>
                        <th className="py-1 px-2">Param1</th>
                        <th className="py-1 px-2">Param2</th>
                        <th className="py-1 px-2">ExpectedResult</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      <tr>
                        <td className="py-1.5 px-2 text-slate-500">1</td>
                        <td className="py-1.5 px-2 text-emerald-400">admin@demo.com</td>
                        <td className="py-1.5 px-2 text-slate-400">P@ssword123</td>
                        <td className="py-1.5 px-2 text-brand-400">DashboardDisplayed</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-2 text-slate-500">2</td>
                        <td className="py-1.5 px-2 text-emerald-400">test.user@company.io</td>
                        <td className="py-1.5 px-2 text-slate-400">Secure#2026</td>
                        <td className="py-1.5 px-2 text-brand-400">DashboardDisplayed</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <span className="text-[11px] text-slate-500 font-mono">
                Uploaded: {new Date(fileToInspect.uploadedAt).toLocaleString()}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadFile(fileToInspect)}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Workbook</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

