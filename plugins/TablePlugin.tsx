
import React, { useState } from 'react';
import { CanvasPlugin, PluginContext, TableData } from '../types';
import { TableShape } from '../models/TableShape';

export const useTablePlugin = (): CanvasPlugin => {
  const [selection, setSelection] = useState<{ r1: number, c1: number, r2: number, c2: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [activeCellEdit, setActiveCellEdit] = useState<{ r: number, c: number } | null>(null);

  const updateTableData = (ctx: PluginContext, id: string, updater: (data: TableData) => TableData, save: boolean = true) => {
    const shape = ctx.state.shapes.find(s => s.id === id);
    if (!shape || !shape.tableData) return;
    
    const dataCopy: TableData = JSON.parse(JSON.stringify(shape.tableData));
    const newData = updater(dataCopy);
    const newWidth = newData.cols.reduce((a, b) => a + b, 0);
    const newHeight = newData.rows.reduce((a, b) => a + b, 0);
    
    ctx.updateShape(id, { tableData: newData, width: newWidth, height: newHeight });
    ctx.setState(prev => ({ ...prev }), save);
  };

  return {
    name: 'table-plugin',
    priority: 110,

    onMouseDown: (e, hit, ctx) => {
      if (ctx.state.editingId && ctx.state.editingId === hit?.id) {
        if (e.internalHit?.type === 'cell') {
          const { r, c } = e.internalHit.metadata;
          if (activeCellEdit && (activeCellEdit.r !== r || activeCellEdit.c !== c)) {
            setActiveCellEdit(null);
            const table = ctx.scene.getShapes().find(s => s.id === ctx.state.editingId) as TableShape;
            if (table) table.activeCell = null;
          }
          setSelection({ r1: r, c1: c, r2: r, c2: c });
          setIsSelecting(true);
          e.consume();
          return true;
        }
      }
      return false;
    },

    onMouseMove: (e, ctx) => {
      if (isSelecting && ctx.state.editingId && e.internalHit?.type === 'cell') {
        const { r, c } = e.internalHit.metadata;
        setSelection(prev => prev ? { ...prev, r2: r, c2: c } : { r1: r, c1: c, r2: r, c2: c });
        e.consume();
      }
    },

    onMouseUp: () => {
      setIsSelecting(false);
    },

    onDoubleClick: (e, hit, ctx) => {
      if (hit?.type === 'table') {
        if (e.internalHit?.type === 'cell') {
          const { r, c } = e.internalHit.metadata;
          if (ctx.state.editingId === hit.id) {
            const table = ctx.scene.getShapes().find(s => s.id === hit.id) as TableShape;
            if (table) {
              setActiveCellEdit({ r, c });
              table.activeCell = { r, c };
              setSelection({ r1: r, c1: c, r2: r, c2: c });
              e.consume();
            }
          } else {
            setSelection({ r1: r, c1: c, r2: r, c2: c });
          }
        }
      }
    },

    onRenderForeground: (ctx) => {
      const { editingId, zoom, offset } = ctx.state;
      if (!editingId || !selection) return;

      const shape = ctx.state.shapes.find(s => s.id === editingId);
      if (!shape || shape.type !== 'table' || !shape.tableData) return;

      const c = ctx.renderer?.ctx;
      if (!c) return;

      const dpr = window.devicePixelRatio || 1;
      c.save();
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.translate(offset.x, offset.y);
      c.scale(zoom, zoom);

      const tableCx = shape.x + shape.width / 2;
      const tableCy = shape.y + shape.height / 2;
      c.translate(tableCx, tableCy);
      c.rotate(shape.rotation);
      c.translate(-tableCx, -tableCy);

      const r1 = Math.min(selection.r1, selection.r2), r2 = Math.max(selection.r1, selection.r2);
      const c1 = Math.min(selection.c1, selection.c2), c2 = Math.max(selection.c1, selection.c2);

      const selX = shape.x + shape.tableData.cols.slice(0, c1).reduce((a, b) => a + b, 0);
      const selY = shape.y + shape.tableData.rows.slice(0, r1).reduce((a, b) => a + b, 0);
      const selW = shape.tableData.cols.slice(c1, c2 + 1).reduce((a, b) => a + b, 0);
      const selH = shape.tableData.rows.slice(r1, r2 + 1).reduce((a, b) => a + b, 0);

      c.fillStyle = 'rgba(79, 70, 229, 0.1)';
      c.strokeStyle = '#6366f1';
      c.lineWidth = 2 / zoom;
      c.fillRect(selX, selY, selW, selH);
      c.strokeRect(selX, selY, selW, selH);
      
      c.restore();
    },

    onRenderOverlay: (ctx) => {
      const { editingId, zoom, offset } = ctx.state;
      if (!editingId || !activeCellEdit) return null;

      const shape = ctx.state.shapes.find(s => s.id === editingId);
      if (!shape || shape.type !== 'table' || !shape.tableData) return null;

      const { r, c } = activeCellEdit;
      const tableData = shape.tableData;
      
      // 单元格在表格内部的逻辑位移（未缩放）
      const offX = tableData.cols.slice(0, c).reduce((a, b) => a + b, 0);
      const offY = tableData.rows.slice(0, r).reduce((a, b) => a + b, 0);
      const cellW = tableData.cols[c];
      const cellH = tableData.rows[r];
      const cellKey = `${r},${c}`;
      const cellData = tableData.cells[cellKey];

      // 父容器：定位在表格的世界坐标左上角，宽度高度同步
      const containerStyle: React.CSSProperties = {
        position: 'absolute',
        left: shape.x * zoom + offset.x,
        top: shape.y * zoom + offset.y,
        width: shape.width * zoom,
        height: shape.height * zoom,
        transform: `rotate(${shape.rotation}rad)`,
        transformOrigin: 'center center',
        pointerEvents: 'none',
        zIndex: 5000,
      };

      // 内部输入框：绝对定位于父容器内部
      const inputStyle: React.CSSProperties = {
        position: 'absolute',
        left: offX * zoom,
        top: offY * zoom,
        width: cellW * zoom,
        height: cellH * zoom,
        margin: 0,
        padding: '0 8px', 
        border: '2px solid #6366f1', 
        backgroundColor: '#ffffff',
        color: '#111827',
        fontSize: `${(shape.fontSize || 14) * zoom}px`,
        textAlign: cellData?.align || 'center',
        lineHeight: `${cellH * zoom}px`,
        resize: 'none',
        outline: 'none',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        fontFamily: 'Inter, sans-serif',
        boxSizing: 'border-box',
        caretColor: '#6366f1', 
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'center',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
      };

      return (
        <div style={containerStyle}>
          <textarea
            autoFocus
            style={inputStyle}
            value={cellData?.text || ''}
            onBlur={() => {
              const table = ctx.scene.getShapes().find(s => s.id === editingId) as TableShape;
              if (table) table.activeCell = null;
              setActiveCellEdit(null);
            }}
            onChange={e => updateTableData(ctx, editingId, data => {
              data.cells[cellKey] = { ...(data.cells[cellKey] || { text: '' }), text: e.target.value };
              return data;
            }, false)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); }
              if (e.key === 'Escape') { e.currentTarget.blur(); }
            }}
            onMouseDown={e => e.stopPropagation()}
          />
        </div>
      );
    }
  };
};
