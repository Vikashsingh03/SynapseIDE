const express = require('express');
const mongoose = require('mongoose');
const authMiddleware = require('../middleware/auth');
const { aiChatLimiter } = require('../middleware/rateLimits');
const { requestAIChat, requestAICompletion } = require('../services/aiProvider');
const { buildCommitPrompt, cleanCommitMessage } = require('../services/commitPrompt');
const { buildReadmePrompt, cleanReadmeMarkdown } = require('../services/readmePrompt');
const { extractAgentActions } = require('../services/agentActions');
const Conversation = require('../models/Conversation');
const AIMessage = require('../models/AIMessage');

const router = express.Router();

function ensureDatabaseReady(res) {
  if (mongoose.connection.readyState === 1) {
    return true;
  }

  res.status(503).json({
    error: 'AI chat is temporarily unavailable because the database is disconnected.',
  });
  return false;
}

function normalizeMessage(message) {
  return String(message || '').trim();
}

function buildConversationTitle(message) {
  const normalized = normalizeMessage(message).replace(/\s+/g, ' ');
  if (!normalized) {
    return 'New Chat';
  }

  return normalized.slice(0, 48);
}

async function getOwnedConversation(conversationId, userId) {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    return null;
  }

  return Conversation.findOne({
    _id: conversationId,
    userId,
  });
}

router.use(authMiddleware);





 
const completionLastCall = new Map();
const COMPLETION_MIN_GAP_MS = 300;

function completionThrottleOk(userId) {
  const now = Date.now();
  const last = completionLastCall.get(userId) || 0;
  if (now - last < COMPLETION_MIN_GAP_MS) return false;
  completionLastCall.set(userId, now);
  return true;
}

router.post('/complete', async (req, res) => {
  try {
    const { prefix, suffix, language } = req.body || {};

    if (typeof prefix !== 'string' || prefix.length === 0) {
      return res.status(400).json({ error: 'A code prefix is required.' });
    }

    const userId = (req.user && (req.user.userId || req.user.id)) || 'anonymous';
    if (!completionThrottleOk(userId)) {
      
      
      return res.json({ completion: '' });
    }

    
    const safePrefix = prefix.length > 8000 ? prefix.slice(-4000) : prefix;
    const safeSuffix = typeof suffix === 'string' ? suffix.slice(0, 1500) : '';
    const safeLanguage =
      typeof language === 'string' ? language.slice(0, 40) : 'plaintext';

    const completion = await requestAICompletion({
      prefix: safePrefix,
      suffix: safeSuffix,
      language: safeLanguage,
    });

    return res.json({ completion: completion || '' });
  } catch (error) {
    console.error('AI completion error:', error.response?.data || error.message);
    return res.status(502).json({
      error:
        error.response?.data?.error?.message ||
        error.message ||
        'Completion failed.',
    });
  }
});

router.post('/commit-message', async (req, res) => {
  try {
    const { files, diff } = req.body || {};
    const safeDiff = typeof diff === 'string' ? diff : '';
    if (!safeDiff.trim()) {
      return res.status(400).json({ error: 'A diff of the changes is required.' });
    }
    const safeFiles = Array.isArray(files)
      ? files.filter((f) => typeof f === 'string' && f.trim()).slice(0, 100)
      : [];
    const prompt = buildCommitPrompt({ files: safeFiles, diff: safeDiff });
    const reply = await requestAIChat({
      message: prompt,
      history: [],
      context: {},
      agent: false,
    });
    return res.json({ message: cleanCommitMessage(reply) });
  } catch (error) {
    console.error('AI commit message error:', error.response?.data || error.message);
    return res.status(502).json({
      error:
        error.response?.data?.error?.message ||
        error.message ||
        'Commit message generation failed.',
    });
  }
});

router.post('/readme', async (req, res) => {
  try {
    const { projectName, tagline, summary } = req.body || {};
    const safeSummary = summary && typeof summary === 'object' ? summary : {};
    const tree = typeof safeSummary.tree === 'string' ? safeSummary.tree : '';
    if (!tree.trim()) {
      return res.status(400).json({ error: 'A project file tree is required.' });
    }
    const safeName =
      typeof projectName === 'string' && projectName.trim()
        ? projectName.trim().slice(0, 120)
        : 'My Project';
    const safeTagline = typeof tagline === 'string' ? tagline.trim().slice(0, 200) : '';
    const safePkg = (pkg) =>
      pkg && typeof pkg === 'object' && !Array.isArray(pkg) ? pkg : null;
    const prompt = buildReadmePrompt({
      projectName: safeName,
      tagline: safeTagline,
      summary: {
        tree,
        clientPkg: safePkg(safeSummary.clientPkg),
        serverPkg: safePkg(safeSummary.serverPkg),
        existingReadme:
          typeof safeSummary.existingReadme === 'string' ? safeSummary.existingReadme : null,
      },
    });
    const reply = await requestAIChat({
      message: prompt,
      history: [],
      context: {},
      agent: false,
    });
    return res.json({ markdown: cleanReadmeMarkdown(reply, safeName) });
  } catch (error) {
    console.error('AI README error:', error.response?.data || error.message);
    return res.status(502).json({
      error:
        error.response?.data?.error?.message ||
        error.message ||
        'README generation failed.',
    });
  }
});

router.post('/new', async (req, res) => {
  try {
    if (!ensureDatabaseReady(res)) {
      return;
    }

    const conversation = await Conversation.create({
      userId: req.user.userId,
      title: 'New Chat',
    });

    return res.status(201).json(conversation);
  } catch (error) {
    console.error('Create conversation error:', error);
    return res.status(500).json({
      error: 'Failed to create a new conversation.',
    });
  }
});

router.get('/history', async (req, res) => {
  try {
    if (!ensureDatabaseReady(res)) {
      return;
    }

    const conversations = await Conversation.find({
      userId: req.user.userId,
    })
      .sort({ updatedAt: -1 })
      .limit(50);

    return res.json(conversations);
  } catch (error) {
    console.error('Fetch conversation history error:', error);
    return res.status(500).json({
      error: 'Failed to load conversation history.',
    });
  }
});

router.get('/conversation/:conversationId', async (req, res) => {
  try {
    if (!ensureDatabaseReady(res)) {
      return;
    }

    const conversation = await getOwnedConversation(
      req.params.conversationId,
      req.user.userId
    );

    if (!conversation) {
      return res.status(404).json({
        error: 'Conversation not found.',
      });
    }

    const messages = await AIMessage.find({
      conversationId: conversation._id,
    }).sort({ createdAt: 1 });

    return res.json({
      conversation,
      messages,
    });
  } catch (error) {
    console.error('Load conversation error:', error);
    return res.status(500).json({
      error: 'Failed to load conversation messages.',
    });
  }
});

router.delete('/conversation/:conversationId', async (req, res) => {
  try {
    if (!ensureDatabaseReady(res)) {
      return;
    }

    const conversation = await getOwnedConversation(
      req.params.conversationId,
      req.user.userId
    );

    if (!conversation) {
      return res.status(404).json({
        error: 'Conversation not found.',
      });
    }

    await AIMessage.deleteMany({ conversationId: conversation._id });
    await Conversation.deleteOne({ _id: conversation._id });

    return res.json({ success: true });
  } catch (error) {
    console.error('Delete conversation error:', error);
    return res.status(500).json({
      error: 'Failed to delete conversation.',
    });
  }
});

router.post('/message', async (req, res) => {
  try {
    if (!ensureDatabaseReady(res)) {
      return;
    }

    const { conversationId, role, content } = req.body || {};
    const normalizedContent = normalizeMessage(content);

    if (!normalizedContent) {
      return res.status(400).json({
        error: 'Message content is required.',
      });
    }

    if (!['user', 'assistant', 'system'].includes(role)) {
      return res.status(400).json({
        error: 'A valid message role is required.',
      });
    }

    const conversation = await getOwnedConversation(conversationId, req.user.userId);
    if (!conversation) {
      return res.status(404).json({
        error: 'Conversation not found.',
      });
    }

    const existingMessageCount = await AIMessage.countDocuments({
      conversationId: conversation._id,
    });

    const message = await AIMessage.create({
      conversationId: conversation._id,
      role,
      content: normalizedContent,
    });

    if (role === 'user' && existingMessageCount === 0) {
      conversation.title = buildConversationTitle(normalizedContent);
    }

    conversation.updatedAt = new Date();
    await conversation.save();

    return res.status(201).json({
      conversation,
      message,
    });
  } catch (error) {
    console.error('Save conversation message error:', error);
    return res.status(500).json({
      error: 'Failed to save the conversation message.',
    });
  }
});

router.post('/chat', aiChatLimiter, async (req, res) => {
  try {
    if (!ensureDatabaseReady(res)) {
      return;
    }

    const { message, conversationId, history = [], context = {}, agentMode = false } = req.body || {};
    const normalizedMessage = normalizeMessage(message);
    
    
    
    const isAgentMode = agentMode === true;

    if (!normalizedMessage) {
      return res.status(400).json({
        error: 'A message is required.',
      });
    }

    let conversation = null;

    if (conversationId) {
      conversation = await getOwnedConversation(conversationId, req.user.userId);

      if (!conversation) {
        return res.status(404).json({
          error: 'Conversation not found.',
        });
      }
    } else {
      conversation = await Conversation.create({
        userId: req.user.userId,
        title: buildConversationTitle(normalizedMessage),
      });
    }

    const persistedHistory = await AIMessage.find({
      conversationId: conversation._id,
    })
      .sort({ createdAt: 1 })
      .select({ role: 1, content: 1, _id: 0 });

    const reply = await requestAIChat({
      message: normalizedMessage,
      history: persistedHistory.length > 0 ? persistedHistory : history,
      context,
      agent: isAgentMode,
    });

    
    
    let assistantContent = reply;
    let actions = [];
    if (isAgentMode) {
      const extracted = extractAgentActions(reply);
      assistantContent = extracted.cleanText;
      actions = extracted.actions;
    }

    
    
    
    
    
    const persistedAssistantContent =
      assistantContent && assistantContent.trim()
        ? assistantContent
        : actions.length > 0
          ? 'Proposed changes are ready below — review each card and Apply the ones you want.'
          : 'Done.';

    const existingMessageCount = await AIMessage.countDocuments({
      conversationId: conversation._id,
    });

    const [userMessage, assistantMessage] = await AIMessage.create([
      {
        conversationId: conversation._id,
        role: 'user',
        content: normalizedMessage,
      },
      {
        conversationId: conversation._id,
        role: 'assistant',
        content: persistedAssistantContent,
      },
    ]);

    if (existingMessageCount === 0) {
      conversation.title = buildConversationTitle(normalizedMessage);
    }

    conversation.updatedAt = new Date();
    await conversation.save();

    return res.json({
      reply,
      actions,
      conversation,
      conversationId: conversation._id,
      userMessage,
      assistantMessage,
    });
  } catch (error) {
    console.error('AI chat error:', error.response?.data || error.message);

    const upstreamMessage =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.message;

    const statusCode =
      error.response?.status && error.response.status >= 400 && error.response.status < 600
        ? error.response.status
        : 500;

    return res.status(statusCode).json({
      error: upstreamMessage || 'Failed to generate AI response.',
    });
  }
});

module.exports = router;
