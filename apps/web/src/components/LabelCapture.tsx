/**
 * Label Capture Component
 * 
 * Camera/upload interface for capturing wine label photos
 * 
 * Features:
 * - Mobile: Triggers camera via input[capture]
 * - Desktop: Standard file upload
 * - Image preview
 * - Loading state while processing
 * - Error handling with retry
 */

import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { WineLoader } from './WineLoader';
import { scanLabelImage } from '../services/labelScanService';
import type { ExtractedWineData } from '../services/labelScanService';

interface LabelCaptureProps {
  onSuccess: (data: { imageUrl: string; extractedData: ExtractedWineData }) => void;
  onCancel: () => void;
  mode?: 'camera' | 'upload'; // camera = direct camera, upload = photo library
}

export function LabelCapture({ onSuccess, onCancel, mode = 'camera' }: LabelCaptureProps) {
  const { t } = useTranslation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError(t('cellar.labelScan.errorInvalidFile'));
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError(t('cellar.labelScan.errorFileTooLarge'));
      return;
    }

    setCurrentFile(file);
    setError(null);

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleProcess = async () => {
    if (!currentFile) return;

    setIsProcessing(true);
    setError(null);

    try {
      const result = await scanLabelImage(currentFile);
      onSuccess(result);
    } catch (err: any) {
      console.error('Scan error:', err);
      setError(err.message || t('cellar.labelScan.error'));
      setIsProcessing(false);
    }
  };

  const handleRetake = () => {
    setPreview(null);
    setCurrentFile(null);
    setError(null);
    setIsProcessing(false);
    fileInputRef.current?.click();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black z-50 flex flex-col h-screen-ios"
        style={{
          height: '100dvh',
        }}
      >
        {/* Header with safe area */}
        <div className="flex-shrink-0 p-4 safe-area-top flex items-center justify-between bg-black/80 backdrop-blur-sm">
          <button
            onClick={onCancel}
            className="text-white p-2 rounded-lg hover:bg-white/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            disabled={isProcessing}
            aria-label={t('common.cancel')}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 className="text-white font-semibold text-lg">
            {t('cellar.labelScan.title')}
          </h2>
          <div className="w-10" />
        </div>

        {/* Content - iOS scrollable */}
        <div 
          className="flex-1 flex items-center justify-center p-6 ios-modal-scroll overflow-y-auto"
          style={{
            paddingBottom: 'max(env(safe-area-inset-bottom), 2rem)',
          }}
        >
          {preview ? (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="max-w-md w-full"
            >
              {/* Preview */}
              <div className="relative rounded-xl overflow-hidden shadow-2xl mb-6">
                <img 
                  src={preview} 
                  alt="Label preview" 
                  className="w-full h-auto"
                />
                {isProcessing && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center">
                    <WineLoader 
                      variant="default" 
                      size="lg" 
                      color="white"
                    />
                    <p className="text-white font-medium mt-4">
                      {t('cellar.labelScan.processing')}
                    </p>
                    <p className="text-white/70 text-sm mt-2">
                      {t('cellar.labelScan.processingHint')}
                    </p>
                  </div>
                )}
              </div>

              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-lg bg-red-500/20 border border-red-500/50 mb-4"
                >
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-red-200 text-sm flex-1">{error}</p>
                  </div>
                </motion.div>
              )}

              {/* Actions */}
              {!isProcessing && (
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRetake();
                    }}
                    className="flex-1 py-3 px-4 rounded-lg font-medium transition-colors active:scale-[0.98] min-h-[44px]"
                    style={{
                      backgroundColor: 'var(--color-stone-700)',
                      color: 'white',
                      WebkitTapHighlightColor: 'transparent',
                      touchAction: 'manipulation',
                      cursor: 'pointer',
                    }}
                  >
                    {error ? t('cellar.labelScan.tryAgain') : t('cellar.labelScan.retake')}
                  </button>
                  {!error && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleProcess();
                      }}
                      className="flex-1 py-3 px-4 rounded-lg font-medium transition-all active:scale-[0.98] min-h-[44px]"
                      style={{
                        backgroundColor: 'var(--wine-600)',
                        color: 'white',
                        boxShadow: '0 2px 8px rgba(138, 58, 71, 0.3)',
                        WebkitTapHighlightColor: 'transparent',
                        touchAction: 'manipulation',
                        cursor: 'pointer',
                      }}
                    >
                      {t('cellar.labelScan.usePhoto')}
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center max-w-md w-full"
            >
              {/* Icon */}
              <motion.div
                animate={{
                  scale: [1, 1.05, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <svg 
                  className="w-24 h-24 mx-auto mb-6"
                  style={{ color: 'var(--color-wine-400)' }}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </motion.div>

              {/* Instructions */}
              <h3 className="text-white text-xl font-semibold mb-3">
                {mode === 'camera' ? t('cellar.labelScan.instruction') : t('cellar.labelScan.uploadInstruction')}
              </h3>
              <p className="text-white/70 mb-8">
                {mode === 'camera' ? t('cellar.labelScan.instructionDetail') : t('cellar.labelScan.uploadInstructionDetail')}
              </p>

              {/* Capture/Upload Button */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="btn btn-primary btn-lg w-full hover:opacity-90 active:scale-[0.98] min-h-[44px]"
                style={{
                  backgroundColor: 'var(--color-wine-500)',
                  color: 'white',
                  boxShadow: 'var(--glow-wine)',
                  WebkitTapHighlightColor: 'transparent',
                  touchAction: 'manipulation',
                }}
              >
                {mode === 'camera' ? (
                  <>
                    <svg className="w-6 h-6 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {t('cellar.labelScan.capture')}
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {t('cellar.labelScan.selectPhoto')}
                  </>
                )}
              </button>
            </motion.div>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture={mode === 'camera' ? 'environment' : undefined} // Only trigger camera in camera mode
          onChange={handleFileSelect}
          className="hidden"
        />
      </motion.div>
    </AnimatePresence>
  );
}

