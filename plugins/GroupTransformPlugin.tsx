
import { useState } from 'react';
import { CanvasPlugin, Shape, PluginContext } from '../types';

type DragMode = 'move' | 'resize' | 'rotate' | null;
type ResizeHandle = 'tl' | 'tr' | 'bl' | 'br' | 'tm' | 'bm' | 'ml' | 'mr';

interface ShapeSnapshot {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  points?: { x: number, y: number }[];
}

export const useGroupTransformPlugin = (): CanvasPlugin => {
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null);
  const [startMouse, setStartMouse] = useState({ x: 0, y: 0 });
  const [fixedPoint, setFixedPoint] = useState({ x: 0, y: 0 });
  const [pivotPoint, setPivotPoint] = useState({ x: 0, y: 0 });
  const [visualRotation, setVisualRotation] = useState(0);
  const [visualScale, setVisualScale] = useState({ sx: 1, sy: 1 });
  
  const [snapshots, setSnapshots] = useState<ShapeSnapshot[]>([]);
  const [initialRect, setInitialRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);

  const VISUAL_PADDING = 4;

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

  const collectAllSnapshots = (shapes: Shape[], selectedIds: string[]): ShapeSnapshot[] => {
    let result: ShapeSnapshot[] = [];
    selectedIds.forEach(id => {
      const s = shapes.find(item => item.id === id);
      if (s) {
        result.push({ 
          id: s.id, 
          type: s.type, 
          x: s.x, 
          y: s.y, 
          width: s.width, 
          height: s.height, 
          rotation: s.rotation, 
          points: s.points ? [...s.points] : undefined 
        });
      }
    });
    return result;
  };

  const rotatePoint = (px: number, py: number, cx: number, cy: number, angle: number) => {
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const dx = px - cx, dy = py - cy;
    return {
      x: dx * cos - dy * sin + cx,
      y: dx * sin + dy * cos + cy
    };
  };

  return {
    name: 'group-transform',
    onMouseDown: (e, hit, ctx) => {
      if ((e.nativeEvent as MouseEvent).button !== 0 || ctx.state.editingId) return false;

      const { selectedIds, shapes } = ctx.state;
      const isMultiSelection = selectedIds.length > 1;
      const isSelectedGroup = selectedIds.length === 1 && shapes.find(s => s.id === selectedIds[0])?.type === 'group';

      if (!isMultiSelection && !isSelectedGroup) return false;

      const { x, y } = ctx.getCanvasCoords(e.clientX, e.clientY);
      const zoom = ctx.state.zoom;
      const rect = getMultiAABB(shapes, selectedIds);
      if (!rect) return false;

      const p = VISUAL_PADDING / zoom;
      const pivot = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
      
      const prepareDrag = (mode: DragMode, handle: ResizeHandle | null = null, fx: number = 0, fy: number = 0) => {
        setSnapshots(collectAllSnapshots(shapes, selectedIds));
        setInitialRect(rect);
        setStartMouse({ x, y });
        setDragMode(mode);
        setActiveHandle(handle);
        setFixedPoint({ x: fx, y: fy });
        setPivotPoint(pivot);
        setVisualRotation(0);
      };

      // 1. 检查旋转手柄 (必须在最上层)
      const rotPos = { x: pivot.x, y: rect.y - p - 30 / zoom };
      if (Math.hypot(x - rotPos.x, y - rotPos.y) < 15 / zoom) {
        prepareDrag('rotate');
        e.stopPropagation();
        return true;
      }

      // 2. 检查缩放手柄
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
          prepareDrag('resize', h, fx, fy);
          e.stopPropagation();
          return true;
        }
      }

      // 3. 检查是否点击了已选中的形状本身 (关键修复：不再判定矩形区域，而是判定点击目标)
      if (hit && selectedIds.includes(hit.id)) {
        prepareDrag('move');
        e.stopPropagation();
        return true;
      }

      return false;
    },
    onMouseMove: (e, ctx) => {
      const { x, y } = ctx.getCanvasCoords(e.clientX, e.clientY);
      if (!dragMode || !initialRect || snapshots.length === 0) return;

      const dx = x - startMouse.x;
      const dy = y - startMouse.y;

      ctx.setState(prev => {
        let currentRotation = 0;
        let scaleX = 1;
        let scaleY = 1;

        if (dragMode === 'rotate') {
          currentRotation = Math.atan2(y - pivotPoint.y, x - pivotPoint.x) - Math.atan2(startMouse.y - pivotPoint.y, startMouse.x - pivotPoint.x);
          setVisualRotation(currentRotation);
        } else if (dragMode === 'resize') {
          const initialDistX = startMouse.x - fixedPoint.x || 1;
          const initialDistY = startMouse.y - fixedPoint.y || 1;
          scaleX = (x - fixedPoint.x) / initialDistX;
          scaleY = (y - fixedPoint.y) / initialDistY;
          if (activeHandle === 'tm' || activeHandle === 'bm') scaleX = 1;
          if (activeHandle === 'ml' || activeHandle === 'mr') scaleY = 1;
          setVisualScale({ sx: scaleX, sy: scaleY });
        }

        const updateShapeList = (shapesList: Shape[]): Shape[] => {
          return shapesList.map(s => {
            const snap = snapshots.find(sn => sn.id === s.id);
            const uiShape = ctx.scene.getShapes().find(uis => uis.id === s.id);
            
            if (snap && uiShape) {
              if (dragMode === 'move') {
                return { ...s, x: snap.x + dx, y: snap.y + dy };
              } else if (dragMode === 'rotate') {
                const oldCenter = { x: snap.x + snap.width / 2, y: snap.y + snap.height / 2 };
                const newCenter = rotatePoint(oldCenter.x, oldCenter.y, pivotPoint.x, pivotPoint.y, currentRotation);
                return {
                  ...s,
                  rotation: snap.rotation + currentRotation,
                  x: newCenter.x - snap.width / 2,
                  y: newCenter.y - snap.height / 2
                };
              } else if (dragMode === 'resize') {
                const oldCenter = { x: snap.x + snap.width / 2, y: snap.y + snap.height / 2 };
                const nextCx = fixedPoint.x + (oldCenter.x - fixedPoint.x) * scaleX;
                const nextCy = fixedPoint.y + (oldCenter.y - fixedPoint.y) * scaleY;
                const absScaleX = Math.abs(scaleX);
                const absScaleY = Math.abs(scaleY);
                const updates = uiShape.transform({ 
                  width: snap.width * absScaleX, 
                  height: snap.height * absScaleY,
                  scaleX: absScaleX,
                  scaleY: absScaleY
                });
                const finalW = updates.width ?? (snap.width * absScaleX);
                const finalH = updates.height ?? (snap.height * absScaleY);
                return {
                  ...s,
                  ...updates,
                  width: finalW, height: finalH,
                  x: nextCx - finalW / 2, y: nextCy - finalH / 2
                };
              }
            }
            if (s.children) return { ...s, children: updateShapeList(s.children) };
            return s;
          });
        };

        return { ...prev, shapes: updateShapeList(prev.shapes) };
      }, false);
    },
    onMouseUp: (e, ctx) => {
      if (dragMode) ctx.setState(prev => ({ ...prev }), true);
      setDragMode(null); 
      setVisualRotation(0); 
      setVisualScale({ sx: 1, sy: 1 });
      setSnapshots([]);
      setInitialRect(null);
    },
    onRenderForeground: (ctx) => {
      const { selectedIds, shapes, zoom, offset, editingId } = ctx.state;
      // 1. 如果正在移动，或者未多选，直接退出渲染
      if (dragMode === 'move' || selectedIds.length <= 1 || editingId || !ctx.renderer) return;

      const rect = dragMode ? initialRect : getMultiAABB(shapes, selectedIds);
      if (!rect) return;

      const c = ctx.renderer.ctx, z = zoom, p = VISUAL_PADDING / z;
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0); 
      c.translate(offset.x, offset.y); 
      c.scale(z, z);
      
      if (dragMode === 'rotate') {
        c.translate(pivotPoint.x, pivotPoint.y);
        c.rotate(visualRotation);
        c.translate(-pivotPoint.x, -pivotPoint.y);
      } else if (dragMode === 'resize') {
        c.translate(fixedPoint.x, fixedPoint.y);
        c.scale(visualScale.sx, visualScale.sy);
        c.translate(-fixedPoint.x, -fixedPoint.y);
      }
      
      c.strokeStyle = '#6366f1'; 
      c.setLineDash([5 / z, 3 / z]); 
      c.lineWidth = 1.5 / z;
      c.strokeRect(rect.x - p, rect.y - p, rect.w + 2 * p, rect.h + 2 * p);
      c.setLineDash([]);
      
      if (!dragMode) {
        const hs = 8 / z; 
        const handles: ResizeHandle[] = ['tl', 'tr', 'bl', 'br', 'tm', 'bm', 'ml', 'mr'];
        c.fillStyle = '#fff';
        c.strokeStyle = '#6366f1';
        
        const rl = { x: rect.x + rect.w / 2, y: rect.y - p - 30 / z };
        c.beginPath(); 
        c.moveTo(rect.x + rect.w / 2, rect.y - p); 
        c.lineTo(rl.x, rl.y); 
        c.stroke();
        
        c.beginPath(); 
        c.arc(rl.x, rl.y, 5 / z, 0, Math.PI * 2); 
        c.fill(); 
        c.stroke();

        handles.forEach(h => {
          let hx = 0, hy = 0;
          if (h.includes('l')) hx = rect.x - p; else if (h.includes('r')) hx = rect.x + rect.w + p; else hx = rect.x + rect.w / 2;
          if (h.includes('t')) hy = rect.y - p; else if (h.includes('b')) hy = rect.y + rect.h + p; else hy = rect.y + rect.h / 2;
          c.fillRect(hx - hs / 2, hy - hs / 2, hs, hs); 
          c.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
        });
      }
      c.restore();
    }
  };
};
