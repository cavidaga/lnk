// Known archive.md mirrors for blocked sources
// This file maintains a mapping of problematic URLs to their archive.md mirrors

export const KNOWN_ARCHIVES = {
  // oxu.az articles
  'oxu.az/siyaset/mubariz-mensimovun-gizli-media-plani-pul-paylayani-ifsa-olundu-foto': 'https://archive.md/FNMT7',
  
  // Add more known archives here as they become available
  // Format: 'domain.com/path' => 'https://archive.md/XXXXX'
};

// Helper function to find archive for a URL
export function findArchiveForUrl(url) {
  try {
    const urlObj = new URL(url);
    const urlKey = urlObj.hostname.replace(/^www\./, '') + urlObj.pathname;
    console.log(`Archive lookup for URL: ${url}`);
    console.log(`Generated key: ${urlKey}`);
    console.log(`Available keys: ${Object.keys(KNOWN_ARCHIVES).join(', ')}`);
    
    // Try exact match first
    if (KNOWN_ARCHIVES[urlKey]) {
      console.log(`Found exact match: ${KNOWN_ARCHIVES[urlKey]}`);
      return KNOWN_ARCHIVES[urlKey];
    }
    
    // Try without trailing slash
    const urlKeyNoSlash = urlKey.replace(/\/$/, '');
    console.log(`Trying without trailing slash: ${urlKeyNoSlash}`);
    if (KNOWN_ARCHIVES[urlKeyNoSlash]) {
      console.log(`Found match without trailing slash: ${KNOWN_ARCHIVES[urlKeyNoSlash]}`);
      return KNOWN_ARCHIVES[urlKeyNoSlash];
    }
    
    // Try with www prefix
    const urlKeyWithWww = 'www.' + urlKey;
    console.log(`Trying with www prefix: ${urlKeyWithWww}`);
    if (KNOWN_ARCHIVES[urlKeyWithWww]) {
      console.log(`Found match with www prefix: ${KNOWN_ARCHIVES[urlKeyWithWww]}`);
      return KNOWN_ARCHIVES[urlKeyWithWww];
    }
    
    console.log(`No archive found for ${url}`);
    return null;
  } catch (error) {
    console.warn('Error parsing URL for archive lookup:', error);
    return null;
  }
}

// Helper function to add new archives
export function addArchive(originalUrl, archiveUrl) {
  try {
    const urlObj = new URL(originalUrl);
    const urlKey = urlObj.hostname.replace(/^www\./, '') + urlObj.pathname;
    KNOWN_ARCHIVES[urlKey] = archiveUrl;
    console.log(`Added archive mapping: ${urlKey} => ${archiveUrl}`);
  } catch (error) {
    console.warn('Error adding archive mapping:', error);
  }
}
