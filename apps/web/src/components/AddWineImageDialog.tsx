/**
 * Add Wine Image Dialog
 *
 * Two modes:
 *  1. Upload – pick from camera / photo library, upload to Supabase Storage
 *  2. URL    – paste an external image URL (e.g. Vivino)
 */

import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { uploadLabelImage } from '../services/labelScanService';
import * as storageImageService from '../services/storageImageService';

interface AddWineImageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the final image URL (public storage URL or external URL). */
  onSave: (imageUrl: string) => Promise<void>;
  /** Called with the storage path when the user uploads from device. Takes priority over onSave for storage uploads. */
  onSaveStoragePath?: (storagePath: string, bucket: string) => Promise<void>;
  currentImageUrl?: string | null;
  wineName: string;
  /** Stack above modals that use high z-index (e.g. wishlist details at 200). Defaults: 50 / 60. */
  overlayZIndex?: number;
  contentZIndex?: number;
}

type Tab = 'upload' | 'url';

export function AddWineImageDialog({
  isOpen,
  onClose,
  onSave,
  onSaveStoragePath,
  currentImageUrl,
  wineName,
  overlayZIndex,
  contentZIndex,
}: AddWineImageDialogProps) {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<Tab>('upload');

  // Upload tab state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // URL tab state
  const [imageUrl, setImageUrl] = useState(currentImageUrl || '');
  const [previewUrl, setPreviewUrl] = useState(currentImageUrl || '');
  const [urlError, setUrlError] = useState('');
  const [imageError, setImageError] = useState(false);
  const [isSavingUrl, setIsSavingUrl] = useState(false);

  const [isRemoving, setIsRemoving] = useState(false);

  // ── Upload tab handlers ──────────────────────────────────────────────────

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setUploadError('');

    // Local preview (no upload yet)
    const objectUrl = URL.createObjectURL(file);
    setUploadPreview(objectUrl);
  }, []);

  const handleUploadSave = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadError('');

    try {
      const { path, bucket } = await uploadLabelImage(selectedFile);

      if (onSaveStoragePath) {
        await onSaveStoragePath(path, bucket);
      } else {
        // Fallback: get public URL and call onSave
        const publicUrl = await storageImageService.getStorageImageUrl(bucket, path);
        await onSave(publicUrl || '');
      }

      onClose();
    } catch (err: any) {
      setUploadError(err.message || t('wineImage.uploadFailed', 'Upload failed. Please try again.'));
    } finally {
      setIsUploading(false);
    }
  };

  // ── URL tab handlers ─────────────────────────────────────────────────────

  const validateImageUrl = (url: string): boolean => {
    if (!url.trim()) return false;
    try {
      new URL(url);
    } catch {
      return false;
    }
    const imageExtensions = /\.(jpg|jpeg|png|webp|gif)$/i;
    const urlWithoutQuery = url.split('?')[0];
    return imageExtensions.test(urlWithoutQuery) || url.includes('vivino.com');
  };

  const handlePreview = () => {
    setUrlError('');
    setImageError(false);
    if (!validateImageUrl(imageUrl)) {
      setUrlError(t('wineImage.invalidUrl', 'Please enter a valid image URL (jpg, png, webp)'));
      return;
    }
    setPreviewUrl(imageUrl);
  };

  const handleUrlSave = async () => {
    if (!validateImageUrl(imageUrl)) {
      setUrlError(t('wineImage.invalidUrl', 'Please enter a valid image URL'));
      return;
    }
    setIsSavingUrl(true);
    setUrlError('');
    try {
      await onSave(imageUrl.trim());
      onClose();
    } catch (err: any) {
      setUrlError(err.message || t('wineImage.saveFailed', 'Failed to save image'));
    } finally {
      setIsSavingUrl(false);
    }
  };

  // ── Remove handler ───────────────────────────────────────────────────────

  const handleRemove = async () => {
    setIsRemoving(true);
    try {
      await onSave('');
      onClose();
    } catch (err: any) {
      setUploadError(err.message || t('wineImage.removeFailed', 'Failed to remove image'));
    } finally {
      setIsRemoving(false);
    }
  };

  if (!isOpen) return null;

  const isLoading = isUploading || isSavingUrl || isRemoving;
  const backdropZ = overlayZIndex ?? 50;
  const panelZ = contentZIndex ?? 60;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="fixed inset-0 bg-black bg-opacity-50"
            style={{ backdropFilter: 'blur(4px)', zIndex: backdropZ }}
          />

          {/* Dialog Container */}
          <div
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{
              zIndex: panelZ,
              paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="luxury-card w-full max-w-lg flex flex-col"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxHeight: 'min(90vh, calc(100dvh - 2rem))',
                minHeight: 0,
              }}
            >
              {/* Header */}
              <div
                className="flex-shrink-0 p-6 pb-4 border-b"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                      {currentImageUrl
                        ? t('wineImage.updateTitle', 'Update Wine Image')
                        : t('wineImage.addTitle', 'Add Wine Image')}
                    </h2>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {wineName}
                    </p>
                  </div>

                  <button
                    onClick={onClose}
                    className="flex-shrink-0 w-10 h-10 min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center transition-colors"
                    style={{ backgroundColor: 'var(--bg-muted)', color: 'var(--text-secondary)' }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Tab Toggle */}
                <div
                  className="flex mt-4 rounded-xl p-1 gap-1"
                  style={{ background: 'var(--bg-muted)' }}
                >
                  <button
                    onClick={() => setActiveTab('upload')}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: activeTab === 'upload' ? 'var(--bg-surface)' : 'transparent',
                      color: activeTab === 'upload' ? 'var(--text-primary)' : 'var(--text-secondary)',
                      boxShadow: activeTab === 'upload' ? 'var(--shadow-sm)' : 'none',
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {t('wineImage.tabUpload', 'Upload Photo')}
                  </button>

                  <button
                    onClick={() => setActiveTab('url')}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: activeTab === 'url' ? 'var(--bg-surface)' : 'transparent',
                      color: activeTab === 'url' ? 'var(--text-primary)' : 'var(--text-secondary)',
                      boxShadow: activeTab === 'url' ? 'var(--shadow-sm)' : 'none',
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    {t('wineImage.tabUrl', 'Paste URL')}
                  </button>
                </div>
              </div>

              {/* Content */}
              <div
                className="flex-1 px-4 py-4 sm:px-6 sm:py-5 space-y-4 overflow-y-auto"
                style={{ minHeight: 0, WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
              >
                {/* ── Upload Tab ── */}
                {activeTab === 'upload' && (
                  <>
                    {/* Hidden file input – accepts camera + gallery */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />

                    {uploadPreview ? (
                      /* Preview of selected photo */
                      <div className="space-y-3">
                        <div
                          className="relative rounded-xl overflow-hidden flex items-center justify-center"
                          style={{
                            background: 'var(--bg-muted)',
                            minHeight: '200px',
                            maxHeight: '260px',
                          }}
                        >
                          <img
                            src={uploadPreview}
                            alt="Selected"
                            className="max-w-full h-auto object-contain rounded-xl"
                            style={{ maxHeight: '260px' }}
                          />
                          <button
                            onClick={() => {
                              setSelectedFile(null);
                              setUploadPreview(null);
                              if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                            className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center"
                            style={{ background: 'rgba(0,0,0,0.55)', color: 'white' }}
                            aria-label="Remove selected photo"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>

                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="btn-luxury-secondary w-full text-sm"
                        >
                          {t('wineImage.changePhoto', 'Choose a Different Photo')}
                        </button>
                      </div>
                    ) : (
                      /* Pick photo buttons */
                      <div className="space-y-3">
                        {/* Primary: Camera / Gallery */}
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed transition-all py-10"
                          style={{
                            borderColor: 'var(--border-base)',
                            background: 'var(--bg-surface-elevated)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <div
                            className="w-14 h-14 rounded-full flex items-center justify-center"
                            style={{ background: 'var(--bg-muted)' }}
                          >
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </div>
                          <div className="text-center px-4">
                            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                              {t('wineImage.pickPhoto', 'Take Photo or Choose from Library')}
                            </p>
                            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                              {t('wineImage.pickPhotoHint', 'JPG, PNG or WEBP · Max 20 MB')}
                            </p>
                          </div>
                        </button>
                      </div>
                    )}

                    {/* Upload error */}
                    {uploadError && (
                      <div className="p-3 rounded-lg" style={{ background: 'rgba(220, 38, 38, 0.1)', border: '1px solid rgba(220, 38, 38, 0.3)' }}>
                        <p className="text-sm" style={{ color: 'rgb(220, 38, 38)' }}>{uploadError}</p>
                      </div>
                    )}
                  </>
                )}

                {/* ── URL Tab ── */}
                {activeTab === 'url' && (
                  <>
                    {/* Instructions */}
                    <div
                      className="p-3 sm:p-4 rounded-lg"
                      style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)' }}
                    >
                      <h3 className="text-xs sm:text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        {t('wineImage.howToTitle', 'How to add an image')}
                      </h3>
                      <ol className="text-xs sm:text-sm space-y-1 list-decimal list-inside" style={{ color: 'var(--text-secondary)' }}>
                        <li>{t('wineImage.step1', 'Open the Vivino page for this wine')}</li>
                        <li>{t('wineImage.step2', 'Right-click on the wine bottle image')}</li>
                        <li>{t('wineImage.step3', 'Select "Copy image address" or "Copy image URL"')}</li>
                        <li>{t('wineImage.step4', 'Paste the URL below')}</li>
                      </ol>
                      <p className="text-xs mt-2 italic" style={{ color: 'var(--text-tertiary)' }}>
                        {t('wineImage.disclaimer', 'Note: Images are user-provided. We do not scrape or store Vivino content.')}
                      </p>
                    </div>

                    {/* URL Input */}
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                        {t('wineImage.imageUrl', 'Image URL')}
                      </label>
                      <input
                        type="url"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        placeholder="https://example.com/wine-image.jpg"
                        className="input w-full"
                        style={{ minHeight: '44px' }}
                      />
                    </div>

                    {/* Preview Button */}
                    <button
                      onClick={handlePreview}
                      className="btn-luxury-secondary w-full"
                      disabled={!imageUrl.trim()}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      {t('wineImage.preview', 'Preview Image')}
                    </button>

                    {/* URL Preview */}
                    {previewUrl && !imageError && (
                      <div
                        className="p-4 rounded-lg"
                        style={{
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-base)',
                          maxHeight: '240px',
                          overflow: 'hidden',
                        }}
                      >
                        <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>
                          {t('wineImage.previewLabel', 'Preview')}
                        </p>
                        <div className="flex items-center justify-center" style={{ maxHeight: '200px', overflow: 'hidden' }}>
                          <img
                            src={previewUrl}
                            alt="Preview"
                            className="max-w-full h-auto mx-auto object-contain rounded"
                            style={{ maxHeight: '200px' }}
                            onError={() => {
                              setImageError(true);
                              setUrlError(t('wineImage.previewFailed', 'Failed to load image. Please check the URL.'));
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* URL error */}
                    {urlError && (
                      <div className="p-3 rounded-lg" style={{ background: 'rgba(220, 38, 38, 0.1)', border: '1px solid rgba(220, 38, 38, 0.3)' }}>
                        <p className="text-sm" style={{ color: 'rgb(220, 38, 38)' }}>{urlError}</p>
                      </div>
                    )}
                  </>
                )}

                <div style={{ height: '1px', minHeight: '1px' }} />
              </div>

              {/* Footer */}
              <div
                className="flex-shrink-0 p-6 pt-4 border-t flex gap-3"
                style={{
                  borderColor: 'var(--border-subtle)',
                  paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom) + 1rem)',
                }}
              >
                {currentImageUrl && (
                  <button
                    onClick={handleRemove}
                    disabled={isLoading}
                    className="btn-ghost flex-1"
                    style={{ minHeight: '44px', touchAction: 'manipulation' }}
                  >
                    {t('wineImage.remove', 'Remove Image')}
                  </button>
                )}

                {activeTab === 'upload' ? (
                  <button
                    onClick={handleUploadSave}
                    disabled={isLoading || !selectedFile}
                    className="btn-luxury flex-1"
                    style={{ minHeight: '44px', touchAction: 'manipulation' }}
                  >
                    {isUploading
                      ? t('wineImage.uploading', 'Uploading...')
                      : t('wineImage.save', 'Save Image')}
                  </button>
                ) : (
                  <button
                    onClick={handleUrlSave}
                    disabled={isLoading || !imageUrl.trim() || imageError}
                    className="btn-luxury flex-1"
                    style={{ minHeight: '44px', touchAction: 'manipulation' }}
                  >
                    {isSavingUrl ? t('wineImage.saving', 'Saving...') : t('wineImage.save', 'Save Image')}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
