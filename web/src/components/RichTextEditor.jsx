import React, { useEffect, useMemo, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import 'quill/dist/quill.snow.css';
import { normalizeRichTextHtml, sanitizeRichTextHtml } from '../utils/richText';

const toolbarOptions = [
  [{ header: [2, 3, false] }],
  ['bold', 'italic', 'underline'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['blockquote'],
  ['clean'],
];

export default function RichTextEditor({
  value,
  onChange,
  placeholder = '',
  minHeight = 220,
  helperText = '',
}) {
  const editorRootRef = useRef(null);
  const quillRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const normalizedValue = useMemo(() => normalizeRichTextHtml(value), [value]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      if (!editorRootRef.current || quillRef.current) return;
      const { default: Quill } = await import('quill');
      if (!isMounted || !editorRootRef.current) return;

      const quill = new Quill(editorRootRef.current, {
        theme: 'snow',
        placeholder,
        modules: {
          toolbar: toolbarOptions,
        },
      });

      quill.root.innerHTML = normalizeRichTextHtml(valueRef.current);
      quill.on('text-change', () => {
        const sanitized = sanitizeRichTextHtml(quill.root.innerHTML);
        onChangeRef.current?.(sanitized);
      });

      quillRef.current = quill;
    }

    init();

    return () => {
      isMounted = false;
      if (editorRootRef.current) {
        editorRootRef.current.innerHTML = '';
      }
      quillRef.current = null;
    };
  }, [placeholder]);

  useEffect(() => {
    const quill = quillRef.current;
    if (!quill) return;
    const sanitized = sanitizeRichTextHtml(normalizedValue);
    if (sanitizeRichTextHtml(quill.root.innerHTML) !== sanitized) {
      const selection = quill.getSelection();
      quill.root.innerHTML = sanitized;
      if (selection) {
        quill.setSelection(selection);
      }
    }
  }, [normalizedValue]);

  return (
    <Box
      sx={{
        '& .ql-toolbar.ql-snow': {
          border: '1px solid #e0e0e0',
          borderBottom: 'none',
          borderRadius: '12px 12px 0 0',
          bgcolor: '#faf8f4',
        },
        '& .ql-container.ql-snow': {
          border: '1px solid #e0e0e0',
          borderRadius: '0 0 12px 12px',
          bgcolor: '#fff',
          fontSize: '0.95rem',
        },
        '& .ql-editor': {
          minHeight,
          fontSize: '0.95rem',
          lineHeight: 1.75,
          color: '#1f2937',
          overflowWrap: 'anywhere',
          '& p': { marginBottom: '0.9em' },
          '& h2': { fontSize: '1.3rem', fontWeight: 800, color: '#1A1A2E' },
          '& h3': { fontSize: '1.08rem', fontWeight: 700, color: '#1A1A2E' },
          '& blockquote': {
            borderLeft: '3px solid #d6c5b0',
            color: '#5b6472',
            fontStyle: 'italic',
            paddingLeft: '1rem',
          },
        },
        '& .ql-editor.ql-blank::before': {
          color: '#9e9e9e',
          fontStyle: 'normal',
        },
      }}
    >
      <div ref={editorRootRef} />
      {helperText ? (
        <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: '#8b8b8b' }}>
          {helperText}
        </Typography>
      ) : null}
    </Box>
  );
}
