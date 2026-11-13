import React, { useState, useEffect } from 'react';
import {
  Server,
  Key,
  Globe,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  Trash2,
  Star,
  RefreshCw,
  Cpu,
  Layers,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { api } from '../../../api/client';
import {
  AIModelConfiguration,
  AIModelProviderType,
  AIModelAuthType,
  AIModelConnectionStatus
} from '../../../api/types';

export const AIModelConfigSection: React.FC = () => {
  const [models, setModels] = useState<AIModelConfiguration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [testingModelId, setTestingModelId] = useState<string | null>(null);
  const [testPromptResult, setTestPromptResult] = useState<{ id: string; text: string } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('Local Ollama SLM');
  const [apiBaseUrl, setApiBaseUrl] = useState('http://localhost:11434/v1');
  const [modelName, setModelName] = useState('llama3');
  const [providerType, setProviderType] = useState<AIModelProviderType>('openai-compatible');
  const [authType, setAuthType] = useState<AIModelAuthType>('none');
  const [apiToken, setApiToken] = useState('');
  const [customHeaderName, setCustomHeaderName] = useState('');
  const [customHeaderValue, setCustomHeaderValue] = useState('');
  const [isDefault, setIsDefault] = useState(true);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    setIsLoading(true);
    try {
      const res = await api.aiAutoTesting.getModels();
      if (res.success && res.models) {
        setModels(res.models);
        if (res.models.length > 0 && !selectedId) {
          const def = res.models.find((m: AIModelConfiguration) => m.isDefault) || res.models[0];
          populateForm(def);
        }
      }
    } catch (e: any) {
      console.error('Failed to load AI models:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const populateForm = (m: AIModelConfiguration) => {
    setSelectedId(m.id);
    setName(m.name);
    setApiBaseUrl(m.apiBaseUrl);
    setModelName(m.modelName);
    setProviderType(m.providerType);
    setAuthType(m.authType);
    setApiToken(m.apiToken || '');
    setCustomHeaderName(m.customHeaderName || '');
    setCustomHeaderValue(m.customHeaderValue || '');
    setIsDefault(m.isDefault);
    setTestPromptResult(null);
  };

  const handleResetForm = () => {
    setSelectedId(null);
    setName('New Local SLM');
    setApiBaseUrl('http://localhost:11434/v1');
    setModelName('llama3');
    setProviderType('openai-compatible');
    setAuthType('none');
    setApiToken('');
    setCustomHeaderName('');
    setCustomHeaderValue('');
    setIsDefault(models.length === 0);
    setTestPromptResult(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !apiBaseUrl.trim()) {
      setMessage({ type: 'error', text: 'Configuration Name and API Base URL are required.' });
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      const res = await api.aiAutoTesting.saveModel({
        id: selectedId || undefined,
        name: name.trim(),
        apiBaseUrl: apiBaseUrl.trim(),
        modelName: modelName.trim() || 'default',
        providerType,
        authType,
        apiToken: apiToken.trim() || undefined,
        customHeaderName: customHeaderName.trim() || undefined,
        customHeaderValue: customHeaderValue.trim() || undefined,
        isDefault
      });

      if (res.success && res.model) {
        setMessage({ type: 'success', text: 'AI Model configuration saved successfully.' });
        setSelectedId(res.model.id);
        await loadModels();
      } else {
        setMessage({ type: 'error', text: res.error || 'Failed to save configuration.' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEstablishConnection = async () => {
    setMessage(null);
    setTestingModelId(selectedId || 'pending');
    try {
      const targetConfig = {
        name,
        apiBaseUrl,
        modelName,
        providerType,
        authType,
        apiToken,
        customHeaderName,
        customHeaderValue
      };

      const res = await api.aiAutoTesting.testModelConnection(selectedId || undefined, targetConfig);
      if (res.status === 'Connected') {
        setMessage({
          type: 'success',
          text: `Connection established successfully! Latency: ${res.latencyMs}ms. ${res.availableModels?.length ? `Discovered ${res.availableModels.length} models.` : ''}`
        });
      } else {
        setMessage({
          type: 'error',
          text: `Connection status: ${res.status}. ${res.error || ''}`
        });
      }
      await loadModels();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setTestingModelId(null);
    }
  };

  const handleTestPrompt = async (modelId: string) => {
    setMessage(null);
    setTestingModelId(modelId);
    try {
      const res = await api.aiAutoTesting.testModelPrompt(modelId, 'Hello! Verify your local SLM inference response in 1 concise sentence.');
      if (res.success && res.testOutput) {
        setTestPromptResult({ id: modelId, text: res.testOutput });
      } else {
        setMessage({ type: 'error', text: res.error || 'Test prompt failed.' });
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setTestingModelId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this AI Model configuration?')) return;
    try {
      await api.aiAutoTesting.deleteModel(id);
      if (selectedId === id) handleResetForm();
      await loadModels();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    }
  };

  const getStatusBadge = (status: AIModelConnectionStatus) => {
    switch (status) {
      case 'Connected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Connected
          </span>
        );
      case 'Authentication Required':
      case 'Authentication Failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            {status}
          </span>
        );
      case 'Connecting':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Connecting
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-brand-400" />
            <h2 className="text-base font-bold text-white">Local Small Language Model (SLM) Integration</h2>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Connect your own locally hosted inference server (e.g., Ollama, LM Studio, vLLM, LocalAI) without cloud lock-in. Easy Automate sends prompts to your local API for understanding requirements, generating test cases, and mapping NLPs.
          </p>
        </div>
        <button
          onClick={handleResetForm}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-2 transition-colors shrink-0"
        >
          <Zap className="w-3.5 h-3.5 text-brand-400" />
          <span>New Model Config</span>
        </button>
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
            message.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
              : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Grid: Configured Models List & Edit Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Models List (4 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider px-1">
            Configured Models ({models.length})
          </h3>

          {isLoading ? (
            <div className="p-8 text-center text-slate-500 text-xs">Loading models...</div>
          ) : models.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/60 rounded-2xl border border-slate-800/80 text-slate-400 space-y-2">
              <Server className="w-8 h-8 mx-auto text-slate-600" />
              <p className="text-xs font-medium">No local SLMs configured yet.</p>
              <p className="text-[11px] text-slate-500">Configure your local endpoint on the right.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {models.map(m => (
                <div
                  key={m.id}
                  onClick={() => populateForm(m)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2 ${
                    selectedId === m.id
                      ? 'bg-brand-950/40 border-brand-500/50 shadow-md shadow-brand-500/10'
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-white">{m.name}</h4>
                      {m.isDefault && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                          <Star className="w-2.5 h-2.5 fill-amber-400" />
                          Default
                        </span>
                      )}
                    </div>
                    {getStatusBadge(m.status)}
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                    <span className="truncate">{m.modelName}</span>
                    <span>•</span>
                    <span className="truncate">{m.apiBaseUrl}</span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {m.lastLatencyMs ? `${m.lastLatencyMs}ms` : 'Not tested'}
                    </span>
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleTestPrompt(m.id)}
                        disabled={testingModelId === m.id}
                        className="text-brand-400 hover:text-brand-300 font-semibold transition-colors flex items-center gap-1"
                      >
                        <Send className="w-2.5 h-2.5" />
                        Test Ping
                      </button>
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="text-slate-500 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {testPromptResult && testPromptResult.id === m.id && (
                    <div className="mt-2 p-2.5 bg-slate-950/80 rounded-lg border border-slate-800 text-[11px] text-slate-300 font-mono animate-fadeIn">
                      <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-1">Response:</span>
                      {testPromptResult.text}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Connection Form (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900/80 rounded-2xl border border-slate-800 p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-white">
                {selectedId ? 'Edit AI Model Configuration' : 'New AI Model Configuration'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure local LLM/SLM inference API endpoint
              </p>
            </div>
            {selectedId && (
              <span className="text-[11px] text-slate-500 font-mono">ID: {selectedId}</span>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Configuration Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Local Llama 3 or QA Ollama"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 text-slate-100 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Model Name *</label>
                <input
                  type="text"
                  value={modelName}
                  onChange={e => setModelName(e.target.value)}
                  placeholder="e.g. llama3, qwen2.5-coder, mistral"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 text-slate-100 text-xs font-mono"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">API Base URL *</label>
              <div className="relative">
                <Globe className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="url"
                  value={apiBaseUrl}
                  onChange={e => setApiBaseUrl(e.target.value)}
                  placeholder="http://localhost:11434/v1 or http://192.168.1.100:8000/v1"
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-brand-500 text-slate-100 text-xs font-mono"
                  required
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                OpenAI-compatible endpoints typically end with <span className="font-mono text-slate-400">/v1</span> (e.g. Ollama, LM Studio, vLLM).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">API Format / Provider</label>
                <select
                  value={providerType}
                  onChange={e => setProviderType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs"
                >
                  <option value="openai-compatible">OpenAI-Compatible (/v1/chat/completions)</option>
                  <option value="ollama">Ollama Native (/api/chat)</option>
                  <option value="custom">Custom Inference Adapter</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Authentication Type</label>
                <select
                  value={authType}
                  onChange={e => setAuthType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs"
                >
                  <option value="none">No Authentication (Public Local)</option>
                  <option value="bearer">Bearer Token (Authorization: Bearer ...)</option>
                  <option value="api-key">API Key (x-api-key)</option>
                  <option value="custom-header">Custom Header</option>
                </select>
              </div>
            </div>

            {/* Conditional Authentication Fields (Section 3.4) */}
            {authType !== 'none' && (
              <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3 animate-fadeIn">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <Key className="w-3.5 h-3.5 text-brand-400" />
                  <span>Authentication Credentials</span>
                </div>

                {authType === 'custom-header' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Header Name</label>
                      <input
                        type="text"
                        value={customHeaderName}
                        onChange={e => setCustomHeaderName(e.target.value)}
                        placeholder="X-Auth-Token"
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Header Value / Token</label>
                      <input
                        type="password"
                        value={customHeaderValue}
                        onChange={e => setCustomHeaderValue(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">API Token / Secret Key</label>
                    <input
                      type="password"
                      value={apiToken}
                      onChange={e => setApiToken(e.target.value)}
                      placeholder="Enter secret token (stored securely, masked in UI)"
                      className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200"
                    />
                    <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      Tokens are encrypted securely on backend and never exposed in logs.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="defaultModelCheckbox"
                checked={isDefault}
                onChange={e => setIsDefault(e.target.checked)}
                className="rounded border-slate-800 bg-slate-950 text-brand-600 focus:ring-0"
              />
              <label htmlFor="defaultModelCheckbox" className="text-xs text-slate-300 font-medium select-none cursor-pointer">
                Set as Default Model for AI Auto Testing
              </label>
            </div>

            <div className="pt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800">
              <button
                type="button"
                onClick={handleEstablishConnection}
                disabled={testingModelId !== null}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-brand-300 border border-slate-700 flex items-center gap-2 transition-colors"
              >
                {testingModelId !== null ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-400" />}
                <span>Establish Connection</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white flex items-center gap-2 shadow-sm transition-colors"
                >
                  {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>{selectedId ? 'Update Configuration' : 'Save Configuration'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
