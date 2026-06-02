import path from "node:path";
import { pathToFileURL } from "node:url";
import { createCanvas } from "@napi-rs/canvas";
import type { Canvas, SKRSContext2D } from "@napi-rs/canvas";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const PDF_BUCKET = "internal-social-media";
const STORAGE_MARKERS = [
  "/storage/v1/object/sign/internal-social-media/",
  "/storage/v1/object/public/internal-social-media/",
  "/storage/v1/object/authenticated/internal-social-media/",
];

type PdfAttachmentRow = {
  id: string;
  url: string;
  label: string | null;
};

type CanvasEntry = {
  canvas: Canvas;
  context: SKRSContext2D;
};

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isSafePdfPath(value: string) {
  const cleaned = value.trim().split("?")[0].split("#")[0];
  return !!cleaned && !cleaned.startsWith("/") && !cleaned.includes("..") && /\.pdf$/i.test(cleaned);
}

function storagePathFromUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed) && isSafePdfPath(trimmed)) return trimmed;

  try {
    const targetUrl = new URL(trimmed);
    for (const marker of STORAGE_MARKERS) {
      const markerIndex = targetUrl.pathname.indexOf(marker);
      if (markerIndex >= 0) {
        const rawPath = targetUrl.pathname.slice(markerIndex + marker.length);
        const decodedPath = safeDecode(rawPath);
        return isSafePdfPath(decodedPath) ? decodedPath : null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

async function getFirstPdfAttachment(postId: string) {
  const { data, error } = await supabaseAdmin
    .from("internal_social_post_attachments")
    .select("id,url,label")
    .eq("post_id", postId)
    .eq("type", "pdf")
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle<PdfAttachmentRow>();

  if (error || !data?.url) return null;
  return data;
}

async function downloadPdfBytes(attachment: PdfAttachmentRow) {
  const storagePath = storagePathFromUrl(attachment.url);
  if (storagePath) {
    const file = await supabaseAdmin.storage.from(PDF_BUCKET).download(storagePath);
    if (file.error || !file.data) return null;
    return file.data.arrayBuffer();
  }

  if (!/^https?:\/\//i.test(attachment.url)) return null;
  const response = await fetch(attachment.url, { cache: "no-store" });
  if (!response.ok) return null;
  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.arrayBuffer();
  const header = new TextDecoder().decode(body.slice(0, 5));
  if (!contentType.toLowerCase().includes("pdf") && header !== "%PDF-") return null;
  return body;
}

export async function renderPulseHubFirstPdfPagePng(postId: string) {
  const attachment = await getFirstPdfAttachment(postId);
  if (!attachment) return null;

  const pdfBytes = await downloadPdfBytes(attachment);
  if (!pdfBytes) return null;

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const standardFontDataUrl = pathToFileURL(path.join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts") + path.sep).href;
  const task = pdfjs.getDocument({
    data: new Uint8Array(pdfBytes),
    useWorkerFetch: false,
    isEvalSupported: false,
    isOffscreenCanvasSupported: false,
    useSystemFonts: true,
    standardFontDataUrl,
  });

  const doc = await task.promise;
  try {
    const page = await doc.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const targetWidth = 1200;
    const targetHeight = 630;
    const scale = Math.min(targetWidth / baseViewport.width, targetHeight / baseViewport.height) * 1.9;
    const viewport = page.getViewport({ scale });
    const canvasFactory = {
      create(width: number, height: number): CanvasEntry {
        const canvas = createCanvas(width, height);
        const context = canvas.getContext("2d") as SKRSContext2D;
        return { canvas, context };
      },
      reset(canvasEntry: CanvasEntry, width: number, height: number) {
        canvasEntry.canvas.width = width;
        canvasEntry.canvas.height = height;
      },
      destroy(canvasEntry: CanvasEntry) {
        canvasEntry.canvas.width = 0;
        canvasEntry.canvas.height = 0;
      },
    };
    const canvasEntry = canvasFactory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({
      canvasContext: canvasEntry.context as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;
    return canvasEntry.canvas.toBuffer("image/png") as Buffer;
  } finally {
    await doc.destroy();
  }
}
