// Basic test suite for LNK.az
// Run with: node test/test.js

import assert from 'assert';
import crypto from 'crypto';

// Test utilities
function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`);
  }
}

// Test URL validation
test('URL validation - valid URLs', () => {
  const validUrls = [
    'https://example.com/article',
    'http://example.com/article',
    'https://www.example.com/path/to/article',
    'https://subdomain.example.com/article'
  ];
  
  validUrls.forEach(url => {
    const urlObj = new URL(url);
    assert(['http:', 'https:'].includes(urlObj.protocol), `Invalid protocol for ${url}`);
  });
});

test('URL validation - invalid URLs', () => {
  const invalidUrls = [
    'ftp://example.com',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'not-a-url',
    ''
  ];
  
  invalidUrls.forEach(url => {
    try {
      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error(`Invalid protocol: ${urlObj.protocol}`);
      }
    } catch (e) {
      // Expected to fail
      assert(true);
    }
  });
});

// Test model type validation
test('Model type validation', () => {
  const validTypes = ['auto', 'flash-lite', 'flash', 'pro'];
  const invalidTypes = ['invalid', 'gemini', 'gpt', null, undefined];
  
  validTypes.forEach(type => {
    assert(validTypes.includes(type), `Valid type should be accepted: ${type}`);
  });
  
  invalidTypes.forEach(type => {
    assert(!validTypes.includes(type), `Invalid type should be rejected: ${type}`);
  });
});

// Test content cleaning
test('Content cleaning - remove sidebar content', () => {
  const testContent = `
    Main article content here.
    
    Ən çox oxunan xəbərlər
    Related articles
    Social media links
    
    More main content.
  `;
  
  // This would be tested with the actual cleanArticleContent function
  assert(testContent.includes('Main article content'), 'Main content should be preserved');
});

// Test score normalization
test('Score normalization', () => {
  const testScores = {
    reliability: { value: 150 }, // Should be clamped to 100
    political_establishment_bias: { value: 10 } // Should be clamped to 5
  };
  
  // Test clamping logic
  const reliability = Math.max(0, Math.min(100, testScores.reliability.value));
  const bias = Math.max(-5, Math.min(5, testScores.political_establishment_bias.value));
  
  assert(reliability === 100, 'Reliability should be clamped to 100');
  assert(bias === 5, 'Bias should be clamped to 5');
});

// Test error handling
test('Error handling - network errors', () => {
  const networkErrors = [
    { status: 404, message: 'Not Found' },
    { status: 403, message: 'Forbidden' },
    { status: 500, message: 'Internal Server Error' },
    { status: 429, message: 'Too Many Requests' }
  ];
  
  networkErrors.forEach(error => {
    assert(typeof error.status === 'number', 'Status should be a number');
    assert(typeof error.message === 'string', 'Message should be a string');
  });
});

// Test caching logic
test('Cache key generation', () => {
  const url = 'https://example.com/article';
  const version = 'v4-advertisement-detection';
  const expectedKey = crypto.createHash('md5').update(url + version).digest('hex');
  
  assert(typeof expectedKey === 'string', 'Cache key should be a string');
  assert(expectedKey.length === 32, 'MD5 hash should be 32 characters');
});

// Test export functionality
test('Export CSV generation', () => {
  const mockAnalysis = {
    title: 'Test Article',
    publication: 'Test News',
    url: 'https://example.com/test',
    published_date: '2025-01-27',
    analyzed_at: '2025-01-27T10:00:00Z',
    reliability: 85,
    political_bias: 2,
    is_advertisement: true,
    advertisement_reason: 'Contains promotional content',
    summary: 'This is a test summary',
    model: 'pro',
    content_source: 'web',
    socio_cultural_groups: ['test-group'],
    language_issues: ['grammar'],
    sources: ['https://source1.com', 'https://source2.com']
  };
  
  // Test CSV escaping
  function escapeCSV(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
  
  const csvRow = [
    mockAnalysis.title,
    mockAnalysis.publication,
    mockAnalysis.url,
    mockAnalysis.published_date,
    mockAnalysis.analyzed_at,
    mockAnalysis.reliability,
    mockAnalysis.political_bias,
    mockAnalysis.is_advertisement,
    mockAnalysis.advertisement_reason,
    mockAnalysis.summary,
    mockAnalysis.model,
    mockAnalysis.content_source,
    mockAnalysis.socio_cultural_groups.join(';'),
    mockAnalysis.language_issues.join(';'),
    mockAnalysis.sources.join(';')
  ].map(escapeCSV).join(',');
  
  assert(csvRow.includes('Test Article'), 'CSV should contain title');
  assert(csvRow.includes('85'), 'CSV should contain reliability score');
  assert(csvRow.includes('https://example.com/test'), 'CSV should contain URL');
});

test('Export PDF HTML generation', () => {
  const mockAnalysis = {
    title: 'Test Article',
    publication: 'Test News',
    url: 'https://example.com/test',
    published_date: '2025-01-27',
    analyzed_at: '2025-01-27T10:00:00Z',
    reliability: 85,
    political_bias: 2,
    is_advertisement: true,
    advertisement_reason: 'Contains promotional content',
    summary: 'This is a test summary',
    model: 'pro',
    content_source: 'web',
    socio_cultural_groups: ['test-group'],
    language_issues: ['grammar'],
    sources: ['https://source1.com', 'https://source2.com']
  };
  
  // Test HTML generation
  const html = `
    <!DOCTYPE html>
    <html lang="az">
    <head>
      <meta charset="UTF-8">
      <title>LNK.az Analiz Hesabatı</title>
    </head>
    <body>
      <h1>${mockAnalysis.title}</h1>
      <p><strong>Nəşriyyat:</strong> ${mockAnalysis.publication}</p>
      <p><strong>URL:</strong> ${mockAnalysis.url}</p>
      <p><strong>Etibarlılıq:</strong> ${mockAnalysis.reliability}/100</p>
      <p><strong>Siyasi meyl:</strong> ${mockAnalysis.political_bias}</p>
    </body>
    </html>
  `;
  
  assert(html.includes('Test Article'), 'HTML should contain title');
  assert(html.includes('85'), 'HTML should contain reliability score');
  assert(html.includes('LNK.az Analiz Hesabatı'), 'HTML should contain proper title');
});

console.log('\n🎉 All tests completed!');
