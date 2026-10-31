import { Router } from 'express';
import Artifact from '../models/Artifact';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';

const router = Router();

// 1. Fetch all artifacts for a given conversation
router.get('/conversation/:conversationId', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { conversationId } = req.params;
    const artifacts = await Artifact.find({ conversationId }).sort({ lastModified: -1 });
    res.json(artifacts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch conversation artifacts' });
  }
});

// 2. Fetch single artifact details
router.get('/:conversationId/:artifactId', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { conversationId, artifactId } = req.params;
    const artifact = await Artifact.findOne({ conversationId, artifactId });
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }
    res.json(artifact);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch artifact details' });
  }
});

// 3. Update artifact content (saves previous content into versions array)
router.put('/:conversationId/:artifactId', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { conversationId, artifactId } = req.params;
    const { content, title } = req.body;

    if (content === undefined) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const artifact = await Artifact.findOne({ conversationId, artifactId });
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    // Only update and push to versions if the content is actually different
    if (artifact.content !== content) {
      artifact.versions.push({
        content: artifact.content,
        timestamp: new Date()
      });
      artifact.content = content;
    }

    if (title) {
      artifact.title = title;
    }

    artifact.lastModified = new Date();
    await artifact.save();

    res.json(artifact);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update artifact' });
  }
});

// 4. Manually trigger saving a version
router.post('/:conversationId/:artifactId/version', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { conversationId, artifactId } = req.params;

    const artifact = await Artifact.findOne({ conversationId, artifactId });
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    artifact.versions.push({
      content: artifact.content,
      timestamp: new Date()
    });

    artifact.lastModified = new Date();
    await artifact.save();

    res.json({ message: 'Version saved successfully', artifact });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save version' });
  }
});

export default router;
