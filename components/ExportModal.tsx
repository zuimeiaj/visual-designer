
import React, { useState } from 'react';
import { X, ImageIcon, Sliders, Layers, CheckCircle2, Download, Package } from 'lucide-react';
import { useTranslation } from '../lang/i18n';
import { ExportSettings } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onExport: (settings: ExportSettings) => Promise<void>;
}

const ExportModal: React.FC<Props> = ({ isOpen, onClose, onExport }) => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<ExportSettings>({
    format: 'png',
    quality: 92,
    padding: 40,
    scope: 'current'
  });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleAction = async () => {
    setLoading(true);
    await onExport(settings);
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-zinc-950/40 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-zinc-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 h-16 border-b border-zinc-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center">
              <Download className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-base font-bold text-zinc-900">导出预览图</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full text-zinc-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
          {/* Format Selection */}
          <section className="space-y-3">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              <ImageIcon className="w-3 h-3" /> 图片格式
            </label>
            <div className="flex p-1 bg-zinc-100 rounded-xl">
              {['png', 'jpeg'].map((f) => (
                <button
                  key={f}
                  onClick={() => setSettings(prev => ({ ...prev, format: f as any }))}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${settings.format === f ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}
                >
                  {f.toUpperCase()}
                  {f === 'png' && <span className="ml-1 text-[9px] opacity-60">(支持透明)</span>}
                </button>
              ))}
            </div>
          </section>

          {/* Quality Slider - Only for JPEG */}
          {settings.format === 'jpeg' && (
            <section className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                  <Sliders className="w-3 h-3" /> 图片质量
                </label>
                <span className="text-xs font-mono font-bold text-indigo-600">{settings.quality}%</span>
              </div>
              <input 
                type="range" min="10" max="100" step="1"
                value={settings.quality}
                onChange={e => setSettings(prev => ({ ...prev, quality: Number(e.target.value) }))}
                className="w-full accent-indigo-600 h-1.5 rounded-full cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-zinc-400 font-bold px-1">
                <span>较小体积</span>
                <span>最高保真</span>
              </div>
            </section>
          )}

          {/* Padding */}
          <section className="space-y-3">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
               内容间距 (Padding)
            </label>
            <div className="flex items-center gap-4">
              <input 
                type="number" 
                value={settings.padding}
                onChange={e => setSettings(prev => ({ ...prev, padding: Math.max(0, Number(e.target.value)) }))}
                className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm font-bold text-zinc-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
              <span className="text-[10px] font-bold text-zinc-400">PX</span>
            </div>
          </section>

          {/* Export Scope */}
          <section className="space-y-3">
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              <Layers className="w-3 h-3" /> 导出范围
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setSettings(prev => ({ ...prev, scope: 'current' }))}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${settings.scope === 'current' ? 'border-indigo-600 bg-indigo-50/50' : 'border-zinc-100 hover:border-zinc-200'}`}
              >
                <CheckCircle2 className={`w-5 h-5 ${settings.scope === 'current' ? 'text-indigo-600' : 'text-zinc-200'}`} />
                <span className={`text-xs font-bold ${settings.scope === 'current' ? 'text-indigo-900' : 'text-zinc-500'}`}>当前场景</span>
              </button>
              <button
                onClick={() => setSettings(prev => ({ ...prev, scope: 'all' }))}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${settings.scope === 'all' ? 'border-indigo-600 bg-indigo-50/50' : 'border-zinc-100 hover:border-zinc-200'}`}
              >
                <Package className={`w-5 h-5 ${settings.scope === 'all' ? 'text-indigo-600' : 'text-zinc-200'}`} />
                <span className={`text-xs font-bold ${settings.scope === 'all' ? 'text-indigo-900' : 'text-zinc-500'}`}>所有场景 (.zip)</span>
              </button>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="p-6 bg-zinc-50 border-t border-zinc-100 flex gap-3 shrink-0">
          <button 
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-2xl text-sm font-bold text-zinc-500 hover:bg-zinc-100 transition-all active:scale-95"
          >
            取消
          </button>
          <button 
            onClick={handleAction}
            disabled={loading}
            className="flex-[2] px-4 py-3 bg-zinc-900 text-white rounded-2xl text-sm font-bold hover:bg-zinc-800 transition-all active:scale-95 shadow-lg shadow-zinc-200 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            确认导出
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
