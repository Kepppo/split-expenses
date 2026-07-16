'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

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
            className={cn(
              'pointer-events-auto flex animate-toast-in items-center gap-3 rounded-xl border border-rule bg-surface px-4 py-3 shadow-card',
              t.variant === 'error' && 'border-l-4 border-l-danger'
            )}
            role="status"
          >
            <span
              className={cn(
                'grid h-5 w-5 place-items-center rounded-full',
                t.variant === 'error'
                  ? 'bg-danger-light text-danger'
                  : 'bg-primary-light text-primary'
              )}
            >
              {t.variant === 'error' ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
            </span>
            <span className="flex-1 text-sm font-medium text-ink">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="text-ink-muted hover:text-ink"
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
