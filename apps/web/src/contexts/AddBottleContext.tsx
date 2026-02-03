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

interface AddBottleContextType {
  showAddSheet: boolean;
  openAddBottleFlow: () => void;
  closeAddBottleFlow: () => void;
  handleSmartScan: (file: File) => Promise<void>;
}

const AddBottleContext = createContext<AddBottleContextType | undefined>(undefined);

export function AddBottleProvider({ children }: { children: ReactNode }) {
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const openAddBottleFlow = () => {
    setShowAddSheet(true);
  };

  const closeAddBottleFlow = () => {
    setShowAddSheet(false);
  };

  /**
   * Handle smart scan - unified single/multi bottle detection
   * This is called from the global AddBottleSheet (Layout.tsx)
   * Dispatches events that pages (like CellarPage) listen to
   */
  const handleSmartScan = useCallback(async (file: File) => {
    if (isScanning) return; // Prevent double-scans
    
    try {
      setIsScanning(true);
      
      // Close the sheet and show loading
      setShowAddSheet(false);
      toast.info('Identifying bottle(s)…');
      
      // Small delay to ensure UI updates
      await new Promise(resolve => setTimeout(resolve, 50));

      // Perform smart scan
      const result = await smartScanService.performSmartScan(file);

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
      
      // Show error toast
      const errorDetails = error.message ? ` (${error.message.substring(0, 50)})` : '';
      toast.error('Scan failed' + errorDetails);
      
      // Fallback: open manual entry
      const event = new CustomEvent('openManualForm');
      window.dispatchEvent(event);
    } finally {
      setIsScanning(false);
    }
  }, [isScanning]);

  return (
    <AddBottleContext.Provider value={{ 
      showAddSheet, 
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
