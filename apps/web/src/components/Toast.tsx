import { useEffect, useState } from 'react';
import { toast } from '../lib/toast';

interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    let id = 0;
    const unsubscribe = toast.subscribe((message, type) => {
      const newToast = { id: ++id, message, type };
      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, 4000);
    });

    return unsubscribe;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 end-4 z-50 space-y-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-3 rounded-2xl shadow-lg text-white max-w-md animate-slide-in ${
            t.type === 'success'
              ? 'bg-[#4f6b43]'
              : t.type === 'error'
              ? 'bg-[#9b2c22]'
              : 'bg-[#5a1a28]'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

