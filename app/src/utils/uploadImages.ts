import * as ImageManipulator from "expo-image-manipulator";

// Сжимает и уменьшает фото, чтобы не слать 5–10MB на страницу
export async function compressForUpload(uri: string) {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1800 } }], // ширина 1800, высота авто
    { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

export async function uploadImagesToServer(params: {
  apiBaseUrl: string; // например https://med.apoteka24.me
  imageUris: string[];
}) {
  const { apiBaseUrl, imageUris } = params;

  const form = new FormData();

  for (let i = 0; i < imageUris.length; i++) {
    const compressedUri = await compressForUpload(imageUris[i]);

    form.append("images", {
      uri: compressedUri,
      name: `page-${i + 1}.jpg`,
      type: "image/jpeg",
    } as any);
  }

  const res = await fetch(`${apiBaseUrl}/api/upload/images`, {
    method: "POST",
    body: form,
    // ВАЖНО: НЕ ставим руками Content-Type, иначе boundary сломается
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Upload failed with status ${res.status}`);
  }

  return res.json();
}
