









import { API_BASE } from '../config/apiConfig';
import { getToken } from '../services/authService';

const STORAGE_KEY = 'synapse-ghost-text';
const DEBOUNCE_MS = 350;
const MAX_PREFIX_CHARS = 4000;
const MAX_SUFFIX_CHARS = 1500;

let registered = false;
let generation = 0;

export function ghostTextEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setGhostTextEnabled(on) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
     
  }
}








export function buildParts(model, position, Range) {
  const lastLine = model.getLineCount();
  const prefixRange = new Range(1, 1, position.lineNumber, position.column);
  const suffixRange = new Range(
    position.lineNumber,
    position.column,
    lastLine,
    model.getLineMaxColumn(lastLine)
  );
  let prefix = model.getValueInRange(prefixRange);
  let suffix = model.getValueInRange(suffixRange);
  
  
  if (prefix.length > MAX_PREFIX_CHARS) prefix = prefix.slice(-MAX_PREFIX_CHARS);
  if (suffix.length > MAX_SUFFIX_CHARS) suffix = suffix.slice(0, MAX_SUFFIX_CHARS);
  return { prefix, suffix };
}

 
export function stripClientFence(text) {
  const lines = String(text).split('\n');
  if (
    lines.length >= 2 &&
    lines[0].trim().startsWith('```') &&
    lines[lines.length - 1].trim() === '```'
  ) {
    return lines.slice(1, -1).join('\n');
  }
  return text;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function registerGhostText(monaco) {
  if (registered) return;
  registered = true;

  const provider = {
    async provideInlineCompletions(model, position, context, token) {
      if (!ghostTextEnabled() || !getToken()) {
        return { items: [] };
      }

      
      const myGeneration = ++generation;
      await sleep(DEBOUNCE_MS);
      if (myGeneration !== generation || token.isCancellationRequested) {
        return { items: [] };
      }

      const { prefix, suffix } = buildParts(model, position, monaco.Range);
      if (!prefix.trim()) {
        return { items: [] };
      }

      const controller = new AbortController();
      const cancelSubscription = token.onCancellationRequested
        ? token.onCancellationRequested(() => controller.abort())
        : null;

      try {
        const res = await fetch(`${API_BASE}/ai/complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            prefix,
            suffix,
            language: model.getLanguageId ? model.getLanguageId() : 'plaintext',
          }),
          signal: controller.signal,
        });
        if (!res.ok) return { items: [] };

        const data = await res.json().catch(() => ({}));
        const completion = stripClientFence(String(data.completion || ''));
        if (!completion.trim()) return { items: [] };

        return {
          items: [
            {
              insertText: completion,
              range: new monaco.Range(
                position.lineNumber,
                position.column,
                position.lineNumber,
                position.column
              ),
            },
          ],
        };
      } catch {
        
        return { items: [] };
      } finally {
        if (cancelSubscription && typeof cancelSubscription.dispose === 'function') {
          cancelSubscription.dispose();
        }
      }
    },

    freeInlineCompletions() {
      
    },
  };

  monaco.languages.registerInlineCompletionsProvider(
    [
      'javascript',
      'typescript',
      'javascriptreact',
      'typescriptreact',
      'python',
      'html',
      'css',
    ],
    provider
  );
}
