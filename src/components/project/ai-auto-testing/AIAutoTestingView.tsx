import React, { useState } from 'react';
import {
  Cpu,
  FileCheck2,
  Table,
  Monitor,
  FolderTree,
  FileCode,
  History,
  Sparkles,
  Bot
} from 'lucide-react';
import { Project } from '../../../api/types';
import { api } from '../../../api/client';
import { AIModelConfigSection } from './AIModelConfigSection';
import { AIDocumentsSection } from './AIDocumentsSection';
import { AITestCaseReviewSection } from './AITestCaseReviewSection';
import { AIAutomationDevSection } from './AIAutomationDevSection';
import { AIElementsSection } from './AIElementsSection';
import { AIGeneratedScriptsSection } from './AIGeneratedScriptsSection';
import { AIExecutionHistorySection } from './AIExecutionHistorySection';

interface AIAutoTestingViewProps {
  project: Project;
  onNavigateToScriptsView?: () => void;
}

export type AIAutoTestingTab =
  | 'model-config'
  | 'documents'
  | 'test-cases'
  | 'development'
  | 'ai-elements'
  | 'generated-scripts'
  | 'history';

export const AIAutoTestingView: React.FC<AIAutoTestingViewProps> = ({
  project,
  onNavigateToScriptsView
}) => {
  const [activeTab, setActiveTab] = useState<AIAutoTestingTab>('model-config');
  const [selectedTestCaseId, setSelectedTestCaseId] = useState<string | undefined>(undefined);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isLaunchingBrowser, setIsLaunchingBrowser] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const handleStartDevelopment = async (tcId: string, customUrl?: string) => {
    setIsLaunchingBrowser(true);
    setLaunchError(null);
    setSelectedTestCaseId(tcId);
    setActiveTab('development');
    try {
      const res = await api.aiAutoTesting.startDevelopmentSession(tcId, project.id, customUrl);
      if (res.success && res.session) {
        setSelectedSessionId(res.session.id);
      } else {
        setLaunchError(res.error || 'Failed to start development browser session.');
      }
    } catch (e: any) {
      setLaunchError(e.message || 'Error launching browser development session.');
    } finally {
      setIsLaunchingBrowser(false);
    }
  };

  const tabs: Array<{ id: AIAutoTestingTab; label: string; icon: React.ReactNode }> = [
    { id: 'model-config', label: 'AI Model Configuration', icon: <Cpu className="w-4 h-4" /> },
    { id: 'documents', label: 'Application Documents', icon: <FileCheck2 className="w-4 h-4" /> },
    { id: 'test-cases', label: 'Test Case Generation', icon: <Table className="w-4 h-4" /> },
    { id: 'development', label: 'Automation Development', icon: <Monitor className="w-4 h-4" /> },
    { id: 'ai-elements', label: 'AI Elements', icon: <FolderTree className="w-4 h-4" /> },
    { id: 'generated-scripts', label: 'Generated Scripts', icon: <FileCode className="w-4 h-4" /> },
    { id: 'history', label: 'Execution History', icon: <History className="w-4 h-4" /> }
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-fadeIn pb-16">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
              <Sparkles className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                <span>AI Auto Testing</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
                  Local SLM Engine
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Generate, develop, and execute Playwright automation scripts from application documentation using a local Small Language Model.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">
          <span>Project:</span>
          <strong className="text-white">{project.name}</strong>
        </div>
      </div>

      {/* Internal Navigation Tabs (Section 2) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800/80">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div>
        {activeTab === 'model-config' && <AIModelConfigSection />}

        {activeTab === 'documents' && (
          <AIDocumentsSection
            project={project}
            onNavigateToTestCases={tcId => {
              setSelectedTestCaseId(tcId);
              setActiveTab('test-cases');
            }}
            onNavigateToDevelopment={handleStartDevelopment}
          />
        )}

        {activeTab === 'test-cases' && (
          <AITestCaseReviewSection
            project={project}
            initialTestCaseId={selectedTestCaseId}
            onStartDevelopment={handleStartDevelopment}
          />
        )}

        {activeTab === 'development' && (
          <AIAutomationDevSection
            project={project}
            activeSessionId={selectedSessionId}
            activeTestCaseId={selectedTestCaseId}
            isLaunchingBrowser={isLaunchingBrowser}
            launchError={launchError}
            onStartDevelopmentSession={handleStartDevelopment}
            onNavigateToScripts={sessId => {
              setSelectedSessionId(sessId);
              setActiveTab('generated-scripts');
            }}
            onNavigateToElements={() => setActiveTab('ai-elements')}
          />
        )}

        {activeTab === 'ai-elements' && <AIElementsSection project={project} />}

        {activeTab === 'generated-scripts' && (
          <AIGeneratedScriptsSection
            project={project}
            initialSessionId={selectedSessionId || undefined}
            onNavigateToScriptsView={onNavigateToScriptsView}
          />
        )}

        {activeTab === 'history' && <AIExecutionHistorySection project={project} />}
      </div>
    </div>
  );
};
