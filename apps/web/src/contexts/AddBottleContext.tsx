/**
 * Add Bottle Context
 * 
 * Global state management for the Add Bottle flow.
 * Allows the Camera FAB to trigger the Add Bottle sheet from any page.
 * Provides smart scan functionality that works globally.
 */

import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { toast } from '../lib/toast';
import * as smartScanService from '../services/smartScanService';

type ScanningState = 'idle' | 'scanning' | 'complete' | 'error';
type FallbackReason = 'cancelled' | 'permission-denied' | 'not-available' | 'error';

interface AddBottleContextType {
  showAddSheet: boolean;
  scanningState: ScanningState;
  scanningMessage: string;
  showFallbackSheet: boolean;
  fallbackReason?: FallbackReason;
  showPwaCamera: boolean;
  openAddBottleFlow: () => void;
  openAddBottleFlowForScanning: () => void;
  closeAddBottleFlow: () => void;
  openImmediateCamera: () => void;
  openPwaCamera: () => void;
  closePwaCamera: () => void;
  closeFallbackSheet: () => void;
  handleSmartScan: (file: File) => Promise<void>;
}

const AddBottleContext = createContext<AddBottleContextType | undefined>(undefined);

export function AddBottleProvider({ children }: { children: ReactNode }) {
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [scanningState, setScanningState] = useState<ScanningState>('idle');
  const [scanningMessage, setScanningMessage] = useState('');
  const [showFallbackSheet, setShowFallbackSheet] = useState(false);
  const [fallbackReason, setFallbackReason] = useState<FallbackReason>();
  const [showPwaCamera, setShowPwaCamera] = useState(false);

  const openAddBottleFlow = () => {
    setShowAddSheet(true);
    setScanningState('idle');
    setScanningMessage('');
    setShowFallbackSheet(false);
  };

  const openAddBottleFlowForScanning = () => {
    // Open sheet in preparation for scanning
    // The scanning state will be set by handleSmartScan() immediately after
    console.log('[AddBottleContext] Opening sheet for incoming scan');
    setShowAddSheet(true);
    setScanningState('idle'); // Keep idle temporarily, handleSmartScan will set to scanning
    setScanningMessage('');
    setShowFallbackSheet(false);
  };

  const closeAddBottleFlow = () => {
    setShowAddSheet(false);
    setScanningState('idle');
    setScanningMessage('');
  };

  const openImmediateCamera = () => {
    // For mobile/PWA: trigger immediate camera capture
    // This will be handled by a hidden file input in Layout
    console.log('[AddBottleContext] Opening immediate camera');
    setShowAddSheet(false);
    setShowFallbackSheet(false);
    setShowPwaCamera(false);
    setScanningState('idle');
    
    // Dispatch event to trigger camera input
    const event = new CustomEvent('openImmediateCamera');
    window.dispatchEvent(event);
  };

  const openPwaCamera = () => {
    // For iOS PWA: open getUserMedia camera modal
    console.log('[AddBottleContext] Opening PWA camera');
    setShowPwaCamera(true);
    setShowAddSheet(false);
    setShowFallbackSheet(false);
    setScanningState('idle');
  };

  const closePwaCamera = () => {
    console.log('[AddBottleContext] Closing PWA camera');
    setShowPwaCamera(false);
  };

  const closeFallbackSheet = () => {
    setShowFallbackSheet(false);
    setFallbackReason(undefined);
  };

  // Show fallback sheet (called when camera fails or cancelled)
  const showFallback = (reason: FallbackReason) => {
    console.log('[AddBottleContext] Showing camera fallback sheet, reason:', reason);
    setShowFallbackSheet(true);
    setFallbackReason(reason);
    setShowAddSheet(false);
  };

  // Expose showFallback through window events for easy access
  useEffect(() => {
    const handleShowFallback = (e: CustomEvent<{ reason: FallbackReason }>) => {
      console.log('[AddBottleContext] Received showCameraFallback event:', e.detail);
      showFallback(e.detail.reason);
    };

    window.addEventListener('showCameraFallback' as any, handleShowFallback);
    return () => {
      window.removeEventListener('showCameraFallback' as any, handleShowFallback);
    };
  }, []);

  /**
   * Handle smart scan - unified single/multi bottle detection
   * This is called from the global AddBottleSheet (Layout.tsx)
   * Keeps the sheet open and shows loading state, then dispatches results
   */
  const handleSmartScan = useCallback(async (file: File) => {
    if (scanningState === 'scanning') {
      console.warn('[AddBottleContext] Smart scan already in progress, ignoring');
      return; // Prevent double-scans
    }
    
    console.log('[AddBottleContext] Starting smart scan for file:', file.name, file.type);
    
    try {
      // Keep sheet OPEN and transition to scanning state
      setScanningState('scanning');
      setScanningMessage('AI is reading your image…');
      
      // Small delay to ensure UI updates smoothly
      await new Promise(resolve => setTimeout(resolve, 100));

      // Perform smart scan
      const result = await smartScanService.performSmartScan(file);

      // Mark as complete
      setScanningState('complete');

      // Small delay to show completion, then close and dispatch
      await new Promise(resolve => setTimeout(resolve, 300));

      // Close the sheet now that scan is complete
      setShowAddSheet(false);
      setScanningState('idle');

      // Handle receipt vs label results
      if (result.mode === 'receipt') {
        // Receipt detected - dispatch receipt event
        console.log('[AddBottleContext] Receipt detected, dispatching receiptScanComplete');
        const event = new CustomEvent('receiptScanComplete', {
          detail: {
            imageUrl: result.imageUrl,
            items: result.receiptItems || [],
            detectedCount: result.detectedCount,
          },
        });
        window.dispatchEvent(event);
        
        toast.success(`✅ Detected ${result.detectedCount} wines on receipt!`);
      } else {
        // Label detected - dispatch normal scan event
        const event = new CustomEvent('smartScanComplete', {
          detail: {
            mode: result.mode,
            imageUrl: result.imageUrl,
            singleBottle: result.singleBottle,
            multipleBottles: result.multipleBottles,
            detectedCount: result.detectedCount,
          },
        });
        window.dispatchEvent(event);

        // Show success toast
        if (result.mode === 'single') {
          toast.success('Label scanned successfully!');
        } else if (result.mode === 'multi') {
          toast.success(`✅ Detected ${result.detectedCount} bottles!`);
        } else {
          toast.info('Please verify the details');
        }
      }
    } catch (error: any) {
      console.error('[AddBottleContext] Smart scan error:', error);
      console.error('[AddBottleContext] Error details:', error.message);
      
      // Set error state and keep modal open with helpful message
      setScanningState('error');
      
      // Parse error message for better UX
      let errorMessage = 'Scan failed. Please try again.';
      if (error.message?.includes('IMAGE_NOT_ACCESSIBLE') || error.message?.includes('IMAGE_FETCH_FAILED')) {
        errorMessage = 'Cannot access image. Please check your connection and try again.';
      } else if (error.message?.includes('AI_SERVICE_UNREACHABLE')) {
        errorMessage = 'AI service temporarily unavailable. Please try again in a moment.';
      } else if (error.message?.includes('Rate limit')) {
        errorMessage = 'Too many requests. Please wait a moment and try again.';
      } else if (error.message?.includes('receipt') || error.message?.includes('invoice')) {
        errorMessage = 'Receipt scanning failed. Make sure the receipt is clear and fully visible.';
      }
      
      setScanningMessage(errorMessage);
      
      // Don't auto-close on error - let user see error state and choose action
    }
  }, [scanningState]);

  return (
    <AddBottleContext.Provider value={{ 
      showAddSheet, 
      scanningState,
      scanningMessage,
      showFallbackSheet,
      fallbackReason,
      showPwaCamera,
      openAddBottleFlow,
      openAddBottleFlowForScanning,
      closeAddBottleFlow,
      openImmediateCamera,
      openPwaCamera,
      closePwaCamera,
      closeFallbackSheet,
      handleSmartScan,
    }}>
      {children}
    </AddBottleContext.Provider>
  );
}

export function useAddBottleContext() {
  const context = useContext(AddBottleContext);
  if (!context) {
    throw new Error('useAddBottleContext must be used within AddBottleProvider');
  }
  return context;
}
