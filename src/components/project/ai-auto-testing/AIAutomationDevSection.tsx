import React, { useState, useEffect } from 'react';
import {
  Monitor,
  Play,
  Pause,
  Square,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Code2,
  FolderTree,
  ExternalLink,
  RefreshCw,
  Camera,
  Layers,
  Sparkles,
  ChevronRight,
  Plus,
  FileCode,
  Edit3,
  X,
  Crosshair
} from 'lucide-react';
import { api } from '../../../api/client';
import {
  Project,
  AIAutomationSession,
  AIAutomationStage,
  AIManualTestCase,
  AIAutomationStepDetail
} from '../../../api/types';
import { ElementIdentificationInspectorModal } from './ElementIdentificationInspectorModal';

interface AIAutomationDevSectionProps {
  project: Project;
  activeSessionId?: string | null;
  activeTestCaseId?: string | null;
  isLaunchingBrowser?: boolean;
  launchError?: string | null;
  onStartDevelopmentSession?: (testCaseId: string, customUrl?: string) => Promise<void>;
  onNavigateToScripts: (sessionId: string) => void;
  onNavigateToElements: () => void;
}

export const AIAutomationDevSection: React.FC<AIAutomationDevSectionProps> = ({
  project,
  activeSessionId,
  activeTestCaseId,
  isLaunchingBrowser = false,
  launchError = null,
  onStartDevelopmentSession,
  onNavigateToScripts,
  onNavigateToElements
}) => {
  const [sessions, setSessions] = useState<AIAutomationSession[]>([]);
  const [currentSession, setCurrentSession] = useState<AIAutomationSession | null>(null);
  const [testCases, setTestCases] = useState<AIManualTestCase[]>([]);
  const [selectedTcId, setSelectedTcId] = useState<string>(activeTestCaseId || '');
  const [targetUrlInput, setTargetUrlInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [screenshotModal, setScreenshotModal] = useState<string | null>(null);
  const [inspectingStep, setInspectingStep] = useState<AIAutomationStepDetail | null>(null);
  const [inspectingFingerprint, setInspectingFingerprint] = useState<any | null>(null);

  useEffect(() => {
    loadSessions();
    loadTestCases();

    // Subscribe to live Electron events for real-time telemetry (Section 7.6)
    const cleanup = api.aiAutoTesting.onSessionUpdate((updatedSession: AIAutomationSession) => {
      if (updatedSession.projectId === project.id) {
        setCurrentSession(prev => (prev?.id === updatedSession.id ? updatedSession : prev));
        setSessions(prev => {
          const exists = prev.some(s => s.id === updatedSession.id);
          if (exists) {
            return prev.map(s => (s.id === updatedSession.id ? updatedSession : s));
          }
          return [updatedSession, ...prev];
        });
      }
    });

    return () => {
      cleanup();
    };
  }, [project.id]);

  useEffect(() => {
    if (activeSessionId && sessions.length > 0) {
      const target = sessions.find(s => s.id === activeSessionId);
      if (target) {
        setCurrentSession(target);
        setCustomUrl(target.applicationUrl);
      }
    }
  }, [activeSessionId, sessions]);

  useEffect(() => {
    if (activeTestCaseId) {
      setSelectedTcId(activeTestCaseId);
      const tc = testCases.find(t => t.id === activeTestCaseId);
      if (tc) {
        let detected = '';
        for (const s of tc.steps) {
          const m = (s.input + ' ' + s.stepDescription).match(/https?:\/\/[^\s]+/i);
          if (m) {
            detected = m[0];
            break;
          }
        }
        setTargetUrlInput(detected || project.baseUrl || 'https://demo.easyautomate.dev');
      }
    }
  }, [activeTestCaseId, testCases, project.baseUrl]);

  const loadTestCases = async () => {
    try {
      const res = await api.aiAutoTesting.getTestCases(project.id);
      if (res.success && res.testCases) {
        setTestCases(res.testCases);
        if (res.testCases.length > 0) {
          const initialTc = activeTestCaseId
            ? res.testCases.find((tc: AIManualTestCase) => tc.id === activeTestCaseId) || res.testCases[0]
            : res.testCases[0];
          setSelectedTcId(initialTc.id);
          let detected = '';
          for (const s of initialTc.steps) {
            const m = (s.input + ' ' + s.stepDescription).match(/https?:\/\/[^\s]+/i);
            if (m) {
              detected = m[0];
              break;
            }
          }
          setTargetUrlInput(detected || project.baseUrl || 'https://demo.easyautomate.dev');
        }
      }
    } catch (e: any) {
      console.error('Failed to load test cases in dev section:', e);
    }
  };

  const handleSelectTestCase = (tcId: string) => {
    setSelectedTcId(tcId);
    const tc = testCases.find(t => t.id === tcId);
    if (tc) {
      let detected = '';
      for (const s of tc.steps) {
        const m = (s.input + ' ' + s.stepDescription).match(/https?:\/\/[^\s]+/i);
        if (m) {
          detected = m[0];
          break;
        }
      }
      setTargetUrlInput(detected || project.baseUrl || 'https://demo.easyautomate.dev');
    }
  };

  const handleLaunchSession = async () => {
    if (!selectedTcId) return;
    setIsActionLoading(true);
    try {
      if (onStartDevelopmentSession) {
        await onStartDevelopmentSession(selectedTcId, targetUrlInput || undefined);
      } else {
        const res = await api.aiAutoTesting.startDevelopmentSession(
          selectedTcId,
          project.id,
          targetUrlInput || undefined
        );
        if (res.success && res.session) {
          setCurrentSession(res.session);
          setCustomUrl(res.session.applicationUrl);
        }
      }
      await loadSessions();
    } catch (e: any) {
      console.error('Failed to launch browser development session:', e);
    } finally {
      setIsActionLoading(false);
    }
  };

  const loadSessions = async () => {
    setIsLoading(true);
    try {
      const res = await api.aiAutoTesting.getSessions(project.id);
      if (res.success && res.sessions) {
        setSessions(res.sessions);
        if (res.sessions.length > 0 && !currentSession) {
          const first = activeSessionId
            ? res.sessions.find((s: AIAutomationSession) => s.id === activeSessionId) || res.sessions[0]
            : res.sessions[0];
          setCurrentSession(first);
          setCustomUrl(first.applicationUrl || project.baseUrl || '');
        }
      }
    } catch (e: any) {
      console.error('Failed to load automation sessions:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePause = async () => {
    setIsActionLoading(true);
    try {
      await api.aiAutoTesting.pauseSession();
      if (currentSession) {
        setCurrentSession({ ...currentSession, status: 'paused' });
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleResume = async () => {
    setIsActionLoading(true);
    try {
      await api.aiAutoTesting.resumeSession();
      if (currentSession) {
        setCurrentSession({ ...currentSession, status: 'developing' });
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleStop = async () => {
    if (!confirm('Are you sure you want to stop this browser development session?')) return;
    setIsActionLoading(true);
    try {
      await api.aiAutoTesting.stopSession();
      if (currentSession) {
        setCurrentSession({ ...currentSession, status: 'failed' });
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRetryStep = async (stepNum: number) => {
    if (!currentSession) return;
    setIsActionLoading(true);
    try {
      await api.aiAutoTesting.retryStep(currentSession.id, project.id, stepNum);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRunAgain = async () => {
    if (!currentSession) return;
    try {
      const res = await api.aiAutoTesting.startDevelopmentSession(
        currentSession.testCaseId,
        project.id,
        customUrl || currentSession.applicationUrl
      );
      if (res.success && res.session) {
        setCurrentSession(res.session);
        await loadSessions();
      }
    } catch (e: any) {
      console.error('Failed to re-run session:', e);
    }
  };

  const stages: AIAutomationStage[] = [
    'Test Cases Accepted',
    'Browser Initialized',
    'Application Opened',
    'Elements Identified',
    'Locators Validated',
    'Execution Completed',
    'Script Ready for Review'
  ];

  const getStageIndex = (stage: AIAutomationStage) => {
    const idx = stages.indexOf(stage);
    return idx !== -1 ? idx : 2;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-brand-400" />
            <h2 className="text-base font-bold text-white">Browser Automation Development Engine</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Live browser automation session driven by Playwright. The local SLM interprets manual test steps, discovers real DOM elements, generates robust locators, maps existing NLPs, and executes actions in the open browser.
          </p>
        </div>

        {currentSession && (
          <div className="flex items-center gap-2 shrink-0">
            {currentSession.status === 'paused' ? (
              <button
                onClick={handleResume}
                disabled={isActionLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Resume</span>
              </button>
            ) : currentSession.status === 'developing' || currentSession.status === 'executing' || currentSession.status === 'initializing_browser' ? (
              <button
                onClick={handlePause}
                disabled={isActionLoading}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Pause className="w-3.5 h-3.5 fill-white" />
                <span>Pause</span>
              </button>
            ) : null}

            {['developing', 'executing', 'initializing_browser', 'navigating', 'paused'].includes(currentSession.status) && (
              <button
                onClick={handleStop}
                disabled={isActionLoading}
                className="px-3.5 py-2 bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Square className="w-3 h-3 fill-rose-200" />
                <span>Stop</span>
              </button>
            )}

            {currentSession.status === 'completed' && (
              <button
                onClick={() => onNavigateToScripts(currentSession.id)}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors"
              >
                <span>Review & Push to TestDev</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {['completed', 'failed'].includes(currentSession.status) && (
              <button
                onClick={handleRunAgain}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Run Again</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Layout: Sessions Sidebar (4 cols) & Live Runner (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Sessions List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Development Sessions ({sessions.length})
            </h3>
            {testCases.length > 0 && (
              <button
                type="button"
                onClick={() => setCurrentSession(null)}
                className="text-[11px] font-semibold text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors"
                title="Start a new browser automation development session"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Session</span>
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-slate-500 text-xs">Loading sessions...</div>
          ) : sessions.length === 0 ? (
            <div className="p-6 text-center bg-slate-900/60 rounded-2xl border border-slate-800 space-y-2">
              <p className="text-slate-400 text-xs">
                No active development sessions yet.
              </p>
              <p className="text-[11px] text-slate-500">
                Configure target parameters and click Launch to start the live browser.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map(s => {
                const isSelected = currentSession?.id === s.id;
                const passedCount = s.steps.filter(st => st.status === 'Passed').length;

                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      setCurrentSession(s);
                      setCustomUrl(s.applicationUrl);
                    }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2.5 ${
                      isSelected
                        ? 'bg-brand-950/40 border-brand-500/50 shadow-md shadow-brand-500/10'
                        : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-white truncate max-w-[200px]" title={s.testCaseName}>
                        {s.testCaseName}
                      </h4>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                          s.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : s.status === 'failed'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>Progress: {s.progressPercent}%</span>
                        <span>{passedCount}/{s.steps.length} Steps</span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            s.status === 'failed' ? 'bg-rose-500' : 'bg-brand-500'
                          }`}
                          style={{ width: `${s.progressPercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px] text-slate-500 font-mono">
                      <span className="truncate max-w-[180px]">{s.applicationUrl}</span>
                      <span>{new Date(s.createdAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Live Runner & Steps Progress */}
        <div className="lg:col-span-8 space-y-4">
          {currentSession ? (
            <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 space-y-6">
              {/* Header Info */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">{currentSession.testCaseName}</h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                      Browser: {currentSession.browserType}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 font-mono flex items-center gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                    <span>Target URL: {currentSession.applicationUrl}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {onNavigateToScripts && (
                    <button
                      onClick={() => onNavigateToScripts(currentSession.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-950/60 hover:bg-brand-900 border border-brand-800 text-brand-300 flex items-center gap-1.5 transition-colors"
                      title="Open and edit generated script steps"
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      <span>Open Generated Script</span>
                    </button>
                  )}

                  <button
                    onClick={onNavigateToElements}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-950/60 hover:bg-purple-900 border border-purple-800 text-purple-300 flex items-center gap-1.5 transition-colors"
                  >
                    <FolderTree className="w-3.5 h-3.5" />
                    <span>View AI Elements</span>
                  </button>
                </div>
              </div>

              {/* Completion Banner */}
              {currentSession.status === 'completed' && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fadeIn">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-white">Automation Script Developed Successfully!</h4>
                      <p className="text-[11px] text-emerald-300/80">
                        All {currentSession.steps.length} steps executed and validated. You can now inspect or edit steps, or promote the script to TestDev.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {onNavigateToScripts && (
                      <button
                        onClick={() => onNavigateToScripts(currentSession.id)}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white flex items-center gap-1.5 shadow-sm transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Review & Edit Steps</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Development Stage Tracker (Section 15) */}
              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300">Stage: {currentSession.stage}</span>
                  <span className="font-mono text-brand-400 font-bold">{currentSession.progressPercent}%</span>
                </div>

                <div className="flex items-center justify-between overflow-x-auto gap-2 py-1 select-none text-[10px] text-slate-400">
                  {stages.map((stg, sIdx) => {
                    const currentIdx = getStageIndex(currentSession.stage);
                    const isPassed = sIdx <= currentIdx;
                    const isCurrent = sIdx === currentIdx;

                    return (
                      <div key={stg} className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[9px] ${
                            isCurrent
                              ? 'bg-brand-500 text-white animate-pulse'
                              : isPassed
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          {isPassed && !isCurrent ? '✓' : sIdx + 1}
                        </span>
                        <span className={isCurrent ? 'text-white font-bold' : isPassed ? 'text-slate-300' : 'text-slate-600'}>
                          {stg}
                        </span>
                        {sIdx < stages.length - 1 && <ChevronRight className="w-3 h-3 text-slate-700 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Failure Banner if any */}
              {currentSession.failureDetails && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-2 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span className="text-xs font-bold">
                        Failed at Step #{currentSession.failureDetails.stepNumber}
                      </span>
                    </div>
                    {currentSession.failureDetails.screenshot && (
                      <button
                        onClick={() => setScreenshotModal(currentSession.failureDetails!.screenshot!)}
                        className="px-2.5 py-1 bg-rose-950 border border-rose-800 rounded-lg text-[11px] font-semibold text-rose-200 flex items-center gap-1"
                      >
                        <Camera className="w-3 h-3" />
                        <span>View Screenshot</span>
                      </button>
                    )}
                  </div>
                  <p className="text-xs font-mono text-rose-200 pl-6 leading-relaxed">
                    {currentSession.failureDetails.error}
                  </p>
                </div>
              )}

              {/* Steps Execution & Telemetry List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Automated Steps ({currentSession.steps.length})
                </h4>

                <div className="space-y-2">
                  {currentSession.steps.map(step => {
                    const isFailed = step.status === 'Failed';
                    const isPassed = step.status === 'Passed';
                    const isRunning = step.status === 'Executing' || step.status === 'Identifying Element';

                    return (
                      <div
                        key={step.stepNumber}
                        className={`p-4 rounded-xl border transition-all space-y-2 ${
                          isFailed
                            ? 'bg-rose-950/20 border-rose-500/40'
                            : isPassed
                            ? 'bg-slate-900/60 border-slate-800'
                            : isRunning
                            ? 'bg-brand-950/30 border-brand-500/40'
                            : 'bg-slate-950/40 border-slate-800/60 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center font-mono text-xs font-bold text-slate-300">
                              {step.stepNumber}
                            </span>
                            <span className="text-xs font-semibold text-white">
                              {step.manualStepDescription}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {isRunning && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-brand-500/20 text-brand-300 border border-brand-500/30">
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                {step.status}
                              </span>
                            )}
                            {isPassed && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                Passed ({step.durationMs}ms)
                              </span>
                            )}
                            {isFailed && (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                  <AlertCircle className="w-3 h-3 text-rose-400" />
                                  Failed
                                </span>
                                <button
                                  onClick={() => handleRetryStep(step.stepNumber)}
                                  disabled={isActionLoading}
                                  className="px-2.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold rounded flex items-center gap-1"
                                >
                                  <RotateCcw className="w-2.5 h-2.5" />
                                  Retry
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Mapped NLP & Discovered Element Pills */}
                        <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono pt-1 text-slate-400">
                          {step.nlpName && (
                            <span className="flex items-center gap-1 text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded">
                              <Code2 className="w-3 h-3" />
                              NLP: {step.nlpName}
                            </span>
                          )}

                          {step.elementName && (
                            <span className="flex items-center gap-1 text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded">
                              <FolderTree className="w-3 h-3" />
                              Element: {step.elementName}
                            </span>
                          )}

                          {step.locatorType && step.locatorValue && (
                            <span className="truncate max-w-sm text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
                              [{step.locatorType}: {step.locatorValue}]
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={async () => {
                              setInspectingStep(step);
                              if (step.elementId) {
                                const res = await api.aiAutoTesting.getFingerprint(step.elementId);
                                if (res.success && res.fingerprint) {
                                  setInspectingFingerprint(res.fingerprint);
                                } else {
                                  setInspectingFingerprint(null);
                                }
                              } else {
                                setInspectingFingerprint(null);
                              }
                            }}
                            className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-2 py-0.5 rounded transition-colors"
                            title="Inspect Hybrid AI Element Identification, Coordinates & Fingerprint"
                          >
                            <Crosshair className="w-2.5 h-2.5 text-emerald-400" />
                            <span>Inspect Identification</span>
                          </button>
                        </div>

                        {/* Error details */}
                        {step.error && (
                          <div className="p-2 bg-rose-950/40 rounded border border-rose-900/60 text-[11px] font-mono text-rose-300">
                            {step.error}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-8 space-y-6 animate-fadeIn">
              {/* Active Loading State if browser is launching */}
              {(isLaunchingBrowser || isActionLoading) ? (
                <div className="py-12 text-center space-y-4">
                  <div className="relative w-16 h-16 mx-auto">
                    <div className="absolute inset-0 rounded-full border-2 border-brand-500/20 animate-ping" />
                    <div className="w-16 h-16 rounded-full bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400">
                      <RefreshCw className="w-7 h-7 animate-spin" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Launching Playwright Browser Engine...</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                      Initializing browser window, configuring viewport, connecting to application URL, and executing live test steps.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 shrink-0">
                      <Monitor className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Launch Browser Automation Session</h3>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Select an accepted manual test case and start a real Playwright session. Easy Automate opens the browser on your machine, navigates to the application, inspects live DOM elements, maps predefined NLPs, and executes actions.
                      </p>
                    </div>
                  </div>

                  {launchError && (
                    <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{launchError}</span>
                    </div>
                  )}

                  {testCases.length === 0 ? (
                    <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800 text-center space-y-2">
                      <p className="text-xs text-slate-400 font-medium">No test cases available to develop yet.</p>
                      <p className="text-[11px] text-slate-500">
                        Upload application documents in <strong>Application Documents</strong> or generate/create test cases in <strong>Test Case Generation</strong> first.
                      </p>
                    </div>
                  ) : (
                    <div className="p-6 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-5">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                          <span>Target Test Case</span>
                          <span className="text-[10px] text-brand-400 font-mono">
                            {testCases.find(t => t.id === selectedTcId)?.steps.length || 0} step(s)
                          </span>
                        </label>
                        <select
                          value={selectedTcId}
                          onChange={e => handleSelectTestCase(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-medium focus:border-brand-500 outline-none"
                        >
                          {testCases.map(tc => (
                            <option key={tc.id} value={tc.id}>
                              {tc.name} ({tc.steps.length} steps) - {tc.status}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300">
                          Application Starting URL
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={targetUrlInput}
                            onChange={e => setTargetUrlInput(e.target.value)}
                            placeholder="https://example.com"
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono focus:border-brand-500 outline-none"
                          />
                          <ExternalLink className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                        </div>
                        <p className="text-[11px] text-slate-500">
                          The browser will automatically open and navigate to this URL to begin identifying elements.
                        </p>
                      </div>

                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={handleLaunchSession}
                          disabled={!selectedTcId || isActionLoading || isLaunchingBrowser}
                          className="w-full sm:w-auto px-6 py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-600/30 transition-all hover:scale-[1.01]"
                        >
                          <Play className="w-4 h-4 fill-white" />
                          <span>Launch Playwright Browser & Develop</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Screenshot Modal */}
      {screenshotModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="text-xs font-bold text-white flex items-center gap-2">
                <Camera className="w-4 h-4 text-brand-400" />
                Failure Screenshot Capture
              </h4>
              <button
                onClick={() => setScreenshotModal(null)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-white rounded-lg"
              >
                Close
              </button>
            </div>
            <div className="overflow-auto max-h-[75vh] flex justify-center bg-slate-950 rounded-xl p-2 border border-slate-800">
              <img src={screenshotModal} alt="Step failure screenshot" className="rounded max-w-full h-auto" />
            </div>
          </div>
        </div>
      )}
      {/* Element Identification Inspector Modal (Section 12) */}
      {inspectingStep && (
        <ElementIdentificationInspectorModal
          step={inspectingStep}
          currentPageUrl={currentSession?.applicationUrl}
          fingerprint={inspectingFingerprint}
          onClose={() => {
            setInspectingStep(null);
            setInspectingFingerprint(null);
          }}
        />
      )}
    </div>
  );
};
