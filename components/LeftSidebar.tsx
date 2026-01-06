
import React from 'react';
import { 
  MousePointer2, Share2, PenTool, Square, Circle as CircleIcon, 
  Diamond as DiamondIcon, Minus, Type as TypeIcon, Table as TableIcon, 
  Layers as LayersIcon, Sparkles, Zap, Ghost, ImageIcon
} from 'lucide-react';
import { useTranslation } from '../lang/i18n';
import { useCanvas } from '../context/CanvasContext';

interface Props {
  isLayersOpen: boolean;
  onToggleLayers: () => void;
  isSidePanelOpen: boolean;
  onToggleSidePanel: () => void;
  isIconPanelOpen: boolean;
  onToggleIconPanel: () => void;
}

const LeftSidebar: React.FC<Props> = ({ 
  isLayersOpen, onToggleLayers, 
  isSidePanelOpen, onToggleSidePanel,
  isIconPanelOpen, onToggleIconPanel
}) => {
  const { t } = useTranslation();
  const { state, setState, actions } = useCanvas();

  const activeTool = state.activeTool;

  return (
    <div className="flex flex-col border-r border-zinc-200 bg-white w-16 items-center py-4 gap-6 z-40 shadow-sm shrink-0">
      <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/20">
        <Zap className="w-5 h-6 text-white" />
      </div>
      <div className="flex flex-col gap-1.5">
        <ToolBtn active={activeTool === 'select'} onClick={() => setState(p => ({ ...p, activeTool: 'select' }), false)} icon={<MousePointer2 className="w-5 h-5" />} label={t('tools.select')} />
        <ToolBtn active={activeTool === 'connect'} onClick={() => setState(p => ({ ...p, activeTool: 'connect' }), false)} icon={<Share2 className="w-5 h-5" />} label={t('tools.connect')} />
        <ToolBtn active={activeTool === 'curve'} onClick={() => setState(p => ({ ...p, activeTool: 'curve' }), false)} icon={<PenTool className="w-5 h-5" />} label={t('tools.pen')} />
        <div className="h-[1px] bg-zinc-100 mx-2 my-1" />
        <ToolBtn onClick={() => actions.addShape('rect')} icon={<Square className="w-5 h-5" />} label={t('tools.rect')} />
        <ToolBtn onClick={() => actions.addShape('circle')} icon={<CircleIcon className="w-5 h-5" />} label={t('tools.circle')} />
        <ToolBtn onClick={() => actions.addShape('diamond')} icon={<DiamondIcon className="w-5 h-5" />} label={t('tools.diamond')} />
        <ToolBtn onClick={() => actions.addShape('line')} icon={<Minus className="w-5 h-5" />} label={t('tools.line')} />
        <ToolBtn onClick={() => actions.addShape('text')} icon={<TypeIcon className="w-5 h-5" />} label={t('tools.text')} />
        <ToolBtn onClick={() => actions.addShape('table')} icon={<TableIcon className="w-5 h-5" />} label={t('tools.table')} />
        <ToolBtn onClick={() => actions.addShape('image')} icon={<ImageIcon className="w-5 h-5" />} label={t('tools.image')} />
        <ToolBtn active={isIconPanelOpen} onClick={onToggleIconPanel} icon={<Ghost className="w-5 h-5" />} label="图标" />
      </div>
      <div className="mt-auto flex flex-col gap-2 pb-4">
        <ToolBtn active={isLayersOpen} onClick={onToggleLayers} icon={<LayersIcon className="w-5 h-5" />} label={t('app.layers')} />
        <ToolBtn active={isSidePanelOpen} onClick={onToggleSidePanel} icon={<Sparkles className="w-5 h-5 text-indigo-500" />} label={t('ai.assistant')} />
      </div>
    </div>
  );
};

const ToolBtn: React.FC<any> = ({ icon, active, onClick, label }) => (
  <button 
    onClick={onClick} 
    className={`p-2.5 rounded-xl transition-all group relative ${active ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900'}`}
  >
    {icon}
    <span className="absolute left-14 bg-zinc-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-[100] whitespace-nowrap shadow-xl">
      {label}
    </span>
  </button>
);

export default LeftSidebar;
