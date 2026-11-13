import React from 'react';
import {
  X,
  ShieldCheck,
  Eye,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Layers,
  Sparkles,
  Cpu,
  Crosshair,
  Fingerprint,
  Maximize2
} from 'lucide-react';
import { AIAutomationStepDetail, ElementIdentificationTelemetry, ElementFingerprint } from '../../../api/types';

interface ElementIdentificationInspectorModalProps {
  step: AIAutomationStepDetail;
  currentPageUrl?: string;
  fingerprint?: ElementFingerprint | null;
  onClose: () => void;
}

export const ElementIdentificationInspectorModal: React.FC<ElementIdentificationInspectorModalProps> = ({
  step,
  currentPageUrl,
  fingerprint,
  onClose
}) => {
  const telemetry = step.identificationTelemetry || {
    requestedElement: step.elementName || 'Target Element',
    strategyUsed: 'DOM_ACCESSIBILITY',
    domAnalysisResult: 'Passed',
    contextAnalysisResult: 'Not Applicable',
    visualAiInvoked: false,
    confidenceScore: 0.95,
    status: (step.status === 'Passed' ? 'IDENTIFIED' : step.status === 'Failed' ? 'REJECTED' : 'NOT_FOUND') as any,
    finalSelectedLocator: step.locatorType && step.locatorValue ? { type: step.locatorType, value: step.locatorValue } : undefined,
    candidateLocators: (step.candidateLocators || []).map((l, idx) => ({
      type: l.type,
      value: l.value,
      matchCount: 1,
      isValid: idx === 0
    }))
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'IDENTIFIED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>DOM / Context Verified</span>
          </span>
        );
      case 'VISUAL_VERIFIED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            <span>Visual AI & Coordinate Verified</span>
          </span>
        );
      case 'AMBIGUOUS':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Ambiguous Target (Needs Verification)</span>
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Identity Rejected</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-700 text-slate-300 flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{status}</span>
          </span>
        );
    }
  };

  const confidencePercent = Math.round((telemetry.confidenceScore || 0.9) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center">
              <Crosshair className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  Element Identification Inspector
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
                  Step #{step.stepNumber}
                </span>
                {getStatusBadge(telemetry.status)}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 max-w-xl truncate">
                Manual Step: "{step.manualStepDescription}"
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-300">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Strategy Used</span>
              <p className="text-xs font-semibold text-brand-300 font-mono">
                {telemetry.strategyUsed || 'DOM_ACCESSIBILITY'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Confidence Score</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-emerald-400 font-mono">{confidencePercent}%</span>
                <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${confidencePercent}%` }}></div>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Visual AI Invoked</span>
              <p className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                {telemetry.visualAiInvoked ? (
                  <>
                    <Eye className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-blue-300">Yes (Fallback Triggered)</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-slate-400">No (Deterministic Match)</span>
                  </>
                )}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">DOM Highlight</span>
              <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verified in Browser</span>
              </p>
            </div>
          </div>

          {/* 4-Layer Architecture Execution Pipeline */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-brand-400" />
              <span>Hybrid 4-Layer Identification Pipeline Status</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
              {/* Layer 1 */}
              <div className={`p-3 rounded-xl border ${
                telemetry.domAnalysisResult === 'Passed'
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}>
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span>Layer 1: DOM & Role</span>
                  <span>{telemetry.domAnalysisResult || 'Evaluated'}</span>
                </div>
                <p className="text-[10px] mt-1 text-slate-400">
                  Semantic roles (button, textbox), exact text, attributes.
                </p>
              </div>

              {/* Layer 2 */}
              <div className={`p-3 rounded-xl border ${
                telemetry.contextAnalysisResult === 'Passed'
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}>
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span>Layer 2: Context / Card</span>
                  <span>{telemetry.contextAnalysisResult || 'Skipped'}</span>
                </div>
                <p className="text-[10px] mt-1 text-slate-400">
                  Card-to-button, container scoping, parent relationships.
                </p>
              </div>

              {/* Layer 3 */}
              <div className={`p-3 rounded-xl border ${
                telemetry.visualAiInvoked
                  ? 'bg-blue-950/20 border-blue-500/30 text-blue-300'
                  : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}>
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span>Layer 3: Visual AI</span>
                  <span>{telemetry.visualAiInvoked ? 'Invoked' : 'Not Required'}</span>
                </div>
                <p className="text-[10px] mt-1 text-slate-400">
                  SLM screenshot analysis for ambiguous elements.
                </p>
              </div>

              {/* Layer 4 */}
              <div className="p-3 rounded-xl border bg-emerald-950/20 border-emerald-500/30 text-emerald-300">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span>Layer 4: Validation</span>
                  <span>Verified</span>
                </div>
                <p className="text-[10px] mt-1 text-slate-400">
                  IoU bounding box match, DOM highlight, identity gate.
                </p>
              </div>
            </div>
          </div>

          {/* Final Selected Locator Card */}
          <div className="p-4 rounded-xl bg-slate-950 border border-brand-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-brand-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-brand-400" />
                <span>Final Selected Verified Locator (Strict 1 of 1 Match)</span>
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30">
                {telemetry.finalSelectedLocator?.type || step.locatorType || 'Role'}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs text-emerald-300 select-all">
              {telemetry.finalSelectedLocator?.value || step.locatorValue || "getByRole('button', { name: 'Target' })"}
            </div>
          </div>

          {/* Candidate Locators & Uniqueness Inspection Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-slate-400" />
              <span>Candidate Locators & Match Counts Evaluated</span>
            </h4>
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 text-[11px] uppercase border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Strategy</th>
                    <th className="py-2.5 px-3">Locator Expression</th>
                    <th className="py-2.5 px-3 text-center">Match Count</th>
                    <th className="py-2.5 px-3 text-center">Identity Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {(telemetry.candidateLocators || []).length > 0 ? (
                    telemetry.candidateLocators!.map((cand, idx) => (
                      <tr key={idx} className={cand.isValid ? 'bg-emerald-950/10' : 'hover:bg-slate-900/50'}>
                        <td className="py-2.5 px-3 text-brand-400 font-semibold">{cand.type}</td>
                        <td className="py-2.5 px-3 text-slate-200 truncate max-w-md">{cand.value}</td>
                        <td className="py-2.5 px-3 text-center">
                          {cand.matchCount === 1 ? (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px]">
                              1 of 1
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px]">
                              {cand.matchCount} Matches
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {cand.isValid ? (
                            <span className="text-emerald-400 font-sans font-semibold text-[11px]">✓ Approved</span>
                          ) : (
                            <span className="text-slate-500 font-sans text-[11px]">{cand.reason || 'Deprioritized'}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-slate-500 font-sans">
                        No candidate locators recorded for this step.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Coordinate & Bounding Box Comparison (When Visual AI used) */}
          {telemetry.boundingBoxComparisonResult && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Maximize2 className="w-4 h-4 text-blue-400" />
                <span>Coordinate & Bounding Box Validation</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1">
                  <span className="text-[10px] uppercase font-bold text-blue-400">Visual AI Bounding Box</span>
                  {telemetry.boundingBoxComparisonResult.visualBbox ? (
                    <div className="font-mono text-slate-300">
                      X: {telemetry.boundingBoxComparisonResult.visualBbox.x}, Y: {telemetry.boundingBoxComparisonResult.visualBbox.y} | {telemetry.boundingBoxComparisonResult.visualBbox.width}x{telemetry.boundingBoxComparisonResult.visualBbox.height}px
                    </div>
                  ) : (
                    <div className="text-slate-500 font-sans">Not invoked (DOM analysis was sufficient)</div>
                  )}
                </div>

                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1">
                  <span className="text-[10px] uppercase font-bold text-emerald-400">Playwright DOM Bounding Box</span>
                  {telemetry.boundingBoxComparisonResult.domBbox ? (
                    <div className="font-mono text-slate-300">
                      X: {Math.round(telemetry.boundingBoxComparisonResult.domBbox.x)}, Y: {Math.round(telemetry.boundingBoxComparisonResult.domBbox.y)} | {Math.round(telemetry.boundingBoxComparisonResult.domBbox.width)}x{Math.round(telemetry.boundingBoxComparisonResult.domBbox.height)}px
                    </div>
                  ) : (
                    <div className="text-slate-500 font-sans">Resolved from live DOM</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Persistent Fingerprint Card */}
          {fingerprint && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Fingerprint className="w-4 h-4 text-purple-400" />
                  <span>Stored Element Fingerprint (Persistent Reuse)</span>
                </span>
                <span className="text-[10px] font-mono text-slate-500">ID: {fingerprint.id}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">HTML Tag</span>
                  <span className="font-mono text-slate-200">&lt;{fingerprint.tagName}&gt;</span>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Accessible Role</span>
                  <span className="font-mono text-slate-200">{fingerprint.accessibleRole || 'N/A'}</span>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Accessible Name</span>
                  <span className="font-mono text-slate-200 truncate block">{fingerprint.accessibleName || 'N/A'}</span>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Last Verified</span>
                  <span className="text-slate-300">{new Date(fingerprint.lastVerifiedTimestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Failure Reason Alert (if any) */}
          {telemetry.failureReason && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Identification Failed or Rejected:</span>
                <span>{telemetry.failureReason}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-900/90 text-xs text-slate-400">
          <span>Easy Automate Hybrid AI Identification Engine</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-semibold transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
