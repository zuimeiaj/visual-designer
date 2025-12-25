
import { useState } from 'react';
import { CanvasPlugin, Shape } from '../types';
import { TextShape } from '../models/UIShape';

type DragMode = 'move' | 'resize' | 'rotate' | null;
type ResizeHandle = 'tl' | 'tr' | 'bl' | 'br' | 'tm' | 'bm' | 'ml' | 'mr';

export const useTransformPlugin = (): CanvasPlugin => {
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [fixedPoint, setFixedPoint] = useState({ x: 0, y: 0 });
  const [pivotPoint, setPivotPoint] = useState({ x: 0, y: 0 });
  const [visualRotation, setVisualRotation] = useState(0);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  
  // 用于物理吸附的累积残差，防止闪烁
  const [snapResidual, setSnapResidual] = useState({ x: 0, y: 0 });

  const VISUAL_PADDING = 4;
  const SNAP_THRESHOLD_PX = 5;
  const SNAP_RELEASE_PX = 8; // 脱离吸附所需的最小距离

  const getAABB = (s: Shape): { x: number, y: number, w: number, h: number } => {
    if (s.children && s.children.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      s.children.forEach(c => {
        const b = getAABB(c);
        minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
      });
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    const cx = s.x + s.width / 2, cy = s.y + s.height / 2;
    const cos = Math.cos(s.rotation), sin = Math.sin(s.rotation);
    const hw = s.width / 2, hh = s.height / 2;
    const corners = [{x:-hw,y:-hh},{x:hw,y:-hh},{x:hw,y:hh},{x:-hw,y:hh}].map(p => ({
      x: cx + p.x * cos - p.y * sin, y: cy + p.x * sin + p.y * cos
    }));
    const xs = corners.map(p => p.x), ys = corners.map(p => p.y);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
  };

  const getTopmostParentId = (shapes: Shape[], targetId: string): string => {
    const parent = shapes.find(s => s.children?.some(c => c.id === targetId));
    return parent ? getTopmostParentId(shapes, parent.id) : targetId;
  };

  const syncParentBounds = (shapes: Shape[], childId: string): Shape[] => {
    const parent = shapes.find(s => s.children?.some(c => c.id === childId));
    if (!parent) return shapes;
    const b = getAABB(parent);
    const updatedParent = { ...parent, x: b.x, y: b.y, width: b.w, height: b.h, rotation: 0 };
    return syncParentBounds(shapes.map(s => s.id === updatedParent.id ? updatedParent : s), updatedParent.id);
  };

  const findShapeInTree = (shapes: Shape[], id: string): Shape | undefined => {
    for (const s of shapes) {
      if (s.id === id) return s;
      if (s.children) {
        const f = findShapeInTree(s.children, id);
        if (f) return f;
      }
    }
    return undefined;
  };

  const updateInTree = (shapes: Shape[], id: string, data: Partial<Shape>): Shape[] => {
    return shapes.map(s => {
      if (s.id === id) return { ...s, ...data };
      if (s.children) return { ...s, children: updateInTree(s.children, id, data) };
      return s;
    });
  };

  return {
    name: 'transform',
    onMouseDown: (e, hit, ctx) => {
      if (ctx.state.editingId) return false;
      const { x, y } = ctx.getCanvasCoords(e.clientX, e.clientY);
      const zoom = ctx.state.zoom;

      setSnapResidual({ x: 0, y: 0 });

      if (ctx.state.selectedIds.length === 1) {
        const s = findShapeInTree(ctx.state.shapes, ctx.state.selectedIds[0]);
        if (s) {
          const pivot = { x: s.x + s.width / 2, y: s.y + s.height / 2 };
          const cos = Math.cos(s.rotation), sin = Math.sin(s.rotation);
          const rotPos = { x: s.x + s.width / 2, y: s.y - (VISUAL_PADDING / zoom) - 30 / zoom };
          const rotWorld = { 
            x: (rotPos.x - pivot.x) * cos - (rotPos.y - pivot.y) * sin + pivot.x, 
            y: (rotPos.x - pivot.x) * sin + (rotPos.y - pivot.y) * cos + pivot.y 
          };
          if (Math.hypot(x - rotWorld.x, y - rotWorld.y) < 12 / zoom) {
            setDragMode('rotate'); setPivotPoint(pivot); setVisualRotation(s.rotation);
            setDraggedId(s.id); setLastMouse({ x, y }); return true;
          }
          const handles: ResizeHandle[] = ['tl', 'tr', 'bl', 'br', 'tm', 'bm', 'ml', 'mr'];
          for (const h of handles) {
            let lx = 0, ly = 0;
            if (h.includes('l')) lx = s.x - VISUAL_PADDING / zoom; else if (h.includes('r')) lx = s.x + s.width + VISUAL_PADDING / zoom; else lx = s.x + s.width / 2;
            if (h.includes('t')) ly = s.y - VISUAL_PADDING / zoom; else if (h.includes('b')) ly = s.y + s.height + VISUAL_PADDING / zoom; else ly = s.y + s.height / 2;
            const hWorld = { 
              x: (lx - pivot.x) * cos - (ly - pivot.y) * sin + pivot.x, 
              y: (lx - pivot.x) * sin + (ly - pivot.y) * cos + pivot.y 
            };
            if (Math.hypot(x - hWorld.x, y - hWorld.y) < 12 / zoom) {
              setDragMode('resize'); setActiveHandle(h); setDraggedId(s.id);
              let ox = 0, oy = 0;
              if (h.includes('l')) ox = s.width; else if (h.includes('r')) ox = 0; else ox = s.width / 2;
              if (h.includes('t')) oy = s.height; else if (h.includes('b')) oy = 0; else oy = s.height / 2;
              setFixedPoint({ 
                x: (ox - s.width / 2) * cos - (oy - s.height / 2) * sin + pivot.x, 
                y: (ox - s.width / 2) * sin + (oy - s.height / 2) * cos + pivot.y 
              });
              setLastMouse({ x, y }); return true;
            }
          }
        }
      }

      const targetId = hit ? getTopmostParentId(ctx.state.shapes, hit.id) : null;
      if (targetId) {
        setDragMode('move');
        setDraggedId(targetId);
        setLastMouse({ x, y });
        return false; 
      }
      return false;
    },
    onMouseMove: (e, ctx) => {
      const { x, y } = ctx.getCanvasCoords(e.clientX, e.clientY);
      if (!dragMode || !draggedId) return;
      const zoom = ctx.state.zoom;
      const dx = x - lastMouse.x, dy = y - lastMouse.y;
      setLastMouse({ x, y });

      ctx.setState(prev => {
        const s = findShapeInTree(prev.shapes, draggedId);
        if (!s) return prev;
        let nextS = { ...s };

        if (dragMode === 'move') {
          let nx = s.x + dx;
          let ny = s.y + dy;

          const otherShapes = prev.shapes.filter(os => os.id !== draggedId && !prev.selectedIds.includes(os.id));
          const threshold = SNAP_THRESHOLD_PX / zoom;
          const releaseThreshold = SNAP_RELEASE_PX / zoom;
          
          const aPointsX = [nx, nx + s.width / 2, nx + s.width];
          const aPointsY = [ny, ny + s.height / 2, ny + s.height];

          let targetSnapX: number | null = null;
          let targetSnapY: number | null = null;

          for (const os of otherShapes) {
            const b = getAABB(os);
            const bPointsX = [b.x, b.x + b.w / 2, b.x + b.w];
            for (let i = 0; i < 3; i++) {
              for (const bp of bPointsX) {
                if (Math.abs(aPointsX[i] - bp) < threshold) {
                  targetSnapX = i === 0 ? bp : i === 1 ? bp - s.width / 2 : bp - s.width;
                  break;
                }
              }
              if (targetSnapX !== null) break;
            }
            if (targetSnapX !== null) break;
          }

          for (const os of otherShapes) {
            const b = getAABB(os);
            const bPointsY = [b.y, b.y + b.h / 2, b.y + b.h];
            for (let i = 0; i < 3; i++) {
              for (const bp of bPointsY) {
                if (Math.abs(aPointsY[i] - bp) < threshold) {
                  targetSnapY = i === 0 ? bp : i === 1 ? bp - s.height / 2 : bp - s.height;
                  break;
                }
              }
              if (targetSnapY !== null) break;
            }
            if (targetSnapY !== null) break;
          }

          let finalX = nx;
          let finalY = ny;
          let nextResidual = { x: 0, y: 0 };

          if (targetSnapX !== null) {
            finalX = targetSnapX;
            nextResidual.x = snapResidual.x + dx - (targetSnapX - s.x);
          }
          if (targetSnapY !== null) {
            finalY = targetSnapY;
            nextResidual.y = snapResidual.y + dy - (targetSnapY - s.y);
          }

          if (Math.abs(nextResidual.x) > releaseThreshold) nextResidual.x = 0;
          if (Math.abs(nextResidual.y) > releaseThreshold) nextResidual.y = 0;
          
          setSnapResidual(nextResidual);
          nextS = { ...s, x: finalX, y: finalY };
        } else if (dragMode === 'rotate') {
          const angle = Math.atan2(y - pivotPoint.y, x - pivotPoint.x) - Math.atan2(lastMouse.y - dy - pivotPoint.y, lastMouse.x - dx - pivotPoint.x);
          setVisualRotation(v => v + angle);
          const ncx = (s.x + s.width / 2 - pivotPoint.x) * Math.cos(angle) - (s.y + s.height / 2 - pivotPoint.y) * Math.sin(angle) + pivotPoint.x;
          const ncy = (s.x + s.width / 2 - pivotPoint.x) * Math.sin(angle) + (s.y + s.height / 2 - pivotPoint.y) * Math.cos(angle) + pivotPoint.y;
          nextS = { ...s, x: ncx - s.width / 2, y: ncy - s.height / 2, rotation: s.rotation + angle };
        } else if (dragMode === 'resize' && activeHandle) {
          const cos = Math.cos(-s.rotation), sin = Math.sin(-s.rotation);
          const localMouse = { x: (x - fixedPoint.x) * cos - (y - fixedPoint.y) * sin, y: (x - fixedPoint.x) * sin + (y - fixedPoint.y) * cos };
          let nw = Math.abs(localMouse.x), nh = Math.abs(localMouse.y);
          if (activeHandle === 'tm' || activeHandle === 'bm') nw = s.width;
          if (activeHandle === 'ml' || activeHandle === 'mr') nh = s.height;
          if (s.type === 'circle' && activeHandle.length === 2) { const sz = Math.max(nw, nh); nw = sz; nh = sz; }
          if (s.type === 'text') nh = TextShape.measureHeight(s.text || '', nw, s.fontSize || 16);
          let vcx = 0, vcy = 0;
          if (activeHandle.includes('l')) vcx = -nw / 2; else if (activeHandle.includes('r')) vcx = nw / 2;
          if (activeHandle.includes('t')) vcy = -nh / 2; else if (activeHandle.includes('b')) vcy = nh / 2;
          const rcos = Math.cos(s.rotation), rsin = Math.sin(s.rotation);
          nextS = { ...s, width: nw, height: nh, x: (vcx * rcos - vcy * rsin + fixedPoint.x) - nw/2, y: (vcx * rsin + vcy * rcos + fixedPoint.y) - nh/2 };
        }
        return { ...prev, shapes: syncParentBounds(updateInTree(prev.shapes, draggedId, nextS), draggedId) };
      }, false);
    },
    onMouseUp: (e, ctx) => {
      setDragMode(null); setActiveHandle(null); setDraggedId(null); setSnapResidual({x:0, y:0});
      ctx.setState(prev => prev, true);
    },
    onRenderForeground: (ctx) => {
      const { state, renderer } = ctx;
      if (!renderer || state.selectedIds.length !== 1 || state.editingId) return;
      
      // 当处于移动模式时，不显示边框和控制柄，以保持画面简洁
      if (dragMode === 'move') return;

      const s = findShapeInTree(state.shapes, state.selectedIds[0]);
      if (!s) return;
      const c = renderer.ctx, z = state.zoom, p = VISUAL_PADDING / z;
      const cx = s.x + s.width / 2, cy = s.y + s.height / 2;
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0); c.translate(state.offset.x, state.offset.y); c.scale(z, z);
      c.translate(cx, cy); c.rotate(dragMode === 'rotate' ? visualRotation : s.rotation); c.translate(-cx, -cy);
      
      c.strokeStyle = '#6366f1'; c.lineWidth = 1.5 / z;
      c.strokeRect(s.x - p, s.y - p, s.width + 2 * p, s.height + 2 * p);
      
      if (!dragMode) {
        const hs = 8 / z;
        c.fillStyle = '#fff';
        const rl = { x: s.x + s.width / 2, y: s.y - p - 30 / z };
        c.beginPath(); c.moveTo(s.x + s.width / 2, s.y - p); c.lineTo(rl.x, rl.y); c.stroke();
        c.beginPath(); c.arc(rl.x, rl.y, 5 / z, 0, 7); c.fill(); c.stroke();
        ['tl', 'tr', 'bl', 'br', 'tm', 'bm', 'ml', 'mr'].forEach(h => {
          let hx = 0, hy = 0;
          if (h.includes('l')) hx = s.x - p; else if (h.includes('r')) hx = s.x + s.width + p; else hx = s.x + s.width / 2;
          if (h.includes('t')) hy = s.y - p; else if (h.includes('b')) hy = s.y + s.height + p; else hy = s.y + s.height / 2;
          c.fillRect(hx - hs / 2, hy - hs / 2, hs, hs); c.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
        });
      }
      c.restore();
    }
  };
};
