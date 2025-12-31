
import React, { useState, useCallback, useEffect } from 'react';
import { Plus, Minus, Merge, Split, Type, Trash2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { CanvasPlugin, PluginContext, Shape, TableData, TableMerge } from '../types';
import { TableShape } from '../models/TableShape';

export const useTablePlugin = (): CanvasPlugin => {
  const [selection, setSelection] = useState<{ r1: number, c1: number, r2: number, c2: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [resizing, setResizing] = useState<{ type: 'row' | 'col', index: number, startPos: number, startVal: number } | null>(null);
  const [activeCellEdit, setActiveCellEdit] = useState<{ r: number, c: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, r: number, c: number } | null>(null);

  const getTable = (ctx: PluginContext, id: string | null) => {
    if (!id) return null;
    return ctx.state.shapes.find(s => s.id === id) as Shape | undefined;
  };

  const updateTableData = (ctx: PluginContext, id: string, updater: (data: TableData) => TableData) => {
    const table = getTable(ctx, id);
    if (!table || !table.tableData) return;
    const newData = updater({ ...table.tableData });
    const newWidth = newData.cols.reduce((a, b) => a + b, 0);
    const newHeight = newData.rows.reduce((a, b) => a + b, 0);
    ctx.updateShape(id, { tableData: newData, width: newWidth, height: newHeight });
    ctx.setState(prev => ({ ...prev }), true);
  };

  const getLocalCoords = (x: number, y: number, table: Shape) => {
    const cx = table.x + table.width / 2;
    const cy = table.y + table.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    const cos = Math.cos(-table.rotation);
    const sin = Math.sin(-table.rotation);
    return {
      lx: dx * cos - dy * sin + table.width / 2,
      ly: dx * sin + dy * cos + table.height / 2
    };
  };

  useEffect(() => {
    if (contextMenu) {
      const close = () => setContextMenu(null);
      window.addEventListener('mousedown', close);
      return () => window.removeEventListener('mousedown', close);
    }
  }, [contextMenu]);

  return {
    name: 'table-plugin',
    priority: 110,

    onMouseDown: (e, hit, ctx) => {
      const { x, y } = e;
      const editingId = ctx.state.editingId;

      if (editingId) {
        const table = getTable(ctx, editingId);
        if (table && table.type === 'table') {
          if (!hit || hit.id !== editingId) {
            ctx.setState(prev => ({ 
              ...prev, 
              editingId: null, 
              interactionState: 'IDLE',
              selectedIds: hit ? [hit.id] : [] 
            }), true);
            setActiveCellEdit(null);
            setSelection(null);
            return !hit; 
          }

          const model = ctx.scene.getShapes().find(s => s.id === editingId) as TableShape;
          if (!model) return;

          const zoom = ctx.state.zoom;
          const threshold = 10 / zoom;
          const { lx, ly } = getLocalCoords(x, y, table);

          let currentX = 0;
          for (let c = 0; c < table.tableData!.cols.length; c++) {
            currentX += table.tableData!.cols[c];
            if (Math.abs(lx - currentX) < threshold && ly >= 0 && ly <= table.height) {
              setResizing({ type: 'col', index: c, startPos: lx, startVal: table.tableData!.cols[c] });
              e.consume();
              return true;
            }
          }

          let currentY = 0;
          for (let r = 0; r < table.tableData!.rows.length; r++) {
            currentY += table.tableData!.rows[r];
            if (Math.abs(ly - currentY) < threshold && lx >= 0 && lx <= table.width) {
              setResizing({ type: 'row', index: r, startPos: ly, startVal: table.tableData!.rows[r] });
              e.consume();
              return true;
            }
          }

          const cell = model.getCellAt(x, y);
          if (cell) {
            setSelection({ r1: cell.r, c1: cell.c, r2: cell.r, c2: cell.c });
            setIsSelecting(true);
            setActiveCellEdit(null);
            e.consume();
            return true;
          }
        }
      }
      return false;
    },

    onMouseMove: (e, ctx) => {
      const { x, y } = e;
      const editingId = ctx.state.editingId;
      if (!editingId) return;

      const table = getTable(ctx, editingId);
      if (!table || table.type !== 'table') return;

      const { lx, ly } = getLocalCoords(x, y, table);

      if (resizing) {
        updateTableData(ctx, editingId, data => {
          const diff = resizing.type === 'col' ? lx - resizing.startPos : ly - resizing.startPos;
          if (resizing.type === 'col') {
            data.cols[resizing.index] = Math.max(20, resizing.startVal + diff);
          } else {
            data.rows[resizing.index] = Math.max(20, resizing.startVal + diff);
          }
          return data;
        });
        ctx.setCursor(resizing.type === 'col' ? 'col-resize' : 'row-resize');
        return;
      }

      if (isSelecting) {
        const model = ctx.scene.getShapes().find(s => s.id === editingId) as TableShape;
        if (model) {
          const cell = model.getCellAt(x, y);
          if (cell && selection) {
            setSelection({ ...selection, r2: cell.r, c2: cell.c });
          }
        }
        return;
      }

      const zoom = ctx.state.zoom;
      const threshold = 10 / zoom;
      let overLine = false;
      let currentX = 0;
      for (let c = 0; c < table.tableData!.cols.length; c++) {
        currentX += table.tableData!.cols[c];
        if (Math.abs(lx - currentX) < threshold && ly >= 0 && ly <= table.height) {
          ctx.setCursor('col-resize');
          overLine = true;
          break;
        }
      }
      if (!overLine) {
        let currentY = 0;
        for (let r = 0; r < table.tableData!.rows.length; r++) {
          currentY += table.tableData!.rows[r];
          if (Math.abs(ly - currentY) < threshold && lx >= 0 && lx <= table.width) {
            ctx.setCursor('row-resize');
            overLine = true;
            break;
          }
        }
      }
    },

    onMouseUp: () => {
      setIsSelecting(false);
      setResizing(null);
    },

    onDoubleClick: (e, hit, ctx) => {
      if (hit?.type === 'table') {
        const model = ctx.scene.getShapes().find(s => s.id === hit.id) as TableShape;
        const cell = model?.getCellAt(e.x, e.y);

        if (ctx.state.editingId === hit.id) {
            if (cell) {
                setActiveCellEdit({ r: cell.r, c: cell.c });
                setSelection({ r1: cell.r, c1: cell.c, r2: cell.r, c2: cell.c });
            }
        } else {
            ctx.setState(prev => ({ 
              ...prev, 
              editingId: hit.id, 
              interactionState: 'EDITING', 
              selectedIds: [hit.id] 
            }), false);
            if (cell) {
                setSelection({ r1: cell.r, c1: cell.c, r2: cell.r, c2: cell.c });
                setActiveCellEdit({ r: cell.r, c: cell.c });
            } else {
                setSelection({ r1: 0, c1: 0, r2: 0, c2: 0 });
                setActiveCellEdit({ r: 0, c: 0 });
            }
        }
        e.consume();
      }
    },

    onContextMenu: (e, hit, ctx) => {
        if (ctx.state.editingId) {
            const table = getTable(ctx, ctx.state.editingId);
            if (table?.type === 'table') {
                const model = ctx.scene.getShapes().find(s => s.id === ctx.state.editingId) as TableShape;
                const cell = model?.getCellAt(e.x, e.y);
                if (cell) {
                    const mouseEvent = e.nativeEvent as MouseEvent;
                    setContextMenu({ x: mouseEvent.clientX, y: mouseEvent.clientY, r: cell.r, c: cell.c });
                }
                e.consume();
                return true;
            }
        }
        return false;
    },

    onKeyDown: (e, ctx) => {
      if (e.key === 'Escape') {
        if (activeCellEdit) { setActiveCellEdit(null); return true; }
        if (ctx.state.editingId) { ctx.setState(prev => ({ ...prev, editingId: null, interactionState: 'IDLE' }), true); return true; }
      }
      return false;
    },

    onRenderForeground: (ctx) => {
      const { editingId, zoom, offset } = ctx.state;
      if (!editingId) return;
      const table = getTable(ctx, editingId);
      if (!table || table.type !== 'table' || !selection) return;

      const c = ctx.renderer?.ctx;
      if (!c) return;

      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.translate(offset.x, offset.y);
      c.scale(zoom, zoom);

      const tableCx = table.x + table.width / 2;
      const tableCy = table.y + table.height / 2;
      c.translate(tableCx, tableCy);
      c.rotate(table.rotation);
      c.translate(-tableCx, -tableCy);

      const r1 = Math.min(selection.r1, selection.r2);
      const r2 = Math.max(selection.r1, selection.r2);
      const c1 = Math.min(selection.c1, selection.c2);
      const c2 = Math.max(selection.c1, selection.c2);

      const selX = table.x + table.tableData!.cols.slice(0, c1).reduce((a, b) => a + b, 0);
      const selY = table.y + table.tableData!.rows.slice(0, r1).reduce((a, b) => a + b, 0);
      const selW = table.tableData!.cols.slice(c1, c2 + 1).reduce((a, b) => a + b, 0);
      const selH = table.tableData!.rows.slice(r1, r2 + 1).reduce((a, b) => a + b, 0);

      c.fillStyle = 'rgba(99, 102, 241, 0.1)';
      c.strokeStyle = '#6366f1';
      c.lineWidth = 1.5 / zoom;
      c.fillRect(selX, selY, selW, selH);
      c.strokeRect(selX, selY, selW, selH);

      c.restore();
    },

    onRenderOverlay: (ctx) => {
      const { editingId, zoom, offset } = ctx.state;
      if (!editingId) return null;
      const table = getTable(ctx, editingId);
      if (!table || table.type !== 'table' || !selection) return null;

      const tableCx = table.x + table.width / 2;
      const tableCy = table.y + table.height / 2;

      const handleMerge = () => {
        updateTableData(ctx, editingId, data => {
          const r1 = Math.min(selection.r1, selection.r2);
          const r2 = Math.max(selection.r1, selection.r2);
          const c1 = Math.min(selection.c1, selection.c2);
          const c2 = Math.max(selection.c1, selection.c2);
          if (r1 === r2 && c1 === c2) return data;
          data.merges = data.merges.filter(m => !(m.r1 >= r1 && m.r2 <= r2 && m.c1 >= c1 && m.c2 <= c2));
          data.merges.push({ r1, c1, r2, c2 });
          return data;
        });
      };

      const handleSplit = () => {
        updateTableData(ctx, editingId, data => {
            const r1 = Math.min(selection.r1, selection.r2);
            const r2 = Math.max(selection.r1, selection.r2);
            const c1 = Math.min(selection.c1, selection.c2);
            const c2 = Math.max(selection.c1, selection.c2);
            data.merges = data.merges.filter(m => !(
                Math.max(m.r1, r1) <= Math.min(m.r2, r2) && 
                Math.max(m.c1, c1) <= Math.min(m.c2, c2)
            ));
            return data;
        });
      };

      const addRowAt = (index: number) => {
        updateTableData(ctx, editingId, data => {
            data.rows.splice(index, 0, 30);
            const newCells: Record<string, any> = {};
            Object.entries(data.cells).forEach(([key, val]) => {
                const [r, c] = key.split(',').map(Number);
                if (r >= index) newCells[`${r+1},${c}`] = val;
                else newCells[key] = val;
            });
            data.cells = newCells;
            data.merges = data.merges.map(m => {
                if (m.r1 >= index) return { ...m, r1: m.r1 + 1, r2: m.r2 + 1 };
                if (m.r2 >= index) return { ...m, r2: m.r2 + 1 };
                return m;
            });
            return data;
        });
        setContextMenu(null);
      };

      const addColAt = (index: number) => {
        updateTableData(ctx, editingId, data => {
            data.cols.splice(index, 0, 80);
            const newCells: Record<string, any> = {};
            Object.entries(data.cells).forEach(([key, val]) => {
                const [r, c] = key.split(',').map(Number);
                if (c >= index) newCells[`${r},${c+1}`] = val;
                else newCells[key] = val;
            });
            data.cells = newCells;
            data.merges = data.merges.map(m => {
                if (m.c1 >= index) return { ...m, c1: m.c1 + 1, c2: m.c2 + 1 };
                if (m.c2 >= index) return { ...m, c2: m.c2 + 1 };
                return m;
            });
            return data;
        });
        setContextMenu(null);
      };

      const deleteRowAt = (index: number) => {
        updateTableData(ctx, editingId, data => {
            if (data.rows.length <= 1) return data;
            data.rows.splice(index, 1);
            const newCells: Record<string, any> = {};
            Object.entries(data.cells).forEach(([key, val]) => {
                const [r, c] = key.split(',').map(Number);
                if (r === index) return;
                if (r > index) newCells[`${r-1},${c}`] = val;
                else newCells[key] = val;
            });
            data.cells = newCells;
            data.merges = data.merges.filter(m => !(m.r1 === index && m.r2 === index))
                .map(m => {
                    if (m.r1 > index) return { ...m, r1: m.r1 - 1, r2: m.r2 - 1 };
                    if (m.r2 >= index) return { ...m, r2: Math.max(m.r1, m.r2 - 1) };
                    return m;
                });
            return data;
        });
        setContextMenu(null);
      };

      const deleteColAt = (index: number) => {
        updateTableData(ctx, editingId, data => {
            if (data.cols.length <= 1) return data;
            data.cols.splice(index, 1);
            const newCells: Record<string, any> = {};
            Object.entries(data.cells).forEach(([key, val]) => {
                const [r, c] = key.split(',').map(Number);
                if (c === index) return;
                if (c > index) newCells[`${r},${c-1}`] = val;
                else newCells[key] = val;
            });
            data.cells = newCells;
            data.merges = data.merges.filter(m => !(m.c1 === index && m.c2 === index))
                .map(m => {
                    if (m.c1 > index) return { ...m, c1: m.c1 - 1, c2: m.c2 - 1 };
                    if (m.c2 >= index) return { ...m, c2: Math.max(m.c1, m.c2 - 1) };
                    return m;
                });
            return data;
        });
        setContextMenu(null);
      };

      let editWidth = 0, editHeight = 0, editOffsetX = 0, editOffsetY = 0;
      if (activeCellEdit) {
          const merge = table.tableData!.merges.find(m => activeCellEdit.r >= m.r1 && activeCellEdit.r <= m.r2 && activeCellEdit.c >= m.c1 && activeCellEdit.c <= m.c2);
          const r1 = merge ? merge.r1 : activeCellEdit.r;
          const c1 = merge ? merge.c1 : activeCellEdit.c;
          const r2 = merge ? merge.r2 : activeCellEdit.r;
          const c2 = merge ? merge.c2 : activeCellEdit.c;
          editWidth = table.tableData!.cols.slice(c1, c2 + 1).reduce((a, b) => a + b, 0);
          editHeight = table.tableData!.rows.slice(r1, r2 + 1).reduce((a, b) => a + b, 0);
          editOffsetX = table.tableData!.cols.slice(0, c1).reduce((a, b) => a + b, 0);
          editOffsetY = table.tableData!.rows.slice(0, r1).reduce((a, b) => a + b, 0);
      }

      return (
        <>
          <div className="absolute top-20 left-1/2 -translate-x-1/2 flex gap-2 bg-white border border-zinc-200 p-2 rounded-xl z-[200] shadow-lg">
            <button onClick={() => addRowAt(table.tableData!.rows.length)} className="p-2 hover:bg-zinc-50 rounded text-zinc-600 flex items-center gap-1 text-xs font-medium"><Plus className="w-3.5 h-3.5" /> Row</button>
            <button onClick={() => addColAt(table.tableData!.cols.length)} className="p-2 hover:bg-zinc-50 rounded text-zinc-600 flex items-center gap-1 text-xs font-medium"><Plus className="w-3.5 h-3.5" /> Col</button>
            <div className="w-[1px] bg-zinc-100 mx-1" />
            <button onClick={handleMerge} className="p-2 hover:bg-zinc-50 rounded text-zinc-600"><Merge className="w-3.5 h-3.5" /></button>
            <button onClick={handleSplit} className="p-2 hover:bg-zinc-50 rounded text-zinc-600"><Split className="w-3.5 h-3.5" /></button>
          </div>
          
          {activeCellEdit && (
              <input 
                autoFocus
                className="fixed bg-white border-2 border-indigo-500 text-zinc-900 p-1 text-sm outline-none rounded shadow-2xl"
                style={{
                    left: 0, top: 0,
                    width: editWidth * zoom, height: editHeight * zoom,
                    transformOrigin: '0 0',
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom}) translate(${tableCx}px, ${tableCy}px) rotate(${table.rotation}rad) translate(${-table.width/2 + editOffsetX}px, ${-table.height/2 + editOffsetY}px)`,
                    fontSize: `${(table.fontSize || 12) * zoom}px`,
                    textAlign: table.tableData!.cells[`${activeCellEdit.r},${activeCellEdit.c}`]?.align || 'center',
                }}
                value={table.tableData!.cells[`${activeCellEdit.r},${activeCellEdit.c}`]?.text || ''}
                onChange={e => updateTableData(ctx, editingId, data => { if (!data.cells[`${activeCellEdit.r},${activeCellEdit.c}`]) data.cells[`${activeCellEdit.r},${activeCellEdit.c}`] = { text: '' }; data.cells[`${activeCellEdit.r},${activeCellEdit.c}`].text = e.target.value; return data; })}
                onBlur={() => setActiveCellEdit(null)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setActiveCellEdit(null); }}
              />
          )}

          {contextMenu && (
            <div 
              className="fixed bg-white border border-zinc-200 rounded-xl shadow-2xl p-1 w-48 z-[300] overflow-hidden"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onMouseDown={e => e.stopPropagation()}
            >
              <div className="text-[10px] font-bold text-zinc-400 px-3 py-2 uppercase tracking-widest">Table Operations</div>
              <TableMenuItem icon={<ArrowUp className="w-3.5 h-3.5" />} label="Insert Row Above" onClick={() => addRowAt(contextMenu.r)} />
              <TableMenuItem icon={<ArrowDown className="w-3.5 h-3.5" />} label="Insert Row Below" onClick={() => addRowAt(contextMenu.r + 1)} />
              <TableMenuItem icon={<ArrowLeft className="w-3.5 h-3.5" />} label="Insert Col Left" onClick={() => addColAt(contextMenu.c)} />
              <TableMenuItem icon={<ArrowRight className="w-3.5 h-3.5" />} label="Insert Col Right" onClick={() => addColAt(contextMenu.c + 1)} />
              <div className="h-[1px] bg-zinc-100 my-1 mx-2" />
              <TableMenuItem icon={<Trash2 className="w-3.5 h-3.5" />} label="Delete Row" danger onClick={() => deleteRowAt(contextMenu.r)} />
              <TableMenuItem icon={<Trash2 className="w-3.5 h-3.5" />} label="Delete Column" danger onClick={() => deleteColAt(contextMenu.c)} />
            </div>
          )}
        </>
      );
    }
  };
};

const TableMenuItem: React.FC<{ icon: React.ReactNode, label: string, onClick: () => void, danger?: boolean }> = ({ icon, label, onClick, danger }) => (
  <button 
    onMouseDown={(e) => { e.stopPropagation(); onClick(); }} 
    className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs transition-all hover:bg-zinc-50 ${danger ? 'text-red-500' : 'text-zinc-600 font-medium'}`}
  >
    <div className="opacity-70 text-zinc-500">{icon}</div>
    <span className="flex-1 text-left">{label}</span>
  </button>
);
