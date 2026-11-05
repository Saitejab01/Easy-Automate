import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FolderKanban,
  ArrowLeft,
  LayoutDashboard,
  FolderTree,
  FileSpreadsheet,
  Code2,
  FileCode,
  PlayCircle,
  Layers,
  Settings,
  ChevronDown,
  ChevronRight,
  Globe,
  Monitor,
  Activity,
  Bot,
  Sparkles,
  Save,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { api } from '../api/client';
import { Project } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { DashboardView } from '../components/project/DashboardView';
import { RepositoryView } from '../components/project/RepositoryView';
import { PlaceholderView } from '../components/project/PlaceholderView';

type WorkspaceSection = 'dashboard' | 'repository' | 'test-data' | 'scripts' | 'execution' | 'suites' | 'settings';

export const IndividualProjectPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<WorkspaceSection>('dashboard');
  const [isTestDevOpen, setIsTestDevOpen] = useState(true);

  // Quick Settings state
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editBaseUrl, setEditBaseUrl] = useState('');
  const [editEnv, setEditEnv] = useState<'development' | 'staging' | 'production'>('development');
  const [editBrowser, setEditBrowser] = useState<'chromium' | 'firefox' | 'webkit'>('chromium');
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    if (id) {
      loadProject(id);
    }
  }, [id, currentUser]);

  const loadProject = async (projectId: string) => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const res = await api.projects.getById(projectId, currentUser.id);
      if (res.success && res.project) {
        setProject(res.project);
        setEditName(res.project.name);
        setEditDesc(res.project.description || '');
        setEditBaseUrl(res.project.baseUrl || '');
        setEditEnv(res.project.environment || 'development');
        setEditBrowser(res.project.defaultBrowser || 'chromium');
      } else {
        navigate('/projects');
      }
    } catch (err) {
      console.error('Failed to load project:', err);
      navigate('/projects');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !currentUser) return;
    setSaveErr(null);
    setSaveMsg(null);

    const cleanName = editName.trim();
    if (!cleanName || cleanName.length < 3) {
      setSaveErr('Project name must be at least 3 characters long.');
      return;
    }

    try {
      const res = await api.projects.update(project.id, currentUser.id, {
        name: cleanName,
        description: editDesc,
        baseUrl: editBaseUrl,
        environment: editEnv,
        defaultBrowser: editBrowser,
      });

      if (res.success && res.project) {
        setProject(res.project);
        setSaveMsg('Project settings updated successfully!');
        setTimeout(() => setSaveMsg(null), 3000);
      } else {
        setSaveErr(res.error || 'Failed to update settings.');
      }
    } catch (err: any) {
      setSaveErr(err.message || 'An error occurred.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-xl font-bold">Project Not Found</h2>
        <Link to="/projects" className="mt-4 px-4 py-2 bg-brand-600 rounded-xl text-xs font-semibold">
          Back to All Projects
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-2.25rem-4rem)] bg-slate-950 text-slate-100 overflow-hidden">
      {/* 1. Dedicated Workspace Sidebar */}
      <aside className="w-64 bg-slate-950 border-r border-slate-800/90 flex flex-col justify-between shrink-0 select-none">
        {/* Top: Project Info & Navigation */}
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Back to Projects */}
          <Link
            to="/projects"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors py-1 px-2 rounded-lg hover:bg-slate-900 group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>All Projects</span>
          </Link>

          {/* Project Header Card in Sidebar */}
          <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2 py-0.2 rounded-full uppercase tracking-wider">
                {project.environment || 'development'}
              </span>
              <span className="text-[10px] text-slate-500 capitalize flex items-center gap-1 font-mono">
                <Monitor className="w-3 h-3" />
                {project.defaultBrowser}
              </span>
            </div>
            <h2 className="text-sm font-bold text-white truncate" title={project.name}>
              {project.name}
            </h2>
            {project.baseUrl && (
              <p className="text-[10px] text-slate-400 font-mono truncate flex items-center gap-1">
                <Globe className="w-3 h-3 text-slate-500 shrink-0" />
                <span className="truncate">{project.baseUrl}</span>
              </p>
            )}
          </div>

          {/* Navigation Items (Section 1: Workspace Sections) */}
          <nav className="space-y-1 text-xs font-medium">
            {/* 1. Dashboard */}
            <button
              onClick={() => setActiveSection('dashboard')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                activeSection === 'dashboard'
                  ? 'bg-brand-600 text-white font-semibold shadow-md shadow-brand-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </button>

            {/* 2. Repository */}
            <button
              onClick={() => setActiveSection('repository')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                activeSection === 'repository'
                  ? 'bg-brand-600 text-white font-semibold shadow-md shadow-brand-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <FolderTree className="w-4 h-4 text-purple-400" />
              <span>Repository</span>
            </button>

            {/* 3. Test Data (Placeholder) */}
            <button
              onClick={() => setActiveSection('test-data')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
                activeSection === 'test-data'
                  ? 'bg-slate-800 text-brand-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Test Data</span>
              </div>
              <span className="text-[9px] bg-slate-900 text-slate-400 border border-slate-800 px-1.5 py-0.2 rounded font-mono">
                Stage 3
              </span>
            </button>

            {/* 4. TestDev (Collapsible Section) */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setIsTestDevOpen(!isTestDevOpen)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-slate-400 hover:text-slate-200 text-xs font-semibold uppercase tracking-wider"
              >
                <div className="flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5 text-brand-400" />
                  <span>TestDev</span>
                </div>
                {isTestDevOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>

              {isTestDevOpen && (
                <div className="pl-3 space-y-1 mt-1 border-l border-slate-800/80 ml-4">
                  {/* TestDev - Scripts (Placeholder) */}
                  <button
                    onClick={() => setActiveSection('scripts')}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                      activeSection === 'scripts'
                        ? 'bg-slate-800 text-brand-300 font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileCode className="w-3.5 h-3.5 text-brand-400" />
                      <span>Scripts</span>
                    </div>
                    <span className="text-[9px] text-slate-500 font-mono">Stage 3</span>
                  </button>

                  {/* TestDev - Execution (Placeholder) */}
                  <button
                    onClick={() => setActiveSection('execution')}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                      activeSection === 'execution'
                        ? 'bg-slate-800 text-brand-300 font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <PlayCircle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Execution</span>
                    </div>
                    <span className="text-[9px] text-slate-500 font-mono">Stage 4</span>
                  </button>
                </div>
              )}
            </div>

            {/* 5. Suites (Placeholder) */}
            <button
              onClick={() => setActiveSection('suites')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
                activeSection === 'suites'
                  ? 'bg-slate-800 text-brand-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4 text-purple-400" />
                <span>Suites</span>
              </div>
              <span className="text-[9px] bg-slate-900 text-slate-400 border border-slate-800 px-1.5 py-0.2 rounded font-mono">
                Stage 4
              </span>
            </button>
          </nav>
        </div>

        {/* Bottom Sidebar: Project Settings Quick Switcher */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/60">
          <button
            onClick={() => setActiveSection('settings')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors ${
              activeSection === 'settings'
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-slate-400" />
              <span>Project Settings</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">Config</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-slate-950">
        {activeSection === 'dashboard' && (
          <DashboardView
            project={project}
            onNavigateToRepository={() => setActiveSection('repository')}
          />
        )}

        {activeSection === 'repository' && <RepositoryView project={project} />}

        {activeSection === 'test-data' && (
          <PlaceholderView section="test-data" projectName={project.name} />
        )}

        {activeSection === 'scripts' && (
          <PlaceholderView section="scripts" projectName={project.name} />
        )}

        {activeSection === 'execution' && (
          <PlaceholderView section="execution" projectName={project.name} />
        )}

        {activeSection === 'suites' && (
          <PlaceholderView section="suites" projectName={project.name} />
        )}

        {activeSection === 'settings' && (
          <div className="p-8 max-w-2xl mx-auto space-y-6 animate-fadeIn">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Project Settings</h1>
              <p className="text-xs text-slate-400 mt-1">Configure project metadata, base URL, and default browser</p>
            </div>

            {saveMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{saveMsg}</span>
              </div>
            )}

            {saveErr && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                <span>{saveErr}</span>
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Project Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 text-slate-100 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Description</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 text-slate-100 text-xs resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Target Base URL</label>
                <input
                  type="url"
                  value={editBaseUrl}
                  onChange={(e) => setEditBaseUrl(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 text-slate-100 text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Environment</label>
                  <select
                    value={editEnv}
                    onChange={(e) => setEditEnv(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs"
                  >
                    <option value="development">Development</option>
                    <option value="staging">Staging</option>
                    <option value="production">Production</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Default Browser</label>
                  <select
                    value={editBrowser}
                    onChange={(e) => setEditBrowser(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs"
                  >
                    <option value="chromium">Chromium</option>
                    <option value="firefox">Firefox</option>
                    <option value="webkit">WebKit</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white flex items-center gap-2 shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
};
