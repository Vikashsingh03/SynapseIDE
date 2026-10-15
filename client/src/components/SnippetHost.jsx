import { useCallback, useEffect, useState } from 'react';
import SnippetManager from './SnippetManager';
import { trackSnippetUse } from '../services/snippetService';
import { getMonacoLanguage } from '../utils/languageMap';
import { useFiles } from '../contexts/FileContext';










export default function SnippetHost({ theme }) {
  const [open, setOpen] = useState(false);
  const [initialCode, setInitialCode] = useState('');
  const [language, setLanguage] = useState('python');
  const { activeFile } = useFiles();

  useEffect(() => {
    const ml = getMonacoLanguage(activeFile?.name || '');
    setLanguage(['python', 'cpp', 'java', 'javascript'].includes(ml) ? ml : 'python');
  }, [activeFile]);

  useEffect(() => {
    const onOpen = () => {
      setInitialCode('');
      setOpen(true);
    };
    const onSave = (e) => {
      setInitialCode(e.detail?.code || '');
      setOpen(true);
    };
    window.addEventListener('synapse:open-snippets', onOpen);
    window.addEventListener('synapse:save-snippet', onSave);
    return () => {
      window.removeEventListener('synapse:open-snippets', onOpen);
      window.removeEventListener('synapse:save-snippet', onSave);
    };
  }, []);

  const handleInsert = useCallback(
    (snippet) => {
      setOpen(false);
      trackSnippetUse(snippet._id);
      window.dispatchEvent(
        new CustomEvent('synapse:insert-snippet', {
          detail: { code: snippet.code, id: snippet._id },
        })
      );
    },
    []
  );

  if (!open) return null;

  
  return (
    <SnippetManager
      key={initialCode ? 'save' : 'browse'}
      theme={theme}
      language={language}
      initialCode={initialCode}
      onInsert={handleInsert}
      onClose={() => {
        setOpen(false);
        setInitialCode('');
      }}
    />
  );
}
