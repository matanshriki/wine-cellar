/**
 * Add Bottle Flow Hook
 * 
 * Extracts the "Add Bottle" flow logic into a reusable hook
 * for use in both the traditional button and the mobile Camera FAB.
 */

import { useState } from 'react';

export function useAddBottleFlow() {
  const [showAddSheet, setShowAddSheet] = useState(false);

  /**
   * Open the Add Bottle sheet with options:
   * - Upload Photo (camera or gallery)
   * - Manual Entry
   * - Multi-bottle import (if enabled)
   */
  const openAddBottleFlow = () => {
    setShowAddSheet(true);
  };

  /**
   * Close the Add Bottle sheet
   */
  const closeAddBottleFlow = () => {
    setShowAddSheet(false);
  };

  return {
    showAddSheet,
    openAddBottleFlow,
    closeAddBottleFlow,
  };
}
