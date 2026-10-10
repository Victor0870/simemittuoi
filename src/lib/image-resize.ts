/**
 * Client-side helper để nén và resize ảnh chụp máy ảnh dung lượng cao trước khi upload
 */
export async function resizeImageFile(
  file: File,
  maxWidth = 1600,
  maxHeight = 1200,
  quality = 0.82,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const image = new Image();
      image.onload = () => {
        let width = image.width;
        let height = image.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / maxWidth > height / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            maxHeight = height;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(readerEvent.target?.result as string);
          return;
        }

        ctx.drawImage(image, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      image.onerror = (err) => reject(err);
      image.src = readerEvent.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}
