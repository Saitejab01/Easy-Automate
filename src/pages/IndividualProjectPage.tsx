import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FolderKanban,
  ArrowLeft,
  Globe,
  Monitor,
  Layers,
  Clock,
  Play,
  Bot,
  Sparkles,
  Settings,
  Code2,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Save,
  Plus,
  Terminal,
  Cpu
} from 'lucide-react';
import { api } from '../api/client';
import { Project } from '../api/types';
import { useAuth } from '../context/AuthContext';

export const IndividualProjectPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'test-cases' | 'nlp-engine' | 'settings'>('overview');

  // Edit Settings state
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editBaseUrl, setEditBaseUrl] = useState('');
  const [editEnv, setEditEnv] = useState<'development' | 'staging' | 'production'>('development');
  const [editBrowser, setEditBrowser] = useState<'chromium' | 'firefox' | 'webkit'>('chromium');
  const [settingsSaveMsg, setSettingsSaveMsg] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // NLP Interactive Demo state
  const [nlpInstruction, setNlpInstruction] = useState(
    'Login to the application using valid credentials and verify that the dashboard is displayed.'
  );
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedResult, setTranslatedResult] = useState<any | null>(null);

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

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !currentUser) return;
    setSettingsError(null);
    setSettingsSaveMsg(null);

    const cleanName = editName.trim();
    if (!cleanName || cleanName.length < 3) {
      setSettingsError('Project name must be at least 3 characters long.');
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
        setSettingsSaveMsg('Project settings saved successfully!');
        setTimeout(() => setSettingsSaveMsg(null), 3000);
      } else {
        setSettingsError(res.error || 'Failed to update settings.');
      }
    } catch (err: any) {
      setSettingsError(err.message || 'An error occurred.');
    }
  };

  const handleTranslateNlp = () => {
    setIsTranslating(true);
    setTimeout(() => {
      setTranslatedResult({
        action: 'User Authentication & Assertion',
        targetElements: [
          { name: 'Email Input', selector: "input[type='email']", data: 'user@example.com' },
          { name: 'Password Input', selector: "input[type='password']", data: '••••••••' },
          { name: 'Submit Button', selector: "button:has-text('Login')", action: 'click' },
          { name: 'Dashboard View', selector: "[data-testid='dashboard']", assertion: 'toBeVisible' }
        ],
        generatedCode: `// Auto-generated Playwright TypeScript Script\nimport { test, expect } from '@playwright/test';\n\ntest('${project?.name || 'Automated Flow'} - NLP Test Case', async ({ page }) => {\n  await page.goto('${editBaseUrl || 'https://demo.playwright.dev'}');\n  await page.locator('input[type="email"]').fill('demo@easyautomate.dev');\n  await page.locator('input[type="password"]').fill('P@ssword123');\n  await page.getByRole('button', { name: /login/i }).click();\n  await expect(page.locator('[data-testid="dashboard"]')).toBeVisible({ timeout: 5000 });\n});`
      });
      setIsTranslating(false);
    }, 600);
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
        <p className="text-xs text-slate-400 mt-2">The requested project does not exist or you do not have permission to view it.</p>
        <Link
          to="/projects"
          className="mt-4 px-4 py-2 bg-brand-600 rounded-xl text-xs font-semibold hover:bg-brand-500 transition-colors"
        >
          Back to All Projects
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="border-b border-slate-900 bg-slate-900/40 py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Breadcrumb Navigation */}
          <div className="flex items-center space-x-2 text-xs">
            <Link
              to="/projects"
              className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors py-1 px-2 rounded-lg hover:bg-slate-800"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>All Projects</span>
            </Link>
            <span className="text-slate-600">/</span>
            <span className="font-semibold text-slate-200">{project.name}</span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2.5 py-1 rounded-full uppercase tracking-wider">
              <Layers className="w-3 h-3" />
              {project.environment || 'development'}
            </span>
          </div>
        </div>
      </div>

      {/* Project Header Banner */}
      <div className="border-b border-slate-900 bg-slate-900/20 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-brand-600/20">
                <FolderKanban className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{project.name}</h1>
                <p className="text-xs text-slate-400 mt-0.5">{project.description || 'Dedicated automation workspace for test cases & NLP execution.'}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-2">
              {project.baseUrl && (
                <div className="flex items-center gap-1.5 font-mono text-[11px] bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                  <Globe className="w-3.5 h-3.5 text-brand-400" />
                  <span>{project.baseUrl}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5 text-slate-500" />
                <span className="capitalize">Browser: {project.defaultBrowser || 'chromium'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Created {new Date(project.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('nlp-engine')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-brand-600 hover:bg-brand-500 text-white shadow-md shadow-brand-600/30 transition-all hover:scale-[1.02]"
            >
              <Sparkles className="w-4 h-4" />
              <span>Run NLP Instruction</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto flex space-x-1 mt-8 border-b border-slate-800 text-xs sm:text-sm font-medium">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'border-brand-500 text-brand-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderKanban className="w-4 h-4" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('test-cases')}
            className={`px-4 py-2.5 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'test-cases'
                ? 'border-brand-500 text-brand-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>Test Cases</span>
          </button>

          <button
            onClick={() => setActiveTab('nlp-engine')}
            className={`px-4 py-2.5 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'nlp-engine'
                ? 'border-brand-500 text-brand-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>NLP Automation Engine</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2.5 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'settings'
                ? 'border-brand-500 text-brand-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Project Settings</span>
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Column: Project Status Card */}
              <div className="md:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Project Environment Status
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  This project is configured with a Playwright browser automation harness targeting{' '}
                  <strong className="text-slate-200 font-mono">{project.baseUrl || 'https://demo.playwright.dev'}</strong>.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Engine</span>
                    <p className="text-xs font-semibold text-slate-200 mt-1">Playwright v1.49+</p>
                  </div>
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Test Framework</span>
                    <p className="text-xs font-semibold text-slate-200 mt-1">TypeScript runner</p>
                  </div>
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Queue Dispatch</span>
                    <p className="text-xs font-semibold text-brand-400 mt-1">BullMQ Worker</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Want to test an NLP instruction right away?</span>
                  <button
                    onClick={() => setActiveTab('nlp-engine')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-600/20 text-brand-400 border border-brand-500/30 hover:bg-brand-600/30 transition-colors"
                  >
                    <span>Try NLP Translation</span>
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Right Column: Quick Info */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-base font-bold text-white">Project Metadata</h3>
                <dl className="text-xs space-y-3">
                  <div>
                    <dt className="text-slate-500">Project ID</dt>
                    <dd className="text-slate-300 font-mono mt-0.5">{project.id}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Owner User ID</dt>
                    <dd className="text-slate-300 font-mono mt-0.5">{project.userId}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Target Environment</dt>
                    <dd className="text-slate-300 capitalize mt-0.5">{project.environment}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Default Test Browser</dt>
                    <dd className="text-slate-300 capitalize mt-0.5">{project.defaultBrowser}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Test Cases */}
        {activeTab === 'test-cases' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-white">Test Cases for {project.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Define test scenarios and natural language steps for automated execution.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('nlp-engine')}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Test Case from NLP</span>
                </button>
              </div>

              {/* Mock Test Cases list */}
              <div className="mt-6 space-y-3">
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <h4 className="text-xs font-semibold text-slate-200">User Login & Dashboard Assertion</h4>
                      <span className="text-[10px] bg-slate-900 text-slate-400 border border-slate-800 px-2 py-0.5 rounded-full font-mono">
                        NLP Generated
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      "Login to the application using valid credentials and verify that the dashboard is displayed."
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('nlp-engine')}
                    className="px-3 py-1.5 text-xs text-brand-400 hover:text-brand-300 bg-brand-500/10 hover:bg-brand-500/20 rounded-lg transition-colors"
                  >
                    View Steps
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                      <h4 className="text-xs font-semibold text-slate-200">Cart Checkout & Order Confirmation</h4>
                      <span className="text-[10px] bg-slate-900 text-slate-400 border border-slate-800 px-2 py-0.5 rounded-full font-mono">
                        Draft
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      "Add item to cart, proceed to checkout, enter shipping details, and verify success message."
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('nlp-engine')}
                    className="px-3 py-1.5 text-xs text-brand-400 hover:text-brand-300 bg-brand-500/10 hover:bg-brand-500/20 rounded-lg transition-colors"
                  >
                    View Steps
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: NLP Engine Interactive Preview */}
        {activeTab === 'nlp-engine' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">NLP Engine Playground (Section 3.5)</h3>
                  <p className="text-xs text-slate-400">
                    Converts user-provided natural-language instructions into executable Playwright TypeScript actions
                  </p>
                </div>
              </div>

              {/* Natural Language Instruction Input */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-300">
                  Enter Natural Language Instruction:
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <textarea
                    value={nlpInstruction}
                    onChange={(e) => setNlpInstruction(e.target.value)}
                    rows={2}
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 text-slate-100 text-xs sm:text-sm font-sans placeholder:text-slate-600 transition-colors resize-none"
                    placeholder="e.g. Login to the application using valid credentials and verify that the dashboard is displayed."
                  />
                  <button
                    onClick={handleTranslateNlp}
                    disabled={isTranslating || !nlpInstruction.trim()}
                    className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/30 transition-all hover:scale-[1.02] flex items-center justify-center gap-2 shrink-0 self-start sm:self-auto"
                  >
                    {isTranslating ? (
                      <span>Analyzing instruction...</span>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Translate to Playwright</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Results Display */}
              {translatedResult && (
                <div className="mt-6 pt-6 border-t border-slate-800 space-y-4 animate-fadeIn">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Element Extraction */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                      <span className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5" />
                        NLP Identified Elements & Actions
                      </span>
                      <ul className="text-xs space-y-2">
                        {translatedResult.targetElements.map((el: any, idx: number) => (
                          <li key={idx} className="p-2 rounded bg-slate-900 border border-slate-800/80 flex items-center justify-between">
                            <span className="font-semibold text-slate-200">{el.name}</span>
                            <span className="text-[11px] font-mono text-brand-400">{el.selector}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Generated Playwright TypeScript */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                      <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Code2 className="w-3.5 h-3.5" />
                        Executable Playwright Code
                      </span>
                      <pre className="text-[11px] font-mono text-slate-300 p-3 bg-slate-900 rounded-lg overflow-x-auto border border-slate-800">
                        {translatedResult.generatedCode}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Settings */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl bg-slate-900/80 border border-slate-800 rounded-2xl p-6 animate-fadeIn">
            <h3 className="text-base font-bold text-white mb-1">Project Settings</h3>
            <p className="text-xs text-slate-400 mb-6">Modify project details and test execution preferences</p>

            {settingsSaveMsg && (
              <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{settingsSaveMsg}</span>
              </div>
            )}

            {settingsError && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                <span>{settingsError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Project Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 text-slate-100 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Description</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 text-slate-100 text-xs resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Target Base URL</label>
                <input
                  type="url"
                  value={editBaseUrl}
                  onChange={(e) => setEditBaseUrl(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 text-slate-100 text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Environment</label>
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
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Default Browser</label>
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
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white flex items-center gap-2 shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
