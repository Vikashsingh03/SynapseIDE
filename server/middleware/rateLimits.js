const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

















function normalizeEmail(value) {
  return String(value || '').toLowerCase().trim();
}

function emailKeyGenerator(req) {
  const email = normalizeEmail(req.body && req.body.email);
  if (email) {
    return `email:${email}`;
  }
  return ipKeyGenerator(req.ip);
}

function userKeyGenerator(req) {
  const userId = req.user && (req.user.userId || req.user.id);
  if (userId) {
    return `user:${userId}`;
  }
  return ipKeyGenerator(req.ip);
}

function tooManyRequestsMessage(retryMinutes) {
  return {
    error: `Too many requests. Please try again in ${retryMinutes}.`,
  };
}

const otpRequestByEmailLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, 
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: emailKeyGenerator,
  message: tooManyRequestsMessage('10 minutes'),
});

const otpRequestByIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, 
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  message: tooManyRequestsMessage('an hour'),
});

const otpVerifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, 
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  
  
  keyGenerator: emailKeyGenerator,
  message: tooManyRequestsMessage('10 minutes'),
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  message: tooManyRequestsMessage('15 minutes'),
});

const executeLimiter = rateLimit({
  windowMs: 60 * 1000, 
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  message: tooManyRequestsMessage('a minute'),
});

const aiChatLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, 
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  message: tooManyRequestsMessage('an hour'),
});

const globalLimiter = rateLimit({
  windowMs: 60 * 1000, 
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  message: tooManyRequestsMessage('a minute'),
});

module.exports = {
  otpRequestByEmailLimiter,
  otpRequestByIpLimiter,
  otpVerifyLimiter,
  loginLimiter,
  executeLimiter,
  aiChatLimiter,
  globalLimiter,
};
