import { useEffect, useRef, useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import { buildInviteLink } from '../utils/inviteLink';
import { copyText } from '../utils/clipboard';

export default function InviteButton({ roomId, className = '' }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const handleCopy = async () => {
    const didCopy = await copyText(buildInviteLink(window.location.origin, roomId));
    if (!didCopy) return;
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy invite link"
      className={`inline-flex items-center gap-1.5 ${className}`}
    >
      {copied ? <Check size={14} /> : <Link2 size={14} />}
      <span>{copied ? 'Link copied' : 'Invite'}</span>
    </button>
  );
}
