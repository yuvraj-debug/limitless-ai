import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import UserProfile from '../models/UserProfile';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_no_token_limit_2026';

// Group areas list for load balancing
const GROUPS = ['group-A', 'group-B', 'group-C'];

// Helper to find the group area with the fewest users
async function getBalancedGroup(): Promise<string> {
  const counts = await Promise.all(
    GROUPS.map(async (group) => {
      const count = await User.countDocuments({ groupArea: group });
      return { group, count };
    })
  );

  // Sort groups by count ascending and pick the smallest
  counts.sort((a, b) => a.count - b.count);
  return counts[0].group;
}

// Helper to sign JWT
function generateToken(user: any): string {
  return jwt.sign(
    {
      id: user._id,
      username: user.username,
      email: user.email,
      accountTier: user.accountTier,
      groupArea: user.groupArea
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// User Signup
router.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already in use' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Get balanced group
    const groupArea = await getBalancedGroup();

    // Check if it's the first user - if so, make them an Admin! (Makes local testing incredibly easy)
    const totalUsers = await User.countDocuments({});
    const accountTier = totalUsers === 0 ? 'Admin' : 'Free';

    // Create user
    const newUser = new User({
      username,
      email,
      passwordHash,
      accountTier,
      groupArea
    });

    await newUser.save();

    // Initialize profile
    await UserProfile.create({
      userId: newUser._id,
      persistentFacts: [],
      agentsMd: '',
      enabledSkills: []
    });

    const token = generateToken(newUser);

    res.status(201).json({
      token,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        accountTier: newUser.accountTier,
        groupArea: newUser.groupArea
      }
    });
  } catch (err: any) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Signup failed. Please try again.' });
  }
});

// User Login
router.post('/login', async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;

    if (!usernameOrEmail || !password) {
      return res.status(400).json({ error: 'Username/email and password are required' });
    }

    // Find user
    const user = await User.findOne({
      $or: [
        { email: usernameOrEmail.toLowerCase() },
        { username: usernameOrEmail }
      ]
    });

    if (!user || !user.passwordHash) {
      return res.status(400).json({ error: 'Invalid login credentials' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid login credentials' });
    }

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        accountTier: user.accountTier,
        groupArea: user.groupArea
      }
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// Fetch Current User Profile Details
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      accountTier: user.accountTier,
      groupArea: user.groupArea
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user state' });
  }
});

// --- DISCORD OAUTH CHANNELS ---

// Discord redirect URL builder
router.get('/discord', (req, res) => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.DISCORD_REDIRECT_URI || '');

  // If credentials are placeholders, trigger simulated callback to make local testing work immediately!
  if (!clientId || clientId === 'placeholder_id') {
    console.log('Using simulated Discord OAuth fallback...');
    return res.redirect(`/api/auth/discord/mock-callback`);
  }

  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify%20email`;
  res.redirect(discordAuthUrl);
});

// Simulated Discord login (extremely useful when environment keys are not configured yet)
router.get('/discord/mock-callback', async (req, res) => {
  try {
    // Scaffold a test user "DiscordUser"
    const randomId = Math.floor(1000 + Math.random() * 9000);
    const mockDiscordId = `discord_${randomId}`;
    const email = `discord_user_${randomId}@discord.com`;
    const username = `DiscordGamer_${randomId}`;

    let user = await User.findOne({ discordId: mockDiscordId });
    if (!user) {
      // Create user
      const groupArea = await getBalancedGroup();
      const totalUsers = await User.countDocuments({});
      const accountTier = totalUsers === 0 ? 'Admin' : 'Free';

      user = new User({
        username,
        email,
        discordId: mockDiscordId,
        accountTier,
        groupArea
      });
      await user.save();

      await UserProfile.create({
        userId: user._id,
        persistentFacts: [],
        agentsMd: '',
        enabledSkills: []
      });
    }

    const token = generateToken(user);
    // Redirect to frontend dashboard with token URL parameter
    res.redirect(`http://localhost:5173/?token=${token}`);
  } catch (err) {
    console.error('Mock Discord callback failed:', err);
    res.redirect('http://localhost:5173/auth?error=discord_failed');
  }
});

// Actual Discord OAuth Callback handler
router.get('/discord/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.redirect('http://localhost:5173/auth?error=no_code');
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI || '';

  try {
    // 1. Exchange OAuth code for access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: clientId || '',
        client_secret: clientSecret || '',
        grant_type: 'authorization_code',
        code: code.toString(),
        redirect_uri: redirectUri,
        scope: 'identify email'
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!tokenResponse.ok) {
      throw new Error('Discord code exchange failed');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // 2. Fetch User Profile from Discord API
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!userResponse.ok) {
      throw new Error('Failed to fetch Discord user details');
    }

    const discordUser = await userResponse.json();
    const discordId = discordUser.id;
    const email = discordUser.email || `${discordUser.username}_${discordId}@discord.com`;
    const username = discordUser.username;

    // 3. Register or log in
    let user = await User.findOne({ $or: [{ discordId }, { email }] });
    if (!user) {
      const groupArea = await getBalancedGroup();
      const totalUsers = await User.countDocuments({});
      const accountTier = totalUsers === 0 ? 'Admin' : 'Free';

      user = new User({
        username,
        email,
        discordId,
        accountTier,
        groupArea
      });
      await user.save();

      await UserProfile.create({
        userId: user._id,
        persistentFacts: [],
        agentsMd: '',
        enabledSkills: []
      });
    } else if (!user.discordId) {
      // If user signed up with email first, associate Discord profile
      user.discordId = discordId;
      await user.save();
    }

    const token = generateToken(user);
    // Redirect to frontend dashboard with token
    res.redirect(`http://localhost:5173/?token=${token}`);
  } catch (err) {
    console.error('Discord callback failed:', err);
    res.redirect('http://localhost:5173/auth?error=discord_failed');
  }
});

export default router;
