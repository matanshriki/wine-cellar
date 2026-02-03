/**
 * Add Bottle Context
 * 
 * Global state management for the Add Bottle flow.
 * Allows the Camera FAB to trigger the Add Bottle sheet from any page.
 * Provides smart scan functionality that works globally.
 */

import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { toast } from '../lib/toast';
import * as smartScanService from '../services/smartScanService';

type ScanningState = 'idle' | 'scanning' | 'complete' | 'error';

interface AddBottleContextType {
  showAddSheet: boolean;
  scanningState: ScanningState;
  scanningMessage: string;
  openAddBottleFlow: () => void;
  closeAddBottleFlow: () => void;
  handleSmartScan: (file: File) => Promise<void>;
}

const AddBottleContext = createContext<AddBottleContextType | undefined>(undefined);

export function AddBottleProvider({ children }: { children: ReactNode }) {
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [scanningState, setScanningState] = useState<ScanningState>('idle');
  const [scanningMessage, setScanningMessage] = useState('');

  const openAddBottleFlow = () => {
    setShowAddSheet(true);
    setScanningState('idle');
    setScanningMessage('');
  };

  const closeAddBottleFlow = () => {
    setShowAddSheet(false);
    setScanningState('idle');
    setScanningMessage('');
  };

  /**
   * Handle smart scan - unified single/multi bottle detection
   * This is called from the global AddBottleSheet (Layout.tsx)
   * Keeps the sheet open and shows loading state, then dispatches results
   */
  const handleSmartScan = useCallback(async (file: File) => {
    if (scanningState === 'scanning') return; // Prevent double-scans
    
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

      // Dispatch event with scan results for pages to handle
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
    } catch (error: any) {
      console.error('[AddBottleContext] Smart scan error:', error);
      
      // Set error state and keep modal open
      setScanningState('error');
      setScanningMessage('Scan failed. Please try again.');
      
      // Don't auto-close on error - let user see error state and choose action
    }
  }, [scanningState]);

  return (
    <AddBottleContext.Provider value={{ 
      showAddSheet, 
      scanningState,
      scanningMessage,
      openAddBottleFlow, 
      closeAddBottleFlow,
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
