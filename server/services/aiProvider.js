












const axios = require('axios');
const { AGENT_SYSTEM_SUFFIX } = require('./agentActions');
const { sanitizeCompletion } = require('./completionSanitize');

const PROVIDERS = {
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    keyVar: 'GROQ_API_KEY',
    modelVar: 'GROQ_MODEL',
    defaultModel: 'openai/gpt-oss-120b',
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    keyVar: 'GEMINI_API_KEY',
    modelVar: 'GEMINI_MODEL',
    
    
    defaultModel: 'gemini-3.8-flash',
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    keyVar: 'OPENAI_API_KEY',
    modelVar: 'OPENAI_MODEL',
    defaultModel: 'gpt-4o-mini',
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    keyVar: 'DEEPSEEK_API_KEY',
    modelVar: 'DEEPSEEK_MODEL',
    defaultModel: 'deepseek-chat',
  },
};

function getProviderConfig() {
  const name = String(process.env.AI_PROVIDER || 'groq').toLowerCase().trim();
  const preset = PROVIDERS[name];
  if (!preset) {
    throw new Error(
      `Unknown AI_PROVIDER "${process.env.AI_PROVIDER}". Use one of: ${Object.keys(PROVIDERS).join(', ')}.`
    );
  }
  const apiKey = String(process.env[preset.keyVar] || '').trim();
  if (!apiKey || apiKey.startsWith('replace_with')) {
    throw new Error(
      `${preset.keyVar} is missing or still a placeholder in server/.env. ` +
        `Set AI_PROVIDER=${name} and add your ${preset.keyVar}.`
    );
  }
  return {
    name,
    baseUrl: preset.baseUrl,
    apiKey,
    model: String(process.env[preset.modelVar] || preset.defaultModel).trim(),
    temperature: Number(process.env.AI_TEMPERATURE || process.env.GROQ_TEMPERATURE || 0.2),
    maxTokens: Number(process.env.AI_MAX_TOKENS || process.env.GROQ_MAX_TOKENS || 1024),
  };
}

function truncateText(value, maxLength) {
  const text = String(value || '');
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}\n\n...[truncated]`;
}

function buildContextBlock(context = {}) {
  const activeFile = context.activeFile || null;
  const fileSummaries = Array.isArray(context.files) ? context.files : [];

  const fileList = fileSummaries
    .slice(0, 30)
    .map((file) => `- ${file.name}${file.id === activeFile?.id ? ' (active)' : ''}`)
    .join('\n');

  if (!activeFile) {
    return fileList ? `Workspace files:\n${fileList}` : 'No code context was provided.';
  }

  return [
    `Active file: ${activeFile.name}`,
    '',
    fileList ? `Workspace files:\n${fileList}` : 'Workspace files: unavailable',
    '',
    'Active file content:',
    '```',
    truncateText(activeFile.content, 12000),
    '```',
  ].join('\n');
}

function buildMessages({ message, history = [], context = {}, agent = false }) {
  const safeHistory = Array.isArray(history)
    ? history
        .filter((entry) => entry && (entry.role === 'user' || entry.role === 'assistant'))
        .slice(-8)
        .map((entry) => ({
          role: entry.role,
          content: truncateText(entry.content, 4000),
        }))
    : [];

  const systemIntro = [
    'You are Neura, an AI coding assistant inside Synapse.',
    'Help with code understanding, debugging, refactoring, architecture, and tests.',
    'Be concise, practical, and specific.',
    'When code context is provided, ground your answer in it instead of making assumptions.',
    'If context is missing, say what is missing and still provide the most useful next step.',
  ].join(' ');

  return [
    {
      role: 'system',
      content: agent ? `${systemIntro}\n\n${AGENT_SYSTEM_SUFFIX}` : systemIntro,
    },
    {
      role: 'system',
      content: buildContextBlock(context),
    },
    ...safeHistory,
    {
      role: 'user',
      content: truncateText(message, 4000),
    },
  ];
}

async function requestAIChat({ message, history, context, agent = false }) {
  const cfg = getProviderConfig();

  const response = await axios.post(
    cfg.baseUrl,
    {
      model: cfg.model,
      temperature: cfg.temperature,
      max_tokens: cfg.maxTokens,
      messages: buildMessages({ message, history, context, agent }),
    },
    {
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      
      proxy: false,
      timeout: 45000,
    }
  );

  return (
    response.data?.choices?.[0]?.message?.content?.trim() ||
    'I could not generate a response for that request.'
  );
}

const COMPLETION_SYSTEM_PROMPT = [
  'You are a code completion engine inside an IDE.',
  'You receive code before and after the cursor.',
  'Output ONLY the code that belongs at the cursor — no explanations,',
  'no markdown fences, no repeating the surrounding code.',
  'Keep it short (at most ~6 lines).',
  'If nothing sensible completes the code, output nothing.',
].join(' ');









async function requestAICompletion({ prefix, suffix, language }) {
  const cfg = getProviderConfig();

  const userPrompt = [
    `Language: ${String(language || 'plaintext')}`,
    '<code_before_cursor>',
    String(prefix || ''),
    '</code_before_cursor>',
    '<code_after_cursor>',
    String(suffix || ''),
    '</code_after_cursor>',
    'Write the completion:',
  ].join('\n');

  const response = await axios.post(
    cfg.baseUrl,
    {
      model: cfg.model,
      temperature: 0.15,
      max_tokens: 160,
      messages: [
        { role: 'system', content: COMPLETION_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      
      proxy: false,
      timeout: 20000,
    }
  );

  const raw = response.data?.choices?.[0]?.message?.content || '';
  return sanitizeCompletion(raw, prefix);
}

module.exports = {
  requestAIChat,
  
  
  
  requestAICompletion,
  
  requestGroqChat: requestAIChat,
  getProviderConfig,
  PROVIDERS,
};
