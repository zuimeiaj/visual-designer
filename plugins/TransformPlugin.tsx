
import { useState, useRef, useEffect, useCallback } from 'react';
import { CanvasPlugin, Shape, PluginContext, TransformType } from '../types';
import { UIShape } from '../models/UIShape';

type ResizeHandle = 'tl' | 'tr' | 'bl' | 'br' | 'tm' | 'bm' | 'ml' | 'mr' | 'p1' | 'p2';

interface ShapeSnapshot extends Shape {}

export const useTransformPlugin = (): CanvasPlugin => {
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null);
  const [transformType, setTransformType] = useState<TransformType | null>(null);
  const [snapshots, setSnapshots] = useState<Map<string, ShapeSnapshot>>(new Map());
  const [fixedPoint, setFixedPoint] = useState({ x: 0, y: 0 });
  const [pivotPoint, setPivotPoint] = useState({ x: 0, y: 0 });
  const [startMouse, setStartMouse] = useState({ x: 0, y: 0 });
  const [initialLocalDist, setInitialLocalDist] = useState({ x: 0, y: 0 });
  
  const lastScreenPos = useRef<{ x: number, y: number } | null>(null);
  const isShiftPressed = useRef(false);
  const ctxRef = useRef<PluginContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const EDGE_THRESHOLD = 50; 
  const MAX_SCROLL_SPEED = 12;
  const VISUAL_PADDING = 0; // 改为 0，让选择框紧贴物体
  const HIT_THRESHOLD = 20; // 增大点击判定范围，因为手柄不可见了

  const collectSnapshots = (shapes: Shape[], targetIds: string[], recursive = false, map = new Map<string, ShapeSnapshot>()) => {
    shapes.forEach(s => {
      const isTarget = targetIds.includes(s.id);
      if (isTarget || recursive) {
        map.set(s.id, JSON.parse(JSON.stringify(s)));
        if (s.children) collectSnapshots(s.children, [], true, map);
      } else if (s.children) {
        collectSnapshots(s.children, targetIds, false, map);
      }
    });
    return map;
  };

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

  const toLocalVector = (dx: number, dy: number, rotation: number) => {
    const cos = Math.cos(-rotation), sin = Math.sin(-rotation);
    return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
  };

  const getLinePoints = (shape: Shape) => {
    const cx = shape.x + shape.width / 2, cy = shape.y + shape.height / 2;
    const p1 = rotatePoint(shape.x, cy, cx, cy, shape.rotation);
    const p2 = rotatePoint(shape.x + shape.width, cy, cx, cy, shape.rotation);
    return { p1, p2 };
  };

  const performUpdate = useCallback((worldX: number, worldY: number) => {
    const ctx = ctxRef.current;
    if (!ctx || ctx.state.interactionState !== 'TRANSFORMING' || snapshots.size === 0) return;
    const dx = worldX - startMouse.x;
    const dy = worldY - startMouse.y;
    ctx.setState(prev => {
      const isSingle = prev.selectedIds.length === 1;
      const mainId = isSingle ? prev.selectedIds[0] : null;
      const snapMain = mainId ? snapshots.get(mainId) : null;
      const baseRotation = snapMain ? snapMain.rotation : 0;
      let scaleX = 1, scaleY = 1, rotationDelta = 0;
      if (transformType === 'ROTATE') {
        rotationDelta = Math.atan2(worldY - pivotPoint.y, worldX - pivotPoint.x) - Math.atan2(startMouse.y - pivotPoint.y, startMouse.x - pivotPoint.x);
      } else if (transformType === 'RESIZE' && activeHandle && !activeHandle.startsWith('p')) {
        const currentLocalDist = toLocalVector(worldX - fixedPoint.x, worldY - fixedPoint.y, baseRotation);
        scaleX = initialLocalDist.x !== 0 ? currentLocalDist.x / initialLocalDist.x : 1;
        scaleY = initialLocalDist.y !== 0 ? currentLocalDist.y / initialLocalDist.y : 1;
        if (activeHandle === 'tm' || activeHandle === 'bm') scaleX = 1;
        if (activeHandle === 'ml' || activeHandle === 'mr') scaleY = 1;
        if (isShiftPressed.current && ['tl', 'tr', 'bl', 'br'].includes(activeHandle)) {
          const maxScale = Math.max(Math.abs(scaleX), Math.abs(scaleY));
          scaleX = maxScale * Math.sign(scaleX); scaleY = maxScale * Math.sign(scaleY);
        }
      }
      const updateRecursive = (list: Shape[]): Shape[] => {
        return list.map(s => {
          const snap = snapshots.get(s.id);
          if (!snap) return s.children ? { ...s, children: updateRecursive(s.children) } : s;
          let news = { ...s };
          if (transformType === 'MOVE') {
            news.x = snap.x + dx; news.y = snap.y + dy;
          } else if (transformType === 'ROTATE') {
            const snapCenter = { x: snap.x + snap.width / 2, y: snap.y + snap.height / 2 };
            const newCenter = rotatePoint(snapCenter.x, snapCenter.y, pivotPoint.x, pivotPoint.y, rotationDelta);
            news.rotation = snap.rotation + rotationDelta;
            news.x = newCenter.x - snap.width / 2; news.y = newCenter.y - snap.height / 2;
          } else if (transformType === 'RESIZE') {
            if (s.type === 'line' && activeHandle?.startsWith('p')) {
              const pFixed = fixedPoint; const pMoving = { x: worldX, y: worldY };
              const newLength = Math.max(1, Math.hypot(pMoving.x - pFixed.x, pMoving.y - pFixed.y));
              const newRotation = Math.atan2(pMoving.y - pFixed.y, pMoving.x - pFixed.x);
              const newCenter = { x: (pFixed.x + pMoving.x) / 2, y: (pFixed.y + pMoving.y) / 2 };
              news.width = newLength; news.rotation = activeHandle === 'p1' ? Math.atan2(pFixed.y - pMoving.y, pFixed.x - pMoving.x) : newRotation;
              news.x = newCenter.x - newLength / 2; news.y = newCenter.y - snap.height / 2;
            } else {
              const uiShape = UIShape.create(snap); const absSX = Math.abs(scaleX), absSY = Math.abs(scaleY);
              const updates = uiShape.transform({ width: snap.width * absSX, height: snap.height * absSY, scaleX: absSX, scaleY: absSY });
              const finalW = updates.width ?? (snap.width * absSX); const finalH = updates.height ?? (snap.height * absSY);
              const vOldLocal = toLocalVector((snap.x + snap.width/2) - fixedPoint.x, (snap.y + snap.height/2) - fixedPoint.y, baseRotation);
              const eSX = snap.width !== 0 ? (finalW / snap.width) * Math.sign(scaleX) : 1; const eSY = snap.height !== 0 ? (finalH / snap.height) * Math.sign(scaleY) : 1;
              const vNewLocal = { x: vOldLocal.x * eSX, y: vOldLocal.y * eSY };
              const cos = Math.cos(baseRotation), sin = Math.sin(baseRotation);
              news = { ...news, ...updates, x: fixedPoint.x + (vNewLocal.x * cos - vNewLocal.y * sin) - finalW / 2, y: fixedPoint.y + (vNewLocal.x * sin + vNewLocal.y * cos) - finalH / 2, width: finalW, height: finalH };
            }
          }
          if (s.children) news.children = updateRecursive(s.children);
          return news;
        });
      };
      return { ...prev, shapes: updateRecursive(prev.shapes) };
    }, false);
  }, [snapshots, transformType, startMouse, fixedPoint, pivotPoint, activeHandle, initialLocalDist]);

  useEffect(() => {
    const loop = () => {
      const ctx = ctxRef.current; const screenPos = lastScreenPos.current; const canvas = ctx?.canvas;
      if (!ctx || !screenPos || !canvas || ctx.state.interactionState !== 'TRANSFORMING' || !transformType) {
        rafRef.current = requestAnimationFrame(loop); return;
      }
      const rect = canvas.getBoundingClientRect();
      const mouseX = screenPos.x - rect.left; const mouseY = screenPos.y - rect.top;
      let scrollDX = 0, scrollDY = 0;
      if (mouseX < EDGE_THRESHOLD) scrollDX = Math.max(-MAX_SCROLL_SPEED, -((EDGE_THRESHOLD - mouseX) / EDGE_THRESHOLD) * MAX_SCROLL_SPEED);
      else if (mouseX > rect.width - EDGE_THRESHOLD) scrollDX = Math.min(MAX_SCROLL_SPEED, ((mouseX - (rect.width - EDGE_THRESHOLD)) / EDGE_THRESHOLD) * MAX_SCROLL_SPEED);
      if (mouseY < EDGE_THRESHOLD) scrollDY = Math.max(-MAX_SCROLL_SPEED, -((EDGE_THRESHOLD - mouseY) / EDGE_THRESHOLD) * MAX_SCROLL_SPEED);
      else if (mouseY > rect.height - EDGE_THRESHOLD) scrollDY = Math.min(MAX_SCROLL_SPEED, ((mouseY - (rect.height - EDGE_THRESHOLD)) / EDGE_THRESHOLD) * MAX_SCROLL_SPEED);
      if (scrollDX !== 0 || scrollDY !== 0) {
        ctx.setState(prev => {
          const newOffset = { x: prev.offset.x - scrollDX, y: prev.offset.y - scrollDY };
          const worldX = (screenPos.x - rect.left - newOffset.x) / prev.zoom;
          const worldY = (screenPos.y - rect.top - newOffset.y) / prev.zoom;
          performUpdate(worldX, worldY);
          return { ...prev, offset: newOffset };
        }, false);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [transformType, performUpdate]);

  const findHandleAt = (ctx: PluginContext, x: number, y: number) => {
    const { selectedIds, shapes, zoom } = ctx.state;
    if (selectedIds.length === 0) return null;
    const threshold = HIT_THRESHOLD / zoom;
    const isSingle = selectedIds.length === 1;
    const mainShape = shapes.find(s => s.id === selectedIds[0]);
    if (isSingle && mainShape?.type === 'line') {
      const { p1, p2 } = getLinePoints(mainShape);
      if (Math.hypot(x - p1.x, y - p1.y) < threshold) return { h: 'p1' as ResizeHandle };
      if (Math.hypot(x - p2.x, y - p2.y) < threshold) return { h: 'p2' as ResizeHandle };
      return null;
    }
    const rect = isSingle && mainShape ? null : getMultiAABB(shapes, selectedIds);
    if (!mainShape && !rect) return null;
    const p = VISUAL_PADDING / zoom, rotation = (isSingle && mainShape) ? mainShape.rotation : 0;
    const cos = Math.cos(rotation), sin = Math.sin(rotation);
    const cx = isSingle && mainShape ? mainShape.x + mainShape.width / 2 : (rect!.x + rect!.w / 2);
    const cy = isSingle && mainShape ? mainShape.y + mainShape.height / 2 : (rect!.y + rect!.h / 2);
    const sw = isSingle && mainShape ? mainShape.width : rect!.w, sh = isSingle && mainShape ? mainShape.height : rect!.h;
    
    // 旋转手柄位置：顶部正上方
    const rotPosWorld = isSingle ? { x: cx + (0)*cos - (-sh/2 - p - 32/zoom)*sin, y: cy + (0)*sin + (-sh/2 - p - 32/zoom)*cos } : { x: cx, y: (rect!.y) - p - 32 / zoom };
    if (Math.hypot(x - rotPosWorld.x, y - rotPosWorld.y) < threshold) return { h: 'rotate' };
    
    for (const h of ['tl', 'tr', 'bl', 'br', 'tm', 'bm', 'ml', 'mr'] as ResizeHandle[]) {
      let lx = 0, ly = 0;
      if (h.includes('l')) { lx = -sw / 2 - p; } else if (h.includes('r')) { lx = sw / 2 + p; }
      if (h.includes('t')) { ly = -sh / 2 - p; } else if (h.includes('b')) { ly = sh / 2 + p; }
      const hPosWorld = isSingle ? { x: cx + lx * cos - ly * sin, y: cy + lx * sin + ly * cos } : { x: cx + lx, y: cy + ly };
      if (Math.hypot(x - hPosWorld.x, y - hPosWorld.y) < threshold) return { h };
    }
    return null;
  };

  const getCursorForHandle = (handle: string) => {
    switch (handle) {
      case 'tl': case 'br': return 'nwse-resize';
      case 'tr': case 'bl': return 'nesw-resize';
      case 'tm': case 'bm': return 'ns-resize';
      case 'ml': case 'mr': return 'ew-resize';
      case 'rotate': return 'grab';
      case 'p1': case 'p2': return 'crosshair';
      default: return 'default';
    }
  };

  return {
    name: 'transform',
    priority: 50,

    onMouseDown: (e, hit, ctx) => {
      ctxRef.current = ctx;
      const handleData = findHandleAt(ctx, e.x, e.y);
      if (!handleData) return false;
      const { selectedIds, shapes } = ctx.state;
      const isSingle = selectedIds.length === 1;
      const mainShape = shapes.find(s => s.id === selectedIds[0]);
      if (handleData.h === 'rotate') {
        const cx = isSingle && mainShape ? mainShape.x + mainShape.width / 2 : (getMultiAABB(shapes, selectedIds)!.x + getMultiAABB(shapes, selectedIds)!.w / 2);
        const cy = isSingle && mainShape ? mainShape.y + mainShape.height / 2 : (getMultiAABB(shapes, selectedIds)!.y + getMultiAABB(shapes, selectedIds)!.h / 2);
        setTransformType('ROTATE'); setPivotPoint({ x: cx, y: cy }); setStartMouse({ x: e.x, y: e.y });
        setSnapshots(collectSnapshots(shapes, selectedIds));
        ctx.setState(prev => ({ ...prev, interactionState: 'TRANSFORMING', activeTransformType: 'ROTATE' }), false);
        e.consume(); return true;
      }
      if (handleData.h?.startsWith('p')) {
        const { p1, p2 } = getLinePoints(mainShape!); const fixed = handleData.h === 'p1' ? p2 : p1;
        setTransformType('RESIZE'); setActiveHandle(handleData.h as ResizeHandle); setFixedPoint(fixed);
        setSnapshots(collectSnapshots(shapes, selectedIds)); setStartMouse({ x: e.x, y: e.y });
        ctx.setState(prev => ({ ...prev, interactionState: 'TRANSFORMING', activeTransformType: 'RESIZE' }), false);
        e.consume(); return true;
      }
      const h = handleData.h as ResizeHandle; const rect = isSingle && mainShape ? null : getMultiAABB(shapes, selectedIds);
      const rotation = (isSingle && mainShape) ? mainShape.rotation : 0;
      const cos = Math.cos(rotation), sin = Math.sin(rotation);
      const cx = isSingle && mainShape ? mainShape.x + mainShape.width / 2 : (rect!.x + rect!.w / 2);
      const cy = isSingle && mainShape ? mainShape.y + mainShape.height / 2 : (rect!.y + rect!.h / 2);
      const sw = isSingle && mainShape ? mainShape.width : rect!.w, sh = isSingle && mainShape ? mainShape.height : rect!.h;
      let lfx = 0, lfy = 0;
      if (h.includes('l')) { lfx = sw / 2; } else if (h.includes('r')) { lfx = -sw / 2; }
      if (h.includes('t')) { lfy = sh / 2; } else if (h.includes('b')) { lfy = -sh / 2; }
      const fPosWorld = isSingle ? { x: cx + lfx * cos - lfy * sin, y: cy + lfx * sin + lfy * cos } : { x: cx + lfx, y: cy + lfy };
      setTransformType('RESIZE'); setActiveHandle(h); setFixedPoint(fPosWorld); setStartMouse({ x: e.x, y: e.y });
      setInitialLocalDist(toLocalVector(e.x - fPosWorld.x, e.y - fPosWorld.y, rotation));
      setSnapshots(collectSnapshots(shapes, selectedIds));
      ctx.setState(prev => ({ ...prev, interactionState: 'TRANSFORMING', activeTransformType: 'RESIZE' }), false);
      e.consume(); return true;
    },

    onTransformStart: (e, ctx) => {
      ctxRef.current = ctx; if (transformType) return; 
      setTransformType('MOVE'); setStartMouse({ x: e.x, y: e.y });
      setSnapshots(collectSnapshots(ctx.state.shapes, e.targetIds));
      ctx.setState(prev => ({ ...prev, activeTransformType: 'MOVE' }), false);
    },

    onTransformUpdate: (e, ctx) => {
      ctxRef.current = ctx; const me = e.nativeEvent as MouseEvent; isShiftPressed.current = me.shiftKey;
      performUpdate(e.x, e.y);
    },

    onTransformEnd: (e, ctx) => {
      ctxRef.current = ctx; setTransformType(null); setSnapshots(new Map()); setActiveHandle(null);
      isShiftPressed.current = false; ctx.setState(prev => ({ ...prev, activeTransformType: null }), true);
    },

    onMouseMove: (e, ctx) => {
      ctxRef.current = ctx; const me = e.nativeEvent as MouseEvent; lastScreenPos.current = { x: me.clientX, y: me.clientY };
      isShiftPressed.current = me.shiftKey;
      
      if (ctx.state.interactionState === 'IDLE') {
        const handleData = findHandleAt(ctx, e.x, e.y);
        if (handleData) {
          ctx.setCursor(getCursorForHandle(handleData.h as string));
        } else if (ctx.scene.hitTest(e.x, e.y)) {
          if (ctx.state.activeTool === 'select') {
            ctx.setCursor('move');
          }
        }
      } else if (ctx.state.interactionState === 'TRANSFORMING') {
        if (transformType === 'MOVE') ctx.setCursor('move');
        else if (transformType === 'ROTATE') ctx.setCursor('grabbing');
        else if (transformType === 'RESIZE' && activeHandle) ctx.setCursor(getCursorForHandle(activeHandle));
      }
    },

    onViewChange: (e, ctx) => {
      ctxRef.current = ctx; 
      if (ctx.state.interactionState === 'TRANSFORMING' && lastScreenPos.current && ctx.canvas) {
        const rect = ctx.canvas.getBoundingClientRect();
        const worldX = (lastScreenPos.current.x - rect.left - e.offset.x) / e.zoom;
        const worldY = (lastScreenPos.current.y - rect.top - e.offset.y) / e.zoom;
        performUpdate(worldX, worldY);
      }
    },

    onRenderForeground: (ctx) => {
      const { selectedIds, shapes, zoom, offset, editingId, interactionState } = ctx.state;
      if (selectedIds.length === 0 || editingId || !ctx.renderer) return;
      const dpr = window.devicePixelRatio || 1;
      const c = ctx.renderer.ctx, z = zoom;
      c.save(); 
      c.setTransform(dpr, 0, 0, dpr, 0, 0); 
      c.translate(offset.x, offset.y); c.scale(z, z);
      
      // 选择框样式：精简实线
      c.strokeStyle = '#6366f1'; 
      c.lineWidth = 1.2 / z;
      
      if (interactionState === 'TRANSFORMING' && transformType === 'MOVE') {
        c.setLineDash([5/z, 3/z]);
      }

      const isSingle = selectedIds.length === 1;
      const mainShape = isSingle ? shapes.find(s => s.id === selectedIds[0]) : null;
      
      if (isSingle && mainShape?.type === 'line') {
        const { p1, p2 } = getLinePoints(mainShape);
        c.setLineDash([4/z, 4/z]); c.beginPath(); c.moveTo(p1.x, p1.y); c.lineTo(p2.x, p2.y); c.stroke();
        c.restore(); return;
      }
      
      const rect = isSingle && mainShape ? null : getMultiAABB(shapes, selectedIds);
      if (!mainShape && !rect) { c.restore(); return; }

      if (isSingle && mainShape) {
        c.save(); 
        const cx = mainShape.x + mainShape.width / 2, cy = mainShape.y + mainShape.height / 2;
        c.translate(cx, cy); c.rotate(mainShape.rotation);
        
        // 绘制主选择框
        c.strokeRect(-mainShape.width / 2, -mainShape.height / 2, mainShape.width, mainShape.height);
        
        // 只在进行变换时显示辅助线（如旋转杆）
        if (interactionState === 'TRANSFORMING' && transformType === 'ROTATE') {
          c.beginPath(); 
          c.moveTo(0, -mainShape.height / 2); 
          c.lineTo(0, -mainShape.height / 2 - 32 / z); 
          c.stroke();
        }
        
        // 核心改进：此处不再绘制 TL, TR 等具体控制点，实现“隐形手柄”
        // 仅在 IDLE 状态下，如果鼠标靠近，可以考虑显示极细微的视觉引导，但根据用户要求“不显示”，此处留空。
        
        c.restore();
      } else if (rect) {
        // 多选框
        c.strokeRect(rect.x, rect.y, rect.w, rect.h);
        if (interactionState === 'TRANSFORMING' && transformType === 'ROTATE') {
          const rl = { x: rect.x + rect.w / 2, y: rect.y - 32 / z };
          c.beginPath(); c.moveTo(rect.x + rect.w / 2, rect.y); c.lineTo(rl.x, rl.y); c.stroke();
        }
      }
      c.restore();
    }
  };
};
