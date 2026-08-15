import { useEffect, useRef } from 'react';

const TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface TurnstileVerifierProps {
  siteKey: string;
  onVerified: (token: string) => void;
  onError: () => void;
}

export default function TurnstileVerifier({
  siteKey,
  onVerified,
  onError,
}: TurnstileVerifierProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let disposed = false;
    const renderWidget = () => {
      if (disposed || !containerRef.current || !window.turnstile) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token) => onVerified(token),
        'error-callback': () => onError(),
      });
    };
    if (window.turnstile) {
      renderWidget();
    } else {
      const script = document.createElement('script');
      script.src = TURNSTILE_SCRIPT_SRC;
      script.async = true;
      script.onload = renderWidget;
      script.onerror = () => onError();
      document.head.appendChild(script);
    }
    return () => {
      disposed = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, onVerified, onError]);

  return <div ref={containerRef} className="flex justify-center" />;
}
