import { useSyncExternalStore } from 'react';
import {
  serviceWorkerUpdateController,
  type UpdateSnapshot,
} from '../utils/serviceWorkerUpdate';

const emptySnapshot: UpdateSnapshot = {
  phase: 'hidden',
  waitingScriptUrl: null,
  waitingUpdateId: null,
  error: null,
  unsaved: null,
};

function getServerSnapshot(): UpdateSnapshot {
  return emptySnapshot;
}

/**
 * Subscribe to the process-wide SW update controller for the update modal UI.
 */
export function useServiceWorkerUpdate() {
  const snapshot = useSyncExternalStore(
    serviceWorkerUpdateController.subscribe,
    serviceWorkerUpdateController.getSnapshot,
    getServerSnapshot,
  );

  return {
    ...snapshot,
    dismissForSession: serviceWorkerUpdateController.dismissForSession,
    returnToPrompt: serviceWorkerUpdateController.returnToPrompt,
    requestUpdate: serviceWorkerUpdateController.requestUpdate,
    retryActivate: serviceWorkerUpdateController.retryActivate,
  };
}
