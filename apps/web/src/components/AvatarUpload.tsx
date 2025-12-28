import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { toast } from '../lib/toast';

interface Props {
  currentAvatarUrl: string | null;
  onUploadSuccess: (newAvatarUrl: string) => void;
  userId: string;
}

export function AvatarUpload({ currentAvatarUrl, onUploadSuccess, userId }: Props) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compress and resize image client-side
  // Target: Small avatar files (~50-200KB) for fast loading
  async function compressImage(file: File): Promise<File> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          const originalWidth = img.width;
          const originalHeight = img.height;

          // Calculate new dimensions (max 512px for avatars)
          // Avatars are small, 512px is plenty for profile pictures
          const MAX_SIZE = 512;
          let width = originalWidth;
          let height = originalHeight;

          if (width > height) {
            if (width > MAX_SIZE) {
              height = (height * MAX_SIZE) / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width = (width * MAX_SIZE) / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;

          console.log('[AvatarUpload] Resizing:', {
            original: `${originalWidth}x${originalHeight}`,
            new: `${Math.round(width)}x${Math.round(height)}`,
          });

          // Enable image smoothing for better quality
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Draw image on canvas (resized)
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to blob (JPEG, 80% quality for smaller files)
          canvas.toBlob(
            (blob) => {
              if (blob) {
                console.log('[AvatarUpload] Compression:', {
                  originalSize: `${(file.size / 1024).toFixed(0)} KB`,
                  compressedSize: `${(blob.size / 1024).toFixed(0)} KB`,
                  reduction: `${Math.round((1 - blob.size / file.size) * 100)}%`,
                });
                
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                reject(new Error('Failed to compress image'));
              }
            },
            'image/jpeg',
            0.80  // Reduced from 0.85 to 0.80 for smaller files
          );
        };
        img.onerror = () => reject(new Error('Failed to load image'));
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
    });
  }

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(t('profile.avatar.errorNotImage'));
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('profile.avatar.errorTooLarge'));
      return;
    }

    setUploading(true);
    setUploadProgress(10);

    try {
      console.log('[AvatarUpload] Compressing image...');
      setUploadProgress(20);
      
      // Compress image
      const compressedFile = await compressImage(file);
      console.log('[AvatarUpload] Original size:', file.size, 'Compressed:', compressedFile.size);
      
      setUploadProgress(40);

      // Delete old avatar if exists
      if (currentAvatarUrl) {
        const oldPath = currentAvatarUrl.split('/avatars/')[1];
        if (oldPath) {
          console.log('[AvatarUpload] Deleting old avatar:', oldPath);
          await supabase.storage.from('avatars').remove([oldPath]);
        }
      }

      setUploadProgress(50);

      // Upload to Supabase Storage
      const fileExt = 'jpg'; // Always save as JPEG after compression
      const fileName = `${userId}/avatar.${fileExt}`;
      const timestamp = Date.now(); // Add timestamp to force cache bust

      console.log('[AvatarUpload] Uploading to:', fileName);

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, compressedFile, {
          cacheControl: '3600',
          upsert: true, // Overwrite existing file
        });

      if (uploadError) {
        console.error('[AvatarUpload] Upload error:', uploadError);
        
        // Provide user-friendly error messages
        if (uploadError.message?.includes('row-level security')) {
          throw new Error(
            'Upload permissions not configured. Please contact support or check Storage policies in Supabase Dashboard.'
          );
        }
        
        if (uploadError.message?.includes('Bucket not found')) {
          throw new Error(
            'Storage bucket not found. Please ensure the "avatars" bucket exists in Supabase Storage.'
          );
        }
        
        throw new Error(`Upload failed: ${uploadError.message || 'Unknown error'}`);
      }

      setUploadProgress(80);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Add timestamp to URL to force browser to reload
      const avatarUrl = `${urlData.publicUrl}?t=${timestamp}`;
      
      console.log('[AvatarUpload] Upload successful:', avatarUrl);
      
      setUploadProgress(90);

      // Update profile with new avatar URL
      // @ts-ignore - Supabase type inference issue
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', userId);

      if (updateError) {
        console.error('[AvatarUpload] Profile update error:', updateError);
        throw new Error(updateError.message);
      }

      setUploadProgress(100);
      
      toast.success(t('profile.avatar.uploadSuccess'));
      onUploadSuccess(avatarUrl);
    } catch (error: any) {
      console.error('[AvatarUpload] Error:', error);
      toast.error(error.message || t('profile.avatar.uploadFailed'));
    } finally {
      setUploading(false);
      setUploadProgress(0);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  async function handleRemove() {
    if (!currentAvatarUrl) return;

    const confirmed = confirm(t('profile.avatar.removeConfirm'));
    if (!confirmed) return;

    setUploading(true);

    try {
      // Delete from storage
      const oldPath = currentAvatarUrl.split('/avatars/')[1];
      if (oldPath) {
        console.log('[AvatarUpload] Removing avatar:', oldPath);
        await supabase.storage.from('avatars').remove([oldPath]);
      }

      // Update profile
      // @ts-ignore - Supabase type inference issue
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', userId);

      if (error) throw error;

      toast.success(t('profile.avatar.removed'));
      onUploadSuccess('');
    } catch (error: any) {
      console.error('[AvatarUpload] Remove error:', error);
      toast.error(error.message || t('profile.avatar.removeFailed'));
    } finally {
      setUploading(false);
    }
  }

  // Generate initials from user email or name as fallback
  const getInitials = () => {
    // This will be enhanced when we have user's name
    return '?';
  };

  return (
    <div className="space-y-4">
      {/* Avatar Preview */}
      <div className="flex items-center gap-4">
        <div className="relative">
          {currentAvatarUrl ? (
            <img
              src={currentAvatarUrl}
              alt="Avatar"
              className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-2xl font-bold border-2 border-gray-200">
              {getInitials()}
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
              <div className="text-white text-sm font-semibold">
                {uploadProgress}%
              </div>
            </div>
          )}
        </div>

        <div className="flex-1">
          <p className="text-sm text-gray-600 mb-2">
            {t('profile.avatar.description')}
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              disabled={uploading}
              className="hidden"
              id="avatar-upload"
            />
            <label
              htmlFor="avatar-upload"
              className={`btn btn-primary text-sm ${
                uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              {uploading ? t('profile.avatar.uploading') : t('profile.avatar.upload')}
            </label>
            {currentAvatarUrl && !uploading && (
              <button
                onClick={handleRemove}
                className="btn btn-secondary text-sm"
              >
                {t('profile.avatar.remove')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {uploading && (
        <div className="w-full">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Helper Text */}
      <p className="text-xs text-gray-500">
        {t('profile.avatar.requirements')}
      </p>
    </div>
  );
}

