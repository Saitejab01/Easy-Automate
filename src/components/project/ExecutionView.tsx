import React, { useState, useEffect } from 'react';
import {
  PlayCircle,
  CheckCircle2,
  AlertCircle,
  Clock,
  Monitor,
  ChevronRight,
  ChevronDown,
  Layers,
  FileCode,
  Search,
  ExternalLink,
  Shield,
  Eye,
  Camera,
  Video,
  X,
  Terminal,
  MousePointer,
  DollarSign,
  FileSpreadsheet,
  Cpu,
  RefreshCw,
  HardDrive,
  Code,
  Copy
} from 'lucide-react';
import { api } from '../../api/client';
import {
  Project,
  DetailedExecutionRecord,
  ScriptExecutionDetail,
  StepExecutionDetail
} from '../../api/types';

interface ExecutionViewProps {
  project: Project;
  selectedExecutionId?: string | null;
}

export const ExecutionView: React.FC<ExecutionViewProps> = ({ project, selectedExecutionId }) => {
  const [executions, setExecutions] = useState<DetailedExecutionRecord[]>([]);
  const [activeExecId, setActiveExecId] = useState<string | null>(selectedExecutionId || null);
  const [expandedExecIds, setExpandedExecIds] = useState<Set<string>>(new Set());

  // Active script detail inside selected execution
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);

  // Active step modal (Section 10.1)
  const [selectedStepDetail, setSelectedStepDetail] = useState<StepExecutionDetail | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [isLoading, setIsLoading] = useState(true);

  // Video playback simulation state
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);

  // Playwright TS Code modal
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    loadExecutions();
  }, [project.id]);

  useEffect(() => {
    if (selectedExecutionId) {
      setActiveExecId(selectedExecutionId);
      setExpandedExecIds(prev => new Set([...prev, selectedExecutionId]));
    }
  }, [selectedExecutionId]);

  const loadExecutions = async () => {
    setIsLoading(true);
    try {
      const res = await api.execution.getExecutions(project.id);
      if (res.success && res.executions) {
        setExecutions(res.executions);
        if (res.executions.length > 0) {
          const firstId = selectedExecutionId || res.executions[0].id;
          setActiveExecId(firstId);
          setExpandedExecIds(new Set([firstId]));

          const firstExec = res.executions.find((e: DetailedExecutionRecord) => e.id === firstId) || res.executions[0];
          if (firstExec.scripts && firstExec.scripts.length > 0) {
            setSelectedScriptId(firstExec.scripts[0].scriptId);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load execution logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleExpandExec = (execId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedExecIds(prev => {
      const next = new Set(prev);
      if (next.has(execId)) next.delete(execId);
      else next.add(execId);
      return next;
    });
  };

  const activeExecution = executions.find(e => e.id === activeExecId) || executions[0];
  const activeScript = activeExecution?.scripts?.find(s => s.scriptId === selectedScriptId) || activeExecution?.scripts?.[0];

  const filteredExecutions = executions.filter(e => {
    const matchesSearch =
      e.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.suiteName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.scripts.some(s => s.scriptName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'All' || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex h-full bg-slate-950 text-slate-100 overflow-hidden relative">
      {/* 1. Left Sidebar: Execution List & Expandable Tree (Section 9.1 & 9.2) */}
      <aside className="w-80 bg-slate-900/90 border-r border-slate-800 flex flex-col shrink-0 select-none">
        {/* Header */}
        <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PlayCircle className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-white tracking-wide uppercase">Executions History</span>
          </div>
          <button
            type="button"
            onClick={loadExecutions}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all"
            title="Refresh Executions"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Filter bar */}
        <div className="p-2.5 border-b border-slate-800 space-y-2 bg-slate-950/60">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Filter by ID (EXEC0001)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:border-brand-500"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {['All', 'Passed', 'Failed', 'Running'].map(st => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all ${
                  statusFilter === st
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Executions List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {filteredExecutions.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              No executions found.
            </div>
          ) : (
            filteredExecutions.map(exec => {
              const isSelected = activeExecId === exec.id;
              const isExpanded = expandedExecIds.has(exec.id);

              return (
                <div key={exec.id} className="space-y-1">
                  {/* Execution Header Card */}
                  <div
                    onClick={() => {
                      setActiveExecId(exec.id);
                      if (exec.scripts.length > 0) {
                        setSelectedScriptId(exec.scripts[0].scriptId);
                      }
                    }}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-slate-800/90 border-brand-500/50 shadow-md'
                        : 'bg-slate-950/70 border-slate-800/80 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => handleToggleExpandExec(exec.id, e)}
                          className="p-0.5 text-slate-400 hover:text-white"
                        >
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                        <span className="font-mono text-xs font-bold text-white tracking-wide">
                          {exec.id}
                        </span>
                      </div>

                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          exec.status === 'Passed'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : exec.status === 'Failed'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
                        }`}
                      >
                        {exec.status}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 truncate mt-1">
                      {exec.suiteName || `Single Execution (${exec.totalScripts} scripts)`}
                    </p>

                    <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span>{new Date(exec.startedAt).toLocaleTimeString()}</span>
                      <span>{exec.durationSeconds}s</span>
                      <span className="text-emerald-400">{exec.passedScripts}P</span>
                      {exec.failedScripts > 0 && <span className="text-rose-400">{exec.failedScripts}F</span>}
                    </div>
                  </div>

                  {/* 9.2 Expandable Scripts Tree inside Execution */}
                  {isExpanded && (
                    <div className="pl-4 ml-3 border-l border-slate-800 space-y-1 py-0.5">
                      {exec.scripts.map(scr => {
                        const isScrActive = isSelected && selectedScriptId === scr.scriptId;

                        return (
                          <div
                            key={scr.scriptId}
                            onClick={() => {
                              setActiveExecId(exec.id);
                              setSelectedScriptId(scr.scriptId);
                            }}
                            className={`p-2 rounded-xl text-xs cursor-pointer flex items-center justify-between transition-all ${
                              isScrActive
                                ? 'bg-brand-600/30 border border-brand-500/30 text-white font-medium'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <FileCode className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                              <span className="truncate">{scr.scriptName}</span>
                            </div>
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                scr.status === 'Passed' ? 'bg-emerald-400' : 'bg-rose-400'
                              }`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* 2. Middle & Right: Execution Details & Step Table (Section 10) */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-950">
        {activeExecution ? (
          <>
            {/* Execution Overview Header */}
            <div className="px-8 py-5 border-b border-slate-800 bg-slate-900/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono font-bold text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2.5 py-0.5 rounded-full">
                    {activeExecution.id}
                  </span>
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                      activeExecution.status === 'Passed'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    }`}
                  >
                    {activeExecution.status.toUpperCase()}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    {new Date(activeExecution.startedAt).toLocaleString()}
                  </span>
                </div>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  {activeExecution.suiteName || activeScript?.scriptName || 'Execution Telemetry'}
                </h1>
              </div>

              {/* Stat Chips */}
              <div className="flex items-center gap-3">
                <div className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Duration</span>
                  <span className="text-xs font-mono font-bold text-white">{activeExecution.durationSeconds}s</span>
                </div>
                <div className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Total Scripts</span>
                  <span className="text-xs font-mono font-bold text-white">{activeExecution.totalScripts}</span>
                </div>
                <div className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-center">
                  <span className="text-[10px] text-emerald-500 uppercase font-semibold block">Passed</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">{activeExecution.passedScripts}</span>
                </div>
                {activeExecution.failedScripts > 0 && (
                  <div className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-center">
                    <span className="text-[10px] text-rose-500 uppercase font-semibold block">Failed</span>
                    <span className="text-xs font-mono font-bold text-rose-400">{activeExecution.failedScripts}</span>
                  </div>
                )}
                {activeScript?.generatedPlaywrightCode && (
                  <button
                    type="button"
                    onClick={() => setIsCodeModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
                  >
                    <Code className="w-4 h-4" />
                    <span>Playwright TS</span>
                  </button>
                )}
              </div>
            </div>

            {/* Content Body: Tabs, Script Execution Table, and Failure Details */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              {/* Active Script Details */}
              {activeScript && (
                <div className="space-y-4">
                  {/* Failure Details Card (Section 10.2) */}
                  {activeScript.status === 'Failed' && activeScript.failureDetails && (
                    <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 space-y-3 shadow-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                          <h3 className="text-sm font-bold text-rose-200">
                            Failure Diagnostic: Step {activeScript.failureDetails.failedStepNumber}
                          </h3>
                        </div>
                        <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-rose-950/80 border border-rose-800 text-rose-300">
                          {activeScript.failureDetails.exceptionName}
                        </span>
                      </div>

                      <p className="text-xs leading-relaxed text-rose-300 font-mono bg-rose-950/40 p-3 rounded-xl border border-rose-900/50">
                        {activeScript.failureDetails.errorMessage}
                      </p>

                      {activeScript.failureDetails.failedLocator && (
                        <div className="text-xs text-rose-400 font-mono flex items-center gap-1.5">
                          <span>Target Locator:</span>
                          <code className="bg-slate-950 px-2 py-0.5 rounded text-white border border-rose-900/60">
                            {activeScript.failureDetails.failedLocator}
                          </code>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 10. Script-Level Execution Table (Section 10) */}
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                    <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileCode className="w-4 h-4 text-brand-400" />
                        <h3 className="text-sm font-bold text-white">
                          {activeScript.scriptName} — Execution Steps
                        </h3>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">
                        Module: {activeScript.moduleName}
                      </span>
                    </div>

                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold text-[11px]">
                        <tr>
                          <th className="py-3 px-6 w-20">Step No.</th>
                          <th className="py-3 px-6">Step Name</th>
                          <th className="py-3 px-6 w-32">Duration</th>
                          <th className="py-3 px-6 w-32">Status</th>
                          <th className="py-3 px-6 w-24 text-right">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {activeScript.steps.map(step => (
                          <tr
                            key={step.stepNumber}
                            onClick={() => setSelectedStepDetail(step)}
                            className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                          >
                            <td className="py-3.5 px-6 font-mono text-slate-400 font-semibold">
                              {step.stepNumber}
                            </td>
                            <td className="py-3.5 px-6">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white group-hover:text-brand-300 transition-colors">
                                  {step.nlpName}
                                </span>
                                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                                  ({step.nlpCategory})
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-lg">
                                {step.description}
                              </p>
                            </td>
                            <td className="py-3.5 px-6 font-mono text-slate-300">
                              {step.durationSeconds} sec
                            </td>
                            <td className="py-3.5 px-6">
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                  step.status === 'Passed'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                }`}
                              >
                                {step.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-6 text-right">
                              <span className="text-xs text-brand-400 group-hover:text-brand-300 flex items-center justify-end gap-1 font-medium">
                                View <ChevronRight className="w-3.5 h-3.5" />
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 11. Machine and Environment Details (Section 11) */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-brand-400" />
                  Executed Machine & Environment Details
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Machine Name</span>
                    <p className="text-white font-mono font-bold mt-1 truncate">{activeExecution.machine.name}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Operating System</span>
                    <p className="text-white font-mono font-bold mt-1 truncate">{activeExecution.machine.os}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Browser & Version</span>
                    <p className="text-brand-300 font-mono font-bold mt-1 truncate">
                      {activeExecution.machine.browser} v{activeExecution.machine.version}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Playwright / Node</span>
                    <p className="text-white font-mono font-bold mt-1 truncate">
                      Playwright {activeExecution.playwrightVersion} ({activeExecution.nodeVersion})
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <PlayCircle className="w-12 h-12 text-slate-700 mb-3" />
            <h3 className="text-sm font-semibold text-white">No Execution Records Yet</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Run automation scripts in TestDev to monitor step traces, screenshots, and logs here.
            </p>
          </div>
        )}
      </main>

      {/* 3. Individual Step Execution Details Modal (Section 10.1) */}
      {selectedStepDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-xl bg-slate-800 border border-slate-700 text-brand-300 font-mono text-xs font-bold flex items-center justify-center">
                  {selectedStepDetail.stepNumber}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">
                      {selectedStepDetail.nlpName}
                    </h3>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        selectedStepDetail.status === 'Passed'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {selectedStepDetail.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{selectedStepDetail.description}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedStepDetail(null)}
                className="p-1.5 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              {/* Step Meta Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Start Time</span>
                  <p className="text-slate-200 font-mono mt-1">
                    {new Date(selectedStepDetail.startedAt).toLocaleTimeString()}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">End Time</span>
                  <p className="text-slate-200 font-mono mt-1">
                    {new Date(selectedStepDetail.completedAt).toLocaleTimeString()}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Duration</span>
                  <p className="text-brand-300 font-mono font-bold mt-1">
                    {selectedStepDetail.durationSeconds} sec
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Category</span>
                  <p className="text-slate-200 font-semibold mt-1">
                    {selectedStepDetail.nlpCategory}
                  </p>
                </div>
              </div>

              {/* Repository Element Details (Section 10.1) */}
              {selectedStepDetail.element && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                    <MousePointer className="w-3.5 h-3.5" />
                    Mapped Repository Element Details
                  </span>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <span className="text-[10px] text-slate-500">Element Name</span>
                      <p className="text-white font-semibold">{selectedStepDetail.element.name}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500">Page / Subpage</span>
                      <p className="text-slate-300">{selectedStepDetail.element.page}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500">Selected Locator ({selectedStepDetail.element.locatorType})</span>
                      <p className="text-brand-300 font-mono truncate">{selectedStepDetail.element.locatorValue}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Variables Used Details (Section 10.1) */}
              {selectedStepDetail.variablesUsed && selectedStepDetail.variablesUsed.length > 0 && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5" />
                    Resolved Variables
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {selectedStepDetail.variablesUsed.map((v, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono flex items-center gap-2"
                      >
                        <span className="text-amber-400 font-bold">${v.name}</span>
                        <span className="text-slate-500">({v.type})</span>
                        <span className="text-slate-600">=</span>
                        <span className="text-slate-200">{v.resolvedValue}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Excel References (Section 10.1) */}
              {selectedStepDetail.excelReference && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    Test Data Excel Integration
                  </span>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] font-mono">
                    <div>
                      <span className="text-[10px] text-slate-500">Workbook</span>
                      <p className="text-white truncate">{selectedStepDetail.excelReference.fileName}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500">Worksheet</span>
                      <p className="text-slate-300">{selectedStepDetail.excelReference.sheetName}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500">Unique Data</span>
                      <p className="text-emerald-400 font-bold">{selectedStepDetail.excelReference.uniqueData}</p>
                    </div>
                    {selectedStepDetail.excelReference.writeBackValue && (
                      <div>
                        <span className="text-[10px] text-slate-500">Write Back Data</span>
                        <p className="text-purple-300 font-bold">{selectedStepDetail.excelReference.writeBackValue}</p>
                      </div>
                    )}
                  </div>

                  {selectedStepDetail.excelReference.extractedData && (
                    <div className="pt-2">
                      <span className="text-[10px] text-slate-500 uppercase block mb-1">
                        Extracted Row Map Schema:
                      </span>
                      <pre className="p-2.5 rounded-lg bg-slate-900 text-slate-300 font-mono text-[10px] overflow-x-auto border border-slate-800">
                        {JSON.stringify(selectedStepDetail.excelReference.extractedData, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* Execution Logs Trace (Section 10.1) */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-brand-400" />
                  Terminal Execution Logs Trace
                </span>
                <div className="p-4 rounded-xl bg-slate-950 font-mono text-[11px] text-slate-300 border border-slate-800 space-y-1 overflow-x-auto max-h-48">
                  {selectedStepDetail.logs?.map((log, idx) => (
                    <div key={idx} className="leading-relaxed">
                      {log.includes('ERROR') ? (
                        <span className="text-rose-400">{log}</span>
                      ) : log.includes('successfully') ? (
                        <span className="text-emerald-400">{log}</span>
                      ) : (
                        log
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Screenshot Viewer (Section 10.1) */}
              {selectedStepDetail.screenshot ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-brand-400" />
                      Visual Browser Screenshot
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">1280x800 Viewport</span>
                  </div>
                  <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-xl flex items-center justify-center p-2">
                    <img
                      src={selectedStepDetail.screenshot}
                      alt="Step Execution Screenshot"
                      className="max-h-80 w-auto rounded-lg object-contain shadow-md"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-500">
                  <Camera className="w-5 h-5 mx-auto mb-1 text-slate-600" />
                  Screenshot capture disabled for this step by Run Settings policy.
                </div>
              )}

              {/* Screen Recording (Section 10.1) */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-brand-400" />
                  Execution Screen Recording
                </span>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsPlayingVideo(!isPlayingVideo)}
                      className="p-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white shadow-md transition-all"
                    >
                      <PlayCircle className="w-5 h-5" />
                    </button>
                    <div>
                      <span className="text-xs font-semibold text-white block">
                        {isPlayingVideo ? 'Playing Playwright Session Recording...' : 'Session Video Capture'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Format: WebM Video (Captured across active steps)
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                    Video Sync Ready
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Playwright TypeScript Code Modal */}
      {isCodeModalOpen && activeScript?.generatedPlaywrightCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <Code className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Executed Playwright TypeScript Code</span>
                    <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      @playwright/test
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Exact internal Playwright TypeScript mapping executed on the machine
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(activeScript.generatedPlaywrightCode || '');
                    setCodeCopied(true);
                    setTimeout(() => setCodeCopied(false), 2000);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1.5 border border-slate-700 transition-all font-medium"
                >
                  {codeCopied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                  <span>{codeCopied ? 'Copied to Clipboard' : 'Copy Code'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsCodeModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-slate-950">
              <pre className="font-mono text-xs text-purple-200 bg-slate-900/90 p-4 rounded-xl border border-slate-800/80 overflow-x-auto leading-relaxed selection:bg-purple-600/40">
                {activeScript.generatedPlaywrightCode}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

