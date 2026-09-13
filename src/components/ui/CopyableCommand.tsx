import { useState } from 'react';

type CopyableCommandProps = {
  code: string;
  /** Allow long commands to wrap instead of scrolling horizontally. */
  wrap?: boolean;
};

export function CopyableCommand({ code, wrap = false }: CopyableCommandProps) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1600);
    } catch {
      // Clipboard unavailable (permissions or insecure context): no-op.
    }
  };

  return (
    <div className={`landing-code${wrap ? ' landing-code--wrap' : ''}`}>
      <pre>
        <code>{code}</code>
      </pre>
      <button
        type="button"
        className="landing-code__copy"
        onClick={() => {
          void handleCopy();
        }}
        aria-label="Copy command to clipboard"
      >
        {isCopied ? 'Copied ✓' : 'Copy'}
      </button>
    </div>
  );
}
