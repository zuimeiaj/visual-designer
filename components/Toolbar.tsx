
import React from 'react';
import { Shape, TextAlign } from '../types';
import { Palette, Type as TypeIcon, AlignLeft, AlignCenter, AlignRight, RotateCw } from 'lucide-react';
import { useTranslation } from '../lang/i18n';

interface Props {
  selectedShape?: Shape;
  onUpdate: (updates: Partial<Shape>) => void;
}

const Toolbar: React.FC<Props> = ({ selectedShape, onUpdate }) => {
  const { t } = useTranslation();
  if (!selectedShape) return null;

  const supportsText = ['text', 'rect', 'diamond', 'table', 'circle'].includes(selectedShape.type);
  const isPureText = selectedShape.type === 'text';

  const alignments: { value: TextAlign, icon: any }[] = [
    { value: 'left', icon: AlignLeft },
    { value: 'center', icon: AlignCenter },
    { value: 'right', icon: AlignRight },
  ];

  const handleRotationChange = (val: string) => {
    const degrees = parseInt(val) || 0;
    onUpdate({ rotation: (degrees * Math.PI) / 180 });
  };

  const currentRotationDegrees = Math.round(((selectedShape.rotation || 0) * 180) / Math.PI);

  return (
    <div className="flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200 overflow-hidden shrink-0">
      {/* 颜色选择组 */}
      {!isPureText && (
        <div className="flex items-center gap-1 px-2 border-r border-zinc-200 shrink-0">
          <label className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer group relative" title="Fill Color">
            <Palette className="w-3.5 h-3.5 text-zinc-500 group-hover:text-indigo-600" />
            <input 
              type="color" 
              className="absolute opacity-0 w-0 h-0" 
              value={selectedShape.fill === 'transparent' ? '#ffffff' : selectedShape.fill} 
              onChange={(e) => onUpdate({ fill: e.target.value })}
            />
          </label>
          <label className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer group relative" title="Stroke Color">
            <div className="w-3.5 h-3.5 rounded-full border border-zinc-300 group-hover:border-indigo-500" style={{ backgroundColor: selectedShape.stroke === 'none' ? 'transparent' : selectedShape.stroke }} />
            <input 
              type="color" 
              className="absolute opacity-0 w-0 h-0" 
              value={selectedShape.stroke === 'none' ? '#3f3f46' : selectedShape.stroke} 
              onChange={(e) => onUpdate({ stroke: e.target.value })}
            />
          </label>
        </div>
      )}

      {/* 文本工具组 */}
      {supportsText && (
        <div className="flex items-center gap-2 px-2 border-r border-zinc-200 shrink-0">
          <label className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer group relative" title="Text Color">
            <TypeIcon className={`w-3.5 h-3.5 group-hover:text-indigo-600 transition-colors ${isPureText ? 'text-indigo-600' : 'text-zinc-500'}`} />
            <input 
              type="color" 
              className="absolute opacity-0 w-0 h-0" 
              value={isPureText ? selectedShape.fill : (selectedShape.textColor || '#000000')} 
              onChange={(e) => onUpdate(isPureText ? { fill: e.target.value } : { textColor: e.target.value })}
            />
          </label>

          {selectedShape.type !== 'table' && (
            <div className="flex items-center bg-zinc-100 p-0.5 rounded-lg shrink-0">
              {alignments.map(({ value, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => onUpdate({ textAlign: value })}
                  className={`p-1 rounded-md transition-all ${selectedShape.textAlign === value || (!selectedShape.textAlign && value === (isPureText ? 'left' : 'center')) ? 'bg-white shadow-sm text-indigo-600' : 'text-zinc-400 hover:text-zinc-600'}`}
                >
                  <Icon className="w-3 h-3" />
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1 shrink-0">
             <input 
                type="number" 
                value={Math.round(selectedShape.fontSize || 14)} 
                onChange={(e) => onUpdate({ fontSize: Math.max(8, Number(e.target.value)) })}
                className="w-8 bg-transparent text-[10px] text-zinc-700 border-none outline-none focus:text-indigo-600 font-bold"
             />
             <span className="text-[8px] text-zinc-300 font-bold">PX</span>
          </div>
        </div>
      )}

      {/* 尺寸与旋转属性组 */}
      <div className="flex items-center gap-2 px-2 shrink-0">
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[8px] font-black text-zinc-300 uppercase">W</span>
          <input 
            type="number" 
            value={Math.round(selectedShape.width)} 
            onChange={(e) => onUpdate({ width: Math.max(1, Number(e.target.value)) })}
            className="w-10 bg-transparent text-[10px] text-zinc-700 border-none outline-none focus:text-indigo-600 font-bold"
          />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[8px] font-black text-zinc-300 uppercase">H</span>
          <input 
            type="number" 
            value={Math.round(selectedShape.height)} 
            onChange={(e) => onUpdate({ height: Math.max(1, Number(e.target.value)) })}
            className="w-10 bg-transparent text-[10px] text-zinc-700 border-none outline-none focus:text-indigo-600 font-bold"
          />
        </div>
        <div className="w-[1px] h-4 bg-zinc-200 mx-1 shrink-0" />
        <div className="flex items-center gap-1 shrink-0 group">
          <RotateCw className="w-3 h-3 text-zinc-300 group-focus-within:text-indigo-500 transition-colors" />
          <input 
            type="number" 
            value={currentRotationDegrees} 
            onChange={(e) => handleRotationChange(e.target.value)}
            className="w-10 bg-transparent text-[10px] text-zinc-700 border-none outline-none focus:text-indigo-600 font-bold"
          />
          <span className="text-[8px] font-black text-zinc-300 uppercase">°</span>
        </div>
      </div>
    </div>
  );
};

export default Toolbar;
