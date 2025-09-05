// /api/card.png.js — Edge runtime PNG for OG tags
import { ImageResponse } from "@vercel/og";

export const config = { runtime: "edge" };

// TODO: replace this with your real data source for a given hash.
async function loadDataByHash(hash) {
  // Example: if you have a JSON per analysis like /api/analysis/<hash>.json:
  const url = `https://lnk.az/api/analysis/${encodeURIComponent(hash)}.json`;
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (r.ok) return await r.json();
  } catch {}
  // Fallback defaults
  return {
    title: "Ukrayna sülhü və Azərbaycan üçün potensial təhlükələr",
    platform: "Facebook",
    reliability: 45,
    political_bias: -3.5,
    socio_cultural_bias: 0.0,
    summary: "Tarixçi və analitik ...",
    footer: "LNK tərəfindən təhlil edilib",
  };
}

export default async function handler(req) {
  const url = new URL(req.url);
  const hash = url.searchParams.get("hash");
  const dataParam = url.searchParams.get("data");

  let data = {};
  if (dataParam) {
    try { data = JSON.parse(dataParam); } catch {}
  } else if (hash) {
    data = await loadDataByHash(hash);
  } else {
    // No hash or data => minimal defaults
    data = await loadDataByHash("");
  }

  const {
    title = "Ukrayna sülhü və Azərbaycan üçün potensial təhlükələr",
    platform = "Facebook",
    reliability = 45,
    political_bias = -3.5,
    socio_cultural_bias = 0.0,
    summary = "Tarixçi və analitik ...",
    footer = "LNK tərəfindən təhlil edilib",
  } = data;

  return new ImageResponse(
    (
      <div style={{
        width: "1200px", height: "630px", display: "flex", flexDirection: "row",
        background: "#0B0E14", color: "#E5E7EB", fontFamily: "Inter, sans-serif",
        padding: "40px 48px", gap: "32px",
      }}>
        {/* Left */}
        <div style={{ flex: 1.15, display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 36, fontWeight: 800, marginBottom: 20, color: "#60A5FA" }}>LNK.az</div>
          <div style={{ fontSize: 56, fontWeight: 800, color: "#F3F4F6", marginBottom: 20 }}>{title}</div>
          <div style={{ fontSize: 22, color: "#9CA3AF", marginBottom: 22 }}>✔ {platform}</div>
          <div style={{ display: "flex", gap: "16px", marginBottom: 20 }}>
            <Metric label="Etibarlılıq" value={reliability} />
            <Metric label="Siyasi meyl" value={political_bias} />
            <Metric label="Sosial-Mədəni meyl" value={socio_cultural_bias} />
          </div>
          <div style={{ fontSize: 24, lineHeight: 1.4, color: "#D1D5DB", marginBottom: "auto" }}>{summary}</div>
          <div style={{ fontSize: 18, color: "#9CA3AF" }}>✔ {footer}</div>
        </div>

        {/* Right quadrant */}
        <div style={{
          width: "520px", border: "1px solid #1F2433", borderRadius: 20,
          background: "#0E1220", padding: 24, position: "relative",
        }}>
          <div style={{
            width: "100%", height: "100%", border: "1px solid #2A3146", borderRadius: 14, position: "relative",
          }}>
            {/* axes */}
            <div style={{ position: "absolute", left: 40, right: 40, top: "50%", height: 2, background: "#2A3146" }} />
            <div style={{ position: "absolute", top: 40, bottom: 40, left: "50%", width: 2, background: "#2A3146" }} />
            {/* labels */}
            <div style={{ position: "absolute", top: 6, left: "50%", transform: "translateX(-50%)", fontSize: 16, color: "#9CA3AF" }}>Etibarlı</div>
            <div style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", fontSize: 16, color: "#9CA3AF" }}>Etibarsız</div>
            <div style={{ position: "absolute", top: "50%", left: 6, transform: "translateY(-50%)", fontSize: 16, color: "#9CA3AF" }}>Müxalif</div>
            <div style={{ position: "absolute", top: "50%", right: 6, transform: "translateY(-50%)", fontSize: 16, color: "#9CA3AF" }}>İqtidar</div>
            {/* dot */}
            <div style={{
              position: "absolute", width: 18, height: 18, borderRadius: "50%", background: "#EF4444",
              left: `${40 + ((Number(political_bias) + 5) / 10) * 420 - 9}px`,
              top: `${40 + (1 - Number(reliability) / 100) * 420 - 9}px`,
              boxShadow: "0 0 10px rgba(239,68,68,.35)",
            }} />
          </div>
          <div style={{ position: "absolute", right: 24, bottom: 18, fontSize: 18, fontWeight: 700, opacity: 0.35, color: "#6B7280" }}>
            lnk.az
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      // headers is optional; @vercel/og sets image/png. If you want hard caching:
      // headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    }
  );
}

function Metric({ label, value }) {
  return (
    <div style={{
      background: "#121622", border: "1px solid #1F2433", borderRadius: 16, padding: "18px 20px", minWidth: 160,
    }}>
      <div style={{ fontSize: 16, color: "#9CA3AF" }}>{label}</div>
      <div style={{ fontSize: 44, fontWeight: 800, color: "#E5E7EB" }}>{String(value)}</div>
    </div>
  );
}