/**
 * NotificationEnableCard
 *
 * User-initiated Web Push enable/disable. Explains denied / unsupported /
 * iOS-needs-Home-Screen states. Countdown timers work without enabling this.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  disablePushNotificationsForThisDevice,
  enablePushNotifications,
  getActivePushSubscription,
  getPushPermissionState,
  type PushPermissionState,
} from '../services/pushNotificationService';

interface NotificationEnableCardProps {
  userId: string | null;
  /** Compact row for Open Ritual / timer surfaces */
  compact?: boolean;
  className?: string;
}

export function NotificationEnableCard({
  userId,
  compact = false,
  className = '',
}: NotificationEnableCardProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<PushPermissionState>(() => getPushPermissionState());
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setState(getPushPermissionState());
    const sub = await getActivePushSubscription();
    setSubscribed(!!sub);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, userId]);

  async function handleEnable() {
    if (!userId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await enablePushNotifications(userId);
      setState(result.state);
      if (!result.ok) {
        setError(
          result.error ||
            t('notifications.enableFailed', 'Could not enable notifications on this device.'),
        );
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await disablePushNotificationsForThisDevice(userId);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const statusMessage = (() => {
    switch (state) {
      case 'unsupported':
        return t(
          'notifications.unsupported',
          'Notifications are not supported in this browser.',
        );
      case 'needs_standalone':
        return t(
          'notifications.needsStandalone',
          'On iPhone, add Sommi to your Home Screen first, then enable alerts from the installed app.',
        );
      case 'denied':
        return t(
          'notifications.denied',
          'Notifications are blocked. Enable them in your device or browser settings for Sommi.',
        );
      case 'no_vapid_key':
        return t(
          'notifications.notConfigured',
          'Push alerts are not configured on this environment yet.',
        );
      case 'granted':
        return subscribed
          ? t('notifications.enabled', 'Alerts are on for this device.')
          : t(
              'notifications.grantedNotSubscribed',
              'Permission is granted — tap Enable to register this device.',
            );
      default:
        return t(
          'notifications.help',
          'Get an alert when decanting finishes or it is time to rate — even if Sommi is closed.',
        );
    }
  })();

  const canEnable =
    !!userId &&
    !subscribed &&
    (state === 'default' || state === 'granted');

  const showDisable = subscribed && state === 'granted';

  // Compact nudge: hide when already subscribed, unsupported, or not configured
  if (
    compact &&
    (showDisable ||
      state === 'unsupported' ||
      state === 'no_vapid_key')
  ) {
    return null;
  }

  if (compact) {
    return (
      <div
        className={`rounded-xl px-3 py-2.5 text-left ${className}`}
        style={{
          background: 'var(--bg-muted)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <p className="text-xs leading-snug mb-2" style={{ color: 'var(--text-secondary)' }}>
          {statusMessage}
        </p>
        {error && (
          <p className="text-xs mb-2" style={{ color: 'var(--wine-700, #8b1a1a)' }}>
            {error}
          </p>
        )}
        {canEnable && (
          <button
            type="button"
            disabled={busy}
            onClick={handleEnable}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
            style={{ background: 'var(--wine-600)', opacity: busy ? 0.7 : 1 }}
          >
            {busy
              ? '…'
              : t('notifications.enable', 'Enable alerts')}
          </button>
        )}
        {showDisable && (
          <button
            type="button"
            disabled={busy}
            onClick={handleDisable}
            className="text-xs font-medium px-3 py-1.5 rounded-lg"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {t('notifications.disableThisDevice', 'Disable on this device')}
          </button>
        )}
      </div>
    );
  }

  return (
    <section
      className={`rounded-2xl p-4 ${className}`}
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <h3
        className="text-sm font-semibold mb-1"
        style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
      >
        {t('notifications.title', 'Reminder alerts')}
      </h3>
      <p className="text-sm mb-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {statusMessage}
      </p>
      {error && (
        <p className="text-sm mb-3" style={{ color: 'var(--wine-700, #8b1a1a)' }}>
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {canEnable && (
          <button
            type="button"
            disabled={busy || !userId}
            onClick={handleEnable}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'var(--wine-600)', opacity: busy ? 0.7 : 1 }}
          >
            {busy ? '…' : t('notifications.enable', 'Enable alerts')}
          </button>
        )}
        {showDisable && (
          <button
            type="button"
            disabled={busy}
            onClick={handleDisable}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {t('notifications.disableThisDevice', 'Disable on this device')}
          </button>
        )}
      </div>
      <p className="text-xs mt-3" style={{ color: 'var(--text-tertiary)' }}>
        {t(
          'notifications.countdownNote',
          'In-app countdowns work even if alerts are off. Other signed-in devices keep their own alert settings.',
        )}
      </p>
    </section>
  );
}
