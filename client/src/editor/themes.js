
















export const PREMIUM_THEME_IDS = ['synapse-dark-plus', 'synapse-midnight'];

let registered = false;




export function registerPremiumThemes(monaco) {
  if (registered) return;
  try {
    const defineTheme = monaco?.editor?.defineTheme;
    if (typeof defineTheme !== 'function') return;

    
    defineTheme('synapse-dark-plus', {
      base: 'vs-dark',
      inherit: true,
      colors: {
        'editor.background': '#1E1E1E',
        'editor.foreground': '#D4D4D4',
        'editorLineNumber.foreground': '#858585',
        'editorLineNumber.activeForeground': '#C6C6C6',
        'editor.lineHighlightBackground': '#2A2D2E',
        'editorCursor.foreground': '#AEAFAD',
        'editor.selectionBackground': '#264F78',
        'editor.inactiveSelectionBackground': '#3A3D41',
        'editorIndentGuide.background1': '#404040',
        'editorIndentGuide.activeBackground1': '#707070',
        'editorWidget.background': '#252526',
        'editorWidget.border': '#454545',
        'editorSuggestWidget.selectedBackground': '#04395E',
        'editorHoverWidget.background': '#252526',
        'minimap.background': '#1E1E1E',
        'editorBracketMatch.background': '#0064001a',
        'editorBracketMatch.border': '#888888',
        'scrollbarSlider.background': '#79797966',
        'scrollbarSlider.hoverBackground': '#646464b3',
        'scrollbarSlider.activeBackground': '#bfbfbf66',
        'editorGutter.background': '#1E1E1E',
        'editor.findMatchBackground': '#515C6A',
        'editor.findMatchHighlightBackground': '#515C6A55',
        'editor.findMatchBorder': '#007ACC',
      },
      rules: [
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'keyword', foreground: '569CD6' },
        { token: 'keyword.control', foreground: '569CD6' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'string.escape', foreground: 'D7BA7D' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'constant', foreground: '4FC1FF' },
        { token: 'type', foreground: '4EC9B0' },
        { token: 'type.identifier', foreground: '4EC9B0' },
        { token: 'identifier', foreground: 'DCDCAA' }, 
        { token: 'variable', foreground: '9CDCFE' },
        { token: 'variable.predefined', foreground: '9CDCFE' },
        { token: 'attribute.name', foreground: '9CDCFE' }, 
        { token: 'attribute.value', foreground: 'CE9178' },
        { token: 'tag', foreground: '569CD6' },
        { token: 'delimiter', foreground: '808080' },
        { token: 'operator', foreground: 'D4D4D4' },
        { token: 'regexp', foreground: 'D16969' },
        { token: 'invalid', foreground: 'FF0000' },
        { token: 'debug', foreground: '569CD6' },
        { token: 'namespace', foreground: '4EC9B0' },
        { token: 'entity', foreground: '4EC9B0' },
        
        { token: 'attribute.name.css', foreground: '9CDCFE' },
        { token: 'string.css', foreground: 'CE9178' },
        { token: 'number.css', foreground: 'B5CEA8' },
      ],
    });

    
    defineTheme('synapse-midnight', {
      base: 'vs-dark',
      inherit: true,
      colors: {
        'editor.background': '#0A0E17',
        'editor.foreground': '#D7E2F2',
        'editorLineNumber.foreground': '#46587A',
        'editorLineNumber.activeForeground': '#A9C2E8',
        'editor.lineHighlightBackground': '#FFFFFF08',
        'editorCursor.foreground': '#D9FF3F',
        'editor.selectionBackground': '#2B4B8F88',
        'editor.inactiveSelectionBackground': '#1D2B4A66',
        'editorIndentGuide.background1': '#FFFFFF10',
        'editorIndentGuide.activeBackground1': '#58A6FF55',
        'editorWidget.background': '#0D1322',
        'editorWidget.border': '#FFFFFF14',
        'editorSuggestWidget.selectedBackground': '#14335F',
        'editorHoverWidget.background': '#0D1322',
        'minimap.background': '#0A0E17',
        'editorBracketMatch.background': '#58A6FF14',
        'editorBracketMatch.border': '#58A6FF88',
        'scrollbarSlider.background': '#58A6FF33',
        'scrollbarSlider.hoverBackground': '#58A6FF55',
        'scrollbarSlider.activeBackground': '#58A6FF77',
        'editorGutter.background': '#0A0E17',
        'editor.findMatchBackground': '#D9FF3F33',
        'editor.findMatchBorder': '#D9FF3F88',
        'editor.findMatchHighlightBackground': '#D9FF3F22',
      },
      rules: [
        { token: 'comment', foreground: '5C6F94', fontStyle: 'italic' },
        { token: 'keyword', foreground: '58A6FF' },
        { token: 'keyword.control', foreground: '58A6FF' },
        { token: 'string', foreground: 'FFD479' },
        { token: 'string.escape', foreground: 'FFCB6B' },
        { token: 'number', foreground: 'FF9E64' },
        { token: 'constant', foreground: 'F78C6C' },
        { token: 'type', foreground: '4EC9B0' },
        { token: 'type.identifier', foreground: '4EC9B0' },
        { token: 'identifier', foreground: 'C792EA' }, 
        { token: 'variable', foreground: 'D7E2F2' },
        { token: 'variable.predefined', foreground: '82AAFF' },
        { token: 'attribute.name', foreground: 'FFCB6B' },
        { token: 'attribute.value', foreground: 'FFD479' },
        { token: 'tag', foreground: '7FDBCA' },
        { token: 'delimiter', foreground: '5C6F94' },
        { token: 'operator', foreground: 'D7E2F2' },
        { token: 'regexp', foreground: 'F07178' },
        { token: 'invalid', foreground: 'FF5874' },
        { token: 'debug', foreground: '58A6FF' },
        { token: 'namespace', foreground: '4EC9B0' },
        { token: 'entity', foreground: '7FDBCA' },
        { token: 'attribute.name.css', foreground: '82AAFF' },
        { token: 'string.css', foreground: 'FFD479' },
        { token: 'number.css', foreground: 'FF9E64' },
      ],
    });

    registered = true;
  } catch {
    
  }
}
