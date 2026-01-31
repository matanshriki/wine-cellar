/**
 * Cellar Agent Page - Clean Rebuild
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFeatureFlags } from '../contexts/FeatureFlagsContext';
import { useAuth } from '../contexts/SupabaseAuthContext';
import { listBottles, getBottle, type BottleWithWineInfo } from '../services/bottleService';
import { sendAgentMessage, transcribeAudio, type AgentMessage } from '../services/agentService';
import {
  listConversations,
  createConversation,
  updateConversation,
  generateConversationTitle,
  type SommelierConversation,
} from '../services/sommelierConversationService';
import { toast } from '../lib/toast';
import { WineLoader } from '../components/WineLoader';
import { WineDetailsModal } from '../components/WineDetailsModal';
import { BottleCarousel, type BottleRecommendation } from '../components/BottleCarousel';
import { BotRichResultCard } from '../components/BotRichResultCard';
import { BottleCarouselLuxury } from '../components/BottleCarouselLuxury';

export function AgentPageWorking() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { flags } = useFeatureFlags();
  const { profile } = useAuth();
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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

  // Load bottles and most recent conversation once
  useEffect(() => {
    async function load() {
      try {
        await loadBottles();
        await loadMostRecentConversation();
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSend(text: string) {
    // Filter bottles in cellar (quantity > 0) - same logic as CellarPage
    const bottlesInCellar = bottles.filter(bottle => bottle.quantity > 0);
    
    if (!text.trim() || isSubmitting || bottlesInCellar.length === 0) return;

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
      const response = await sendAgentMessage(text, history, bottlesInCellar);

      const assistantMsg: AgentMessage = {
        role: 'assistant',
        content: response.message || '',
        timestamp: new Date().toISOString(),
        recommendation: response.recommendation,
        bottleList: response.type === 'bottle_list' && response.bottles ? {
          title: response.title,
          bottles: response.bottles,
        } : undefined,
      };

      const finalMessages = [...newMessages, assistantMsg];
      setMessages(finalMessages);
      
      // Auto-save conversation after each exchange
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
    // Reload bottles after marking as opened
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

  async function loadMostRecentConversation() {
    try {
      const conversations = await listConversations();
      if (conversations.length > 0) {
        const mostRecent = conversations[0];
        setCurrentConversation(mostRecent);
        setMessages(mostRecent.messages || []);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
      // Don't show error toast - just start fresh
    }
  }

  async function saveConversation(updatedMessages: AgentMessage[]) {
    setIsSavingConversation(true);
    try {
      if (currentConversation) {
        // Update existing conversation
        const updated = await updateConversation(
          currentConversation.id,
          updatedMessages,
          currentConversation.title
        );
        setCurrentConversation(updated);
      } else {
        // Create new conversation with auto-generated title
        const title = generateConversationTitle(updatedMessages);
        const created = await createConversation(updatedMessages, title);
        setCurrentConversation(created);
      }
    } catch (error) {
      console.error('Failed to save conversation:', error);
      // Silent fail - don't disrupt user experience
    } finally {
      setIsSavingConversation(false);
    }
  }

  function startNewConversation() {
    setMessages([]);
    setCurrentConversation(null);
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
        backgroundColor: '#f8f9fa',
      }}>
        <WineLoader variant="default" size="lg" message={t('cellarSommelier.loading')} />
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        /* Mobile viewport fix: Use dynamic viewport height */
        @supports (height: 100dvh) {
          .agent-container {
            height: 100dvh !important;
          }
        }
      `}</style>
      <div 
        className="agent-container"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          maxHeight: '-webkit-fill-available',
          backgroundColor: '#f8f9fa',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
      <div style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e0e0e0',
        padding: '16px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'none',
              border: 'none',
              color: '#666',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            <svg className="flip-rtl" style={{ width: '24px', height: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>{t('cellarSommelier.back')}</span>
          </button>

          <div style={{ textAlign: 'center', flex: 1 }}>
            <h1 style={{ fontSize: '18px', fontWeight: 'bold', color: '#333', margin: 0 }}>
              {t('cellarSommelier.title')}
            </h1>
            <p style={{ fontSize: '12px', color: '#999', margin: 0 }}>
              {t('cellarSommelier.bottleCount', { count: bottles.filter(b => b.quantity > 0).reduce((sum, b) => sum + b.quantity, 0) })}
            </p>
          </div>

          <button
            onClick={startNewConversation}
            disabled={messages.length === 0}
            title={t('cellarSommelier.newConversation', 'New conversation')}
            style={{
              padding: '8px',
              borderRadius: '8px',
              border: '1px solid #e0e0e0',
              backgroundColor: 'white',
              color: '#666',
              cursor: messages.length === 0 ? 'not-allowed' : 'pointer',
              opacity: messages.length === 0 ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (messages.length > 0) {
                e.currentTarget.style.backgroundColor = '#f8f9fa';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
            }}
          >
            <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        position: 'relative',
      }}>
        {/* Empty state */}
        {messages.length === 0 && bottles.filter(b => b.quantity > 0).length > 0 && (
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
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
              border: '3px solid #7c3030',
            }}>
              <img
                src="/assets/sommelier-icon.png"
                alt="Sommelier"
                style={{
                  width: '48px',
                  height: '48px',
                  objectFit: 'contain',
                }}
              />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>
              {t('cellarSommelier.emptyTitle')}
            </h2>
            <p style={{ fontSize: '14px', marginBottom: '24px', color: '#666', maxWidth: '320px' }}>
              {t('cellarSommelier.emptySubtitle')}
            </p>

            {/* Quick prompts */}
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '12px', 
              width: '100%', 
              maxWidth: '320px',
            }}>
              {[
                t('cellarSommelier.quickPrompts.tonight'),
                t('cellarSommelier.quickPrompts.readyNow'),
                t('cellarSommelier.quickPrompts.pairSteak')
              ].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    console.log('Button clicked:', prompt);
                    setInputValue(prompt);
                    handleSend(prompt);
                  }}
                  style={{
                    padding: '14px 20px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    backgroundColor: 'white',
                    border: '1px solid #ddd',
                    borderRadius: '12px',
                    color: '#333',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    transition: 'all 0.2s',
                    fontWeight: 500,
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = 'scale(0.98)';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8f9fa';
                    e.currentTarget.style.borderColor = '#7c3030';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.borderColor = '#ddd';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

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

        {/* Messages */}
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          const avatarUrl = isUser ? profile?.avatar_url : null;
          const showAvatar = true;
          const hasMultiBottles = msg.bottleList && msg.bottleList.bottles && msg.bottleList.bottles.length > 0;

          return (
            <div
              key={idx}
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
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: isUser ? '#7c3030' : '#f8f9fa',
                    border: isUser ? 'none' : '2px solid #7c3030',
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
                    // Sommelier avatar - elegant sommelier image
                    <img
                      src="/assets/sommelier-icon.png"
                      alt="Sommelier"
                      style={{
                        width: '28px',
                        height: '28px',
                        objectFit: 'contain',
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
                          backgroundColor: 'white',
                          color: '#333',
                          border: '1px solid #e0e0e0',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                          maxWidth: '75%',
                        }}
                      >
                        <p style={{ fontSize: '14px', margin: 0, whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                      </div>
                    )}

                    {/* Rich Result Card with Luxury Carousel */}
                    <BotRichResultCard>
                      <BottleCarouselLuxury
                        bottles={msg.bottleList.bottles.map(b => ({
                          ...b,
                          imageUrl: bottles.find(bottle => bottle.id === b.bottleId)?.wine.user_image_url || 
                                   bottles.find(bottle => bottle.id === b.bottleId)?.wine.ai_label_url || 
                                   null,
                        }))}
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
                      backgroundColor: isUser ? '#7c3030' : 'white',
                      color: isUser ? 'white' : '#333',
                      border: !isUser ? '1px solid #e0e0e0' : 'none',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    }}
                  >
                    <p style={{ fontSize: '14px', margin: 0, whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                  </div>
                )}

                {/* Single bottle recommendation (only for normal bubbles) */}
                {!hasMultiBottles && msg.recommendation && (
                    <div
                      style={{
                        marginTop: '12px',
                        padding: '16px',
                        backgroundColor: '#f8f9fa',
                        border: '1px solid #e0e0e0',
                        borderRadius: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <svg style={{ width: '20px', height: '20px', color: '#7c3030' }} fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                          <path
                            fillRule="evenodd"
                            d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <strong style={{ fontSize: '14px', fontWeight: 600, color: '#7c3030' }}>
                          {t('cellarSommelier.recommendationTitle')}
                        </strong>
                      </div>
                      <p style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>{msg.recommendation.reason}</p>
                      {(msg.recommendation.serveTemp || msg.recommendation.decant) && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                          {msg.recommendation.serveTemp && (
                            <div
                              style={{
                                padding: '6px 12px',
                                backgroundColor: 'white',
                                border: '1px solid #e0e0e0',
                                borderRadius: '20px',
                                fontSize: '12px',
                                color: '#666',
                              }}
                            >
                              🌡️ {msg.recommendation.serveTemp}
                            </div>
                          )}
                          {msg.recommendation.decant && (
                            <div
                              style={{
                                padding: '6px 12px',
                                backgroundColor: 'white',
                                border: '1px solid #e0e0e0',
                                borderRadius: '20px',
                                fontSize: '12px',
                                color: '#666',
                              }}
                            >
                              🍷 {msg.recommendation.decant}
                            </div>
                          )}
                        </div>
                      )}

                      {/* View Wine Button */}
                      <button
                        type="button"
                        onClick={() => handleViewBottleDetails(msg.recommendation!.bottleId)}
                        disabled={loadingBottleDetails}
                        style={{
                          width: '100%',
                          padding: '10px 16px',
                          backgroundColor: '#7c3030',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: 600,
                          cursor: loadingBottleDetails ? 'not-allowed' : 'pointer',
                          opacity: loadingBottleDetails ? 0.7 : 1,
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                        }}
                        onMouseEnter={(e) => {
                          if (!loadingBottleDetails) {
                            e.currentTarget.style.backgroundColor = '#5a2323';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#7c3030';
                        }}
                      >
                        <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                        {loadingBottleDetails ? t('common.loading', 'Loading...') : t('cellarSommelier.viewWine', 'View Wine Details')}
                      </button>
                    </div>
                  )}
                )}
              </div>
            </div>
          );
        })}

        {/* Loading indicator */}
        {isSubmitting && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '16px' }}>
            <div style={{
              padding: '12px 16px',
              borderRadius: '16px',
              backgroundColor: 'white',
              border: '1px solid #e0e0e0',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#7c3030',
                    animation: 'bounce 1s infinite',
                  }} />
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#7c3030',
                    animation: 'bounce 1s infinite 0.15s',
                  }} />
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#7c3030',
                    animation: 'bounce 1s infinite 0.3s',
                  }} />
                </div>
                <span style={{ fontSize: '14px', color: '#999' }}>{t('cellarSommelier.thinking')}</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div style={{
        padding: '16px',
        backgroundColor: 'white',
        borderTop: '1px solid #e0e0e0',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          {/* Text input */}
          <textarea
            value={inputValue}
            onChange={(e) => {
              console.log('Input changed');
              setInputValue(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(inputValue);
              }
            }}
            placeholder={isTranscribing ? t('cellarSommelier.inputPlaceholderTranscribing') : t('cellarSommelier.inputPlaceholder')}
            disabled={isSubmitting || bottles.filter(b => b.quantity > 0).length === 0 || isRecording || isTranscribing}
            rows={1}
            style={{
              flex: 1,
              padding: '12px',
              fontSize: '16px',
              border: '1px solid #ddd',
              borderRadius: '12px',
              backgroundColor: '#f8f9fa',
              color: '#333',
              outline: 'none',
              resize: 'none',
              maxHeight: '120px',
              fontFamily: 'inherit',
            }}
          />

          {/* Microphone button (dev only) */}
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
                border: isRecording ? '2px solid #dc3545' : '1px solid #ddd',
                cursor: isSubmitting || bottles.filter(b => b.quantity > 0).length === 0 || isTranscribing ? 'not-allowed' : 'pointer',
                backgroundColor: isRecording ? '#ffe5e5' : 'white',
                color: isRecording ? '#dc3545' : '#666',
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
              console.log('Send clicked');
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
              backgroundColor: inputValue.trim() && !isSubmitting && bottles.filter(b => b.quantity > 0).length > 0 && !isRecording ? '#7c3030' : '#ccc',
              color: 'white',
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
    </>
  );
}
