import { Router } from 'express';
import UserProfile from '../models/UserProfile';
import User from '../models/User';
import ChatHistory from '../models/ChatHistory';
import Artifact from '../models/Artifact';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';

const router = Router();

// Get profile details (skills, facts, custom instructions)
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    let profile = await UserProfile.findOne({ userId: req.user.id });
    if (!profile) {
      profile = await UserProfile.create({
        userId: req.user.id,
        persistentFacts: [],
        agentsMd: '',
        enabledSkills: []
      });
    }

    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update skills (toggle skills list)
router.post('/skills', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { skills } = req.body; // array of string names

    if (!Array.isArray(skills)) {
      return res.status(400).json({ error: 'Skills must be an array of strings' });
    }

    const profile = await UserProfile.findOneAndUpdate(
      { userId: req.user.id },
      { enabledSkills: skills },
      { new: true, upsert: true }
    );

    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update skills' });
  }
});

// Update custom system instructions (agentsMd)
router.post('/instructions', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { instructions } = req.body;

    const profile = await UserProfile.findOneAndUpdate(
      { userId: req.user.id },
      { agentsMd: instructions || '' },
      { new: true, upsert: true }
    );

    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update system instructions' });
  }
});

// Add new memory fact manually
router.post('/facts', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { fact } = req.body;

    if (!fact || fact.trim() === '') {
      return res.status(400).json({ error: 'Fact is required' });
    }

    const profile = await UserProfile.findOne({ userId: req.user.id });
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    if (!profile.persistentFacts.includes(fact)) {
      profile.persistentFacts.push(fact);
      await profile.save();
    }

    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save fact' });
  }
});

// Delete a memory fact
router.delete('/facts', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { fact } = req.body;

    const profile = await UserProfile.findOne({ userId: req.user.id });
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    profile.persistentFacts = profile.persistentFacts.filter(f => f !== fact);
    await profile.save();

    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete fact' });
  }
});

// Nuke all user data (Delete Account)
router.delete('/nuke', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const userId = req.user.id;

    // Delete User profile details, chat records, and artifacts
    await UserProfile.deleteOne({ userId });
    await ChatHistory.deleteMany({ userId });
    
    // Find chats to get their IDs and clean up artifacts
    const userChats = await ChatHistory.find({ userId });
    const chatIds = userChats.map(c => c.conversationId);
    await Artifact.deleteMany({ conversationId: { $in: chatIds } });

    // Delete user from base records
    await User.deleteOne({ _id: userId });

    res.json({ message: 'All user data and account records successfully deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user account data' });
  }
});

export default router;
