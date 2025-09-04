// api/card.tsx
export const config = { runtime: 'edge' };

import { ImageResponse } from '@vercel/og';

const SITE = 'https://lnk.az';

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }
function fmtBias(v: unknown) {
  const val = clamp(Number(v) || 0, -5, 5);
  return (val > 0 ? '+' : '') + val.toFixed(1);
}
function trunc(s = '', max = 220) { return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…'; }

async function kvGet(key: string) {
  const url = process.env.KV_REST_API_URL!;
  const token = process.env.KV_REST_API_TOKEN!;
  const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store'
  });
  if (!res.ok) return null;
  const json = await res.json(); // { result: "stringified JSON" | null }
  if (!json?.result) return null;
  try { return JSON.parse(json.result as string); } catch { return null; }
}

export default async function handler(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const hash = searchParams.get('hash') || '';
    const theme = (searchParams.get('theme') || 'dark').toLowerCase();
    const w = Number(searchParams.get('w') || 1200);
    const h = Number(searchParams.get('h') || 630);
    if (!hash) return new Response('Missing hash', { status: 400 });

    const data = await kvGet(hash);
    if (!data) return new Response('Not found', { status: 404 });

    const { meta = {}, scores = {}, human_summary = '', modelUsed, contentSource } = data as any;
    const title = meta.title || 'LNK.az — Media Təhlili';
    const publication = meta.publication || '';
    const rel = clamp(scores?.reliability?.value ?? 0, 0, 100);
    const pol = fmtBias(scores?.political_establishment_bias?.value);
    const soc = fmtBias(scores?.socio_cultural_bias?.value);

    const isLight = theme === 'light';
    const bg     = isLight ? '#ffffff' : '#0b0c11';
    const fg     = isLight ? '#0b0c11' : '#f6f7fb';
    const sub    = isLight ? '#3a3d45' : '#c7c9d3';
    const accent = '#e10600';
    const card   = isLight ? '#f5f6f8' : '#141723';
    const border = isLight ? '#e6e8ee' : '#23273a';

    return new ImageResponse(
      (
        <div style={{ width:'100%', height:'100%', display:'flex', backgroundColor:bg, color:fg, padding:40, boxSizing:'border-box', fontFamily:'sans-serif' }}>
          {/* Left */}
          <div style={{ flex:1.4, display:'flex', flexDirection:'column' }}>
            <div style={{ display:'flex', gap:12, alignItems:'center' }}>
              <div style={{ width:36, height:36, borderRadius:8, background:accent, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:24, fontWeight:700 }}>L</div>
              <div style={{ fontSize:24, fontWeight:600 }}>LNK.az</div>
            </div>

            <div style={{ marginTop:16 }}>
              <div style={{ fontSize:34, fontWeight:800, lineHeight:1.2 }}>{title}</div>
              {publication && <div style={{ fontSize:20, color:sub, marginTop:6 }}>{publication}</div>}
            </div>

            <div style={{ display:'flex', gap:14, marginTop:16 }}>
              <div style={{ background:card, border:`1px solid ${border}`, borderRadius:14, padding:'14px 16px', width:210 }}>
                <div style={{ fontSize:14, color:sub }}>Etibarlılıq</div>
                <div style={{ fontSize:36, fontWeight:800, marginTop:2 }}>{rel}</div>
              </div>
              <div style={{ background:card, border:`1px solid ${border}`, borderRadius:14, padding:'14px 16px', width:210 }}>
                <div style={{ fontSize:14, color:sub }}>Siyasi meyl</div>
                <div style={{ fontSize:36, fontWeight:800, marginTop:2 }}>{pol}</div>
              </div>
              <div style={{ background:card, border:`1px solid ${border}`, borderRadius:14, padding:'14px 16px', width:210 }}>
                <div style={{ fontSize:14, color:sub }}>Sosial-mədəni meyl</div>
                <div style={{ fontSize:36, fontWeight:800, marginTop:2 }}>{soc}</div>
              </div>
            </div>

            <div style={{ marginTop:18, fontSize:20, lineHeight:1.35, color:sub, maxWidth:700, whiteSpace:'pre-wrap' }}>
              {trunc(human_summary)}
            </div>

            <div style={{ display:'flex', alignItems:'center', gap:16, marginTop:'auto' }}>
              <div style={{ fontSize:16, color:sub }}>
                Model: <span style={{ color:fg }}>{modelUsed || '—'}</span> • Mənbə: <span style={{ color:fg }}>{contentSource || '—'}</span>
              </div>
              <div style={{ marginLeft:'auto', fontSize:16, color:sub }}>{SITE.replace(/^https?:\/\//,'')}</div>
            </div>
          </div>

          {/* Right: axes */}
          <div style={{ width:360, marginLeft:28, position:'relative', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ width:320, height:320, background:card, border:`1px solid ${border}`, borderRadius:20, position:'relative', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ position:'absolute', width:2, height:260, background:border }} />
              <div style={{ position:'absolute', height:2, width:260, background:border }} />
              {(() => {
                const map = (v: unknown) => clamp(Number(v) || 0, -5, 5) * 22;
                const x = map((data as any)?.scores?.political_establishment_bias?.value);
                const y = -map((data as any)?.scores?.socio_cultural_bias?.value);
                return <div style={{ position:'absolute', transform:`translate(${x}px, ${y}px)`, width:14, height:14, borderRadius:999, background:'#e10600', boxShadow:'0 0 0 6px #e1060020' }} />;
              })()}
              <div style={{ position:'absolute', bottom:10, fontSize:14, color:sub }}>Siyasi</div>
              <div style={{ position:'absolute', right:10, top:10, fontSize:14, color:sub }}>Sosial</div>
            </div>
          </div>
        </div>
      ),
      { width: w, height: h, headers: { 'Cache-Control': 'public, max-age=3600' } }
    );
  } catch (e: any) {
    return new Response(`Card error: ${e?.message || 'unknown'}`, { status: 500 });
  }
}