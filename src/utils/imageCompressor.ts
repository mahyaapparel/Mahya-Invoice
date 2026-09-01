/**
 * Utility untuk kompresi otomatis gambar (desain mockup, logo, bukti bayar)
 * Mengoptimalkan resolusi dan ukuran file agar maksimal 1MB tanpa kehilangan ketajaman visual.
 */

export interface CompressionResult {
  base64: string;
  originalSize: number;
  compressedSize: number;
  originalSizeFormatted: string;
  compressedSizeFormatted: string;
  savedPercent: number;
}

export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Kompres gambar ke Base64 dengan target ukuran maksimal (default 1MB / 1024 KB)
 * dan resolusi proporsional (maksimal 1920px untuk panjang/lebar).
 */
export async function compressImageFile(
  file: File,
  maxSizeMB: number = 1.0,
  maxDimension: number = 1920
): Promise<CompressionResult> {
  const originalSize = file.size;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Gagal membaca file gambar'));

    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format gambar tidak didukung'));

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Proporsional scale down jika resolusi gambar melebihi maxDimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Gagal menginisialisasi canvas untuk kompresi'));
          return;
        }

        // Background putih untuk menjaga transparansi PNG jika dikonversi ke JPEG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Iteratif mencari kualitas terbaik yang berada di bawah target maxSizeBytes (1MB)
        let quality = 0.88;
        let mimeType = 'image/jpeg';
        let base64 = canvas.toDataURL(mimeType, quality);

        const getBase64ByteLength = (b64: string): number => {
          const stringLength = b64.length - (b64.indexOf(',') + 1);
          return Math.ceil((stringLength * 3) / 4);
        };

        let currentSize = getBase64ByteLength(base64);

        // Jika ukuran masih di atas target, turunkan kualitas bertahap atau kurangi skala
        while (currentSize > maxSizeBytes && quality > 0.4) {
          quality -= 0.1;
          base64 = canvas.toDataURL(mimeType, quality);
          currentSize = getBase64ByteLength(base64);
        }

        // Jika masih di atas target setelah penurunan kualitas, resize canvas 75%
        if (currentSize > maxSizeBytes) {
          const secondaryCanvas = document.createElement('canvas');
          secondaryCanvas.width = Math.round(width * 0.75);
          secondaryCanvas.height = Math.round(height * 0.75);
          const sCtx = secondaryCanvas.getContext('2d');
          if (sCtx) {
            sCtx.fillStyle = '#FFFFFF';
            sCtx.fillRect(0, 0, secondaryCanvas.width, secondaryCanvas.height);
            sCtx.drawImage(canvas, 0, 0, secondaryCanvas.width, secondaryCanvas.height);
            base64 = secondaryCanvas.toDataURL(mimeType, 0.75);
            currentSize = getBase64ByteLength(base64);
          }
        }

        const savedPercent = Math.max(
          0,
          Math.round(((originalSize - currentSize) / originalSize) * 100)
        );

        resolve({
          base64,
          originalSize,
          compressedSize: currentSize,
          originalSizeFormatted: formatBytes(originalSize),
          compressedSizeFormatted: formatBytes(currentSize),
          savedPercent
        });
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}
