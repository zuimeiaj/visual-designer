
import React, { useState, useCallback, useMemo } from 'react';
import { 
  Square, 
  Circle as CircleIcon, 
  Type as TypeIcon, 
  Image as ImageIcon,
  Sparkles,
  Download,
  Trash2,
  MousePointer2,
  ChevronRight,
  ChevronLeft,
  Zap
} from 'lucide-react';
import CanvasEditor from './components/CanvasEditor';
import SidePanel from './components/SidePanel';
import Toolbar from './components/Toolbar';
import { Shape, CanvasState, ShapeType } from './types';
import { geminiService } from './services/geminiService';
import { useTextEditPlugin } from './plugins/TextEditPlugin';

const App: React.FC = () => {
  const [state, setState] = useState<CanvasState>({
    shapes: [
      { id: '1', type: 'rect', x: 100, y: 100, width: 200, height: 150, rotation: 0, fill: '#3b82f6', stroke: '#2563eb', strokeWidth: 2 },
      { id: '2', type: 'circle', x: 400, y: 200, width: 100, height: 100, rotation: 0, fill: '#ef4444', stroke: '#dc2626', strokeWidth: 2 },
      { id: '3', type: 'text', x: 100, y: 300, width: 300, height: 50, rotation: 0, fill: '#ffffff', stroke: 'none', strokeWidth: 0, text: 'Welcome to CanvasAI', fontSize: 24 }
    ],
    selectedId: null,
    editingId: null,
    zoom: 1,
    offset: { x: 0, y: 0 }
  });

  const [isAiPanelOpen, setIsAiPanelOpen] = useState(true);
  const [activeTool, setActiveTool] = useState<ShapeType | 'select'>('select');
  const [isProcessing, setIsProcessing] = useState(false);

  // Initialize plugins correctly as hooks
  const textPlugin = useTextEditPlugin();
  const plugins = useMemo(() => [textPlugin], [textPlugin]);

  const addShape = useCallback((type: ShapeType) => {
    const newShape: Shape = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      x: 200 - state.offset.x,
      y: 200 - state.offset.y,
      width: type === 'text' ? 200 : 100,
      height: type === 'text' ? 40 : 100,
      rotation: 0,
      fill: type === 'text' ? '#ffffff' : '#4f46e5',
      stroke: type === 'text' ? 'none' : '#4338ca',
      strokeWidth: 2,
      text: type === 'text' ? 'Double click to edit' : undefined,
      fontSize: type === 'text' ? 16 : undefined
    };
    setState(prev => ({
      ...prev,
      shapes: [...prev.shapes, newShape],
      selectedId: newShape.id
    }));
    setActiveTool('select');
  }, [state.offset]);

  const deleteSelected = useCallback(() => {
    if (state.selectedId) {
      setState(prev => ({
        ...prev,
        shapes: prev.shapes.filter(s => s.id !== prev.selectedId),
        selectedId: null,
        editingId: prev.editingId === prev.selectedId ? null : prev.editingId
      }));
    }
  }, [state.selectedId]);

  const updateShape = useCallback((id: string, updates: Partial<Shape>) => {
    setState(prev => ({
      ...prev,
      shapes: prev.shapes.map(s => s.id === id ? { ...s, ...updates } : s)
    }));
  }, []);

  const handleAiAction = async (prompt: string) => {
    setIsProcessing(true);
    try {
      if (prompt.toLowerCase().includes('generate image') || prompt.toLowerCase().includes('draw a')) {
        const imageUrl = await geminiService.generateAsset(prompt);
        if (imageUrl) {
          const newShape: Shape = {
            id: Math.random().toString(36).substr(2, 9),
            type: 'image',
            x: 250 - state.offset.x,
            y: 250 - state.offset.y,
            width: 300,
            height: 300,
            rotation: 0,
            fill: 'transparent',
            stroke: 'none',
            strokeWidth: 0,
            src: imageUrl
          };
          setState(prev => ({
            ...prev,
            shapes: [...prev.shapes, newShape],
            selectedId: newShape.id
          }));
        }
      } else {
        const result = await geminiService.getDesignSuggestions(state.shapes, prompt);
        if (result && result.newElements) {
          const addedShapes: Shape[] = result.newElements.map((el: any) => ({
            id: Math.random().toString(36).substr(2, 9),
            type: el.type as ShapeType || 'rect',
            x: (el.x || 100) - state.offset.x,
            y: (el.y || 100) - state.offset.y,
            width: el.width || 100,
            height: el.height || 100,
            rotation: 0,
            fill: el.fill || '#ffffff',
            stroke: '#000000',
            strokeWidth: 1,
            text: el.text,
            fontSize: 16
          }));
          setState(prev => ({
            ...prev,
            shapes: [...prev.shapes, ...addedShapes]
          }));
        }
      }
    } catch (error) {
      console.error("AI Action Error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-zinc-950 text-zinc-100 selection:bg-indigo-500/30">
      <div className="flex flex-col border-r border-zinc-800 bg-zinc-900/50 backdrop-blur-md w-16 items-center py-4 gap-6 z-20">
        <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/20">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        
        <div className="flex flex-col gap-2">
          <ToolButton 
            active={activeTool === 'select'} 
            onClick={() => setActiveTool('select')}
            icon={<MousePointer2 className="w-5 h-5" />}
            label="Select"
          />
          <ToolButton 
            active={activeTool === 'rect'} 
            onClick={() => addShape('rect')}
            icon={<Square className="w-5 h-5" />}
            label="Rectangle"
          />
          <ToolButton 
            active={activeTool === 'circle'} 
            onClick={() => addShape('circle')}
            icon={<CircleIcon className="w-5 h-5" />}
            label="Circle"
          />
          <ToolButton 
            active={activeTool === 'text'} 
            onClick={() => addShape('text')}
            icon={<TypeIcon className="w-5 h-5" />}
            label="Text"
          />
          <ToolButton 
            active={activeTool === 'image'} 
            onClick={() => addShape('image')}
            icon={<ImageIcon className="w-5 h-5" />}
            label="Image"
          />
        </div>

        <div className="mt-auto flex flex-col gap-2">
          <ToolButton 
            onClick={deleteSelected}
            disabled={!state.selectedId}
            icon={<Trash2 className="w-5 h-5" />}
            label="Delete"
            danger
          />
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden bg-[radial-gradient(#1e1e24_1px,transparent_1px)] [background-size:24px_24px]">
        <CanvasEditor 
          state={state} 
          setState={setState} 
          updateShape={updateShape}
          plugins={plugins}
        />
        
        <Toolbar 
          selectedShape={state.shapes.find(s => s.id === state.selectedId)}
          onUpdate={(updates) => state.selectedId && updateShape(state.selectedId, updates)}
        />
        
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center pointer-events-none">
          <div className="glass-panel px-4 py-2 rounded-full flex items-center gap-4 pointer-events-auto">
             <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">CanvasAI Designer</span>
             <div className="h-4 w-[1px] bg-zinc-700"></div>
             <div className="flex items-center gap-2">
               <button className="p-1 hover:bg-zinc-800 rounded transition-colors" onClick={() => setState(p => ({...p, zoom: Math.max(0.1, p.zoom - 0.1)}))}>-</button>
               <span className="text-xs w-10 text-center">{Math.round(state.zoom * 100)}%</span>
               <button className="p-1 hover:bg-zinc-800 rounded transition-colors" onClick={() => setState(p => ({...p, zoom: Math.min(5, p.zoom + 0.1)}))}>+</button>
             </div>
          </div>
          <button className="glass-panel px-4 py-2 rounded-full flex items-center gap-2 pointer-events-auto hover:bg-zinc-800 transition-all text-sm font-medium">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      <div className={`transition-all duration-300 border-l border-zinc-800 bg-zinc-900/50 backdrop-blur-md relative ${isAiPanelOpen ? 'w-80' : 'w-0'}`}>
        <button 
          onClick={() => setIsAiPanelOpen(!isAiPanelOpen)}
          className="absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-12 glass-panel rounded-l-lg flex items-center justify-center hover:bg-zinc-800 transition-colors z-30"
        >
          {isAiPanelOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
        
        {isAiPanelOpen && (
          <SidePanel 
            onAction={handleAiAction}
            isProcessing={isProcessing}
            shapes={state.shapes}
          />
        )}
      </div>
    </div>
  );
};

interface ToolBtnProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}

const ToolButton: React.FC<ToolBtnProps> = ({ icon, label, active, onClick, disabled, danger }) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    className={`
      p-3 rounded-xl transition-all group relative
      ${active ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}
      ${disabled ? 'opacity-30 cursor-not-allowed' : ''}
      ${danger && !disabled ? 'hover:bg-red-500/20 hover:text-red-400' : ''}
    `}
  >
    {icon}
    <span className="absolute left-16 bg-zinc-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-zinc-700">
      {label}
    </span>
  </button>
);

export default App;
