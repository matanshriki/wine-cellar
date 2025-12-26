/**
 * Toast Library - Compatibility Bridge
 * 
 * This provides a bridge between the old toast system and the new premium Toast component.
 * It uses a global event emitter pattern to trigger toasts from anywhere in the app.
 * 
 * Usage:
 *   import { toast } from '../lib/toast';
 *   toast.success('Saved!');
 *   toast.error('Something went wrong');
 * 
 * For new code, prefer using the useToast() hook directly:
 *   const toast = useToast();
 *   toast.success('Saved!');
 */

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastEvent {
  type: ToastType;
  message: string;
  title?: string;
}

class ToastManager {
  private listeners: Array<(event: ToastEvent) => void> = [];

  subscribe(listener: (event: ToastEvent) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(event: ToastEvent) {
    this.listeners.forEach((listener) => listener(event));
  }

  success(message: string, title?: string) {
    this.emit({ type: 'success', message, title });
  }

  error(message: string, title?: string) {
    this.emit({ type: 'error', message, title });
  }

  info(message: string, title?: string) {
    this.emit({ type: 'info', message, title });
  }

  warning(message: string, title?: string) {
    this.emit({ type: 'warning', message, title });
  }
}

export const toast = new ToastManager();

// Expose toast manager on window for the ToastProvider bridge
if (typeof window !== 'undefined') {
  (window as any).__toastBridge = toast;
}
