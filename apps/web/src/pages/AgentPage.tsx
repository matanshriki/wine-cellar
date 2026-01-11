/**
 * Cellar Agent Page (localhost only)
 * 
 * AI chat assistant that recommends wines ONLY from the user's cellar bottles.
 * This feature is DEV/LOCALHOST only and NOT available in production.
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { isDevEnvironment } from '../utils/devOnly';
import { listBottles, type BottleWithWineInfo } from '../services/bottleService';
import { sendAgentMessage, type AgentMessage, type AgentResponse } from '../services/agentService';
import { toast } from '../lib/toast';
import { WineLoader } from '../components/WineLoader';

export function AgentPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [bottles, setBottles] = useState<BottleWithWineInfo[]>([]);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Dev-only guard - redirect if not localhost (run only once on mount)
  const hasCheckedDev = useRef(false);
  useEffect(() => {
    if (!hasCheckedDev.current) {
      hasCheckedDev.current = true;
      if (!isDevEnvironment()) {
        toast.warning('Agent is not enabled.');
        navigate('/cellar', { replace: true });
      }
    }
  }, [navigate]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadBottles() {
    try {
      setLoading(true);
      const data = await listBottles();
      setBottles(data);
    } catch (error) {
      toast.error('Failed to load your cellar');
    } finally {
      setLoading(false);
    }
  }

  // Load bottles on mount
  const hasLoadedBottles = useRef(false);
  useEffect(() => {
    if (!hasLoadedBottles.current) {
      hasLoadedBottles.current = true;
      loadBottles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quick prompt chips
  const quickPrompts = [
    'What should I drink tonight?',
    'Ready to drink now',
    'Pair with steak',
  ];

  async function handleSendMessage(text: string) {
    if (!text.trim() || isSubmitting) return;

    // Check if cellar is empty
    if (bottles.length === 0) {
      toast.warning('Add at least one bottle to get recommendations.');
      return;
    }

    const userMessage: AgentMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsSubmitting(true);

    try {
      // Send message with conversation history (last 8 messages)
      const history = messages.slice(-8);
      const response = await sendAgentMessage(text, history, bottles);

      const assistantMessage: AgentMessage = {
        role: 'assistant',
        content: response.message || '',
        timestamp: new Date().toISOString(),
        recommendation: response.recommendation,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // If there's a follow-up question, we're done - user can answer
    } catch (error: any) {
      console.error('Agent error:', error);
      toast.error(error.message || 'Failed to get recommendation');

      // Add error message
      const errorMessage: AgentMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleQuickPrompt(prompt: string) {
    setInputValue(prompt);
    handleSendMessage(prompt);
  }

  // Voice input (dev-only, optional)
  async function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error('Voice input is not supported in this browser');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info('Recording... Tap to stop');
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Failed to start recording');
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }

  async function transcribeAudio(audioBlob: Blob) {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch('/api/agent/transcribe', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const data = await response.json();
      if (data.text) {
        setInputValue(data.text);
        toast.success('Transcribed! Review and press Send');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      toast.error('Failed to transcribe audio');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen luxury-background">
        <WineLoader variant="default" size="lg" message="Loading Agent..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen luxury-background">
      {/* Header */}
      <div 
        className="flex-shrink-0 border-b"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-light)',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <button
            onClick={() => navigate('/cellar')}
            className="flex items-center gap-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex-1 text-center">
            <h1 
              className="text-xl font-bold"
              style={{ 
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-display)',
              }}
            >
              Cellar Agent
            </h1>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              (dev only)
            </p>
          </div>

          <div className="w-6" />
        </div>
      </div>

      {/* Messages */}
      <div 
        className="flex-1 overflow-y-auto px-4 py-6 space-y-4 luxury-scrollbar"
        style={{ 
          paddingBottom: 'calc(80px + env(safe-area-inset-bottom))',
        }}
      >
        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{ 
                background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
                color: 'white',
              }}
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h2 
              className="text-xl font-bold mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              Ask Your Cellar Agent
            </h2>
            <p 
              className="text-sm mb-6"
              style={{ color: 'var(--text-secondary)' }}
            >
              I'll recommend wines from your cellar based on your preferences
            </p>

            {/* Quick prompts */}
            {bottles.length > 0 && (
              <div className="flex flex-col gap-2 w-full max-w-xs">
                {quickPrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleQuickPrompt(prompt)}
                    className="px-4 py-3 rounded-lg text-sm transition-all hover:opacity-80"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-medium)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {/* Empty cellar warning */}
            {bottles.length === 0 && (
              <div 
                className="p-4 rounded-lg mt-4"
                style={{
                  backgroundColor: 'var(--bg-warning-subtle)',
                  border: '1px solid var(--border-warning)',
                }}
              >
                <p 
                  className="text-sm mb-3"
                  style={{ color: 'var(--text-warning)' }}
                >
                  Add at least one bottle to get recommendations
                </p>
                <button
                  onClick={() => navigate('/cellar')}
                  className="btn-luxury-primary text-sm"
                >
                  Go to Cellar
                </button>
              </div>
            )}
          </div>
        )}

        {/* Message list */}
        {messages.map((msg, idx) => (
          <MessageBubble 
            key={idx} 
            message={msg} 
            bottles={bottles}
          />
        ))}

        {/* Loading indicator */}
        {isSubmitting && (
          <div className="flex justify-start">
            <div 
              className="px-4 py-3 rounded-2xl"
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-light)',
              }}
            >
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--wine-600)', animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--wine-600)', animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--wine-600)', animationDelay: '300ms' }} />
                </div>
                <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  Thinking...
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div 
        className="flex-shrink-0 border-t"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-light)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="px-4 py-3">
          <div className="flex items-end gap-2">
            {/* Voice button (dev-only) */}
            {isDevEnvironment() && (
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isSubmitting}
                className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all"
                style={{
                  backgroundColor: isRecording ? 'var(--color-red-500)' : 'var(--bg-tertiary)',
                  color: isRecording ? 'white' : 'var(--text-secondary)',
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
            )}

            {/* Text input */}
            <div className="flex-1">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(inputValue);
                  }
                }}
                placeholder="Ask about your wines..."
                disabled={isSubmitting || bottles.length === 0}
                rows={1}
                className="w-full px-4 py-3 rounded-xl resize-none"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  maxHeight: '120px',
                }}
              />
            </div>

            {/* Send button */}
            <button
              onClick={() => handleSendMessage(inputValue)}
              disabled={isSubmitting || !inputValue.trim() || bottles.length === 0}
              className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all"
              style={{
                background: inputValue.trim() && !isSubmitting 
                  ? 'linear-gradient(135deg, var(--wine-600), var(--wine-700))'
                  : 'var(--bg-tertiary)',
                color: inputValue.trim() && !isSubmitting ? 'white' : 'var(--text-tertiary)',
                cursor: inputValue.trim() && !isSubmitting ? 'pointer' : 'not-allowed',
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Message Bubble Component
 */
interface MessageBubbleProps {
  message: AgentMessage;
  bottles: BottleWithWineInfo[];
}

function MessageBubble({ message, bottles }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div 
        className="max-w-[85%] px-4 py-3 rounded-2xl"
        style={{
          backgroundColor: isUser 
            ? 'var(--wine-600)' 
            : 'var(--bg-surface)',
          color: isUser ? 'white' : 'var(--text-primary)',
          border: isUser ? 'none' : '1px solid var(--border-light)',
        }}
      >
        {/* Message content */}
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>

        {/* Recommendation card (if present) */}
        {message.recommendation && (
          <RecommendationCard 
            recommendation={message.recommendation} 
            bottles={bottles}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Recommendation Card Component
 */
interface RecommendationCardProps {
  recommendation: {
    bottleId: string;
    reason: string;
    serveTemp?: string;
    decant?: string;
    alternatives?: Array<{ bottleId: string; reason: string }>;
  };
  bottles: BottleWithWineInfo[];
}

function RecommendationCard({ recommendation, bottles }: RecommendationCardProps) {
  const bottle = bottles.find((b) => b.id === recommendation.bottleId);

  if (!bottle) {
    return (
      <div 
        className="mt-3 p-3 rounded-lg"
        style={{
          backgroundColor: 'var(--bg-error-subtle)',
          border: '1px solid var(--border-error)',
        }}
      >
        <p className="text-xs" style={{ color: 'var(--text-error)' }}>
          Recommended bottle not found in cellar
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 p-4 rounded-lg"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-medium)',
      }}
    >
      {/* Bottle info */}
      <div className="mb-3">
        <h3 
          className="font-bold text-base mb-1"
          style={{ color: 'var(--text-primary)' }}
        >
          {bottle.wine.producer} {bottle.wine.wine_name}
        </h3>
        {bottle.wine.vintage && (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {bottle.wine.vintage}
          </p>
        )}
      </div>

      {/* Reason */}
      <div className="mb-3">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {recommendation.reason}
        </p>
      </div>

      {/* Serving details */}
      {(recommendation.serveTemp || recommendation.decant) && (
        <div className="flex flex-wrap gap-2 mb-3">
          {recommendation.serveTemp && (
            <div 
              className="px-3 py-1 rounded-full text-xs"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
              }}
            >
              🌡️ {recommendation.serveTemp}
            </div>
          )}
          {recommendation.decant && (
            <div 
              className="px-3 py-1 rounded-full text-xs"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
              }}
            >
              🍷 {recommendation.decant}
            </div>
          )}
        </div>
      )}

      {/* Alternatives */}
      {recommendation.alternatives && recommendation.alternatives.length > 0 && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-light)' }}>
          <p 
            className="text-xs font-semibold mb-2"
            style={{ color: 'var(--text-tertiary)' }}
          >
            ALTERNATIVES
          </p>
          <div className="space-y-2">
            {recommendation.alternatives.map((alt, idx) => {
              const altBottle = bottles.find((b) => b.id === alt.bottleId);
              if (!altBottle) return null;

              return (
                <div key={idx} className="text-sm">
                  <p 
                    className="font-medium"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {altBottle.wine.producer} {altBottle.wine.wine_name}
                  </p>
                  <p 
                    className="text-xs"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {alt.reason}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}

