
import React, { useState } from 'react';
import { CanvasPlugin, PluginContext, TableData } from '../types';
import { TableShape } from '../models/TableShape';

export const useTablePlugin = (): CanvasPlugin => {
  const [selection, setSelection] = useState<{ r1: number, c1: number, r2: number, c2: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [activeCellEdit, setActiveCellEdit] = useState<{ r: number, c: number } | null>(null);
  const [resizing, setResizing] = useState<{ type: 'row' | 'col', index: number, startSize: number, startPos: number } | null>(null);

  const updateTableData = (ctx: PluginContext, id: string, updater: (data: TableData) => TableData, save: boolean = true) => {
    const shape = ctx.state.shapes.find(s => s.id === id);
    if (!shape || !shape.tableData) return;
    const dataCopy: TableData = JSON.parse(JSON.stringify(shape.tableData));
    const newData = updater(dataCopy);
    ctx.updateShape(id, { 
      tableData: newData, 
      width: newData.cols.reduce((a, b) => a + b, 0), 
      height: newData.rows.reduce((a, b) => a + b, 0) 
    });
    ctx.setState(prev => ({ ...prev }), save);
  };

  return {
    name: 'table-plugin',
    priority: 110,

    onMouseDown: (e, hit, ctx) => {
      const hitData = e.internalHit;
      if (!hitData || (e.nativeEvent as MouseEvent).button === 2) return false;

      const isEditing = ctx.state.editingId === hitData.id;
      
      // Handle Resizing
      if (isEditing && (hitData.type === 'row-resize' || hitData.type === 'col-resize')) {
        const shape = ctx.state.shapes.find(s => s.id === hitData.id);
        if (shape && shape.tableData) {
          const index = hitData.metadata.index;
          const isCol = hitData.type === 'col-resize';
          setResizing({
            type: isCol ? 'col' : 'row',
            index,
            startSize: isCol ? shape.tableData.cols[index] : shape.tableData.rows[index],
            startPos: isCol ? e.x : e.y
          });
          e.consume();
          return true;
        }
      }

      // Handle Cell Selection
      if (isEditing && hitData.type === 'cell') {
        const { r, c } = hitData.metadata;
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
      return false;
    },

    onMouseMove: (e, ctx) => {
      if (resizing) {
        const delta = resizing.type === 'col' ? (e.x - resizing.startPos) : (e.y - resizing.startPos);
        const newSize = Math.max(20, resizing.startSize + delta);
        updateTableData(ctx, ctx.state.editingId || ctx.state.selectedIds[0], data => {
          if (resizing.type === 'col') data.cols[resizing.index] = newSize;
          else data.rows[resizing.index] = newSize;
          return data;
        }, false);
        ctx.setCursor(resizing.type === 'col' ? 'col-resize' : 'row-resize');
        e.consume();
        return;
      }
      
      const hitData = e.internalHit;
      if (isSelecting && ctx.state.editingId && hitData?.type === 'cell' && hitData.id === ctx.state.editingId) {
        const { r, c } = hitData.metadata;
        setSelection(prev => prev ? { ...prev, r2: r, c2: c } : { r1: r, c1: c, r2: r, c2: c });
        e.consume();
      }
    },

    onMouseUp: (e, ctx) => {
      if (resizing) { ctx.setState(prev => ({ ...prev }), true); setResizing(null); }
      setIsSelecting(false);
    },

    onDoubleClick: (e, hit, ctx) => {
      if (hit?.type === 'table') {
        const hitData = e.internalHit;
        if (hitData?.type === 'cell') {
          const { r, c } = hitData.metadata;
          
          if (ctx.state.editingId !== hit.id) {
            ctx.setState(prev => ({ 
              ...prev, 
              editingId: hit.id, 
              interactionState: 'EDITING',
              selectedIds: [hit.id] 
            }), false);
          }
          
          setActiveCellEdit({ r, c });
          setSelection({ r1: r, c1: c, r2: r, c2: c });
          const table = ctx.scene.getShapes().find(s => s.id === hit.id) as TableShape;
          if (table) table.activeCell = { r, c };
          
          e.consume();
        }
      }
    },

    onRenderForeground: (ctx) => {
      const { editingId, selectedIds, zoom, offset, shapes } = ctx.state;
      const targetId = editingId || (selectedIds.length === 1 ? selectedIds[0] : null);
      if (!targetId) return;
      const shape = shapes.find(s => s.id === targetId);
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
      c.rotate(shape.rotation || 0);
      c.translate(-tableCx, -tableCy);
      c.translate(shape.x, shape.y);

      if (selection) {
        const r1 = Math.min(selection.r1, selection.r2), c1 = Math.min(selection.c1, selection.c2);
        const r2 = Math.max(selection.r1, selection.r2), c2 = Math.max(selection.c1, selection.c2);
        const selX = shape.tableData.cols.slice(0, c1).reduce((a, b) => a + b, 0);
        const selY = shape.tableData.rows.slice(0, r1).reduce((a, b) => a + b, 0);
        const selW = shape.tableData.cols.slice(c1, c2 + 1).reduce((a, b) => a + b, 0);
        const selH = shape.tableData.rows.slice(r1, r2 + 1).reduce((a, b) => a + b, 0);
        c.fillStyle = 'rgba(99, 102, 241, 0.1)';
        c.strokeStyle = '#6366f1';
        c.lineWidth = 1.5 / zoom;
        c.fillRect(selX, selY, selW, selH);
        c.strokeRect(selX, selY, selW, selH);
      }
      c.restore();
    },

    onRenderOverlay: (ctx) => {
      const { editingId, zoom, offset, shapes } = ctx.state;
      if (!editingId || !activeCellEdit) return null;
      const shape = shapes.find(s => s.id === editingId);
      if (!shape || shape.type !== 'table' || !shape.tableData) return null;
      
      const { r, c } = activeCellEdit;
      const { rows, cols, cells } = shape.tableData;
      const cellData = cells[`${r},${c}`];
      const cellX = cols.slice(0, c).reduce((a, b) => a + b, 0);
      const cellY = rows.slice(0, r).reduce((a, b) => a + b, 0);

      const finishEditing = () => {
        setActiveCellEdit(null);
        const table = ctx.scene.getShapes().find(s => s.id === editingId) as TableShape;
        if (table) table.activeCell = null;
        ctx.setState(prev => ({ ...prev }), true);
      };

      return (
        <div style={{
          position: 'absolute',
          left: (shape.x * zoom + offset.x),
          top: (shape.y * zoom + offset.y),
          width: shape.width * zoom,
          height: shape.height * zoom,
          pointerEvents: 'none',
          transformOrigin: 'center center',
          transform: `rotate(${shape.rotation}rad)`,
          zIndex: 10001
        }}>
          <textarea
            autoFocus
            style={{
              position: 'absolute',
              left: cellX * zoom,
              top: cellY * zoom,
              width: cols[c] * zoom,
              height: rows[r] * zoom,
              fontSize: (cellData?.fontSize || shape.fontSize || 14) * zoom,
              color: '#18181b',
              background: '#ffffff',
              border: '2px solid #6366f1',
              outline: 'none',
              margin: '0',
              padding: '4px',
              resize: 'none',
              overflow: 'hidden',
              whiteSpace: 'pre-wrap',
              fontFamily: 'Inter, sans-serif',
              lineHeight: 1.2,
              textAlign: cellData?.align || 'center',
              pointerEvents: 'auto',
              boxSizing: 'border-box'
            }}
            value={cellData?.text || ''}
            onBlur={finishEditing}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finishEditing(); }
              if (e.key === 'Escape') finishEditing();
            }}
            onChange={(e) => {
              updateTableData(ctx, editingId, data => {
                const key = `${r},${c}`;
                data.cells[key] = { ...data.cells[key], text: e.target.value };
                return data;
              }, false);
            }}
            onMouseDown={e => e.stopPropagation()}
          />
        </div>
      );
    }
  };
};
