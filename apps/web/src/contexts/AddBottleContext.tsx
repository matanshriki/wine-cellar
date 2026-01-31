/**
 * Add Bottle Context
 * 
 * Global state management for the Add Bottle flow.
 * Allows the Camera FAB to trigger the Add Bottle sheet from any page.
 */

import { createContext, useContext, useState, ReactNode } from 'react';

interface AddBottleContextType {
  showAddSheet: boolean;
  openAddBottleFlow: () => void;
  closeAddBottleFlow: () => void;
}

const AddBottleContext = createContext<AddBottleContextType | undefined>(undefined);

export function AddBottleProvider({ children }: { children: ReactNode }) {
  const [showAddSheet, setShowAddSheet] = useState(false);

  const openAddBottleFlow = () => {
    setShowAddSheet(true);
  };

  const closeAddBottleFlow = () => {
    setShowAddSheet(false);
  };

  return (
    <AddBottleContext.Provider value={{ showAddSheet, openAddBottleFlow, closeAddBottleFlow }}>
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
