/**
 * Models Routes
 *
 * Public endpoints for getting available models
 */

import { Router } from 'express';
import { prisma } from '../index.js';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';

export const modelsRoutes = Router();

/**
 * GET /models
 * Get list of enabled models (for CLI users)
 */
modelsRoutes.get('/', authenticateToken, async (_req: AuthenticatedRequest, res) => {
  try {
    const models = await prisma.model.findMany({
      where: { enabled: true },
      select: {
        id: true,
        name: true,
        displayName: true,
        endpointUrl: true,
        maxTokens: true,
        // Don't include API key for CLI users
      },
      orderBy: { displayName: 'asc' },
    });

    res.json({ models });
  } catch (error) {
    console.error('Get models error:', error);
    res.status(500).json({ error: 'Failed to get models' });
  }
});

/**
 * GET /models/:id
 * Get specific model details
 */
modelsRoutes.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const model = await prisma.model.findUnique({
      where: { id, enabled: true },
      select: {
        id: true,
        name: true,
        displayName: true,
        endpointUrl: true,
        maxTokens: true,
      },
    });

    if (!model) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }

    res.json({ model });
  } catch (error) {
    console.error('Get model error:', error);
    res.status(500).json({ error: 'Failed to get model' });
  }
});

/**
 * GET /models/:id/config
 * Get model configuration for CLI (includes API key)
 * This endpoint should be secured with additional verification
 */
modelsRoutes.get('/:id/config', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const model = await prisma.model.findUnique({
      where: { id, enabled: true },
    });

    if (!model) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }

    // Return full config including API key for CLI usage
    res.json({
      model: {
        id: model.id,
        name: model.name,
        displayName: model.displayName,
        endpointUrl: model.endpointUrl,
        apiKey: model.apiKey, // Encrypted in DB, decrypt in production
        maxTokens: model.maxTokens,
      },
    });
  } catch (error) {
    console.error('Get model config error:', error);
    res.status(500).json({ error: 'Failed to get model config' });
  }
});
