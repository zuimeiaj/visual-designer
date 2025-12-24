
import { CanvasPlugin, PluginContext, Shape } from '../types';
import { useState } from 'react';

export const useSmartGuidesPlugin = (): CanvasPlugin => {
  const [isDragging, setIsDragging] = useState(false);
  
  const COLOR_GUIDE = '#818cf8'; // indigo-400
  const COLOR_TEXT = '#ffffff';
  const COLOR_LABEL_BG = '#4f46e5';
  const COLOR_TARGET_HIGHLIGHT = 'rgba(129, 140, 248, 0.15)'; // light indigo overlay

  return {
    name: 'smart-guides',
    onMouseDown: (e, hit) => {
      // Only trigger on left-click drag
      if (e.button === 0 && hit) {
        setIsDragging(true);
      }
      return false;
    },
    onMouseUp: () => {
      setIsDragging(false);
    },
    onRenderForeground: (ctx: PluginContext) => {
      const { state, renderer } = ctx;
      
      // Basic check: must be dragging a single shape
      if (!isDragging || state.selectedIds.length !== 1 || state.editingId || !renderer) return;

      const activeId = state.selectedIds[0];
      const activeShape = state.shapes.find(s => s.id === activeId);
      if (!activeShape) return;

      const c = renderer.ctx;
      const { zoom, offset, shapes } = state;

      const otherShapes = shapes.filter(s => s.id !== activeId);
      if (otherShapes.length === 0) return;

      const referencedShapeIds = new Set<string>();

      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.translate(offset.x, offset.y);
      c.scale(zoom, zoom);

      c.lineWidth = 1 / zoom;
      c.strokeStyle = COLOR_GUIDE;
      c.font = `${10 / zoom}px Inter`;
      c.textAlign = 'center';

      const a = {
        left: activeShape.x,
        right: activeShape.x + activeShape.width,
        top: activeShape.y,
        bottom: activeShape.y + activeShape.height,
      };

      otherShapes.forEach(s => {
        const b = {
          left: s.x,
          right: s.x + s.width,
          top: s.y,
          bottom: s.y + s.height,
        };

        const distThreshold = 800 / zoom;

        // Check relationship
        const overlapX = a.left < b.right && a.right > b.left;
        const overlapY = a.top < b.bottom && a.bottom > b.top;

        const isToTheLeft = a.right < b.left;
        const isToTheRight = a.left > b.right;
        const isAbove = a.bottom < b.top;
        const isBelow = a.top > b.bottom;

        c.setLineDash([4, 4]);

        // --- CASE 1: Vertical Alignment (Direct distance between horizontal edges) ---
        if (overlapX && (isAbove || isBelow)) {
          const vDist = isAbove ? b.top - a.bottom : a.top - b.bottom;
          if (vDist < distThreshold) {
            referencedShapeIds.add(s.id);
            // Anchor to the nearest shared horizontal range
            const lineX = (Math.max(a.left, b.left) + Math.min(a.right, b.right)) / 2;
            const startY = isAbove ? a.bottom : b.bottom;
            const endY = isAbove ? b.top : a.top;

            c.beginPath();
            c.moveTo(lineX, startY);
            c.lineTo(lineX, endY);
            c.stroke();

            drawLabel(c, lineX, (startY + endY) / 2, Math.round(vDist).toString(), zoom);
          }
        }

        // --- CASE 2: Horizontal Alignment (Direct distance between vertical edges) ---
        else if (overlapY && (isToTheLeft || isToTheRight)) {
          const hDist = isToTheLeft ? b.left - a.right : a.left - b.right;
          if (hDist < distThreshold) {
            referencedShapeIds.add(s.id);
            // Anchor to the nearest shared vertical range
            const lineY = (Math.max(a.top, b.top) + Math.min(a.bottom, b.bottom)) / 2;
            const startX = isToTheLeft ? a.right : b.right;
            const endX = isToTheLeft ? b.left : a.left;

            c.beginPath();
            c.moveTo(startX, lineY);
            c.lineTo(endX, lineY);
            c.stroke();

            drawLabel(c, (startX + endX) / 2, lineY, Math.round(hDist).toString(), zoom);
          }
        }

        // --- CASE 3: Corner offset (Projection Wall logic) ---
        // Strictly edge-based: No center points.
        else if ((isToTheLeft || isToTheRight) && (isAbove || isBelow)) {
          const targetX = isToTheLeft ? b.left : b.right;
          const originX = isToTheLeft ? a.right : a.left;
          const targetY = isAbove ? b.top : b.bottom;
          const originY = isAbove ? a.bottom : a.top;

          const hDist = Math.abs(targetX - originX);
          const vDist = Math.abs(targetY - originY);

          // Horizontal guide (Beam from A's vertical edge to B's vertical edge projection)
          if (hDist < distThreshold) {
            referencedShapeIds.add(s.id);
            // The beam anchors to A's nearest horizontal edge (originY)
            c.beginPath();
            // Wall on B's edge extending to A's edge height
            c.moveTo(targetX, targetY); 
            c.lineTo(targetX, originY);
            c.stroke();
            // Beam from A to Wall
            c.beginPath();
            c.moveTo(originX, originY);
            c.lineTo(targetX, originY);
            c.stroke();
            drawLabel(c, (originX + targetX) / 2, originY, Math.round(hDist).toString(), zoom);
          }

          // Vertical guide (Beam from A's horizontal edge to B's horizontal edge projection)
          if (vDist < distThreshold) {
            referencedShapeIds.add(s.id);
            // The beam anchors to A's nearest vertical edge (originX)
            c.beginPath();
            // Wall on B's edge extending to A's edge width
            c.moveTo(targetX, targetY);
            c.lineTo(originX, targetY);
            c.stroke();
            // Beam from A to Wall
            c.beginPath();
            c.moveTo(originX, originY);
            c.lineTo(originX, targetY);
            c.stroke();
            drawLabel(c, originX, (originY + targetY) / 2, Math.round(vDist).toString(), zoom);
          }
        }
      });

      // Render target highlights
      if (referencedShapeIds.size > 0) {
        c.setLineDash([]); 
        c.fillStyle = COLOR_TARGET_HIGHLIGHT;
        referencedShapeIds.forEach(id => {
          const target = shapes.find(s => s.id === id);
          if (target) {
            c.fillRect(target.x, target.y, target.width, target.height);
          }
        });
      }

      c.restore();
    }
  };
};

/**
 * Internal helper to draw a styled label on the canvas
 */
function drawLabel(c: CanvasRenderingContext2D, x: number, y: number, text: string, zoom: number) {
  const COLOR_TEXT = '#ffffff';
  const COLOR_LABEL_BG = '#4f46e5';

  c.save();
  c.setLineDash([]); 
  c.font = `${10 / zoom}px Inter`;
  const textWidth = c.measureText(text).width + 8 / zoom;
  const textHeight = 14 / zoom;

  c.fillStyle = COLOR_LABEL_BG;
  c.beginPath();
  c.roundRect(x - textWidth / 2, y - textHeight / 2, textWidth, textHeight, 2 / zoom);
  c.fill();

  c.fillStyle = COLOR_TEXT;
  c.textBaseline = 'middle';
  c.fillText(text, x, y);
  c.restore();
}
