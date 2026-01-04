
import React, { useState } from 'react';
import { CanvasPlugin, PluginContext, Shape } from '../types';
import { Keyboard, HelpCircle, BookOpen, Code, Zap, Layers, Cpu, MousePointer, Info, ExternalLink, Terminal } from 'lucide-react';

// 模块级剪贴板，存储原始形状副本
let clipboard: Shape[] = [];

export const useShortcutPlugin = (): CanvasPlugin => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'shortcuts' | 'docs'>('docs');

  /**
   * 拓扑感知克隆核心算法
   */
  const performSmartClone = (sourceShapes: Shape[], currentCanvasShapes: Shape[], offset: { x: number, y: number }): Shape[] => {
    // 1. 建立 [旧ID -> 新ID] 的映射表（仅针对非连线元素）
    const idMap = new Map<string, string>();
    sourceShapes.forEach(s => {
      if (s.type !== 'connection') {
        idMap.set(s.id, Math.random().toString(36).substr(2, 9));
      }
    });

    // 2. 执行克隆逻辑
    return sourceShapes.map(s => {
      const isConnection = s.type === 'connection';
      const newId = isConnection ? ('conn-' + Math.random().toString(36).substr(2, 9)) : idMap.get(s.id)!;
      
      // 基础克隆
      const cloned: Shape = {
        ...s,
        id: newId,
        // 如果是组，递归处理子元素（目前暂简处理一级）
        children: s.children ? JSON.parse(JSON.stringify(s.children)) : undefined 
      };

      if (isConnection) {
        /**
         * 连线逻辑重映射：
         * - 如果 sourceId 对应的节点也被复制了，则连向新副本 (idMap.get)
         * - 如果没有被复制，则保持连向原有的节点 (s.fromId)
         */
        const newFromId = s.fromId ? (idMap.get(s.fromId) || s.fromId) : null;
        const newToId = s.toId ? (idMap.get(s.toId) || s.toId) : null;

        // 安全性校验：确保连接的目标节点在画布上确实存在
        const fromExists = currentCanvasShapes.some(cs => cs.id === newFromId) || idMap.has(s.fromId || '');
        const toExists = currentCanvasShapes.some(cs => cs.id === newToId) || idMap.has(s.toId || '');

        if (newFromId && newToId && fromExists && toExists) {
          cloned.fromId = newFromId;
          cloned.toId = newToId;
        } else {
          // 如果连接失效（指向了不存在的 ID），则标记为无效
          (cloned as any)._invalid = true;
        }
      } else {
        // 非连线元素应用位置偏移
        cloned.x += offset.x;
        cloned.y += offset.y;
      }

      return cloned;
    }).filter(s => !(s as any)._invalid);
  };

  const copy = (ctx: PluginContext) => {
    const { selectedIds, shapes } = ctx.state;
    if (selectedIds.length === 0) return;

    // 1. 获取明确选中的非连线元素
    const selectedNodes = shapes.filter(s => selectedIds.includes(s.id) && s.type !== 'connection');
    
    // 2. 自动获取关联的连线：只要连线的任意一端在选中范围内，就加入剪贴板
    const associatedLines = shapes.filter(s => 
      s.type === 'connection' && 
      s.fromId && s.toId && 
      (selectedIds.includes(s.fromId) || selectedIds.includes(s.toId))
    );

    // 合并存储，去重
    const finalSelection = [...selectedNodes];
    associatedLines.forEach(line => {
      if (!finalSelection.find(fs => fs.id === line.id)) {
        finalSelection.push(line);
      }
    });

    if (finalSelection.length > 0) {
      clipboard = JSON.parse(JSON.stringify(finalSelection));
    }
  };

  const paste = (ctx: PluginContext, offset = { x: 40, y: 40 }) => {
    if (clipboard.length === 0) return;
    
    const newShapes = performSmartClone(clipboard, ctx.state.shapes, offset);

    ctx.setState(prev => ({
      ...prev,
      shapes: [...prev.shapes, ...newShapes],
      selectedIds: newShapes.filter(s => s.type !== 'connection').map(s => s.id)
    }), true);
  };

  return {
    name: 'shortcut',
    priority: 10,

    onKeyDown: (e: KeyboardEvent, ctx: PluginContext) => {
      if (ctx.state.editingId || (e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      
      const isMod = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      // 撤销/重做
      if (isMod && e.key === 'z') { 
        if (shift) ctx.redo(); else ctx.undo(); 
        e.preventDefault(); 
        return true; 
      }

      // 复制
      if (isMod && e.key === 'c') { 
        copy(ctx); 
        e.preventDefault(); 
        return true; 
      }

      // 剪切
      if (isMod && e.key === 'x') { 
        copy(ctx); 
        ctx.setState(prev => ({ 
          ...prev, 
          shapes: prev.shapes.filter(s => !prev.selectedIds.includes(s.id)), 
          selectedIds: [] 
        }), true); 
        e.preventDefault(); 
        return true; 
      }

      // 粘贴
      if (isMod && e.key === 'v') { 
        paste(ctx); 
        e.preventDefault(); 
        return true; 
      }

      // 智能克隆 (Duplicate)
      if (isMod && e.key === 'd') {
        copy(ctx);
        paste(ctx, { x: 20, y: 20 });
        e.preventDefault();
        return true;
      }

      // 全选
      if (isMod && e.key === 'a') { 
        ctx.setState(prev => ({ ...prev, selectedIds: prev.shapes.map(s => s.id) }), false); 
        e.preventDefault(); 
        return true; 
      }
      
      // 删除
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (ctx.state.selectedIds.length > 0) {
          ctx.setState(prev => ({ 
            ...prev, 
            shapes: prev.shapes.filter(s => !prev.selectedIds.includes(s.id)), 
            selectedIds: [] 
          }), true);
          return true;
        }
      }

      // 方向键微调
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const step = shift ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        ctx.setState(prev => ({ 
          ...prev, 
          shapes: prev.shapes.map(s => prev.selectedIds.includes(s.id) ? { ...s, x: s.x + dx, y: s.y + dy } : s) 
        }), true);
        e.preventDefault();
        return true;
      }

      // 帮助
      if (e.key === '?' || (isMod && e.key === '/')) { 
        setIsOpen(prev => !prev); 
        setActiveTab('shortcuts'); 
        return true; 
      }

      return false;
    },

    onRenderOverlay: () => {
      if (!isOpen) return null;
      return (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-zinc-900/20 backdrop-blur-sm animate-in fade-in duration-200" 
          onClick={() => setIsOpen(false)}
        >
          <div className="glass-panel max-w-4xl w-full max-h-[90vh] flex flex-col rounded-3xl shadow-2xl border-white/80 animate-in zoom-in-95 duration-200 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-8 pt-8 pb-4 border-b border-zinc-100 shrink-0">
              <div className="flex items-center justify-between mb-6">
                <div className="flex flex-col gap-1">
                  <h3 className="text-xl font-bold text-zinc-800 flex items-center gap-2">
                    智能复制 2.2.0 <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
                  </h3>
                  <p className="text-xs text-zinc-400 font-medium tracking-tight uppercase">Topology-Aware Cloning Enabled</p>
                </div>
                <button onClick={() => setIsOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-100 transition-colors text-zinc-400 hover:text-zinc-600 text-lg">✕</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <div className="max-w-2xl mx-auto space-y-10">
                <section>
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6">连接关系克隆说明</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-5 bg-zinc-50 border border-zinc-100 rounded-2xl">
                      <div className="text-sm font-bold text-zinc-800 mb-2">继承模式 (Inherit)</div>
                      <p className="text-xs text-zinc-500 leading-relaxed">如果你只复制一个有连接的节点，副本将自动连回原有的目标节点。适合快速创建分支。</p>
                    </div>
                    <div className="p-5 bg-zinc-50 border border-zinc-100 rounded-2xl">
                      <div className="text-sm font-bold text-zinc-800 mb-2">结构模式 (Structural)</div>
                      <p className="text-xs text-zinc-500 leading-relaxed">如果你同时复制两个相连的节点，副本之间会自动建立连接，保持内部逻辑结构完整。</p>
                    </div>
                  </div>
                </section>

                <section>
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6">核心快捷键</h4>
                  <div className="grid grid-cols-2 gap-x-12 gap-y-4">
                    <div className="flex items-center justify-between py-2 border-b border-zinc-50">
                      <span className="text-sm text-zinc-500">复制 (含拓扑)</span>
                      <kbd className="px-2 py-1 bg-white border border-zinc-200 rounded text-[10px] font-mono shadow-sm">⌘ C</kbd>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-zinc-50">
                      <span className="text-sm text-zinc-500">智能粘贴</span>
                      <kbd className="px-2 py-1 bg-white border border-zinc-200 rounded text-[10px] font-mono shadow-sm">⌘ V</kbd>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-zinc-50">
                      <span className="text-sm text-zinc-500">快速克隆</span>
                      <kbd className="px-2 py-1 bg-white border border-zinc-200 rounded text-[10px] font-mono shadow-sm">⌘ D</kbd>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-zinc-50">
                      <span className="text-sm text-zinc-500">撤销操作</span>
                      <kbd className="px-2 py-1 bg-white border border-zinc-200 rounded text-[10px] font-mono shadow-sm">⌘ Z</kbd>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div className="p-6 bg-zinc-50 border-t border-zinc-100 flex items-center justify-end shrink-0">
              <button 
                onClick={() => setIsOpen(false)}
                className="px-8 py-2.5 bg-zinc-900 text-white rounded-2xl text-sm font-bold hover:bg-zinc-800 transition-all active:scale-95"
              >
                开始高效创作
              </button>
            </div>
          </div>
        </div>
      );
    }
  };
};
