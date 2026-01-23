/**
 * Models Routes
 *
 * CRUD operations for LLM models management
 */

import { Router } from 'express';
import { prisma } from '../index.js';

export const modelsRoutes = Router();

/**
 * GET /models
 * List all models
 */
modelsRoutes.get('/', async (_req, res) => {
  try {
    const models = await prisma.model.findMany({
      orderBy: { displayName: 'asc' },
    });

    res.json({ models });
  } catch (error) {
    console.error('List models error:', error);
    res.status(500).json({ error: 'Failed to list models' });
  }
});

/**
 * GET /models/:id
 * Get model by ID
 */
modelsRoutes.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const model = await prisma.model.findUnique({
      where: { id },
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
 * POST /models
 * Create new model
 */
modelsRoutes.post('/', async (req, res) => {
  try {
    const { name, displayName, endpointUrl, apiKey, maxTokens, enabled } = req.body;

    if (!name || !displayName || !endpointUrl) {
      res.status(400).json({ error: 'name, displayName, and endpointUrl are required' });
      return;
    }

    const model = await prisma.model.create({
      data: {
        name,
        displayName,
        endpointUrl,
        apiKey: apiKey || null,
        maxTokens: maxTokens || 4096,
        enabled: enabled !== false,
      },
    });

    res.status(201).json({ model });
  } catch (error) {
    console.error('Create model error:', error);
    res.status(500).json({ error: 'Failed to create model' });
  }
});

/**
 * PUT /models/:id
 * Update model
 */
modelsRoutes.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, displayName, endpointUrl, apiKey, maxTokens, enabled } = req.body;

    const model = await prisma.model.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(displayName && { displayName }),
        ...(endpointUrl && { endpointUrl }),
        ...(apiKey !== undefined && { apiKey }),
        ...(maxTokens !== undefined && { maxTokens }),
        ...(enabled !== undefined && { enabled }),
      },
    });

    res.json({ model });
  } catch (error) {
    console.error('Update model error:', error);
    res.status(500).json({ error: 'Failed to update model' });
  }
});

/**
 * DELETE /models/:id
 * Delete model
 */
modelsRoutes.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.model.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete model error:', error);
    res.status(500).json({ error: 'Failed to delete model' });
  }
});

/**
 * PATCH /models/:id/toggle
 * Toggle model enabled status
 */
modelsRoutes.patch('/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;

    const model = await prisma.model.findUnique({
      where: { id },
    });

    if (!model) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }

    const updated = await prisma.model.update({
      where: { id },
      data: { enabled: !model.enabled },
    });

    res.json({ model: updated });
  } catch (error) {
    console.error('Toggle model error:', error);
    res.status(500).json({ error: 'Failed to toggle model' });
  }
});
