'use client';

/**
 * Interactive canvas component for reviewing and editing redaction rectangles.
 *
 * Displays the original image with current redaction rects drawn as black
 * overlays. The user can:
 *   - See auto-detected redaction rects (shown in red before confirming)
 *   - Click and drag to draw a new manual redaction rect
 *   - Click on an existing rect to delete it
 *
 * Calls `onChange` whenever the rect list changes.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { RedactRect } from '@/lib/poster-ocr';

interface Props {
  imageSrc: string;
  rects: RedactRect[];
  onChange: (rects: RedactRect[]) => void;
  /** Marks which rects were auto-detected (shown in red until confirmed). */
  autoRects?: Set<number>;
}

interface DragState {
  startX: number;
  startY: number;
}

export function RedactionEditor({ imageSrc, rects, onChange, autoRects }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<RedactRect | null>(null);
  const dragState = useRef<DragState | null>(null);

  // Scale: image coords → canvas display coords
  const [scale, setScale] = useState({ x: 1, y: 1 });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw confirmed rects
    rects.forEach((r, i) => {
      const isAuto = autoRects?.has(i);
      ctx.fillStyle = isAuto ? 'rgba(239,68,68,0.55)' : '#000';
      ctx.fillRect(
        r.x * scale.x,
        r.y * scale.y,
        r.width * scale.x,
        r.height * scale.y
      );
      if (isAuto) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.strokeRect(
          r.x * scale.x,
          r.y * scale.y,
          r.width * scale.x,
          r.height * scale.y
        );
      }
    });

    // Draw current drag preview
    if (preview) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(
        preview.x * scale.x,
        preview.y * scale.y,
        preview.width * scale.x,
        preview.height * scale.y
      );
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(
        preview.x * scale.x,
        preview.y * scale.y,
        preview.width * scale.x,
        preview.height * scale.y
      );
      ctx.setLineDash([]);
    }
  }, [rects, preview, scale, autoRects]);

  // Load image and set canvas size
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!canvas || !container) return;
      const maxW = container.clientWidth || img.naturalWidth;
      const ratio = img.naturalHeight / img.naturalWidth;
      canvas.width = maxW;
      canvas.height = Math.round(maxW * ratio);
      setScale({ x: maxW / img.naturalWidth, y: (maxW * ratio) / img.naturalHeight });
      draw();
    };
    img.src = imageSrc;
  }, [imageSrc, draw]);

  useEffect(() => {
    draw();
  }, [draw]);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / scale.x,
      y: (e.clientY - rect.top) / scale.y,
    };
  };

  const getTouchPos = (e: React.TouchEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0] ?? e.changedTouches[0];
    return {
      x: (touch.clientX - rect.left) / scale.x,
      y: (touch.clientY - rect.top) / scale.y,
    };
  };

  const startDrag = useCallback((x: number, y: number) => {
    dragState.current = { startX: x, startY: y };
    setDragging(true);
  }, []);

  const moveDrag = useCallback((x: number, y: number) => {
    if (!dragState.current) return;
    const { startX, startY } = dragState.current;
    setPreview({
      x: Math.min(startX, x),
      y: Math.min(startY, y),
      width: Math.abs(x - startX),
      height: Math.abs(y - startY),
    });
  }, []);

  const endDrag = useCallback((x: number, y: number) => {
    if (!dragState.current) return;
    const { startX, startY } = dragState.current;
    const w = Math.abs(x - startX);
    const h = Math.abs(y - startY);
    if (w > 5 && h > 5) {
      const newRect: RedactRect = {
        x: Math.min(startX, x),
        y: Math.min(startY, y),
        width: w,
        height: h,
      };
      onChange([...rects, newRect]);
    }
    dragState.current = null;
    setDragging(false);
    setPreview(null);
  }, [rects, onChange]);

  const handleClick = useCallback((x: number, y: number) => {
    // If no drag happened, check if we clicked on an existing rect to delete it
    const img = imgRef.current;
    if (!img) return;
    const hitIdx = rects.findIndex(
      (r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height
    );
    if (hitIdx !== -1) {
      onChange(rects.filter((_, i) => i !== hitIdx));
    }
  }, [rects, onChange]);

  return (
    <div ref={containerRef} className="w-full">
      <canvas
        ref={canvasRef}
        className={`w-full rounded-xl ${dragging ? 'cursor-crosshair' : 'cursor-pointer'}`}
        onMouseDown={(e) => {
          const { x, y } = getPos(e);
          startDrag(x, y);
        }}
        onMouseMove={(e) => {
          if (!dragState.current) return;
          moveDrag(...Object.values(getPos(e)) as [number, number]);
        }}
        onMouseUp={(e) => {
          const pos = getPos(e);
          if (
            dragState.current &&
            Math.abs(pos.x - dragState.current.startX) < 5 &&
            Math.abs(pos.y - dragState.current.startY) < 5
          ) {
            dragState.current = null;
            setDragging(false);
            setPreview(null);
            handleClick(pos.x, pos.y);
          } else {
            endDrag(pos.x, pos.y);
          }
        }}
        onMouseLeave={() => {
          if (dragging) {
            dragState.current = null;
            setDragging(false);
            setPreview(null);
          }
        }}
        onTouchStart={(e) => {
          e.preventDefault();
          const { x, y } = getTouchPos(e);
          startDrag(x, y);
        }}
        onTouchMove={(e) => {
          e.preventDefault();
          const { x, y } = getTouchPos(e);
          moveDrag(x, y);
        }}
        onTouchEnd={(e) => {
          const pos = getTouchPos(e);
          endDrag(pos.x, pos.y);
        }}
      />
    </div>
  );
}
