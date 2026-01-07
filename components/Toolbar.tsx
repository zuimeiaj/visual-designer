
import React, { useState, useRef, useEffect } from 'react';
import { Shape, TextAlign } from '../types';
import { Palette, Type as TypeIcon, AlignLeft, AlignCenter, AlignRight, RotateCw, Radius, Link, Link2Off, ChevronDown } from 'lucide-react';
import { useTranslation } from '../lang/i18n';

interface Props {
  selectedShape?: Shape;
  onUpdate: (updates: Partial<Shape>, save?: boolean) => void;
}

const Toolbar: React.FC<Props> = ({ selectedShape, onUpdate }) => {
  const { t } = useTranslation();
  const [isRadiusPopupOpen, setIsRadiusPopupOpen] = useState(false);
  const [isRadiusLinked, setIsRadiusLinked] = useState(true);
  const radiusPopupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (radiusPopupRef.current && !radiusPopupRef.current.contains(e.target as Node)) {
        setIsRadiusPopupOpen(false);
      }
    };
    if (isRadiusPopupOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isRadiusPopupOpen]);

  if (!selectedShape) return null;

  const supportsText = ['text', 'rect', 'diamond', 'table', 'circle'].includes(selectedShape.type);
  const isPureText = selectedShape.type === 'text';

  const alignments: { value: TextAlign, icon: any }[] = [
    { value: 'left', icon: AlignLeft },
    { value: 'center', icon: AlignCenter },
    { value: 'right', icon: AlignRight },
  ];

  const handleRotationChange = (val: string, commit: boolean = false) => {
    const degrees = parseInt(val) || 0;
    onUpdate({ rotation: (degrees * Math.PI) / 180 }, commit);
  };

  const currentRotationDegrees = Math.round(((selectedShape.rotation || 0) * 180) / Math.PI);

  const handleRadiusChange = (val: number, index?: number, commit: boolean = false) => {
    if (isRadiusLinked) {
      onUpdate({ cornerRadius: val }, commit);
    } else {
      const current = Array.isArray(selectedShape.cornerRadius) 
        ? [...selectedShape.cornerRadius] 
        : [Number(selectedShape.cornerRadius || 0), Number(selectedShape.cornerRadius || 0), Number(selectedShape.cornerRadius || 0), Number(selectedShape.cornerRadius || 0)];
      
      if (index !== undefined) {
        current[index] = val;
      }
      onUpdate({ cornerRadius: current }, commit);
    }
  };

  const toggleRadiusLink = () => {
    const newVal = !isRadiusLinked;
    setIsRadiusLinked(newVal);
    
    if (!newVal && !Array.isArray(selectedShape.cornerRadius)) {
      const v = Number(selectedShape.cornerRadius || 0);
      onUpdate({ cornerRadius: [v, v, v, v] }, true);
    } 
    else if (newVal && Array.isArray(selectedShape.cornerRadius)) {
      onUpdate({ cornerRadius: selectedShape.cornerRadius[0] }, true);
    }
  };

  const getRadiusDisplay = () => {
    if (Array.isArray(selectedShape.cornerRadius)) {
      const min = Math.min(...selectedShape.cornerRadius);
      const max = Math.max(...selectedShape.cornerRadius);
      return min === max ? `${min}` : `${min}-${max}`;
    }
    return `${selectedShape.cornerRadius || 0}`;
  };

  const getRadiusVal = (index?: number): number => {
    if (Array.isArray(selectedShape.cornerRadius)) {
      return index !== undefined ? selectedShape.cornerRadius[index] : selectedShape.cornerRadius[0];
    }
    return Number(selectedShape.cornerRadius || 0);
  };

  const radiusLabels = [
    t('properties.radiusTL'),
    t('properties.radiusTR'),
    t('properties.radiusBR'),
    t('properties.radiusBL')
  ];

  return (
    <div className="flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200 overflow-visible shrink-0">
      {/* 颜色选择组 */}
      {!isPureText && (
        <div className="flex items-center gap-1 px-2 border-r border-zinc-200 shrink-0">
          <label className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer group relative" title="Fill Color">
            <Palette className="w-3.5 h-3.5 text-zinc-500 group-hover:text-indigo-600" />
            <input 
              type="color" 
              className="absolute opacity-0 w-0 h-0" 
              value={selectedShape.fill === 'transparent' ? '#ffffff' : selectedShape.fill} 
              onInput={(e: any) => onUpdate({ fill: e.target.value }, false)}
              onChange={(e: any) => onUpdate({ fill: e.target.value }, true)}
            />
          </label>
          <label className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer group relative" title="Stroke Color">
            <div className="w-3.5 h-3.5 rounded-full border border-zinc-300 group-hover:border-indigo-500" style={{ backgroundColor: selectedShape.stroke === 'none' ? 'transparent' : selectedShape.stroke }} />
            <input 
              type="color" 
              className="absolute opacity-0 w-0 h-0" 
              value={selectedShape.stroke === 'none' ? '#3f3f46' : selectedShape.stroke} 
              onInput={(e: any) => onUpdate({ stroke: e.target.value }, false)}
              onChange={(e: any) => onUpdate({ stroke: e.target.value }, true)}
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
              onInput={(e: any) => onUpdate(isPureText ? { fill: e.target.value } : { textColor: e.target.value }, false)}
              onChange={(e: any) => onUpdate(isPureText ? { fill: e.target.value } : { textColor: e.target.value }, true)}
            />
          </label>

          {selectedShape.type !== 'table' && (
            <div className="flex items-center bg-zinc-100 p-0.5 rounded-lg shrink-0">
              {alignments.map(({ value, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => onUpdate({ textAlign: value }, true)}
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
                onChange={(e) => onUpdate({ fontSize: Math.max(8, Number(e.target.value)) }, false)}
                onBlur={(e) => onUpdate({ fontSize: Math.max(8, Number(e.target.value)) }, true)}
                onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget.blur())}
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
            onChange={(e) => onUpdate({ width: Math.max(1, Number(e.target.value)) }, false)}
            onBlur={(e) => onUpdate({ width: Math.max(1, Number(e.target.value)) }, true)}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget.blur())}
            className="w-10 bg-transparent text-[10px] text-zinc-700 border-none outline-none focus:text-indigo-600 font-bold"
          />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[8px] font-black text-zinc-300 uppercase">H</span>
          <input 
            type="number" 
            value={Math.round(selectedShape.height)} 
            onChange={(e) => onUpdate({ height: Math.max(1, Number(e.target.value)) }, false)}
            onBlur={(e) => onUpdate({ height: Math.max(1, Number(e.target.value)) }, true)}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget.blur())}
            className="w-10 bg-transparent text-[10px] text-zinc-700 border-none outline-none focus:text-indigo-600 font-bold"
          />
        </div>

        {/* 矩形特有的圆角调节 - 弹出式面板 */}
        {selectedShape.type === 'rect' && (
          <div className="relative border-l border-zinc-200 pl-2 ml-1 shrink-0" ref={radiusPopupRef}>
            <button 
              onClick={() => setIsRadiusPopupOpen(!isRadiusPopupOpen)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all ${isRadiusPopupOpen ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-zinc-100 text-zinc-500'}`}
              title={t('properties.cornerRadius')}
            >
              <Radius className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold font-mono min-w-[14px]">{getRadiusDisplay()}</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${isRadiusPopupOpen ? 'rotate-180' : ''}`} />
            </button>

            {isRadiusPopupOpen && (
              <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.15)] border border-zinc-100 p-3 z-[200] w-48 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between mb-3 border-b border-zinc-50 pb-2">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('properties.cornerRadius')}</span>
                  <button 
                    onClick={toggleRadiusLink}
                    className={`p-1 hover:bg-zinc-100 rounded transition-colors ${!isRadiusLinked ? 'text-indigo-500' : 'text-zinc-300'}`}
                    title={isRadiusLinked ? t('properties.unlinkCorners') : t('properties.linkCorners')}
                  >
                    {isRadiusLinked ? <Link className="w-3.5 h-3.5" /> : <Link2Off className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {isRadiusLinked ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 bg-zinc-50 rounded-lg px-2 py-1.5">
                      <Radius className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      <input 
                        type="number" 
                        autoFocus
                        value={Math.round(getRadiusVal())} 
                        onChange={(e) => handleRadiusChange(Math.max(0, Number(e.target.value)), undefined, false)}
                        onBlur={(e) => handleRadiusChange(Math.max(0, Number(e.target.value)), undefined, true)}
                        onKeyDown={(e) => e.key === 'Enter' && setIsRadiusPopupOpen(false)}
                        className="w-full bg-transparent text-xs text-zinc-800 border-none outline-none focus:ring-0 font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                    <input 
                      type="range"
                      min="0"
                      max="100"
                      value={Math.round(getRadiusVal())}
                      onChange={(e) => handleRadiusChange(Number(e.target.value), undefined, false)}
                      onMouseUp={(e: any) => handleRadiusChange(Number(e.target.value), undefined, true)}
                      className="w-full accent-indigo-500 h-1.5 cursor-pointer"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between px-1">
                           <span className="text-[8px] text-zinc-400 font-black">{radiusLabels[i]}</span>
                        </div>
                        <input 
                          type="number" 
                          value={Math.round(getRadiusVal(i))} 
                          onChange={(e) => handleRadiusChange(Math.max(0, Number(e.target.value)), i, false)}
                          onBlur={(e) => handleRadiusChange(Math.max(0, Number(e.target.value)), i, true)}
                          onKeyDown={(e) => e.key === 'Enter' && setIsRadiusPopupOpen(false)}
                          className="w-full bg-zinc-50 rounded-lg px-2 py-1.5 text-[10px] text-zinc-800 border-none outline-none focus:ring-1 focus:ring-indigo-500 font-bold text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="w-[1px] h-4 bg-zinc-200 mx-1 shrink-0" />
        <div className="flex items-center gap-1 shrink-0 group">
          <RotateCw className="w-3 h-3 text-zinc-300 group-focus-within:text-indigo-500 transition-colors" />
          <input 
            type="number" 
            value={currentRotationDegrees} 
            onChange={(e) => handleRotationChange(e.target.value, false)}
            onBlur={(e) => handleRotationChange(e.target.value, true)}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget.blur())}
            className="w-10 bg-transparent text-[10px] text-zinc-700 border-none outline-none focus:text-indigo-600 font-bold"
          />
          <span className="text-[8px] font-black text-zinc-300 uppercase">°</span>
        </div>
      </div>
    </div>
  );
};

export default Toolbar;
