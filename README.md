# SVG Country Flag Emoji Bookmarklet

This bookmarklet replaces country flag emojis with SVG images from the Twemoji asset set. It is aimed at pages where Chrome on Windows still falls back to letter pairs like AU instead of rendering the actual flag emoji.

Initially started as a way to fix the flag emojis like 🇦🇺 being rendered as AU in Chrome on Windows. @quarrel now have a better direct font solution. See [quarrel/broken-flag-emojis-win11-twemoji](https://github.com/quarrel/broken-flag-emojis-win11-twemoji).

The bookmarklet is self-contained. It does not depend on a userscript manager or `@require` metadata.

## Files

`country-flags-emoji.bookmarklet.source.js`

Readable source for the bookmarklet.

`country-flags-emoji.bookmarklet.txt`

Bookmarklet-ready one-liner. Paste the full file contents into a bookmark URL.

## How it works

The bookmarklet walks text nodes directly, finds flag emoji pairs, and replaces them with `<img>` tags pointing at Twemoji SVG assets. It prefers direct SVG image URLs first, then falls back to cached or fetched data URLs when available. Successful fetched assets are cached in `localStorage` for 14 days.

Because this is a bookmarklet, it runs after page load and relies on the page allowing DOM changes plus either external image loads or `fetch` access to the Twemoji CDN. It no longer has userscript-only capabilities like `GM_xmlhttpRequest`, so it cannot bypass a page's CSP or other browser restrictions. When a page blocks both paths, the script now falls back to a visible two-letter country code and shows an alert instead of silently rendering nothing.
