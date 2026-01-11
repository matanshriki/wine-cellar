/**
 * Cellar Agent Page - Clean Rebuild
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFeatureFlags } from '../contexts/FeatureFlagsContext';
import { listBottles, type BottleWithWineInfo } from '../services/bottleService';
import { sendAgentMessage, type AgentMessage } from '../services/agentService';
import { toast } from '../lib/toast';
import { WineLoader } from '../components/WineLoader';

export function AgentPageWorking() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { flags } = useFeatureFlags();
  const [loading, setLoading] = useState(true);
  const [bottles, setBottles] = useState<BottleWithWineInfo[]>([]);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
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

  // Load bottles once
  useEffect(() => {
    async function load() {
      try {
        const data = await listBottles();
        setBottles(data);
      } catch (error) {
        toast.error('Failed to load cellar');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSend(text: string) {
    if (!text.trim() || isSubmitting || bottles.length === 0) return;

    const userMsg: AgentMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsSubmitting(true);

    try {
      const history = messages.slice(-8);
      const response = await sendAgentMessage(text, history, bottles);

      const assistantMsg: AgentMessage = {
        role: 'assistant',
        content: response.message || '',
        timestamp: new Date().toISOString(),
        recommendation: response.recommendation,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error: any) {
      toast.error(error.message || 'Failed to get recommendation');
    } finally {
      setIsSubmitting(false);
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
        await transcribeAudio(audioBlob);
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

  async function transcribeAudio(audioBlob: Blob) {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch('http://localhost:3001/api/agent/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const data = await response.json();
      setInputValue(data.text);
      toast.success(t('cellarSommelier.transcriptionSuccess'));
    } catch (error: any) {
      console.error('Transcription error:', error);
      toast.error(t('cellarSommelier.transcriptionFailed'));
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
      `}</style>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: '#f8f9fa',
        position: 'relative',
      }}>
        {/* Header */}
      <div style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e0e0e0',
        padding: '16px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => navigate('/cellar')}
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

          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '18px', fontWeight: 'bold', color: '#333', margin: 0 }}>
              {t('cellarSommelier.title')}
            </h1>
            <p style={{ fontSize: '12px', color: '#999', margin: 0 }}>
              {t('cellarSommelier.bottleCount', { count: bottles.length })} • {t('cellarSommelier.devOnly')}
            </p>
          </div>

          <div style={{ width: '70px' }} />
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
        {messages.length === 0 && bottles.length > 0 && (
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
              backgroundColor: '#7c3030',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
            }}>
              <svg style={{ width: '32px', height: '32px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
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
        {bottles.length === 0 && (
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
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: '16px',
            }}
          >
            <div style={{
              maxWidth: '85%',
              padding: '12px 16px',
              borderRadius: '16px',
              backgroundColor: msg.role === 'user' ? '#7c3030' : 'white',
              color: msg.role === 'user' ? 'white' : '#333',
              border: msg.role === 'assistant' ? '1px solid #e0e0e0' : 'none',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}>
              <p style={{ fontSize: '14px', margin: 0, whiteSpace: 'pre-wrap' }}>{msg.content}</p>
              
              {msg.recommendation && (
                <div style={{
                  marginTop: '12px',
                  padding: '16px',
                  backgroundColor: '#f8f9fa',
                  border: '1px solid #e0e0e0',
                  borderRadius: '12px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <svg style={{ width: '20px', height: '20px', color: '#7c3030' }} fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                      <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                    </svg>
                    <strong style={{ fontSize: '14px', fontWeight: 600, color: '#7c3030' }}>
                      {t('cellarSommelier.recommendationTitle')}
                    </strong>
                  </div>
                  <p style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
                    {msg.recommendation.reason}
                  </p>
                  {(msg.recommendation.serveTemp || msg.recommendation.decant) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {msg.recommendation.serveTemp && (
                        <div style={{
                          padding: '6px 12px',
                          backgroundColor: 'white',
                          border: '1px solid #e0e0e0',
                          borderRadius: '20px',
                          fontSize: '12px',
                          color: '#666',
                        }}>
                          🌡️ {msg.recommendation.serveTemp}
                        </div>
                      )}
                      {msg.recommendation.decant && (
                        <div style={{
                          padding: '6px 12px',
                          backgroundColor: 'white',
                          border: '1px solid #e0e0e0',
                          borderRadius: '20px',
                          fontSize: '12px',
                          color: '#666',
                        }}>
                          🍷 {msg.recommendation.decant}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

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
            disabled={isSubmitting || bottles.length === 0 || isRecording || isTranscribing}
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
              disabled={isSubmitting || bottles.length === 0 || isTranscribing}
              title={isRecording ? t('cellarSommelier.micButtonStop') : t('cellarSommelier.micButton')}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: isRecording ? '2px solid #dc3545' : '1px solid #ddd',
                cursor: isSubmitting || bottles.length === 0 || isTranscribing ? 'not-allowed' : 'pointer',
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
            disabled={isSubmitting || !inputValue.trim() || bottles.length === 0 || isRecording}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              cursor: inputValue.trim() && !isSubmitting && bottles.length > 0 && !isRecording ? 'pointer' : 'not-allowed',
              backgroundColor: inputValue.trim() && !isSubmitting && bottles.length > 0 && !isRecording ? '#7c3030' : '#ccc',
              color: 'white',
              transition: 'all 0.2s',
              flexShrink: 0,
            }}
          >
            <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
      </div>
    </>
  );
}
