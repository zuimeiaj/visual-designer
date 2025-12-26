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

interface MenuState {
  x: number;
  y: number;
  visible: boolean;
}

export const useContextMenuPlugin = (): CanvasPlugin => {
  const [menu, setMenu] = useState<MenuState>({ x: 0, y: 0, visible: false });
  const { t } = useTranslation();

  const closeMenu = useCallback(() => setMenu(prev => ({ ...prev, visible: false })), []);

  // 使用延迟监听器防止菜单在开启时立即被自身的冒泡事件关闭
  useEffect(() => {
    if (menu.visible) {
      const handleGlobalClick = () => closeMenu();
      
      const timer = setTimeout(() => {
        window.addEventListener('mousedown', handleGlobalClick);
        window.addEventListener('wheel', handleGlobalClick);
        window.addEventListener('contextmenu', handleGlobalClick);
      }, 0);
      
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
    const corners = [
      { x: -hw, y: -hh }, { x: hw, y: -hh },
      { x: hw, y: hh }, { x: -hw, y: hh }
    ].map(p => ({
      x: cx + p.x * cos - p.y * sin,
      y: cy + p.x * sin + p.y * cos
    }));
    const xs = corners.map(p => p.x), ys = corners.map(p => p.y);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    // Fix: replaced 'YS' with 'ys' to resolve 'Cannot find name YS' error
    return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
  };

  const reorder = (ctx: PluginContext, type: 'front' | 'back' | 'forward' | 'backward') => {
    const { selectedIds, shapes } = ctx.state;
    if (selectedIds.length === 0) return;

    // 获取所有选中元素的顶层父节点 ID
    const topSelectedIds = Array.from(new Set(selectedIds.map(id => getTopmostParentId(shapes, id))));
    
    // 按当前在 shapes 数组中的顺序对选中的顶层 ID 进行排序，以保持其相对层级
    const sortedSelectedTopIds = [...topSelectedIds].sort((a, b) => {
      return shapes.findIndex(s => s.id === a) - shapes.findIndex(s => s.id === b);
    });

    let newShapes = [...shapes];

    if (type === 'front') {
      const selected = newShapes.filter(s => sortedSelectedTopIds.includes(s.id));
      const rest = newShapes.filter(s => !sortedSelectedTopIds.includes(s.id));
      newShapes = [...rest, ...selected];
    } 
    else if (type === 'back') {
      const selected = newShapes.filter(s => sortedSelectedTopIds.includes(s.id));
      const rest = newShapes.filter(s => !sortedSelectedTopIds.includes(s.id));
      newShapes = [...selected, ...rest];
    } 
    else if (type === 'forward') {
      // 从上往下（数组尾部往头部）处理，避免元素互相跳跃
      for (let i = sortedSelectedTopIds.length - 1; i >= 0; i--) {
        const id = sortedSelectedTopIds[i];
        const idx = newShapes.findIndex(s => s.id === id);
        if (idx < newShapes.length - 1) {
          const targetIdx = idx + 1;
          const nextShape = newShapes[targetIdx];
          // 如果上方的元素不在选中列表中，则交换
          if (!sortedSelectedTopIds.includes(nextShape.id)) {
            const item = newShapes.splice(idx, 1)[0];
            newShapes.splice(targetIdx, 0, item);
          }
        }
      }
    } 
    else if (type === 'backward') {
      // 从下往上（数组头部往尾部）处理
      for (let i = 0; i < sortedSelectedTopIds.length; i++) {
        const id = sortedSelectedTopIds[i];
        const idx = newShapes.findIndex(s => s.id === id);
        if (idx > 0) {
          const targetIdx = idx - 1;
          const prevShape = newShapes[targetIdx];
          // 如果下方的元素不在选中列表中，则交换
          if (!sortedSelectedTopIds.includes(prevShape.id)) {
            const item = newShapes.splice(idx, 1)[0];
            newShapes.splice(targetIdx, 0, item);
          }
        }
      }
    }

    ctx.setState(prev => ({ ...prev, shapes: newShapes }), true);
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
      const b = getAABB(s);
      minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
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
    ctx.setState(prev => ({
      ...prev,
      shapes: [...remainingShapes, ...group.children!],
      selectedIds: group.children!.map(s => s.id)
    }), true);
    closeMenu();
  };

  return {
    name: 'context-menu',
    onContextMenu: (e, hit, ctx) => {
      // Access preventDefault and stopPropagation from nativeEvent and CanvasEvent respectively
      if (e.nativeEvent.preventDefault) e.nativeEvent.preventDefault();
      e.stopPropagation();

      if (hit && !ctx.state.selectedIds.includes(hit.id)) {
        const tid = getTopmostParentId(ctx.state.shapes, hit.id);
        ctx.setState(prev => ({ ...prev, selectedIds: [tid] }), false);
      }
      setMenu({ x: e.clientX, y: e.clientY, visible: true });
      return true;
    },
    onRenderOverlay: (ctx) => {
      useEffect(() => {
        const handler = (e: any) => {
          if (e.detail === 'group') groupSelected(ctx);
          if (e.detail === 'ungroup') ungroupSelected(ctx);
        };
        window.addEventListener('canvas-command', handler);
        return () => window.removeEventListener('canvas-command', handler);
      }, [ctx]);

      if (!menu.visible) return null;

      const { selectedIds, shapes } = ctx.state;
      const hasSelection = selectedIds.length > 0;
      const canGroup = Array.from(new Set(selectedIds.map(id => getTopmostParentId(shapes, id)))).length >= 2;
      const canUngroup = selectedIds.length === 1 && shapes.find(s => s.id === selectedIds[0])?.type === 'group';

      return (
        <div 
          className="fixed glass-panel rounded-xl shadow-2xl border border-white/10 p-1 w-52 z-[9999] overflow-hidden animate-in fade-in zoom-in duration-100"
          style={{ left: menu.x, top: menu.y }}
          onMouseDown={e => e.stopPropagation()}
        >
          <div className="text-[10px] font-bold text-zinc-500 px-3 py-2 uppercase tracking-widest flex items-center gap-2">
            <Layers className="w-3 h-3" /> {t('menu.layer')}
          </div>
          <MenuItem icon={<ChevronUp className="w-4 h-4" />} label={t('menu.bringForward')} disabled={!hasSelection} onClick={() => reorder(ctx, 'forward')} />
          <MenuItem icon={<ArrowUp className="w-4 h-4" />} label={t('menu.bringToFront')} disabled={!hasSelection} onClick={() => reorder(ctx, 'front')} />
          <MenuItem icon={<ChevronDown className="w-4 h-4" />} label={t('menu.sendBackward')} disabled={!hasSelection} onClick={() => reorder(ctx, 'backward')} />
          <MenuItem icon={<ArrowDown className="w-4 h-4" />} label={t('menu.sendToBack')} disabled={!hasSelection} onClick={() => reorder(ctx, 'back')} />
          <div className="h-[1px] bg-white/10 my-1 mx-2" />
          {canUngroup ? (
            <MenuItem icon={<Ungroup className="w-4 h-4" />} label={t('menu.ungroup')} onClick={() => ungroupSelected(ctx)} />
          ) : (
            <MenuItem icon={<Group className="w-4 h-4" />} label={t('menu.group')} disabled={!canGroup} onClick={() => groupSelected(ctx)} />
          )}
          <div className="h-[1px] bg-white/10 my-1 mx-2" />
          <MenuItem icon={<Trash2 className="w-4 h-4" />} label={t('menu.delete')} danger disabled={!hasSelection} onClick={() => {
            const topSelectedIds = Array.from(new Set(selectedIds.map(id => getTopmostParentId(shapes, id))));
            ctx.setState(prev => ({ ...prev, shapes: prev.shapes.filter(s => !topSelectedIds.includes(s.id)), selectedIds: [] }), true);
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
    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/10 active:scale-95'} ${danger ? 'text-red-400 hover:bg-red-500/10' : 'text-zinc-200'}`}
  >
    <div className="opacity-70">{icon}</div>
    <span className="flex-1 text-left">{label}</span>
  </button>
);