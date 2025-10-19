// LNK.az çıxarış funksionallığı üçün demo skript
// İstifadə: node demo-export.js

import crypto from 'crypto';

// Nümayiş üçün mock analiz məlumatları
const mockAnalysis = {
  id: crypto.randomUUID(),
  title: 'Azərbaycan Prezidenti yeni tədbirlər haqqında danışdı',
  publication: 'Azərbaycan Xəbərləri',
  url: 'https://example.com/president-announcements',
  published_date: '2025-01-27',
  analyzed_at: '2025-01-27T10:30:00Z',
  reliability: 87,
  political_bias: 1,
  is_advertisement: false,
  advertisement_reason: null,
  summary: 'Prezident yeni iqtisadi tədbirlər və sosial proqramlar haqqında məlumat verdi.',
  model: 'pro',
  content_source: 'web',
  socio_cultural_groups: ['siyasi liderlər', 'iqtisadçılar'],
  language_issues: ['azərbaycan dili'],
  sources: [
    'https://president.az/news/123',
    'https://azertag.az/news/456'
  ]
};

// CSV yaradılması funksiyası
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
    return [
      analysis.title,
      analysis.publication || 'Naməlum',
      analysis.url,
      analysis.published_date || '',
      analysis.analyzed_at || '',
      analysis.reliability || 0,
      analysis.political_bias || 0,
      analysis.is_advertisement ? 'Bəli' : 'Xeyr',
      analysis.advertisement_reason || '',
      analysis.summary || '',
      analysis.model || 'auto',
      analysis.content_source || 'web',
      (analysis.socio_cultural_groups || []).join(';'),
      (analysis.language_issues || []).join(';'),
      (analysis.sources || []).join(';')
    ].map(field => {
      // Escape CSV values
      if (field === null || field === undefined) return '';
      const str = String(field);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
  });

  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

// HTML yaradılması funksiyası
function generateHTML(analysis) {
  return `<!DOCTYPE html>
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
      background: #f5f5f5;
    }
    .header {
      background: #dc2626;
      color: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      text-align: center;
    }
    .content {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .metric {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #eee;
    }
    .metric:last-child {
      border-bottom: none;
    }
    .label {
      font-weight: 600;
      color: #666;
    }
    .value {
      color: #333;
    }
    .reliability-high { color: #059669; }
    .reliability-medium { color: #d97706; }
    .reliability-low { color: #dc2626; }
    .bias-positive { color: #dc2626; }
    .bias-neutral { color: #6b7280; }
    .bias-negative { color: #2563eb; }
  </style>
</head>
<body>
  <div class="header">
    <h1>LNK.az Analiz Hesabatı</h1>
    <p>Media Bias Analysis Report</p>
  </div>
  
  <div class="content">
    <h2>${analysis.title}</h2>
    
    <div class="metric">
      <span class="label">Nəşriyyat:</span>
      <span class="value">${analysis.publication || 'Naməlum'}</span>
    </div>
    
    <div class="metric">
      <span class="label">URL:</span>
      <span class="value"><a href="${analysis.url}" target="_blank">${analysis.url}</a></span>
    </div>
    
    <div class="metric">
      <span class="label">Nəşr Tarixi:</span>
      <span class="value">${analysis.published_date || 'Naməlum'}</span>
    </div>
    
    <div class="metric">
      <span class="label">Təhlil Tarixi:</span>
      <span class="value">${new Date(analysis.analyzed_at).toLocaleString('az-AZ')}</span>
    </div>
    
    <div class="metric">
      <span class="label">Etibarlılıq:</span>
      <span class="value reliability-${analysis.reliability >= 70 ? 'high' : analysis.reliability >= 40 ? 'medium' : 'low'}">${analysis.reliability}/100</span>
    </div>
    
    <div class="metric">
      <span class="label">Siyasi Meyl:</span>
      <span class="value bias-${analysis.political_bias > 0 ? 'positive' : analysis.political_bias < 0 ? 'negative' : 'neutral'}">${analysis.political_bias}</span>
    </div>
    
    <div class="metric">
      <span class="label">Reklam Məzmunu:</span>
      <span class="value">${analysis.is_advertisement ? 'Bəli' : 'Xeyr'}</span>
    </div>
    
    ${analysis.advertisement_reason ? `
    <div class="metric">
      <span class="label">Reklam Səbəbi:</span>
      <span class="value">${analysis.advertisement_reason}</span>
    </div>
    ` : ''}
    
    <div class="metric">
      <span class="label">Xülasə:</span>
      <span class="value">${analysis.summary || 'Mövcud deyil'}</span>
    </div>
    
    <div class="metric">
      <span class="label">Model:</span>
      <span class="value">${analysis.model || 'auto'}</span>
    </div>
    
    <div class="metric">
      <span class="label">Məzmun Mənbəyi:</span>
      <span class="value">${analysis.content_source || 'web'}</span>
    </div>
    
    ${analysis.socio_cultural_groups && analysis.socio_cultural_groups.length > 0 ? `
    <div class="metric">
      <span class="label">Sosial-Mədəni Qruplar:</span>
      <span class="value">${analysis.socio_cultural_groups.join(', ')}</span>
    </div>
    ` : ''}
    
    ${analysis.language_issues && analysis.language_issues.length > 0 ? `
    <div class="metric">
      <span class="label">Dil Problemləri:</span>
      <span class="value">${analysis.language_issues.join(', ')}</span>
    </div>
    ` : ''}
    
    ${analysis.sources && analysis.sources.length > 0 ? `
    <div class="metric">
      <span class="label">İstinad Mənbələri:</span>
      <span class="value">
        ${analysis.sources.map(source => `<a href="${source}" target="_blank">${source}</a>`).join('<br>')}
      </span>
    </div>
    ` : ''}
  </div>
</body>
</html>`;
}

// Çıxarış funksionallığını nümayiş et
console.log('🚀 LNK.az Çıxarış Funksionallığı Demo\n');

console.log('📊 Mock Analiz Məlumatları:');
console.log(JSON.stringify(mockAnalysis, null, 2));
console.log('\n' + '='.repeat(50) + '\n');

console.log('📄 CSV Çıxarışı:');
const csvData = generateCSV([mockAnalysis]);
console.log(csvData);
console.log('\n' + '='.repeat(50) + '\n');

console.log('🌐 HTML Çıxarışı:');
const htmlData = generateHTML(mockAnalysis);
console.log(htmlData.substring(0, 500) + '...\n[HTML content truncated for display]');
console.log('\n' + '='.repeat(50) + '\n');

console.log('✅ Çıxarış funksionallığı demo tamamlandı!');
console.log('\nHəqiqi API ucnöqtələrini sınamaq üçün:');
console.log('1. İnkişaf serverini başlat');
console.log('2. İstifadəçi panelinə keç');
console.log('3. Hər hansı analizdə çıxarış düymələrinə bas');
console.log('4. Və ya başlıqda toplu çıxarış düymələrindən istifadə et');
