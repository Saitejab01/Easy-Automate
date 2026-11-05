import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderKanban,
  Plus,
  Search,
  Globe,
  Monitor,
  Layers,
  ArrowRight,
  Trash2,
  Clock,
  Sparkles,
  Bot,
  ExternalLink,
  CheckCircle2,
  Activity
} from 'lucide-react';
import { api } from '../api/client';
import { Project } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { CreateProjectModal } from '../components/CreateProjectModal';

export const AllProjectsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    loadProjects();
  }, [currentUser]);

  const loadProjects = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const res = await api.projects.getAll(currentUser.id);
      if (res.success && res.projects) {
        setProjects(res.projects);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProjectCreated = (newProject: Project) => {
    setProjects([newProject, ...projects]);
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!currentUser) return;
    try {
      const res = await api.projects.delete(projectId, currentUser.id);
      if (res.success) {
        setProjects(projects.filter(p => p.id !== projectId));
        setProjectToDelete(null);
      }
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (p.baseUrl && p.baseUrl.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      {/* Top Banner / Hero Header */}
      <div className="border-b border-slate-900 bg-slate-900/40 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="text-xs font-mono text-slate-400">Workspace • {currentUser?.email}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <FolderKanban className="w-7 h-7 text-brand-400" />
              All Projects
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Manage your Playwright test automation suites, test cases, and NLP instructions.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/30 transition-all hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" />
              <span>New Project</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Total Projects</span>
            <p className="text-xl font-bold text-white mt-1">{projects.length}</p>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Active Suites</span>
            <p className="text-xl font-bold text-emerald-400 mt-1">{projects.length}</p>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Engine</span>
            <p className="text-sm font-semibold text-slate-300 mt-1 flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-brand-400" /> Playwright TS
            </p>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">NLP Translation</span>
            <p className="text-sm font-semibold text-purple-400 mt-1 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" /> Enabled
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div className="relative w-full sm:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects by name or URL..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-200 text-xs placeholder:text-slate-500 transition-colors"
            />
          </div>

          <span className="text-xs text-slate-400 self-end sm:self-center">
            Showing <strong className="text-slate-200">{filteredProjects.length}</strong> of {projects.length} project{projects.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Project Cards Grid */}
        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-400">Loading your project workspaces...</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-20 px-4 border border-dashed border-slate-800 rounded-2xl bg-slate-900/30">
            <FolderKanban className="w-12 h-12 text-slate-600 mx-auto mb-3 stroke-[1.5]" />
            <h3 className="text-base font-semibold text-slate-200">
              {searchQuery ? 'No matching projects found' : 'No projects created yet'}
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? `No project matched "${searchQuery}". Try a different keyword.`
                : 'Create your first project to start organizing automated test cases with natural-language instructions.'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Create Your First Project</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                className="group bg-slate-900/80 border border-slate-800 hover:border-brand-500/50 rounded-2xl p-5 transition-all shadow-sm hover:shadow-xl hover:shadow-brand-950/20 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  {/* Top tags row */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      <Layers className="w-3 h-3" />
                      {project.environment || 'development'}
                    </span>

                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                      <Monitor className="w-3 h-3 text-slate-400" />
                      <span className="capitalize">{project.defaultBrowser || 'chromium'}</span>
                    </span>
                  </div>

                  {/* Project Name & Description */}
                  <h3 className="text-base font-bold text-slate-100 group-hover:text-brand-300 transition-colors line-clamp-1">
                    {project.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {project.description || 'No description provided.'}
                  </p>

                  {/* Base URL */}
                  {project.baseUrl && (
                    <div className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-400 font-mono bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800/80 truncate">
                      <Globe className="w-3 h-3 text-brand-400 shrink-0" />
                      <span className="truncate">{project.baseUrl}</span>
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <Clock className="w-3 h-3" />
                    <span>Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setProjectToDelete(project);
                      }}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Delete Project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-400 group-hover:translate-x-0.5 transition-transform">
                      <span>Open</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {currentUser && (
        <CreateProjectModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          userId={currentUser.id}
          onProjectCreated={handleProjectCreated}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Delete Project?</h3>
              <p className="text-xs text-slate-400 mt-1">
                Are you sure you want to delete <strong className="text-slate-200">"{projectToDelete.name}"</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setProjectToDelete(null)}
                className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteProject(projectToDelete.id)}
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

