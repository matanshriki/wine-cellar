/**
 * Cellar Agent Page - Clean Rebuild
 */

import { useState, useEffect, useRef, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFeatureFlags } from '../contexts/FeatureFlagsContext';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { listBottles, getBottle, type BottleWithWineInfo } from '../services/bottleService';
import {
  sendAgentMessage,
  transcribeAudio,
  type AgentMessage,
  type BuySuggestion,
  type SendAgentMessageOptions,
} from '../services/agentService';
import { useOpenRitual } from '../contexts/OpenRitualContext';
import {
  listConversations,
  createConversation,
  updateConversation,
  deleteConversation,
  generateConversationTitle,
  type SommelierConversation,
} from '../services/sommelierConversationService';
import { toast } from '../lib/toast';
import { WineLoader } from '../components/WineLoader';
import { WineDetailsModal } from '../components/WineDetailsModal';
import { BottleCarousel, type BottleRecommendation } from '../components/BottleCarousel';
import { BotRichResultCard } from '../components/BotRichResultCard';
import { BottleCarouselLuxury } from '../components/BottleCarouselLuxury';
import { BotSingleWineResultCard } from '../components/BotSingleWineResultCard';
import * as labelArtService from '../services/labelArtService';
import { trackSommelier } from '../services/analytics';
import { addWishlistItem } from '../services/wishlistService';
import { SommelierCreditsDisplay } from '../components/SommelierCreditsDisplay';
import { PricingModal } from '../components/PricingModal';
import { NoCreditsModal } from '../components/NoCreditsModal';
import { useMonetizationAccess } from '../hooks/useMonetizationAccess';
import { useTheme } from '../contexts/ThemeContext';
import { SOMMI_AGENT_ICON_URL } from '../constants/brandAssets';

function formatConversationDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const COLOR_DOTS: Record<string, string> = {
  red: '#8B1A1A',
  white: '#F5E6B8',
  'rosé': '#E8A0BF',
  sparkling: '#FFD700',
};

function BuySuggestionCard({ suggestion, onAddToWishlist }: {
  suggestion: BuySuggestion;
  onAddToWishlist: (s: BuySuggestion) => void;
}) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const handleAdd = async () => {
    setAdding(true);
    try {
      await onAddToWishlist(suggestion);
      setAdded(true);
    } catch {
      // toast handled in parent
    } finally {
      setAdding(false);
    }
  };

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-subtle)',
      borderRadius: '14px',
      padding: '16px',
      boxShadow: 'var(--shadow-card)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        {/* Color dot */}
        {suggestion.color && (
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: COLOR_DOTS[suggestion.color] || '#999',
            border: suggestion.color === 'white' ? '1px solid var(--border-medium)' : 'none',
            flexShrink: 0,
            marginTop: '4px',
          }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {suggestion.title}
            </span>
            {suggestion.priceTier && (
              <span style={{
                fontSize: '12px',
                color: 'var(--wine-600)',
                backgroundColor: 'var(--wine-50)',
                padding: '2px 8px',
                borderRadius: '10px',
                fontWeight: 500,
              }}>
                {suggestion.priceTier}
              </span>
            )}
          </div>
          {suggestion.region && (
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
              {suggestion.region}
            </div>
          )}
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '8px 0 0', lineHeight: 1.5 }}>
            {suggestion.reason}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
        <a
          href={`https://www.vivino.com/search/wines?q=${encodeURIComponent(suggestion.title)}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: '13px',
            color: 'var(--wine-600)',
            textDecoration: 'none',
            padding: '6px 14px',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontWeight: 500,
            transition: 'all 0.15s',
          }}
        >
          <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Vivino
        </a>
        <button
          onClick={handleAdd}
          disabled={adding || added}
          style={{
            fontSize: '13px',
            color: added ? '#16a34a' : '#FFFFFF',
            backgroundColor: added ? '#f0fdf4' : 'var(--wine-600)',
            border: added ? '1px solid #86efac' : 'none',
            padding: '6px 14px',
            borderRadius: '8px',
            cursor: adding || added ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontWeight: 500,
            transition: 'all 0.15s',
          }}
        >
          {added ? (
            <>
              <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {t('cellarSommelier.addedToWishlist', 'Added!')}
            </>
          ) : (
            <>
              <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {adding ? '...' : t('cellarSommelier.addToWishlist', 'Add to Wishlist')}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export function AgentPageWorking() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { flags } = useFeatureFlags();
  const { profile } = useAuth();
  const { openRitual } = useOpenRitual();
  const [loading, setLoading] = useState(true);
  const [bottles, setBottles] = useState<BottleWithWineInfo[]>([]);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const [selectedBottle, setSelectedBottle] = useState<BottleWithWineInfo | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [loadingBottleDetails, setLoadingBottleDetails] = useState(false);
  const [currentConversation, setCurrentConversation] = useState<SommelierConversation | null>(null);
  const [isSavingConversation, setIsSavingConversation] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [noCreditsOpen, setNoCreditsOpen] = useState(false);
  const { creditEnforcementEnabled, effectiveBalance } = useMonetizationAccess();
  const { theme } = useTheme();
  const isDark = theme === 'red';
  /** Tagline / editorial accent: champagne gold on dark, classic gold on light */
  const taglineAccent = isDark ? '#C9A962' : '#8b6914';
  // Always-current ref so handleSend never reads a stale closure value
  const creditBlockedRef = useRef(false);
  creditBlockedRef.current = creditEnforcementEnabled && effectiveBalance === 0;
  const [conversationList, setConversationList] = useState<SommelierConversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const greetingInjectedRef = useRef(false);
  const restoredRef = useRef(false);

  /** Correlates follow-up actions (open, similar, feedback) with the last recommendation turn */
  function buildActionContextFromHistory(
    priorMessages: AgentMessage[]
  ): SendAgentMessageOptions['actionContext'] {
    const lastAssistant = [...priorMessages].reverse().find((m) => m.role === 'assistant');
    if (!lastAssistant) return undefined;
    const eventId = lastAssistant.agentMeta?.eventId;
    let bottleId = lastAssistant.recommendation?.bottleId;
    if (!bottleId && lastAssistant.bottleList?.bottles?.length) {
      bottleId = lastAssistant.bottleList.bottles[0].bottleId;
    }
    if (!eventId && !bottleId) return undefined;
    return {
      lastEventId: eventId,
      lastRecommendationBottleId: bottleId,
    };
  }

  // Track agent page open (once on mount)
  useEffect(() => {
    trackSommelier.agentOpen();
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Feature flag guard
  useEffect(() => {
    if (flags !== null && !flags.cellarAgentEnabled) {
      toast.warning(t('cellarSommelier.notEnabled'));
      navigate('/cellar', { replace: true });
    }
  }, [flags, navigate, t]);

  // Check microphone support
  useEffect(() => {
    if (flags?.cellarAgentEnabled && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      setMicSupported(true);
    }
  }, [flags]);

  // Load bottles + restore most recent conversation on mount
  useEffect(() => {
    async function load() {
      try {
        await loadBottles();
        if (!restoredRef.current) {
          restoredRef.current = true;
          try {
            const conversations = await listConversations();
            setConversationList(conversations);
            if (conversations.length > 0) {
              const mostRecent = conversations[0];
              const msgs = mostRecent.messages || [];
              if (msgs.length > 0) {
                setCurrentConversation(mostRecent);
                setMessages(msgs);
                greetingInjectedRef.current = true;
              }
            }
          } catch {
            // Silent — fall through to fresh greeting
          }
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function buildGreetingMessage(bottleCount: number): AgentMessage {
    const hour = new Date().getHours();
    const timeGreeting =
      hour < 5  ? t('cellarSommelier.greetingEvening')
      : hour < 12 ? t('cellarSommelier.greetingMorning')
      : hour < 17 ? t('cellarSommelier.greetingAfternoon')
      : t('cellarSommelier.greetingEvening');
    return {
      role: 'assistant',
      content: t('cellarSommelier.greetingContent', { greeting: timeGreeting, count: bottleCount }),
      timestamp: new Date().toISOString(),
      isGreeting: true,
    };
  }

  // Inject warm greeting once bottles load (only for fresh sessions with no restored conversation)
  useEffect(() => {
    if (loading || greetingInjectedRef.current || messages.length > 0) return;
    const bottlesInCellar = bottles.filter(b => b.quantity > 0);
    if (bottlesInCellar.length === 0) return;

    greetingInjectedRef.current = true;
    const count = bottlesInCellar.reduce((sum, b) => sum + b.quantity, 0);
    setMessages([buildGreetingMessage(count)]);

    setTimeout(() => inputRef.current?.focus(), 300);
  }, [loading, bottles, messages.length, t]);

  // Refresh greeting when user returns to the tab (only if just a greeting is showing)
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState !== 'visible') return;
      setMessages((prev) => {
        if (prev.length !== 1 || !prev[0].isGreeting) return prev;
        const bottlesInCellar = bottles.filter(b => b.quantity > 0);
        if (bottlesInCellar.length === 0) return prev;
        const count = bottlesInCellar.reduce((sum, b) => sum + b.quantity, 0);
        return [buildGreetingMessage(count)];
      });
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [bottles, t]);

  async function handleSend(text: string) {
    const bottlesInCellar = bottles.filter(bottle => bottle.quantity > 0);
    
    if (!text.trim() || isSubmitting || bottlesInCellar.length === 0) return;

    // Credit enforcement: show luxury interstitial instead of submitting
    if (creditBlockedRef.current) {
      setNoCreditsOpen(true);
      return;
    }

    const userMsg: AgentMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputValue('');
    setIsSubmitting(true);

    try {
      const history = messages.slice(-8);
      const actionContext = buildActionContextFromHistory(messages);
      const response = await sendAgentMessage(text, history, bottlesInCellar, {
        actionContext,
      }, i18n.language);

      const assistantMsg: AgentMessage = {
        role: 'assistant',
        content: response.message || '',
        timestamp: new Date().toISOString(),
        agentMeta: response.agentMeta,
        recommendation: response.recommendation,
        bottleList: response.type === 'bottle_list' && response.bottles ? {
          title: response.title,
          bottles: response.bottles,
        } : undefined,
        buySuggestions: response.type === 'buy_suggestions' && response.suggestions?.length
          ? response.suggestions
          : undefined,
      };

      const finalMessages = [...newMessages, assistantMsg];
      setMessages(finalMessages);
      
      await saveConversation(finalMessages);
    } catch (error: any) {
      toast.error(error.message || 'Failed to get recommendation');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleViewBottleDetails(bottleId: string) {
    setLoadingBottleDetails(true);
    try {
      const bottle = await getBottle(bottleId);
      if (bottle) {
        setSelectedBottle(bottle);
        setShowDetailsModal(true);
      } else {
        toast.error(t('errors.bottleNotFound', 'Bottle not found'));
      }
    } catch (error: any) {
      console.error('[AgentPage] Error loading bottle details:', error);
      toast.error(error.message || t('errors.generic'));
    } finally {
      setLoadingBottleDetails(false);
    }
  }

  function handleCloseDetailsModal() {
    setShowDetailsModal(false);
    setSelectedBottle(null);
  }

  async function handleMarkOpened(bottle: BottleWithWineInfo) {
    await loadBottles();
    handleCloseDetailsModal();
  }

  async function loadBottles() {
    try {
      const data = await listBottles();
      setBottles(data);
    } catch (error) {
      toast.error('Failed to load cellar');
    }
  }

  async function saveConversation(updatedMessages: AgentMessage[]) {
    const persistable = updatedMessages.filter((m) => !m.isGreeting);
    if (persistable.length === 0) return;
    setIsSavingConversation(true);
    try {
      if (currentConversation) {
        const updated = await updateConversation(
          currentConversation.id,
          persistable,
          currentConversation.title
        );
        setCurrentConversation(updated);
        setConversationList((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c))
        );
      } else {
        const title = generateConversationTitle(persistable);
        const created = await createConversation(persistable, title);
        setCurrentConversation(created);
        setConversationList((prev) => [created, ...prev]);
      }
    } catch (error) {
      console.error('Failed to save conversation:', error);
    } finally {
      setIsSavingConversation(false);
    }
  }

  function startNewConversation() {
    greetingInjectedRef.current = false;
    setMessages([]);
    setCurrentConversation(null);
    setSidebarOpen(false);
  }

  function resumeConversation(conv: SommelierConversation) {
    greetingInjectedRef.current = true;
    setCurrentConversation(conv);
    setMessages(conv.messages || []);
    setSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 200);
  }

  async function handleDeleteConversation(convId: string) {
    try {
      await deleteConversation(convId);
      setConversationList((prev) => prev.filter((c) => c.id !== convId));
      if (currentConversation?.id === convId) {
        startNewConversation();
      }
    } catch {
      toast.error(t('errors.generic', 'Something went wrong'));
    }
  }

  async function handleAddBuyToWishlist(suggestion: BuySuggestion) {
    try {
      await addWishlistItem({
        producer: '',
        wineName: suggestion.title,
        vintage: null,
        region: suggestion.region || null,
        country: null,
        grapes: suggestion.grape || null,
        color: (suggestion.color === 'rosé' ? 'rose' : suggestion.color) as 'red' | 'white' | 'rose' | 'sparkling' | null || null,
        imageUrl: null,
        restaurantName: null,
        note: suggestion.reason,
        vivinoUrl: null,
        source: 'sommelier-buy',
        extractionConfidence: null,
      });
      toast.success(t('cellarSommelier.wishlistAdded', 'Added to your wishlist!'));
    } catch (e: any) {
      toast.error(e.message || t('errors.generic', 'Something went wrong'));
      throw e;
    }
  }

  async function openSidebar() {
    setSidebarOpen(true);
    setLoadingConversations(true);
    try {
      const conversations = await listConversations();
      setConversationList(conversations);
    } catch {
      // keep whatever we have
    } finally {
      setLoadingConversations(false);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleTranscribeAudio(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error: any) {
      console.error('Failed to start recording:', error);
      toast.error(t('cellarSommelier.micPermissionDenied'));
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }

  async function handleTranscribeAudio(audioBlob: Blob) {
    setIsTranscribing(true);
    try {
      const data = await transcribeAudio(audioBlob);
      setInputValue(data.text);
      toast.success(t('cellarSommelier.transcriptionSuccess'));
    } catch (error: any) {
      console.error('Transcription error:', error);
      toast.error(error.message || t('cellarSommelier.transcriptionFailed'));
    } finally {
      setIsTranscribing(false);
    }
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--bg)',
      }}>
        <WineLoader variant="default" size="lg" message={t('cellarSommelier.loading')} />
      </div>
    );
  }

  const isRtl = i18n.language === 'he';

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes sommiDotBounce {
          0%, 100% { transform: translateY(0); opacity: 0.85; }
          50% { transform: translateY(-4px); opacity: 1; }
        }
        
        /* Mobile viewport fix: Use dynamic viewport height */
        @supports (height: 100dvh) {
          .agent-container {
            height: 100dvh !important;
          }
        }

        .sidebar-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.35);
          z-index: 40;
          opacity: 0;
          transition: opacity 0.25s ease;
          pointer-events: none;
        }
        .sidebar-overlay.open {
          opacity: 1;
          pointer-events: auto;
        }

        .sidebar-panel {
          position: fixed;
          top: 0;
          bottom: 0;
          width: min(320px, 85vw);
          background: var(--bg-elevated);
          z-index: 50;
          display: flex;
          flex-direction: column;
          box-shadow: var(--shadow-modal);
          transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .sidebar-panel.ltr {
          left: 0;
          transform: translateX(-100%);
        }
        .sidebar-panel.rtl {
          right: 0;
          transform: translateX(100%);
        }
        .sidebar-panel.open {
          transform: translateX(0);
        }

        .sommi-conv-item {
          padding: 14px 16px;
          cursor: pointer;
          border-bottom: 1px solid var(--border-subtle);
          transition: background 0.15s;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .sommi-conv-item:hover { background: var(--interactive-hover); }
        .sommi-conv-item.active {
          background: var(--wine-50);
          border-inline-start: 3px solid var(--wine-600);
        }

        .sommi-conv-delete-btn {
          opacity: 0;
          transition: opacity 0.15s;
          background: none;
          border: none;
          color: var(--text-tertiary);
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          flex-shrink: 0;
        }
        .sommi-conv-delete-btn:hover { color: #dc3545; background: rgba(220, 53, 69, 0.12); }
        .sommi-conv-item:hover .sommi-conv-delete-btn { opacity: 1; }
      `}</style>

      {/* Sidebar overlay */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar panel */}
      <div className={`sidebar-panel ${isRtl ? 'rtl' : 'ltr'} ${sidebarOpen ? 'open' : ''}`}>
        {/* Sidebar header */}
        <div style={{
          padding: '20px 16px 12px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>
            {t('cellarSommelier.conversationHistory', 'Conversations')}
          </h2>
          <button
            onClick={() => setSidebarOpen(false)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-tertiary)', padding: '4px', borderRadius: '6px',
            }}
          >
            <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* New conversation button */}
        <div style={{ padding: '12px 16px', flexShrink: 0 }}>
          <button
            onClick={startNewConversation}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '10px',
              border: '1.5px dashed var(--border-medium)',
              background: 'transparent',
              color: 'var(--wine-600)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.15s',
            }}
          >
            <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('cellarSommelier.newConversation', 'New conversation')}
          </button>
        </div>

        {/* Conversation list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingConversations && conversationList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-tertiary)', fontSize: '14px' }}>
              {t('cellarSommelier.loading', 'Loading...')}
            </div>
          ) : conversationList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-tertiary)', fontSize: '14px' }}>
              {t('cellarSommelier.noConversations', 'No past conversations yet')}
            </div>
          ) : (
            conversationList.map((conv) => {
              const isActive = currentConversation?.id === conv.id;
              const msgCount = (conv.messages || []).filter((m: AgentMessage) => m.role === 'user').length;
              return (
                <div
                  key={conv.id}
                  className={`sommi-conv-item ${isActive ? 'active' : ''}`}
                  onClick={() => resumeConversation(conv)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: isActive ? 600 : 500,
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {conv.title || t('cellarSommelier.newConversation', 'New conversation')}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px', display: 'flex', gap: '8px' }}>
                      <span>{formatConversationDate(conv.last_message_at || conv.updated_at)}</span>
                      <span>·</span>
                      <span>{msgCount} {msgCount === 1 ? t('cellarSommelier.message', 'message') : t('cellarSommelier.messages', 'messages')}</span>
                    </div>
                  </div>
                  <button
                    className="sommi-conv-delete-btn"
                    title={t('cellarSommelier.deleteConversation', 'Delete')}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConversation(conv.id);
                    }}
                  >
                    <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div 
        className="agent-container"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          maxHeight: '-webkit-fill-available',
          backgroundColor: 'var(--bg)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
      <div style={{
        backgroundColor: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '14px 16px',
        flexShrink: 0,
        boxShadow: 'var(--shadow-nav)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            <svg className="flip-rtl" style={{ width: '24px', height: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>{t('cellarSommelier.back')}</span>
          </button>

          <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
            <h1
              style={{
                fontSize: '18px',
                fontWeight: 600,
                color: 'var(--text-heading)',
                margin: 0,
                fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
                letterSpacing: '0.03em',
              }}
            >
              {t('cellarSommelier.title')}
            </h1>
            <p
              style={{
                fontSize: '10px',
                fontWeight: 600,
                color: taglineAccent,
                margin: '3px 0 0',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                lineHeight: 1.25,
              }}
            >
              {t('app.tagline')}
            </p>
            <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: '5px 0 0' }}>
              {t('cellarSommelier.bottleCount', {
                count: bottles.filter((b) => b.quantity > 0).reduce((sum, b) => sum + b.quantity, 0),
              })}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {/* Sommi credits badge — only renders for monetization-enabled users */}
            <SommelierCreditsDisplay
              compact
              onUpgradeClick={() => setPricingOpen(true)}
            />

            {/* History / sidebar toggle */}
            <button
              onClick={openSidebar}
              title={t('cellarSommelier.conversationHistory', 'Conversations')}
              style={{
                padding: '8px',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
              }}
            >
              <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            {/* New conversation */}
            <button
              onClick={startNewConversation}
              disabled={messages.length === 0 || (messages.length === 1 && messages[0].isGreeting)}
              title={t('cellarSommelier.newConversation', 'New conversation')}
              style={{
                padding: '8px',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-secondary)',
                cursor: (messages.length === 0 || (messages.length === 1 && messages[0].isGreeting)) ? 'not-allowed' : 'pointer',
                opacity: (messages.length === 0 || (messages.length === 1 && messages[0].isGreeting)) ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
              }}
            >
              <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 16px 20px',
        position: 'relative',
      }}>
        {/* Empty cellar warning */}
        {bottles.filter(b => b.quantity > 0).length === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            textAlign: 'center',
            padding: '24px',
          }}>
            <div style={{
              padding: '24px',
              backgroundColor: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: '12px',
              maxWidth: '400px',
            }}>
              <svg style={{ width: '48px', height: '48px', color: '#ff9800', margin: '0 auto 16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px', color: '#f57c00' }}>
                {t('cellarSommelier.emptyCellarTitle')}
              </h3>
              <p style={{ fontSize: '14px', marginBottom: '16px', color: '#666' }}>
                {t('cellarSommelier.emptyCellarMessage')}
              </p>
              <button
                onClick={() => navigate('/cellar')}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  backgroundColor: '#7c3030',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('cellarSommelier.emptyCellarButton')}
              </button>
            </div>
          </div>
        )}

        {bottles.filter((b) => b.quantity > 0).length > 0 && (
          <>
            {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          const avatarUrl = isUser ? profile?.avatar_url : null;
          const showAvatar = true;
          const hasMultiBottles = msg.bottleList && msg.bottleList.bottles && msg.bottleList.bottles.length > 0;

          const showQuickStart =
            idx === 0 &&
            msg.role === 'assistant' &&
            msg.isGreeting &&
            messages.length === 1 &&
            bottles.filter((b) => b.quantity > 0).length > 0;

          return (
            <Fragment key={idx}>
            <div
              style={{
                display: 'flex',
                flexDirection: isUser ? 'row-reverse' : 'row',
                gap: '12px',
                marginBottom: '16px',
                alignItems: 'flex-start',
              }}
            >
              {/* Avatar */}
              {showAvatar && (
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: isUser ? 'var(--wine-600)' : 'transparent',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    overflow: 'hidden',
                  }}
                >
                  {isUser ? (
                    avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="User"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      <svg style={{ width: '20px', height: '20px', color: 'white' }} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                    )
                  ) : (
                    <img
                      src={SOMMI_AGENT_ICON_URL}
                      alt="Sommi"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        display: 'block',
                      }}
                    />
                  )}
                </div>
              )}

              {/* Message Content */}
              <div
                style={{
                  maxWidth: hasMultiBottles && !isUser ? '95%' : '75%',
                  width: hasMultiBottles && !isUser ? '100%' : 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {/* Rich Result Layout for Multi-Bottle Bot Responses */}
                {!isUser && hasMultiBottles ? (
                  <>
                    {/* Message text bubble */}
                    {msg.content && (
                      <div
                        style={{
                          padding: '12px 16px',
                          borderRadius: '16px',
                          backgroundColor: 'var(--bg-surface)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-subtle)',
                          boxShadow: 'var(--shadow-card)',
                          maxWidth: '75%',
                        }}
                      >
                        <p style={{ fontSize: '14px', margin: 0, whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                      </div>
                    )}

                    {/* Rich Result Card with Luxury Carousel */}
                    <BotRichResultCard>
                      <BottleCarouselLuxury
                        bottles={msg.bottleList.bottles.map(b => {
                          const bottle = bottles.find(bottle => bottle.id === b.bottleId);
                          const displayImage = bottle ? labelArtService.getWineDisplayImage(bottle.wine) : { imageUrl: null };
                          return {
                            ...b,
                            imageUrl: displayImage.imageUrl,
                          };
                        })}
                        onBottleClick={handleViewBottleDetails}
                      />
                    </BotRichResultCard>
                  </>
                ) : (
                  /* Normal Chat Bubble */
                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius: '16px',
                      backgroundColor: isUser ? 'var(--wine-600)' : 'var(--bg-surface)',
                      color: isUser ? '#FFFFFF' : 'var(--text-primary)',
                      border: !isUser ? '1px solid var(--border-subtle)' : 'none',
                      boxShadow: 'var(--shadow-card)',
                    }}
                  >
                    <p style={{ fontSize: '14px', margin: 0, whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                  </div>
                )}

                {/* Luxury Single Wine Result Card */}
                {!hasMultiBottles && msg.recommendation && (() => {
                  const recommendedBottle = bottles.find(b => b.id === msg.recommendation!.bottleId);
                  if (!recommendedBottle) return null;

                  const displayImage = labelArtService.getWineDisplayImage(recommendedBottle.wine);

                  const handleOpenBottle = () => {
                    openRitual(recommendedBottle, {
                      onComplete: () => {
                        toast.success(t('cellar.markedAsOpened', 'Bottle marked as opened'));
                        loadBottles();
                      },
                    });
                  };

                  const handleViewDetails = () => {
                    handleViewBottleDetails(recommendedBottle.id);
                  };

                  return (
                    <BotSingleWineResultCard
                      bottle={recommendedBottle}
                      reason={msg.recommendation!.reason}
                      serveTemp={msg.recommendation!.serveTemp}
                      decant={msg.recommendation!.decant}
                      imageUrl={displayImage.imageUrl}
                      onOpenBottle={handleOpenBottle}
                      onViewDetails={handleViewDetails}
                    />
                  );
                })()}

                {/* Buy Suggestion Cards */}
                {msg.buySuggestions && msg.buySuggestions.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                    {msg.buySuggestions.map((sug, sIdx) => (
                      <BuySuggestionCard
                        key={sIdx}
                        suggestion={sug}
                        onAddToWishlist={handleAddBuyToWishlist}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {showQuickStart && (
              <div style={{ paddingBottom: '16px' }}>
                <p
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-tertiary)',
                    textAlign: 'center',
                    marginBottom: '12px',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    fontWeight: 500,
                  }}
                >
                  {t('cellarSommelier.quickStartHeader')}
                </p>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px',
                    maxWidth: '520px',
                    margin: '0 auto',
                  }}
                >
                  {[
                    { label: t('cellarSommelier.scenarios.steak.label'),    prompt: t('cellarSommelier.scenarios.steak.prompt') },
                    { label: t('cellarSommelier.scenarios.romantic.label'), prompt: t('cellarSommelier.scenarios.romantic.prompt') },
                    { label: t('cellarSommelier.scenarios.celebrate.label'),prompt: t('cellarSommelier.scenarios.celebrate.prompt') },
                    { label: t('cellarSommelier.scenarios.pizza.label'),    prompt: t('cellarSommelier.scenarios.pizza.prompt') },
                    { label: t('cellarSommelier.scenarios.cheese.label'),   prompt: t('cellarSommelier.scenarios.cheese.prompt') },
                    { label: t('cellarSommelier.scenarios.surprise.label'), prompt: t('cellarSommelier.scenarios.surprise.prompt') },
                  ].map((chip) => (
                    <button
                      key={chip.prompt}
                      type="button"
                      onClick={() => handleSend(chip.prompt)}
                      style={{
                        padding: '14px 14px',
                        fontSize: '13px',
                        cursor: 'pointer',
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '12px',
                        color: 'var(--text-primary)',
                        boxShadow: 'var(--shadow-card)',
                        transition: 'border-color 0.18s ease, box-shadow 0.18s ease, transform 0.12s ease',
                        fontWeight: 500,
                        textAlign: 'center',
                        lineHeight: 1.35,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--wine-600)';
                        e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-subtle)';
                        e.currentTarget.style.boxShadow = 'var(--shadow-card)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                      onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)'; }}
                      onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                      onTouchStart={(e) => {
                        e.currentTarget.style.borderColor = 'var(--wine-600)';
                        e.currentTarget.style.transform = 'scale(0.98)';
                      }}
                      onTouchEnd={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-subtle)';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            </Fragment>
          );
        })}
          </>
        )}

        {/* Loading indicator */}
        {isSubmitting && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '16px' }}>
            <div style={{
              padding: '12px 16px',
              borderRadius: '16px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-card)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--wine-600)',
                    animation: 'sommiDotBounce 1s infinite',
                  }} />
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--wine-600)',
                    animation: 'sommiDotBounce 1s infinite 0.15s',
                  }} />
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--wine-600)',
                    animation: 'sommiDotBounce 1s infinite 0.3s',
                  }} />
                </div>
                <span style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>{t('cellarSommelier.thinking')}</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div style={{
        padding: '16px',
        paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
        backgroundColor: 'var(--bg-elevated)',
        borderTop: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          {/* Text input */}
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(inputValue);
              }
            }}
            placeholder={
              isTranscribing
                ? t('cellarSommelier.inputPlaceholderTranscribing')
                : messages.length <= 1
                ? t('cellarSommelier.inputPlaceholderFirst')
                : t('cellarSommelier.inputPlaceholder')
            }
            disabled={isSubmitting || bottles.filter(b => b.quantity > 0).length === 0 || isRecording || isTranscribing}
            rows={1}
            style={{
              flex: 1,
              padding: '12px 14px',
              fontSize: '16px',
              border: '1px solid var(--border-medium)',
              borderRadius: '14px',
              backgroundColor: 'var(--bg-muted)',
              color: 'var(--text-primary)',
              outline: 'none',
              resize: 'none',
              overflow: 'hidden',
              maxHeight: '120px',
              fontFamily: 'inherit',
            }}
          />

          {/* Microphone button */}
          {micSupported && (
            <button
              type="button"
              onClick={() => {
                if (isRecording) {
                  stopRecording();
                } else {
                  startRecording();
                }
              }}
              disabled={isSubmitting || bottles.filter(b => b.quantity > 0).length === 0 || isTranscribing}
              title={isRecording ? t('cellarSommelier.micButtonStop') : t('cellarSommelier.micButton')}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: isRecording ? '2px solid #dc3545' : '1px solid var(--border-medium)',
                cursor: isSubmitting || bottles.filter(b => b.quantity > 0).length === 0 || isTranscribing ? 'not-allowed' : 'pointer',
                backgroundColor: isRecording ? '#ffe5e5' : 'var(--bg-surface)',
                color: isRecording ? '#dc3545' : 'var(--text-secondary)',
                transition: 'all 0.2s',
                flexShrink: 0,
                animation: isRecording ? 'pulse 1.5s infinite' : 'none',
              }}
            >
              {isTranscribing ? (
                <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg style={{ width: '20px', height: '20px' }} fill={isRecording ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>
          )}

          {/* Send button */}
          <button
            type="button"
            onClick={() => {
              handleSend(inputValue);
            }}
            disabled={isSubmitting || !inputValue.trim() || bottles.filter(b => b.quantity > 0).length === 0 || isRecording}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              cursor: inputValue.trim() && !isSubmitting && bottles.filter(b => b.quantity > 0).length > 0 && !isRecording ? 'pointer' : 'not-allowed',
              backgroundColor: inputValue.trim() && !isSubmitting && bottles.filter(b => b.quantity > 0).length > 0 && !isRecording ? 'var(--wine-600)' : 'var(--border-strong)',
              color: '#FFFFFF',
              transition: 'all 0.2s',
              flexShrink: 0,
            }}
          >
            <svg 
              style={{ 
                width: '20px', 
                height: '20px',
                transform: `rotate(${i18n.language === 'he' ? '-90' : '90'}deg)`,
              }} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
      </div>

      {/* Wine Details Modal */}
      <WineDetailsModal
        isOpen={showDetailsModal}
        onClose={handleCloseDetailsModal}
        bottle={selectedBottle}
        onMarkAsOpened={handleMarkOpened}
        onRefresh={loadBottles}
      />

      {/* Sommi credits pricing modal — dark launch, only for monetization-enabled users */}
      <PricingModal
        isOpen={pricingOpen}
        onClose={() => setPricingOpen(false)}
      />

      {/* No-credits interstitial — shown when enforcement is on and balance hits 0 */}
      <NoCreditsModal
        isOpen={noCreditsOpen}
        onClose={() => setNoCreditsOpen(false)}
        context="chat"
      />
    </>
  );
}
