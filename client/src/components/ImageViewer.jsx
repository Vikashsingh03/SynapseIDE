import { useEffect, useMemo, useState } from 'react';
import { FileImage, ImageOff, Maximize2, Percent, ZoomIn, ZoomOut } from 'lucide-react';
import { resolveImageSrc } from '../utils/imageFiles';

const CHECKERBOARD_STYLE = {
  backgroundColor: '#0d1117',
  backgroundImage:
    'linear-gradient(45deg, rgba(255,255,255,0.055) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.055) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.055) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.055) 75%)',
  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0',
  backgroundSize: '20px 20px',
};

const TOOLBAR_BUTTON_CLASS =
  'flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-semibold text-(--muted) transition-colors hover:bg-white/5 hover:text-(--ink) disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-(--muted)';

function ImageViewer({ file }) {
  const src = useMemo(() => resolveImageSrc(file), [file]);
  const [dimensions, setDimensions] = useState(null);
  const [zoom, setZoom] = useState('fit');
  const [loadFailed, setLoadFailed] = useState(false);
  const fileKey = file?.id ?? file?.name ?? '';

  useEffect(() => {
    setDimensions(null);
    setZoom('fit');
    setLoadFailed(false);
  }, [fileKey, src]);

  const isFit = zoom === 'fit';
  const canZoom = Boolean(src && !loadFailed);
  const zoomLabel = isFit ? 'Fit' : `${Math.round(zoom * 100)}%`;
  const zoomIn = () => {
    setZoom((current) => Math.min(4, (current === 'fit' ? 1 : current) + 0.25));
  };
  const zoomOut = () => {
    setZoom((current) => Math.max(0.25, (current === 'fit' ? 1 : current) - 0.25));
  };
  const imageStyle = isFit
    ? { maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }
    : dimensions
      ? {
          height: dimensions.height * zoom,
          maxHeight: 'none',
          maxWidth: 'none',
          width: dimensions.width * zoom,
        }
      : { transform: `scale(${zoom})`, transformOrigin: 'center' };

  return (
    <div className="flex h-full min-h-0 flex-col bg-(--paper-2)">
      <div className="flex min-h-[52px] flex-wrap items-center gap-2 border-b border-(--line) px-4 py-2.5">
        <FileImage size={17} className="shrink-0 text-(--ink)" />
        <div className="min-w-0">
          <p className="max-w-[320px] truncate text-[13px] font-bold text-(--ink)">
            {file?.name || 'Image'}
          </p>
          <p className="font-mono text-[11px] text-(--muted)">
            {dimensions ? `${dimensions.width} × ${dimensions.height}` : src ? 'Reading size…' : 'No image data'}
          </p>
        </div>
        <div className="flex-1" />
        <span className="min-w-12 text-center font-mono text-[11px] text-(--muted)">{zoomLabel}</span>
        <button type="button" onClick={() => setZoom('fit')} disabled={!canZoom} className={TOOLBAR_BUTTON_CLASS}>
          <Maximize2 size={14} /> Fit
        </button>
        <button type="button" onClick={() => setZoom(1)} disabled={!canZoom} className={TOOLBAR_BUTTON_CLASS}>
          <Percent size={14} /> 100%
        </button>
        <button type="button" onClick={zoomOut} disabled={!canZoom || zoom === 0.25} aria-label="Zoom out" className={TOOLBAR_BUTTON_CLASS}>
          <ZoomOut size={15} />
        </button>
        <button type="button" onClick={zoomIn} disabled={!canZoom || zoom === 4} aria-label="Zoom in" className={TOOLBAR_BUTTON_CLASS}>
          <ZoomIn size={15} />
        </button>
      </div>

      {!src || loadFailed ? (
        <div className="flex flex-1 items-center justify-center p-6" style={CHECKERBOARD_STYLE}>
          <div className="w-full max-w-sm rounded-xl border border-(--line) bg-(--paper-2)/95 p-6 text-center shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-(--muted)">
              <ImageOff size={22} />
            </div>
            <h3 className="text-[14px] font-bold text-(--ink)">
              {loadFailed ? 'This image could not be displayed' : 'No image data to preview'}
            </h3>
            <p className="mt-2 text-[12.5px] leading-5 text-(--muted)">
              {loadFailed
                ? 'The stored image data may be incomplete or damaged.'
                : 'This file holds no image data yet. Images arrive via ZIP import or by storing an image as a data URL.'}
            </p>
          </div>
        </div>
      ) : (
        <div className={`flex-1 min-h-0 ${isFit ? 'overflow-hidden' : 'overflow-auto'}`} style={CHECKERBOARD_STYLE}>
          <div className={isFit ? 'flex h-full w-full items-center justify-center p-6' : 'grid min-h-full w-max min-w-full place-items-center p-6'}>
            <img
              src={src}
              alt={file?.name || 'Project image'}
              draggable={false}
              onLoad={(event) => {
                setDimensions({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                });
              }}
              onError={() => setLoadFailed(true)}
              className="block select-none shadow-[0_18px_55px_rgba(0,0,0,0.45)]"
              style={imageStyle}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ImageViewer;
