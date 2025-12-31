
import { useState, useCallback, useRef } from 'react';
import { CanvasPlugin, PluginContext, Shape, ShapeType, CurvePoint } from '../types';

type HandleType = 'anchor' | 'handleIn' | 'handleOut';

export const usePenPlugin = (): CanvasPlugin => {
  // --- 路径创建状态 ---
  const [currentCurvePoints, setCurrentCurvePoints] = useState<CurvePoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mousePos, setMousePos] = useState<{ x: number, y: number } | null>(null);
  const [isDraggingAnchor, setIsDraggingAnchor] = useState(false);
  const [isNearStart, setIsNearStart] = useState(false);

  // --- 路径编辑状态 ---
  const [draggingHandle, setDraggingHandle] = useState<{ index: number, type: HandleType } | null>(null);

  const finalizeCurveData = (points: CurvePoint[], closed: boolean = false) => {
    // Collect all coordinates including handles to calculate AABB
    const coords: { x: number, y: number }[] = [];
    points.forEach(p => {
      coords.push({ x: p.x, y: p.y });
      if (p.handleIn) coords.push({ x: p.x + p.handleIn.x, y: p.y + p.handleIn.y });
      if (p.handleOut) coords.push({ x: p.x + p.handleOut.x, y: p.y + p.handleOut.y });
    });

    const xs = coords.map(p => p.x);
    const ys = coords.map(p => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    const width = maxX - minX || 1;
    const height = maxY - minY || 1;

    // Convert to relative coordinates
    const relativePoints = points.map(p => ({
      ...p,
      x: p.x - minX,
      y: p.y - minY
    }));

    return { x: minX, y: minY, width, height, relativePoints };
  };

  const finishCurveCreation = useCallback((ctx: PluginContext, closed: boolean = false) => {
    if (currentCurvePoints.length < 2) {
      setCurrentCurvePoints([]);
      setIsDrawing(false);
      return;
    }

    const { x, y, width, height, relativePoints } = finalizeCurveData(currentCurvePoints, closed);

    const newCurve: Shape = {
      id: 'curve-' + Math.random().toString(36).substr(2, 9),
      type: 'curve' as ShapeType,
      x,
      y,
      width,
      height,
      rotation: 0,
      fill: closed ? '#818cf822' : 'transparent',
      stroke: '#818cf8',
      strokeWidth: 2,
      curvePoints: relativePoints,
      closed
    };

    ctx.setState(prev => ({
      ...prev,
      shapes: [...prev.shapes, newCurve],
      selectedIds: [newCurve.id],
      activeTool: 'select'
    }), true);

    setCurrentCurvePoints([]);
    setIsDrawing(false);
    setIsNearStart(false);
  }, [currentCurvePoints]);

  return {
    name: 'pen-plugin',

    onMouseDown: (e, hit, ctx) => {
      const { x, y } = e;
      const zoom = ctx.state.zoom;

      // --- Scene 1: Editing Existing Path Points ---
      if (ctx.state.editingId) {
        const shape = ctx.state.shapes.find(s => s.id === ctx.state.editingId);
        if (shape && shape.type === 'curve' && shape.curvePoints) {
          const threshold = 12 / zoom;
          for (let i = 0; i < shape.curvePoints.length; i++) {
            const p = shape.curvePoints[i];
            const ax = shape.x + p.x;
            const ay = shape.y + p.y;
            
            if (Math.hypot(x - ax, y - ay) < threshold) {
              setDraggingHandle({ index: i, type: 'anchor' });
              e.consume();
              return;
            }
            if (p.handleOut) {
              const hox = ax + p.handleOut.x;
              const hoy = ay + p.handleOut.y;
              if (Math.hypot(x - hox, y - hoy) < threshold) {
                setDraggingHandle({ index: i, type: 'handleOut' });
                e.consume();
                return;
              }
            }
            if (p.handleIn) {
              const hix = ax + p.handleIn.x;
              const hiy = ay + p.handleIn.y;
              if (Math.hypot(x - hix, y - hiy) < threshold) {
                setDraggingHandle({ index: i, type: 'handleIn' });
                e.consume();
                return;
              }
            }
          }
        }
      }

      // --- Scene 2: Creating New Path ---
      if (ctx.state.activeTool === 'curve' || ctx.state.activeTool === 'path') {
        // Check for closing path
        if (currentCurvePoints.length > 2) {
          const start = currentCurvePoints[0];
          const threshold = 12 / zoom;
          if (Math.hypot(x - start.x, y - start.y) < threshold) {
            finishCurveCreation(ctx, true);
            e.consume();
            return;
          }
        }

        const newPoint: CurvePoint = { x, y };
        setCurrentCurvePoints(prev => [...prev, newPoint]);
        setIsDrawing(true);
        setIsDraggingAnchor(true);
        e.consume();
      }
    },

    onMouseMove: (e, ctx) => {
      const { x, y } = e;
      const zoom = ctx.state.zoom;

      // --- Handle Point/Handle Dragging while Editing ---
      if (draggingHandle && ctx.state.editingId) {
        ctx.setState(prev => {
          const shapes = prev.shapes.map(s => {
            if (s.id !== prev.editingId || !s.curvePoints) return s;
            const newPoints = [...s.curvePoints];
            const p = { ...newPoints[draggingHandle.index] };

            if (draggingHandle.type === 'anchor') {
              const dx = x - (s.x + p.x);
              const dy = y - (s.y + p.y);
              p.x += dx;
              p.y += dy;
            } else if (draggingHandle.type === 'handleOut') {
              p.handleOut = { x: x - (s.x + p.x), y: y - (s.y + p.y) };
              p.handleIn = { x: -p.handleOut.x, y: -p.handleOut.y };
            } else if (draggingHandle.type === 'handleIn') {
              p.handleIn = { x: x - (s.x + p.x), y: y - (s.y + p.y) };
              p.handleOut = { x: -p.handleIn.x, y: -p.handleIn.y };
            }

            newPoints[draggingHandle.index] = p;
            
            const absPoints = newPoints.map(pt => ({
              ...pt,
              x: pt.x + s.x,
              y: pt.y + s.y
            }));
            const { x: nx, y: ny, width: nw, height: nh, relativePoints: nrp } = finalizeCurveData(absPoints, s.closed);

            return { ...s, x: nx, y: ny, width: nw, height: nh, curvePoints: nrp };
          });
          return { ...prev, shapes };
        }, false);
        return;
      }

      // --- Handle Handle Creation during New Path Placement ---
      if (isDraggingAnchor && isDrawing) {
        setCurrentCurvePoints(prev => {
          if (prev.length === 0) return prev;
          const lastIdx = prev.length - 1;
          const newPoints = [...prev];
          const last = { ...newPoints[lastIdx] };
          
          const hox = x - last.x;
          const hoy = y - last.y;
          last.handleOut = { x: hox, y: hoy };
          last.handleIn = { x: -hox, y: -hoy };
          
          newPoints[lastIdx] = last;
          return newPoints;
        });
      }

      // --- Handle New Path Cursor Preview & Start Point Snapping ---
      if ((ctx.state.activeTool === 'curve' || ctx.state.activeTool === 'path') && isDrawing) {
        setMousePos({ x, y });
        ctx.setCursor('crosshair');

        if (currentCurvePoints.length > 2) {
          const start = currentCurvePoints[0];
          const threshold = 12 / zoom;
          setIsNearStart(Math.hypot(x - start.x, y - start.y) < threshold);
        } else {
          setIsNearStart(false);
        }
      }
    },

    onMouseUp: () => {
      setDraggingHandle(null);
      setIsDraggingAnchor(false);
    },

    onDoubleClick: (e, hit, ctx) => {
      if ((ctx.state.activeTool === 'curve' || ctx.state.activeTool === 'path') && isDrawing) {
        finishCurveCreation(ctx, isNearStart);
        e.consume();
        return;
      }

      if (ctx.state.activeTool === 'select' && hit && hit.type === 'curve') {
        ctx.setState(prev => ({
          ...prev,
          editingId: hit.id,
          selectedIds: [hit.id]
        }), false);
        e.consume();
      }
    },

    onKeyDown: (e, ctx) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        if (ctx.state.editingId) {
          ctx.setState(prev => ({ ...prev, editingId: null }), true);
          return true;
        }
        if (isDrawing) {
          finishCurveCreation(ctx);
          return true;
        }
      }
      return false;
    },

    onRenderForeground: (ctx: PluginContext) => {
      const { zoom, offset, activeTool, editingId, shapes } = ctx.state;
      const c = ctx.renderer?.ctx;
      if (!c) return;

      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.translate(offset.x, offset.y);
      c.scale(zoom, zoom);

      // --- Draw Live Preview while Creating ---
      if ((activeTool === 'curve' || activeTool === 'path') && isDrawing && currentCurvePoints.length > 0) {
        c.beginPath();
        c.lineWidth = 2 / zoom;
        c.strokeStyle = '#818cf8';
        c.setLineDash([5 / zoom, 5 / zoom]);
        
        const start = currentCurvePoints[0];
        c.moveTo(start.x, start.y);
        
        for (let i = 1; i < currentCurvePoints.length; i++) {
          const p = currentCurvePoints[i];
          const prev = currentCurvePoints[i-1];
          const cp1 = prev.handleOut ? { x: prev.x + prev.handleOut.x, y: prev.y + prev.handleOut.y } : { x: prev.x, y: prev.y };
          const cp2 = p.handleIn ? { x: p.x + p.handleIn.x, y: p.y + p.handleIn.y } : { x: p.x, y: p.y };
          c.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p.x, p.y);
        }
        
        if (mousePos) {
          const last = currentCurvePoints[currentCurvePoints.length - 1];
          const targetX = isNearStart ? start.x : mousePos.x;
          const targetY = isNearStart ? start.y : mousePos.y;

          const cp1 = last.handleOut ? { x: last.x + last.handleOut.x, y: last.y + last.handleOut.y } : { x: last.x, y: last.y };
          const cp2 = isNearStart && start.handleIn ? { x: start.x + start.handleIn.x, y: start.y + start.handleIn.y } : { x: targetX, y: targetY };
          
          c.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, targetX, targetY);
        }
        
        c.stroke();
        c.setLineDash([]);

        // Draw Anchors and Control Handles
        const dotSize = 4 / zoom;
        currentCurvePoints.forEach((p, idx) => {
          const isFirst = idx === 0;
          c.fillStyle = (isFirst && isNearStart) ? '#818cf8' : '#ffffff';
          c.strokeStyle = '#818cf8';
          c.beginPath();
          c.arc(p.x, p.y, isFirst && isNearStart ? dotSize * 1.5 : dotSize, 0, Math.PI * 2);
          c.fill();
          c.stroke();
          
          if (p.handleOut) {
            c.beginPath();
            c.moveTo(p.x, p.y);
            c.lineTo(p.x + p.handleOut.x, p.y + p.handleOut.y);
            c.stroke();
            c.fillRect(p.x + p.handleOut.x - dotSize/2, p.y + p.handleOut.y - dotSize/2, dotSize, dotSize);
          }
          if (p.handleIn) {
            c.beginPath();
            c.moveTo(p.x, p.y);
            c.lineTo(p.x + p.handleIn.x, p.y + p.handleIn.y);
            c.stroke();
            c.fillRect(p.x + p.handleIn.x - dotSize/2, p.y + p.handleIn.y - dotSize/2, dotSize, dotSize);
          }
        });
      }

      // --- Draw Handles when Editing ---
      if (editingId) {
        const shape = shapes.find(s => s.id === editingId);
        if (shape && shape.type === 'curve' && shape.curvePoints) {
          const dotSize = 5 / zoom;
          c.lineWidth = 1.5 / zoom;
          
          shape.curvePoints.forEach((p, idx) => {
            const ax = shape.x + p.x;
            const ay = shape.y + p.y;
            
            c.strokeStyle = '#6366f1';
            if (p.handleOut) {
              const hox = ax + p.handleOut.x;
              const hoy = ay + p.handleOut.y;
              c.beginPath(); c.moveTo(ax, ay); c.lineTo(hox, hoy); c.stroke();
              c.fillStyle = '#ffffff';
              c.fillRect(hox - dotSize/2, hoy - dotSize/2, dotSize, dotSize);
              c.strokeRect(hox - dotSize/2, hoy - dotSize/2, dotSize, dotSize);
            }
            if (p.handleIn) {
              const hix = ax + p.handleIn.x;
              const hiy = ay + p.handleIn.y;
              c.beginPath(); c.moveTo(ax, ay); c.lineTo(hix, hiy); c.stroke();
              c.fillStyle = '#ffffff';
              c.fillRect(hix - dotSize/2, hiy - dotSize/2, dotSize, dotSize);
              c.strokeRect(hix - dotSize/2, hiy - dotSize/2, dotSize, dotSize);
            }

            c.fillStyle = '#ffffff';
            c.beginPath();
            c.arc(ax, ay, dotSize, 0, Math.PI * 2);
            c.fill();
            c.stroke();
          });
        }
      }

      c.restore();
    }
  };
};
