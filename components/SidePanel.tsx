
import React, { useState } from 'react';
import { Sparkles, Wand2, RefreshCw, Layers, Zap, Palette } from 'lucide-react';
import { Shape } from '../types';
import { useTranslation } from '../lang/i18n';

interface Props {
  onAction: (prompt: string) => void;
  isProcessing: boolean;
  shapes: Shape[];
}

const SidePanel: React.FC<Props> = ({ onAction, isProcessing, shapes = [] }) => {
  const [prompt, setPrompt] = useState('');
  const { t, language } = useTranslation();

  const handleQuickAction = (action: string) => {
    onAction(action);
  };

  const shapesCount = Array.isArray(shapes) ? shapes.length : 0;

  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center gap-2 mb-6 shrink-0">
        <Sparkles className="w-5 h-5 text-indigo-400" />
        <h2 className="text-sm font-semibold uppercase tracking-wider">{t('ai.assistant')}</h2>
      </div>

      <div className="flex-1 flex flex-col gap-6 overflow-y-auto min-h-0 pr-1">
        {/* Chat Input */}
        <div className="flex flex-col gap-2 shrink-0">
          <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">{t('ai.describeDesign')}</label>
          <div className="relative">
            <textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t('ai.placeholder')}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-sm min-h-[120px] focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-zinc-400 resize-none"
            />
            <button 
              onClick={() => {
                if (prompt.trim()) {
                  onAction(prompt);
                  setPrompt('');
                }
              }}
              disabled={isProcessing || !prompt.trim()}
              className="absolute bottom-2 right-2 p-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-col gap-3 shrink-0">
          <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">{t('ai.suggestions')}</label>
          <div className="grid grid-cols-1 gap-2">
            <QuickActionButton 
              icon={<Wand2 className="w-4 h-4" />}
              label={t('ai.enhanceLayout')}
              description={t('ai.enhanceDesc')}
              onClick={() => handleQuickAction(language === 'zh' ? "分析我当前的形状并提出更好的布局建议，使其看起来更专业。" : "Analyze my current shapes and suggest a better layout to make it look professional.")}
            />
            <QuickActionButton 
              icon={<Palette className="w-4 h-4" />}
              label={t('ai.modernPalette')}
              description={t('ai.paletteDesc')}
              onClick={() => handleQuickAction(language === 'zh' ? "为当前所有形状建议一个现代且高对比度的配色方案。" : "Suggest a modern, high-contrast color palette for all current shapes.")}
            />
            <QuickActionButton 
              icon={<Layers className="w-4 h-4" />}
              label={t('ai.generateIcon')}
              description={t('ai.iconDesc')}
              onClick={() => handleQuickAction(language === 'zh' ? "生成一个极简主义的抽象图标资源。" : "Generate a minimalist abstract icon asset.")}
            />
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="mt-4 p-4 rounded-xl bg-zinc-50 border border-zinc-200 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-zinc-400 font-bold uppercase">{t('ai.canvasElements', { count: shapesCount })}</span>
          <span className="text-[10px] font-mono text-zinc-900 font-bold">{shapesCount}</span>
        </div>
        <div className="w-full bg-zinc-200 h-1 rounded-full overflow-hidden">
          <div className="bg-indigo-500 h-full transition-all duration-500" style={{ width: `${Math.min(shapesCount * 5, 100)}%` }}></div>
        </div>
      </div>
    </div>
  );
};

interface QuickActionProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
}

const QuickActionButton: React.FC<QuickActionProps> = ({ icon, label, description, onClick }) => (
  <button 
    onClick={onClick}
    className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all text-left group bg-white"
  >
    <div className="p-2 bg-zinc-50 rounded-lg group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
      {icon}
    </div>
    <div>
      <div className="text-xs font-bold text-zinc-800">{label}</div>
      <div className="text-[10px] text-zinc-500 font-medium">{description}</div>
    </div>
  </button>
);

export default SidePanel;
