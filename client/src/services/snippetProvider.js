import { getSnippets, trackSnippetUse } from './snippetService';
import { BUILT_IN_SNIPPETS } from './builtinSnippets';

/**
 * Registers Monaco snippet completions (VS Code-style Tab completion
 * with ${1:placeholder} tab stops) for the given editor.
 *
 * Snippets are fetched per language and registered as CompletionItems
 * with insertTextRules = InsertAsSnippet so tab stops work natively.
 */

const disposables = new Map(); // lang -> disposable

function monacoLangToSnippetLang(monacoLang) {
  const map = {
    python: 'python',
    cpp: 'cpp',
    java: 'java',
    javascript: 'javascript',
    typescript: 'javascript',
    javascriptreact: 'javascript',
    typescriptreact: 'javascript',
    html: 'html',
    css: 'css',
  };
  return map[monacoLang] || null;
}

export async function registerSnippetProvider(monaco, monacoLang) {
  const snippetLang = monacoLangToSnippetLang(monacoLang);
  if (!snippetLang) return;

  // Dispose previous provider for this monaco language
  if (disposables.has(monacoLang)) {
    try {
      disposables.get(monacoLang).dispose();
    } catch {}
    disposables.delete(monacoLang);
  }

  // Built-in snippets (rfce, useState, HTML boilerplate…) always ship with
  // the editor; user snippets from the backend are merged on top.
  const builtIns = BUILT_IN_SNIPPETS.filter((s) => s.language === snippetLang);
  let userSnippets = [];
  try {
    userSnippets = await getSnippets({ language: snippetLang });
  } catch {
    userSnippets = [];
  }
  const snippets = [...builtIns, ...userSnippets];
  if (!snippets.length) return;

  const provider = monaco.languages.registerCompletionItemProvider(monacoLang, {
    triggerCharacters: [],
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions = snippets.map((s) => ({
        label: { label: s.prefix, description: s.name },
        kind: monaco.languages.CompletionItemKind.Snippet,
        documentation: { value: `**${s.name}**\n\n${s.description || ''}\n\n\`\`\`${snippetLang}\n${s.code}\n\`\`\`` },
        detail: `snippet · ${s.category}`,
        insertText: s.code,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
        sortText: `0-${String(999 - Math.min(s.useCount || 0, 999)).padStart(3, '0')}-${s.prefix}`,
        ...(s._id
          ? {
              command: {
                id: 'synapse.snippetUsed',
                title: 'Track snippet use',
                arguments: [s._id],
              },
            }
          : {}),
      }));

      return { suggestions };
    },
  });

  disposables.set(monacoLang, provider);
}

// Command handler for usage tracking (registered once per editor mount)
export function registerSnippetUseCommand(editor) {
  return editor.addCommand(0, (...args) => {
    const id = args?.[0];
    if (id) trackSnippetUse(id);
  }, 'synapse.snippetUsed');
}

export function disposeAllSnippetProviders() {
  for (const d of disposables.values()) {
    try {
      d.dispose();
    } catch {}
  }
  disposables.clear();
}
