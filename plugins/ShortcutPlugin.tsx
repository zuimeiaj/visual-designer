
import React, { useState } from 'react';
import { CanvasPlugin, PluginContext, Shape } from '../types';
import { Keyboard, HelpCircle, BookOpen, Code, Zap, Layers, Cpu, MousePointer, Info, ExternalLink, Terminal } from 'lucide-react';

// 模块级剪贴板
let clipboard: Shape[] = [];

export const useShortcutPlugin = (): CanvasPlugin => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'shortcuts' | 'docs'>('docs');

  const cloneShapes = (shapes: Shape[]): Shape[] => {
    const idMap = new Map<string, string>();
    const registerIds = (list: Shape[]) => {
      list.forEach(s => {
        idMap.set(s.id, Math.random().toString(36).substr(2, 9));
        if (s.children) registerIds(s.children);
      });
    };
    registerIds(shapes);

    const performClone = (list: Shape[]): Shape[] => {
      return list.map(s => ({
        ...s,
        id: idMap.get(s.id)!,
        children: s.children ? performClone(s.children) : undefined
      }));
    };
    return performClone(shapes);
  };

  const copy = (ctx: PluginContext) => {
    const selected = ctx.state.shapes.filter(s => ctx.state.selectedIds.includes(s.id));
    if (selected.length > 0) {
      clipboard = JSON.parse(JSON.stringify(selected));
    }
  };

  const paste = (ctx: PluginContext, offset = { x: 20, y: 20 }) => {
    if (clipboard.length === 0) return;
    const cloned = cloneShapes(clipboard);
    const newShapes = cloned.map(s => ({ ...s, x: s.x + offset.x, y: s.y + offset.y }));
    ctx.setState(prev => ({
      ...prev,
      shapes: [...prev.shapes, ...newShapes],
      selectedIds: newShapes.map(s => s.id)
    }), true);
  };

  return {
    name: 'shortcut',
    priority: 10,

    onKeyDown: (e: KeyboardEvent, ctx: PluginContext) => {
      if (ctx.state.editingId || (e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      const isMod = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      if (isMod && e.key === 'z') { if (shift) ctx.redo(); else ctx.undo(); e.preventDefault(); return true; }
      if (isMod && e.key === 'c') { copy(ctx); e.preventDefault(); return true; }
      if (isMod && e.key === 'x') { copy(ctx); ctx.setState(prev => ({ ...prev, shapes: prev.shapes.filter(s => !prev.selectedIds.includes(s.id)), selectedIds: [] }), true); e.preventDefault(); return true; }
      if (isMod && e.key === 'v') { paste(ctx); e.preventDefault(); return true; }
      if (isMod && e.key === 'd') {
        const selected = ctx.state.shapes.filter(s => ctx.state.selectedIds.includes(s.id));
        if (selected.length > 0) {
          const cloned = cloneShapes(selected);
          const nextShapes = cloned.map(s => ({ ...s, x: s.x + 10, y: s.y + 10 }));
          ctx.setState(prev => ({ ...prev, shapes: [...prev.shapes, ...nextShapes], selectedIds: nextShapes.map(s => s.id) }), true);
        }
        e.preventDefault();
        return true;
      }
      if (isMod && e.key === 'a') { ctx.setState(prev => ({ ...prev, selectedIds: prev.shapes.map(s => s.id) }), false); e.preventDefault(); return true; }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (ctx.state.selectedIds.length > 0) {
          ctx.setState(prev => ({ ...prev, shapes: prev.shapes.filter(s => !prev.selectedIds.includes(s.id)), selectedIds: [] }), true);
          return true;
        }
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const step = shift ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        ctx.setState(prev => ({ ...prev, shapes: prev.shapes.map(s => prev.selectedIds.includes(s.id) ? { ...s, x: s.x + dx, y: s.y + dy } : s) }), true);
        e.preventDefault();
        return true;
      }
      if (isMod && e.key === 'g') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('canvas-command', { detail: shift ? 'ungroup' : 'group' }));
        return true;
      }
      if (e.key === '?' || (isMod && e.key === '/')) { setIsOpen(prev => !prev); setActiveTab('shortcuts'); return true; }
      return false;
    },

    onRenderOverlay: () => {
      return (
        <>
          {/* Floating Action Buttons */}
          <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50">
            <button 
              onClick={() => { setIsOpen(true); setActiveTab('docs'); }}
              className="p-3 glass-panel rounded-full text-zinc-400 hover:text-indigo-600 shadow-lg hover:shadow-indigo-500/10 transition-all group"
            >
              <HelpCircle className="w-5 h-5" />
              <span className="absolute right-14 bg-zinc-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">开发者文档</span>
            </button>
            <button 
              onClick={() => { setIsOpen(true); setActiveTab('shortcuts'); }}
              className="p-3 glass-panel rounded-full text-zinc-400 hover:text-indigo-600 shadow-lg hover:shadow-indigo-500/10 transition-all group"
            >
              <Keyboard className="w-5 h-5" />
              <span className="absolute right-14 bg-zinc-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">快捷键指南</span>
            </button>
          </div>

          {/* Help Modal */}
          {isOpen && (
            <div 
              className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-zinc-900/20 backdrop-blur-sm animate-in fade-in duration-200" 
              onClick={() => setIsOpen(false)}
              onWheel={e => e.stopPropagation()}
            >
              <div className="glass-panel max-w-4xl w-full max-h-[90vh] flex flex-col rounded-3xl shadow-2xl border-white/80 animate-in zoom-in-95 duration-200 overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header & Tabs */}
                <div className="px-8 pt-8 pb-4 border-b border-zinc-100 shrink-0">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-xl font-bold text-zinc-800 flex items-center gap-2">
                        {activeTab === 'shortcuts' ? <Keyboard className="w-6 h-6 text-indigo-500" /> : <BookOpen className="w-6 h-6 text-indigo-500" />}
                        CanvasAI SDK & 开发者文档
                      </h3>
                      <p className="text-xs text-zinc-400 font-medium">版本 2.0.4-preview | 基于 Gemini 3 系列引擎</p>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-100 transition-colors text-zinc-400 hover:text-zinc-600 text-lg">✕</button>
                  </div>
                  <div className="flex gap-4">
                    <TabButton active={activeTab === 'shortcuts'} onClick={() => setActiveTab('shortcuts')} icon={<Keyboard className="w-4 h-4" />} label="快捷键指南" />
                    <TabButton active={activeTab === 'docs'} onClick={() => setActiveTab('docs')} icon={<Code className="w-4 h-4" />} label="插件与图形开发" />
                  </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar scroll-smooth">
                  {activeTab === 'shortcuts' ? (
                    <div className="max-w-2xl mx-auto space-y-6">
                      <div className="grid grid-cols-2 gap-8">
                        <div>
                          <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">编辑操作</h4>
                          <div className="space-y-4">
                            <ShortcutRow label="复制 / 粘贴" keys={['⌘ C', '⌘ V']} />
                            <ShortcutRow label="剪切 / 克隆" keys={['⌘ X', '⌘ D']} />
                            <ShortcutRow label="撤销 / 重做" keys={['⌘ Z', '⇧ ⌘ Z']} />
                            <ShortcutRow label="删除选中" keys={['Delete']} />
                          </div>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">视图与组织</h4>
                          <div className="space-y-4">
                            <ShortcutRow label="组合 / 取消组合" keys={['⌘ G', '⇧ ⌘ G']} />
                            <ShortcutRow label="全选元素" keys={['⌘ A']} />
                            <ShortcutRow label="切换标尺" keys={['R']} />
                            <ShortcutRow label="显示帮助" keys={['?']} />
                          </div>
                        </div>
                      </div>
                      <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex items-start gap-3">
                        <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-indigo-700 leading-relaxed">
                          提示：按住 <b>Shift</b> 键拖动可以进行多选，按住 <b>Space</b> 或鼠标中键可以平移画布。
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-12 animate-in slide-in-from-bottom-4 duration-300">
                      
                      {/* Section 1: Events */}
                      <DocSection title="插件事件系统" icon={<Terminal className="w-5 h-5 text-indigo-500" />}>
                        <p className="text-sm text-zinc-600 leading-relaxed mb-6">
                          <code>CanvasPlugin</code> 接口定义了与编辑器交互的所有钩子。所有事件均支持 <b>消费机制 (consume)</b>，一旦被高优先级插件消费，后续插件将不再收到该事件。
                        </p>
                        
                        <div className="space-y-6">
                          <div>
                            <h5 className="text-[11px] font-bold text-zinc-400 uppercase mb-3">交互事件 (Interaction Hooks)</h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <EventCard name="onMouseDown" desc="鼠标按下时触发，返回点击位置和命中的 UIShape。" />
                              <EventCard name="onKeyDown" desc="键盘按下时触发。注意：在编辑模式下通常应跳过非系统快捷键。" />
                              <EventCard name="onTransformUpdate" desc="当元素被移动、缩放或旋转时持续触发。常用于实现吸附或约束。" />
                              <EventCard name="onDoubleClick" desc="双击触发。系统默认用于触发 onEditModeEnter。" />
                            </div>
                          </div>

                          <div>
                            <h5 className="text-[11px] font-bold text-zinc-400 uppercase mb-3">渲染生命周期 (Rendering)</h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <EventCard name="onRenderBackground" desc="在所有图形绘制前执行，适合绘制网格、标尺或背景。坐标系为 Raw Canvas 空间。" />
                              <EventCard name="onRenderOverlay" desc="渲染顶层 UI。返回 ReactNode，适合实现弹出框、编辑器或浮动菜单。" />
                            </div>
                          </div>
                        </div>
                      </DocSection>

                      {/* Section 2: Custom Shapes */}
                      <DocSection title="自定义图形实现 (Custom Shapes)" icon={<Layers className="w-5 h-5 text-indigo-500" />}>
                        <p className="text-sm text-zinc-600 leading-relaxed mb-6">
                          要实现一个新图形，需继承 <code>UIShape</code> 基类并在 <code>models/index.ts</code> 中注册。
                        </p>
                        
                        <div className="space-y-6">
                          <div className="bg-zinc-900 rounded-2xl p-6 font-mono text-[11px] text-zinc-300 overflow-x-auto border border-white/5">
                            <span className="text-zinc-500">// 1. 定义类并实现 onDraw</span><br/>
                            <span className="text-indigo-400">class</span> MyShape <span className="text-indigo-400">extends</span> UIShape &#123;<br/>
                            &nbsp;&nbsp;<span className="text-indigo-400">public</span> <span className="text-emerald-400">onDraw</span>(ctx: CanvasRenderingContext2D, zoom: number) &#123;<br/>
                            &nbsp;&nbsp;&nbsp;&nbsp;ctx.fillStyle = <span className="text-amber-400">this.fill</span>;<br/>
                            &nbsp;&nbsp;&nbsp;&nbsp;ctx.<span className="text-emerald-400">fillRect</span>(<span className="text-amber-400">this.x, this.y, this.width, this.height</span>);<br/>
                            &nbsp;&nbsp;&#125;<br/><br/>
                            &nbsp;&nbsp;<span className="text-zinc-500">// 2. 重写 transform 以处理特殊缩放逻辑</span><br/>
                            &nbsp;&nbsp;<span className="text-indigo-400">public</span> <span className="text-emerald-400">transform</span>(params: TransformParams): Partial&lt;Shape&gt; &#123;<br/>
                            &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-indigo-400">const</span> updates = <span className="text-indigo-400">super</span>.transform(params);<br/>
                            &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-zinc-500">// 示例：强制保持正方形</span><br/>
                            &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-indigo-400">if</span> (updates.width) updates.height = updates.width;<br/>
                            &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-indigo-400">return</span> updates;<br/>
                            &nbsp;&nbsp;&#125;<br/>
                            &#125;<br/><br/>
                            <span className="text-zinc-500">// 3. 工厂注册</span><br/>
                            UIShape.<span className="text-emerald-400">register</span>(<span className="text-amber-400">'myshape'</span>, MyShape);
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-100">
                              <h6 className="text-sm font-bold text-zinc-800 flex items-center gap-2 mb-2">
                                <MousePointer className="w-4 h-4 text-indigo-500" /> 碰撞检测 (Hit Testing)
                              </h6>
                              <p className="text-xs text-zinc-500 leading-relaxed">
                                默认使用 <b>AABB (矩形包围盒)</b> 进行碰撞检测。对于不规则图形（如路径或圆），应重写 <code>hitTest(px, py)</code> 方法以提供精确的交互热点。
                              </p>
                            </div>
                            <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-100">
                              <h6 className="text-sm font-bold text-zinc-800 flex items-center gap-2 mb-2">
                                <Zap className="w-4 h-4 text-amber-500" /> 编辑模式处理
                              </h6>
                              <p className="text-xs text-zinc-500 leading-relaxed">
                                不要将编辑器逻辑写在 <code>onDraw</code> 中。应通过插件的 <code>onEditModeEnter</code> 捕获事件，并在 <code>onRenderOverlay</code> 中渲染 HTML 覆盖层（如文本输入框）。
                              </p>
                            </div>
                          </div>
                        </div>
                      </DocSection>

                      {/* Section 3: Notes */}
                      <DocSection title="高级注意事项" icon={<Cpu className="w-5 h-5 text-emerald-500" />}>
                        <ul className="space-y-4">
                          <li className="flex gap-4">
                            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 font-bold text-xs">01</div>
                            <div>
                              <p className="text-sm font-bold text-zinc-800">坐标系转换</p>
                              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">所有 Plugin 事件中的 <code>x, y</code> 已自动转换为<b>世界坐标系</b>。绘制 Raw UI (不受缩放影响的元素) 时，请在渲染前重置 <code>setTransform(1,0,0,1,0,0)</code>。</p>
                            </div>
                          </li>
                          <li className="flex gap-4">
                            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 font-bold text-xs">02</div>
                            <div>
                              <p className="text-sm font-bold text-zinc-800">渲染性能优化</p>
                              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">主渲染循环使用 <code>requestAnimationFrame</code>。尽量避免在 <code>onDraw</code> 中进行复杂的计算或分配对象，所有状态更新应通过 <code>ctx.setState</code> 驱动。</p>
                            </div>
                          </li>
                          <li className="flex gap-4">
                            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 font-bold text-xs">03</div>
                            <div>
                              <p className="text-sm font-bold text-zinc-800">AI 设计原则</p>
                              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">调用 <code>GeminiService</code> 时，请确保传入清晰的 JSON Schema。对于生成的图像资产，建议先作为 <code>isTemporary</code> 占位符渲染，待下载完成后再更新 <code>src</code>。</p>
                            </div>
                          </li>
                        </ul>
                      </DocSection>
                    </div>
                  )}
                </div>

                <div className="p-6 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between shrink-0">
                   <div className="flex items-center gap-4">
                    <a href="https://github.com/google-gemini/generative-ai-js" target="_blank" className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-indigo-600 transition-colors">
                      <ExternalLink className="w-3 h-3" /> Gemini SDK Docs
                    </a>
                   </div>
                   <button 
                    onClick={() => setIsOpen(false)}
                    className="px-8 py-2.5 bg-zinc-900 text-white rounded-2xl text-sm font-bold hover:bg-zinc-800 shadow-xl shadow-zinc-900/10 transition-all active:scale-95"
                  >
                    准备开始设计
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      );
    }
  };
};

const TabButton: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, label: string }> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50'}`}
  >
    {icon} {label}
  </button>
);

const ShortcutRow: React.FC<{ label: string, keys: string[] }> = ({ label, keys }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-zinc-50 last:border-0">
    <span className="text-sm text-zinc-500 font-medium">{label}</span>
    <div className="flex gap-2">
      {keys.map(k => (
        <kbd key={k} className="px-2 py-1.5 bg-white border border-zinc-200 rounded-lg text-[10px] font-mono text-zinc-600 shadow-sm">{k}</kbd>
      ))}
    </div>
  </div>
);

const EventCard: React.FC<{ name: string, desc: string }> = ({ name, desc }) => (
  <div className="p-4 bg-white border border-zinc-100 rounded-2xl hover:border-indigo-200 transition-colors group">
    <div className="text-xs font-mono font-bold text-indigo-600 mb-1 group-hover:text-indigo-500">{name}</div>
    <p className="text-[11px] text-zinc-500 leading-relaxed">{desc}</p>
  </div>
);

const DocSection: React.FC<{ title: string, icon: React.ReactNode, children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
    <h4 className="flex items-center gap-2 text-base font-bold text-zinc-800 mb-4 pb-2 border-b border-zinc-50">
      <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
        {icon}
      </div>
      {title}
    </h4>
    {children}
  </div>
);
