import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  IconButton,
  Slider,
  Typography,
} from '@mui/material';
import { ArrowLeft, ChevronLeft, ChevronRight, Menu, Moon, Sun, Maximize, Minimize } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { contentsService } from '../services/contents.service';
import { readingService } from '../services/reading.service';
import ePub from 'epubjs';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const themeSepia = '#faf8f3';
const textSepia = '#433422';
const primary = '#3211d4';

export default function EReaderPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(25);
  const [canRead, setCanRead] = useState(false);
  const [accessHint, setAccessHint] = useState('');
  const [signedUrl, setSignedUrl] = useState('');
  const [fileBuffer, setFileBuffer] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState('');
  const [lastCfi, setLastCfi] = useState('');
  const [epubReady, setEpubReady] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [initialLastPosition, setInitialLastPosition] = useState(null);
  const [epubToc, setEpubToc] = useState([]);
  const [fontPercent, setFontPercent] = useState(100);
  const [nightMode, setNightMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showToc, setShowToc] = useState(true);
  const [sliderValue, setSliderValue] = useState(0);
  const epubContainerRef = useRef(null);
  const bookRef = useRef(null);
  const renditionRef = useRef(null);
  const pdfContainerRef = useRef(null);
  const pdfCanvasRef = useRef(null);
  const pdfDocRef = useRef(null);
  const readerRootRef = useRef(null);
  const isJumpingRef = useRef(false);
  const isEpub = content?.format === 'epub';
  const isPdf = content?.format === 'pdf';

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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      setDownloadProgress(0);
      setDownloadStatus('');

      try {
        setDownloadStatus('Chargement des informations...');
        const data = await contentsService.getContentById(id);

        setDownloadStatus('Récupération de la session...');
        const [session, chaptersData] = await Promise.all([
          readingService.getSession(id),
          readingService.getChapters(id),
        ]);

        const needsBinaryFile = ['epub', 'pdf'].includes(String(data?.format || '').toLowerCase());
        let binaryBuffer = null;

        if (needsBinaryFile) {
          const fileSizeMB = data?.file_size_bytes
            ? (data.file_size_bytes / (1024 * 1024)).toFixed(1)
            : '?';
          setDownloadStatus(`Téléchargement du fichier (${fileSizeMB} MB)...`);

          binaryBuffer = await readingService.getFileBuffer(id, (percent) => {
            setDownloadProgress(percent);
          });

          setDownloadStatus('Préparation de la lecture...');
        }

        setContent(data);
        setSignedUrl(session?.stream?.url || '');
        setFileBuffer(binaryBuffer);
        setProgress(Number(session?.progress?.progress_percent || 0));
        setInitialLastPosition(session?.progress?.last_position || null);
        setChapters(chaptersData?.chapters || []);
        setCanRead(true);
        setDownloadStatus('');
        setDownloadProgress(0);
      } catch (err) {
        console.error('Erreur chargement lecture:', err);
        const msg = err?.message || 'Impossible de charger la lecture.';
        if (msg.includes('Accès refusé') || msg.includes('abonnement') || msg.includes('paiement')) {
          setCanRead(false);
          setAccessHint(msg);
        } else {
          setError(msg);
        }
        setDownloadStatus('');
        setDownloadProgress(0);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  useEffect(() => {
    if (!canRead) return;
    const lastPosition = {
      chapter: `p-${Math.max(1, Math.round((progress / 100) * 348))}`,
      percent: Number(progress),
      type: 'ebook',
      ...(content?.format === 'epub' && lastCfi ? { cfi: lastCfi } : {}),
      ...(content?.format === 'pdf' ? { pdf_page: currentPage, total_pages: totalPages } : {}),
    };

    const timer = setTimeout(() => {
      readingService.saveProgress(id, {
        progressPercent: Number(progress),
        lastPosition,
        totalTimeSeconds: 0,
      }).catch((error) => {
        console.error('Erreur sauvegarde progression:', error);
      });
    }, 700);

    return () => clearTimeout(timer);
  }, [canRead, content?.format, currentPage, id, lastCfi, progress, totalPages]);

  // EPUB dependencies are now loaded via imports, so just mark as ready
  useEffect(() => {
    if (!(canRead && content?.format === 'epub' && fileBuffer)) return;
    setEpubReady(true);
  }, [canRead, content?.format, fileBuffer]);

  // PDF.js dependencies are now loaded via imports, so just mark as ready
  useEffect(() => {
    if (!(canRead && content?.format === 'pdf' && fileBuffer)) return;
    setPdfReady(true);
  }, [canRead, content?.format, fileBuffer]);

  useEffect(() => {
    if (!(canRead && content?.format === 'pdf' && fileBuffer && pdfReady && pdfjsLib)) return;

    pdfDocRef.current = null;

    const loadingTask = pdfjsLib.getDocument({ data: fileBuffer });
    loadingTask.promise
      .then((pdf) => {
        pdfDocRef.current = pdf;
        const pages = Number(pdf.numPages || 1);
        setTotalPages(pages);
        const restoredPage = Number(initialLastPosition?.pdf_page || 1);
        const safePage = Math.max(1, Math.min(pages, restoredPage));
        setCurrentPage(safePage);
        setProgress(Math.round((safePage / pages) * 100));
      })
      .catch((error) => {
        console.error('Erreur chargement PDF:', error);
        setError(`Impossible d'ouvrir ce fichier PDF. ${error.message || 'Erreur inconnue.'}`);
      });

    return () => {
      if (loadingTask?.destroy) {
        loadingTask.destroy();
      }
      pdfDocRef.current = null;
    };
  }, [canRead, content?.format, fileBuffer, initialLastPosition, pdfReady]);

  useEffect(() => {
    if (!(canRead && content?.format === 'pdf' && pdfDocRef.current && pdfCanvasRef.current)) return;

    const pdf = pdfDocRef.current;
    const pageNumber = Math.max(1, Math.min(totalPages, Number(currentPage || 1)));
    let cancelled = false;

    pdf.getPage(pageNumber)
      .then((page) => {
        if (cancelled) return;
        const containerWidth = Math.max(320, Math.floor(pdfContainerRef.current?.clientWidth || 760));
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = containerWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });
        const canvas = pdfCanvasRef.current;
        const ctx = canvas.getContext('2d');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        return page.render({
          canvasContext: ctx,
          viewport,
        }).promise;
      })
      .catch((error) => {
        console.error('Erreur rendu page PDF:', error);
        if (!cancelled) {
          setError(`Rendu PDF impossible. ${error.message || 'Erreur inconnue.'}`);
        }
      });

    setProgress(Math.round((pageNumber / Math.max(1, totalPages)) * 100));

    return () => {
      cancelled = true;
    };
  }, [canRead, content?.format, currentPage, totalPages]);

  useEffect(() => {
    if (!(canRead && content?.format === 'epub' && fileBuffer && epubReady && epubContainerRef.current && ePub)) {
      return;
    }

    if (renditionRef.current) {
      renditionRef.current.destroy();
      renditionRef.current = null;
    }
    if (bookRef.current) {
      bookRef.current.destroy();
      bookRef.current = null;
    }

    let mounted = true;
    const initEpub = async () => {
      try {
        const safeBuffer = await sanitizeEpubBuffer(fileBuffer);
        if (!mounted) return;

        const book = ePub(safeBuffer);
        const rendition = book.renderTo(epubContainerRef.current, {
          width: '100%',
          height: '100%',
          spread: 'none',
          flow: 'paginated',
          allowScriptedContent: false,
        });

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
        try {
          const nav = await book.loaded.navigation;
          setEpubToc(Array.isArray(nav?.toc) ? nav.toc : []);
        } catch (error) {
          console.error('Erreur chargement table des matières EPUB:', error);
          setEpubToc([]);
        }

        try {
          await book.locations.generate(1200);
        } catch (error) {
          console.error('Erreur génération locations EPUB (navigation par %):', error);
        }

        const savedCfi = initialLastPosition?.cfi || null;
        if (savedCfi) {
          await rendition.display(savedCfi);
        } else {
          await rendition.display();
        }

        rendition.on('relocated', (location) => {
          const cfi = location?.start?.cfi;
          if (!cfi || !book.locations) return;
          const pct = book.locations.percentageFromCfi(cfi);
          if (Number.isFinite(pct)) {
            const next = Math.max(0, Math.min(100, Math.round(pct * 100)));
            setProgress(next);
            if (!isJumpingRef.current) {
              setSliderValue(next);
            }
          }
          setLastCfi(cfi);
        });
      } catch (error) {
        console.error('Erreur initialisation EPUB:', error);
        if (mounted) {
          setError(`Impossible d'ouvrir ce fichier EPUB. ${error.message || 'Erreur inconnue.'}`);
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
  }, [canRead, content?.format, epubReady, fileBuffer, initialLastPosition]);

  useEffect(() => {
    if (!isEpub || !renditionRef.current) return;
    renditionRef.current.themes.fontSize(`${fontPercent}%`);
  }, [fontPercent, isEpub]);

  useEffect(() => {
    if (!isEpub || !renditionRef.current) return;
    if (nightMode) {
      renditionRef.current.themes.register('night', {
        body: { background: '#1c2128', color: '#e7edf2' },
        a: { color: '#9cc7ff' },
      });
      renditionRef.current.themes.select('night');
    } else {
      renditionRef.current.themes.select('default');
    }
  }, [isEpub, nightMode]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    setSliderValue(Number(progress || 0));
  }, [progress]);

  const handleProgressChange = (_, value) => {
    setSliderValue(Number(value));
  };

  const handleProgressCommit = async (_, value) => {
    const next = Number(value);
    if (content?.format === 'epub' && bookRef.current?.locations && renditionRef.current) {
      const percentage = Math.max(0, Math.min(1, next / 100));
      const cfi = bookRef.current.locations.cfiFromPercentage(percentage);
      if (cfi) {
        try {
          isJumpingRef.current = true;
          await renditionRef.current.display(cfi);
          setProgress(next);
        } catch (error) {
          console.error('Erreur navigation EPUB vers position:', error);
        } finally {
          isJumpingRef.current = false;
        }
      }
    }

    if (content?.format === 'pdf' && totalPages > 0) {
      const page = Math.max(1, Math.min(totalPages, Math.round((next / 100) * totalPages)));
      setCurrentPage(page);
    }
  };

  const paragraphs = useMemo(() => {
    const description = String(content?.description || '').trim();
    if (!description) {
      return ['Aucun extrait disponible pour ce livre.'];
    }
    return description.split('\n').map((line) => line.trim()).filter(Boolean);
  }, [content]);

  const tocItems = useMemo(() => {
    if (!isEpub) return chapters;
    const out = [];
    const walk = (nodes) => {
      if (!Array.isArray(nodes)) return;
      nodes.forEach((n) => {
        if (n?.label) out.push({ id: n.id, label: n.label, href: n.href });
        if (Array.isArray(n?.subitems) && n.subitems.length > 0) walk(n.subitems);
      });
    };
    walk(epubToc);
    return out;
  }, [chapters, epubToc, isEpub]);

  const goPrev = () => {
    if (isEpub && renditionRef.current) {
      renditionRef.current.prev().catch((error) => {
        console.error('Erreur navigation EPUB précédent:', error);
      });
      return;
    }
    if (isPdf) setCurrentPage((p) => Math.max(1, p - 1));
  };

  const goNext = () => {
    if (isEpub && renditionRef.current) {
      renditionRef.current.next().catch((error) => {
        console.error('Erreur navigation EPUB suivant:', error);
      });
      return;
    }
    if (isPdf) setCurrentPage((p) => Math.min(totalPages, p + 1));
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await readerRootRef.current?.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch (error) {
      console.error('Erreur plein écran:', error);
      setError('Mode plein écran non disponible sur ce navigateur.');
      setTimeout(() => setError(''), 3000);
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center', gap: 3 }}>
        <CircularProgress />
        {downloadStatus && (
          <Box sx={{ textAlign: 'center', maxWidth: 400 }}>
            <Typography sx={{ fontSize: '0.9rem', color: '#433422', mb: 1.5 }}>
              {downloadStatus}
            </Typography>
            {downloadProgress > 0 && downloadProgress < 100 && (
              <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ flex: 1, height: 6, bgcolor: '#e8dfd0', borderRadius: 3, overflow: 'hidden' }}>
                  <Box
                    sx={{
                      height: '100%',
                      bgcolor: primary,
                      width: `${downloadProgress}%`,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </Box>
                <Typography sx={{ fontSize: '0.75rem', color: '#867465', minWidth: 45, textAlign: 'right' }}>
                  {downloadProgress}%
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </Box>
    );
  }

  if (!content || error) {
    return (
      <Container sx={{ py: 5 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error || 'Livre introuvable.'}</Alert>
        <Button onClick={() => navigate('/catalogue')} variant="outlined">Retour</Button>
      </Container>
    );
  }

  if (!canRead) {
    return (
      <Container sx={{ py: 5 }}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          {accessHint || 'Accès non autorisé pour ce contenu.'}
        </Alert>
        <Button onClick={() => navigate(`/catalogue/${id}`)} variant="outlined">
          Retour au détail
        </Button>
      </Container>
    );
  }

  return (
    <Box
      ref={readerRootRef}
      sx={{
        height: '100vh',
        bgcolor: themeSepia,
        color: textSepia,
        display: 'grid',
        gridTemplateRows: '66px 1fr 64px',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ borderBottom: '1px solid rgba(0,0,0,0.08)', bgcolor: 'rgba(250,248,243,0.95)', backdropFilter: 'blur(8px)', px: { xs: 1.5, md: 2.5 }, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
          <IconButton onClick={() => navigate(`/catalogue/${id}`)}><ArrowLeft size={18} /></IconButton>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.68rem', textTransform: 'uppercase', opacity: 0.65, fontWeight: 700 }}>Emoti Numerique</Typography>
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: { xs: 150, md: 360 } }}>
              {content.title}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
          <IconButton onClick={goPrev} title="Précédent"><ChevronLeft size={18} /></IconButton>
          <IconButton onClick={goNext} title="Suivant"><ChevronRight size={18} /></IconButton>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.4 }} />
          {isEpub ? (
            <>
              <IconButton onClick={() => setNightMode((v) => !v)} title="Mode lecture">
                {nightMode ? <Sun size={17} /> : <Moon size={17} />}
              </IconButton>
              <Box sx={{ width: 90, px: 0.8, display: { xs: 'none', md: 'block' } }}>
                <Slider min={80} max={140} step={10} value={fontPercent} onChange={(_, v) => setFontPercent(Number(v))} sx={{ color: primary }} />
              </Box>
            </>
          ) : null}
          <IconButton onClick={() => setShowToc((v) => !v)} title="Table des matières">
            <Menu size={18} />
          </IconButton>
          <IconButton onClick={toggleFullscreen} title="Plein écran">
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </IconButton>
        </Box>
      </Box>

      <Box sx={{ minHeight: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: showToc ? '320px 1fr' : '1fr' } }}>
        {showToc ? (
          <Box sx={{ borderRight: { lg: '1px solid rgba(0,0,0,0.08)' }, bgcolor: '#f6f2e8', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 2.2, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '0.9rem' }}>Table des matieres</Typography>
            </Box>
            <Box sx={{ p: 1.2, overflowY: 'auto', minHeight: 0 }}>
              {(tocItems.length > 0 ? tocItems : [{ label: 'Introduction' }]).slice(0, 200).map((item, idx) => (
                <Box
                  key={item.id || item.href || `chapter-${idx + 1}`}
                  sx={{ px: 1.2, py: 1.1, borderRadius: 1.5, color: textSepia, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' } }}
                  onClick={() => {
                    if (isEpub && renditionRef.current && item.href) {
                      renditionRef.current.display(item.href).catch((error) => {
                        console.error('Erreur navigation chapitre EPUB:', error);
                      });
                    } else if (isPdf) {
                      const page = Number(item.index || idx + 1);
                      setCurrentPage(Math.max(1, Math.min(totalPages, page)));
                    }
                  }}
                >
                  <Typography sx={{ fontSize: '0.88rem', lineHeight: 1.35 }}>{item.title || item.label || `Chapitre ${idx + 1}`}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        ) : null}

        <Box sx={{ minHeight: 0, p: { xs: 1, md: 2 } }}>
          <Box sx={{ height: '100%', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 2, bgcolor: isEpub && nightMode ? '#1c2128' : '#fff', overflow: 'hidden', position: 'relative' }}>
            {content.format === 'pdf' && fileBuffer ? (
              <Box ref={pdfContainerRef} sx={{ width: '100%', height: '100%', overflow: 'auto', display: 'grid', placeItems: 'start center', py: 2 }}>
                <canvas ref={pdfCanvasRef} style={{ maxWidth: '100%', height: 'auto', boxShadow: '0 4px 18px rgba(0,0,0,0.12)' }} />
              </Box>
            ) : null}

            {content.format === 'epub' && fileBuffer ? (
              <Box ref={epubContainerRef} sx={{ width: '100%', height: '100%' }} />
            ) : null}

            {!['pdf', 'epub'].includes(content.format) ? (
              <Box sx={{ height: '100%', overflowY: 'auto', p: { xs: 2, md: 5 }, fontFamily: 'Lora, serif', fontSize: { xs: '1.05rem', md: '1.25rem' }, lineHeight: 1.8, color: 'rgba(67,52,34,0.88)', display: 'grid', gap: 3 }}>
                {paragraphs.map((p, idx) => (
                  <Typography key={`${idx}-${p.slice(0, 10)}`} sx={{ font: 'inherit', lineHeight: 'inherit' }}>{p}</Typography>
                ))}
              </Box>
            ) : null}
          </Box>
        </Box>
      </Box>

      <Box sx={{ borderTop: '1px solid rgba(0,0,0,0.08)', bgcolor: 'rgba(250,248,243,0.95)', backdropFilter: 'blur(8px)', px: { xs: 1.5, md: 4 }, py: 1 }}>
        <Box sx={{ maxWidth: 980, mx: 'auto' }}>
          <Slider
            value={sliderValue}
            onChange={handleProgressChange}
            onChangeCommitted={handleProgressCommit}
            sx={{ color: primary, py: 0.2 }}
          />
          <Typography sx={{ textAlign: 'center', fontSize: '0.74rem', opacity: 0.68, fontWeight: 700 }}>
            {content.format === 'pdf'
              ? `Page ${currentPage} / ${totalPages}`
              : `Progression ${Math.round(progress)}%`}
          </Typography>
          {signedUrl ? (
            <Typography sx={{ textAlign: 'center', fontSize: '0.66rem', opacity: 0.5 }}>
              Source sécurisée active.
            </Typography>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
}
