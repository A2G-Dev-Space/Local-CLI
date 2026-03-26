import { Router, Request, Response } from 'express';
import { prisma } from '../index.js';
import { requireAuth } from '../middleware/auth.js';

export const llmSettingsRoutes = Router();

const LLM_SETTINGS_KEY = 'llm-config';

interface LLMConfig {
  endpointUrl: string;
  apiKey: string;
  modelId: string;
  maxTokens: number;
}

/**
 * GET /api/llm-settings -- Get current LLM configuration
 */
llmSettingsRoutes.get('/', requireAuth, async (_req: Request, res: Response) => {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: LLM_SETTINGS_KEY },
    });

    if (!setting) {
      res.json({
        endpointUrl: process.env['LLM_ENDPOINT_URL'] || 'http://localhost:11434/v1',
        apiKey: '',
        modelId: process.env['LLM_MODEL_ID'] || '',
        maxTokens: 16384,
      });
      return;
    }

    res.json(setting.value);
  } catch (err) {
    console.error('[LLM Settings] Get error:', err);
    res.status(500).json({ error: 'Failed to get LLM settings' });
  }
});

/**
 * PUT /api/llm-settings -- Update LLM configuration
 */
llmSettingsRoutes.put('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { endpointUrl, apiKey, modelId, maxTokens } = req.body as LLMConfig;

    const config: LLMConfig = {
      endpointUrl: endpointUrl || '',
      apiKey: apiKey || '',
      modelId: modelId || '',
      maxTokens: maxTokens || 16384,
    };

    const setting = await prisma.systemSetting.upsert({
      where: { key: LLM_SETTINGS_KEY },
      update: { value: config as any },
      create: { key: LLM_SETTINGS_KEY, value: config as any },
    });

    res.json(setting.value);
  } catch (err) {
    console.error('[LLM Settings] Update error:', err);
    res.status(500).json({ error: 'Failed to update LLM settings' });
  }
});

/**
 * POST /api/llm-settings/test -- Test LLM connection
 */
llmSettingsRoutes.post('/test', requireAuth, async (req: Request, res: Response) => {
  try {
    const { endpointUrl, apiKey, modelId } = req.body as LLMConfig;

    if (!endpointUrl) {
      res.status(400).json({ error: 'Endpoint URL is required' });
      return;
    }

    // Try fetching models list
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const modelsRes = await fetch(`${endpointUrl.replace(/\/$/, '')}/models`, { headers });

    if (!modelsRes.ok) {
      res.json({
        success: false,
        error: `HTTP ${modelsRes.status}: ${modelsRes.statusText}`,
      });
      return;
    }

    const models = await modelsRes.json() as { data?: { id: string }[] };
    const modelList = models.data?.map((m) => m.id) || [];
    const modelFound = modelId ? modelList.includes(modelId) : true;

    res.json({
      success: true,
      models: modelList.slice(0, 20),
      modelFound,
    });
  } catch (err) {
    res.json({
      success: false,
      error: err instanceof Error ? err.message : 'Connection failed',
    });
  }
});
