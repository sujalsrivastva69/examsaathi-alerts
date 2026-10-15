import { env } from "../../config/env.js";

const visionFilesAnnotateUrl = "https://vision.googleapis.com/v1/files:annotate";
const maxInlinePdfBytes = 10 * 1024 * 1024;
const maxOcrPages = 10;
const pagesPerRequest = 5;

export async function extractScannedPdfText(
  buffer,
  pageCount,
  { apiKey = env.GOOGLE_CLOUD_VISION_API_KEY, fetcher = fetch } = {},
) {
  if (!Buffer.isBuffer(buffer) || buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error("Cloud Vision OCR requires a PDF buffer");
  }
  if (!apiKey) return { text: "", reason: "ocr_not_configured" };
  if (buffer.length > maxInlinePdfBytes) return { text: "", reason: "ocr_pdf_too_large" };
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    return { text: "", reason: "ocr_page_count_unavailable" };
  }
  if (pageCount > maxOcrPages) return { text: "", reason: "ocr_page_limit" };

  const textPages = [];
  for (let start = 1; start <= pageCount; start += pagesPerRequest) {
    const pages = Array.from(
      { length: Math.min(pagesPerRequest, pageCount - start + 1) },
      (_value, index) => start + index,
    );
    const response = await fetcher(visionFilesAnnotateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        requests: [
          {
            inputConfig: {
              content: buffer.toString("base64"),
              mimeType: "application/pdf",
            },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            pages,
          },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      throw new Error(`Google Cloud Vision OCR returned HTTP ${response.status}`);
    }

    const result = await response.json();
    const fileResult = result?.responses?.[0];
    if (!fileResult || fileResult.error) {
      throw new Error(
        fileResult?.error?.message ?? "Google Cloud Vision OCR returned an invalid response",
      );
    }
    if (!Array.isArray(fileResult.responses)) {
      throw new Error("Google Cloud Vision OCR response is missing page results");
    }
    const pageError = fileResult.responses.find((page) => page.error);
    if (pageError) {
      throw new Error(pageError.error.message ?? "Google Cloud Vision failed to process a page");
    }
    textPages.push(...fileResult.responses.map((page) => page.fullTextAnnotation?.text ?? ""));
  }

  const text = textPages.join("\n").replace(/\s+/g, " ").trim();
  if (text.length < 80) return { text: "", reason: "ocr_text_unavailable" };
  return { text, reason: null };
}
