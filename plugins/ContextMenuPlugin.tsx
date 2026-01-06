
import React, { useState, useEffect, useCallback } from 'react';
import { 
  CanvasPlugin, 
  PluginContext, 
  Shape 
} from '../types';
import { 
  Layers, 
  ArrowUp, 
  ArrowDown, 
  ChevronUp, 
  ChevronDown, 
  Group, 
  Ungroup,
  Trash2
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
  const { t } = useTranslation();

  const closeMenu = useCallback(() => setMenu(prev => ({ ...prev, visible: false })), []);

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

  const groupSelected = (ctx: PluginContext) => {
    const { selectedIds, shapes } = ctx.state;
    const topSelectedIds = Array.from(new Set(selectedIds.map(id => getTopmostParentId(shapes, id))));
    if (topSelectedIds.length < 2) return;

    const groupMembers = shapes.filter(s => topSelectedIds.includes(s.id));
    const remainingShapes = shapes.filter(s => !topSelectedIds.includes(s.id));

    // Calculate strict bounding box for the group
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    groupMembers.forEach(s => {
      const b = UIShape.create(s).getAABB();
      minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
    });

    const groupW = maxX - minX;
    const groupH = maxY - minY;

    // Convert child coordinates to be relative to the group's top-left corner
    const relativeChildren = groupMembers.map(s => ({
      ...s,
      x: s.x - minX,
      y: s.y - minY
    }));

    const newGroup: Shape = {
      id: 'group-' + Math.random().toString(36).substr(2, 9),
      type: 'group',
      x: minX,
      y: minY,
      width: groupW,
      height: groupH,
      rotation: 0,
      fill: 'transparent',
      stroke: 'none',
      strokeWidth: 0,
      children: relativeChildren
    };

    ctx.setState(prev => ({
      ...prev,
      shapes: [...remainingShapes, newGroup],
      selectedIds: [newGroup.id]
    }), true);
    closeMenu();
  };

  const ungroupSelected = (ctx: PluginContext) => {
    const { selectedIds, shapes } = ctx.state;
    if (selectedIds.length !== 1) return;
    const id = selectedIds[0];
    const group = shapes.find(s => s.id === id);
    if (!group || group.type !== 'group' || !group.children) return;

    // Convert relative coordinates back to world coordinates
    const absoluteChildren = group.children.map(c => ({
      ...c,
      x: c.x + group.x,
      y: c.y + group.y
    }));

    const remainingShapes = shapes.filter(s => s.id !== id);
    ctx.setState(prev => ({
      ...prev,
      shapes: [...remainingShapes, ...absoluteChildren],
      selectedIds: absoluteChildren.map(s => s.id)
    }), true);
    closeMenu();
  };

  const reorder = (ctx: PluginContext, type: 'front' | 'back' | 'forward' | 'backward') => {
    const { selectedIds, shapes } = ctx.state;
    const topIds = Array.from(new Set(selectedIds.map(id => getTopmostParentId(shapes, id))));
    let newShapes = [...shapes];
    
    if (type === 'front') {
      const selected = newShapes.filter(s => topIds.includes(s.id));
      const rest = newShapes.filter(s => !topIds.includes(s.id));
      newShapes = [...rest, ...selected];
    } else if (type === 'back') {
      const selected = newShapes.filter(s => topIds.includes(s.id));
      const rest = newShapes.filter(s => !topIds.includes(s.id));
      newShapes = [...selected, ...rest];
    }
    ctx.setState(prev => ({ ...prev, shapes: newShapes }), true);
    closeMenu();
  };

  return {
    name: 'context-menu',
    priority: 1000, 

    onContextMenu: (e, hit, ctx) => {
      e.consume();
      const { selectedIds, shapes } = ctx.state;
      if (hit && !selectedIds.includes(hit.id)) {
        const tid = getTopmostParentId(shapes, hit.id);
        ctx.setState(prev => ({ ...prev, selectedIds: [tid] }), false);
      }
      const mouseEvent = e.nativeEvent as MouseEvent;
      setMenu({ x: mouseEvent.clientX, y: mouseEvent.clientY, visible: true });
      return true;
    },

    onRenderOverlay: (ctx) => {
      if (!menu.visible) return null;
      const { selectedIds, shapes } = ctx.state;
      const hasSelection = selectedIds.length > 0;
      const canGroup = Array.from(new Set(selectedIds.map(id => getTopmostParentId(shapes, id)))).length >= 2;
      const canUngroup = selectedIds.length === 1 && shapes.find(s => s.id === selectedIds[0])?.type === 'group';

      return (
        <div 
          className="fixed bg-white/95 backdrop-blur-md border border-zinc-200 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] p-1.5 w-56 z-[999999] overflow-hidden animate-in fade-in zoom-in duration-150"
          style={{ left: menu.x, top: menu.y }}
          onMouseDown={e => e.stopPropagation()}
        >
          <div className="text-[10px] font-bold text-zinc-400 px-3 py-2 uppercase tracking-widest flex items-center gap-2 mb-1">
            <Layers className="w-3 h-3" /> {t('menu.layer')}
          </div>
          <MenuItem icon={<ChevronUp className="w-4 h-4" />} label={t('menu.bringForward')} disabled={!hasSelection} onClick={() => reorder(ctx, 'forward')} />
          <MenuItem icon={<ArrowUp className="w-4 h-4" />} label={t('menu.bringToFront')} disabled={!hasSelection} onClick={() => reorder(ctx, 'front')} />
          <MenuItem icon={<ChevronDown className="w-4 h-4" />} label={t('menu.sendBackward')} disabled={!hasSelection} onClick={() => reorder(ctx, 'backward')} />
          <MenuItem icon={<ArrowDown className="w-4 h-4" />} label={t('menu.sendToBack')} disabled={!hasSelection} onClick={() => reorder(ctx, 'back')} />
          <div className="h-[1px] bg-zinc-100 my-1.5 mx-2" />
          {canUngroup ? (
            <MenuItem icon={<Ungroup className="w-4 h-4" />} label={t('menu.ungroup')} onClick={() => ungroupSelected(ctx)} />
          ) : (
            <MenuItem icon={<Group className="w-4 h-4" />} label={t('menu.group')} disabled={!canGroup} onClick={() => groupSelected(ctx)} />
          )}
          <div className="h-[1px] bg-zinc-100 my-1.5 mx-2" />
          <MenuItem icon={<Trash2 className="w-4 h-4" />} label={t('menu.delete')} danger disabled={!hasSelection} onClick={() => {
            const topSelectedIds = Array.from(new Set(selectedIds.map(id => getTopmostParentId(shapes, id))));
            ctx.setState(prev => ({ 
              ...prev, 
              shapes: prev.shapes.filter(s => !topSelectedIds.includes(s.id)), 
              selectedIds: [] 
            }), true);
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
    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${disabled ? 'opacity-25 cursor-not-allowed' : 'hover:bg-zinc-100/80 active:scale-[0.97]'} ${danger ? 'text-red-500 hover:bg-red-50' : 'text-zinc-700 font-medium'}`}
  >
    <div className={`${danger ? 'text-red-500' : 'text-zinc-400'}`}>{icon}</div>
    <span className="flex-1 text-left">{label}</span>
  </button>
);
