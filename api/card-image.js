// pages/api/card-image.js
import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

function clamp(n, a, b) { n = Number(n); return Math.min(b, Math.max(a, n)); }
function num(x, d=0) { const n = Number(x); return Number.isFinite(n) ? n : d; }

function mapFromAnalysis(json) {
  const title = json?.meta?.title || 'Analiz';
  const reliability = clamp(num(json?.scores?.reliability?.value, 0), 0, 100);
  const political_establishment_bias = clamp(num(json?.scores?.political_establishment_bias?.value, 0), -5, 5);
  const summary = typeof json?.human_summary === 'string' ? json.human_summary : '';
  return { title, reliability, political_establishment_bias, summary };
}

export default async function handler(req) {
  const url = new URL(req.url);
  const hash = url.searchParams.get('hash');
  const theme = (url.searchParams.get('theme') || 'dark').toLowerCase();

  // Optional timeout so this never blocks too long
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 2000);

  let data;
  if (hash) {
    try {
      const r = await fetch(`${url.origin}/api/get-analysis?id=${encodeURIComponent(hash)}`, {
        headers: { Accept: 'application/json' },
        signal: ac.signal,
      });
      if (r.ok) data = mapFromAnalysis(await r.json());
    } catch {}
    clearTimeout(to);
  }
  if (!data) {
    data = { title: 'Məqalə analizi', reliability: 72, political_establishment_bias: -1.5, summary: 'Məqalə mövzuya dair əsas faktları təqdim edir…' };
  }

  const isLight = theme === 'light';
  const bg = isLight ? '#FAFBFF' : '#0B0E14';
  const text = isLight ? '#111827' : '#E5E7EB';
  const sub = isLight ? '#4B5563' : '#9CA3AF';
  const cardBg = isLight ? '#FFFFFF' : '#121622';
  const cardBorder = isLight ? '#E5E7EB' : '#1F2433';
  const axis = isLight ? '#CBD5E1' : '#2A3146';
  const dot = isLight ? '#DC2626' : '#EF4444';

  const rel = data.reliability;                  // 0..100
  const pol = data.political_establishment_bias; // -5..+5
  const cx = 40 + (pol + 5) * 0.1 * 420;         // X: -5..+5 → 40..460
  const cy = 40 + (1 - (rel / 100)) * 420;       // Y: 100(top)..0(bottom)

  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: 'flex', padding: 40, background: bg, color: text, fontFamily: 'Inter, ui-sans-serif, -apple-system, Segoe UI, Roboto, Arial' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1.15, gap: 16 }}>
          <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.06 }}>{data.title}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 16 }}>
            <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 18 }}>
              <div style={{ fontSize: 16, color: sub }}>Etibarlılıq</div>
              <div style={{ fontSize: 44, fontWeight: 800 }}>{`${rel}/100`}</div>
            </div>
            <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 16, padding: 18 }}>
              <div style={{ fontSize: 16, color: sub }}>Siyasi hakimiyyət meyli</div>
              <div style={{ fontSize: 44, fontWeight: 800 }}>{pol > 0 ? `+${pol}` : `${pol}`}</div>
            </div>
          </div>
          <div style={{ fontSize: 22, color: sub, maxHeight: 140, overflow: 'hidden' }}>{data.summary}</div>
        </div>

        <div style={{ width: 520, position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ position: 'relative', flex: 1, border: `1px solid ${axis}`, borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 40, right: 40, top: '50%', height: 1, background: axis }} />
              <div style={{ position: 'absolute', top: 40, bottom: 40, left: '50%', width: 1, background: axis }} />
              <svg viewBox="0 0 500 500" width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
                <circle cx={cx} cy={cy} r="9" fill={dot} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', color: sub, fontSize: 16 }}>
                <div style={{ position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)' }}>Etibarlı</div>
                <div style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)' }}>Etibarsız</div>
                <div style={{ position: 'absolute', top: '50%', left: 6, transform: 'translateY(-50%)' }}>Müxalif</div>
                <div style={{ position: 'absolute', top: '50%', right: 6, transform: 'translateY(-50%)' }}>İqtidar</div>
              </div>
              <div style={{ position: 'absolute', right: 24, bottom: 18, color: sub, opacity: .35, fontWeight: 700 }}>lnk.az</div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=600, s-maxage=600, stale-while-revalidate=86400',
      },
    }
  );
}
