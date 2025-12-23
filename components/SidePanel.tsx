
import React, { useState } from 'react';
import { Sparkles, MessageSquare, Wand2, RefreshCw, Layers, Zap, Palette } from 'lucide-react';
import { Shape } from '../types';

interface Props {
  onAction: (prompt: string) => void;
  isProcessing: boolean;
  shapes: Shape[];
}

const SidePanel: React.FC<Props> = ({ onAction, isProcessing, shapes }) => {
  const [prompt, setPrompt] = useState('');

  const handleQuickAction = (action: string) => {
    onAction(action);
  };

  return (
    <div className="flex flex-col h-full p-4 overflow-y-auto">
      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="w-5 h-5 text-indigo-400" />
        <h2 className="text-sm font-semibold uppercase tracking-wider">AI Assistant</h2>
      </div>

      <div className="flex-1 flex flex-col gap-6">
        {/* Chat Input */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Describe your design</label>
          <div className="relative">
            <textarea 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., 'Add a sleek sidebar mockup' or 'Change colors to a cyberpunk theme'"
              className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl p-3 text-sm min-h-[100px] focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-zinc-600 resize-none"
            />
            <button 
              onClick={() => {
                if (prompt.trim()) {
                  onAction(prompt);
                  setPrompt('');
                }
              }}
              disabled={isProcessing || !prompt.trim()}
              className="absolute bottom-2 right-2 p-2 bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-col gap-3">
          <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Quick Suggestions</label>
          <div className="grid grid-cols-1 gap-2">
            <QuickActionButton 
              icon={<Wand2 className="w-4 h-4" />}
              label="Enhance Layout"
              description="Optimize spacing and alignment"
              onClick={() => handleQuickAction("Analyze my current shapes and suggest a better layout to make it look professional.")}
            />
            <QuickActionButton 
              icon={<Palette className="w-4 h-4" />}
              label="Modern Palette"
              description="Apply high-contrast pro colors"
              onClick={() => handleQuickAction("Suggest a modern, high-contrast color palette for all current shapes.")}
            />
            <QuickActionButton 
              icon={<Layers className="w-4 h-4" />}
              label="Generate Icon"
              description="Create a custom SVG-style asset"
              onClick={() => handleQuickAction("Generate a minimalist abstract icon asset.")}
            />
          </div>
        </div>

        {/* Status */}
        <div className="mt-auto p-4 rounded-xl bg-zinc-800/30 border border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-zinc-400">Canvas elements</span>
            <span className="text-[10px] font-mono text-zinc-300">{shapes.length}</span>
          </div>
          <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
            <div className="bg-indigo-500 h-full" style={{ width: `${Math.min(shapes.length * 5, 100)}%` }}></div>
          </div>
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
    className="flex items-center gap-3 p-3 rounded-xl border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/50 transition-all text-left group"
  >
    <div className="p-2 bg-zinc-800 rounded-lg group-hover:bg-indigo-500/10 group-hover:text-indigo-400 transition-colors">
      {icon}
    </div>
    <div>
      <div className="text-xs font-semibold">{label}</div>
      <div className="text-[10px] text-zinc-500">{description}</div>
    </div>
  </button>
);

export default SidePanel;
