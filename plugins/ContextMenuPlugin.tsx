
import React, { useState, useEffect } from 'react';
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

interface MenuState {
  x: number;
  y: number;
  visible: boolean;
}

export const useContextMenuPlugin = (): CanvasPlugin => {
  const [menu, setMenu] = useState<MenuState>({ x: 0, y: 0, visible: false });
  const { t } = useTranslation();

  const closeMenu = () => setMenu(prev => ({ ...prev, visible: false }));

  useEffect(() => {
    if (menu.visible) {
      const handleGlobalClick = () => closeMenu();
      window.addEventListener('mousedown', handleGlobalClick);
      return () => window.removeEventListener('mousedown', handleGlobalClick);
    }
  }, [menu.visible]);

  const moveLayer = (ctx: PluginContext, direction: 'up' | 'down' | 'top' | 'bottom') => {
    const { selectedIds, shapes } = ctx.state;
    if (selectedIds.length === 0) return;

    let newShapes = [...shapes];
    
    // Multi-selection layer movement logic
    const selectedIndices = selectedIds
      .map(id => newShapes.findIndex(s => s.id === id))
      .filter(idx => idx !== -1)
      .sort((a, b) => a - b);

    if (selectedIndices.length === 0) return;

    const itemsToMove = selectedIndices.map(idx => newShapes[idx]);
    const others = newShapes.filter(s => !selectedIds.includes(s.id));

    switch (direction) {
      case 'top':
        newShapes = [...others, ...itemsToMove];
        break;
      case 'bottom':
        newShapes = [...itemsToMove, ...others];
        break;
      case 'up': {
        const lastIdx = selectedIndices[selectedIndices.length - 1];
        if (lastIdx < newShapes.length - 1) {
          // Move the whole block one step up
          const targetIndex = lastIdx + 1;
          const result: Shape[] = [];
          let moveCounter = 0;
          for (let i = 0; i < newShapes.length; i++) {
            if (selectedIds.includes(newShapes[i].id)) continue;
            result.push(newShapes[i]);
            if (result.length === targetIndex - selectedIndices.length + 1) {
              result.push(...itemsToMove);
            }
          }
          // If the target was beyond the current loop, push it at the end
          if (result.length < newShapes.length) {
             itemsToMove.forEach(item => {
               if(!result.includes(item)) result.push(item);
             });
          }
          newShapes = result;
        }
        break;
      }
      case 'down': {
        const firstIdx = selectedIndices[0];
        if (firstIdx > 0) {
          const targetIndex = firstIdx - 1;
          const result: Shape[] = [];
          for (let i = 0; i < newShapes.length; i++) {
            if (selectedIds.includes(newShapes[i].id)) continue;
            if (result.length === targetIndex) {
              result.push(...itemsToMove);
            }
            result.push(newShapes[i]);
          }
          newShapes = result;
        }
        break;
      }
    }

    ctx.setState(prev => ({ ...prev, shapes: newShapes }), true);
    closeMenu();
  };

  const groupSelected = (ctx: PluginContext) => {
    const { selectedIds, shapes } = ctx.state;
    if (selectedIds.length < 2) return;

    const groupMembers = shapes.filter(s => selectedIds.includes(s.id));
    const remainingShapes = shapes.filter(s => !selectedIds.includes(s.id));

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    groupMembers.forEach(s => {
      minX = Math.min(minX, s.x);
      minY = Math.min(minY, s.y);
      maxX = Math.max(maxX, s.x + s.width);
      maxY = Math.max(maxY, s.y + s.height);
    });

    const newGroup: Shape = {
      id: 'group-' + Math.random().toString(36).substr(2, 9),
      type: 'group',
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      rotation: 0,
      fill: 'transparent',
      stroke: 'none',
      strokeWidth: 0,
      children: groupMembers
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

    const remainingShapes = shapes.filter(s => s.id !== id);
    const dissolvedShapes = group.children;

    ctx.setState(prev => ({
      ...prev,
      shapes: [...remainingShapes, ...dissolvedShapes],
      selectedIds: dissolvedShapes.map(s => s.id)
    }), true);
    closeMenu();
  };

  return {
    name: 'context-menu',
    onContextMenu: (e, hit, ctx) => {
      if (hit && !ctx.state.selectedIds.includes(hit.id)) {
        ctx.setState(prev => ({ ...prev, selectedIds: [hit.id] }), false);
      }
      setMenu({ x: e.clientX, y: e.clientY, visible: true });
      return true;
    },
    onRenderOverlay: (ctx) => {
      if (!menu.visible) return null;

      const { selectedIds, shapes } = ctx.state;
      const isMulti = selectedIds.length > 1;
      const hasSelection = selectedIds.length > 0;
      const isGroup = firstSelectionIsGroup(ctx);

      return (
        <div 
          className="fixed glass-panel rounded-xl shadow-2xl border border-white/10 p-1 w-52 z-[9999] overflow-hidden animate-in fade-in zoom-in duration-100"
          style={{ left: menu.x, top: menu.y }}
          onMouseDown={e => e.stopPropagation()}
        >
          <div className="text-[10px] font-bold text-zinc-500 px-3 py-2 uppercase tracking-widest flex items-center gap-2">
            <Layers className="w-3 h-3" /> {t('menu.layer')}
          </div>
          
          <MenuItem 
            icon={<ChevronUp className="w-4 h-4" />} 
            label={t('menu.bringForward')} 
            disabled={!hasSelection} 
            onClick={() => moveLayer(ctx, 'up')} 
          />
          <MenuItem 
            icon={<ArrowUp className="w-4 h-4" />} 
            label={t('menu.bringToFront')} 
            disabled={!hasSelection} 
            onClick={() => moveLayer(ctx, 'top')} 
          />
          <MenuItem 
            icon={<ChevronDown className="w-4 h-4" />} 
            label={t('menu.sendBackward')} 
            disabled={!hasSelection} 
            onClick={() => moveLayer(ctx, 'down')} 
          />
          <MenuItem 
            icon={<ArrowDown className="w-4 h-4" />} 
            label={t('menu.sendToBack')} 
            disabled={!hasSelection} 
            onClick={() => moveLayer(ctx, 'bottom')} 
          />

          <div className="h-[1px] bg-white/10 my-1 mx-2" />

          {isMulti ? (
            <MenuItem 
              icon={<Group className="w-4 h-4" />} 
              label={t('menu.group')} 
              onClick={() => groupSelected(ctx)} 
            />
          ) : isGroup ? (
            <MenuItem 
              icon={<Ungroup className="w-4 h-4" />} 
              label={t('menu.ungroup')} 
              onClick={() => ungroupSelected(ctx)} 
            />
          ) : (
            <MenuItem 
              icon={<Group className="w-4 h-4" />} 
              label={t('menu.group')} 
              disabled={true} 
            />
          )}

          <div className="h-[1px] bg-white/10 my-1 mx-2" />
          
          <MenuItem 
            icon={<Trash2 className="w-4 h-4" />} 
            label={t('menu.delete')} 
            danger 
            disabled={!hasSelection}
            onClick={() => {
              ctx.setState(prev => ({
                ...prev,
                shapes: prev.shapes.filter(s => !selectedIds.includes(s.id)),
                selectedIds: []
              }), true);
              closeMenu();
            }} 
          />
        </div>
      );
    }
  };
};

const MenuItem: React.FC<{ 
  icon: React.ReactNode, 
  label: string, 
  onClick?: () => void, 
  disabled?: boolean,
  danger?: boolean 
}> = ({ icon, label, onClick, disabled, danger }) => (
  <button 
    disabled={disabled}
    onClick={onClick}
    className={`
      w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all
      ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/10 active:scale-95'}
      ${danger ? 'text-red-400 hover:bg-red-500/10' : 'text-zinc-200'}
    `}
  >
    <div className="opacity-70">{icon}</div>
    <span className="flex-1 text-left">{label}</span>
  </button>
);

const firstSelectionIsGroup = (ctx: PluginContext) => {
  if (ctx.state.selectedIds.length !== 1) return false;
  const s = ctx.state.shapes.find(s => s.id === ctx.state.selectedIds[0]);
  return s?.type === 'group';
};
