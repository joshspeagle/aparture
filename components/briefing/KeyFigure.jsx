import { useEffect, useState } from 'react';
import { useAnalyzerStore } from '../../stores/analyzerStore.js';
import { encodePasswordHeader } from '../../lib/auth/passwordHeader.js';

// The figure the full read picked as the one to look at first, cropped from
// the paper's PDF. The image route needs the password header, which an
// <img src> can't send, so it is fetched and shown from a blob URL. The
// caption is the paper's own text, taken from the PDF.
export default function KeyFigure({ arxivId, figure }) {
  const password = useAnalyzerStore((s) => s.password);
  // The result carries the id it was for, so a card reused for another
  // paper never shows the previous paper's image.
  const [loaded, setLoaded] = useState({ id: null, url: null });

  useEffect(() => {
    if (!arxivId || !figure?.label) return undefined;
    let cancelled = false;
    let url = null;
    fetch(`/api/figures/${encodeURIComponent(arxivId)}`, {
      headers: { 'x-aparture-password': encodePasswordHeader(password) },
    })
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (cancelled || !blob) return;
        url = URL.createObjectURL(blob);
        setLoaded({ id: arxivId, url });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [arxivId, figure?.label, password]);

  if (!figure?.label || loaded.id !== arxivId || !loaded.url) return null;
  return (
    <figure className="key-figure">
      <img src={loaded.url} alt={figure.caption || `${figure.label} of ${arxivId}`} />
      <figcaption>
        {figure.caption || figure.label}
        <span className="key-figure-source">
          {' '}
          From the paper{figure.page ? `, page ${figure.page}` : ''}.
        </span>
      </figcaption>
    </figure>
  );
}
