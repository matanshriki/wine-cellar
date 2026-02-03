/**
 * PWA Camera Capture Modal
 * 
 * In-app camera capture for iOS PWA using getUserMedia
 * Avoids the iOS file chooser and provides immediate camera access
 * 
 * Features:
 * - Live camera preview
 * - Shutter button to capture photo
 * - Flip camera (front/back)
 * - Clean error handling
 * - Automatic stream cleanup
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

interface PwaCameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  onError: (error: Error) => void;
}

export function PwaCameraCaptureModal({
  isOpen,
  onClose,
  onCapture,
  onError,
}: PwaCameraCaptureModalProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  // Initialize camera when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;

    const initCamera = async () => {
      try {
        console.log('[PWA Camera] Initializing camera with facingMode:', facingMode);
        setIsLoading(true);
        setError(null);

        // Check if multiple cameras available
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = devices.filter(device => device.kind === 'videoinput');
          setHasMultipleCameras(videoInputs.length > 1);
          console.log('[PWA Camera] Found', videoInputs.length, 'cameras');
        } catch (e) {
          console.warn('[PWA Camera] Could not enumerate devices:', e);
        }

        // Request camera access
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        if (!mounted) {
          // Component unmounted, stop stream
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = stream;

        // Attach stream to video element
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          console.log('[PWA Camera] ✅ Camera stream attached');
        }

        setIsLoading(false);
      } catch (err: any) {
        console.error('[PWA Camera] ❌ Error initializing camera:', err);
        
        if (!mounted) return;

        let errorMessage = 'Unable to access camera';
        
        if (err.name === 'NotAllowedError') {
          errorMessage = 'Camera access denied. Please enable it in Settings.';
        } else if (err.name === 'NotFoundError') {
          errorMessage = 'No camera found on this device.';
        } else if (err.name === 'NotReadableError') {
          errorMessage = 'Camera is being used by another app.';
        } else if (err.name === 'OverconstrainedError') {
          errorMessage = 'Camera does not support the requested settings.';
        }
        
        setError(errorMessage);
        setIsLoading(false);
        onError(err);
      }
    };

    initCamera();

    return () => {
      mounted = false;
      // Cleanup: stop all tracks
      if (streamRef.current) {
        console.log('[PWA Camera] Stopping camera stream');
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, facingMode, onError]);

  // Handle shutter button click
  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) {
      console.error('[PWA Camera] Video or canvas ref not available');
      return;
    }

    console.log('[PWA Camera] Capturing photo');

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('[PWA Camera] Could not get canvas context');
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          console.error('[PWA Camera] Failed to create blob from canvas');
          return;
        }

        // Create File from Blob
        const timestamp = Date.now();
        const file = new File([blob], `wine-label-${timestamp}.jpg`, {
          type: 'image/jpeg',
          lastModified: timestamp,
        });

        console.log('[PWA Camera] ✅ Photo captured:', file.name, file.size, 'bytes');

        // Stop the stream before passing to parent
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        // Pass the file to parent component
        onCapture(file);
      },
      'image/jpeg',
      0.92 // Quality
    );
  };

  // Handle flip camera
  const handleFlipCamera = () => {
    console.log('[PWA Camera] Flipping camera');
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  // Handle close
  const handleClose = () => {
    console.log('[PWA Camera] Closing camera');
    
    // Stop stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[100]"
        style={{
          background: '#000',
        }}
      >
        {/* Video Preview */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            transform: facingMode === 'user' ? 'scaleX(-1)' : 'none', // Mirror front camera
          }}
        />

        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
            <div className="text-center">
              <div 
                className="w-16 h-16 mx-auto mb-4 border-4 border-white border-t-transparent rounded-full animate-spin"
              />
              <p className="text-white text-lg font-semibold">
                {t('camera.loading', 'Starting camera...')}
              </p>
            </div>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-90 px-6">
            <div className="text-center max-w-md">
              <div 
                className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{ 
                  background: 'rgba(239, 68, 68, 0.2)',
                  color: '#ef4444',
                }}
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                {t('camera.error', 'Camera Error')}
              </h3>
              <p className="text-gray-300 text-sm mb-6">
                {error}
              </p>
              <button
                onClick={handleClose}
                className="px-6 py-3 rounded-xl text-white font-semibold"
                style={{
                  background: 'linear-gradient(135deg, var(--wine-600), var(--wine-700))',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {t('common.close', 'Close')}
              </button>
            </div>
          </div>
        )}

        {/* Camera Controls (only show when camera is ready) */}
        {!isLoading && !error && (
          <>
            {/* Top Bar - Close Button */}
            <div className="absolute top-0 left-0 right-0 z-10 p-4 safe-area-inset-top">
              <button
                onClick={handleClose}
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{
                  background: 'rgba(0, 0, 0, 0.5)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                }}
                aria-label={t('common.close', 'Close')}
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Bottom Bar - Shutter & Flip Camera */}
            <div className="absolute bottom-0 left-0 right-0 z-10 pb-8 safe-area-inset-bottom">
              <div className="flex items-center justify-center gap-8 px-8">
                {/* Flip Camera Button (only if multiple cameras) */}
                {hasMultipleCameras && (
                  <motion.button
                    onClick={handleFlipCamera}
                    className="w-14 h-14 rounded-full flex items-center justify-center"
                    style={{
                      background: 'rgba(255, 255, 255, 0.3)',
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                    }}
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                    aria-label={t('camera.flip', 'Flip camera')}
                  >
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </motion.button>
                )}

                {/* Shutter Button */}
                <motion.button
                  onClick={handleCapture}
                  className="w-20 h-20 rounded-full flex items-center justify-center"
                  style={{
                    background: 'white',
                    boxShadow: '0 0 0 4px rgba(255, 255, 255, 0.3)',
                  }}
                  whileTap={{ scale: 0.92 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                  aria-label={t('camera.capture', 'Take photo')}
                >
                  <div 
                    className="w-16 h-16 rounded-full"
                    style={{
                      background: 'linear-gradient(135deg, var(--wine-500), var(--wine-600))',
                    }}
                  />
                </motion.button>

                {/* Spacer for symmetry */}
                {hasMultipleCameras && <div className="w-14 h-14" />}
              </div>
            </div>

            {/* Hint Text */}
            <div className="absolute bottom-24 left-0 right-0 z-10 px-8 text-center safe-area-inset-bottom">
              <p 
                className="text-sm font-medium"
                style={{
                  color: 'rgba(255, 255, 255, 0.9)',
                  textShadow: '0 1px 3px rgba(0, 0, 0, 0.5)',
                }}
              >
                {t('camera.hint', 'Position the wine label in the frame')}
              </p>
            </div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
