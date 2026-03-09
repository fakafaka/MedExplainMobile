import { API_BASE_URL } from "./config";
import { getInstallId } from "../utils/installId";

export async function healthCheck() {
  const res = await fetch(`${API_BASE_URL}/health`);
  const text = await res.text();
  if (!res.ok) throw new Error(`Health check failed: ${res.status} ${text}`);
  return JSON.parse(text);
}

export async function analyzePdfBase64(pdfBase64: string, filename?: string) {
  console.log("[API] analyzePdf", {
    sourceType: "pdf",
    pdfBase64Length: pdfBase64?.length,
    filename: filename || "upload.pdf",
  });

  const installId = await getInstallId();

  const res = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      installId,
      sourceType: "pdf",
      pdfBase64,
      filename: filename || "upload.pdf",
    }),
  });

  const text = await res.text();
  console.log("[API] analyzePdf status:", res.status);
  console.log("[API] analyzePdf body:", text.slice(0, 300));
  if (!res.ok) throw new Error(`API error ${res.status}: ${text}`);
  return JSON.parse(text);
}
export async function getReports() {
  const res = await fetch(`${API_BASE_URL}/api/reports`);
  const text = await res.text();
  if (!res.ok) throw new Error(`Reports failed: ${res.status} ${text}`);
  return JSON.parse(text);
}

export async function getReportById(id: string) {
  const res = await fetch(`${API_BASE_URL}/api/reports/${encodeURIComponent(id)}`);
  const text = await res.text();
  if (!res.ok) throw new Error(`Report ${id} failed: ${res.status} ${text}`);
  return JSON.parse(text);
}
