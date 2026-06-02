import { ImageResponse } from "next/og";
import { getPulseHubAttachedPreviewImage, renderPulseHubFirstPdfPagePng } from "@/lib/pulsehubPdfPreview";
import { getPulseHubSharePost } from "@/lib/pulsehubShare";

export const runtime = "nodejs";

type ShareImageContext = {
  params: Promise<{ postId: string }>;
};

export async function GET(_request: Request, { params }: ShareImageContext) {
  const { postId } = await params;
  const attachedImage = await getPulseHubAttachedPreviewImage(postId).catch(() => null);

  if (attachedImage) {
    return new Response(new Uint8Array(attachedImage.body), {
      status: 200,
      headers: {
        "Content-Type": attachedImage.contentType,
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  }

  const pdfPreview = await renderPulseHubFirstPdfPagePng(postId).catch(() => null);

  if (pdfPreview) {
    return new Response(new Uint8Array(pdfPreview), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  }

  const post = await getPulseHubSharePost(postId);
  const title = post?.title ?? "Publicação PulseHub";
  const description = post?.description ?? "Acesse o Portal de RH para visualizar esta publicação.";
  const publisher = post?.publisher ?? "Portal de RH";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f4f7fb",
          color: "#0f172a",
          padding: "56px",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <div
            style={{
              width: "92px",
              height: "92px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "28px",
              background: "#0f172a",
              color: "#ffffff",
              fontSize: "34px",
              fontWeight: 900,
            }}
          >
            RH
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ color: "#64748b", fontSize: "24px", fontWeight: 800, letterSpacing: "2px" }}>PULSEHUB</div>
            <div style={{ color: "#0f172a", fontSize: "34px", fontWeight: 900 }}>{publisher}</div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "22px",
            borderRadius: "36px",
            border: "2px solid #dbe5f0",
            background: "#ffffff",
            padding: "42px",
          }}
        >
          <div style={{ fontSize: "58px", lineHeight: 1.04, fontWeight: 900 }}>{title}</div>
          <div style={{ color: "#475569", fontSize: "28px", lineHeight: 1.35, fontWeight: 500 }}>{description}</div>
        </div>
        <div style={{ color: "#64748b", fontSize: "24px" }}>Portal de RH</div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    }
  );
}
