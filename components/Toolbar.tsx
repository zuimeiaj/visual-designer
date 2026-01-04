
import React from 'react';
import { Shape } from '../types';
import { Palette, Type as TypeIcon, LetterText } from 'lucide-react';
import { useTranslation } from '../lang/i18n';

interface Props {
  selectedShape?: Shape;
  onUpdate: (updates: Partial<Shape>) => void;
}

const Toolbar: React.FC<Props> = ({ selectedShape, onUpdate }) => {
  const { t } = useTranslation();
  if (!selectedShape) return null;

  const supportsText = ['text', 'rect', 'diamond'].includes(selectedShape.type);
  const isPureText = selectedShape.type === 'text';

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 glass-panel p-2 rounded-2xl flex items-center gap-4 z-40 shadow-xl border-zinc-200 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* 类型标签 */}
      <div className="flex items-center gap-2 border-r border-zinc-100 pr-4 mr-2">
        <span className="text-[10px] font-bold uppercase text-zinc-400 px-2 tracking-tighter">
          {t(`tools.${selectedShape.type}`)}
        </span>
      </div>

      {/* 图形基础样式 (非纯文本时显示) */}
      {!isPureText && (
        <div className="flex items-center gap-2 border-r border-zinc-100 pr-4">
          <label className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer group relative" title="Fill Color">
            <Palette className="w-4 h-4 text-zinc-500 group-hover:text-zinc-900" />
            <input 
              type="color" 
              className="absolute opacity-0 w-0 h-0" 
              value={selectedShape.fill === 'transparent' ? '#ffffff' : selectedShape.fill} 
              onChange={(e) => onUpdate({ fill: e.target.value })}
            />
          </label>
          <label className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer group relative" title="Stroke Color">
            <div className="w-4 h-4 rounded-full border-2 border-zinc-300 group-hover:border-zinc-500" style={{ backgroundColor: selectedShape.stroke }} />
            <input 
              type="color" 
              className="absolute opacity-0 w-0 h-0" 
              value={selectedShape.stroke === 'none' ? '#3f3f46' : selectedShape.stroke} 
              onChange={(e) => onUpdate({ stroke: e.target.value })}
            />
          </label>
        </div>
      )}

      {/* 文本样式 (支持文本的形状显示) */}
      {supportsText && (
        <div className="flex items-center gap-3 border-r border-zinc-100 pr-4">
          {/* 文字颜色 */}
          <label className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer group relative" title="Text Color">
            <TypeIcon className={`w-4 h-4 group-hover:text-indigo-600 transition-colors ${isPureText ? 'text-indigo-500' : 'text-zinc-500'}`} />
            <input 
              type="color" 
              className="absolute opacity-0 w-0 h-0" 
              value={isPureText ? selectedShape.fill : (selectedShape.textColor || '#ffffff')} 
              onChange={(e) => onUpdate(isPureText ? { fill: e.target.value } : { textColor: e.target.value })}
            />
          </label>
          {/* 字号 */}
          <div className="flex flex-col gap-0.5">
             <label className="text-[8px] text-zinc-400 font-bold uppercase">{t('properties.size')}</label>
             <input 
                type="number" 
                value={selectedShape.fontSize || 16} 
                onChange={(e) => onUpdate({ fontSize: Math.max(8, Number(e.target.value)) })}
                className="w-12 bg-transparent text-xs text-zinc-700 border-none outline-none focus:text-indigo-600 font-medium"
             />
          </div>
          {/* 文本内容简易编辑 */}
          <div className="flex flex-col gap-0.5">
             <label className="text-[8px] text-zinc-400 font-bold uppercase">{t('properties.content')}</label>
             <input 
                type="text" 
                value={selectedShape.text || ''} 
                onChange={(e) => onUpdate({ text: e.target.value })}
                className="w-32 bg-transparent text-xs text-zinc-700 border-none outline-none focus:text-indigo-600 placeholder:text-zinc-300 font-medium overflow-hidden text-ellipsis"
                placeholder={t('properties.contentPlaceholder')}
             />
          </div>
        </div>
      )}

      {/* 变换属性 */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col gap-0.5">
          <label className="text-[8px] text-zinc-400 font-bold uppercase">{t('properties.width')}</label>
          <input 
            type="number" 
            value={Math.round(selectedShape.width)} 
            onChange={(e) => onUpdate({ width: Math.max(1, Number(e.target.value)) })}
            className="w-14 bg-transparent text-xs text-zinc-700 border-none outline-none focus:text-indigo-600 font-medium"
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-[8px] text-zinc-400 font-bold uppercase">{t('properties.height')}</label>
          <input 
            type="number" 
            value={Math.round(selectedShape.height)} 
            onChange={(e) => onUpdate({ height: Math.max(1, Number(e.target.value)) })}
            className="w-14 bg-transparent text-xs text-zinc-700 border-none outline-none focus:text-indigo-600 font-medium"
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-[8px] text-zinc-400 font-bold uppercase">{t('properties.rotate')}</label>
          <input 
            type="number" 
            value={Math.round((selectedShape.rotation * 180) / Math.PI)} 
            onChange={(e) => onUpdate({ rotation: (Number(e.target.value) * Math.PI) / 180 })}
            className="w-14 bg-transparent text-xs text-zinc-700 border-none outline-none focus:text-indigo-600 font-medium"
          />
        </div>
      </div>
    </div>
  );
};

export default Toolbar;
