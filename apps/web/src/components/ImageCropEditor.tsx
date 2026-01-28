/**
 * Image Crop Editor Component
 * 
 * Full-screen image cropping interface for wine labels
 * - Pinch to zoom
 * - Pan to reposition
 * - Crop to focus area
 * - Mobile-optimized gestures
 */

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import Cropper from 'react-easy-crop';
import { useTranslation } from 'react-i18next';

interface ImageCropEditorProps {
  imageUrl: string;
  onCropComplete: (croppedImageBlob: Blob) => void;
  onCancel: () => void;
}

interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function ImageCropEditor({ imageUrl, onCropComplete, onCancel }: ImageCropEditorProps) {
  const { t } = useTranslation();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropChange = useCallback((location: { x: number; y: number }) => {
    setCrop(location);
  }, []);

  const onZoomChange = useCallback((zoom: number) => {
    setZoom(zoom);
  }, []);

  const onCropCompleteCallback = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const handleDone = async () => {
    if (!croppedAreaPixels) {
      console.error('[ImageCropEditor] No cropped area available');
      return;
    }

    setIsProcessing(true);

    try {
      // Create a cropped image blob
      const croppedBlob = await getCroppedImg(imageUrl, croppedAreaPixels);
      onCropComplete(croppedBlob);
    } catch (error) {
      console.error('[ImageCropEditor] Error creating cropped image:', error);
      setIsProcessing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black z-[200] flex flex-col"
      style={{ height: '100dvh' }}
    >
      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-black/90 backdrop-blur-sm"
        style={{
          paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        }}
      >
        <button
          onClick={onCancel}
          disabled={isProcessing}
          className="text-white font-medium px-3 py-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
          style={{
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation',
          }}
        >
          {t('common.cancel')}
        </button>
        <h2 className="text-white font-semibold text-lg">
          {t('cellar.labelScan.cropTitle', 'Crop Label')}
        </h2>
        <button
          onClick={handleDone}
          disabled={isProcessing}
          className="text-white font-bold px-3 py-2 min-h-[44px] flex items-center justify-center"
          style={{
            color: 'var(--color-wine-400)',
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation',
          }}
        >
          {isProcessing ? '⏳' : t('common.done', 'Done')}
        </button>
      </div>

      {/* Crop Area */}
      <div className="flex-1 relative">
        <Cropper
          image={imageUrl}
          crop={crop}
          zoom={zoom}
          aspect={3 / 4} // Wine label aspect ratio (portrait)
          onCropChange={onCropChange}
          onCropComplete={onCropCompleteCallback}
          onZoomChange={onZoomChange}
          minZoom={1}
          maxZoom={3}
          style={{
            containerStyle: {
              backgroundColor: '#000',
            },
            cropAreaStyle: {
              border: '2px solid rgba(164, 77, 90, 0.8)',
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.7)',
            },
          }}
        />
      </div>

      {/* Instructions */}
      <div
        className="flex-shrink-0 bg-black/90 backdrop-blur-sm px-6 py-4 text-center"
        style={{
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        }}
      >
        <div className="flex items-center justify-center gap-6 text-white/70 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🤏</span>
            <span>{t('cellar.labelScan.pinchToZoom', 'Pinch to zoom')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">✋</span>
            <span>{t('cellar.labelScan.dragToPan', 'Drag to move')}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Create a cropped image blob from the original image
 */
async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Set canvas size to match the cropped area
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  // Draw the cropped image
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  // Convert canvas to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to create blob'));
      }
    }, 'image/jpeg', 0.95); // High quality JPEG
  });
}

/**
 * Load an image from URL
 */
function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.src = url;
  });
}
