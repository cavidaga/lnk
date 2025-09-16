// pages/api/card.js
// LNK.az social card — real PNG with @vercel/og
// Features: KV fetch by ?hash=, brand header, title, badges, and a mini bias chart.

import { ImageResponse } from '@vercel/og';
import { kv } from '@vercel/kv';

export const config = { runtime: 'edge' };

// Optional: edge-cached fonts (safe to remove if not needed)
const interBold = fetch('https://fonts.cdnfonts.com/s/19795/Inter-Bold.woff').then(r => r.arrayBuffer());
const interSemi = fetch('https://fonts.cdnfonts.com/s/19795/Inter-SemiBold.woff').then(r => r.arrayBuffer());
const interReg  = fetch('https://fonts.cdnfonts.com/s/19795/Inter-Regular.woff').then(r => r.arrayBuffer());

// ---- Helpers ----
function mapFromAnalysis(a) {
  if (!a || typeof a !== 'object') return null;

  const title =
    a.meta?.title ||
    a.meta?.article_title ||
    a.meta?.url ||
    'LNK.az — Media Bias & Reliability';

  const site =
    a.meta?.site ||
    a.meta?.source ||
    (a.meta?.url ? new URL(a.meta.url).host : 'lnk.az');

  const rel = a.scores?.reliability?.value ?? null;
  const scb = a.scores?.socio_cultural_bias?.value ?? null;          // -5..+5
  const peb = a.scores?.political_establishment_bias?.value ?? null; // -5..+5

  return {
    title: String(title).slice(0, 140),
    site: String(site).slice(0, 60),
    reliability: isFinite(rel) ? Number(rel) : null,
    socioCulturalBias: isFinite(scb) ? Number(scb) : null,
    politicalEstablishmentBias: isFinite(peb) ? Number(peb) : null,
  };
}

function fmtBias(val) {
  if (val === null || val === undefined || Number.isNaN(val)) return 'n/a';
  const v = Math.round(Number(val) * 10) / 10;
  return v > 0 ? `+${v}` : `${v}`;
}
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// Map bias value (-5..+5) to px within chart box
function mapBiasToPx(val, minVal, maxVal, pxMin, pxMax) {
  const v = clamp(val ?? 0, minVal, maxVal);
  const t = (v - minVal) / (maxVal - minVal);
  return pxMin + t * (pxMax - pxMin);
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const hash = searchParams.get('hash') || '';

  // Brand tokens (match your site)
  const color = {
    bg: '#0c0d12',
    panel: '#11131a',
    text: '#e9edf3',
    muted: '#8e97ab',
    accent: '#FF0000',
    border: '#1c2230',
    panelSubtle: 'rgba(255,255,255,0.02)',
  };

  // Pull analysis from KV
  let model = null;
  try {
    if (hash) {
      const raw = await kv.get(`analysis:${hash}`);       // adjust key if needed
      model = mapFromAnalysis(raw);
    }
  } catch {
    // ignore KV errors; we’ll fall back below
  }

  // Fallback: allow quick manual testing via query params
  if (!model) {
    model = {
      title: searchParams.get('title') || 'Media Bias & Reliability Analysis',
      site: searchParams.get('site') || 'lnk.az',
      reliability: searchParams.get('rel') ? Number(searchParams.get('rel')) : null,
      socioCulturalBias: searchParams.get('scb') ? Number(searchParams.get('scb')) : null,
      politicalEstablishmentBias: searchParams.get('peb') ? Number(searchParams.get('peb')) : null,
    };
  }

  // Chart geometry
  const width = 1200;
  const height = 630;

  // Chart box area
  const chart = {
    x: 120,    // left
    y: 300,    // top
    w: 460,    // width
    h: 260,    // height
  };
  const gridGap = 52; // roughly 5x5 grid inside chart

  // Map biases to dot position
  // X: Socio-Cultural Bias (-5 left, +5 right)
  // Y: Political-Establishment Bias (-5 bottom, +5 top) — invert Y for screen coords
  const dotX = mapBiasToPx(model.socioCulturalBias ?? 0, -5, 5, chart.x + 20, chart.x + chart.w - 20);
  const dotY_data = mapBiasToPx(model.politicalEstablishmentBias ?? 0, -5, 5, -1, 1);
  const dotY = chart.y + chart.h / 2 - (dotY_data * (chart.h - 40)) / 2; // invert so + is up

  const [fontBold, fontSemi, fontReg] = await Promise.allSettled([
    interBold, interSemi, interReg,
  ]).then(parts => parts.map(p => (p.status === 'fulfilled' ? p.value : undefined)));

  return new ImageResponse(
    (
      <div
        style={{
          width,
          height,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: color.bg,
          color: color.text,
          padding: 48,
          fontFamily: 'Inter, system-ui, Segoe UI, Roboto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          {/* Brand mark: red dot in ring */}
          <div style={{ position: 'relative', width: 28, height: 28 }}>
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 9999,
              border: `2px solid ${color.accent}`,
            }}/>
            <div style={{
              position: 'absolute', top: 6, left: 6, width: 16, height: 16,
              borderRadius: 9999, backgroundColor: color.accent,
              boxShadow: '0 0 20px rgba(255,0,0,.35)',
            }}/>
          </div>

          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 0.2 }}>
            LNK.az • Media Bias Evaluator
          </div>

          <div style={{ marginLeft: 'auto', fontSize: 22, color: color.muted }}>
            {model.site}
          </div>
        </div>

        {/* Title + badges row */}
        <div style={{ display: 'flex', gap: 24 }}>
          <div
            style={{
              flex: 1,
              backgroundColor: color.panel,
              border: `1px solid ${color.border}`,
              borderRadius: 24,
              padding: 32,
              minHeight: 200,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ fontSize: 44, lineHeight: 1.2, fontWeight: 800 }}>
              {model.title}
            </div>

            <div style={{ display: 'flex', gap: 14, marginTop: 22, flexWrap: 'wrap' }}>
              {/* Reliability */}
              <div style={{
                display: 'flex', alignItems: 'center',
                padding: '10px 16px',
                borderRadius: 999,
                border: `1px solid ${color.border}`,
                background: color.panelSubtle,
                fontSize: 24, fontWeight: 600,
              }}>
                <span style={{ opacity: 0.85, marginRight: 10 }}>Reliability</span>
                <span style={{
                  padding: '2px 10px',
                  borderRadius: 8,
                  backgroundColor: color.accent,
                  color: '#fff',
                  fontWeight: 800,
                }}>
                  {model.reliability ?? 'n/a'}
                </span>
              </div>

              {/* SC Bias */}
              <div style={{
                display: 'flex', alignItems: 'center',
                padding: '10px 16px',
                borderRadius: 999,
                border: `1px solid ${color.border}`,
                background: color.panelSubtle,
                fontSize: 24, fontWeight: 600,
              }}>
                <span style={{ opacity: 0.85, marginRight: 10 }}>SC Bias</span>
                <span style={{
                  padding: '2px 10px',
                  borderRadius: 8,
                  backgroundColor: '#1c2230',
                  color: color.text,
                  fontWeight: 800,
                  border: `1px solid ${color.border}`,
                }}>
                  {fmtBias(model.socioCulturalBias)}
                </span>
              </div>

              {/* PE Bias */}
              <div style={{
                display: 'flex', alignItems: 'center',
                padding: '10px 16px',
                borderRadius: 999,
                border: `1px solid ${color.border}`,
                background: color.panelSubtle,
                fontSize: 24, fontWeight: 600,
              }}>
                <span style={{ opacity: 0.85, marginRight: 10 }}>PE Bias</span>
                <span style={{
                  padding: '2px 10px',
                  borderRadius: 8,
                  backgroundColor: '#1c2230',
                  color: color.text,
                  fontWeight: 800,
                  border: `1px solid ${color.border}`,
                }}>
                  {fmtBias(model.politicalEstablishmentBias)}
                </span>
              </div>
            </div>

            {/* Hash/footer */}
            <div style={{
              marginTop: 18,
              fontSize: 20,
              color: color.muted,
              borderTop: `1px dashed ${color.border}`,
              paddingTop: 14,
            }}>
              Generated by AI · {hash ? `#${hash.slice(0, 8)}` : 'no-hash'}
            </div>
          </div>

          {/* Bias chart card */}
          <div
            style={{
              width: chart.w + 40,
              backgroundColor: color.panel,
              border: `1px solid ${color.border}`,
              borderRadius: 24,
              padding: 20,
              position: 'relative',
            }}
          >
            <div style={{ fontSize: 20, opacity: 0.9, marginBottom: 10 }}>Bias Map</div>

            {/* Chart box */}
            <div
              style={{
                position: 'relative',
                left: 0,
                top: 0,
                width: chart.w,
                height: chart.h,
                borderRadius: 16,
                border: `1px solid ${color.border}`,
                backgroundImage: `
                  repeating-linear-gradient(
                    to right,
                    transparent 0, transparent ${gridGap - 1}px, ${color.border} ${gridGap - 1}px, ${color.border} ${gridGap}px
                  ),
                  repeating-linear-gradient(
                    to bottom,
                    transparent 0, transparent ${gridGap - 1}px, ${color.border} ${gridGap - 1}px, ${color.border} ${gridGap}px
                  )
                `,
                backgroundColor: '#0e1118',
                overflow: 'hidden',
              }}
            >
              {/* Axis labels */}
              <div style={{
                position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
                fontSize: 16, color: color.muted,
              }}>PE Bias (+ up)</div>
              <div style={{
                position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
                fontSize: 16, color: color.muted,
              }}>PE Bias (− down)</div>
              <div style={{
                position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%) rotate(-90deg)',
                transformOrigin: 'left top',
                fontSize: 16, color: color.muted,
              }}>SC Bias (− left)</div>
              <div style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%) rotate(90deg)',
                transformOrigin: 'right top',
                fontSize: 16, color: color.muted,
              }}>SC Bias (+ right)</div>

              {/* Center crosshair */}
              <div style={{
                position: 'absolute', left: '50%', top: 0, bottom: 0,
                width: 1, backgroundColor: color.border,
              }}/>
              <div style={{
                position: 'absolute', top: '50%', left: 0, right: 0,
                height: 1, backgroundColor: color.border,
              }}/>

              {/* Red dot */}
              <div style={{
                position: 'absolute',
                width: 18, height: 18,
                borderRadius: 9999,
                left: dotX - (chart.x + 0) - 9 + 20, // compensate card padding (20)
                top: dotY - chart.y - 9 + 0,        // this chart is self-contained
                backgroundColor: color.accent,
                boxShadow: '0 0 22px rgba(255,0,0,.45)',
                border: '2px solid rgba(255,255,255,.12)',
              }}/>

              {/* Legend chip */}
              <div style={{
                position: 'absolute', right: 8, top: 8,
                padding: '4px 8px', borderRadius: 999,
                border: `1px solid ${color.border}`, background: color.panelSubtle,
                fontSize: 16, color: color.text,
              }}>
                {`SC ${fmtBias(model.socioCulturalBias)} · PE ${fmtBias(model.politicalEstablishmentBias)}`}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width,
      height,
      fonts: [
        fontBold && { name: 'Inter', data: fontBold, style: 'normal', weight: 700 },
        fontSemi && { name: 'Inter', data: fontSemi, style: 'normal', weight: 600 },
        fontReg &&  { name: 'Inter', data: fontReg,  style: 'normal', weight: 400 },
      ].filter(Boolean),
      headers: {
        'Cache-Control': 'public, max-age=600, s-maxage=600, stale-while-revalidate=86400',
      },
    }
  );
}
