
import React, { useState } from 'react';
import { Monitor, Plus, Trash2, Square, Circle as CircleIcon, Type as TypeIcon, Diamond as DiamondIcon, Table as TableIcon } from 'lucide-react';
import { useTranslation } from '../lang/i18n';
import { ShapeType } from '../types';
import { useCanvas } from '../context/CanvasContext';

const LAYER_ITEM_HEIGHT = 48;

const LayersPanel: React.FC = () => {
  const { t } = useTranslation();
  const { state, actions } = useCanvas();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState("");
  const [scrollTop, setScrollTop] = useState(0);

  const { scenes, activeSceneId, shapes, selectedIds } = state;

  const sortedShapes = [...shapes].reverse();
  const visibleShapes = sortedShapes.slice(
    Math.floor(scrollTop / LAYER_ITEM_HEIGHT),
    Math.floor(scrollTop / LAYER_ITEM_HEIGHT) + 20
  ).map((s, i) => ({ shape: s, index: Math.floor(scrollTop / LAYER_ITEM_HEIGHT) + i }));

  const startRename = (id: string, name: string) => {
    setRenamingId(id);
    setRenamingValue(name);
  };

  const handleRenameSubmit = (id: string) => {
    actions.renameScene(id, renamingValue);
    setRenamingId(null);
  };

  return (
    <div className="w-64 border-r border-zinc-200 bg-white z-30 flex flex-col overflow-hidden animate-in slide-in-from-left duration-200 shadow-sm">
      <div className="p-4 border-b flex items-center justify-between shrink-0">
        <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">{t('app.scenes')}</h3>
        <button onClick={actions.addScene} className="p-1 hover:bg-zinc-100 rounded text-indigo-600 transition-colors">
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <div className="max-h-60 overflow-y-auto p-2 space-y-1 border-b custom-scrollbar">
        {scenes.map(s => (
          <div 
            key={s.id} 
            onClick={() => actions.switchScene(s.id)}
            onDoubleClick={() => startRename(s.id, s.name)}
            className={`group flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-all ${s.id === activeSceneId ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-zinc-100 text-zinc-600'}`}
          >
            <Monitor className={`w-3.5 h-3.5 ${s.id === activeSceneId ? 'text-white' : 'text-zinc-400'}`} />
            {renamingId === s.id ? (
              <input 
                autoFocus className="bg-white text-zinc-900 px-1.5 rounded w-full text-xs font-bold outline-none"
                value={renamingValue} onChange={e => setRenamingValue(e.target.value)}
                onBlur={() => handleRenameSubmit(s.id)}
                onKeyDown={e => e.key === 'Enter' && handleRenameSubmit(s.id)}
              />
            ) : (
              <span className="text-xs font-bold truncate flex-1">{s.name}</span>
            )}
            {scenes.length > 1 && (
              <Trash2 onClick={(e) => { e.stopPropagation(); actions.deleteScene(s.id); }} className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 hover:opacity-100" />
            )}
          </div>
        ))}
      </div>

      <div className="p-4 border-b flex items-center justify-between shrink-0">
        <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">{t('app.layers')}</h3>
        <span className="text-[10px] font-mono text-zinc-400 bg-zinc-50 px-2 py-0.5 rounded-full">{shapes.length}</span>
      </div>

      <div 
        className="flex-1 overflow-y-auto custom-scrollbar relative"
        onScroll={e => setScrollTop(e.currentTarget.scrollTop)}
      >
        <div style={{ height: sortedShapes.length * LAYER_ITEM_HEIGHT, width: '100%' }}>
          {visibleShapes.map(({ shape, index }) => (
            <div 
              key={shape.id}
              onClick={() => actions.centerOnShape(shape.id)}
              style={{ top: index * LAYER_ITEM_HEIGHT, height: LAYER_ITEM_HEIGHT }}
              className={`absolute left-0 right-0 flex items-center gap-3 px-4 py-2 cursor-pointer transition-all border-b border-zinc-50 ${selectedIds.includes(shape.id) ? 'bg-indigo-50 border-r-2 border-indigo-500' : 'hover:bg-zinc-50'}`}
            >
              <div className={`p-1.5 rounded ${selectedIds.includes(shape.id) ? 'bg-indigo-100 text-indigo-600' : 'bg-zinc-100 text-zinc-400'}`}>
                <LayerIcon type={shape.type} />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-bold truncate ${selectedIds.includes(shape.id) ? 'text-indigo-900' : 'text-zinc-700'}`}>
                  {shape.text || t(`tools.${shape.type}`)}
                </div>
                <div className="text-[9px] text-zinc-400 font-mono truncate uppercase">{shape.id}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const LayerIcon: React.FC<{ type: ShapeType }> = ({ type }) => {
  switch (type) {
    case 'rect': return <Square className="w-3.5 h-3.5" />;
    case 'circle': return <CircleIcon className="w-3.5 h-3.5" />;
    case 'diamond': return <DiamondIcon className="w-3.5 h-3.5" />;
    case 'text': return <TypeIcon className="w-3.5 h-3.5" />;
    case 'table': return <TableIcon className="w-3.5 h-3.5" />;
    default: return <Square className="w-3.5 h-3.5" />;
  }
};

export default LayersPanel;
