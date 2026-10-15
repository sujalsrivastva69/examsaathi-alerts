import pdfParse from "pdf-parse";

const maxPdfBytes = 20 * 1024 * 1024;

export async function extractPdfText(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { text: "", reason: "empty_pdf", page_count: null };
  }
  if (buffer.length > maxPdfBytes) {
    return { text: "", reason: "pdf_too_large", page_count: null };
  }
  if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    return { text: "", reason: "not_a_pdf", page_count: null };
  }

  try {
    const result = await pdfParse(buffer, { max: 100 });
    const text = result.text.replace(/\s+/g, " ").trim();
    if (text.length < 80) {
      return { text: "", reason: "needs_manual_entry", page_count: result.numpages };
    }
    return { text, reason: null, page_count: result.numpages };
  } catch (error) {
    console.error("Could not extract PDF text", error);
    return { text: "", reason: "needs_manual_entry", page_count: null };
  }
}

export async function extractPdfDocument(buffer, pdfUrl, hash, extractText = extractPdfText) {
  const parsed = await extractText(buffer);
  return {
    text: parsed.text,
    pdfUrl,
    reason: parsed.reason ?? null,
    hash,
  };
}
