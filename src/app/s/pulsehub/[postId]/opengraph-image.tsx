import { ImageResponse } from "next/og";
import { getPulseHubSharePost } from "@/lib/pulsehubShare";

export const runtime = "nodejs";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

type OgImageProps = {
  params: Promise<{ postId: string }>;
};

export default async function PulseHubOpenGraphImage({ params }: OgImageProps) {
  const { postId } = await params;
  const post = await getPulseHubSharePost(postId);

  const title = post?.title ?? "Publicação PulseHub";
  const description = post?.description ?? "Acesse o Portal de RH para visualizar esta publicação.";
  const publisher = post?.publisher ?? "Portal de RH";
  const type = post?.postType ?? "Publicação";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f4f7fb",
          color: "#0f172a",
          padding: 56,
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 92,
              height: 92,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 28,
              background: "#0f172a",
              color: "#ffffff",
              fontSize: 34,
              fontWeight: 900,
            }}
          >
            RH
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ color: "#64748b", fontSize: 24, fontWeight: 800, letterSpacing: 2 }}>PULSEHUB</div>
            <div style={{ color: "#0f172a", fontSize: 34, fontWeight: 900 }}>{publisher}</div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 22,
            borderRadius: 36,
            border: "2px solid #dbe5f0",
            background: "#ffffff",
            padding: 42,
            boxShadow: "0 24px 70px rgba(15, 23, 42, 0.12)",
          }}
        >
          <div
            style={{
              alignSelf: "flex-start",
              borderRadius: 999,
              background: "#eff6ff",
              color: "#075fe4",
              padding: "10px 18px",
              fontSize: 20,
              fontWeight: 900,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            {type}
          </div>
          <div style={{ fontSize: 58, lineHeight: 1.04, fontWeight: 900, letterSpacing: -1 }}>{title}</div>
          <div style={{ color: "#475569", fontSize: 28, lineHeight: 1.35, fontWeight: 500 }}>{description}</div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#64748b", fontSize: 24 }}>
          <div>Portal de RH</div>
          <div>Login necessário para visualizar</div>
        </div>
      </div>
    ),
    size
  );
}
