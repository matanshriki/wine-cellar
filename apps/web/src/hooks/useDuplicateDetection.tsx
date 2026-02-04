/**
 * useDuplicateDetection Hook
 * 
 * Provides duplicate detection functionality with modal UI
 * Easy to integrate into any bottle-adding flow
 * 
 * Usage:
 * ```tsx
 * const { checkAndHandle, DuplicateModal } = useDuplicateDetection({
 *   onAddQuantity: (bottleId, quantity) => { ... },
 *   onCreateSeparate: () => { ... },
 * });
 * 
 * // Before adding bottle:
 * const duplicate = await checkAndHandle(candidateWine);
 * if (duplicate) return; // Modal will handle it
 * 
 * // Continue with normal add flow
 * ```
 */

import { useState } from 'react';
import { DuplicateBottleModal } from '../components/DuplicateBottleModal';
import { checkForDuplicate, incrementBottleQuantity, type ExistingBottle } from '../services/duplicateDetectionService';

interface UseDuplicateDetectionProps {
  onAddQuantity?: (bottleId: string, quantity: number, existingBottle: ExistingBottle) => void | Promise<void>;
  onCreateSeparate?: (candidate: any) => void | Promise<void>;
}

export function useDuplicateDetection(props?: UseDuplicateDetectionProps) {
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<ExistingBottle | null>(null);
  const [pendingCandidate, setPendingCandidate] = useState<any>(null);

  /**
   * Check for duplicate and show modal if found
   * Returns true if duplicate found (modal will handle), false if no duplicate
   */
  const checkAndHandle = async (candidate: {
    producer?: string | null;
    name?: string | null;
    vintage?: number | null;
  }): Promise<boolean> => {
    console.log('[useDuplicateDetection] Checking candidate:', candidate);
    
    const duplicate = await checkForDuplicate(candidate);
    
    if (duplicate) {
      console.log('[useDuplicateDetection] Duplicate found, showing modal');
      setDuplicateInfo(duplicate);
      setPendingCandidate(candidate);
      setShowDuplicateModal(true);
      return true; // Duplicate found
    }
    
    console.log('[useDuplicateDetection] No duplicate, proceed with add');
    return false; // No duplicate, proceed with add
  };

  /**
   * Handle adding quantity to existing bottle
   */
  const handleAddQuantity = async (quantity: number) => {
    if (!duplicateInfo) return;
    
    console.log('[useDuplicateDetection] Adding', quantity, 'to bottle', duplicateInfo.id);
    
    try {
      // Increment quantity in database
      await incrementBottleQuantity(duplicateInfo.id, quantity);
      
      // Call custom handler if provided
      if (props?.onAddQuantity) {
        await props.onAddQuantity(duplicateInfo.id, quantity, duplicateInfo);
      }
      
      // Close modal
      setShowDuplicateModal(false);
      setDuplicateInfo(null);
      setPendingCandidate(null);
    } catch (error) {
      console.error('[useDuplicateDetection] Error adding quantity:', error);
      throw error;
    }
  };

  /**
   * Handle creating separate entry (user override)
   */
  const handleCreateSeparate = async () => {
    console.log('[useDuplicateDetection] User chose to create separate entry');
    
    if (props?.onCreateSeparate && pendingCandidate) {
      await props.onCreateSeparate(pendingCandidate);
    }
    
    // Close modal
    setShowDuplicateModal(false);
    setDuplicateInfo(null);
    setPendingCandidate(null);
  };

  /**
   * Close modal without action
   */
  const handleClose = () => {
    console.log('[useDuplicateDetection] Modal closed');
    setShowDuplicateModal(false);
    setDuplicateInfo(null);
    setPendingCandidate(null);
  };

  // Modal component to render
  const DuplicateModal = duplicateInfo ? (
    <DuplicateBottleModal
      isOpen={showDuplicateModal}
      onClose={handleClose}
      existingWine={{
        id: duplicateInfo.wine_id,
        name: duplicateInfo.wine.name || '',
        producer: duplicateInfo.wine.producer || undefined,
        vintage: duplicateInfo.wine.vintage || undefined,
        style: duplicateInfo.wine.style,
        rating: duplicateInfo.wine.rating || undefined,
        quantity: duplicateInfo.quantity,
        label_image_url: duplicateInfo.wine.label_image_url || undefined,
      }}
      onAddQuantity={handleAddQuantity}
      onCreateSeparate={props?.onCreateSeparate ? handleCreateSeparate : undefined}
    />
  ) : null;

  return {
    checkAndHandle,
    DuplicateModal,
    isShowingDuplicateModal: showDuplicateModal,
  };
}
