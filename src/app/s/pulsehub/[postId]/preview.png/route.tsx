import { ImageResponse } from "next/og";
import { renderPulseHubFirstPdfPagePng } from "@/lib/pulsehubPdfPreview";
import { getPulseHubSharePost } from "@/lib/pulsehubShare";

export const runtime = "nodejs";

type PreviewImageProps = {
  params: Promise<{ postId: string }>;
};

export async function GET(_request: Request, { params }: PreviewImageProps) {
  const { postId } = await params;
  const post = await getPulseHubSharePost(postId);
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

  const title = post?.title ?? "Publicação PulseHub";
  const description = post?.description ?? "Acesse o Portal de RH para visualizar esta publicação.";
  const publisher = post?.publisher ?? "Portal de RH";
  const type = post?.postType ?? "Publicação";

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
            boxShadow: "0 24px 70px rgba(15, 23, 42, 0.12)",
          }}
        >
          <div
            style={{
              alignSelf: "flex-start",
              borderRadius: "999px",
              background: "#eff6ff",
              color: "#075fe4",
              padding: "10px 18px",
              fontSize: "20px",
              fontWeight: 900,
              letterSpacing: "2px",
              textTransform: "uppercase",
            }}
          >
            {type}
          </div>
          <div style={{ fontSize: "58px", lineHeight: 1.04, fontWeight: 900 }}>{title}</div>
          <div style={{ color: "#475569", fontSize: "28px", lineHeight: 1.35, fontWeight: 500 }}>{description}</div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", fontSize: "24px" }}>
          <div>Portal de RH</div>
          <div>Login necessário para visualizar</div>
        </div>
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
