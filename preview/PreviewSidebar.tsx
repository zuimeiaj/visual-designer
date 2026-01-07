
import React from 'react';
import { Monitor } from 'lucide-react';
import { useTranslation } from '../lang/i18n';
import { useCanvas } from '../context/CanvasContext';

const PreviewSidebar: React.FC = () => {
  const { t } = useTranslation();
  const { state, actions } = useCanvas();
  const { scenes, activeSceneId } = state;

  return (
    <div className="w-64 border-r border-zinc-200 bg-white z-40 flex flex-col overflow-hidden shadow-sm shrink-0">
      <div className="p-5 border-b shrink-0 bg-zinc-50/50">
        <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-1">{t('app.scenes')}</h3>
        <p className="text-[10px] text-zinc-400 font-medium">预览模式中切换场景</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
        {scenes.map(s => (
          <div 
            key={s.id} 
            onClick={() => actions.switchScene(s.id)}
            className={`group flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all ${s.id === activeSceneId ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'hover:bg-zinc-100 text-zinc-600'}`}
          >
            <Monitor className={`w-4 h-4 ${s.id === activeSceneId ? 'text-white' : 'text-zinc-400'}`} />
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-xs font-bold truncate">{s.name}</span>
              <span className={`text-[9px] uppercase font-bold ${s.id === activeSceneId ? 'text-indigo-200' : 'text-zinc-400'}`}>
                {s.shapes.length} Elements
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PreviewSidebar;
