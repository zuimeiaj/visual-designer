
import { useState, useRef } from 'react';
import { CanvasPlugin, PluginContext, AnchorPort, Shape } from '../types';
import { PORT_OFFSET, ConnectionShape } from '../models/ConnectionShape';

export const useConnectionPlugin = (): CanvasPlugin => {
  const [activeSource, setActiveSource] = useState<{ id: string, port: AnchorPort } | null>(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const hoveredPort = useRef<{ id: string, port: AnchorPort } | null>(null);

  const getPortPos = (shape: Shape, port: AnchorPort, zoom: number) => {
    return ConnectionShape.getPointWithOffset(shape, port, PORT_OFFSET / zoom);
  };

  const getEdgePos = (shape: Shape, port: AnchorPort) => {
    return ConnectionShape.getPointWithOffset(shape, port, 0);
  };

  const findPortAt = (ctx: PluginContext, x: number, y: number) => {
    const threshold = 14 / ctx.state.zoom;
    const ports: AnchorPort[] = ['top', 'right', 'bottom', 'left'];

    for (let i = ctx.state.shapes.length - 1; i >= 0; i--) {
      const s = ctx.state.shapes[i];
      if (s.type === 'connection' || s.locked) continue;
      
      for (const p of ports) {
        const pos = getPortPos(s, p, ctx.state.zoom);
        if (Math.hypot(x - pos.x, y - pos.y) < threshold) {
          return { id: s.id, port: p };
        }
      }
    }
    return null;
  };

  const distToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
    const l2 = (x1 - x2) ** 2 + (y1 - y2) ** 2;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  };

  const getDistToConnection = (ctx: PluginContext, conn: Shape, mx: number, my: number) => {
    const points = ConnectionShape.getPathPoints(ctx.scene, conn, ctx.state.zoom);
    if (points.length < 2) return Infinity;

    let minD = Infinity;
    for (let i = 0; i < points.length - 1; i++) {
      const d = distToSegment(mx, my, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
      minD = Math.min(minD, d);
    }
    return minD;
  };

  return {
    name: 'connection-plugin',
    priority: 120,

    onMouseDown: (e, hit, ctx) => {
      const port = findPortAt(ctx, e.x, e.y);
      if (port) {
        setActiveSource(port);
        setDragPos({ x: e.x, y: e.y });
        ctx.setState(prev => ({ ...prev, interactionState: 'CONNECTING' }), false);
        e.consume();
        return true;
      }

      if (ctx.state.activeTool === 'connect') {
        const threshold = 12 / ctx.state.zoom;
        let bestConnId = null;
        let minDist = threshold;

        for (let i = ctx.state.shapes.length - 1; i >= 0; i--) {
          const s = ctx.state.shapes[i];
          if (s.type === 'connection') {
            const d = getDistToConnection(ctx, s, e.x, e.y);
            if (d < minDist) {
              minDist = d;
              bestConnId = s.id;
            }
          }
        }

        if (bestConnId) {
          ctx.setState(prev => ({ ...prev, selectedIds: [bestConnId] }), false);
          e.consume();
          return true;
        }
      }
      return false;
    },

    onMouseMove: (e, ctx) => {
      const port = findPortAt(ctx, e.x, e.y);
      hoveredPort.current = port;

      if (port) {
        ctx.setCursor('pointer');
      }

      if (activeSource) {
        setDragPos({ x: e.x, y: e.y });
        ctx.setCursor('crosshair');
        e.consume();
      }
    },

    onMouseUp: (e, ctx) => {
      if (activeSource) {
        const target = findPortAt(ctx, e.x, e.y);
        if (target && target.id !== activeSource.id) {
          const newConnection: Shape = {
            id: 'conn-' + Math.random().toString(36).substr(2, 9),
            type: 'connection',
            x: 0, y: 0, width: 0, height: 0, rotation: 0,
            fill: 'transparent',
            stroke: '#94a3b8',
            strokeWidth: 2,
            fromId: activeSource.id,
            toId: target.id,
            fromPort: activeSource.port,
            toPort: target.port
          };
          ctx.setState(prev => ({
            ...prev,
            shapes: [...prev.shapes, newConnection],
            interactionState: 'IDLE'
          }), true);
        } else {
            ctx.setState(prev => ({ ...prev, interactionState: 'IDLE' }), false);
        }
        setActiveSource(null);
        e.consume();
      }
    },

    onRenderForeground: (ctx) => {
      if (ctx.state.activeTool !== 'connect') return;

      const { zoom, offset, shapes } = ctx.state;
      const c = ctx.renderer?.ctx;
      if (!c) return;

      const dpr = window.devicePixelRatio || 1;
      c.save();
      c.setTransform(dpr, 0, 0, dpr, 0, 0); 
      c.translate(offset.x, offset.y);
      c.scale(zoom, zoom);

      if (activeSource) {
        const srcShape = shapes.find(s => s.id === activeSource.id);
        if (srcShape) {
          const start = getPortPos(srcShape, activeSource.port, zoom);
          c.beginPath();
          c.setLineDash([5 / zoom, 3 / zoom]);
          c.moveTo(start.x, start.y);
          c.lineTo(dragPos.x, dragPos.y);
          c.strokeStyle = '#6366f1';
          c.lineWidth = 2 / zoom;
          c.stroke();
          c.setLineDash([]);
        }
      }

      const dotSize = 4 / zoom;
      const ports: AnchorPort[] = ['top', 'right', 'bottom', 'left'];
      
      shapes.forEach(s => {
        if (s.type === 'connection' || s.locked) return;
        
        ports.forEach(p => {
          const pos = getPortPos(s, p, zoom);
          const edge = getEdgePos(s, p);
          const isHovered = hoveredPort.current?.id === s.id && hoveredPort.current?.port === p;
          const isActive = activeSource?.id === s.id && activeSource?.port === p;

          c.beginPath();
          c.setLineDash([2 / zoom, 2 / zoom]);
          c.moveTo(edge.x, edge.y);
          c.lineTo(pos.x, pos.y);
          c.strokeStyle = 'rgba(99, 102, 241, 0.4)';
          c.lineWidth = 1 / zoom;
          c.stroke();
          c.setLineDash([]);

          c.beginPath();
          c.arc(pos.x, pos.y, (isHovered || isActive) ? dotSize * 1.5 : dotSize, 0, Math.PI * 2);
          c.fillStyle = (isHovered || isActive) ? '#6366f1' : '#ffffff';
          c.strokeStyle = '#6366f1';
          c.lineWidth = 1.5 / zoom;
          c.fill();
          c.stroke();
        });
      });

      c.restore();
    }
  };
};
