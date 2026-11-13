import React, { useState, useEffect } from 'react';
import {
  History,
  Activity,
  Cpu,
  Clock,
  CheckCircle2,
  AlertCircle,
  Hash,
  Zap,
  BarChart2,
  Calendar,
  Layers,
  RefreshCw
} from 'lucide-react';
import { api } from '../../../api/client';
import { Project, AIAutomationSession, AIModelUsageLog } from '../../../api/types';

interface AIExecutionHistorySectionProps {
  project: Project;
}

export const AIExecutionHistorySection: React.FC<AIExecutionHistorySectionProps> = ({ project }) => {
  const [sessions, setSessions] = useState<AIAutomationSession[]>([]);
  const [usageLogs, setUsageLogs] = useState<AIModelUsageLog[]>([]);
  const [stats, setStats] = useState<{
    totalRequests: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalTokens: number;
    avgLatencyMs: number;
    failedRequests: number;
  }>({
    totalRequests: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    avgLatencyMs: 0,
    failedRequests: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadHistoryData();
  }, [project.id]);

  const loadHistoryData = async () => {
    setIsLoading(true);
    try {
      const [sessRes, usageRes] = await Promise.all([
        api.aiAutoTesting.getSessions(project.id),
        api.aiAutoTesting.getUsageLogs()
      ]);

      if (sessRes.success && sessRes.sessions) {
        setSessions(sessRes.sessions);
      }

      if (usageRes.success) {
        if (usageRes.logs) setUsageLogs(usageRes.logs);
        if (usageRes.stats) setStats(usageRes.stats);
      }
    } catch (e: any) {
      console.error('Failed to load execution history:', e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-brand-400" />
            <h2 className="text-base font-bold text-white">Execution History & SLM Metrics</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Audit history of AI browser development sessions and local SLM inference token telemetry. Tracks latency, token counts, and request reliability without sending metrics to external clouds.
          </p>
        </div>

        <button
          onClick={loadHistoryData}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 shrink-0 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {/* Model Usage Dashboard (Section 13.4) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total SLM Calls</span>
            <Activity className="w-4 h-4 text-brand-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{stats.totalRequests}</div>
          <p className="text-[10px] text-slate-500">Inference queries logged</p>
        </div>

        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Tokens</span>
            <Hash className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-300 font-mono">
            {stats.totalTokens.toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-500">
            Prompt: {stats.totalPromptTokens.toLocaleString()} • Comp: {stats.totalCompletionTokens.toLocaleString()}
          </p>
        </div>

        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Avg Latency</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-300 font-mono">{stats.avgLatencyMs}ms</div>
          <p className="text-[10px] text-slate-500">Average model response time</p>
        </div>

        <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Success Rate</span>
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            {stats.totalRequests > 0
              ? `${Math.round(((stats.totalRequests - stats.failedRequests) / stats.totalRequests) * 100)}%`
              : '100%'}
          </div>
          <p className="text-[10px] text-slate-500">{stats.failedRequests} failed request(s)</p>
        </div>
      </div>

      {/* Two Tabs/Tables: Sessions History & SLM Request Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Development Sessions History */}
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 space-y-4">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Development Sessions ({sessions.length})
          </h3>

          {isLoading ? (
            <div className="p-6 text-center text-slate-500 text-xs">Loading sessions...</div>
          ) : sessions.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-xs">No sessions recorded.</div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {sessions.map(s => {
                const isPassed = s.status === 'completed';
                const isFailed = s.status === 'failed';

                return (
                  <div
                    key={s.id}
                    className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 min-w-0">
                      <h4 className="font-bold text-white truncate max-w-xs">{s.testCaseName}</h4>
                      <p className="text-[10px] text-slate-500 font-mono truncate">
                        {s.steps.length} step(s) • Stage: {s.stage}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                          isPassed
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : isFailed
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}
                      >
                        {s.status}
                      </span>
                      <p className="text-[10px] text-slate-500 font-mono mt-1">
                        {new Date(s.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SLM Inference Logs */}
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 space-y-4">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Recent SLM Inference Logs ({usageLogs.length})
          </h3>

          {isLoading ? (
            <div className="p-6 text-center text-slate-500 text-xs">Loading usage logs...</div>
          ) : usageLogs.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-xs">No SLM queries logged yet.</div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto font-mono text-[11px]">
              {usageLogs.slice(0, 50).map(log => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-2"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold truncate">{log.modelName}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                        {log.operation.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 block">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`text-[10px] font-bold ${
                        log.status === 'success' ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {log.latencyMs}ms
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {log.totalTokens ? `${log.totalTokens} tok` : 'N/A'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
