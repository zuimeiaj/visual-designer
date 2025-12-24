
import React from 'react';
import { Shape } from '../types';
import { Palette } from 'lucide-react';
import { useTranslation } from '../lang/i18n';

interface Props {
  selectedShape?: Shape;
  onUpdate: (updates: Partial<Shape>) => void;
}

const Toolbar: React.FC<Props> = ({ selectedShape, onUpdate }) => {
  const { t } = useTranslation();
  if (!selectedShape) return null;

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 glass-panel p-2 rounded-2xl flex items-center gap-4 z-40 shadow-2xl">
      <div className="flex items-center gap-2 border-r border-zinc-800 pr-4 mr-2">
        <span className="text-[10px] font-bold uppercase text-zinc-500 px-2 tracking-tighter">
          {t(`tools.${selectedShape.type}`)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <label className="p-1 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer group relative">
          <Palette className="w-4 h-4 text-zinc-400 group-hover:text-white" />
          <input 
            type="color" 
            className="absolute opacity-0 w-0 h-0" 
            value={selectedShape.fill === 'transparent' ? '#000000' : selectedShape.fill} 
            onChange={(e) => onUpdate({ fill: e.target.value })}
          />
        </label>
        {selectedShape.type !== 'text' && (
          <label className="p-1 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer group relative">
            <div className="w-4 h-4 rounded-full border-2 border-zinc-400 group-hover:border-white" style={{ borderColor: selectedShape.stroke }} />
            <input 
              type="color" 
              className="absolute opacity-0 w-0 h-0" 
              value={selectedShape.stroke} 
              onChange={(e) => onUpdate({ stroke: e.target.value })}
            />
          </label>
        )}
      </div>

      <div className="flex items-center gap-2 border-l border-zinc-800 pl-4">
        <div className="flex flex-col gap-0.5">
          <label className="text-[8px] text-zinc-600 font-bold uppercase">{t('properties.width')}</label>
          <input 
            type="number" 
            value={Math.round(selectedShape.width)} 
            onChange={(e) => onUpdate({ width: Number(e.target.value) })}
            className="w-14 bg-transparent text-xs border-none outline-none focus:text-indigo-400"
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-[8px] text-zinc-600 font-bold uppercase">{t('properties.height')}</label>
          <input 
            type="number" 
            value={Math.round(selectedShape.height)} 
            onChange={(e) => onUpdate({ height: Number(e.target.value) })}
            className="w-14 bg-transparent text-xs border-none outline-none focus:text-indigo-400"
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-[8px] text-zinc-600 font-bold uppercase">{t('properties.rotate')}</label>
          <input 
            type="number" 
            value={Math.round((selectedShape.rotation * 180) / Math.PI)} 
            onChange={(e) => onUpdate({ rotation: (Number(e.target.value) * Math.PI) / 180 })}
            className="w-14 bg-transparent text-xs border-none outline-none focus:text-indigo-400"
          />
        </div>
      </div>

      {selectedShape.type === 'text' && (
        <div className="flex items-center gap-2 border-l border-zinc-800 pl-4">
          <div className="flex flex-col gap-0.5">
             <label className="text-[8px] text-zinc-600 font-bold uppercase">{t('properties.size')}</label>
             <input 
                type="number" 
                value={selectedShape.fontSize} 
                onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
                className="w-12 bg-transparent text-xs border-none outline-none focus:text-indigo-400"
             />
          </div>
          <div className="flex flex-col gap-0.5">
             <label className="text-[8px] text-zinc-600 font-bold uppercase">{t('properties.content')}</label>
             <input 
                type="text" 
                value={selectedShape.text} 
                onChange={(e) => onUpdate({ text: e.target.value })}
                className="w-32 bg-transparent text-xs border-none outline-none focus:text-indigo-400 placeholder:text-zinc-700"
                placeholder={t('properties.contentPlaceholder')}
             />
          </div>
        </div>
      )}
    </div>
  );
};

export default Toolbar;
