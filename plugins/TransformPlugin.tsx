
import { useState } from 'react';
import { CanvasPlugin, Shape, PluginContext, CanvasEvent } from '../types';
import { TextShape } from '../models/UIShape';

type DragMode = 'move' | 'resize' | 'rotate' | null;
type ResizeHandle = 'tl' | 'tr' | 'bl' | 'br' | 'tm' | 'bm' | 'ml' | 'mr';

export const useTransformPlugin = (): CanvasPlugin => {
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null);
  const [dragInfo, setDragInfo] = useState<{
    startMouse: { x: number, y: number },
    startShape: Shape,
    fixedPoint: { x: number, y: number }
  } | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  
  const VISUAL_PADDING = 4;

  const rotatePoint = (px: number, py: number, cx: number, cy: number, angle: number) => {
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const dx = px - cx, dy = py - cy;
    return {
      x: dx * cos - dy * sin + cx,
      y: dx * sin + dy * cos + cy
    };
  };

  return {
    name: 'transform',
    onMouseDown: (e: CanvasEvent, hit, ctx) => {
      const nativeEvent = e.nativeEvent as MouseEvent;
      if (ctx.state.editingId || (nativeEvent.button !== 0)) return;
      
      const { x, y } = e;
      const zoom = ctx.state.zoom;
      const p = VISUAL_PADDING / zoom;

      if (ctx.state.selectedIds.length === 1) {
        const id = ctx.state.selectedIds[0];
        const shape = ctx.state.shapes.find(s => s.id === id);
        
        if (shape && shape.type !== 'group') {
          const isLine = shape.type === 'line';
          const cx = shape.x + shape.width / 2, cy = shape.y + shape.height / 2;

          // 1. 检查旋转手柄
          if (!isLine) {
            const rotPos = rotatePoint(cx, shape.y - p - 30 / zoom, cx, cy, shape.rotation);
            if (Math.hypot(x - rotPos.x, y - rotPos.y) < 15 / zoom) {
              setDragMode('rotate');
              setDraggedId(id);
              setDragInfo({ startMouse: { x, y }, startShape: { ...shape }, fixedPoint: { x: cx, y: cy } });
              e.stopPropagation();
              return;
            }
          }

          // 2. 检查缩放手柄
          const handles: ResizeHandle[] = isLine ? ['ml', 'mr'] : ['tl', 'tr', 'bl', 'br', 'tm', 'bm', 'ml', 'mr'];
          for (const h of handles) {
            let lx = 0, ly = 0, fx = 0, fy = 0;
            
            if (isLine) {
              lx = (h === 'ml') ? shape.x : shape.x + shape.width;
              fx = (h === 'ml') ? shape.x + shape.width : shape.x;
              ly = fy = cy;
            } else {
              // 计算手柄位置 (包含视觉 Padding)
              if (h.includes('l')) { lx = shape.x - p; }
              else if (h.includes('r')) { lx = shape.x + shape.width + p; }
              else { lx = cx; }

              if (h.includes('t')) { ly = shape.y - p; }
              else if (h.includes('b')) { ly = shape.y + shape.height + p; }
              else { ly = cy; }

              // 计算固定点 (不含视觉 Padding，解决缩放跳动的关键)
              if (h.includes('l')) fx = shape.x + shape.width;
              else if (h.includes('r')) fx = shape.x;
              else fx = cx;

              if (h.includes('t')) fy = shape.y + shape.height;
              else if (h.includes('b')) fy = shape.y;
              else fy = cy;
            }

            const hPos = rotatePoint(lx, ly, cx, cy, shape.rotation);
            if (Math.hypot(x - hPos.x, y - hPos.y) < 15 / zoom) {
              setDragMode('resize');
              setDraggedId(id);
              setActiveHandle(h);
              setDragInfo({
                startMouse: { x, y },
                startShape: { ...shape },
                fixedPoint: rotatePoint(fx, fy, cx, cy, shape.rotation)
              });
              e.stopPropagation();
              return;
            }
          }
        }
      }

      // 3. 检查是否点击了图形主体
      if (hit) {
        const isAlreadySelected = ctx.state.selectedIds.includes(hit.id);
        if (!isAlreadySelected) {
          ctx.setState(prev => ({ 
            ...prev, 
            selectedIds: nativeEvent.shiftKey ? [...prev.selectedIds, hit.id] : [hit.id] 
          }), false);
        }

        if (!nativeEvent.shiftKey) {
          setDragMode('move');
          setDraggedId(hit.id);
          const shape = ctx.state.shapes.find(s => s.id === hit.id);
          if (shape) {
            setDragInfo({ startMouse: { x, y }, startShape: { ...shape }, fixedPoint: { x: 0, y: 0 } });
          }
        }
        e.stopPropagation();
      }
    },

    onMouseMove: (e, ctx) => {
      if (!dragMode || !draggedId || !dragInfo) return;
      const { x, y } = e;
      const { startMouse, startShape, fixedPoint } = dragInfo;

      ctx.setState(prev => {
        const updateList = (list: Shape[]): Shape[] => {
          return list.map(s => {
            if (s.id !== draggedId) return s.children ? { ...s, children: updateList(s.children) } : s;

            const next = { ...s };
            if (dragMode === 'move') {
              next.x = startShape.x + (x - startMouse.x);
              next.y = startShape.y + (y - startMouse.y);
            } else if (dragMode === 'rotate') {
              next.rotation = Math.atan2(y - fixedPoint.y, x - fixedPoint.x) + Math.PI / 2;
            } else if (dragMode === 'resize' && activeHandle) {
              if (next.type === 'line') {
                const dist = Math.hypot(x - fixedPoint.x, y - fixedPoint.y);
                next.width = Math.max(1, dist);
                next.rotation = (activeHandle === 'mr') 
                  ? Math.atan2(y - fixedPoint.y, x - fixedPoint.x)
                  : Math.atan2(fixedPoint.y - y, fixedPoint.x - x);
                const midX = (x + fixedPoint.x) / 2, midY = (y + fixedPoint.y) / 2;
                next.x = midX - next.width / 2; next.y = midY - next.height / 2;
              } else {
                const cos = Math.cos(-startShape.rotation), sin = Math.sin(-startShape.rotation);
                const lMouse = {
                  x: (x - fixedPoint.x) * cos - (y - fixedPoint.y) * sin,
                  y: (x - fixedPoint.x) * sin + (y - fixedPoint.y) * cos
                };
                
                let nw = Math.abs(lMouse.x);
                let nh = Math.abs(lMouse.y);
                
                if (activeHandle === 'tm' || activeHandle === 'bm') nw = startShape.width;
                if (activeHandle === 'ml' || activeHandle === 'mr') nh = startShape.height;
                
                nw = Math.max(5, nw); nh = Math.max(5, nh);
                if (s.type === 'circle') nw = nh = Math.max(nw, nh);
                if (s.type === 'text') nh = TextShape.measureHeight(s.text || '', nw, s.fontSize || 16);

                next.width = nw; next.height = nh;
                
                let lC = { x: 0, y: 0 };
                // 计算新的中心点在局部坐标系中的位置 (相对于 fixedPoint)
                if (activeHandle.includes('r')) lC.x = nw / 2; else if (activeHandle.includes('l')) lC.x = -nw / 2;
                if (activeHandle.includes('b')) lC.y = nh / 2; else if (activeHandle.includes('t')) lC.y = -nh / 2;
                
                // 考虑镜像拉伸 (当鼠标越过 fixedPoint 时)
                if (lMouse.x < 0 && activeHandle.includes('r')) lC.x = -nw / 2;
                if (lMouse.x > 0 && activeHandle.includes('l')) lC.x = nw / 2;
                if (lMouse.y < 0 && activeHandle.includes('b')) lC.y = -nh / 2;
                if (lMouse.y > 0 && activeHandle.includes('t')) lC.y = nh / 2;

                const rcos = Math.cos(startShape.rotation), rsin = Math.sin(startShape.rotation);
                const nCx = lC.x * rcos - lC.y * rsin + fixedPoint.x;
                const nCy = lC.x * rsin + lC.y * rcos + fixedPoint.y;
                next.x = nCx - nw / 2; next.y = nCy - nh / 2;
              }
            }
            return next;
          });
        };
        return { ...prev, shapes: updateList(prev.shapes) };
      }, false);
    },

    onMouseUp: (e, ctx) => {
      if (dragMode) ctx.setState(prev => ({ ...prev }), true);
      setDragMode(null); setDraggedId(null); setActiveHandle(null); setDragInfo(null);
    },

    onRenderForeground: (ctx) => {
      if (ctx.state.selectedIds.length !== 1 || ctx.state.editingId || !ctx.renderer) return;
      const id = ctx.state.selectedIds[0];
      const shape = ctx.state.shapes.find(s => s.id === id);
      if (!shape || shape.type === 'group') return;

      const c = ctx.renderer.ctx, z = ctx.state.zoom, p = VISUAL_PADDING / z;
      const cx = shape.x + shape.width / 2, cy = shape.y + shape.height / 2;
      const isLine = shape.type === 'line';

      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.translate(ctx.state.offset.x, ctx.state.offset.y);
      c.scale(z, z);
      c.translate(cx, cy); c.rotate(shape.rotation); c.translate(-cx, -cy);

      c.strokeStyle = '#6366f1'; c.lineWidth = 1 / z;
      if (!isLine) c.strokeRect(shape.x - p, shape.y - p, shape.width + 2 * p, shape.height + 2 * p);
      else {
        c.beginPath(); c.moveTo(shape.x, cy); c.lineTo(shape.x + shape.width, cy); c.stroke();
      }

      if (!dragMode) {
        const hs = 8 / z;
        const handles: ResizeHandle[] = isLine ? ['ml', 'mr'] : ['tl', 'tr', 'bl', 'br', 'tm', 'bm', 'ml', 'mr'];
        c.fillStyle = '#fff';
        if (!isLine) {
          c.beginPath(); c.moveTo(cx, shape.y - p); c.lineTo(cx, shape.y - p - 30 / z); c.stroke();
          c.beginPath(); c.arc(cx, shape.y - p - 30 / z, 5 / z, 0, Math.PI * 2); c.fill(); c.stroke();
        }
        handles.forEach(h => {
          let hx = 0, hy = 0;
          if (isLine) { hx = (h === 'ml') ? shape.x : shape.x + shape.width; hy = cy; }
          else {
            if (h.includes('l')) hx = shape.x - p; else if (h.includes('r')) hx = shape.x + shape.width + p; else hx = cx;
            if (h.includes('t')) hy = shape.y - p; else if (h.includes('b')) hy = shape.y + shape.height + p; else hy = cy;
          }
          c.fillRect(hx - hs / 2, hy - hs / 2, hs, hs); c.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
        });
      }
      c.restore();
    }
  };
};
