/**
 * What Sommi remembers — Profile card for explicit conversational preferences.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from '../lib/toast';
import { WineLoader } from './WineLoader';
import * as tasteProfileService from '../services/tasteProfileService';
import {
  countPublicSommiMemory,
  extractPublicSommiMemory,
  mutateSommiMemory,
  previewMemoryLabels,
  resolveOperationIdForAttempt,
  type PublicMemoryItem,
  type PublicSommiMemory,
  type SommiMemoryMutation,
} from '../services/sommiMemoryService';

type ConfirmState = {
  title: string;
  message: string;
  confirmText: string;
  mutation: SommiMemoryMutation;
  label: string;
};

export function SommiMemoryCard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const manageButtonRef = useRef<HTMLButtonElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [memory, setMemory] = useState<PublicSommiMemory | null>(null);
  const [showManage, setShowManage] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  /** Set on confirm submit; reused for retries of the same unresolved mutation. */
  const [activeOperationId, setActiveOperationId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [i18n.language]);

  async function load() {
    setLoading(true);
    try {
      const profile = await tasteProfileService.getMyTasteProfile();
      setMemory(extractPublicSommiMemory(profile, i18n.language, t));
    } catch (e) {
      console.error('[SommiMemoryCard] load failed', e);
      setMemory(null);
    } finally {
      setLoading(false);
    }
  }

  function openManage() {
    setShowManage(true);
  }

  function closeManage() {
    if (busyKey) return;
    setShowManage(false);
    setConfirm(null);
    setActiveOperationId(null);
    requestAnimationFrame(() => manageButtonRef.current?.focus());
  }

  function beginConfirm(next: ConfirmState) {
    // Changing target action/item always starts a new logical operation.
    setActiveOperationId(null);
    setConfirm(next);
  }

  function requestRemoveTerm(
    dimension: 'region' | 'grape' | 'style',
    polarity: 'like' | 'dislike',
    item: PublicMemoryItem
  ) {
    const mutation: SommiMemoryMutation =
      dimension === 'region'
        ? { type: 'remove_region', polarity, id: item.id }
        : dimension === 'grape'
          ? { type: 'remove_grape', polarity, id: item.id }
          : { type: 'remove_style', polarity, id: item.id };
    beginConfirm({
      title: t('sommiMemory.removeTitle', 'Remove preference?'),
      message: t('sommiMemory.removeMessage', {
        label: item.label,
        defaultValue: `Remove “${item.label}” from what Sommi remembers?`,
      }),
      confirmText: t('sommiMemory.removeConfirm', 'Remove'),
      mutation,
      label: item.label,
    });
  }

  function requestBodyChange(next: 'light' | 'medium' | 'full' | 'clear') {
    if (!memory?.body) return;
    if (next === 'clear') {
      beginConfirm({
        title: t('sommiMemory.clearBodyTitle', 'Remove body preference?'),
        message: t(
          'sommiMemory.clearBodyMessage',
          'Sommi will no longer use your saved body preference until you tell it again in chat.'
        ),
        confirmText: t('sommiMemory.removeConfirm', 'Remove'),
        mutation: { type: 'clear_body', from: memory.body.value },
        label: memory.body.label,
      });
      return;
    }
    if (next === memory.body.value) return;
    const nextLabel = t(`sommiMemory.body${next.charAt(0).toUpperCase()}${next.slice(1)}`, next);
    beginConfirm({
      title: t('sommiMemory.replaceBodyTitle', 'Update body preference?'),
      message: t('sommiMemory.replaceBodyMessage', {
        from: memory.body.label,
        to: nextLabel,
        defaultValue: `Change preferred body from ${memory.body.label} to ${nextLabel}?`,
      }),
      confirmText: t('sommiMemory.replaceConfirm', 'Update'),
      mutation: { type: 'replace_body', value: next, from: memory.body.value },
      label: nextLabel,
    });
  }

  async function runConfirmedMutation() {
    // Double-click / re-entry: one in-flight request, one operation ID.
    if (!confirm || busyKey) return;
    const key = JSON.stringify(confirm.mutation);
    const operationId = resolveOperationIdForAttempt(activeOperationId);
    setActiveOperationId(operationId);
    setBusyKey(key);
    try {
      const result = await mutateSommiMemory(confirm.mutation, i18n.language, operationId);
      if (result.ok === false) {
        toast.error(result.message || t('sommiMemory.updateFailed', 'Could not update preference'));
        if (result.memory) setMemory(result.memory);
        if (!result.retainOperationId) setActiveOperationId(null);
        return;
      }
      setMemory(result.memory);
      setConfirm(null);
      setActiveOperationId(null);
      toast.success(t('sommiMemory.updateSuccess', 'Preference updated'));
    } catch (e: any) {
      // Unknown failure — retain operationId for retry.
      toast.error(e?.message || t('sommiMemory.updateFailed', 'Could not update preference'));
    } finally {
      setBusyKey(null);
    }
  }

  if (loading) {
    return (
      <div className="card mt-6">
        <div className="flex justify-center py-8">
          <WineLoader />
        </div>
      </div>
    );
  }

  const view = memory ?? {
    regions_liked: [],
    regions_disliked: [],
    grapes_liked: [],
    grapes_disliked: [],
    styles_liked: [],
    styles_disliked: [],
    body: null,
  };
  const count = countPublicSommiMemory(view);
  const preview = previewMemoryLabels(view);
  const isEmpty = count === 0;

  return (
    <>
      <div className="card mt-6" data-testid="sommi-memory-card">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgba(139,105,20,0.12), rgba(201,169,98,0.08))',
                border: '1px solid var(--border-subtle)',
              }}
              aria-hidden
            >
              <span className="text-lg">✦</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('sommiMemory.title', 'What Sommi remembers about me')}
              </h2>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                {t(
                  'sommiMemory.subtitle',
                  'Preferences you explicitly shared with Sommi in chat — separate from taste learned from ratings.'
                )}
              </p>
            </div>
          </div>
          {!isEmpty && (
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0"
              style={{
                background: 'var(--bg-surface-elevated)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {t('sommiMemory.count', { count, defaultValue: `${count} saved` })}
            </span>
          )}
        </div>

        {isEmpty ? (
          <div className="rounded-xl px-4 py-5 text-center" style={{ background: 'var(--bg-muted)' }}>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t(
                'sommiMemory.empty',
                'No explicit preferences saved yet. Sommi still learns separately from the wines you rate.'
              )}
            </p>
            <button
              type="button"
              className="btn btn-primary mt-4 min-h-[44px]"
              onClick={() => navigate('/agent')}
              data-testid="sommi-memory-tell-cta"
            >
              {t('sommiMemory.tellSommi', 'Tell Sommi')}
            </button>
          </div>
        ) : (
          <>
            {preview.labels.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {preview.labels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full px-3 py-1 text-xs"
                    style={{
                      background: 'var(--bg-surface-elevated)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    {label}
                  </span>
                ))}
                {preview.moreCount > 0 && (
                  <span
                    className="rounded-full px-3 py-1 text-xs"
                    style={{
                      background: 'var(--bg-surface-elevated)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    {t('sommiMemory.moreCount', {
                      count: preview.moreCount,
                      defaultValue: `+${preview.moreCount} more`,
                    })}
                  </span>
                )}
              </div>
            )}
            <button
              ref={manageButtonRef}
              type="button"
              className="btn btn-secondary w-full sm:w-auto min-h-[44px]"
              onClick={openManage}
              data-testid="sommi-memory-manage"
            >
              {t('sommiMemory.manage', 'Manage')}
            </button>
          </>
        )}
      </div>

      <AnimatePresence>
        {showManage && (
          <MemoryManageOverlay
            memory={view}
            busyKey={busyKey}
            onClose={closeManage}
            onRemoveTerm={requestRemoveTerm}
            onBodyChange={requestBodyChange}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirm && (
          <LuxuryConfirm
            title={confirm.title}
            message={confirm.message}
            confirmText={confirm.confirmText}
            busy={!!busyKey}
            onCancel={() => {
              if (busyKey) return;
              setConfirm(null);
              setActiveOperationId(null);
            }}
            onConfirm={() => void runConfirmedMutation()}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function MemoryManageOverlay(props: {
  memory: PublicSommiMemory;
  busyKey: string | null;
  onClose: () => void;
  onRemoveTerm: (
    dimension: 'region' | 'grape' | 'style',
    polarity: 'like' | 'dislike',
    item: PublicMemoryItem
  ) => void;
  onBodyChange: (next: 'light' | 'medium' | 'full' | 'clear') => void;
}) {
  const { t } = useTranslation();
  const { memory, busyKey, onClose, onRemoveTerm, onBodyChange } = props;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busyKey) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busyKey, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4"
      style={{
        background: 'var(--bg-overlay)',
        backdropFilter: 'var(--blur-medium)',
        WebkitBackdropFilter: 'var(--blur-medium)',
        paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sommi-memory-manage-title"
      onClick={() => {
        if (!busyKey) onClose();
      }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-xl)',
          maxHeight: '100%',
        }}
      >
        <div className="px-6 pt-6 pb-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3
                id="sommi-memory-manage-title"
                className="text-xl font-bold"
                style={{ color: 'var(--text-primary)' }}
              >
                {t('sommiMemory.manageTitle', 'Manage remembered preferences')}
              </h3>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                {t(
                  'sommiMemory.manageSubtitle',
                  'Remove or update what you told Sommi. This does not change calibration sliders.'
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={!!busyKey}
              className="w-10 h-10 rounded-lg flex items-center justify-center min-h-[44px] min-w-[44px]"
              style={{ background: 'var(--bg-surface-elevated)', color: 'var(--text-tertiary)' }}
              aria-label={t('common.close', 'Close')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div
          className="px-6 py-5 space-y-6 flex-1 overflow-y-auto"
          style={{ WebkitOverflowScrolling: 'touch', minHeight: 0 }}
        >
          {memory.body && (
            <section>
              <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                {t('sommiMemory.sectionBody', 'Preferred body')}
              </h4>
              <div className="flex flex-wrap gap-2 mb-3">
                {(['light', 'medium', 'full'] as const).map((value) => {
                  const selected = memory.body?.value === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={!!busyKey}
                      onClick={() => onBodyChange(value)}
                      className="rounded-full px-4 py-2 text-sm min-h-[44px]"
                      style={{
                        background: selected
                          ? 'linear-gradient(135deg, rgba(139,105,20,0.18), rgba(201,169,98,0.12))'
                          : 'var(--bg-surface-elevated)',
                        color: 'var(--text-primary)',
                        border: selected
                          ? '1px solid rgba(139,105,20,0.35)'
                          : '1px solid var(--border-subtle)',
                      }}
                      aria-pressed={selected}
                    >
                      {t(
                        `sommiMemory.body${value.charAt(0).toUpperCase()}${value.slice(1)}`,
                        value
                      )}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="text-sm underline min-h-[44px]"
                style={{ color: 'var(--text-secondary)' }}
                disabled={!!busyKey}
                onClick={() => onBodyChange('clear')}
              >
                {t('sommiMemory.clearBody', 'Remove preference')}
              </button>
            </section>
          )}

          <TermSection
            title={t('sommiMemory.sectionRegionsLiked', 'Liked regions')}
            items={memory.regions_liked}
            busy={!!busyKey}
            onRemove={(item) => onRemoveTerm('region', 'like', item)}
          />
          <TermSection
            title={t('sommiMemory.sectionRegionsDisliked', 'Disliked regions')}
            items={memory.regions_disliked}
            busy={!!busyKey}
            onRemove={(item) => onRemoveTerm('region', 'dislike', item)}
          />
          <TermSection
            title={t('sommiMemory.sectionGrapesLiked', 'Liked grapes')}
            items={memory.grapes_liked}
            busy={!!busyKey}
            onRemove={(item) => onRemoveTerm('grape', 'like', item)}
          />
          <TermSection
            title={t('sommiMemory.sectionGrapesDisliked', 'Disliked grapes')}
            items={memory.grapes_disliked}
            busy={!!busyKey}
            onRemove={(item) => onRemoveTerm('grape', 'dislike', item)}
          />
          <TermSection
            title={t('sommiMemory.sectionStylesLiked', 'Liked styles')}
            items={memory.styles_liked}
            busy={!!busyKey}
            onRemove={(item) => onRemoveTerm('style', 'like', item)}
          />
          <TermSection
            title={t('sommiMemory.sectionStylesDisliked', 'Disliked styles')}
            items={memory.styles_disliked}
            busy={!!busyKey}
            onRemove={(item) => onRemoveTerm('style', 'dislike', item)}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

function TermSection(props: {
  title: string;
  items: PublicMemoryItem[];
  busy: boolean;
  onRemove: (item: PublicMemoryItem) => void;
}) {
  const { t } = useTranslation();
  if (!props.items.length) return null;
  return (
    <section>
      <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
        {props.title}
      </h4>
      <ul className="space-y-2">
        {props.items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-3 rounded-xl px-3 py-2"
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
              {item.label}
            </span>
            <button
              type="button"
              className="min-h-[44px] min-w-[44px] px-2 text-sm font-medium"
              style={{ color: '#B91C1C' }}
              disabled={props.busy}
              aria-label={t('sommiMemory.removeAria', {
                label: item.label,
                defaultValue: `Remove ${item.label}`,
              })}
              onClick={() => props.onRemove(item)}
            >
              {t('sommiMemory.remove', 'Remove')}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LuxuryConfirm(props: {
  title: string;
  message: string;
  confirmText: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[110]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sommi-memory-confirm-title"
      onClick={props.onCancel}
      style={{ backdropFilter: 'blur(4px)' }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'tween', duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-soft)',
        }}
      >
        <div className="px-6 py-5 border-b" style={{ borderColor: 'var(--border-soft)' }}>
          <h3
            id="sommi-memory-confirm-title"
            className="text-xl font-bold"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
          >
            {props.title}
          </h3>
        </div>
        <div className="px-6 py-6">
          <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
            {props.message}
          </p>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button
            type="button"
            className="btn btn-secondary flex-1 min-h-[44px]"
            disabled={props.busy}
            onClick={props.onCancel}
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            className="flex-1 min-h-[44px] rounded-xl text-white font-semibold disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #DC2626, #991B1B)',
            }}
            disabled={props.busy}
            onClick={props.onConfirm}
          >
            {props.busy ? t('sommiMemory.updating', 'Updating…') : props.confirmText}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
