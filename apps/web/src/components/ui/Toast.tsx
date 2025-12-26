/**
 * Luxury Toast Notification System
 * 
 * Premium toast notifications with:
 * - Elegant animations (Framer Motion)
 * - Refined styling
 * - Auto-dismiss with progress
 * - Accessible (aria-live, keyboard dismiss)
 * - RTL support
 * - Mobile-first positioning
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration || 5000,
    };

    setToasts((prev) => [...prev, newToast]);

    // Auto-dismiss
    if (newToast.duration) {
      setTimeout(() => {
        removeToast(id);
      }, newToast.duration);
    }
  }, []);

  // Bridge: Listen to global toast events from lib/toast.ts
  useEffect(() => {
    const handleToastEvent = (event: any) => {
      addToast({
        type: event.type,
        message: event.message,
        title: event.title,
      });
    };

    // Subscribe to global toast manager
    // @ts-ignore
    const unsubscribe = window.__toastBridge?.subscribe(handleToastEvent);

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [addToast]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const success = useCallback((message: string, title?: string) => {
    addToast({ type: 'success', message, title });
  }, [addToast]);

  const error = useCallback((message: string, title?: string) => {
    addToast({ type: 'error', message, title });
  }, [addToast]);

  const warning = useCallback((message: string, title?: string) => {
    addToast({ type: 'warning', message, title });
  }, [addToast]);

  const info = useCallback((message: string, title?: string) => {
    addToast({ type: 'info', message, title });
  }, [addToast]);

  return (
    <ToastContext.Provider
      value={{
        toasts,
        addToast,
        removeToast,
        success,
        error,
        warning,
        info,
      }}
    >
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  return (
    <div
      className="fixed bottom-0 end-0 z-[1060] p-4 sm:p-6 space-y-3 pointer-events-none max-w-full sm:max-w-md"
      style={{ zIndex: 'var(--z-toast)' }}
      aria-live="polite"
      aria-atomic="true"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
        ))}
      </AnimatePresence>
    </div>
  );
};

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!toast.duration) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        const newProgress = prev - (100 / (toast.duration! / 100));
        return Math.max(0, newProgress);
      });
    }, 100);

    return () => clearInterval(interval);
  }, [toast.duration]);

  const icons = {
    success: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  };

  const styles = {
    success: {
      bg: 'var(--color-success-light)',
      border: 'var(--color-success)',
      text: 'var(--color-success)',
      progressBg: 'var(--color-success)',
    },
    error: {
      bg: 'var(--color-error-light)',
      border: 'var(--color-error)',
      text: 'var(--color-error)',
      progressBg: 'var(--color-error)',
    },
    warning: {
      bg: 'var(--color-warning-light)',
      border: '#9d7b23',
      text: '#9d7b23',
      progressBg: 'var(--color-gold-500)',
    },
    info: {
      bg: 'var(--color-info-light)',
      border: 'var(--color-info)',
      text: 'var(--color-info)',
      progressBg: 'var(--color-info)',
    },
  };

  const style = styles[toast.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: isRTL ? -100 : 100, scale: 0.9 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="pointer-events-auto w-full sm:max-w-md"
      role="alert"
      aria-live="assertive"
    >
      <div
        className="relative overflow-hidden rounded-xl shadow-xl backdrop-blur-sm"
        style={{
          backgroundColor: style.bg,
          borderLeft: isRTL ? 'none' : `4px solid ${style.border}`,
          borderRight: isRTL ? `4px solid ${style.border}` : 'none',
        }}
      >
        <div className="p-4 flex items-start gap-3">
          <div style={{ color: style.text }} className="flex-shrink-0 mt-0.5">
            {icons[toast.type]}
          </div>

          <div className="flex-1 min-w-0">
            {toast.title && (
              <h4
                className="font-semibold text-sm mb-1"
                style={{ color: style.text }}
              >
                {toast.title}
              </h4>
            )}
            <p className="text-sm" style={{ color: 'var(--color-stone-800)' }}>
              {toast.message}
            </p>
          </div>

          <button
            onClick={() => onRemove(toast.id)}
            className="flex-shrink-0 p-1 rounded-lg hover:bg-black/10 transition-colors"
            aria-label={t('common.close')}
            style={{ color: style.text }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Progress bar */}
        {toast.duration && (
          <motion.div
            className="h-1"
            style={{ backgroundColor: style.progressBg, opacity: 0.3 }}
            initial={{ width: '100%' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.1, ease: 'linear' }}
          />
        )}
      </div>
    </motion.div>
  );
};

