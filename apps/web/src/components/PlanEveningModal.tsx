/**
 * Plan an Evening - Luxury Wine Planner
 * 
 * Guided planner that creates a wine lineup for an evening:
 * - Quick inputs (occasion, group size, preferences)
 * - Generated lineup with serving order
 * - Live plan with progression
 * 
 * Gated feature - only visible to flagged users
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { toast } from '../lib/toast';
import type { BottleWithWineInfo } from '../services/bottleService';
import { EveningQueuePlayer } from './EveningQueuePlayer';
import * as eveningPlanService from '../services/eveningPlanService';
import type { EveningPlan } from '../services/eveningPlanService';

interface PlanEveningModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateBottles: BottleWithWineInfo[];
}

type Occasion = 'friends' | 'bbq' | 'pizza' | 'date' | 'celebration';
type GroupSize = '2-4' | '5-8' | '9+';
type StartTime = 'now' | '1hour' | '2hours';
type PlanStep = 'input' | 'lineup' | 'live';

interface WineSlot {
  bottle: BottleWithWineInfo;
  position: number;
  label: string;
  isLocked: boolean;
}

export function PlanEveningModal({ isOpen, onClose, candidateBottles }: PlanEveningModalProps) {
  const { t } = useTranslation();
  
  // Step management
  const [currentStep, setCurrentStep] = useState<PlanStep>('input');
  
  // Input state
  const [occasion, setOccasion] = useState<Occasion>('friends');
  const [groupSize, setGroupSize] = useState<GroupSize>('2-4');
  const [redsOnly, setRedsOnly] = useState(false);
  const [highRatingOnly, setHighRatingOnly] = useState(true);
  const [startTime, setStartTime] = useState<StartTime>('now');
  
  // Lineup state
  const [lineup, setLineup] = useState<WineSlot[]>([]);
  
  // Active plan state (persistence)
  const [activePlan, setActivePlan] = useState<EveningPlan | null>(null);
  const [showQueuePlayer, setShowQueuePlayer] = useState(false);
  
  // Swap modal state
  const [showSwapPicker, setShowSwapPicker] = useState(false);
  const [swapPosition, setSwapPosition] = useState<number | null>(null);
  const [availableAlternatives, setAvailableAlternatives] = useState<BottleWithWineInfo[]>([]);
  
  // Generate lineup based on inputs
  const generateLineup = () => {
    console.log('[PlanEvening] Generating lineup...', { occasion, groupSize, redsOnly, highRatingOnly });
    
    // Determine number of wines
    const wineCount = groupSize === '2-4' ? 3 : groupSize === '5-8' ? 4 : 5;
    
    // Filter candidates
    let candidates = [...candidateBottles].filter(b => b.quantity > 0);
    
    if (redsOnly) {
      candidates = candidates.filter(b => b.wine.color === 'red');
    }
    
    if (highRatingOnly) {
      candidates = candidates.filter(b => (b.wine.rating || 0) >= 4.2);
    }
    
    // Sort by readiness and intensity
    candidates = candidates.sort((a, b) => {
      const aAnalysis = a as any;
      const bAnalysis = b as any;
      
      // Prioritize READY wines
      const aReady = aAnalysis.readiness_label === 'READY' ? 100 : 0;
      const bReady = bAnalysis.readiness_label === 'READY' ? 100 : 0;
      
      return (bReady - aReady) || (Math.random() - 0.5);
    });
    
    // Take top candidates
    const selectedBottles = candidates.slice(0, Math.min(wineCount, candidates.length));
    
    // Create lineup with ordering
    const labels = [
      'Warm-up',
      'Mid',
      'Main',
      'Finale',
      'Grand Finale',
      'Closer'
    ];
    
    const newLineup: WineSlot[] = selectedBottles.map((bottle, idx) => ({
      bottle,
      position: idx + 1,
      label: labels[idx] || `Wine ${idx + 1}`,
      isLocked: false,
    }));
    
    setLineup(newLineup);
    setCurrentStep('lineup');
  };
  
  // Start live plan
  const startLivePlan = async () => {
    try {
      const plan = await eveningPlanService.createPlan({
        occasion: occasion || '',
        group_size: groupSize || '',
        settings: {
          occasion: occasion || null,
          groupSize: groupSize || null,
        },
        queue: eveningPlanService.lineupToQueue(lineup),
      });
      setActivePlan(plan);
      setShowQueuePlayer(true);
    } catch (error) {
      console.error('Failed to create evening plan:', error);
      toast.error('Failed to start evening plan. Please try again.');
    }
  };
  
  // Swap wine in lineup
  const handleSwap = (position: number) => {
    console.log('[PlanEvening] Opening swap picker for position', position);
    
    // Filter candidates - exclude wines already in lineup
    const winesInLineup = lineup.map(slot => slot.bottle.id);
    let alternatives = [...candidateBottles].filter(b => 
      b.quantity > 0 && !winesInLineup.includes(b.id)
    );
    
    // Apply same filters as original lineup
    if (redsOnly) {
      alternatives = alternatives.filter(b => b.wine.color === 'red');
    }
    
    if (highRatingOnly) {
      alternatives = alternatives.filter(b => (b.wine.rating || 0) >= 4.2);
    }
    
    // Sort by readiness
    alternatives = alternatives.sort((a, b) => {
      const aAnalysis = a as any;
      const bAnalysis = b as any;
      const aReady = aAnalysis.readiness_label === 'READY' ? 100 : 0;
      const bReady = bAnalysis.readiness_label === 'READY' ? 100 : 0;
      return (bReady - aReady) || (Math.random() - 0.5);
    });
    
    setAvailableAlternatives(alternatives.slice(0, 6)); // Limit to 6 alternatives
    setSwapPosition(position);
    setShowSwapPicker(true);
  };
  
  // Confirm swap with selected wine
  const handleConfirmSwap = (selectedBottle: BottleWithWineInfo) => {
    if (swapPosition === null) return;
    
    console.log('[PlanEvening] Swapping wine at position', swapPosition, 'with', selectedBottle.wine.wine_name);
    
    const newLineup = [...lineup];
    const slotIndex = newLineup.findIndex(slot => slot.position === swapPosition);
    
    if (slotIndex !== -1) {
      newLineup[slotIndex] = {
        ...newLineup[slotIndex],
        bottle: selectedBottle,
      };
      setLineup(newLineup);
    }
    
    setShowSwapPicker(false);
    setSwapPosition(null);
  };
  
  // Complete evening
  const handleCompleteEvening = () => {
    console.log('[PlanEvening] Evening completed! 🎉');
    
    // Show celebration toast
    toast.success('🎉 Wonderful evening! Hope you enjoyed your wines.');
    
    // Close modal and reset
    onClose();
    setTimeout(() => {
      setCurrentStep('input');
      setLineup([]);
    }, 300);
  };
  
  // Close and reset
  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setCurrentStep('input');
      setLineup([]);
      setActivePlan(null);
    }, 300);
  };
  
  // Handle queue player completion
  const handleQueueComplete = () => {
    setShowQueuePlayer(false);
    setActivePlan(null);
    handleClose();
  };

  if (!isOpen) return null;
  
  // Show Queue Player if plan is started
  if (showQueuePlayer && activePlan) {
    return (
      <EveningQueuePlayer
        isOpen={showQueuePlayer}
        onClose={() => {
          setShowQueuePlayer(false);
          handleClose();
        }}
        plan={activePlan}
        onPlanUpdated={setActivePlan}
        onComplete={handleQueueComplete}
      />
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        style={{
          background: 'var(--bg-overlay)',
          backdropFilter: 'var(--blur-medium)',
          WebkitBackdropFilter: 'var(--blur-medium)',
        }}
        onClick={handleClose}
      >
        {/* Modal Container */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-2xl rounded-2xl overflow-hidden"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-xl)',
            maxHeight: '90vh',
          }}
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center justify-between">
              <div>
                <h2 
                  className="text-2xl font-bold flex items-center gap-2"
                  style={{ 
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  <span>✨</span>
                  Plan an evening
                </h2>
                <p 
                  className="text-sm mt-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {currentStep === 'input' && 'Create your perfect wine lineup'}
                  {currentStep === 'lineup' && 'Review and customize your selection'}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{
                  background: 'var(--bg-surface-elevated)',
                  color: 'var(--text-tertiary)',
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Progress dots */}
            <div className="flex items-center gap-2 mt-4">
              {['input', 'lineup'].map((step, idx) => (
                <div
                  key={step}
                  className="h-1 flex-1 rounded-full transition-all"
                  style={{
                    background: currentStep === step || (idx < ['input', 'lineup'].indexOf(currentStep))
                      ? 'var(--wine-500)'
                      : 'var(--border-subtle)',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 180px)' }}>
            <AnimatePresence mode="wait">
              {currentStep === 'input' && (
                <InputStep
                  occasion={occasion}
                  setOccasion={setOccasion}
                  groupSize={groupSize}
                  setGroupSize={setGroupSize}
                  redsOnly={redsOnly}
                  setRedsOnly={setRedsOnly}
                  highRatingOnly={highRatingOnly}
                  setHighRatingOnly={setHighRatingOnly}
                  startTime={startTime}
                  setStartTime={setStartTime}
                  onGenerate={generateLineup}
                />
              )}
              
              {currentStep === 'lineup' && (
                <LineupStep
                  lineup={lineup}
                  onSwap={handleSwap}
                  onStart={startLivePlan}
                  onBack={() => setCurrentStep('input')}
                />
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
      
      {/* Swap Picker Modal */}
      {showSwapPicker && (
        <SwapPickerModal
          isOpen={showSwapPicker}
          onClose={() => {
            setShowSwapPicker(false);
            setSwapPosition(null);
          }}
          alternatives={availableAlternatives}
          currentWine={lineup.find(slot => slot.position === swapPosition)?.bottle}
          onSelect={handleConfirmSwap}
        />
      )}
    </AnimatePresence>
  );
}

// Swap Picker Modal Component
function SwapPickerModal({
  isOpen,
  onClose,
  alternatives,
  currentWine,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  alternatives: BottleWithWineInfo[];
  currentWine?: BottleWithWineInfo;
  onSelect: (bottle: BottleWithWineInfo) => void;
}) {
  if (!isOpen || !currentWine) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[110] flex items-center justify-center p-4"
        style={{
          background: 'var(--bg-overlay)',
          backdropFilter: 'var(--blur-medium)',
          WebkitBackdropFilter: 'var(--blur-medium)',
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg rounded-2xl overflow-hidden"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-xl)',
            maxHeight: '85vh',
          }}
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center justify-between">
              <div>
                <h3 
                  className="text-xl font-bold"
                  style={{ 
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-display)',
                  }}
                >
                  Swap wine
                </h3>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Choose an alternative for {currentWine.wine.wine_name}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{
                  background: 'var(--bg-surface-elevated)',
                  color: 'var(--text-tertiary)',
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Alternatives List */}
          <div className="overflow-y-auto p-6 space-y-3" style={{ maxHeight: 'calc(85vh - 140px)' }}>
            {alternatives.length === 0 && (
              <div 
                className="p-6 rounded-xl text-center"
                style={{
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-medium)',
                }}
              >
                <p style={{ color: 'var(--text-secondary)' }}>
                  No alternative wines available with current filters
                </p>
              </div>
            )}
            
            {alternatives.map((bottle) => (
              <motion.button
                key={bottle.id}
                onClick={() => onSelect(bottle)}
                className="w-full p-4 rounded-xl flex gap-4 items-center text-left transition-all"
                style={{
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-medium)',
                }}
                whileHover={{
                  scale: 1.02,
                  boxShadow: '0 4px 12px rgba(164, 77, 90, 0.15)',
                }}
                whileTap={{ scale: 0.98 }}
              >
                {/* Wine Image */}
                {bottle.wine.image_url ? (
                  <img
                    src={bottle.wine.image_url}
                    alt={bottle.wine.wine_name}
                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                    style={{ border: '1px solid var(--border-subtle)' }}
                  />
                ) : (
                  <div 
                    className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: 'linear-gradient(135deg, var(--wine-100), var(--wine-200))',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" style={{ color: 'var(--wine-600)' }}>
                      <path fill="currentColor" d="M6 2h12v2H6V2zm0 18c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V6H6v14zM8 8h8v12H8V8z"/>
                    </svg>
                  </div>
                )}

                {/* Wine Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {bottle.wine.wine_name}
                  </h4>
                  <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
                    {bottle.wine.producer}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {bottle.wine.vintage && (
                      <span 
                        className="text-xs px-2 py-0.5 rounded"
                        style={{
                          background: 'var(--wine-50)',
                          color: 'var(--wine-700)',
                        }}
                      >
                        {bottle.wine.vintage}
                      </span>
                    )}
                    {bottle.wine.rating && (
                      <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
                        ⭐ {bottle.wine.rating.toFixed(1)}
                      </span>
                    )}
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {bottle.quantity} available
                    </span>
                  </div>
                </div>

                {/* Select Icon */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, var(--wine-500), var(--wine-600))',
                    color: 'white',
                  }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </motion.button>
            ))}
          </div>

          {/* Footer */}
          <div className="px-6 pb-6">
            <button
              onClick={onClose}
              className="btn-luxury-secondary w-full"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Input Step Component
function InputStep({
  occasion,
  setOccasion,
  groupSize,
  setGroupSize,
  redsOnly,
  setRedsOnly,
  highRatingOnly,
  setHighRatingOnly,
  startTime,
  setStartTime,
  onGenerate,
}: any) {
  const occasions: { value: Occasion; label: string; icon: string }[] = [
    { value: 'friends', label: 'Friends', icon: '👥' },
    { value: 'bbq', label: 'BBQ', icon: '🔥' },
    { value: 'pizza', label: 'Pizza night', icon: '🍕' },
    { value: 'date', label: 'Date night', icon: '💝' },
    { value: 'celebration', label: 'Celebration', icon: '🎉' },
  ];

  return (
    <motion.div
      key="input"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="px-6 py-6 space-y-6"
    >
      {/* Occasion */}
      <div>
        <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
          Occasion
        </label>
        <div className="flex flex-wrap gap-2">
          {occasions.map((occ) => (
            <button
              key={occ.value}
              onClick={() => setOccasion(occ.value)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                background: occasion === occ.value
                  ? 'linear-gradient(135deg, var(--wine-500), var(--wine-600))'
                  : 'var(--bg-surface-elevated)',
                color: occasion === occ.value ? 'white' : 'var(--text-primary)',
                border: `1px solid ${occasion === occ.value ? 'var(--wine-600)' : 'var(--border-medium)'}`,
              }}
            >
              <span className="mr-1.5">{occ.icon}</span>
              {occ.label}
            </button>
          ))}
        </div>
      </div>

      {/* Group Size */}
      <div>
        <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
          Group size
        </label>
        <div className="flex gap-2">
          {['2-4', '5-8', '9+'].map((size) => (
            <button
              key={size}
              onClick={() => setGroupSize(size as GroupSize)}
              className="flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all"
              style={{
                background: groupSize === size
                  ? 'linear-gradient(135deg, var(--wine-500), var(--wine-600))'
                  : 'var(--bg-surface-elevated)',
                color: groupSize === size ? 'white' : 'var(--text-primary)',
                border: `1px solid ${groupSize === size ? 'var(--wine-600)' : 'var(--border-medium)'}`,
              }}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Preferences */}
      <div>
        <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
          Preferences
        </label>
        <div className="space-y-2">
          <label
            className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors"
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-medium)',
            }}
          >
            <input
              type="checkbox"
              checked={redsOnly}
              onChange={(e) => setRedsOnly(e.target.checked)}
              className="w-5 h-5 rounded"
              style={{ accentColor: 'var(--wine-600)' }}
            />
            <span style={{ color: 'var(--text-primary)' }}>Reds only</span>
          </label>
          
          <label
            className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors"
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-medium)',
            }}
          >
            <input
              type="checkbox"
              checked={highRatingOnly}
              onChange={(e) => setHighRatingOnly(e.target.checked)}
              className="w-5 h-5 rounded"
              style={{ accentColor: 'var(--wine-600)' }}
            />
            <span style={{ color: 'var(--text-primary)' }}>Rating ≥ 4.2</span>
          </label>
        </div>
      </div>

      {/* Start Time */}
      <div>
        <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
          Start time
        </label>
        <div className="flex gap-2">
          {[
            { value: 'now', label: 'Now' },
            { value: '1hour', label: 'In 1 hour' },
            { value: '2hours', label: 'In 2 hours' },
          ].map((time) => (
            <button
              key={time.value}
              onClick={() => setStartTime(time.value as StartTime)}
              className="flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all"
              style={{
                background: startTime === time.value
                  ? 'linear-gradient(135deg, var(--wine-500), var(--wine-600))'
                  : 'var(--bg-surface-elevated)',
                color: startTime === time.value ? 'white' : 'var(--text-primary)',
                border: `1px solid ${startTime === time.value ? 'var(--wine-600)' : 'var(--border-medium)'}`,
              }}
            >
              {time.label}
            </button>
          ))}
        </div>
      </div>

      {/* Generate Button */}
      <button
        onClick={onGenerate}
        className="btn-luxury-primary w-full"
        style={{ minHeight: '52px', marginTop: '1.5rem' }}
      >
        Generate lineup ✨
      </button>
    </motion.div>
  );
}

// Lineup Step Component
function LineupStep({ lineup, onSwap, onStart, onBack }: any) {
  return (
    <motion.div
      key="lineup"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="px-6 py-6 space-y-4"
    >
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {lineup.length} wines selected • Serving order optimized
      </p>

      {/* Wine Slots */}
      <div className="space-y-3">
        {lineup.map((slot: WineSlot, idx: number) => (
          <div
            key={idx}
            className="p-4 rounded-xl flex gap-4"
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-medium)',
            }}
          >
            {/* Position */}
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 font-bold"
              style={{
                background: 'linear-gradient(135deg, var(--wine-500), var(--wine-600))',
                color: 'white',
              }}
            >
              {slot.position}
            </div>

            {/* Wine Info */}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium mb-1" style={{ color: 'var(--wine-600)' }}>
                {slot.label}
              </div>
              <h4 className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {slot.bottle.wine.wine_name}
              </h4>
              <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
                {slot.bottle.wine.producer}
              </p>
              {slot.bottle.wine.vintage && (
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {slot.bottle.wine.vintage}
                </span>
              )}
            </div>

            {/* Swap Button */}
            <button
              onClick={() => onSwap(slot.position)}
              className="px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: 'var(--bg-surface)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-medium)',
              }}
            >
              Swap
            </button>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onBack}
          className="btn-luxury-secondary flex-1"
        >
          Back
        </button>
        <button
          onClick={onStart}
          className="btn-luxury-primary flex-1"
        >
          Start evening
        </button>
      </div>
    </motion.div>
  );
}
