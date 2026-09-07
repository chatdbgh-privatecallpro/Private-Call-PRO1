/**
 * Client-Side Image Resizer & Compressor
 * Ensures all chat attachments, avatars, and banner images stay well under Firestore's 1MB document limit (< 400KB)
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  targetMaxBytes?: number; // default 400KB
  format?: 'image/jpeg' | 'image/webp' | 'image/png';
}

export async function compressImage(
  fileOrDataUrl: File | Blob | string,
  options: CompressionOptions = {}
): Promise<{ dataUrl: string; sizeBytes: number; width: number; height: number; name: string }> {
  const {
    maxWidth = 1024,
    maxHeight = 1024,
    quality = 0.75,
    targetMaxBytes = 400 * 1024, // 400 KB
    format = 'image/jpeg',
  } = options;

  let originalName = 'image.jpg';
  if (fileOrDataUrl instanceof File) {
    originalName = fileOrDataUrl.name;
  }

  // Convert File/Blob to Image
  const img = await loadImage(fileOrDataUrl);

  // Calculate new dimensions preserving aspect ratio
  let { width, height } = img;
  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  // Draw to offscreen canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is not available');
  }

  // Fill white background for transparent images converted to JPEG
  if (format === 'image/jpeg') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
  }

  ctx.drawImage(img, 0, 0, width, height);

  // First compression pass
  let currentQuality = quality;
  let dataUrl = canvas.toDataURL(format, currentQuality);
  let estimatedBytes = Math.round((dataUrl.length * 3) / 4);

  // Iteratively reduce quality if still over targetMaxBytes
  let attempts = 0;
  while (estimatedBytes > targetMaxBytes && currentQuality > 0.3 && attempts < 4) {
    attempts++;
    currentQuality -= 0.15;
    dataUrl = canvas.toDataURL(format, Math.max(0.2, currentQuality));
    estimatedBytes = Math.round((dataUrl.length * 3) / 4);
  }

  return {
    dataUrl,
    sizeBytes: estimatedBytes,
    width,
    height,
    name: originalName.replace(/\.[^/.]+$/, '') + '.jpg',
  };
}

function loadImage(source: File | Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Failed to load image for compression'));

    if (typeof source === 'string') {
      img.src = source;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (typeof e.target?.result === 'string') {
          img.src = e.target.result;
        } else {
          reject(new Error('Failed to read image file'));
        }
      };
      reader.onerror = () => reject(new Error('FileReader error on image'));
      reader.readAsDataURL(source);
    }
  });
}
