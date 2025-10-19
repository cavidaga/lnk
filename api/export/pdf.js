// api/export/pdf.js — 2025-01-27 LNK.az
export const config = { runtime: 'nodejs', maxDuration: 30 };

import { kv } from '@vercel/kv';
import { getSessionFromRequest } from '../../lib/auth.js';
import { withAuth } from '../../lib/middleware.js';

async function generatePDF(analysis) {
  // Simple HTML to PDF conversion using browser-like rendering
  // This is a basic implementation - in production you might want to use a proper PDF library
  
  const html = `
    <!DOCTYPE html>
    <html lang="az">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>LNK.az Analiz Hesabatı</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          background: #fff;
        }
        .header {
          text-align: center;
          border-bottom: 3px solid #2563eb;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .logo {
          font-size: 28px;
          font-weight: bold;
          color: #2563eb;
          margin-bottom: 10px;
        }
        .subtitle {
          color: #6b7280;
          font-size: 16px;
        }
        .analysis-title {
          font-size: 24px;
          font-weight: bold;
          color: #1f2937;
          margin-bottom: 20px;
          line-height: 1.4;
        }
        .meta-info {
          background: #f8fafc;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 30px;
        }
        .meta-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
          padding: 8px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .meta-item:last-child {
          border-bottom: none;
        }
        .meta-label {
          font-weight: 600;
          color: #374151;
        }
        .meta-value {
          color: #6b7280;
        }
        .scores-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 30px;
        }
        .score-card {
          background: #fff;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          padding: 20px;
          text-align: center;
        }
        .score-title {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 10px;
          color: #374151;
        }
        .score-value {
          font-size: 36px;
          font-weight: bold;
          margin-bottom: 10px;
        }
        .reliability-high { color: #059669; }
        .reliability-medium { color: #d97706; }
        .reliability-low { color: #dc2626; }
        .bias-positive { color: #dc2626; }
        .bias-negative { color: #2563eb; }
        .bias-neutral { color: #059669; }
        .score-rationale {
          font-size: 14px;
          color: #6b7280;
          line-height: 1.5;
        }
        .summary-section {
          background: #f0f9ff;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 30px;
        }
        .summary-title {
          font-size: 20px;
          font-weight: 600;
          color: #1e40af;
          margin-bottom: 15px;
        }
        .summary-text {
          font-size: 16px;
          line-height: 1.6;
          color: #374151;
        }
        .diagnostics-section {
          margin-bottom: 30px;
        }
        .section-title {
          font-size: 20px;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 15px;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 10px;
        }
        .diagnostic-item {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 10px;
        }
        .diagnostic-group {
          font-weight: 600;
          color: #374151;
          margin-bottom: 5px;
        }
        .diagnostic-stance {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          margin-left: 10px;
        }
        .stance-positive { background: #fef2f2; color: #dc2626; }
        .stance-negative { background: #eff6ff; color: #2563eb; }
        .stance-neutral { background: #f0fdf4; color: #059669; }
        .stance-mixed { background: #fefce8; color: #d97706; }
        .diagnostic-rationale {
          font-size: 14px;
          color: #6b7280;
          margin-top: 8px;
        }
        .sources-section {
          margin-bottom: 30px;
        }
        .source-item {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 10px;
        }
        .source-name {
          font-weight: 600;
          color: #374151;
          margin-bottom: 5px;
        }
        .source-role {
          color: #6b7280;
          font-size: 14px;
          margin-bottom: 5px;
        }
        .footer {
          text-align: center;
          margin-top: 40px;
          padding-top: 20px;
          border-top: 2px solid #e5e7eb;
          color: #6b7280;
          font-size: 14px;
        }
        .advertisement-warning {
          background: #fef2f2;
          border: 2px solid #fecaca;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 20px;
        }
        .advertisement-title {
          color: #dc2626;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .advertisement-text {
          color: #7f1d1d;
          font-size: 14px;
        }
        @media print {
          body { margin: 0; padding: 15px; }
          .header { page-break-after: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">LNK.az</div>
        <div class="subtitle">Media Bias Analiz Hesabatı</div>
      </div>

      <div class="analysis-title">${analysis.meta?.title || 'Başlıq yoxdur'}</div>

      <div class="meta-info">
        <div class="meta-item">
          <span class="meta-label">📰 Nəşriyyat:</span>
          <span class="meta-value">${analysis.meta?.publication || 'Naməlum'}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">🔗 URL:</span>
          <span class="meta-value">${analysis.meta?.original_url || 'Naməlum'}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">📅 Təhlil edilib:</span>
          <span class="meta-value">${new Date(analysis.analyzed_at).toLocaleDateString('az-AZ', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}</span>
        </div>
        ${analysis.meta?.published_at ? `
        <div class="meta-item">
          <span class="meta-label">📰 Nəşr tarixi:</span>
          <span class="meta-value">${new Date(analysis.meta.published_at).toLocaleDateString('az-AZ', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric'
          })}</span>
        </div>
        ` : ''}
        <div class="meta-item">
          <span class="meta-label">🤖 Model:</span>
          <span class="meta-value">${analysis.modelUsed || 'Naməlum'}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">📊 Məzmun mənbəyi:</span>
          <span class="meta-value">${analysis.contentSource || 'Live'}</span>
        </div>
      </div>

      ${analysis.is_advertisement ? `
      <div class="advertisement-warning">
        <div class="advertisement-title">⚠️ Reklam Məzmunu</div>
        <div class="advertisement-text">${analysis.advertisement_reason || 'Bu məzmun reklam xarakterlidir'}</div>
      </div>
      ` : ''}

      <div class="scores-section">
        <div class="score-card">
          <div class="score-title">Etibarlılıq</div>
          <div class="score-value reliability-${analysis.scores?.reliability?.value >= 70 ? 'high' : analysis.scores?.reliability?.value >= 40 ? 'medium' : 'low'}">
            ${analysis.scores?.reliability?.value || 0}/100
          </div>
          <div class="score-rationale">${analysis.scores?.reliability?.rationale || 'Qiymətləndirmə yoxdur'}</div>
        </div>
        <div class="score-card">
          <div class="score-title">Siyasi Meyl</div>
          <div class="score-value bias-${analysis.scores?.political_establishment_bias?.value > 1 ? 'positive' : analysis.scores?.political_establishment_bias?.value < -1 ? 'negative' : 'neutral'}">
            ${analysis.scores?.political_establishment_bias?.value || 0}
          </div>
          <div class="score-rationale">${analysis.scores?.political_establishment_bias?.rationale || 'Qiymətləndirmə yoxdur'}</div>
        </div>
      </div>

      <div class="summary-section">
        <div class="summary-title">📋 Xülasə</div>
        <div class="summary-text">${analysis.human_summary || 'Xülasə mövcud deyil'}</div>
      </div>

      ${analysis.diagnostics?.socio_cultural_descriptions?.length > 0 ? `
      <div class="diagnostics-section">
        <div class="section-title">👥 Sosial-Mədəni Təhlil</div>
        ${analysis.diagnostics.socio_cultural_descriptions.map(item => `
          <div class="diagnostic-item">
            <div class="diagnostic-group">
              ${item.group || 'Naməlum qrup'}
              <span class="diagnostic-stance stance-${item.stance || 'neutral'}">${item.stance || 'neytral'}</span>
            </div>
            <div class="diagnostic-rationale">${item.rationale || 'İzah yoxdur'}</div>
          </div>
        `).join('')}
      </div>
      ` : ''}

      ${analysis.diagnostics?.language_flags?.length > 0 ? `
      <div class="diagnostics-section">
        <div class="section-title">🔍 Dil Analizi</div>
        ${analysis.diagnostics.language_flags.map(item => `
          <div class="diagnostic-item">
            <div class="diagnostic-group">
              "${item.term || 'Naməlum termin'}" - ${item.category || 'qeyri-müəyyən'}
            </div>
            <div class="diagnostic-rationale">${item.evidence || 'Sübut yoxdur'}</div>
          </div>
        `).join('')}
      </div>
      ` : ''}

      ${analysis.cited_sources?.length > 0 ? `
      <div class="sources-section">
        <div class="section-title">📚 İstinad Mənbələri</div>
        ${analysis.cited_sources.map(source => `
          <div class="source-item">
            <div class="source-name">${source.name || 'Naməlum mənbə'}</div>
            <div class="source-role">${source.role || 'Naməlum rol'}</div>
            <div class="diagnostic-stance stance-${source.stance || 'neutral'}">${source.stance || 'neytral'}</div>
          </div>
        `).join('')}
      </div>
      ` : ''}

      <div class="footer">
        <p>Bu hesabat LNK.az tərəfindən avtomatik olaraq yaradılıb.</p>
        <p>Daha çox məlumat üçün: <strong>https://lnk.az</strong></p>
        <p>Hesabat tarixi: ${new Date().toLocaleDateString('az-AZ', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}</p>
      </div>
    </body>
    </html>
  `;

  return html;
}

async function pdfHandler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { hash } = req.query;
  
  if (!hash) {
    return res.status(400).json({ error: 'Analiz hash-i tələb olunur' });
  }

  try {
    // Get analysis from cache
    const analysis = await kv.get(hash);
    
    if (!analysis) {
      return res.status(404).json({ error: 'Analiz tapılmadı' });
    }

    // Generate PDF HTML
    const html = await generatePDF(analysis);
    
    // Set headers for PDF download
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="lnk-analiz-${hash.substring(0, 8)}.html"`);
    res.setHeader('Cache-Control', 'no-cache');
    
    return res.status(200).send(html);
    
  } catch (error) {
    console.error('PDF export error:', error);
    return res.status(500).json({ error: 'PDF yaradılarkən xəta baş verdi' });
  }
}

export default withAuth(pdfHandler, { require: 'optional' });
