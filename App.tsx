
import React, { useState, useCallback, useMemo } from 'react';
import { 
  Square, Circle as CircleIcon, Type as TypeIcon, Image as ImageIcon,
  Sparkles, Download, Trash2, MousePointer2, ChevronRight, ChevronLeft, Zap, Languages, Undo2, Redo2
} from 'lucide-react';
import CanvasEditor from './components/CanvasEditor';
import SidePanel from './components/SidePanel';
import Toolbar from './components/Toolbar';
import { Shape, CanvasState, ShapeType, PluginContext } from './types';
import { geminiService } from './services/geminiService';
import { useTextEditPlugin } from './plugins/TextEditPlugin';
import { useSelectionPlugin } from './plugins/SelectionPlugin';
import { useTransformPlugin } from './plugins/TransformPlugin';
import { useGroupTransformPlugin } from './plugins/GroupTransformPlugin';
import { useRulerPlugin } from './plugins/RulerPlugin';
import { useSmartGuidesPlugin } from './plugins/SmartGuidesPlugin';
import { useContextMenuPlugin } from './plugins/ContextMenuPlugin';
import { I18nProvider, useTranslation, Language } from './lang/i18n';
import { useHistory } from './hooks/useHistory';

const MainApp: React.FC = () => {
  const { t, language, setLanguage } = useTranslation();

  const initialState: CanvasState = {
    shapes: [
      { id: '1', type: 'rect', x: 100, y: 100, width: 200, height: 150, rotation: 0, fill: '#3b82f6', stroke: '#2563eb', strokeWidth: 2 },
      { id: '2', type: 'circle', x: 400, y: 200, width: 100, height: 100, rotation: 0, fill: '#ef4444', stroke: '#dc2626', strokeWidth: 2 },
      { id: '3', type: 'text', x: 100, y: 300, width: 300, height: 50, rotation: 0, fill: '#ffffff', stroke: 'none', strokeWidth: 0, text: t('app.welcome'), fontSize: 24 }
    ],
    selectedIds: [],
    editingId: null,
    zoom: 1,
    offset: { x: 0, y: 0 }
  };

  const { state, setState, undo, redo, canUndo, canRedo } = useHistory(initialState);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(true);
  const [activeTool, setActiveTool] = useState<ShapeType | 'select'>('select');
  const [isProcessing, setIsProcessing] = useState(false);

  // Plugins
  const textPlugin = useTextEditPlugin();
  const selectionPlugin = useSelectionPlugin();
  const transformPlugin = useTransformPlugin();
  const groupTransformPlugin = useGroupTransformPlugin();
  const rulerPlugin = useRulerPlugin();
  const smartGuidesPlugin = useSmartGuidesPlugin();
  const contextMenuPlugin = useContextMenuPlugin();
  
  const basePlugin: any = useMemo(() => ({
    name: 'core',
    onWheel: (e: React.WheelEvent, ctx: PluginContext) => {
      if (e.ctrlKey || e.metaKey) {
        const canvas = ctx.canvas;
        if (!canvas) return true;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldX = (mouseX - ctx.state.offset.x) / ctx.state.zoom;
        const worldY = (mouseY - ctx.state.offset.y) / ctx.state.zoom;
        const delta = -e.deltaY * 0.002;
        const newZoom = Math.min(10, Math.max(0.1, ctx.state.zoom * (1 + delta)));
        const newOffsetX = mouseX - worldX * newZoom;
        const newOffsetY = mouseY - worldY * newZoom;
        ctx.setState((prev) => ({ 
          ...prev, 
          zoom: newZoom,
          offset: { x: newOffsetX, y: newOffsetY }
        }), false);
      } else {
        ctx.setState((prev) => ({
          ...prev,
          offset: { x: prev.offset.x - e.deltaX, y: prev.offset.y - e.deltaY }
        }), false);
      }
      return true;
    },
    onKeyDown: (e: KeyboardEvent, ctx: PluginContext) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) ctx.redo();
        else ctx.undo();
        return true;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
         if (ctx.state.selectedIds.length > 0 && !ctx.state.editingId) {
            ctx.setState((prev) => ({
              ...prev,
              shapes: prev.shapes.filter((s) => !prev.selectedIds.includes(s.id)),
              selectedIds: []
            }));
            return true;
         }
      }
      return false;
    }
  }), []);

  const plugins = useMemo(() => [
    basePlugin, 
    groupTransformPlugin, // 变换插件前置，优先捕获控制柄点击
    transformPlugin,      // 变换插件前置，优先捕获控制柄点击
    selectionPlugin,      // 选择插件后置，仅在未命中控制柄时处理选择/取消选择
    rulerPlugin,
    smartGuidesPlugin,
    textPlugin, 
    contextMenuPlugin
  ], [basePlugin, textPlugin, groupTransformPlugin, transformPlugin, selectionPlugin, rulerPlugin, smartGuidesPlugin, contextMenuPlugin]);

  const addShape = useCallback((type: ShapeType) => {
    const newShape: Shape = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      x: (window.innerWidth / 2 - 50 - state.offset.x) / state.zoom,
      y: (window.innerHeight / 2 - 50 - state.offset.y) / state.zoom,
      width: type === 'text' ? 200 : 100,
      height: type === 'text' ? 40 : 100,
      rotation: 0,
      fill: type === 'text' ? '#ffffff' : '#4f46e5',
      stroke: type === 'text' ? 'none' : '#4338ca',
      strokeWidth: 2,
      text: type === 'text' ? t('app.doubleClickEdit') : undefined,
      fontSize: type === 'text' ? 16 : undefined
    };
    setState(prev => ({
      ...prev,
      shapes: [...prev.shapes, newShape],
      selectedIds: [newShape.id]
    }));
    setActiveTool('select');
  }, [state.offset, state.zoom, t, setState]);

  const deleteSelected = useCallback(() => {
    if (state.selectedIds.length > 0) {
      setState(prev => ({
        ...prev,
        shapes: prev.shapes.filter(s => !prev.selectedIds.includes(s.id)),
        selectedIds: []
      }));
    }
  }, [state.selectedIds, setState]);

  const updateShape = useCallback((id: string, updates: Partial<Shape>) => {
    setState(prev => ({
      ...prev,
      shapes: prev.shapes.map(s => s.id === id ? { ...s, ...updates } : s)
    }), false);
  }, [setState]);

  const handleAiAction = async (prompt: string) => {
    setIsProcessing(true);
    try {
      const result = await geminiService.getDesignSuggestions(state.shapes, prompt, language);
      if (result && result.newElements) {
         const addedShapes: Shape[] = result.newElements.map((el: any) => ({
            id: Math.random().toString(36).substr(2, 9),
            type: el.type as ShapeType || 'rect',
            x: (el.x || 100),
            y: (el.y || 100),
            width: el.width || 100,
            height: el.height || 100,
            rotation: 0,
            fill: el.fill || '#ffffff',
            stroke: '#4338ca',
            strokeWidth: 2,
            text: el.text,
            fontSize: 16
          }));
          setState(prev => ({
            ...prev,
            shapes: [...prev.shapes, ...addedShapes],
            selectedIds: addedShapes.map(s => s.id)
          }));
      }
    } catch (e) { console.error(e); }
    finally { setIsProcessing(false); }
  };

  return (
    <div className="flex h-screen w-screen bg-zinc-950 text-zinc-100 font-inter select-none">
      <div className="flex flex-col border-r border-zinc-800 bg-zinc-900/50 backdrop-blur-md w-16 items-center py-4 gap-6 z-20">
        <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/20"><Sparkles className="w-6 h-6 text-white" /></div>
        <div className="flex flex-col gap-2">
          <ToolButton active={activeTool === 'select'} onClick={() => setActiveTool('select')} icon={<MousePointer2 className="w-5 h-5" />} label={t('tools.select')} />
          <ToolButton active={activeTool === 'rect'} onClick={() => addShape('rect')} icon={<Square className="w-5 h-5" />} label={t('tools.rect')} />
          <ToolButton active={activeTool === 'circle'} onClick={() => addShape('circle')} icon={<CircleIcon className="w-5 h-5" />} label={t('tools.circle')} />
          <ToolButton active={activeTool === 'text'} onClick={() => addShape('text')} icon={<TypeIcon className="w-5 h-5" />} label={t('tools.text')} />
          <ToolButton active={activeTool === 'image'} onClick={() => addShape('image')} icon={<ImageIcon className="w-5 h-5" />} label={t('tools.image')} />
        </div>
        <div className="mt-auto flex flex-col gap-2">
          <ToolButton onClick={deleteSelected} disabled={state.selectedIds.length === 0} icon={<Trash2 className="w-5 h-5" />} label={t('tools.delete')} danger />
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <CanvasEditor 
          state={state} setState={setState} 
          updateShape={updateShape} plugins={plugins}
          undo={undo} redo={redo}
        />
        
        {state.selectedIds.length === 1 && (
          <Toolbar 
            selectedShape={state.shapes.find(s => s.id === state.selectedIds[0])}
            onUpdate={(u) => updateShape(state.selectedIds[0], u)}
          />
        )}
        
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center pointer-events-none">
          <div className="glass-panel px-4 py-2 rounded-full flex items-center gap-4 pointer-events-auto">
             <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">{t('app.title')}</span>
             <div className="h-4 w-[1px] bg-zinc-700"></div>
             <div className="flex items-center gap-1">
               <button onClick={undo} disabled={!canUndo} className="p-1.5 hover:bg-zinc-800 rounded disabled:opacity-30"><Undo2 className="w-3.5 h-3.5" /></button>
               <button onClick={redo} disabled={!canRedo} className="p-1.5 hover:bg-zinc-800 rounded disabled:opacity-30"><Redo2 className="w-3.5 h-3.5" /></button>
             </div>
             <div className="h-4 w-[1px] bg-zinc-700"></div>
             <div className="flex items-center gap-2">
               <span className="text-[10px] w-10 text-center font-mono">{Math.round(state.zoom * 100)}%</span>
             </div>
             <div className="h-4 w-[1px] bg-zinc-700"></div>
             <button onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')} className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 hover:text-white uppercase">
               <Languages className="w-3 h-3" /> {language === 'en' ? 'EN' : '中文'}
             </button>
          </div>
          <button className="glass-panel px-4 py-2 rounded-full flex items-center gap-2 pointer-events-auto hover:bg-zinc-800 transition-all text-sm font-medium">
            <Download className="w-4 h-4" /> {t('app.export')}
          </button>
        </div>
      </div>

      <div className={`transition-all duration-300 border-l border-zinc-800 bg-zinc-900/50 backdrop-blur-md relative ${isAiPanelOpen ? 'w-80' : 'w-0'}`}>
        <button onClick={() => setIsAiPanelOpen(!isAiPanelOpen)} className="absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-12 glass-panel rounded-l-lg flex items-center justify-center hover:bg-zinc-800 transition-colors z-30">
          {isAiPanelOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
        {isAiPanelOpen && <SidePanel onAction={handleAiAction} isProcessing={isProcessing} shapes={state.shapes} />}
      </div>
    </div>
  );
};

const App: React.FC = () => (<I18nProvider><MainApp /></I18nProvider>);

const ToolButton: React.FC<any> = ({ icon, label, active, onClick, disabled, danger }) => (
  <button onClick={onClick} disabled={disabled} className={`p-3 rounded-xl transition-all group relative ${active ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'} ${disabled ? 'opacity-30' : ''} ${danger && !disabled ? 'hover:bg-red-500/20 hover:text-red-400' : ''}`}>
    {icon}
    <span className="absolute left-16 bg-zinc-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity border border-zinc-700">{label}</span>
  </button>
);

export default App;
