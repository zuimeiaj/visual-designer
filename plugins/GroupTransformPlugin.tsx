
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
    const traverse = (list: Shape[], onlySelected: boolean) => {
      list.forEach(s => {
        const isSelected = selectedIds.includes(s.id);
        if (onlySelected) {
          if (isSelected) {
            result.push({ id: s.id, type: s.type, x: s.x, y: s.y, width: s.width, height: s.height, rotation: s.rotation });
            if (s.children) traverse(s.children, false);
          } else if (s.children) {
            traverse(s.children, true);
          }
        } else {
          result.push({ id: s.id, type: s.type, x: s.x, y: s.y, width: s.width, height: s.height, rotation: s.rotation });
          if (s.children) traverse(s.children, false);
        }
      });
    };
    traverse(shapes, true);
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
      // Access button from nativeEvent
      if ((e.nativeEvent as MouseEvent).button !== 0 || ctx.state.editingId) return false;

      const { selectedIds, shapes } = ctx.state;
      const isHitGroup = hit?.type === 'group';
      const isMultiSelection = selectedIds.length > 1;
      const isSelectedGroup = selectedIds.length === 1 && shapes.find(s => s.id === selectedIds[0])?.type === 'group';

      // Determine the target IDs for this interaction
      let targetIds = [...selectedIds];
      if (hit && !selectedIds.includes(hit.id)) {
        if (isHitGroup) {
          targetIds = [hit.id];
          // Update selection immediately for visual feedback
          ctx.setState(prev => ({ ...prev, selectedIds: [hit.id] }), false);
        } else if (isMultiSelection) {
           // If we click outside the current multi-selection, let standard selection handle it
           return false;
        }
      }

      // If we don't have a multi-selection or a group involved, defer to single transform
      const isGroupContext = targetIds.length > 1 || (targetIds.length === 1 && shapes.find(s => s.id === targetIds[0])?.type === 'group');
      if (!isGroupContext) return false;

      const { x, y } = ctx.getCanvasCoords(e.clientX, e.clientY);
      const zoom = ctx.state.zoom;
      const rect = getMultiAABB(shapes, targetIds);
      if (!rect) return false;

      const p = VISUAL_PADDING / zoom;
      const pivot = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
      
      const prepareDrag = (mode: DragMode, handle: ResizeHandle | null = null, fx: number = 0, fy: number = 0) => {
        setSnapshots(collectAllSnapshots(shapes, targetIds));
        setInitialRect(rect);
        setStartMouse({ x, y });
        setDragMode(mode);
        setActiveHandle(handle);
        setFixedPoint({ x: fx, y: fy });
        setPivotPoint(pivot);
      };

      // 1. Check Rotation Handle
      const rotPos = { x: pivot.x, y: rect.y - p - 30 / zoom };
      if (Math.hypot(x - rotPos.x, y - rotPos.y) < 12 / zoom) {
        prepareDrag('rotate');
        return true;
      }

      // 2. Check Resize Handles
      const handles: ResizeHandle[] = ['tl', 'tr', 'bl', 'br', 'tm', 'bm', 'ml', 'mr'];
      for (const h of handles) {
        let hx = 0, hy = 0, fx = 0, fy = 0;
        if (h.includes('l')) { hx = rect.x - p; fx = rect.x + rect.w; } 
        else if (h.includes('r')) { hx = rect.x + rect.w + p; fx = rect.x; } 
        else { hx = rect.x + rect.w / 2; fx = rect.x + rect.w / 2; }
        
        if (h.includes('t')) { hy = rect.y - p; fy = rect.y + rect.h; } 
        else if (h.includes('b')) { hy = rect.y + rect.h + p; fy = rect.y; } 
        else { hy = rect.y + rect.h / 2; fy = rect.y + rect.h / 2; }

        if (Math.hypot(x - hx, y - hy) < 12 / zoom) {
          prepareDrag('resize', h, fx, fy);
          return true;
        }
      }

      // 3. Handle Direct Move (Hit selected shape or group rect)
      const isInsideRect = x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
      if (isInsideRect && (hit || isGroupContext)) {
        prepareDrag('move');
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
        let nextSX = 1, nextSY = 1, nextAngle = 0;

        if (dragMode === 'rotate') {
          nextAngle = Math.atan2(y - pivotPoint.y, x - pivotPoint.x) - Math.atan2(startMouse.y - pivotPoint.y, startMouse.x - pivotPoint.x);
          setVisualRotation(nextAngle);
        } else if (dragMode === 'resize') {
          const initialDistX = startMouse.x - fixedPoint.x || 1;
          const initialDistY = startMouse.y - fixedPoint.y || 1;
          nextSX = (x - fixedPoint.x) / initialDistX;
          nextSY = (y - fixedPoint.y) / initialDistY;
          if (activeHandle === 'tm' || activeHandle === 'bm') nextSX = 1;
          if (activeHandle === 'ml' || activeHandle === 'mr') nextSY = 1;
          setVisualScale({ sx: nextSX, sy: nextSY });
        }

        const updateShapeRecursive = (shapes: Shape[]): Shape[] => {
          return shapes.map(s => {
            let nextS = { ...s };
            const snap = snapshots.find(sn => sn.id === s.id);
            
            if (snap) {
              if (dragMode === 'move') {
                nextS.x = snap.x + dx;
                nextS.y = snap.y + dy;
              } else if (dragMode === 'rotate') {
                const oldCenter = { x: snap.x + snap.width / 2, y: snap.y + snap.height / 2 };
                const newCenter = rotatePoint(oldCenter.x, oldCenter.y, pivotPoint.x, pivotPoint.y, nextAngle);
                nextS.rotation = snap.rotation + nextAngle;
                nextS.x = newCenter.x - snap.width / 2;
                nextS.y = newCenter.y - snap.height / 2;
              } else if (dragMode === 'resize') {
                const oldCenter = { x: snap.x + snap.width / 2, y: snap.y + snap.height / 2 };
                const nextCx = fixedPoint.x + (oldCenter.x - fixedPoint.x) * nextSX;
                const nextCy = fixedPoint.y + (oldCenter.y - fixedPoint.y) * nextSY;
                
                let scaleW = Math.abs(nextSX);
                let scaleH = Math.abs(nextSY);
                
                if (snap.type === 'circle') {
                  const uniformScale = Math.max(scaleW, scaleH);
                  scaleW = uniformScale;
                  scaleH = uniformScale;
                }

                nextS.width = snap.width * scaleW;
                nextS.height = snap.height * scaleH;
                nextS.x = nextCx - nextS.width / 2;
                nextS.y = nextCy - nextS.height / 2;
              }
            }

            if (nextS.children) {
              nextS.children = updateShapeRecursive(nextS.children);
            }
            return nextS;
          });
        };

        return { ...prev, shapes: updateShapeRecursive(prev.shapes) };
      }, false);
    },
    onMouseUp: (e, ctx) => {
      if (dragMode) {
        ctx.setState(prev => {
          const syncBoundsRecursive = (shapes: Shape[]): Shape[] => {
            return shapes.map(s => {
              let updatedS = { ...s };
              if (s.children) {
                updatedS.children = syncBoundsRecursive(s.children);
                if (s.type === 'group') {
                  const b = getAABB(updatedS);
                  updatedS.x = b.x;
                  updatedS.y = b.y;
                  updatedS.width = b.w;
                  updatedS.height = b.h;
                  updatedS.rotation = 0;
                }
              }
              return updatedS;
            });
          };
          return { ...prev, shapes: syncBoundsRecursive(prev.shapes) };
        }, true);
      }
      setDragMode(null); 
      setVisualRotation(0); 
      setVisualScale({ sx: 1, sy: 1 });
      setSnapshots([]);
      setInitialRect(null);
    },
    onRenderForeground: (ctx) => {
      const isMulti = ctx.state.selectedIds.length > 1;
      const firstShape = ctx.state.shapes.find(s => s.id === ctx.state.selectedIds[0]);
      const isSingleGroup = ctx.state.selectedIds.length === 1 && firstShape?.type === 'group';

      if ((!isMulti && !isSingleGroup) || ctx.state.editingId || !ctx.renderer) return;
      if (dragMode === 'move') return;

      const rect = (dragMode === 'rotate' || dragMode === 'resize') ? initialRect : getMultiAABB(ctx.state.shapes, ctx.state.selectedIds);
      if (!rect) return;

      const c = ctx.renderer.ctx, z = ctx.state.zoom, p = VISUAL_PADDING / z;
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0); 
      c.translate(ctx.state.offset.x, ctx.state.offset.y); 
      c.scale(z, z);
      
      if (dragMode === 'rotate' || dragMode === 'resize') {
        const cx = pivotPoint.x, cy = pivotPoint.y;
        if (dragMode === 'rotate') {
          c.translate(cx, cy); c.rotate(visualRotation); c.translate(-cx, -cy);
        } else if (dragMode === 'resize') {
          const fx = fixedPoint.x, fy = fixedPoint.y;
          c.translate(fx, fy); c.scale(visualScale.sx, visualScale.sy); c.translate(-fx, -fy);
        }
      }
      
      c.strokeStyle = '#6366f1'; 
      c.setLineDash([5, 5]); 
      c.lineWidth = 1.5 / z;
      c.strokeRect(rect.x - p, rect.y - p, rect.w + 2 * p, rect.h + 2 * p);
      c.setLineDash([]);
      
      if (!dragMode) {
        const hs = 8 / z; 
        const handles: ResizeHandle[] = ['tl', 'tr', 'bl', 'br', 'tm', 'bm', 'ml', 'mr'];
        c.fillStyle = '#fff';
        const rl = { x: rect.x + rect.w / 2, y: rect.y - p - 30 / z };
        c.beginPath(); c.moveTo(rect.x + rect.w / 2, rect.y - p); c.lineTo(rl.x, rl.y); c.stroke();
        c.beginPath(); c.arc(rl.x, rl.y, 5 / z, 0, 7); c.fill(); c.stroke();
        handles.forEach(h => {
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
