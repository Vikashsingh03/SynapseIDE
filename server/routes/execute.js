const express = require('express');
const axios = require('axios');
const authMiddleware = require('../middleware/auth');
const { executeLimiter } = require('../middleware/rateLimits');
const Activity = require('../models/Activity');

const router = express.Router();




const jdoodleClient = axios.create({
  baseURL: 'https://api.jdoodle.com',
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000, 
});


const LANGUAGE_MAP = {
  71: 'python3',  
  63: 'nodejs',   
  54: 'cpp',      
  62: 'java',     
};

const LANG_NAME = { 71: 'python', 63: 'javascript', 54: 'cpp', 62: 'java' };

function dayBucket(d = new Date()) {
  return d.toISOString().slice(0, 10);
}


function logRun(userId, languageId, sourceCode, success) {
  try {
    const lines = String(sourceCode || '').split(/\r?\n/).filter((l) => l.trim()).length;
    Activity.create({
      userId: String(userId),
      type: 'run',
      language: LANG_NAME[Number(languageId)] || null,
      languageId: Number(languageId) || null,
      linesOfCode: lines,
      success: !!success,
      day: dayBucket(),
    }).catch(() => {});
  } catch {}
}


router.post('/execute', authMiddleware, executeLimiter, async (req, res) => {
  try {
    const { source_code, language_id, stdin = '' } = req.body;

    if (!source_code || !language_id) {
      return res.status(400).json({
        error: 'source_code and language_id are required',
      });
    }

    const jdLanguage = LANGUAGE_MAP[Number(language_id)];
    if (!jdLanguage) {
      return res.status(400).json({
        error: `Unsupported language_id: ${language_id}`,
      });
    }

    if (!process.env.JDOODLE_CLIENT_ID || !process.env.JDOODLE_CLIENT_SECRET) {
      return res.status(500).json({
        error: 'Code execution is not configured (JDoodle credentials missing in server/.env).',
      });
    }

    const response = await jdoodleClient.post('/v1/execute', {
      clientId: process.env.JDOODLE_CLIENT_ID,
      clientSecret: process.env.JDOODLE_CLIENT_SECRET,
      script: source_code,
      stdin: stdin || '',
      language: jdLanguage,
      versionIndex: '0',
    });

    const data = response.data || {};

    
    logRun(req.user.userId || req.user.id, language_id, source_code, true);

    
    res.json({
      stdout: data.output || '',
      stderr: '',
      compile_output: '',
      status: { id: 3, description: 'Accepted' },
      time: data.cpuTime || null,
      memory: data.memory || null,
    });
  } catch (error) {
    console.error('Execution error:', error.response?.data || error.message);

    
    if (error.response?.status === 402) {
      return res.json({
        stdout: '',
        stderr: 'JDoodle free limit (20 runs/day) khatm ho gaya. Kal reset hoga!',
        compile_output: '',
        status: { id: 13, description: 'Rate Limited' },
        time: null,
        memory: null,
      });
    }

    
    if (error.code === 'ECONNABORTED') {
      return res.json({
        stdout: '',
        stderr: 'Run timeout (60s). Free runner busy ho sakta hai, ya program input ka wait kar raha hai — toolbar me stdin button se input do, ya phir se Run dabao.',
        compile_output: '',
        status: { id: 13, description: 'Timeout' },
        time: null,
        memory: null,
      });
    }

    res.status(500).json({
      error: 'Failed to execute code. Please try again.',
    });
  }
});


router.get('/languages', authMiddleware, async (req, res) => {
  res.json([
    { id: 71, name: 'Python' },
    { id: 63, name: 'JavaScript (Node.js)' },
    { id: 54, name: 'C++' },
    { id: 62, name: 'Java' },
  ]);
});

module.exports = router;
