import React, { useState, useEffect } from 'react';
import {
  FileCode,
  Component,
  Layers,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Laptop,
  Cpu,
  Monitor,
  Globe,
  RefreshCw,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  PlayCircle
} from 'lucide-react';
import { api } from '../../api/client';
import { Project, ProjectStats, ExecutionRecord } from '../../api/types';

interface DashboardViewProps {
  project: Project;
  onNavigateToRepository: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ project, onNavigateToRepository }) => {
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedExecution, setSelectedExecution] = useState<ExecutionRecord | null>(null);

  useEffect(() => {
    loadStats();
  }, [project.id]);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const res = await api.dashboard.getStats(project.id);
      if (res.success && res.stats) {
        setStats(res.stats);
        if (res.stats.recentExecutions.length > 0) {
          setSelectedExecution(res.stats.recentExecutions[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const getStatusBadge = (status: ExecutionRecord['status']) => {
    switch (status) {
      case 'Passed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Passed
          </span>
        );
      case 'Failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" />
            Failed
          </span>
        );
      case 'Running':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Running
          </span>
        );
      case 'Aborted':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            Aborted
          </span>
        );
    }
  };

  if (isLoading || !stats) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-400">Loading project analytics & execution telemetry...</p>
      </div>
    );
  }

  const activeMachine = selectedExecution?.machine || stats.activeMachine;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono text-slate-400">Playwright Test Automation Harness</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Project Dashboard</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Real-time project overview, repository element metrics, and automated execution telemetry.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadStats}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Refresh statistics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={onNavigateToRepository}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white shadow-md shadow-brand-600/30 transition-all hover:scale-[1.02]"
          >
            <Component className="w-4 h-4" />
            <span>Manage Repository Elements</span>
          </button>
        </div>
      </div>

      {/* 2.1 Project Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Scripts */}
        <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 relative overflow-hidden shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Scripts</span>
            <FileCode className="w-4 h-4 text-brand-400" />
          </div>
          <p className="text-2xl font-bold text-white">{stats.totalScripts}</p>
          <p className="text-[11px] text-slate-500 mt-1">Playwright TS files</p>
        </div>

        {/* Total Elements (from Repository) */}
        <div
          onClick={onNavigateToRepository}
          className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 relative overflow-hidden shadow-sm hover:border-brand-500/50 cursor-pointer group transition-colors"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 group-hover:text-brand-300 transition-colors">
              Total Elements
            </span>
            <Component className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
          </div>
          <p className="text-2xl font-bold text-purple-300">{stats.totalElements}</p>
          <p className="text-[11px] text-brand-400 mt-1 flex items-center gap-1">
            <span>In Repository</span> →
          </p>
        </div>

        {/* Total Suites */}
        <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 relative overflow-hidden shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Suites</span>
            <Layers className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-2xl font-bold text-white">{stats.totalSuites}</p>
          <p className="text-[11px] text-slate-500 mt-1">Active test groups</p>
        </div>

        {/* Suite Executions */}
        <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 relative overflow-hidden shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Suite Executions</span>
            <Activity className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-white">{stats.suiteExecutions}</p>
          <p className="text-[11px] text-slate-500 mt-1">Total recorded runs</p>
        </div>

        {/* Passed Executions */}
        <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 relative overflow-hidden shadow-sm hover:border-emerald-500/30 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Passed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400">{stats.passedExecutions}</p>
          <p className="text-[11px] text-emerald-500/80 mt-1">{stats.passRate}% pass rate</p>
        </div>

        {/* Failed Executions */}
        <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 relative overflow-hidden shadow-sm hover:border-rose-500/30 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Failed</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-bold text-rose-400">{stats.failedExecutions}</p>
          <p className="text-[11px] text-rose-500/80 mt-1">Requiring triage</p>
        </div>
      </div>

      {/* Middle Section: Execution Telemetry Visual Charts & Machine Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Execution Telemetry & Status Breakdown */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Execution Telemetry & Health</h3>
                <p className="text-xs text-slate-400">Aggregated results across test runs</p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                Passed ({stats.passedExecutions})
              </span>
              <span className="flex items-center gap-1.5 text-rose-400">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                Failed ({stats.failedExecutions})
              </span>
            </div>
          </div>

          {/* Progress Bar Distribution */}
          <div className="space-y-2">
            <div className="h-4 w-full bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
              <div
                style={{ width: `${stats.passRate}%` }}
                className="bg-emerald-500 h-full transition-all duration-500 relative group cursor-pointer"
                title={`Passed: ${stats.passRate}%`}
              />
              <div
                style={{ width: `${100 - stats.passRate}%` }}
                className="bg-rose-500 h-full transition-all duration-500 relative group cursor-pointer"
                title={`Failed: ${100 - stats.passRate}%`}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-400 font-mono">
              <span>Overall Pass Rate: <strong className="text-emerald-400">{stats.passRate}%</strong></span>
              <span>Failure Rate: <strong className="text-rose-400">{100 - stats.passRate}%</strong></span>
            </div>
          </div>

          {/* Interactive Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Average Duration</span>
              <p className="text-base font-bold text-slate-200 mt-1">1m 15s</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Across Playwright tests</p>
            </div>
            <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Target Environment</span>
              <p className="text-base font-bold text-brand-400 capitalize mt-1">{project.environment || 'development'}</p>
              <p className="text-[10px] text-slate-500 mt-0.5 font-mono truncate">{project.baseUrl}</p>
            </div>
            <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Default Browser Engine</span>
              <p className="text-base font-bold text-purple-400 capitalize mt-1">{project.defaultBrowser || 'chromium'}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Headless / Headed ready</p>
            </div>
          </div>
        </div>

        {/* Right 1 Col: 2.3 Machine Details Panel */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Laptop className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Machine Details</h3>
                <p className="text-[11px] text-slate-400">Execution node telemetry (Section 2.3)</p>
              </div>
            </div>

            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {activeMachine.status}
            </span>
          </div>

          <dl className="text-xs space-y-3.5">
            <div>
              <dt className="text-slate-500 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-slate-400" />
                <span>Machine Name</span>
              </dt>
              <dd className="text-slate-200 font-mono font-semibold mt-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 truncate">
                {activeMachine.name}
              </dd>
            </div>

            <div>
              <dt className="text-slate-500 flex items-center gap-1.5">
                <Laptop className="w-3.5 h-3.5 text-slate-400" />
                <span>Operating System</span>
              </dt>
              <dd className="text-slate-200 font-medium mt-1">
                {activeMachine.os}
              </dd>
            </div>

            <div>
              <dt className="text-slate-500 flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5 text-slate-400" />
                <span>Browser Name & Version</span>
              </dt>
              <dd className="text-slate-200 font-mono text-[11px] mt-1 flex items-center gap-2">
                <span className="px-2 py-0.5 bg-brand-950 border border-brand-800 text-brand-300 rounded font-semibold">
                  {activeMachine.browser}
                </span>
                <span className="text-slate-400">v{activeMachine.version}</span>
              </dd>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
              <div>
                <dt className="text-slate-500">Environment</dt>
                <dd className="text-slate-300 font-semibold capitalize mt-0.5">
                  {activeMachine.environment}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Worker Status</dt>
                <dd className="text-emerald-400 font-semibold mt-0.5">
                  Playwright Ready
                </dd>
              </div>
            </div>
          </dl>
        </div>
      </div>

      {/* 2.2 Execution Overview Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-brand-400" />
              Recent Execution Overview (Section 2.2)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Historical suite executions performed on this project
            </p>
          </div>

          <span className="text-xs text-slate-400 font-mono">
            Showing last {stats.recentExecutions.length} runs
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-6">Suite Name</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6">Date & Time</th>
                <th className="py-3 px-6">Duration</th>
                <th className="py-3 px-6">Tests (Pass/Fail)</th>
                <th className="py-3 px-6">Machine Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              {stats.recentExecutions.map((exec) => (
                <tr
                  key={exec.id}
                  onClick={() => setSelectedExecution(exec)}
                  className={`hover:bg-slate-800/40 transition-colors cursor-pointer ${
                    selectedExecution?.id === exec.id ? 'bg-slate-800/60' : ''
                  }`}
                >
                  <td className="py-3.5 px-6 font-semibold text-white">
                    <div className="flex items-center gap-2">
                      <PlayCircle className="w-3.5 h-3.5 text-slate-500" />
                      <span>{exec.suiteName}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-6">{getStatusBadge(exec.status)}</td>
                  <td className="py-3.5 px-6 text-slate-400 font-mono text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>{new Date(exec.startedAt).toLocaleString()}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-6 font-mono text-slate-300">
                    {formatDuration(exec.durationSeconds)}
                  </td>
                  <td className="py-3.5 px-6">
                    <span className="text-emerald-400 font-semibold">{exec.passedTests} passed</span>
                    {exec.failedTests > 0 && (
                      <span className="text-rose-400 font-semibold ml-1.5">/ {exec.failedTests} failed</span>
                    )}
                  </td>
                  <td className="py-3.5 px-6">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] text-slate-300">{exec.machine.name}</span>
                      <span className="text-slate-500">·</span>
                      <span className="text-slate-400 capitalize">{exec.machine.browser}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
