(() => {

    const STATE_KEY = '__COUNTRY_FLAGS_EMOJI_BOOKMARKLET__';
    const STYLE_ID = 'country-flags-emoji-bookmarklet-style';
    const IMAGE_CLASS = 'country-flags-emoji-image';
    const READY_CLASS = 'country-flags-emoji-ready';
    const FALLBACK_CLASS = 'country-flags-emoji-fallback';
    const CACHE_KEY = 'country_flags_emoji_cache';
    const CACHE_EXPIRATION_MS = 14 * 24 * 60 * 60 * 1000;
    const BASE_URL = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@16.0.1/assets/svg/';
    const FLAG_REGEX = /[\u{1F1E6}-\u{1F1FF}]{2}/gu;
    const HAS_FLAG_REGEX = /[\u{1F1E6}-\u{1F1FF}]{2}/u;
    const SKIP_SELECTOR = 'script, style, textarea, input, select, option, noscript';

    if (window[STATE_KEY]) {
        window[STATE_KEY].scan(document.body || document.documentElement);
        return;
    }

    const inMemoryCache = new Map();
    const pendingRequests = new Map();
    const persistentCache = loadPersistentCache();
    let failureNoticeShown = false;
    let queuedRoots = new Set();
    let queueTimer = null;

    function loadPersistentCache() {
        try {
            const rawValue = window.localStorage.getItem(CACHE_KEY);
            if (!rawValue) {
                return {};
            }

            const parsed = JSON.parse(rawValue);
            const expirationTime = Date.now() - CACHE_EXPIRATION_MS;
            let updated = false;

            for (const icon of Object.keys(parsed)) {
                if (!parsed[icon] || parsed[icon].timestamp < expirationTime) {
                    delete parsed[icon];
                    updated = true;
                }
            }

            if (updated) {
                savePersistentCache(parsed);
            }

            return parsed;
        } catch (error) {
            console.warn('country-flags-emoji: localStorage cache unavailable.', error);
            return {};
        }
    }

    function savePersistentCache(cache) {
        try {
            window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
        } catch (error) {
            console.warn('country-flags-emoji: failed to save localStorage cache.', error);
        }
    }

    function blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    function ensureStyle() {
        if (document.getElementById(STYLE_ID)) {
            return;
        }

        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = [
            'img.' + IMAGE_CLASS + ', img.' + READY_CLASS + ', span.' + FALLBACK_CLASS + ' {',
            '    height: 1em !important;',
            '    width: 1em !important;',
            '    display: inline-block !important;',
            '    vertical-align: -0.1em !important;',
            '    margin: 0 .05em 0 .1em !important;',
            '}',
            'span.' + FALLBACK_CLASS + ' {',
            '    font: 700 0.65em/1.45 monospace !important;',
            '    text-align: center !important;',
            '    border: 1px solid currentColor !important;',
            '    border-radius: 0.2em !important;',
            '    box-sizing: border-box !important;',
            '}'
        ].join('\n');
        document.documentElement.appendChild(style);
    }

    function shouldSkipTextNode(textNode) {
        const parent = textNode.parentElement;
        if (!parent) {
            return true;
        }

        if (parent.closest(SKIP_SELECTOR)) {
            return true;
        }

        if (parent.closest('img.' + IMAGE_CLASS + ', img.' + READY_CLASS)) {
            return true;
        }

        if (parent.isContentEditable) {
            return true;
        }

        return false;
    }

    function iconFromFlag(flagText) {
        return Array.from(flagText, (char) => char.codePointAt(0).toString(16)).join('-');
    }

    function flagUrlFromIcon(icon) {
        return BASE_URL + icon + '.svg';
    }

    function countryCodeFromFlag(flagText) {
        return Array.from(flagText, (char) =>
            String.fromCharCode(char.codePointAt(0) - 0x1F1E6 + 65)
        ).join('');
    }

    function showFailureNotice() {
        if (failureNoticeShown) {
            return;
        }

        failureNoticeShown = true;
        window.alert(
            'country-flags-emoji could not load the SVG flag assets on this page. ' +
            'The page is likely blocking bookmarklet network requests with CSP.'
        );
    }

    function replaceWithTextFallback(node, flagText) {
        const fallback = document.createElement('span');
        fallback.className = FALLBACK_CLASS;
        fallback.textContent = countryCodeFromFlag(flagText);
        fallback.title = 'country-flags-emoji fallback for ' + flagText;
        fallback.setAttribute('aria-label', flagText);
        node.replaceWith(fallback);
    }

    function updateFlagImages(icon, dataUrl) {
        const selector = 'img.' + IMAGE_CLASS + '[data-country-flag-icon="' + icon + '"]';
        const images = document.querySelectorAll(selector);

        for (const image of images) {
            image.src = dataUrl;
            image.className = READY_CLASS;
        }
    }

    function getCachedDataUrl(icon) {
        if (inMemoryCache.has(icon)) {
            return inMemoryCache.get(icon);
        }

        if (persistentCache[icon]?.data) {
            inMemoryCache.set(icon, persistentCache[icon].data);
            return persistentCache[icon].data;
        }

        return null;
    }

    async function ensureFlagDataUrl(icon) {
        const cached = getCachedDataUrl(icon);
        if (cached) {
            return cached;
        }

        if (pendingRequests.has(icon)) {
            return pendingRequests.get(icon);
        }

        const request = (async () => {
            const response = await fetch(flagUrlFromIcon(icon), {
                credentials: 'omit',
                mode: 'cors'
            });

            if (!response.ok) {
                throw new Error('HTTP ' + response.status + ' while loading ' + icon + '.svg');
            }

            const dataUrl = await blobToDataUrl(await response.blob());
            inMemoryCache.set(icon, dataUrl);
            persistentCache[icon] = {
                data: dataUrl,
                timestamp: Date.now()
            };
            savePersistentCache(persistentCache);
            updateFlagImages(icon, dataUrl);
            return dataUrl;
        })()
            .catch((error) => {
                console.warn('country-flags-emoji: failed to load SVG for ' + icon + '.', error);
                return null;
            })
            .finally(() => {
                pendingRequests.delete(icon);
            });

        pendingRequests.set(icon, request);
        return request;
    }

    async function handleImageError(image, flagText, icon) {
        if (!image.isConnected) {
            return;
        }

        if (image.dataset.countryFlagErrorHandled === '1') {
            replaceWithTextFallback(image, flagText);
            showFailureNotice();
            return;
        }

        image.dataset.countryFlagErrorHandled = '1';

        const dataUrl = await ensureFlagDataUrl(icon);
        if (dataUrl && image.isConnected) {
            image.src = dataUrl;
            image.className = READY_CLASS;
            return;
        }

        if (image.isConnected) {
            replaceWithTextFallback(image, flagText);
        }
        showFailureNotice();
    }

    function createFlagImage(flagText) {
        const icon = iconFromFlag(flagText);
        const dataUrl = getCachedDataUrl(icon);
        const image = document.createElement('img');

        image.alt = flagText;
        image.decoding = 'async';
        image.className = dataUrl ? READY_CLASS : IMAGE_CLASS;
        image.setAttribute('data-country-flag-icon', icon);
        image.addEventListener('load', () => {
            image.className = READY_CLASS;
        }, { once: true });
        image.addEventListener('error', () => {
            handleImageError(image, flagText, icon);
        }, { once: true });

        image.src = dataUrl || flagUrlFromIcon(icon);

        return image;
    }

    function replaceFlagsInTextNode(textNode) {
        if (shouldSkipTextNode(textNode)) {
            return;
        }

        const text = textNode.nodeValue;
        if (!text || !HAS_FLAG_REGEX.test(text)) {
            return;
        }

        FLAG_REGEX.lastIndex = 0;
        let lastIndex = 0;
        const fragment = document.createDocumentFragment();

        for (let match = FLAG_REGEX.exec(text); match !== null; match = FLAG_REGEX.exec(text)) {
            if (match.index > lastIndex) {
                fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
            }

            fragment.appendChild(createFlagImage(match[0]));
            lastIndex = match.index + match[0].length;
        }

        if (lastIndex === 0) {
            return;
        }

        if (lastIndex < text.length) {
            fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
        }

        textNode.replaceWith(fragment);
    }

    function scan(root) {
        if (!root) {
            return;
        }

        if (root.nodeType === Node.TEXT_NODE) {
            replaceFlagsInTextNode(root);
            return;
        }

        const textNodes = [];
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                if (shouldSkipTextNode(node)) {
                    return NodeFilter.FILTER_REJECT;
                }

                return HAS_FLAG_REGEX.test(node.nodeValue || '')
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_REJECT;
            }
        });

        while (walker.nextNode()) {
            textNodes.push(walker.currentNode);
        }

        for (const textNode of textNodes) {
            replaceFlagsInTextNode(textNode);
        }
    }

    function queueScan(root) {
        if (!root) {
            return;
        }

        queuedRoots.add(root);
        if (queueTimer !== null) {
            return;
        }

        queueTimer = window.setTimeout(() => {
            for (const queuedRoot of queuedRoots) {
                scan(queuedRoot);
            }
            queuedRoots = new Set();
            queueTimer = null;
        }, 25);
    }

    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'characterData') {
                queueScan(mutation.target);
                continue;
            }

            for (const node of mutation.addedNodes) {
                queueScan(node);
            }
        }
    });

    ensureStyle();
    scan(document.body || document.documentElement);
    observer.observe(document.documentElement, {
        childList: true,
        characterData: true,
        subtree: true
    });

    window[STATE_KEY] = {
        observer,
        scan,
        stop() {
            observer.disconnect();
        }
    };
})();