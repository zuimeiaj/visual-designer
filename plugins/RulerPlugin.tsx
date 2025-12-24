
import { CanvasPlugin, PluginContext } from '../types';
import { useState } from 'react';

export const useRulerPlugin = (): CanvasPlugin => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const RULER_SIZE = 24;
  const COLOR_BG = '#18181b'; // zinc-900
  const COLOR_TICK = '#3f3f46'; // zinc-700
  const COLOR_TEXT = '#71717a'; // zinc-500
  const COLOR_ACCENT = '#6366f1'; // indigo-500

  return {
    name: 'ruler',
    onMouseMove: (e, ctx) => {
      const coords = ctx.getCanvasCoords(e.clientX, e.clientY);
      setMousePos(coords);
    },
    onRenderForeground: (ctx) => {
      if (!ctx.renderer) return;
      const c = ctx.renderer.ctx;
      const { width, height } = c.canvas;
      const { zoom, offset, selectedIds, shapes } = ctx.state;

      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);

      // --- Draw Backgrounds ---
      c.fillStyle = COLOR_BG;
      c.fillRect(0, 0, width, RULER_SIZE); // Top
      c.fillRect(0, 0, RULER_SIZE, height); // Left
      
      // Corner square
      c.fillStyle = '#09090b';
      c.fillRect(0, 0, RULER_SIZE, RULER_SIZE);
      c.strokeStyle = COLOR_TICK;
      c.strokeRect(0, 0, RULER_SIZE, RULER_SIZE);

      const drawRuler = (isVertical: boolean) => {
        const length = isVertical ? height : width;
        const scroll = isVertical ? offset.y : offset.x;
        
        // Dynamic step calculation based on zoom
        const baseStep = 100;
        let step = baseStep;
        if (zoom > 2) step = 20;
        else if (zoom > 1) step = 50;
        else if (zoom < 0.2) step = 1000;
        else if (zoom < 0.5) step = 500;

        const startValue = Math.floor(-scroll / (zoom * step)) * step;
        const endValue = Math.ceil((length - scroll) / (zoom * step)) * step;

        c.beginPath();
        c.strokeStyle = COLOR_TICK;
        c.fillStyle = COLOR_TEXT;
        c.font = '9px Inter';
        c.textAlign = isVertical ? 'right' : 'left';
        c.textBaseline = 'middle';

        for (let v = startValue; v <= endValue; v += step) {
          const pos = v * zoom + scroll;
          if (pos < RULER_SIZE) continue;

          // Major tick and Label
          if (isVertical) {
            c.moveTo(RULER_SIZE - 8, pos);
            c.lineTo(RULER_SIZE, pos);
            c.save();
            c.translate(RULER_SIZE - 10, pos);
            c.rotate(-Math.PI / 2);
            c.fillText(v.toString(), 0, 0);
            c.restore();
          } else {
            c.moveTo(pos, RULER_SIZE - 8);
            c.lineTo(pos, RULER_SIZE);
            c.fillText(v.toString(), pos + 4, RULER_SIZE / 2);
          }

          // Minor ticks
          const minorStep = step / 5;
          for (let m = 1; m < 5; m++) {
            const mPos = (v + m * minorStep) * zoom + scroll;
            if (mPos < RULER_SIZE || mPos > length) continue;
            if (isVertical) {
              c.moveTo(RULER_SIZE - 4, mPos);
              c.lineTo(RULER_SIZE, mPos);
            } else {
              c.moveTo(mPos, RULER_SIZE - 4);
              c.lineTo(mPos, RULER_SIZE);
            }
          }
        }
        c.stroke();

        // --- Highlight Selected Objects ---
        if (selectedIds.length > 0) {
          c.fillStyle = 'rgba(99, 102, 241, 0.15)';
          selectedIds.forEach(id => {
            const s = shapes.find(shape => shape.id === id);
            if (!s) return;
            // Simple AABB for ruler highlight (ignoring complex rotation for ruler simplicity)
            const min = isVertical ? s.y : s.x;
            const size = isVertical ? s.height : s.width;
            const p1 = min * zoom + scroll;
            const p2 = (min + size) * zoom + scroll;
            
            if (isVertical) c.fillRect(0, p1, RULER_SIZE, p2 - p1);
            else c.fillRect(p1, 0, p2 - p1, RULER_SIZE);
          });
        }

        // --- Mouse Pointer Indicator ---
        const mPos = (isVertical ? mousePos.y : mousePos.x) * zoom + scroll;
        if (mPos >= RULER_SIZE) {
          c.beginPath();
          c.strokeStyle = COLOR_ACCENT;
          c.lineWidth = 1;
          if (isVertical) {
            c.moveTo(0, mPos);
            c.lineTo(RULER_SIZE, mPos);
          } else {
            c.moveTo(mPos, 0);
            c.lineTo(mPos, RULER_SIZE);
          }
          c.stroke();
        }
      };

      drawRuler(false); // Top
      drawRuler(true);  // Left

      // Border lines
      c.strokeStyle = COLOR_TICK;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(0, RULER_SIZE);
      c.lineTo(width, RULER_SIZE);
      c.moveTo(RULER_SIZE, 0);
      c.lineTo(RULER_SIZE, height);
      c.stroke();

      c.restore();
    }
  };
};
