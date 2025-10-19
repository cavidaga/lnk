# Export Features for LNK.az

This document describes the export capabilities added to the LNK.az media bias analysis platform.

## Overview

The export functionality allows users to download analysis reports in multiple formats:
- **PDF**: Professional reports with formatted layout
- **CSV**: Data export for spreadsheet analysis
- **HTML**: Web-friendly format for sharing

## API Endpoints

### Individual Analysis Export

#### PDF Export
```
GET /api/export/pdf?id={analysis_id}
```
- Exports a single analysis as a PDF report
- Includes all analysis data with professional formatting
- Azerbaijani language support

#### CSV Export
```
GET /api/export/csv?id={analysis_id}
```
- Exports a single analysis as CSV data
- Includes all analysis fields
- UTF-8 encoded for proper Azerbaijani character support

#### HTML Export
```
GET /api/export/html?id={analysis_id}
```
- Exports a single analysis as HTML
- Includes styling and formatting
- Suitable for web sharing

### Bulk Export

#### Bulk CSV Export
```
GET /api/export/bulk?format=csv&user_id={user_id}
```
- Exports all analyses for a user as CSV
- Includes pagination support
- Batch processing for large datasets

#### Bulk HTML Export
```
GET /api/export/bulk?format=html&user_id={user_id}
```
- Exports all analyses for a user as HTML
- Includes navigation and styling
- Responsive design

## Frontend Integration

### User Dashboard
- Export buttons on each analysis item
- Bulk export options in the analyses header
- Progress indicators for large exports
- Error handling and user feedback

### Export Button Styling
- Color-coded buttons (PDF: red, CSV: green, HTML: blue)
- Responsive design for mobile devices
- Hover effects and loading states

## Data Fields

### CSV Export Fields
- Başlıq (Title)
- Nəşriyyat (Publication)
- URL
- Nəşr Tarixi (Published Date)
- Təhlil Tarixi (Analysis Date)
- Etibarlılıq (Reliability)
- Siyasi Meyl (Political Bias)
- Reklam Məzmunu (Advertisement Content)
- Reklam Səbəbi (Advertisement Reason)
- Xülasə (Summary)
- Model
- Məzmun Mənbəyi (Content Source)
- Sosial-Mədəni Qruplar (Socio-Cultural Groups)
- Dil Problemləri (Language Issues)
- İstinad Mənbələri (Reference Sources)

### PDF Export Features
- Professional header with LNK.az branding
- Analysis summary with key metrics
- Detailed breakdown of all analysis components
- Source references and citations
- Timestamp and metadata
- Print-friendly layout

## Technical Implementation

### Dependencies
- **Puppeteer**: PDF generation from HTML
- **@sparticuz/chromium**: Chromium binary for Vercel
- **Built-in Node.js modules**: CSV generation and HTML templating

### Security
- User authentication required for all exports
- Rate limiting to prevent abuse
- Input validation and sanitization
- Secure file generation and cleanup

### Performance
- Streaming for large CSV exports
- Caching for frequently requested data
- Background processing for bulk exports
- Memory-efficient PDF generation

## Usage Examples

### JavaScript Frontend
```javascript
// Export single analysis as PDF
async function exportPDF(analysisId) {
  const response = await fetch(`/api/export/pdf?id=${analysisId}`);
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `analysis-${analysisId}.pdf`;
  a.click();
}

// Export all analyses as CSV
async function exportAllCSV() {
  const response = await fetch('/api/export/bulk?format=csv');
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'all-analyses.csv';
  a.click();
}
```

### cURL Examples
```bash
# Export single analysis as PDF
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -o analysis.pdf \
     "https://lnk.az/api/export/pdf?id=123"

# Export all analyses as CSV
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -o all-analyses.csv \
     "https://lnk.az/api/export/bulk?format=csv"
```

## Error Handling

### Common Error Responses
- `401 Unauthorized`: User not authenticated
- `403 Forbidden`: User doesn't have access to the analysis
- `404 Not Found`: Analysis not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error during export

### Frontend Error Handling
- User-friendly error messages
- Retry mechanisms for failed exports
- Progress indicators for long-running operations
- Fallback options for unsupported browsers

## Future Enhancements

### Planned Features
- **Excel Export**: .xlsx format with multiple sheets
- **JSON Export**: Machine-readable format for API integration
- **Scheduled Exports**: Automated export generation
- **Custom Templates**: User-defined PDF layouts
- **Email Integration**: Send exports via email
- **Cloud Storage**: Direct upload to Google Drive, Dropbox

### Performance Improvements
- **Caching**: Redis-based caching for frequently exported data
- **Compression**: Gzip compression for large exports
- **CDN Integration**: Faster download speeds
- **Background Jobs**: Queue-based processing for bulk exports

## Testing

### Test Coverage
- Unit tests for CSV generation
- Integration tests for PDF generation
- End-to-end tests for export workflows
- Performance tests for large datasets

### Running Tests
```bash
# Run all tests
node test/test.js

# Run specific test
node test/test.js --grep "Export"
```

## Support

For issues or questions about the export functionality:
- Check the error messages in the browser console
- Verify user authentication and permissions
- Contact support with specific error details
- Check the server logs for detailed error information
