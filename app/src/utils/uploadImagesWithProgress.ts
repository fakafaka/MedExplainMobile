import * as FileSystem from "expo-file-system/legacy";

type UploadImagesArgs = {
  apiBaseUrl: string;
  imageUris: string[];
  onProgress?: (percent: number) => void; // 0..100
};

function guessMime(uri: string) {
  const u = uri.toLowerCase();
  if (u.endsWith(".png")) return "image/png";
  if (u.endsWith(".webp")) return "image/webp";
  if (u.endsWith(".heic")) return "image/heic";
  return "image/jpeg";
}

export async function uploadImagesToServerWithProgress({
  apiBaseUrl,
  imageUris,
  onProgress,
}: UploadImagesArgs): Promise<any> {
  if (!imageUris.length) throw new Error("No images");

  const url = `${apiBaseUrl}/api/upload/images`;

  let lastJson: any = null;

  const batchId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  for (let i = 0; i < imageUris.length; i++) {
    const uri = imageUris[i];

    const uploadTask = FileSystem.createUploadTask(
      url,
      uri,
      {
        httpMethod: "POST",
        uploadType: 1 as any, // multipart
        fieldName: "images",
        mimeType: guessMime(uri),
        parameters: {
          batchId,
          isLast: i === imageUris.length - 1 ? "1" : "0",
        },
      },
      (p) => {
        const total = p.totalBytesExpectedToSend;
        const sent = p.totalBytesSent;

        const fileFrac = total && total > 0 ? sent / total : 0;
        const overall = ((i + fileFrac) / imageUris.length) * 100;

        onProgress?.(Math.max(1, Math.min(99, Math.round(overall))));
      }
    );

    const res = await uploadTask.uploadAsync();

    if (!res) throw new Error("No response");
    if (res.status < 200 || res.status >= 300) {
      throw new Error(res.body || `HTTP ${res.status}`);
    }

    lastJson = res.body ? JSON.parse(res.body) : null;
  }

  onProgress?.(100);
  return lastJson;
}