import { Router } from 'express';
import os from 'os';
import mongoose from 'mongoose';
import User from '../models/User';
import ApiKey from '../models/ApiKey';
import ChatHistory from '../models/ChatHistory';
import SystemError from '../models/SystemError';
import RedeemCode from '../models/RedeemCode';
import { encryptKey } from '../services/keyManager';
import { adminMiddleware, authMiddleware, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Apply adminMiddleware to all administrative routes
// Note: We will define user redeem route at the bottom WITHOUT adminMiddleware.

// 1. Users Panel: List all users
router.get('/users', adminMiddleware, async (req, res) => {
  try {
    const users = await User.find({}, { passwordHash: 0 }).sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// 1b. Users Panel: Update tier
router.post('/users/:userId/tier', adminMiddleware, async (req, res) => {
  try {
    const { tier } = req.body;
    if (!['Free', 'Unlimited', 'Admin'].includes(tier)) {
      return res.status(400).json({ error: 'Invalid account tier value' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { accountTier: tier },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user tier' });
  }
});

// 1c. Users Panel: Delete user
router.delete('/users/:userId', adminMiddleware, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// 2. Chats Panel: Metrics & list (non-incognito)
router.get('/chats/stats', adminMiddleware, async (req, res) => {
  try {
    const totalChats = await ChatHistory.countDocuments({});
    const incognitoChats = await ChatHistory.countDocuments({ isIncognito: true });
    const standardChats = await ChatHistory.countDocuments({ isIncognito: false });
    
    // Fetch last 50 chat records
    const recentChats = await ChatHistory.find({ isIncognito: false })
      .populate('userId', 'username email')
      .sort({ lastModified: -1 })
      .limit(50);

    res.json({
      totalChats,
      incognitoChats,
      standardChats,
      recentChats
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch chat statistics' });
  }
});

// 3. Errors Panel: Fetch log of system errors
router.get('/errors', adminMiddleware, async (req, res) => {
  try {
    const errors = await SystemError.find({})
      .populate('apiKeyId', 'modelFamily groupArea')
      .sort({ timestamp: -1 })
      .limit(100);
    res.json(errors);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch error logs' });
  }
});

// 4. Costs Panel: Estimate API cost based on key usages
router.get('/costs', adminMiddleware, async (req, res) => {
  try {
    const keys = await ApiKey.find({});
    
    // Estimate cost: e.g., average $0.0015 per usage count
    let totalUsageCount = 0;
    const costMap = keys.map(k => {
      totalUsageCount += k.usageCount;
      const estimatedCost = k.usageCount * 0.0015;
      return {
        keyId: k._id,
        modelFamily: k.modelFamily,
        groupArea: k.groupArea,
        usageCount: k.usageCount,
        estimatedCost
      };
    });

    res.json({
      totalUsageCount,
      estimatedTotalCost: totalUsageCount * 0.0015,
      breakdown: costMap
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch cost metrics' });
  }
});

// 5. Keys Panel: CRUD API Keys
router.get('/keys', adminMiddleware, async (req, res) => {
  try {
    const keys = await ApiKey.find({}).sort({ usageCount: -1 });
    res.json(keys);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

router.post('/keys', adminMiddleware, async (req, res) => {
  try {
    const { rawKey, modelFamily, groupArea } = req.body;
    if (!rawKey || !modelFamily || !groupArea) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const encrypted = encryptKey(rawKey);
    const newKey = new ApiKey({
      key: encrypted,
      modelFamily,
      groupArea,
      isActive: true,
      statusState: 'Active',
      usageCount: 0
    });

    await newKey.save();
    res.status(201).json(newKey);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save API key' });
  }
});

router.put('/keys/:id', adminMiddleware, async (req, res) => {
  try {
    const { modelFamily, groupArea, isActive, statusState } = req.body;
    const key = await ApiKey.findByIdAndUpdate(
      req.params.id,
      { modelFamily, groupArea, isActive, statusState },
      { new: true }
    );
    if (!key) return res.status(404).json({ error: 'Key not found' });
    res.json(key);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update API key' });
  }
});

router.post('/keys/:id/revive', adminMiddleware, async (req, res) => {
  try {
    const key = await ApiKey.findById(req.params.id);
    if (!key) return res.status(404).json({ error: 'Key not found' });

    key.statusState = 'Active';
    key.isActive = true;
    key.cooldownUntil = null;
    await key.save();

    res.json({ message: 'Key revived to Active status', key });
  } catch (err) {
    res.status(500).json({ error: 'Failed to revive API key' });
  }
});

router.delete('/keys/:id', adminMiddleware, async (req, res) => {
  try {
    const key = await ApiKey.findByIdAndDelete(req.params.id);
    if (!key) return res.status(404).json({ error: 'Key not found' });
    res.json({ message: 'Key deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});

// 6. Providers Panel: Group active keys by family
router.get('/providers', adminMiddleware, async (req, res) => {
  try {
    const distribution = await ApiKey.aggregate([
      {
        $group: {
          _id: '$modelFamily',
          totalKeys: { $sum: 1 },
          activeKeys: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } },
          deadKeys: { $sum: { $cond: [{ $eq: ['$statusState', 'Dead'] }, 1, 0] } },
          coolingDownKeys: { $sum: { $cond: [{ $eq: ['$statusState', 'CoolingDown'] }, 1, 0] } }
        }
      }
    ]);
    res.json(distribution);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch provider distributions' });
  }
});

// 7. Health Panel: Server latency, connection state, system loads
router.get('/health', adminMiddleware, async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    const dbStatus = ['Disconnected', 'Connected', 'Connecting', 'Disconnecting'][dbState] || 'Unknown';

    res.json({
      uptime: process.uptime(),
      dbStatus,
      ping: 'OK',
      loadAverage: os.loadavg(),
      platform: os.platform(),
      arch: os.arch()
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch health check metrics' });
  }
});

// 8. Logs Panel: Return formatted server log files or records
router.get('/logs', adminMiddleware, async (req, res) => {
  try {
    // Generate simulated structured server activity logs
    const mockLogs = [
      { timestamp: new Date(Date.now() - 2000).toISOString(), level: 'INFO', message: 'SSE connection initiated by client' },
      { timestamp: new Date(Date.now() - 5000).toISOString(), level: 'SUCCESS', message: 'Chat completion request parsed successfully' },
      { timestamp: new Date(Date.now() - 15000).toISOString(), level: 'INFO', message: 'Database cleaned expired cooling keys' },
      { timestamp: new Date(Date.now() - 45000).toISOString(), level: 'WARN', message: 'Rate limit threshold crossed: IP 127.0.0.1' },
      { timestamp: new Date(Date.now() - 120000).toISOString(), level: 'SUCCESS', message: 'User facts compiled for JohnDoe' }
    ];
    res.json(mockLogs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load logs' });
  }
});

// 9. Analytics: Key activation, popular families, user metrics
router.get('/analytics', adminMiddleware, async (req, res) => {
  try {
    // Breakdown of chats per model
    const popularity = await ApiKey.find({}, { modelFamily: 1, usageCount: 1 });
    res.json(popularity);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// 10. Rate Limits Panel: Configured parameters
router.get('/ratelimits', adminMiddleware, async (req, res) => {
  res.json({
    windowMs: process.env.RATE_LIMIT_WINDOW_MS || 900000,
    maxRequests: process.env.RATE_LIMIT_MAX_REQUESTS || 100,
    activeBlocks: [] // list of blocked IPs/tokens if redis/memory cache is utilized
  });
});

// 11. Storage Panel: Database collections sizes
router.get('/storage', adminMiddleware, async (req, res) => {
  try {
    const stats = await mongoose.connection.db.stats();
    res.json({
      dbName: stats.db,
      collectionsCount: stats.collections,
      objectsCount: stats.objects,
      avgObjectSize: stats.avgObjSize,
      dataSize: stats.dataSize,
      storageSize: stats.storageSize,
      indexSize: stats.indexSize
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve storage size metrics' });
  }
});

// 12. Memory Usage: RAM telemetry
router.get('/memory', adminMiddleware, async (req, res) => {
  const memory = process.memoryUsage();
  res.json({
    rss: memory.rss,
    heapTotal: memory.heapTotal,
    heapUsed: memory.heapUsed,
    external: memory.external,
    freeOSMemory: os.freemem(),
    totalOSMemory: os.totalmem()
  });
});

// 13. Redeem Codes Panel: Generate 5-digit alphanumeric code
router.post('/codes/generate', adminMiddleware, async (req, res) => {
  try {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing O/0, I/1
    let code = '';
    let exists = true;

    // Keep generating until unique
    while (exists) {
      code = '';
      for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const existing = await RedeemCode.findOne({ code });
      if (!existing) exists = false;
    }

    const newCode = new RedeemCode({ code });
    await newCode.save();

    res.status(201).json(newCode);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate redeem code' });
  }
});

// 13b. Redeem Codes Panel: Get all redeem codes
router.get('/codes', adminMiddleware, async (req, res) => {
  try {
    const codes = await RedeemCode.find({})
      .populate('redeemedBy', 'username email')
      .sort({ createdAt: -1 });
    res.json(codes);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch redeem codes' });
  }
});

// 13c. Redeem Codes Panel: Expire/Revoke a code
router.post('/codes/:id/expire', adminMiddleware, async (req, res) => {
  try {
    const codeDoc = await RedeemCode.findById(req.params.id);
    if (!codeDoc) {
      return res.status(404).json({ error: 'Code not found' });
    }

    codeDoc.isExpired = true;
    await codeDoc.save();

    // If already redeemed, demote user's tier back to 'Free'
    if (codeDoc.isRedeemed && codeDoc.redeemedBy) {
      await User.findByIdAndUpdate(codeDoc.redeemedBy, { accountTier: 'Free' });
    }

    res.json({ message: 'Redeem code expired, user access revoked', code: codeDoc });
  } catch (err) {
    res.status(500).json({ error: 'Failed to expire redeem code' });
  }
});

// --- USER-FACING PUBLIC ROUTE FOR REDEMPTION (Protected by user auth, NOT admin auth) ---

router.post('/redeem', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { code } = req.body;

    if (!code || code.length !== 5) {
      return res.status(400).json({ error: 'Invalid code format. Must be a 5-digit code.' });
    }

    const formattedCode = code.toUpperCase().trim();
    const codeDoc = await RedeemCode.findOne({ code: formattedCode });

    if (!codeDoc) {
      return res.status(404).json({ error: 'Redeem code not found' });
    }

    if (codeDoc.isRedeemed) {
      return res.status(400).json({ error: 'This code has already been redeemed' });
    }

    if (codeDoc.isExpired) {
      return res.status(400).json({ error: 'This code has expired' });
    }

    // Mark as redeemed
    codeDoc.isRedeemed = true;
    codeDoc.redeemedBy = req.user.id as any;
    codeDoc.redeemedAt = new Date();
    await codeDoc.save();

    // Promote user account to Unlimited
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { accountTier: 'Unlimited' },
      { new: true }
    );

    res.json({
      message: 'Code redeemed successfully! You now have Unlimited access.',
      user: {
        id: updatedUser?._id,
        username: updatedUser?.username,
        email: updatedUser?.email,
        accountTier: updatedUser?.accountTier,
        groupArea: updatedUser?.groupArea
      }
    });
  } catch (err) {
    console.error('Redeem error:', err);
    res.status(500).json({ error: 'Failed to redeem code' });
  }
});

export default router;
