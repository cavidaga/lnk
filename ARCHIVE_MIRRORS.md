# Archive Mirrors for Blocked Sources

This document explains how to add archive.md mirrors for sources that block LNK's analysis system.

## How it works

When a source (like oxu.az) blocks both direct access and Archive.org crawlers, LNK will attempt to use archive.md mirrors as a fallback.

## Adding new archive mirrors

To add a new archive mirror, edit `lib/known-archives.js` and add an entry to the `KNOWN_ARCHIVES` object:

```javascript
export const KNOWN_ARCHIVES = {
  // oxu.az articles
  'oxu.az/siyaset/mubariz-mensimovun-gizli-media-plani-pul-paylayani-ifsa-olundu-foto': 'https://archive.md/FNMT7',
  
  // Add new entries here
  'example.com/article-path': 'https://archive.md/XXXXX',
};
```

## Creating archive.md mirrors

1. Go to https://archive.md
2. Enter the URL you want to archive
3. Click "Save" to create the archive
4. Copy the resulting archive URL (e.g., https://archive.md/XXXXX)
5. Add it to the `KNOWN_ARCHIVES` object

## URL format

The key in `KNOWN_ARCHIVES` should be in the format: `domain.com/path` (without protocol and www prefix).

Examples:
- `https://www.oxu.az/siyaset/article` → `oxu.az/siyaset/article`
- `https://example.com/news/story` → `example.com/news/story`

## Automatic archive creation

The system will also attempt to automatically create archive.md mirrors for new URLs, but this is less reliable than manually created archives.

## Testing

To test if an archive mirror works:

1. Add the archive URL to `KNOWN_ARCHIVES`
2. Try analyzing the original URL
3. Check the analysis result for `"contentSource": "Archive.md"`
4. Verify the warning message indicates archive.md was used
