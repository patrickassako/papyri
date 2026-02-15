import { useEffect, useRef, useState } from 'react';
import ePub from 'epubjs';
import JSZip from 'jszip';

const sanitizeHtmlString = (html) => {
  if (typeof html !== 'string') return html;
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/\s(href|src|xlink:href)\s*=\s*(['"])javascript:[^'"]*\2/gi, ' $1="#"');
};

const sanitizeEpubBuffer = async (buffer) => {
  if (!buffer) return buffer;
  try {
    const zip = await JSZip.loadAsync(buffer);
    const entries = Object.keys(zip.files);
    const htmlLike = /\.(xhtml|html|htm|svg)$/i;
    await Promise.all(entries.map(async (name) => {
      const entry = zip.files[name];
      if (!entry || entry.dir || !htmlLike.test(name)) return;
      const source = await entry.async('string');
      const clean = sanitizeHtmlString(source);
      if (clean !== source) {
        zip.file(name, clean);
      }
    }));
    const out = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
    return out;
  } catch (error) {
    console.error('Erreur sanitization EPUB:', error);
    return buffer;
  }
};

export function useEpubReader({ fileBuffer, containerRef, initialPosition, onError }) {
  const [ready, setReady] = useState(false);
  const [toc, setToc] = useState([]);
  const [currentCfi, setCurrentCfi] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const bookRef = useRef(null);
  const renditionRef = useRef(null);
  const isJumpingRef = useRef(false);

  // Initialize EPUB
  useEffect(() => {
    if (!fileBuffer || !containerRef.current) return;

    let mounted = true;

    const initEpub = async () => {
      try {
        const safeBuffer = await sanitizeEpubBuffer(fileBuffer);
        if (!mounted) return;

        const book = ePub(safeBuffer);
        const rendition = book.renderTo(containerRef.current, {
          width: '100%',
          height: '100%',
          spread: 'none',
          flow: 'paginated',
          allowScriptedContent: false,
        });

        // Register sanitization hooks
        try {
          book.spine?.hooks?.serialize?.register((output) => sanitizeHtmlString(output));
        } catch (error) {
          console.error('Erreur enregistrement hook sanitization EPUB:', error);
        }

        rendition.hooks.content.register((contents) => {
          try {
            const doc = contents?.document;
            if (!doc) return;
            doc.querySelectorAll('script').forEach((node) => node.remove());
            doc.querySelectorAll('*').forEach((el) => {
              Array.from(el.attributes || []).forEach((attr) => {
                if (attr.name.toLowerCase().startsWith('on')) {
                  el.removeAttribute(attr.name);
                }
              });
            });
          } catch (error) {
            console.error('Erreur sanitization contenu EPUB:', error);
          }
        });

        bookRef.current = book;
        renditionRef.current = rendition;

        await book.ready;

        // Load TOC
        try {
          const nav = await book.loaded.navigation;
          setToc(Array.isArray(nav?.toc) ? nav.toc : []);
        } catch (error) {
          console.error('Erreur chargement table des matières EPUB:', error);
          setToc([]);
        }

        // Generate locations for progress tracking
        try {
          await book.locations.generate(1200);
        } catch (error) {
          console.error('Erreur génération locations EPUB (navigation par %):', error);
        }

        // Display at saved position or start
        const savedCfi = initialPosition?.cfi || null;
        if (savedCfi) {
          await rendition.display(savedCfi);
        } else {
          await rendition.display();
        }

        // Track position changes
        rendition.on('relocated', (location) => {
          const cfi = location?.start?.cfi;
          if (!cfi || !book.locations) return;
          const pct = book.locations.percentageFromCfi(cfi);
          if (Number.isFinite(pct)) {
            const next = Math.max(0, Math.min(100, Math.round(pct * 100)));
            setProgressPercent(next);
          }
          setCurrentCfi(cfi);
        });

        setReady(true);
      } catch (error) {
        console.error('Erreur initialisation EPUB:', error);
        if (mounted && onError) {
          onError(`Impossible d'ouvrir ce fichier EPUB. ${error.message || 'Erreur inconnue.'}`);
        }
      }
    };

    initEpub();

    return () => {
      mounted = false;
      if (renditionRef.current) {
        renditionRef.current.destroy();
        renditionRef.current = null;
      }
      if (bookRef.current) {
        bookRef.current.destroy();
        bookRef.current = null;
      }
    };
  }, [fileBuffer, containerRef, initialPosition, onError]);

  const goNext = () => {
    if (renditionRef.current) {
      renditionRef.current.next().catch((error) => {
        console.error('Erreur navigation EPUB suivant:', error);
      });
    }
  };

  const goPrev = () => {
    if (renditionRef.current) {
      renditionRef.current.prev().catch((error) => {
        console.error('Erreur navigation EPUB précédent:', error);
      });
    }
  };

  const goToPercent = async (percent) => {
    if (!bookRef.current?.locations || !renditionRef.current) return;

    const percentage = Math.max(0, Math.min(1, percent / 100));
    const cfi = bookRef.current.locations.cfiFromPercentage(percentage);

    if (cfi) {
      try {
        isJumpingRef.current = true;
        await renditionRef.current.display(cfi);
        setProgressPercent(percent);
      } catch (error) {
        console.error('Erreur navigation EPUB vers position:', error);
      } finally {
        isJumpingRef.current = false;
      }
    }
  };

  const goToHref = (href) => {
    if (renditionRef.current && href) {
      renditionRef.current.display(href).catch((error) => {
        console.error('Erreur navigation chapitre EPUB:', error);
      });
    }
  };

  const setFontSize = (percent) => {
    if (renditionRef.current) {
      renditionRef.current.themes.fontSize(`${percent}%`);
    }
  };

  const setTheme = (isDark) => {
    if (!renditionRef.current) return;
    if (isDark) {
      renditionRef.current.themes.register('night', {
        body: { background: '#1c2128', color: '#e7edf2' },
        a: { color: '#9cc7ff' },
      });
      renditionRef.current.themes.select('night');
    } else {
      renditionRef.current.themes.select('default');
    }
  };

  return {
    ready,
    toc,
    currentCfi,
    progressPercent,
    goNext,
    goPrev,
    goToPercent,
    goToHref,
    setFontSize,
    setTheme,
  };
}
