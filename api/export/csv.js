// api/export/csv.js — 2025-01-27 LNK.az
export const config = { runtime: 'nodejs', maxDuration: 30 };

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

async function csvHandler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { hash, user } = req.query;
  
  try {
    let analyses = [];
    
    if (hash) {
      // Export single analysis
      const analysis = await kv.get(hash);
      if (!analysis) {
        return res.status(404).json({ error: 'Analiz tapılmadı' });
      }
      analyses = [analysis];
    } else if (user === 'true') {
      // Export user's analyses
      const session = getSessionFromRequest(req);
      if (!session?.sub) {
        return res.status(401).json({ error: 'Daxil olmaq lazımdır' });
      }
      
      const userAnalyses = await kv.get(`user:analyses:${session.sub}`) || [];
      analyses = userAnalyses;
    } else {
      return res.status(400).json({ error: 'Hash və ya user parametri tələb olunur' });
    }

    if (analyses.length === 0) {
      return res.status(404).json({ error: 'Export ediləcək analiz tapılmadı' });
    }

    // Generate CSV
    const csv = generateCSV(analyses);
    
    // Set headers for CSV download
    const filename = hash ? 
      `lnk-analiz-${hash.substring(0, 8)}.csv` : 
      `lnk-analizlər-${new Date().toISOString().split('T')[0]}.csv`;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    
    // Add BOM for proper UTF-8 encoding in Excel
    const bom = '\uFEFF';
    return res.status(200).send(bom + csv);
    
  } catch (error) {
    console.error('CSV export error:', error);
    return res.status(500).json({ error: 'CSV yaradılarkən xəta baş verdi' });
  }
}

export default withAuth(csvHandler, { require: 'optional' });
