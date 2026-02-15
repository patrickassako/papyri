import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

export function usePdfReader({ fileBuffer, canvasRef, containerRef, initialPosition, onError }) {
  const [ready, setReady] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [progressPercent, setProgressPercent] = useState(0);
  const pdfDocRef = useRef(null);

  // Load PDF document
  useEffect(() => {
    if (!fileBuffer) return;

    pdfDocRef.current = null;

    const loadingTask = pdfjsLib.getDocument({ data: fileBuffer });
    loadingTask.promise
      .then((pdf) => {
        pdfDocRef.current = pdf;
        const pages = Number(pdf.numPages || 1);
        setTotalPages(pages);
        const restoredPage = Number(initialPosition?.pdf_page || 1);
        const safePage = Math.max(1, Math.min(pages, restoredPage));
        setCurrentPage(safePage);
        setProgressPercent(Math.round((safePage / pages) * 100));
        setReady(true);
      })
      .catch((error) => {
        console.error('Erreur chargement PDF:', error);
        if (onError) {
          onError(`Impossible d'ouvrir ce fichier PDF. ${error.message || 'Erreur inconnue.'}`);
        }
      });

    return () => {
      if (loadingTask?.destroy) {
        loadingTask.destroy();
      }
      pdfDocRef.current = null;
    };
  }, [fileBuffer, initialPosition, onError]);

  // Render current page
  useEffect(() => {
    if (!pdfDocRef.current || !canvasRef.current) return;

    const pdf = pdfDocRef.current;
    const pageNumber = Math.max(1, Math.min(totalPages, Number(currentPage || 1)));
    let cancelled = false;

    pdf.getPage(pageNumber)
      .then((page) => {
        if (cancelled) return;
        const containerWidth = Math.max(320, Math.floor(containerRef?.current?.clientWidth || 760));
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = containerWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
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
        if (!cancelled && onError) {
          onError(`Rendu PDF impossible. ${error.message || 'Erreur inconnue.'}`);
        }
      });

    setProgressPercent(Math.round((pageNumber / Math.max(1, totalPages)) * 100));

    return () => {
      cancelled = true;
    };
  }, [currentPage, totalPages, canvasRef, containerRef, onError]);

  const goNext = () => {
    setCurrentPage((p) => Math.min(totalPages, p + 1));
  };

  const goPrev = () => {
    setCurrentPage((p) => Math.max(1, p - 1));
  };

  const goToPercent = (percent) => {
    if (totalPages <= 0) return;
    const page = Math.max(1, Math.min(totalPages, Math.round((percent / 100) * totalPages)));
    setCurrentPage(page);
  };

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(totalPages, page)));
  };

  return {
    ready,
    currentPage,
    totalPages,
    progressPercent,
    goNext,
    goPrev,
    goToPercent,
    goToPage,
  };
}
