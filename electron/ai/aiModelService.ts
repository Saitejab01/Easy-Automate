import { AIModelConfiguration, AIModelConnectionStatus } from '../database';
import { JsonDatabase } from '../database';

export interface ModelChatOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  operation?: 'document_classification' | 'test_case_generation' | 'step_interpretation' | 'nlp_mapping' | 'element_suggestion' | 'test_ping' | 'visual_element_identification';
  images?: string[];
}

export interface ModelChatResponse {
  content: string;
  parsedJson?: any;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs: number;
}

export class AIModelService {
  private db: JsonDatabase;

  constructor(db: JsonDatabase) {
    this.db = db;
  }

  /**
   * Builds headers based on authentication type and custom headers.
   */
  private buildHeaders(config: AIModelConfiguration): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (config.authType === 'bearer' && config.apiToken) {
      headers['Authorization'] = `Bearer ${config.apiToken.trim()}`;
    } else if (config.authType === 'api-key' && config.apiToken) {
      headers['x-api-key'] = config.apiToken.trim();
    } else if (config.authType === 'custom-header' && config.customHeaderName && config.customHeaderValue) {
      headers[config.customHeaderName.trim()] = config.customHeaderValue.trim();
    }

    if (config.additionalHeaders && typeof config.additionalHeaders === 'object') {
      for (const [key, val] of Object.entries(config.additionalHeaders)) {
        if (key && val) headers[key.trim()] = String(val).trim();
      }
    }

    return headers;
  }

  /**
   * Normalizes the base URL, stripping trailing slashes.
   */
  private normalizeUrl(url: string): string {
    return (url || '').trim().replace(/\/+$/, '');
  }

  /**
   * Section 3.3 & 3.4: Establish connection and test reachability
   */
  public async testConnection(modelIdOrConfig: string | AIModelConfiguration): Promise<{
    status: AIModelConnectionStatus;
    latencyMs: number;
    availableModels: string[];
    error?: string;
  }> {
    let config: AIModelConfiguration;
    if (typeof modelIdOrConfig === 'string') {
      const found = this.db.getRawAIModelConfigurationById(modelIdOrConfig);
      if (!found) {
        return {
          status: 'Model Not Available',
          latencyMs: 0,
          availableModels: [],
          error: 'Model configuration not found in database.'
        };
      }
      config = found;
    } else {
      config = modelIdOrConfig;
    }

    const baseUrl = this.normalizeUrl(config.apiBaseUrl);
    if (!baseUrl || !baseUrl.startsWith('http')) {
      return {
        status: 'Invalid API URL',
        latencyMs: 0,
        availableModels: [],
        error: 'API Base URL must start with http:// or https://'
      };
    }

    const startTime = Date.now();
    const headers = this.buildHeaders(config);

    // Step 1: Probe model discovery endpoint or base ping
    // Common endpoints: /v1/models, /models, /api/tags (Ollama)
    const probeEndpoints = [
      `${baseUrl}/models`,
      `${baseUrl.endsWith('/v1') ? baseUrl.slice(0, -3) : baseUrl}/api/tags`,
      `${baseUrl}/tags`,
      baseUrl
    ];

    let availableModels: string[] = [];
    let reachable = false;
    let authError = false;
    let lastErr: string = '';

    for (const url of probeEndpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(url, {
          method: 'GET',
          headers,
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.status === 401 || res.status === 403) {
          authError = true;
          const statusDesc: AIModelConnectionStatus = config.apiToken ? 'Authentication Failed' : 'Authentication Required';
          const latency = Date.now() - startTime;
          this.db.recordAIModelUsage({
            modelId: config.id || 'unassigned',
            modelName: config.modelName,
            operation: 'test_ping',
            latencyMs: latency,
            status: 'failure',
            errorMessage: `HTTP ${res.status}: ${res.statusText}`
          });
          return {
            status: statusDesc,
            latencyMs: latency,
            availableModels: [],
            error: `Endpoint returned HTTP ${res.status} (${res.statusText}). Please check API credentials.`
          };
        }

        if (res.ok) {
          reachable = true;
          try {
            const data: any = await res.json();
            if (Array.isArray(data?.data)) {
              // OpenAI /v1/models format
              availableModels = data.data.map((m: any) => m.id || m.name).filter(Boolean);
            } else if (Array.isArray(data?.models)) {
              // Ollama format
              availableModels = data.models.map((m: any) => m.name || m.model).filter(Boolean);
            }
          } catch {}
          break;
        }
      } catch (err: any) {
        lastErr = err.message || 'Connection failed';
      }
    }

    const latency = Date.now() - startTime;

    if (!reachable && !authError) {
      // If GET failed, try a lightweight chat completions probe
      try {
        const chatRes = await this.testChatPrompt(config, 'ping');
        if (chatRes) {
          const finalStatus: AIModelConnectionStatus = 'Connected';
          this.updateSavedConfigStatus(config.id, finalStatus, latency, availableModels);
          return {
            status: finalStatus,
            latencyMs: latency,
            availableModels
          };
        }
      } catch (probeErr: any) {
        const finalStatus: AIModelConnectionStatus = 'Connection Failed';
        this.updateSavedConfigStatus(config.id, finalStatus, latency, []);
        return {
          status: finalStatus,
          latencyMs: latency,
          availableModels: [],
          error: `Could not connect to model endpoint at ${baseUrl}: ${lastErr || probeErr.message}`
        };
      }
    }

    const finalStatus: AIModelConnectionStatus = reachable ? 'Connected' : 'Connection Failed';
    this.updateSavedConfigStatus(config.id, finalStatus, latency, availableModels);

    this.db.recordAIModelUsage({
      modelId: config.id || 'unassigned',
      modelName: config.modelName,
      operation: 'test_ping',
      latencyMs: latency,
      status: finalStatus === 'Connected' ? 'success' : 'failure',
      errorMessage: finalStatus === 'Connected' ? undefined : lastErr
    });

    return {
      status: finalStatus,
      latencyMs: latency,
      availableModels,
      error: finalStatus === 'Connected' ? undefined : lastErr
    };
  }

  private updateSavedConfigStatus(id?: string, status?: AIModelConnectionStatus, latency?: number, models?: string[]) {
    if (!id) return;
    const existing = this.db.getRawAIModelConfigurationById(id);
    if (existing) {
      existing.status = status || existing.status;
      existing.lastTestedAt = new Date().toISOString();
      if (typeof latency === 'number') existing.lastLatencyMs = latency;
      if (models && models.length > 0) existing.availableModels = models;
      this.db.saveAIModelConfiguration(existing);
    }
  }

  /**
   * Section 3.5: Test Model Response with a small prompt
   */
  public async testChatPrompt(config: AIModelConfiguration, prompt: string = 'Say "SLM Connection Verified"'): Promise<string> {
    const res = await this.chatCompletion(config, [
      { role: 'user', content: prompt }
    ], { maxTokens: 100, temperature: 0.1 });
    return res.content;
  }

  /**
   * Section 13: Core Chat Completion with Local SLM
   * Handles JSON mode, token tracking, timeouts, retries, and markdown cleanup.
   */
  public async chatCompletion(
    config: AIModelConfiguration,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options: ModelChatOptions = {}
  ): Promise<ModelChatResponse> {
    const baseUrl = this.normalizeUrl(config.apiBaseUrl);
    const headers = this.buildHeaders(config);
    const startTime = Date.now();

    // Determine completions endpoint based on baseUrl & provider
    let endpoint = `${baseUrl}/chat/completions`;
    if (config.providerType === 'ollama' && !baseUrl.includes('/v1')) {
      endpoint = `${baseUrl}/api/chat`;
    }

    const opType = options.operation || 'step_interpretation';
    let formattedMessages: any[] = [...messages];

    if (options.images && options.images.length > 0) {
      if (config.providerType === 'ollama' && !baseUrl.includes('/v1')) {
        // Ollama native API: add images array to the user message
        formattedMessages = messages.map(m => {
          if (m.role === 'user') {
            return { role: m.role, content: m.content, images: options.images };
          }
          return m;
        });
      } else {
        // OpenAI compatible vision format
        formattedMessages = messages.map(m => {
          if (m.role === 'user') {
            const contentParts: any[] = [{ type: 'text', text: m.content }];
            for (const img of options.images || []) {
              const url = img.startsWith('data:') ? img : `data:image/png;base64,${img}`;
              contentParts.push({ type: 'image_url', image_url: { url } });
            }
            return { role: m.role, content: contentParts };
          }
          return m;
        });
      }
    }

    const body: any = {
      model: config.modelName || 'default',
      messages: formattedMessages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 2048,
      stream: false
    };

    if (options.jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for local inference

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        this.db.recordAIModelUsage({
          modelId: config.id,
          modelName: config.modelName,
          operation: opType,
          latencyMs,
          status: 'failure',
          errorMessage: `HTTP ${response.status}: ${errorText.slice(0, 300)}`
        });
        throw new Error(`SLM API error (${response.status} ${response.statusText}): ${errorText.slice(0, 200)}`);
      }

      const data: any = await response.json();
      let rawContent = '';

      if (data?.choices && data.choices[0]?.message?.content) {
        rawContent = data.choices[0].message.content;
      } else if (data?.message?.content) {
        rawContent = data.message.content; // Ollama format
      } else if (data?.response) {
        rawContent = data.response;
      }

      const promptTokens = data?.usage?.prompt_tokens;
      const completionTokens = data?.usage?.completion_tokens;
      const totalTokens = data?.usage?.total_tokens || ((promptTokens || 0) + (completionTokens || 0));

      this.db.recordAIModelUsage({
        modelId: config.id,
        modelName: config.modelName,
        operation: opType,
        promptTokens,
        completionTokens,
        totalTokens,
        latencyMs,
        status: 'success'
      });

      let parsedJson: any = undefined;
      if (options.jsonMode) {
        parsedJson = this.extractAndParseJson(rawContent);
      }

      return {
        content: rawContent,
        parsedJson,
        promptTokens,
        completionTokens,
        totalTokens,
        latencyMs
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;
      this.db.recordAIModelUsage({
        modelId: config.id,
        modelName: config.modelName,
        operation: 'step_interpretation',
        latencyMs,
        status: 'failure',
        errorMessage: err.message
      });
      throw err;
    }
  }

  /**
   * Robust JSON extraction from SLM responses that might include markdown backticks or commentary.
   */
  public extractAndParseJson(text: string): any {
    if (!text || typeof text !== 'string') return null;

    // 1. Direct parse attempt
    try {
      return JSON.parse(text.trim());
    } catch {}

    // 2. Extract from ```json ... ``` code fence
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (codeBlockMatch && codeBlockMatch[1]) {
      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch {}
    }

    // 3. Find first { ... } or [ ... ]
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(text.slice(firstBrace, lastBrace + 1));
      } catch {}
    }

    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      try {
        return JSON.parse(text.slice(firstBracket, lastBracket + 1));
      } catch {}
    }

    return null;
  }

  /**
   * Section 5: Visual AI Identification using local Vision Model
   */
  public async identifyElementWithVision(
    config: AIModelConfiguration,
    prompt: string,
    screenshotBase64: string,
    targetInfo?: { stepDescription?: string; elementName?: string; elementType?: string }
  ): Promise<{
    element_found: boolean;
    element_description?: string;
    element_type?: string;
    visible_text?: string;
    coordinates?: { x: number; y: number };
    bounding_box?: { x: number; y: number; width: number; height: number };
    confidence?: number;
    reason?: string;
  } | null> {
    const systemPrompt = `You are an expert Visual AI for web test automation.
Analyze the provided screenshot of the web page and find the EXACT visual location of the requested element.
Return ONLY a valid JSON object matching this schema:
{
  "element_found": true,
  "element_description": "Descriptive name of the element",
  "element_type": "button | input | link | dropdown | checkbox | text | image",
  "visible_text": "Exact visible text of the element",
  "coordinates": { "x": 620, "y": 420 },
  "bounding_box": { "x": 570, "y": 395, "width": 100, "height": 50 },
  "confidence": 0.95,
  "reason": "Why this element is the intended target"
}

CRITICAL RULES:
1. Define coordinates (center point x, y) and bounding_box (x, y, width, height) in original browser viewport pixels.
2. If the element is NOT visible on screen, or cannot be identified with confidence, return {"element_found": false, "reason": "Element not found"}.
3. NEVER invent coordinates or guess random elements.`;

    const userPrompt = `${prompt}\n\nRequested Element: "${targetInfo?.elementName || 'Target'}"\nElement Type: "${targetInfo?.elementType || 'Interactive Element'}"\nManual Step: "${targetInfo?.stepDescription || ''}"`;

    try {
      const cleanBase64 = screenshotBase64.replace(/^data:image\/[a-z]+;base64,/, '');
      const res = await this.chatCompletion(
        config,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        {
          jsonMode: true,
          temperature: 0.1,
          maxTokens: 1024,
          operation: 'visual_element_identification',
          images: [cleanBase64]
        }
      );

      const parsed = res.parsedJson || this.extractAndParseJson(res.content);
      if (parsed && typeof parsed.element_found === 'boolean') {
        return parsed;
      }
      return null;
    } catch (err: any) {
      console.warn('[Visual AI] Vision completion error:', err.message);
      return null;
    }
  }
}
