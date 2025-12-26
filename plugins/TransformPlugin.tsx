
import { useState } from 'react';
import { CanvasPlugin, Shape, PluginContext, CanvasEvent } from '../types';

type DragMode = 'move' | 'resize' | 'rotate' | null;
type ResizeHandle = 'tl' | 'tr' | 'bl' | 'br' | 'tm' | 'bm' | 'ml' | 'mr';

interface DragSnapshot {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  children?: Shape[];
}

export const useTransformPlugin = (): CanvasPlugin => {
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null);
  const [dragSnapshots, setDragSnapshots] = useState<DragSnapshot[]>([]);
  const [startMouse, setStartMouse] = useState({ x: 0, y: 0 });
  const [fixedPoint, setFixedPoint] = useState({ x: 0, y: 0 });
  const [pivotPoint, setPivotPoint] = useState({ x: 0, y: 0 });
  
  const VISUAL_PADDING = 4;

  const getAABB = (s: Shape): { x: number, y: number, w: number, h: number } => {
    if (s.type === 'group' && s.children && s.children.length > 0) {
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
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  };

  const getMultiAABB = (shapes: Shape[], ids: string[]) => {
    const selected = shapes.filter(s => ids.includes(s.id));
    if (selected.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selected.forEach(s => {
      const b = getAABB(s);
      minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
    });
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  };

  const rotatePoint = (px: number, py: number, cx: number, cy: number, angle: number) => {
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const dx = px - cx, dy = py - cy;
    return { x: dx * cos - dy * sin + cx, y: dx * sin + dy * cos + cy };
  };

  const updateRecursive = (s: Shape, dx: number, dy: number): Shape => {
    const news = { ...s, x: s.x + dx, y: s.y + dy };
    if (news.children) news.children = news.children.map(c => updateRecursive(c, dx, dy));
    return news;
  };

  const rotateRecursive = (s: Shape, angle: number, pivot: {x:number, y:number}): Shape => {
    const oldCenter = { x: s.x + s.width / 2, y: s.y + s.height / 2 };
    const newCenter = rotatePoint(oldCenter.x, oldCenter.y, pivot.x, pivot.y, angle);
    const news = {
      ...s,
      rotation: s.rotation + angle,
      x: newCenter.x - s.width / 2,
      y: newCenter.y - s.height / 2
    };
    if (news.children) news.children = news.children.map(c => rotateRecursive(c, angle, pivot));
    return news;
  };

  const resizeRecursive = (s: Shape, scaleX: number, scaleY: number, fixed: {x:number, y:number}): Shape => {
    const oldCx = s.x + s.width / 2, oldCy = s.y + s.height / 2;
    const newCx = fixed.x + (oldCx - fixed.x) * scaleX;
    const newCy = fixed.y + (oldCy - fixed.y) * scaleY;
    const newW = s.width * Math.abs(scaleX);
    const newH = s.height * Math.abs(scaleY);
    
    const news = { ...s, x: newCx - newW / 2, y: newCy - newH / 2, width: newW, height: newH };
    if (news.children) news.children = news.children.map(c => resizeRecursive(c, scaleX, scaleY, fixed));
    return news;
  };

  return {
    name: 'transform',
    onMouseDown: (e, hit, ctx) => {
      const nativeEvent = e.nativeEvent as MouseEvent;
      if (ctx.state.editingId || (nativeEvent.button !== 0)) return;
      
      const { selectedIds, shapes, zoom } = ctx.state;
      const { x, y } = e;
      const p = VISUAL_PADDING / zoom;

      const rect = getMultiAABB(shapes, selectedIds);
      if (!rect) {
        if (hit) {
          ctx.setState(prev => ({ ...prev, selectedIds: [hit.id] }), false);
          e.stopPropagation();
        }
        return;
      }

      const pivot = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };

      // 1. 旋转
      const rotPos = { x: pivot.x, y: rect.y - p - 30 / zoom };
      if (Math.hypot(x - rotPos.x, y - rotPos.y) < 15 / zoom) {
        setDragMode('rotate');
        setStartMouse({ x, y });
        setPivotPoint(pivot);
        setDragSnapshots(shapes.filter(s => selectedIds.includes(s.id)));
        e.stopPropagation();
        return;
      }

      // 2. 缩放
      const handles: ResizeHandle[] = ['tl', 'tr', 'bl', 'br', 'tm', 'bm', 'ml', 'mr'];
      for (const h of handles) {
        let hx = 0, hy = 0, fx = 0, fy = 0;
        if (h.includes('l')) { hx = rect.x - p; fx = rect.x + rect.w; } 
        else if (h.includes('r')) { hx = rect.x + rect.w + p; fx = rect.x; } 
        else { hx = rect.x + rect.w / 2; fx = rect.x + rect.w / 2; }
        
        if (h.includes('t')) { hy = rect.y - p; fy = rect.y + rect.h; } 
        else if (h.includes('b')) { hy = rect.y + rect.h + p; fy = rect.y; } 
        else { hy = rect.y + rect.h / 2; fy = rect.y + rect.h / 2; }

        if (Math.hypot(x - hx, y - hy) < 15 / zoom) {
          setDragMode('resize');
          setActiveHandle(h);
          setStartMouse({ x, y });
          setFixedPoint({ x: fx, y: fy });
          setDragSnapshots(shapes.filter(s => selectedIds.includes(s.id)));
          e.stopPropagation();
          return;
        }
      }

      // 3. 移动
      if (hit && selectedIds.includes(hit.id)) {
        setDragMode('move');
        setStartMouse({ x, y });
        setDragSnapshots(shapes.filter(s => selectedIds.includes(s.id)));
        e.stopPropagation();
        return;
      }

      if (hit && !selectedIds.includes(hit.id)) {
        ctx.setState(prev => ({ 
          ...prev, 
          selectedIds: nativeEvent.shiftKey ? [...prev.selectedIds, hit.id] : [hit.id] 
        }), false);
        e.stopPropagation();
      } else if (!hit && !nativeEvent.shiftKey) {
        ctx.setState(prev => ({ ...prev, selectedIds: [] }), false);
      }
    },

    onMouseMove: (e, ctx) => {
      if (!dragMode || dragSnapshots.length === 0) return;
      const { x, y } = e;
      const dx = x - startMouse.x;
      const dy = y - startMouse.y;

      ctx.setState(prev => {
        let scaleX = 1, scaleY = 1, rotation = 0;

        if (dragMode === 'rotate') {
          rotation = Math.atan2(y - pivotPoint.y, x - pivotPoint.x) - Math.atan2(startMouse.y - pivotPoint.y, startMouse.x - pivotPoint.x);
        } else if (dragMode === 'resize') {
          const initialDistX = startMouse.x - fixedPoint.x || 1;
          const initialDistY = startMouse.y - fixedPoint.y || 1;
          scaleX = (x - fixedPoint.x) / initialDistX;
          scaleY = (y - fixedPoint.y) / initialDistY;
          if (activeHandle === 'tm' || activeHandle === 'bm') scaleX = 1;
          if (activeHandle === 'ml' || activeHandle === 'mr') scaleY = 1;
        }

        const newShapes = prev.shapes.map(s => {
          const snap = dragSnapshots.find(sn => sn.id === s.id);
          if (!snap) return s;

          if (dragMode === 'move') {
            return updateRecursive(snap as Shape, dx, dy);
          } else if (dragMode === 'rotate') {
            return rotateRecursive(snap as Shape, rotation, pivotPoint);
          } else if (dragMode === 'resize') {
            return resizeRecursive(snap as Shape, scaleX, scaleY, fixedPoint);
          }
          return s;
        });

        return { ...prev, shapes: newShapes };
      }, false);
    },

    onMouseUp: (e, ctx) => {
      if (dragMode) ctx.setState(prev => ({ ...prev }), true);
      setDragMode(null); setDragSnapshots([]); setActiveHandle(null);
    },

    onRenderForeground: (ctx) => {
      // 正在移动或旋转时隐藏参考框，减少干扰
      if (dragMode === 'move' || dragMode === 'rotate') return;

      const { selectedIds, shapes, zoom, offset, editingId } = ctx.state;
      if (selectedIds.length === 0 || editingId || !ctx.renderer) return;

      const rect = getMultiAABB(shapes, selectedIds);
      if (!rect) return;

      const c = ctx.renderer.ctx, z = zoom, p = VISUAL_PADDING / z;
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.translate(offset.x, offset.y);
      c.scale(z, z);

      c.strokeStyle = '#6366f1'; 
      c.lineWidth = 1.5 / z;
      
      const isTemporary = selectedIds.length > 1;
      const firstShape = shapes.find(s => s.id === selectedIds[0]);

      // 单个正式形状（非临时，非group）显示旋转后的框
      if (!isTemporary && firstShape && firstShape.type !== 'group') {
        const cx = firstShape.x + firstShape.width / 2, cy = firstShape.y + firstShape.height / 2;
        c.translate(cx, cy); c.rotate(firstShape.rotation); c.translate(-cx, -cy);
        if (firstShape.type !== 'line') c.strokeRect(firstShape.x - p, firstShape.y - p, firstShape.width + 2 * p, firstShape.height + 2 * p);
        else { c.beginPath(); c.moveTo(firstShape.x, cy); c.lineTo(firstShape.x + firstShape.width, cy); c.stroke(); }
        
        if (!dragMode) {
          const hs = 8 / z;
          c.fillStyle = '#fff';
          c.beginPath(); c.moveTo(cx, firstShape.y - p); c.lineTo(cx, firstShape.y - p - 30 / z); c.stroke();
          c.beginPath(); c.arc(cx, firstShape.y - p - 30 / z, 5 / z, 0, Math.PI * 2); c.fill(); c.stroke();
          ['tl', 'tr', 'bl', 'br', 'tm', 'bm', 'ml', 'mr'].forEach(h => {
            let hx = 0, hy = 0;
            if (h.includes('l')) hx = firstShape.x - p; else if (h.includes('r')) hx = firstShape.x + firstShape.width + p; else hx = cx;
            if (h.includes('t')) hy = firstShape.y - p; else if (h.includes('b')) hy = firstShape.y + firstShape.height + p; else hy = cy;
            c.fillRect(hx - hs / 2, hy - hs / 2, hs, hs); c.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
          });
        }
        c.restore();
        return;
      }

      // 临时组合（框选）或 Group 形状显示 AABB 虚线框
      c.setLineDash([5 / z, 3 / z]);
      c.strokeRect(rect.x - p, rect.y - p, rect.w + 2 * p, rect.h + 2 * p);
      c.setLineDash([]);

      if (!dragMode) {
        const hs = 8 / z;
        c.fillStyle = '#fff';
        const rl = { x: rect.x + rect.w / 2, y: rect.y - p - 30 / z };
        c.beginPath(); c.moveTo(rl.x, rect.y - p); c.lineTo(rl.x, rl.y); c.stroke();
        c.beginPath(); c.arc(rl.x, rl.y, 5 / z, 0, Math.PI * 2); c.fill(); c.stroke();
        ['tl', 'tr', 'bl', 'br', 'tm', 'bm', 'ml', 'mr'].forEach(h => {
          let hx = 0, hy = 0;
          if (h.includes('l')) hx = rect.x - p; else if (h.includes('r')) hx = rect.x + rect.w + p; else hx = rect.x + rect.w / 2;
          if (h.includes('t')) hy = rect.y - p; else if (h.includes('b')) hy = rect.y + rect.h + p; else hy = rect.y + rect.h / 2;
          c.fillRect(hx - hs / 2, hy - hs / 2, hs, hs); c.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
        });
      }
      c.restore();
    }
  };
};
