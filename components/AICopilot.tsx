
import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Command, Send, Loader2, X, Layout, Palette, Zap } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import { Shape } from '../types';
import { useCanvas } from '../context/CanvasContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const AICopilot: React.FC<Props> = ({ isOpen, onClose }) => {
  const { state, setState, actions } = useCanvas();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleExecute = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);

    const isGeneration = prompt.includes('生成') || prompt.toLowerCase().includes('create') || prompt.toLowerCase().includes('design');

    if (isGeneration) {
      const result = await geminiService.generateLayout(prompt, 800, 600);
      if (result && result.shapes) {
        const newShapes: Shape[] = result.shapes.map((s: any) => ({
          ...s,
          id: Math.random().toString(36).substr(2, 9),
          rotation: 0,
          x: s.x + (state.offset.x * -1) / state.zoom,
          y: s.y + (state.offset.y * -1) / state.zoom
        }));
        setState(prev => ({
          ...prev,
          shapes: [...prev.shapes, ...newShapes],
          selectedIds: newShapes.map(ns => ns.id)
        }), true);
      }
    } else {
      const suggestions = await geminiService.getDesignSuggestions(state.shapes, prompt);
      if (suggestions && suggestions.newElements) {
        const added = suggestions.newElements.map((s: any) => ({
          ...s,
          id: Math.random().toString(36).substr(2, 9),
          rotation: 0,
          stroke: '#000',
          strokeWidth: 1
        }));
        setState(prev => ({ ...prev, shapes: [...prev.shapes, ...added] }), true);
      }
    }

    setLoading(false);
    setPrompt('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-zinc-950/20 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center px-4 h-14 border-b border-zinc-100">
          <Command className="w-5 h-5 text-zinc-400 mr-3" />
          <input 
            ref={inputRef}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleExecute()}
            placeholder="告诉我你想设计什么... (例如：生成一个登录表单)"
            className="flex-1 bg-transparent border-none outline-none text-zinc-800 text-base placeholder:text-zinc-400 font-medium"
          />
          <div className="flex items-center gap-2">
            {loading ? (
              <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
            ) : (
              <button 
                onClick={handleExecute}
                className="p-1.5 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
            <div className="h-4 w-[1px] bg-zinc-200 mx-1" />
            <button onClick={onClose} className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="bg-zinc-50/50 p-3 flex flex-wrap gap-2">
          <ShortcutChip icon={<Layout className="w-3.5 h-3.5" />} text="生成登录界面" onClick={() => setPrompt('生成一个极简风格的登录表单')} />
          <ShortcutChip icon={<Palette className="w-3.5 h-3.5" />} text="应用蓝色渐变主题" onClick={() => setPrompt('将选中元素的背景改为蓝色线性渐变')} />
          <ShortcutChip icon={<Zap className="w-3.5 h-3.5" />} text="优化当前对齐" onClick={() => setPrompt('分析我的画布并提出对齐建议')} />
        </div>

        <div className="px-4 py-2 border-t border-zinc-100 flex justify-between items-center bg-white text-[10px]">
          <div className="flex items-center gap-1.5 font-bold text-zinc-400 uppercase tracking-widest">
            <Sparkles className="w-3 h-3 text-indigo-500" /> Powered by Gemini
          </div>
          <div className="flex items-center gap-1 text-zinc-400 font-mono">
            <kbd className="px-1.5 py-0.5 bg-zinc-100 border border-zinc-200 rounded">ESC</kbd> to close
          </div>
        </div>
      </div>
    </div>
  );
};

const ShortcutChip: React.FC<{ icon: any, text: string, onClick: () => void }> = ({ icon, text, onClick }) => (
  <button 
    onClick={onClick}
    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-zinc-200 rounded-full text-xs text-zinc-600 hover:border-indigo-400 hover:text-indigo-600 hover:shadow-sm transition-all active:scale-95"
  >
    {icon}
    <span>{text}</span>
  </button>
);

export default AICopilot;
