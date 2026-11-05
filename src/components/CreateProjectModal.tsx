import React, { useState } from 'react';
import { X, FolderPlus, Globe, Layers, AlertCircle, CheckCircle2, Monitor } from 'lucide-react';
import { api } from '../api/client';
import { Project } from '../api/types';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onProjectCreated: (project: Project) => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  userId,
  onProjectCreated
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://demo.playwright.dev');
  const [environment, setEnvironment] = useState<'development' | 'staging' | 'production'>('development');
  const [defaultBrowser, setDefaultBrowser] = useState<'chromium' | 'firefox' | 'webkit'>('chromium');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // Real-time validation
  const validate = (): string | null => {
    const trimmed = name.trim();
    if (!trimmed) {
      return 'Project name is required.';
    }
    if (trimmed.length < 3) {
      return 'Project name must be at least 3 characters long.';
    }
    if (trimmed.length > 50) {
      return 'Project name cannot exceed 50 characters.';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const res = await api.projects.create(userId, {
        name,
        description,
        baseUrl,
        environment,
        defaultBrowser
      });

      if (res.success && res.project) {
        onProjectCreated(res.project);
        onClose();
        // Reset form
        setName('');
        setDescription('');
        setBaseUrl('https://demo.playwright.dev');
      } else {
        setError(res.error || 'Failed to create project.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">Create New Project</h3>
              <p className="text-xs text-slate-400">Configure your automated test suite environment</p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Project Name (Required with validation) */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Project Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Payments Gateway E2E Tests"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-100 text-sm placeholder:text-slate-600 transition-colors"
              autoFocus
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Minimum 3 characters, max 50 characters. Must be unique within your projects.
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Description <span className="text-slate-500 font-normal">(Optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What application flows will this test suite automate?"
              rows={2}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700/80 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-100 text-xs placeholder:text-slate-600 transition-colors resize-none"
            />
          </div>

          {/* Base URL */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              Target Base URL
            </label>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700/80 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 text-slate-100 text-xs font-mono placeholder:text-slate-600 transition-colors"
            />
          </div>

          {/* Environment & Browser Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                Environment
              </label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700/80 focus:border-brand-500 text-slate-200 text-xs"
              >
                <option value="development">Development</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5 text-slate-400" />
                Default Browser
              </label>
              <select
                value={defaultBrowser}
                onChange={(e) => setDefaultBrowser(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700/80 focus:border-brand-500 text-slate-200 text-xs"
              >
                <option value="chromium">Chromium (Chrome)</option>
                <option value="firefox">Firefox</option>
                <option value="webkit">WebKit (Safari)</option>
              </select>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-md shadow-brand-600/30 transition-all hover:scale-[1.02] flex items-center gap-2"
            >
              {isSubmitting ? (
                <span>Creating...</span>
              ) : (
                <>
                  <FolderPlus className="w-4 h-4" />
                  <span>Create Project</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
