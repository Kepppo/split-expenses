'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { Check, X } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

const ToastContext = createContext<(message: string, variant?: ToastVariant) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex animate-toast-in items-center gap-3 rounded-md border border-ledger-rule bg-ledger-card px-4 py-3 shadow-card"
            style={t.variant === 'error' ? { borderLeft: '4px solid rgb(var(--ledger-red))' } : undefined}
            role="status"
          >
            <span
              className={
                t.variant === 'error'
                  ? 'grid h-5 w-5 place-items-center rounded-full bg-ledger-red-light text-ledger-red'
                  : 'grid h-5 w-5 place-items-center rounded-full bg-ledger-teal-light text-ledger-teal'
              }
            >
              {t.variant === 'error' ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
            </span>
            <span className="flex-1 text-sm font-medium text-ledger-ink">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="text-ledger-ink-muted hover:text-ledger-ink"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
