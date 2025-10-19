// api/export/bulk.js — 2025-01-27 LNK.az
export const config = { runtime: 'nodejs', maxDuration: 60 };

import { kv } from '@vercel/kv';
import { getSessionFromRequest } from '../../lib/auth.js';
import { withAuth } from '../../lib/middleware.js';

function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateCSV(analyses) {
  const headers = [
    'Başlıq',
    'Nəşriyyat',
    'URL',
    'Nəşr Tarixi',
    'Təhlil Tarixi',
    'Etibarlılıq',
    'Siyasi Meyl',
    'Reklam Məzmunu',
    'Reklam Səbəbi',
    'Xülasə',
    'Model',
    'Məzmun Mənbəyi',
    'Sosial-Mədəni Qruplar',
    'Dil Problemləri',
    'İstinad Mənbələri'
  ];

  const rows = analyses.map(analysis => {
    const socialGroups = analysis.diagnostics?.socio_cultural_descriptions?.map(item => 
      `${item.group || 'Naməlum'}: ${item.stance || 'neytral'}`
    ).join('; ') || '';
    
    const languageIssues = analysis.diagnostics?.language_flags?.map(item => 
      `"${item.term || 'Naməlum'}": ${item.category || 'qeyri-müəyyən'}`
    ).join('; ') || '';
    
    const sources = analysis.cited_sources?.map(source => 
      `${source.name || 'Naməlum'} (${source.role || 'Naməlum rol'})`
    ).join('; ') || '';

    return [
      escapeCSV(analysis.meta?.title || ''),
      escapeCSV(analysis.meta?.publication || ''),
      escapeCSV(analysis.meta?.original_url || ''),
      escapeCSV(analysis.meta?.published_at ? new Date(analysis.meta.published_at).toLocaleDateString('az-AZ') : ''),
      escapeCSV(new Date(analysis.analyzed_at).toLocaleDateString('az-AZ')),
      analysis.scores?.reliability?.value || 0,
      analysis.scores?.political_establishment_bias?.value || 0,
      analysis.is_advertisement ? 'Bəli' : 'Xeyr',
      escapeCSV(analysis.advertisement_reason || ''),
      escapeCSV(analysis.human_summary || ''),
      escapeCSV(analysis.modelUsed || ''),
      escapeCSV(analysis.contentSource || ''),
      escapeCSV(socialGroups),
      escapeCSV(languageIssues),
      escapeCSV(sources)
    ];
  });

  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

async function generateHTML(analyses) {
  const html = `
    <!DOCTYPE html>
    <html lang="az">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>LNK.az Analizlər Hesabatı</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 1200px;
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
          font-size: 32px;
          font-weight: bold;
          color: #2563eb;
          margin-bottom: 10px;
        }
        .subtitle {
          color: #6b7280;
          font-size: 18px;
        }
        .summary-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }
        .stat-card {
          background: #f8fafc;
          padding: 20px;
          border-radius: 8px;
          text-align: center;
        }
        .stat-value {
          font-size: 24px;
          font-weight: bold;
          color: #2563eb;
          margin-bottom: 5px;
        }
        .stat-label {
          color: #6b7280;
          font-size: 14px;
        }
        .analysis-item {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
          page-break-inside: avoid;
        }
        .analysis-title {
          font-size: 20px;
          font-weight: bold;
          color: #1f2937;
          margin-bottom: 15px;
          line-height: 1.4;
        }
        .analysis-meta {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-bottom: 15px;
        }
        .meta-item {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #f3f4f6;
        }
        .meta-label {
          font-weight: 600;
          color: #374151;
        }
        .meta-value {
          color: #6b7280;
        }
        .scores {
          display: flex;
          gap: 20px;
          margin-bottom: 15px;
        }
        .score-item {
          flex: 1;
          text-align: center;
          padding: 10px;
          border-radius: 6px;
          background: #f9fafb;
        }
        .score-label {
          font-size: 14px;
          color: #6b7280;
          margin-bottom: 5px;
        }
        .score-value {
          font-size: 18px;
          font-weight: bold;
        }
        .reliability-high { color: #059669; }
        .reliability-medium { color: #d97706; }
        .reliability-low { color: #dc2626; }
        .bias-positive { color: #dc2626; }
        .bias-negative { color: #2563eb; }
        .bias-neutral { color: #059669; }
        .summary-text {
          font-size: 14px;
          color: #374151;
          line-height: 1.5;
          background: #f0f9ff;
          padding: 15px;
          border-radius: 6px;
        }
        .footer {
          text-align: center;
          margin-top: 40px;
          padding-top: 20px;
          border-top: 2px solid #e5e7eb;
          color: #6b7280;
          font-size: 14px;
        }
        @media print {
          body { margin: 0; padding: 15px; }
          .analysis-item { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">LNK.az</div>
        <div class="subtitle">Media Bias Analizlər Hesabatı</div>
      </div>

      <div class="summary-stats">
        <div class="stat-card">
          <div class="stat-value">${analyses.length}</div>
          <div class="stat-label">Ümumi Analizlər</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${Math.round(analyses.reduce((sum, a) => sum + (a.scores?.reliability?.value || 0), 0) / analyses.length)}</div>
          <div class="stat-label">Orta Etibarlılıq</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${analyses.filter(a => a.is_advertisement).length}</div>
          <div class="stat-label">Reklam Məzmunu</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${new Set(analyses.map(a => a.meta?.publication).filter(Boolean)).size}</div>
          <div class="stat-label">Fərqli Nəşriyyatlar</div>
        </div>
      </div>

      ${analyses.map(analysis => `
        <div class="analysis-item">
          <div class="analysis-title">${analysis.meta?.title || 'Başlıq yoxdur'}</div>
          
          <div class="analysis-meta">
            <div class="meta-item">
              <span class="meta-label">Nəşriyyat:</span>
              <span class="meta-value">${analysis.meta?.publication || 'Naməlum'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Təhlil tarixi:</span>
              <span class="meta-value">${new Date(analysis.analyzed_at).toLocaleDateString('az-AZ')}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Model:</span>
              <span class="meta-value">${analysis.modelUsed || 'Naməlum'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Mənbə:</span>
              <span class="meta-value">${analysis.contentSource || 'Live'}</span>
            </div>
          </div>

          <div class="scores">
            <div class="score-item">
              <div class="score-label">Etibarlılıq</div>
              <div class="score-value reliability-${analysis.scores?.reliability?.value >= 70 ? 'high' : analysis.scores?.reliability?.value >= 40 ? 'medium' : 'low'}">
                ${analysis.scores?.reliability?.value || 0}/100
              </div>
            </div>
            <div class="score-item">
              <div class="score-label">Siyasi Meyl</div>
              <div class="score-value bias-${analysis.scores?.political_establishment_bias?.value > 1 ? 'positive' : analysis.scores?.political_establishment_bias?.value < -1 ? 'negative' : 'neutral'}">
                ${analysis.scores?.political_establishment_bias?.value || 0}
              </div>
            </div>
          </div>

          ${analysis.human_summary ? `
          <div class="summary-text">
            <strong>Xülasə:</strong> ${analysis.human_summary}
          </div>
          ` : ''}
        </div>
      `).join('')}

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

async function bulkHandler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { format = 'csv', user } = req.query;
  
  if (!['csv', 'html'].includes(format)) {
    return res.status(400).json({ error: 'Format csv və ya html olmalıdır' });
  }

  try {
    let analyses = [];
    
    if (user === 'true') {
      // Export user's analyses
      const session = getSessionFromRequest(req);
      if (!session?.sub) {
        return res.status(401).json({ error: 'Daxil olmaq lazımdır' });
      }
      
      const userAnalyses = await kv.get(`user:analyses:${session.sub}`) || [];
      analyses = userAnalyses;
    } else {
      return res.status(400).json({ error: 'User parametri tələb olunur' });
    }

    if (analyses.length === 0) {
      return res.status(404).json({ error: 'Export ediləcək analiz tapılmadı' });
    }

    // Sanitize filename for HTTP headers (remove non-ASCII characters)
    const date = new Date().toISOString().split('T')[0];
    const filename = `lnk-analizler-${date}`;
    
    if (format === 'csv') {
      const csv = generateCSV(analyses);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.setHeader('Cache-Control', 'no-cache');
      
      // Add BOM for proper UTF-8 encoding in Excel
      const bom = '\uFEFF';
      return res.status(200).send(bom + csv);
    } else {
      const html = generateHTML(analyses);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.html"`);
      res.setHeader('Cache-Control', 'no-cache');
      return res.status(200).send(html);
    }
    
  } catch (error) {
    console.error('Bulk export error:', error);
    return res.status(500).json({ error: 'Export zamanı xəta baş verdi' });
  }
}

export default withAuth(bulkHandler, { require: 'optional' });
