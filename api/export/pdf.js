// api/export/pdf.js — 2025-01-27 LNK.az
export const config = { runtime: 'nodejs', maxDuration: 30 };

import { kv } from '@vercel/kv';
import { getSessionFromRequest } from '../../lib/auth.js';
import { withAuth } from '../../lib/middleware.js';
import React from 'react';
import { renderToStream } from '@react-pdf/renderer';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Use default fonts for better compatibility

// React PDF Document Component
function AnalysisPDFDocument({ analysis }) {
  const styles = StyleSheet.create({
    page: {
      flexDirection: 'column',
      backgroundColor: '#ffffff',
      padding: 30,
      fontFamily: 'Times-Roman'
    },
    header: {
      textAlign: 'center',
      marginBottom: 30,
      borderBottom: '2px solid #dc2626',
      paddingBottom: 20
    },
    logo: {
      fontSize: 28,
      fontWeight: 'bold',
      color: '#dc2626',
      marginBottom: 10
    },
    subtitle: {
      fontSize: 16,
      color: '#6b7280'
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#1f2937',
      marginBottom: 20,
      lineHeight: 1.4
    },
    section: {
      marginBottom: 20
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#374151',
      marginBottom: 10,
      borderBottom: '1px solid #e5e7eb',
      paddingBottom: 5
    },
    metaInfo: {
      backgroundColor: '#f8fafc',
      padding: 15,
      borderRadius: 8,
      marginBottom: 20
    },
    metaRow: {
      flexDirection: 'row',
      marginBottom: 8
    },
    metaLabel: {
      fontWeight: 'bold',
      color: '#4b5563',
      width: 120,
      marginRight: 10
    },
    metaValue: {
      color: '#1f2937',
      flex: 1
    },
    scoresGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 20
    },
    scoreItem: {
      backgroundColor: '#f9fafb',
      padding: 15,
      borderRadius: 8,
      borderLeft: '4px solid #3b82f6',
      width: '30%'
    },
    scoreLabel: {
      fontWeight: 'bold',
      color: '#4b5563',
      marginBottom: 5,
      fontSize: 12
    },
    scoreValue: {
      fontSize: 16,
      fontWeight: 'bold'
    },
    reliabilityHigh: { color: '#059669' },
    reliabilityMedium: { color: '#d97706' },
    reliabilityLow: { color: '#dc2626' },
    biasPositive: { color: '#dc2626' },
    biasNegative: { color: '#2563eb' },
    biasNeutral: { color: '#6b7280' },
    summaryText: {
      color: '#374151',
      lineHeight: 1.6,
      backgroundColor: '#f8fafc',
      padding: 15,
      borderRadius: 8,
      borderLeft: '4px solid #10b981'
    },
    infoItem: {
      marginBottom: 10
    },
    infoLabel: {
      fontWeight: 'bold',
      color: '#4b5563',
      marginBottom: 5
    },
    infoValue: {
      color: '#374151',
      backgroundColor: '#f9fafb',
      padding: 8,
      borderRadius: 6
    },
    sourcesList: {
      marginLeft: 0,
      paddingLeft: 0
    },
    sourceItem: {
      backgroundColor: '#f8fafc',
      marginBottom: 8,
      padding: 10,
      borderRadius: 6,
      borderLeft: '3px solid #6366f1'
    },
    footer: {
      textAlign: 'center',
      marginTop: 40,
      paddingTop: 20,
      borderTop: '2px solid #e5e7eb',
      color: '#6b7280',
      fontSize: 12
    }
  });

  return React.createElement(Document, null,
    React.createElement(Page, { size: 'A4', style: styles.page },
      // Header
      React.createElement(View, { style: styles.header },
        React.createElement(Text, { style: styles.logo }, 'LNK.az'),
        React.createElement(Text, { style: styles.subtitle }, 'Media Bias Analizlər Hesabatı')
      ),
      
      // Analysis Title
      React.createElement(Text, { style: styles.title }, analysis.title || 'Başlıq yoxdur'),
      
      // Meta Information
      React.createElement(View, { style: styles.metaInfo },
        React.createElement(View, { style: styles.metaRow },
          React.createElement(Text, { style: styles.metaLabel }, 'Nəşriyyat:'),
          React.createElement(Text, { style: styles.metaValue }, analysis.publication || 'Naməlum')
        ),
        React.createElement(View, { style: styles.metaRow },
          React.createElement(Text, { style: styles.metaLabel }, 'URL:'),
          React.createElement(Text, { style: styles.metaValue }, analysis.url || 'Naməlum')
        ),
        React.createElement(View, { style: styles.metaRow },
          React.createElement(Text, { style: styles.metaLabel }, 'Nəşr Tarixi:'),
          React.createElement(Text, { style: styles.metaValue }, analysis.published_date || 'Naməlum')
        ),
        React.createElement(View, { style: styles.metaRow },
          React.createElement(Text, { style: styles.metaLabel }, 'Təhlil Tarixi:'),
          React.createElement(Text, { style: styles.metaValue }, new Date(analysis.analyzed_at).toLocaleString('az-AZ'))
        ),
        React.createElement(View, { style: styles.metaRow },
          React.createElement(Text, { style: styles.metaLabel }, 'Model:'),
          React.createElement(Text, { style: styles.metaValue }, analysis.model || 'auto')
        ),
        React.createElement(View, { style: styles.metaRow },
          React.createElement(Text, { style: styles.metaLabel }, 'Məzmun Mənbəyi:'),
          React.createElement(Text, { style: styles.metaValue }, analysis.content_source || 'web')
        )
      ),
      
      // Scores Section
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'Təhlil Nəticələri'),
        React.createElement(View, { style: styles.scoresGrid },
          React.createElement(View, { style: styles.scoreItem },
            React.createElement(Text, { style: styles.scoreLabel }, 'Etibarlılıq'),
            React.createElement(Text, { 
              style: [
                styles.scoreValue,
                analysis.reliability >= 70 ? styles.reliabilityHigh : 
                analysis.reliability >= 40 ? styles.reliabilityMedium : styles.reliabilityLow
              ]
            }, `${analysis.reliability || 0}/100`)
          ),
          React.createElement(View, { style: styles.scoreItem },
            React.createElement(Text, { style: styles.scoreLabel }, 'Siyasi Meyl'),
            React.createElement(Text, { 
              style: [
                styles.scoreValue,
                analysis.political_bias > 1 ? styles.biasPositive : 
                analysis.political_bias < -1 ? styles.biasNegative : styles.biasNeutral
              ]
            }, analysis.political_bias || 0)
          ),
          React.createElement(View, { style: styles.scoreItem },
            React.createElement(Text, { style: styles.scoreLabel }, 'Reklam Məzmunu'),
            React.createElement(Text, { style: styles.scoreValue }, analysis.is_advertisement ? 'Bəli' : 'Xeyr')
          )
        )
      ),
      
      // Summary Section
      analysis.summary && React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'Xülasə'),
        React.createElement(Text, { style: styles.summaryText }, analysis.summary)
      ),
      
      // Additional Information
      (analysis.socio_cultural_groups?.length > 0 || analysis.language_issues?.length > 0) && 
      React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'Əlavə Məlumatlar'),
        analysis.socio_cultural_groups?.length > 0 && React.createElement(View, { style: styles.infoItem },
          React.createElement(Text, { style: styles.infoLabel }, 'Sosial-Mədəni Qruplar:'),
          React.createElement(Text, { style: styles.infoValue }, analysis.socio_cultural_groups.join(', '))
        ),
        analysis.language_issues?.length > 0 && React.createElement(View, { style: styles.infoItem },
          React.createElement(Text, { style: styles.infoLabel }, 'Dil Problemləri:'),
          React.createElement(Text, { style: styles.infoValue }, analysis.language_issues.join(', '))
        )
      ),
      
      // Sources Section
      analysis.sources?.length > 0 && React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'İstinad Mənbələri'),
        React.createElement(View, { style: styles.sourcesList },
          ...analysis.sources.map(source => 
            React.createElement(View, { key: source, style: styles.sourceItem },
              React.createElement(Text, null, source)
            )
          )
        )
      ),
      
      // Footer
      React.createElement(View, { style: styles.footer },
        React.createElement(Text, null, 'Bu hesabat LNK.az tərəfindən avtomatik olaraq yaradılıb.'),
        React.createElement(Text, null, 'Daha çox məlumat üçün: https://lnk.az'),
        React.createElement(Text, null, `Hesabat tarixi: ${new Date().toLocaleDateString('az-AZ')}`)
      )
    )
  );
}

async function generatePDFBuffer(analysis) {
  try {
    const stream = await renderToStream(React.createElement(AnalysisPDFDocument, { analysis }));
    
    return new Promise((resolve, reject) => {
      const chunks = [];
      
      stream.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      stream.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(pdfBuffer);
      });
      
      stream.on('error', (error) => {
        reject(error);
      });
    });
    
  } catch (error) {
    console.error('PDF generation error:', error);
    throw error;
  }
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

    // Generate PDF buffer using React PDF
    const pdfBuffer = await generatePDFBuffer(analysis);
    
    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="lnk-analiz-${hash.substring(0, 8)}.pdf"`);
    res.setHeader('Cache-Control', 'no-cache');
    
    return res.status(200).send(pdfBuffer);
    
  } catch (error) {
    console.error('PDF export error:', error);
    return res.status(500).json({ error: 'PDF yaradılarkən xəta baş verdi' });
  }
}

export default withAuth(pdfHandler, { require: 'optional' });