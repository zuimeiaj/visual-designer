
import React, { useState, useEffect, useCallback } from 'react';
import { CanvasPlugin, PluginContext, TableData, InternalHit } from '../types';
import { TableShape } from '../models/TableShape';
import { Plus, Minus, Columns, Rows } from 'lucide-react';

interface TableMenuState {
  x: number;
  y: number;
  r: number;
  c: number;
  visible: boolean;
}

export const useTablePlugin = (): CanvasPlugin => {
  const [selection, setSelection] = useState<{ r1: number, c1: number, r2: number, c2: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [activeCellEdit, setActiveCellEdit] = useState<{ r: number, c: number } | null>(null);
  const [resizing, setResizing] = useState<{ type: 'row' | 'col', index: number, startSize: number, startPos: number } | null>(null);
  const [menu, setMenu] = useState<TableMenuState>({ x: 0, y: 0, r: 0, c: 0, visible: false });

  const closeMenu = useCallback(() => setMenu(prev => ({ ...prev, visible: false })), []);

  useEffect(() => {
    if (menu.visible) {
      const handleGlobalClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('.table-context-menu')) return;
        closeMenu();
      };
      window.addEventListener('mousedown', handleGlobalClick);
      return () => window.removeEventListener('mousedown', handleGlobalClick);
    }
  }, [menu.visible, closeMenu]);

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

  const insertRow = (ctx: PluginContext, tableId: string, index: number, above: boolean) => {
    const targetIdx = above ? index : index + 1;
    updateTableData(ctx, tableId, data => {
      data.rows.splice(targetIdx, 0, 30);
      const newCells: Record<string, any> = {};
      Object.entries(data.cells).forEach(([key, val]) => {
        const [r, c] = key.split(',').map(Number);
        if (r >= targetIdx) newCells[`${r + 1},${c}`] = val;
        else newCells[key] = val;
      });
      data.cells = newCells;
      return data;
    });
    closeMenu();
  };

  const insertCol = (ctx: PluginContext, tableId: string, index: number, left: boolean) => {
    const targetIdx = left ? index : index + 1;
    updateTableData(ctx, tableId, data => {
      data.cols.splice(targetIdx, 0, 80);
      const newCells: Record<string, any> = {};
      Object.entries(data.cells).forEach(([key, val]) => {
        const [r, c] = key.split(',').map(Number);
        if (c >= targetIdx) newCells[`${r},${c + 1}`] = val;
        else newCells[key] = val;
      });
      data.cells = newCells;
      return data;
    });
    closeMenu();
  };

  const deleteRow = (ctx: PluginContext, tableId: string, index: number) => {
    updateTableData(ctx, tableId, data => {
      if (data.rows.length <= 1) return data;
      data.rows.splice(index, 1);
      const newCells: Record<string, any> = {};
      Object.entries(data.cells).forEach(([key, val]) => {
        const [r, c] = key.split(',').map(Number);
        if (r === index) return;
        if (r > index) newCells[`${r - 1},${c}`] = val;
        else newCells[key] = val;
      });
      data.cells = newCells;
      return data;
    });
    closeMenu();
  };

  const deleteCol = (ctx: PluginContext, tableId: string, index: number) => {
    updateTableData(ctx, tableId, data => {
      if (data.cols.length <= 1) return data;
      data.cols.splice(index, 1);
      const newCells: Record<string, any> = {};
      Object.entries(data.cells).forEach(([key, val]) => {
        const [r, c] = key.split(',').map(Number);
        if (c === index) return;
        if (c > index) newCells[`${r},${c - 1}`] = val;
        else newCells[key] = val;
      });
      data.cells = newCells;
      return data;
    });
    closeMenu();
  };

  return {
    name: 'table-plugin',
    priority: 110,

    onMouseDown: (e, hit, ctx) => {
      const hitData = e.internalHit;
      if (!hitData || (e.nativeEvent as MouseEvent).button === 2) return false;

      const isEditing = ctx.state.editingId === hitData.id;
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
      if (hitData?.id === ctx.state.editingId) {
        if (hitData.type === 'col-resize') ctx.setCursor('col-resize');
        else if (hitData.type === 'row-resize') ctx.setCursor('row-resize');
      }
      if (isSelecting && ctx.state.editingId && hitData?.type === 'cell' && hitData.id === ctx.state.editingId) {
        const { r, c } = hitData.metadata;
        setSelection(prev => prev ? { ...prev, r2: r, c2: c } : { r1: r, c1: c, r2: r, c2: c });
        e.consume();
      }
    },

    onMouseUp: (e, ctx) => {
      if (resizing) {
        ctx.setState(prev => ({ ...prev }), true);
        setResizing(null);
      }
      setIsSelecting(false);
    },

    onContextMenu: (e, hit, ctx) => {
      const hitData = e.internalHit;
      // 时机：表格处于编辑模式，点击的是单元格，且当前没有正在编辑某个单元格的文本
      const isEditingTable = ctx.state.editingId && hitData?.id === ctx.state.editingId;
      if (isEditingTable && hitData?.type === 'cell' && !activeCellEdit) {
        const { r, c } = hitData.metadata;
        const mouseEvent = e.nativeEvent as MouseEvent;
        setMenu({ x: mouseEvent.clientX, y: mouseEvent.clientY, r, c, visible: true });
        e.consume();
        return true;
      }
      return false;
    },

    onDoubleClick: (e, hit, ctx) => {
      if (hit?.type === 'table') {
        const hitData = e.internalHit;
        if (hitData?.type === 'cell') {
          const { r, c } = hitData.metadata;
          const activateCell = () => {
            setActiveCellEdit({ r, c });
            setSelection({ r1: r, c1: c, r2: r, c2: c });
            const table = ctx.scene.getShapes().find(s => s.id === hit.id) as TableShape;
            if (table) table.activeCell = { r, c };
          };
          if (ctx.state.editingId !== hit.id) {
            ctx.setState(prev => ({ 
              ...prev, 
              editingId: hit.id, 
              interactionState: 'EDITING',
              selectedIds: [hit.id] 
            }), true);
          }
          activateCell();
          e.consume();
        }
      }
    },

    onRenderForeground: (ctx) => {
      const { editingId, selectedIds, zoom, offset } = ctx.state;
      const targetId = editingId || (selectedIds.length === 1 ? selectedIds[0] : null);
      if (!targetId) return;
      const shape = ctx.state.shapes.find(s => s.id === targetId);
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
      if (editingId === targetId && selection) {
        const r1 = Math.min(selection.r1, selection.r2), r2 = Math.max(selection.r1, selection.r2);
        const c1 = Math.min(selection.c1, selection.c2), c2 = Math.max(selection.c1, selection.c2);
        const selX = shape.x + shape.tableData.cols.slice(0, c1).reduce((a, b) => a + b, 0);
        const selY = shape.y + shape.tableData.rows.slice(0, r1).reduce((a, b) => a + b, 0);
        const selW = shape.tableData.cols.slice(c1, c2 + 1).reduce((a, b) => a + b, 0);
        const selH = shape.tableData.rows.slice(r1, r2 + 1).reduce((a, b) => a + b, 0);
        c.fillStyle = 'rgba(79, 70, 229, 0.1)';
        c.strokeStyle = '#6366f1';
        c.lineWidth = 1 / zoom;
        c.fillRect(selX, selY, selW, selH);
        c.strokeRect(selX, selY, selW, selH);
      }
      if (resizing) {
        c.beginPath();
        c.strokeStyle = '#6366f1';
        c.lineWidth = 1 / zoom;
        if (resizing.type === 'col') {
          const x = shape.x + shape.tableData.cols.slice(0, resizing.index + 1).reduce((a, b) => a + b, 0);
          c.moveTo(x, shape.y);
          c.lineTo(x, shape.y + shape.height);
        } else {
          const y = shape.y + shape.tableData.rows.slice(0, resizing.index + 1).reduce((a, b) => a + b, 0);
          c.moveTo(shape.x, y);
          c.lineTo(shape.x + shape.width, y);
        }
        c.stroke();
      }
      c.restore();
    },

    onRenderOverlay: (ctx) => {
      const { editingId, zoom, offset } = ctx.state;
      const renderEditor = () => {
        if (!editingId || !activeCellEdit) return null;
        const shape = ctx.state.shapes.find(s => s.id === editingId);
        if (!shape || shape.type !== 'table' || !shape.tableData) return null;
        const { r, c } = activeCellEdit;
        const { rows, cols, cells } = shape.tableData;
        const cellData = cells[`${r},${c}`];
        const cellX = shape.x + cols.slice(0, c).reduce((a, b) => a + b, 0);
        const cellY = shape.y + rows.slice(0, r).reduce((a, b) => a + b, 0);
        const cellW = cols[c];
        const cellH = rows[r];
        const finishEditing = () => {
          setActiveCellEdit(null);
          const table = ctx.scene.getShapes().find(s => s.id === editingId) as TableShape;
          if (table) table.activeCell = null;
        };
        return (
          <div style={{
            position: 'absolute',
            left: shape.x * zoom + offset.x,
            top: shape.y * zoom + offset.y,
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
                left: (cellX - shape.x) * zoom,
                top: (cellY - shape.y) * zoom,
                width: cellW * zoom,
                height: cellH * zoom,
                fontSize: (cellData?.fontSize || shape.fontSize || 14) * zoom,
                color: cellData?.textColor || shape.textColor || '#000000',
                background: cellData?.fill || '#ffffff',
                border: 'none',
                outline: `2px solid #6366f1`,
                margin: '0',
                padding: '2px',
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
                const val = e.target.value;
                updateTableData(ctx, editingId, data => {
                  const key = `${r},${c}`;
                  data.cells[key] = { ...data.cells[key], text: val };
                  return data;
                }, false);
              }}
              onMouseDown={e => e.stopPropagation()}
            />
          </div>
        );
      };

      const renderMenu = () => {
        if (!menu.visible || !editingId) return null;
        return (
          <div 
            className="table-context-menu fixed bg-white border border-zinc-200 rounded-xl shadow-2xl p-1 w-56 z-[10002] animate-in fade-in zoom-in duration-100"
            style={{ left: menu.x, top: menu.y }}
            onMouseDown={e => e.stopPropagation()}
          >
            <div className="text-[10px] font-bold text-zinc-400 px-3 py-1.5 uppercase tracking-widest flex items-center gap-2">
              <Rows className="w-3 h-3" /> 行操作
            </div>
            <TableMenuItem icon={<Plus className="w-4 h-4" />} label="在上方插入行" onClick={() => insertRow(ctx, editingId, menu.r, true)} />
            <TableMenuItem icon={<Plus className="w-4 h-4" />} label="在下方插入行" onClick={() => insertRow(ctx, editingId, menu.r, false)} />
            <TableMenuItem icon={<Minus className="w-4 h-4" />} label="删除当前行" danger onClick={() => deleteRow(ctx, editingId, menu.r)} />
            <div className="h-[1px] bg-zinc-100 my-1 mx-2" />
            <div className="text-[10px] font-bold text-zinc-400 px-3 py-1.5 uppercase tracking-widest flex items-center gap-2">
              <Columns className="w-3 h-3" /> 列操作
            </div>
            <TableMenuItem icon={<Plus className="w-4 h-4" />} label="在左侧插入列" onClick={() => insertCol(ctx, editingId, menu.c, true)} />
            <TableMenuItem icon={<Plus className="w-4 h-4" />} label="在右侧插入列" onClick={() => insertCol(ctx, editingId, menu.c, false)} />
            <TableMenuItem icon={<Minus className="w-4 h-4" />} label="删除当前列" danger onClick={() => deleteCol(ctx, editingId, menu.c)} />
          </div>
        );
      };

      return (
        <>
          {renderEditor()}
          {renderMenu()}
        </>
      );
    }
  };
};

const TableMenuItem: React.FC<{ icon: React.ReactNode, label: string, onClick?: () => void, danger?: boolean }> = ({ icon, label, onClick, danger }) => (
  <button 
    onMouseDown={(e) => { e.stopPropagation(); if (onClick) onClick(); }} 
    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all hover:bg-zinc-50 active:scale-95 ${danger ? 'text-red-500 hover:bg-red-50' : 'text-zinc-700'}`}
  >
    <div className={`opacity-70 ${danger ? 'text-red-500' : 'text-zinc-500'}`}>{icon}</div>
    <span className="flex-1 text-left font-medium">{label}</span>
  </button>
);
