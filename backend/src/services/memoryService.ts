import UserProfile from '../models/UserProfile';
import { getBestKey, decryptKey, incrementKeyUsage, handleKeyError } from './keyManager';

// Key skill prompt modifiers
export const SKILL_MODIFIERS: Record<string, string> = {
  Conciseness: 'Provide extremely short, concise, and direct answers. Avoid verbose explanations or introductory filler.',
  Refactoring: 'Focus on clean code, optimization, modularity, refactoring, and explaining design patterns.',
  'Code generation': 'Write production-ready, fully commented code with error handling. Specify language and keep code blocks isolated.',
  'Research mode': 'Approach the prompt with deep academic research. List structural analyses and logical steps.',
  'Writing mode': 'Use elegant, engaging, and professional writing styles. Focus on narrative flow, grammar, and clear structure.',
  'Data mode': 'Structure responses around data analytics. Use markdown tables, statistics, and highly structured JSON/CSV formats.',
  'Language mode': 'Provide multilingual insights, precise translation notes, and grammar explanations.',
  'Ops mode': 'Focus on DevOps, containerization, scripting, configuration, CI/CD, and system administration best practices.'
};

// Retrieve custom instructions, skills, and memory facts to construct the prompt context
export async function getSystemPrompt(userId: string): Promise<string> {
  let systemPrompt = 'You are NoTokenLimit, an advanced, context-aware AI coding and workspace assistant.\n';

  // Get user profile details
  const profile = await UserProfile.findOne({ userId });
  if (profile) {
    // 1. Inject persistent facts
    if (profile.persistentFacts && profile.persistentFacts.length > 0) {
      systemPrompt += '\nRelevant facts about the user (Memory):\n';
      profile.persistentFacts.forEach(fact => {
        systemPrompt += `- ${fact}\n`;
      });
    }

    // 2. Inject skill modifiers
    if (profile.enabledSkills && profile.enabledSkills.length > 0) {
      systemPrompt += '\nActive skill modifiers:\n';
      profile.enabledSkills.forEach(skill => {
        if (SKILL_MODIFIERS[skill]) {
          systemPrompt += `- ${SKILL_MODIFIERS[skill]}\n`;
        }
      });
    }

    // 3. Inject custom user instructions (agentsMd)
    if (profile.agentsMd && profile.agentsMd.trim() !== '') {
      systemPrompt += `\nCustom System Instructions:\n${profile.agentsMd}\n`;
    }
  }

  // 4. Inject Artifact Generation Instructions
  systemPrompt += `
\nIMPORTANT - ARTIFACT GENERATION RULES:
When the user asks you to write code, design sheets, or create long documents, you MUST generate them inside special markup tags so that the UI can render them in the right-hand panel.
Choose ONE of the following formats based on the output type:

1. For long documents or reports:
[artifact-doc title="Document Title" id="doc-unique-id"]
Content of the document...
[/artifact-doc]

2. For spreadsheet data (rows and columns must be tab-separated or comma-separated, with headers):
[artifact-sheet title="Sheet Title" id="sheet-unique-id"]
Header 1,Header 2,Header 3
Row1Val1,Row1Val2,Row1Val3
Row2Val1,Row2Val2,Row2Val3
[/artifact-sheet]

3. For technical markdown files, documentation, or multi-file coding structures:
[artifact-markdown title="Markdown Title" id="markdown-unique-id"]
Content of the markdown file...
[/artifact-markdown]

Always wrap structured or long-form items in these tags. Keep the ID lowercase and unique.
`;

  return systemPrompt;
}

// Background task to extract user facts using a valid API key
export async function extractUserFacts(userId: string, userMessage: string, modelFamily: string, groupArea: string): Promise<void> {
  // Simple heuristic: only trigger LLM check if there's self-referential words
  const lowerMsg = userMessage.toLowerCase();
  const keywords = ['i am', 'i code', 'i live', 'my name', 'my favorite', 'i work', 'i have', 'i prefer'];
  const potentialFact = keywords.some(keyword => lowerMsg.includes(keyword));
  if (!potentialFact) return;

  try {
    const keyDoc = await getBestKey(modelFamily, groupArea);
    if (!keyDoc) return;

    const apiKey = decryptKey(keyDoc.key);
    const baseUrl = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';

    const extractionPrompt = `Analyze the following user input and extract any stable long-term facts about the user (e.g. name, location, role, coding language preferences, favorite things).
Format: Output each fact on a new line starting with a bullet point. Example: "- User lives in Boston".
If no new long-term personal facts are found, output ONLY the word "NONE".

User Input: "${userMessage}"

Extracted Facts:`;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: process.env.DEFAULT_MODEL || 'meta/llama-3.1-70b-instruct',
        messages: [{ role: 'user', content: extractionPrompt }],
        temperature: 0.1,
        max_tokens: 150
      })
    });

    if (response.status === 429) {
      await handleKeyError(keyDoc._id as string, '429', 'Extraction rate limit', userId);
      return;
    }
    if (response.status === 401 || response.status === 403) {
      await handleKeyError(keyDoc._id as string, '401', 'Extraction auth error', userId);
      return;
    }

    if (!response.ok) return;

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content?.trim();

    if (result && result !== 'NONE' && !result.includes('NONE')) {
      const lines = result
        .split('\n')
        .map((l: string) => l.replace(/^-\s*/, '').trim())
        .filter((l: string) => l.length > 3);

      if (lines.length > 0) {
        const profile = await UserProfile.findOne({ userId });
        if (profile) {
          const currentFacts = new Set(profile.persistentFacts);
          lines.forEach((line: string) => currentFacts.add(line));
          profile.persistentFacts = Array.from(currentFacts);
          await profile.save();
          console.log(`Extracted new facts for user ${userId}:`, lines);
        }
      }
    }

    await incrementKeyUsage(keyDoc._id as string);
  } catch (err) {
    console.error('Error extracting user facts:', err);
  }
}
