
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  Square, Circle as CircleIcon, Type as TypeIcon, Image as ImageIcon, Minus,
  Download, Trash2, MousePointer2, Zap, Languages, Undo2, Redo2,
  PenTool, Table as TableIcon, Share2, Diamond as DiamondIcon
} from 'lucide-react';
import CanvasEditor from './components/CanvasEditor';
import Toolbar from './components/Toolbar';
import { Shape, CanvasState, ShapeType, PluginContext, CanvasPlugin, TableData } from './types';
import { useTextEditPlugin } from './plugins/TextEditPlugin';
import { useSelectionPlugin } from './plugins/SelectionPlugin';
import { useTransformPlugin } from './plugins/TransformPlugin';
import { useRulerPlugin } from './plugins/RulerPlugin';
import { useSmartGuidesPlugin } from './plugins/SmartGuidesPlugin';
import { useContextMenuPlugin } from './plugins/ContextMenuPlugin';
import { usePenPlugin } from './plugins/PenPlugin';
import { useImagePlugin } from './plugins/ImagePlugin';
import { useCachePlugin } from './plugins/CachePlugin';
import { useTablePlugin } from './plugins/TablePlugin';
import { useShortcutPlugin } from './plugins/ShortcutPlugin';
import { useConnectionPlugin } from './plugins/ConnectionPlugin';
import { I18nProvider, useTranslation } from './lang/i18n';
import { useHistory } from './hooks/useHistory';
import { UIShape } from './models/UIShape';

import './models';

const CACHE_KEY = 'canvas-ai-designer-shapes';

const MainApp: React.FC = () => {
  const { t, language, setLanguage } = useTranslation();

  const getInitialShapes = useCallback((): Shape[] => {
    try {
      const saved = localStorage.getItem(CACHE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load cached shapes:', e);
    }
    
    return [
      { id: '1', type: 'rect', x: 100, y: 100, width: 200, height: 150, rotation: 0, fill: '#3b82f6', stroke: '#2563eb', strokeWidth: 2 },
      { id: '2', type: 'circle', x: 400, y: 200, width: 100, height: 100, rotation: 0, fill: '#22c55e', stroke: '#16a34a', strokeWidth: 2 },
      { id: '3', type: 'text', x: 100, y: 300, width: 300, height: 50, rotation: 0, fill: '#18181b', stroke: 'none', strokeWidth: 0, text: t('app.welcome'), fontSize: 24 }
    ];
  }, [t]);

  const initialState: CanvasState = useMemo(() => ({
    shapes: getInitialShapes(),
    selectedIds: [],
    editingId: null,
    zoom: 1,
    offset: { x: 0, y: 0 },
    activeTool: 'select',
    interactionState: 'IDLE'
  }), [getInitialShapes]);

  const { state, setState, undo, redo, canUndo, canRedo } = useHistory(initialState);

  const textPlugin = useTextEditPlugin();
  const selectionPlugin = useSelectionPlugin();
  const transformPlugin = useTransformPlugin();
  const rulerPlugin = useRulerPlugin();
  const smartGuidesPlugin = useSmartGuidesPlugin();
  const contextMenuPlugin = useContextMenuPlugin();
  const penPlugin = usePenPlugin();
  const imagePlugin = useImagePlugin();
  const tablePlugin = useTablePlugin();
  const shortcutPlugin = useShortcutPlugin();
  const cachePlugin = useCachePlugin(state.shapes);
  const connectionPlugin = useConnectionPlugin();

  const plugins = useMemo(() => [
    rulerPlugin, 
    contextMenuPlugin,
    textPlugin, 
    penPlugin,
    imagePlugin,
    tablePlugin,
    cachePlugin,
    transformPlugin, 
    smartGuidesPlugin,
    selectionPlugin,
    shortcutPlugin,
    connectionPlugin
  ], [textPlugin, transformPlugin, selectionPlugin, rulerPlugin, smartGuidesPlugin, contextMenuPlugin, penPlugin, imagePlugin, cachePlugin, tablePlugin, shortcutPlugin, connectionPlugin]);

  const addShape = useCallback((type: ShapeType) => {
    const defaultTableData: TableData = {
      rows: [30, 30, 30, 30, 30],
      cols: [80, 80, 80, 80, 80],
      cells: { "0,0": { text: "Header" } },
      merges: []
    };

    const newShape: Shape = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      x: (window.innerWidth / 2 - 200 - state.offset.x) / state.zoom,
      y: (window.innerHeight / 2 - 100 - state.offset.y) / state.zoom,
      width: type === 'table' ? 400 : (type === 'text' ? 200 : (type === 'line' ? 150 : 100)),
      height: type === 'table' ? 150 : (type === 'text' ? 40 : (type === 'line' ? 2 : 100)),
      rotation: 0,
      fill: type === 'text' ? '#18181b' : (type === 'line' ? '#818cf8' : (type === 'circle' ? '#22c55e' : (type === 'diamond' ? '#f59e0b' : (type === 'table' ? '#ffffff' : '#4f46e5')))),
      stroke: type === 'text' ? 'none' : (type === 'line' ? 'none' : (type === 'circle' ? '#16a34a' : (type === 'diamond' ? '#d97706' : '#3f3f46'))),
      strokeWidth: type === 'table' ? 1 : 2,
      text: type === 'text' ? t('app.doubleClickEdit') : undefined,
      fontSize: type === 'text' ? 16 : undefined,
      tableData: type === 'table' ? defaultTableData : undefined
    };
    setState(prev => ({
      ...prev,
      shapes: [...prev.shapes, newShape],
      selectedIds: [newShape.id],
      activeTool: 'select'
    }));
  }, [state.offset, state.zoom, t, setState]);

  const toggleTool = (tool: ShapeType | 'select' | 'connect') => {
    setState(prev => ({ ...prev, activeTool: tool }), false);
  };

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

  const handleExport = useCallback(() => {
    if (state.shapes.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    const uiShapes = state.shapes.map(s => UIShape.create(s));
    uiShapes.forEach(s => {
      const aabb = s.getAABB();
      minX = Math.min(minX, aabb.x);
      minY = Math.min(minY, aabb.y);
      maxX = Math.max(maxX, aabb.x + aabb.w);
      maxY = Math.max(maxY, aabb.y + aabb.h);
    });

    const padding = 16;
    const exportWidth = (maxX - minX) + padding * 2;
    const exportHeight = (maxY - minY) + padding * 2;

    const canvas = document.createElement('canvas');
    canvas.width = exportWidth;
    canvas.height = exportHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff'; 
    ctx.fillRect(0, 0, exportWidth, exportHeight);

    ctx.save();
    ctx.translate(padding - minX, padding - minY);
    uiShapes.forEach(s => s.draw(ctx, 1));
    ctx.restore();

    const link = document.createElement('a');
    link.download = `canvas-export-${Date.now()}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.9);
    link.click();
  }, [state.shapes]);

  return (
    <div className="flex h-screen w-screen bg-zinc-50 text-zinc-900 font-inter select-none">
      <div className="flex flex-col border-r border-zinc-200 bg-white/80 backdrop-blur-md w-16 items-center py-4 gap-6 z-20 shadow-sm">
        <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/20"><Zap className="w-6 h-6 text-white" /></div>
        <div className="flex flex-col gap-2">
          <ToolButton active={state.activeTool === 'select'} onClick={() => toggleTool('select')} icon={<MousePointer2 className="w-5 h-5" />} label={t('tools.select')} />
          <ToolButton active={state.activeTool === 'connect'} onClick={() => toggleTool('connect')} icon={<Share2 className="w-5 h-5" />} label="Connect" />
          <ToolButton active={state.activeTool === 'curve'} onClick={() => toggleTool('curve')} icon={<PenTool className="w-5 h-5" />} label={t('tools.pen')} />
          <div className="h-[1px] bg-zinc-100 mx-2 my-1" />
          <ToolButton active={false} onClick={() => addShape('rect')} icon={<Square className="w-5 h-5" />} label={t('tools.rect')} />
          <ToolButton active={false} onClick={() => addShape('circle')} icon={<CircleIcon className="w-5 h-5" />} label={t('tools.circle')} />
          <ToolButton active={false} onClick={() => addShape('diamond')} icon={<DiamondIcon className="w-5 h-5" />} label={t('tools.diamond')} />
          <ToolButton active={false} onClick={() => addShape('line')} icon={<Minus className="w-5 h-5" />} label={t('tools.line')} />
          <ToolButton active={false} onClick={() => addShape('text')} icon={<TypeIcon className="w-5 h-5" />} label={t('tools.text')} />
          <ToolButton active={false} onClick={() => addShape('image')} icon={<ImageIcon className="w-5 h-5" />} label={t('tools.image')} />
          <ToolButton active={false} onClick={() => addShape('table')} icon={<TableIcon className="w-5 h-5" />} label="Table" />
        </div>
        <div className="mt-auto flex flex-col gap-2">
          <ToolButton onClick={deleteSelected} disabled={state.selectedIds.length === 0} icon={<Trash2 className="w-5 h-5" />} label={t('tools.delete')} danger />
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden bg-white">
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
          <div className="glass-panel px-4 py-2 rounded-full flex items-center gap-4 pointer-events-auto shadow-sm border-zinc-200">
             <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">{t('app.title')}</span>
             <div className="h-4 w-[1px] bg-zinc-200"></div>
             <div className="flex items-center gap-1">
               <button onClick={undo} disabled={!canUndo} className="p-1.5 hover:bg-zinc-100 text-zinc-600 rounded disabled:opacity-30"><Undo2 className="w-3.5 h-3.5" /></button>
               <button onClick={redo} disabled={!canRedo} className="p-1.5 hover:bg-zinc-100 text-zinc-600 rounded disabled:opacity-30"><Redo2 className="w-3.5 h-3.5" /></button>
             </div>
             <div className="h-4 w-[1px] bg-zinc-200"></div>
             <div className="flex items-center gap-2">
               <span className="text-[10px] font-mono w-10 text-center text-zinc-500">{Math.round(state.zoom * 100)}%</span>
             </div>
             <div className="h-4 w-[1px] bg-zinc-200"></div>
             <button onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')} className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 hover:text-indigo-600 uppercase transition-colors">
               <Languages className="w-3 h-3" /> {language === 'en' ? 'EN' : '中文'}
             </button>
          </div>
          <button 
            onClick={handleExport}
            className="glass-panel px-4 py-2 rounded-full flex items-center gap-2 pointer-events-auto hover:bg-zinc-100 transition-all text-sm font-medium shadow-sm text-zinc-700 border-zinc-200"
          >
            <Download className="w-4 h-4" /> {t('app.export')}
          </button>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => (<I18nProvider><MainApp /></I18nProvider>);

const ToolButton: React.FC<any> = ({ icon, label, active, onClick, disabled, danger }) => (
  <button onClick={onClick} disabled={disabled} className={`p-3 rounded-xl transition-all group relative ${active ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'} ${disabled ? 'opacity-30' : ''} ${danger && !disabled ? 'hover:bg-red-50 hover:text-red-500' : ''}`}>
    {icon}
    <span className="absolute left-16 bg-zinc-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity border border-zinc-700 z-[100]">{label}</span>
  </button>
);

export default App;
