import { Router, Response } from 'express';
import crypto from 'crypto';
import ChatHistory, { IMessage } from '../models/ChatHistory';
import UserProfile from '../models/UserProfile';
import Artifact from '../models/Artifact';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';
import { getBestKey, decryptKey, incrementKeyUsage, handleKeyError } from '../services/keyManager';
import { getSystemPrompt, extractUserFacts } from '../services/memoryService';

const router = Router();

// 1. Get all conversations (excluding messages for speed, unless requested)
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const chats = await ChatHistory.find(
      { userId: req.user.id },
      { messages: 0 } // Exclude messages for initial sidebar fetch
    ).sort({ lastModified: -1 });

    res.json(chats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// 2. Search conversations (filter by title or message contents, exclude incognito)
router.get('/search', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { q } = req.query;
    if (!q) return res.json([]);

    const queryStr = q.toString();
    const chats = await ChatHistory.find({
      userId: req.user.id,
      isIncognito: false,
      $or: [
        { title: { $regex: queryStr, $options: 'i' } },
        { 'messages.content': { $regex: queryStr, $options: 'i' } }
      ]
    }).limit(15);

    res.json(chats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to search conversations' });
  }
});

// 3. Get single conversation details with messages
router.get('/:conversationId', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const chat = await ChatHistory.findOne({
      userId: req.user.id,
      conversationId: req.params.conversationId
    });

    if (!chat) return res.status(404).json({ error: 'Conversation not found' });
    res.json(chat);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// 4. Create new conversation
router.post('/new', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { title, isIncognito } = req.body;

    const conversationId = crypto.randomUUID();
    const newChat = new ChatHistory({
      userId: req.user.id,
      conversationId,
      title: title || 'New Conversation',
      isIncognito: !!isIncognito,
      messages: []
    });

    await newChat.save();
    res.status(201).json(newChat);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// 5. Rename conversation
router.patch('/:conversationId/rename', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { title } = req.body;

    if (!title || title.trim() === '') {
      return res.status(400).json({ error: 'Title is required' });
    }

    const chat = await ChatHistory.findOneAndUpdate(
      { userId: req.user.id, conversationId: req.params.conversationId },
      { title, lastModified: new Date() },
      { new: true }
    );

    if (!chat) return res.status(404).json({ error: 'Conversation not found' });
    res.json(chat);
  } catch (err) {
    res.status(500).json({ error: 'Failed to rename conversation' });
  }
});

// 6. Delete conversation
router.delete('/:conversationId', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const chat = await ChatHistory.findOneAndDelete({
      userId: req.user.id,
      conversationId: req.params.conversationId
    });

    if (!chat) return res.status(404).json({ error: 'Conversation not found' });

    // Clean up associated artifacts
    await Artifact.deleteMany({ conversationId: req.params.conversationId });

    res.json({ message: 'Conversation deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// 7. Stream chat completion with SSE & Key Rotation proxy logic
router.post('/:conversationId/stream', authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const { conversationId } = req.params;
  const { message, modelLabel, isIncognito } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Map user-facing model label to backend model family
  const modelFamily = mapLabelToFamily(modelLabel);

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Retrieve user history (if not incognito) to pass as conversation context
  let historyMessages: IMessage[] = [];
  if (!isIncognito) {
    const chat = await ChatHistory.findOne({ conversationId, userId: req.user.id });
    if (chat) {
      historyMessages = chat.messages;
    }
  }

  // Get active system prompt with memory facts & skills
  const systemPrompt = await getSystemPrompt(req.user.id);

  // Build the message payload for AI API request
  const requestMessages = [
    { role: 'system', content: systemPrompt },
    ...historyMessages.map(msg => ({ role: msg.role, content: msg.content })),
    { role: 'user', content: message }
  ];

  // Try streaming completion with key rotation and automatic retry logic
  const streamResultText = await performStreamRequest(
    modelFamily,
    req.user.groupArea,
    requestMessages,
    res,
    req.user.id,
    0 // Attempt counter
  );

  // Save conversation exchanges if incognito mode is false and streaming finished successfully
  if (streamResultText && !isIncognito) {
    try {
      const chat = await ChatHistory.findOne({ conversationId, userId: req.user.id });
      if (chat) {
        chat.messages.push({ role: 'user', content: message, timestamp: new Date() });
        chat.messages.push({ role: 'assistant', content: streamResultText, timestamp: new Date() });
        chat.lastModified = new Date();
        await chat.save();
      }
    } catch (err) {
      console.error('Failed saving message logs to database:', err);
    }

    // Trigger asynchronous memory facts extraction in the background
    extractUserFacts(req.user.id, message, modelFamily, req.user.groupArea);

    // Scan the response for artifacts and save them to the DB automatically
    scanAndSaveArtifacts(conversationId, streamResultText);
  }
});

// Helper to map UI labels to backend families
function mapLabelToFamily(label: string): string {
  const map: Record<string, string> = {
    'DeepSeek R1': 'DeepSeek',
    'DeepSeek Coder': 'DeepSeek',
    'ChatGPT-4o': 'Llama', // Mock/proxy family routing
    'Qwen 2.5': 'Qwen',
    'Mistral Large': 'Mistral',
    'Nemotron 70B': 'Nemotron',
    'MiniMax': 'MiniMax',
    'GLM-4': 'GLM'
  };
  return map[label] || 'Llama';
}

// Map family name to the exact model provider ID (e.g. NVIDIA NIM model tags)
function getExactModelName(family: string): string {
  const models: Record<string, string> = {
    DeepSeek: 'deepseek-ai/deepseek-r1',
    Llama: 'meta/llama-3.1-70b-instruct',
    Qwen: 'qwen/qwen-2.5-coder-32b-instruct',
    Mistral: 'mistralai/mistral-large-2-instruct',
    Nemotron: 'nvidia/llama-3.1-nemotron-70b-instruct',
    MiniMax: 'minimax/abab6.5s',
    GLM: 'thm/glm-4-9b-chat'
  };
  return models[family] || 'meta/llama-3.1-70b-instruct';
}

// Master request proxy with failover & retry key rotation
async function performStreamRequest(
  modelFamily: string,
  groupArea: string,
  messages: any[],
  res: Response,
  userId: string,
  attempt: number
): Promise<string | null> {
  if (attempt >= 5) {
    res.write(`data: ${JSON.stringify({ error: 'All configured API keys for this model family are exhausted or cooling down. Please contact the administrator.' })}\n\n`);
    res.end();
    return null;
  }

  // 1. Fetch best key
  const keyDoc = await getBestKey(modelFamily, groupArea);
  if (!keyDoc) {
    // If no key found for current family, fall back to default group Llama key as a last resort
    if (modelFamily !== 'Llama') {
      return performStreamRequest('Llama', groupArea, messages, res, userId, attempt + 1);
    }
    res.write(`data: ${JSON.stringify({ error: 'No active API keys found for this group area. Please check the Admin Dashboard.' })}\n\n`);
    res.end();
    return null;
  }

  const decryptedKey = decryptKey(keyDoc.key);
  const baseUrl = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';
  const modelName = getExactModelName(modelFamily);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${decryptedKey}`,
        Accept: 'text/event-stream'
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        stream: true,
        max_tokens: 4096
      })
    });

    // Handle Failover statuses
    if (response.status === 429) {
      await handleKeyError(keyDoc._id as string, '429', 'Rate limit status 429', userId);
      return performStreamRequest(modelFamily, groupArea, messages, res, userId, attempt + 1);
    }
    if (response.status === 401 || response.status === 403) {
      await handleKeyError(keyDoc._id as string, '401', 'Auth credentials error', userId);
      return performStreamRequest(modelFamily, groupArea, messages, res, userId, attempt + 1);
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI Provider response not OK: ${response.status} - ${errText}`);
    }

    // Key succeeded, increment its usage safely
    await incrementKeyUsage(keyDoc._id as string);

    // Read the stream and pipe back to user via SSE
    const reader = response.body;
    if (!reader) {
      throw new Error('AI Response body is null');
    }

    let fullOutput = '';
    const decoder = new TextDecoder();

    // Loop through response body chunks
    for await (const chunk of reader as any) {
      const chunkStr = decoder.decode(chunk);
      const lines = chunkStr.split('\n');

      for (const line of lines) {
        const cleaned = line.trim();
        if (cleaned === '' || cleaned === 'data: [DONE]') continue;

        if (cleaned.startsWith('data: ')) {
          try {
            const dataJson = JSON.parse(cleaned.substring(6));
            const delta = dataJson.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullOutput += delta;
              // Stream word delta back to user
              res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
            }
          } catch (e) {
            // Ignore partial lines
          }
        }
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
    return fullOutput;

  } catch (err: any) {
    console.error(`Stream attempt ${attempt} failed:`, err.message);
    // On unexpected HTTP throw, trigger cooling down to be safe and retry
    await handleKeyError(keyDoc._id as string, '429', err.message, userId);
    return performStreamRequest(modelFamily, groupArea, messages, res, userId, attempt + 1);
  }
}

// Scan completion output for structured artifacts and save/update them in MongoDB
async function scanAndSaveArtifacts(conversationId: string, text: string) {
  // Regex to match artifact block tags: [artifact-doc/sheet/markdown title="T" id="I"]content[/artifact-...]
  const artifactRegex = /\[artifact-(doc|sheet|markdown)\s+title="([^"]+)"\s+id="([^"]+)"\]([\s\S]*?)\[\/artifact-\1\]/g;
  let match;

  while ((match = artifactRegex.exec(text)) !== null) {
    const rawType = match[1];
    const title = match[2];
    const artifactId = match[3];
    const content = match[4].trim();

    const type = rawType === 'doc' ? 'Document' : rawType === 'sheet' ? 'Sheet' : 'Markdown';

    try {
      const existing = await Artifact.findOne({ conversationId, artifactId });
      if (existing) {
        // If content changed, save a new version and update
        if (existing.content !== content) {
          existing.versions.push({ content: existing.content, timestamp: new Date() });
          existing.content = content;
          existing.lastModified = new Date();
          await existing.save();
        }
      } else {
        // Create new
        await Artifact.create({
          conversationId,
          artifactId,
          title,
          type,
          content,
          versions: [],
          lastModified: new Date()
        });
      }
    } catch (err) {
      console.error('Error saving scanned artifact:', err);
    }
  }
}

export default router;
