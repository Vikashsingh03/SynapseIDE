import { getSnippets, trackSnippetUse } from './snippetService';
import { BUILT_IN_SNIPPETS } from './builtinSnippets';









const disposables = new Map(); 

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

  
  if (disposables.has(monacoLang)) {
    try {
      disposables.get(monacoLang).dispose();
    } catch {}
    disposables.delete(monacoLang);
  }

  
  
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
