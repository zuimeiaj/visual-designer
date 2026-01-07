
import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { 
  CanvasPlugin, 
  PluginContext, 
  Shape,
  TableData
} from '../types';
import { 
  Layers, ArrowUp, ArrowDown, ChevronUp, ChevronDown, 
  Group, Ungroup, Trash2, Plus, Minus, Rows, Columns, Copy
} from 'lucide-react';
import { useTranslation } from '../lang/i18n';
import { UIShape } from '../models/UIShape';

interface MenuState {
  x: number;
  y: number;
  visible: boolean;
}

export const useContextMenuPlugin = (): CanvasPlugin => {
  const [menu, setMenu] = useState<MenuState>({ x: 0, y: 0, visible: false });
  const [adjustedPos, setAdjustedPos] = useState({ x: 0, y: 0, origin: 'top left' });
  const menuRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  const closeMenu = useCallback(() => setMenu(prev => ({ ...prev, visible: false })), []);

  // 动态计算菜单位置，防止超出屏幕
  useLayoutEffect(() => {
    if (menu.visible && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;

      let x = menu.x;
      let y = menu.y;
      let originX = 'left';
      let originY = 'top';

      if (x + rect.width > viewportW) {
        x = viewportW - rect.width - 10;
        originX = 'right';
      }
      
      if (y + rect.height > viewportH) {
        y = viewportH - rect.height - 10;
        originY = 'bottom';
      }

      x = Math.max(10, x);
      y = Math.max(10, y);

      setAdjustedPos({ x, y, origin: `${originY} ${originX}` });
    }
  }, [menu]);

  useEffect(() => {
    if (menu.visible) {
      const handleGlobalClick = () => closeMenu();
      const timer = setTimeout(() => {
        window.addEventListener('mousedown', handleGlobalClick);
        window.addEventListener('wheel', handleGlobalClick);
        window.addEventListener('contextmenu', handleGlobalClick);
      }, 10);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('mousedown', handleGlobalClick);
        window.removeEventListener('wheel', handleGlobalClick);
        window.removeEventListener('contextmenu', handleGlobalClick);
      };
    }
  }, [menu.visible, closeMenu]);

  const getTopmostParentId = (shapes: Shape[], targetId: string): string => {
    const parent = shapes.find(s => s.children?.some(c => c.id === targetId));
    return parent ? getTopmostParentId(shapes, parent.id) : targetId;
  };

  const updateTableData = (ctx: PluginContext, id: string, updater: (data: TableData) => TableData) => {
    const shape = ctx.state.shapes.find(s => s.id === id);
    if (!shape || !shape.tableData) return;
    const dataCopy: TableData = JSON.parse(JSON.stringify(shape.tableData));
    const newData = updater(dataCopy);
    ctx.updateShape(id, { 
      tableData: newData, 
      width: newData.cols.reduce((a, b) => a + b, 0),
      height: newData.rows.reduce((a, b) => a + b, 0)
    });
    ctx.setState(prev => ({ ...prev }), true);
  };

  const handleTableOp = (ctx: PluginContext, op: string) => {
    const hit = ctx.state.shapes.find(s => s.id === ctx.state.editingId);
    const cell = (ctx.state as any)._contextMenuCell; 
    if (!hit || !cell) return;

    const { r, c } = cell;
    if (op === 'ins-row-above') {
      updateTableData(ctx, hit.id, data => {
        data.rows.splice(r, 0, 30);
        const newCells: any = {};
        Object.entries(data.cells).forEach(([k, v]) => {
          const [row, col] = k.split(',').map(Number);
          if (row >= r) newCells[`${row+1},${col}`] = v; else newCells[k] = v;
        });
        data.cells = newCells; return data;
      });
    } else if (op === 'del-row') {
      updateTableData(ctx, hit.id, data => {
        if (data.rows.length <= 1) return data;
        data.rows.splice(r, 1);
        const newCells: any = {};
        Object.entries(data.cells).forEach(([k, v]) => {
          const [row, col] = k.split(',').map(Number);
          if (row === r) return;
          if (row > r) newCells[`${row-1},${col}`] = v; else newCells[k] = v;
        });
        data.cells = newCells; return data;
      });
    } else if (op === 'ins-col-left') {
      updateTableData(ctx, hit.id, data => {
        data.cols.splice(c, 0, 80);
        const newCells: any = {};
        Object.entries(data.cells).forEach(([k, v]) => {
          const [row, col] = k.split(',').map(Number);
          if (col >= c) newCells[`${row},${col+1}`] = v; else newCells[k] = v;
        });
        data.cells = newCells; return data;
      });
    } else if (op === 'del-col') {
      updateTableData(ctx, hit.id, data => {
        if (data.cols.length <= 1) return data;
        data.cols.splice(c, 1);
        const newCells: any = {};
        Object.entries(data.cells).forEach(([k, v]) => {
          const [row, col] = k.split(',').map(Number);
          if (col === c) return;
          if (col > c) newCells[`${row},${col-1}`] = v; else newCells[k] = v;
        });
        data.cells = newCells; return data;
      });
    }
    closeMenu();
  };

  const groupSelected = (ctx: PluginContext) => {
    const { selectedIds, shapes } = ctx.state;
    const topSelectedIds = Array.from(new Set(selectedIds.map(id => getTopmostParentId(shapes, id))));
    if (topSelectedIds.length < 2) return;
    const groupMembers = shapes.filter(s => topSelectedIds.includes(s.id));
    const remainingShapes = shapes.filter(s => !topSelectedIds.includes(s.id));
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    groupMembers.forEach(s => {
      const b = UIShape.create(s).getAABB();
      minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
    });
    const newGroup: Shape = {
      id: 'group-' + Math.random().toString(36).substr(2, 9),
      type: 'group', x: minX, y: minY, width: maxX - minX, height: maxY - minY, rotation: 0, fill: 'transparent', stroke: 'none', strokeWidth: 0,
      children: groupMembers.map(s => ({ ...s, x: s.x - minX, y: s.y - minY }))
    };
    ctx.setState(prev => ({ ...prev, shapes: [...remainingShapes, newGroup], selectedIds: [newGroup.id] }), true);
    closeMenu();
  };

  const ungroupSelected = (ctx: PluginContext) => {
    const { selectedIds, shapes } = ctx.state;
    if (selectedIds.length !== 1) return;
    const group = shapes.find(s => s.id === selectedIds[0]);
    if (!group || group.type !== 'group' || !group.children) return;
    const absoluteChildren = group.children.map(c => ({ ...c, x: c.x + group.x, y: c.y + group.y }));
    ctx.setState(prev => ({ ...prev, shapes: [...prev.shapes.filter(s => s.id !== group.id), ...absoluteChildren], selectedIds: absoluteChildren.map(s => s.id) }), true);
    closeMenu();
  };

  return {
    name: 'context-menu',
    priority: 1000, 

    onContextMenu: (e, hit, ctx) => {
      e.consume();
      const { selectedIds, shapes, editingId } = ctx.state;
      const hitData = e.internalHit;

      if (editingId && hitData?.id === editingId && hitData.type === 'cell') {
        (ctx.state as any)._contextMenuCell = hitData.metadata;
      } else {
        delete (ctx.state as any)._contextMenuCell;
        if (hit && !selectedIds.includes(hit.id)) {
          ctx.setState(prev => ({ ...prev, selectedIds: [getTopmostParentId(shapes, hit.id)] }), false);
        }
      }

      const mouseEvent = e.nativeEvent as MouseEvent;
      setAdjustedPos({ x: mouseEvent.clientX, y: mouseEvent.clientY, origin: 'top left' });
      setMenu({ x: mouseEvent.clientX, y: mouseEvent.clientY, visible: true });
      return true;
    },

    onRenderOverlay: (ctx) => {
      if (!menu.visible) return null;
      const { selectedIds, shapes, editingId } = ctx.state;
      const cell = (ctx.state as any)._contextMenuCell;
      const hasSelection = selectedIds.length > 0;
      const editingShape = shapes.find(s => s.id === editingId);
      const isTableEditing = editingShape?.type === 'table' && cell;

      return (
        <div 
          ref={menuRef}
          className="fixed bg-white/95 backdrop-blur-xl border border-zinc-200/80 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.18)] p-1.5 w-56 z-[999999] overflow-y-auto max-h-[85vh] animate-in fade-in zoom-in duration-150 scrollbar-hide"
          style={{ 
            left: adjustedPos.x, 
            top: adjustedPos.y, 
            transformOrigin: adjustedPos.origin,
            visibility: adjustedPos.x === 0 ? 'hidden' : 'visible'
          }}
          onMouseDown={e => e.stopPropagation()}
        >
          {isTableEditing && (
            <>
              <div className="text-[10px] font-black text-zinc-400 px-3 py-2 uppercase tracking-widest flex items-center gap-2 mb-1">
                <Rows className="w-3 h-3" /> {t('tools.table')}
              </div>
              <MenuItem icon={<Plus className="w-4 h-4" />} label="在上方插入行" onClick={() => handleTableOp(ctx, 'ins-row-above')} />
              <MenuItem icon={<Minus className="w-4 h-4" />} label="删除当前行" danger onClick={() => handleTableOp(ctx, 'del-row')} />
              <MenuItem icon={<Plus className="w-4 h-4" />} label="在左侧插入列" onClick={() => handleTableOp(ctx, 'ins-col-left')} />
              <MenuItem icon={<Minus className="w-4 h-4" />} label="删除当前列" danger onClick={() => handleTableOp(ctx, 'del-col')} />
              <div className="h-[1px] bg-zinc-100/80 my-1.5 mx-2" />
            </>
          )}

          <div className="text-[10px] font-black text-zinc-400 px-3 py-2 uppercase tracking-widest flex items-center gap-2 mb-1">
            <Layers className="w-3 h-3" /> {t('menu.layer')}
          </div>
          <MenuItem icon={<ChevronUp className="w-4 h-4" />} label={t('menu.bringForward')} disabled={!hasSelection} onClick={() => {
            ctx.setState(prev => {
              const idx = prev.shapes.findIndex(s => s.id === selectedIds[0]);
              if (idx === -1 || idx === prev.shapes.length - 1) return prev;
              const next = [...prev.shapes];
              [next[idx], next[idx+1]] = [next[idx+1], next[idx]];
              return { ...prev, shapes: next };
            }, true);
            closeMenu();
          }} />
          <MenuItem icon={<ChevronDown className="w-4 h-4" />} label={t('menu.sendBackward')} disabled={!hasSelection} onClick={() => {
            ctx.setState(prev => {
              const idx = prev.shapes.findIndex(s => s.id === selectedIds[0]);
              if (idx <= 0) return prev;
              const next = [...prev.shapes];
              [next[idx], next[idx-1]] = [next[idx-1], next[idx]];
              return { ...prev, shapes: next };
            }, true);
            closeMenu();
          }} />
          <MenuItem icon={<ArrowUp className="w-4 h-4" />} label={t('menu.bringToFront')} disabled={!hasSelection} onClick={() => {
            ctx.setState(prev => {
              const selected = prev.shapes.filter(s => selectedIds.includes(s.id));
              const rest = prev.shapes.filter(s => !selectedIds.includes(s.id));
              return { ...prev, shapes: [...rest, ...selected] };
            }, true);
            closeMenu();
          }} />
          <MenuItem icon={<ArrowDown className="w-4 h-4" />} label={t('menu.sendToBack')} disabled={!hasSelection} onClick={() => {
            ctx.setState(prev => {
              const selected = prev.shapes.filter(s => selectedIds.includes(s.id));
              const rest = prev.shapes.filter(s => !selectedIds.includes(s.id));
              return { ...prev, shapes: [...selected, ...rest] };
            }, true);
            closeMenu();
          }} />
          
          <div className="h-[1px] bg-zinc-100/80 my-1.5 mx-2" />
          
          {selectedIds.length === 1 && shapes.find(s => s.id === selectedIds[0])?.type === 'group' ? (
            <MenuItem icon={<Ungroup className="w-4 h-4" />} label={t('menu.ungroup')} onClick={() => ungroupSelected(ctx)} />
          ) : (
            <MenuItem icon={<Group className="w-4 h-4" />} label={t('menu.group')} disabled={selectedIds.length < 2} onClick={() => groupSelected(ctx)} />
          )}

          <div className="h-[1px] bg-zinc-100/80 my-1.5 mx-2" />
          <MenuItem icon={<Copy className="w-4 h-4" />} label={t('menu.exportSelected')} disabled={!hasSelection} onClick={() => {
            if (ctx.actions?.exportSelection) {
              ctx.actions.exportSelection();
            }
            closeMenu();
          }} />
          <MenuItem icon={<Trash2 className="w-4 h-4" />} label={t('menu.delete')} danger disabled={!hasSelection} onClick={() => {
            ctx.setState(prev => ({ ...prev, shapes: prev.shapes.filter(s => !selectedIds.includes(s.id)), selectedIds: [] }), true);
            closeMenu();
          }} />
        </div>
      );
    }
  };
};

const MenuItem: React.FC<{ icon: React.ReactNode, label: string, onClick?: () => void, disabled?: boolean, danger?: boolean }> = ({ icon, label, onClick, disabled, danger }) => (
  <button 
    disabled={disabled} 
    onMouseDown={(e) => e.stopPropagation()} 
    onClick={(e) => {
      e.stopPropagation();
      if (!disabled && onClick) onClick();
    }} 
    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all ${disabled ? 'opacity-25 cursor-not-allowed' : 'hover:bg-zinc-100/80 active:scale-[0.96]'} ${danger ? 'text-red-500 hover:bg-red-50' : 'text-zinc-700 font-semibold'}`}
  >
    <div className={`${danger ? 'text-red-500' : 'text-zinc-400'}`}>{icon}</div>
    <span className="flex-1 text-left">{label}</span>
  </button>
);
