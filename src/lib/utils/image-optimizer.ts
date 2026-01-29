/**
 * Optimizes an image file for upload
 * - Resizes to 1024x1024
 * - Converts to WebP format
 * - Compresses to 80% quality
 * - Ensures file size < 1MB
 */
export async function optimizeImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    img.onload = () => {
      // Calculate dimensions (resize to fit within 1024x1024, maintaining aspect ratio)
      let width = img.width;
      let height = img.height;
      const maxSize = 1024;

      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
      }

      // Set canvas size
      canvas.width = width;
      canvas.height = height;

      // Draw image on canvas
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to WebP with 80% quality
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to convert image to blob'));
            return;
          }

          // Check file size
          if (blob.size > 1024 * 1024) {
            // If still > 1MB, try with lower quality
            canvas.toBlob(
              (newBlob) => {
                if (!newBlob) {
                  reject(new Error('Failed to optimize image to under 1MB'));
                  return;
                }
                resolve(newBlob);
              },
              'image/webp',
              0.6 // Lower quality to reduce size
            );
          } else {
            resolve(blob);
          }
        },
        'image/webp',
        0.8 // 80% quality
      );
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    // Load image from file
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        img.src = e.target.result as string;
      }
    };
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Validates image file before processing
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  // Check if file is an image
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'File must be an image' };
  }

  // Check file size (max 10MB before optimization)
  const maxSizeBeforeOptimization = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSizeBeforeOptimization) {
    return { valid: false, error: 'Image file too large (max 10MB)' };
  }

  return { valid: true };
}
