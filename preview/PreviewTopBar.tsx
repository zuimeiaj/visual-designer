
import React from 'react';
import { X, Search } from 'lucide-react';
import { useTranslation } from '../lang/i18n';
import { useCanvas } from '../context/CanvasContext';
import { useViewMode } from '../index';

const PreviewTopBar: React.FC = () => {
  const { t } = useTranslation();
  const { state, setState } = useCanvas();
  const { setMode } = useViewMode();

  const resetZoom = () => {
    setState(prev => ({
      ...prev,
      zoom: 1,
      offset: { x: window.innerWidth / 2 - 400, y: window.innerHeight / 2 - 300 }
    }), false);
  };

  const activeScene = state.scenes.find(s => s.id === state.activeSceneId);
  const zoomPercentage = Math.round((state.zoom || 1) * 100);

  return (
    <div className="h-14 w-full bg-white border-b border-zinc-200 px-6 flex items-center justify-between z-50 shrink-0">
      <div className="flex items-center gap-4">
        <div className="px-3 py-1 bg-zinc-900 rounded-md text-[9px] font-black text-white uppercase tracking-tighter">Preview</div>
        <span className="text-sm font-bold text-zinc-800">{activeScene?.name}</span>
      </div>

      <div className="flex items-center gap-4">
        {/* Zoom */}
        <button 
          onClick={resetZoom}
          className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-lg transition-all group"
        >
          <Search className="w-3.5 h-3.5 text-zinc-400 group-hover:text-indigo-600" />
          <span className="text-xs font-bold font-mono w-10">{zoomPercentage}%</span>
        </button>

        <div className="h-6 w-[1px] bg-zinc-200 mx-2" />

        <button 
          onClick={() => setMode('edit')}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white hover:bg-zinc-800 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-lg shadow-zinc-200"
        >
          <X className="w-4 h-4" />
          <span>退出预览</span>
        </button>
      </div>
    </div>
  );
};

export default PreviewTopBar;
