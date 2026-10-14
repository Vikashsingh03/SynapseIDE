/**
 * Copilot-style ghost text (inline completions) for Monaco.
 *
 * As the user types, a greyed suggestion appears at the cursor; Tab accepts
 * it (Monaco's native inline-suggest UX). Suggestions come from the server
 * `/api/ai/complete` endpoint (Groq-backed, same transport as Neura chat).
 *
 * Default ON. Toggle: localStorage 'synapse-ghost-text' = 'off'.
 * Requires an auth token (completions ride the user's AI quota).
 */
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
    /* storage unavailable — ghost text stays in its current state */
  }
}

/**
 * Build the prefix/suffix windows around the cursor.
 *
 * @param model   { getValueInRange(range), getLineCount(), getLineMaxColumn(line) }
 * @param position { lineNumber, column }
 * @param Range   constructor: (startLineNumber, startColumn, endLineNumber, endColumn)
 */
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
  // Keep the prefix TAIL and the suffix HEAD — the code nearest the cursor
  // is what matters most to the completion engine.
  if (prefix.length > MAX_PREFIX_CHARS) prefix = prefix.slice(-MAX_PREFIX_CHARS);
  if (suffix.length > MAX_SUFFIX_CHARS) suffix = suffix.slice(0, MAX_SUFFIX_CHARS);
  return { prefix, suffix };
}

/** Defensive client-side fence strip (the server already sanitizes). */
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

      // Debounce: only the latest keystroke pause triggers a request.
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
        // Any failure (network, abort, provider down) = silently no suggestion.
        return { items: [] };
      } finally {
        if (cancelSubscription && typeof cancelSubscription.dispose === 'function') {
          cancelSubscription.dispose();
        }
      }
    },

    freeInlineCompletions() {
      // Completion items are plain data — nothing to dispose.
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
