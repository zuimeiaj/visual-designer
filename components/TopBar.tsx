
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Undo2, Redo2, Download, ChevronDown, ImageIcon, FileDown, 
  FileUp, Languages, Search, Package, 
  MousePointer2, Share2, PenTool, Play, Code
} from 'lucide-react';
import { useTranslation } from '../lang/i18n';
import { useCanvas } from '../context/CanvasContext';
import { useViewMode } from '../index';
import Toolbar from './Toolbar';
import ExportModal from './ExportModal';

interface Props {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

const TopBar: React.FC<Props> = ({ canUndo, canRedo, onUndo, onRedo }) => {
  const { t, language, setLanguage } = useTranslation();
  const { state, setState, actions } = useCanvas();
  const { setMode } = useViewMode();
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shapeInputRef = useRef<HTMLInputElement>(null);

  const selectedShape = useMemo(() => 
    state.shapes.find(s => s.id === state.selectedIds[0]), 
    [state.shapes, state.selectedIds]
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsExportOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const zoomPercentage = Math.round((state.zoom || 1) * 100);

  return (
    <div className="h-14 w-full bg-white border-b border-zinc-200 px-4 flex items-center justify-between z-50 shrink-0">
      <input type="file" ref={fileInputRef} className="hidden" accept=".yoyo" onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) actions.importDesign(file);
        e.target.value = '';
      }} />
      <input type="file" ref={shapeInputRef} className="hidden" accept=".yshape" onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) actions.importShapes(file);
        e.target.value = '';
      }} />
      
      <div className="flex items-center gap-4 flex-1">
        <span className="text-xs font-black uppercase tracking-widest text-zinc-400 border-r border-zinc-200 pr-4 hidden lg:inline">
          {t('app.title')}
        </span>
        
        {/* Undo/Redo Group */}
        <div className="flex items-center gap-1 bg-zinc-100/50 p-1 rounded-lg">
          <button onClick={onUndo} disabled={!canUndo} className="p-1.5 hover:bg-white hover:shadow-sm text-zinc-600 rounded-md disabled:opacity-20 transition-all">
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onRedo} disabled={!canRedo} className="p-1.5 hover:bg-white hover:shadow-sm text-zinc-600 rounded-md disabled:opacity-20 transition-all">
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Global Tools Group */}
        <div className="flex items-center gap-1 bg-zinc-100/50 p-1 rounded-lg">
          <ToolActionBtn active={state.activeTool === 'select'} onClick={() => setState(p => ({ ...p, activeTool: 'select' }), false)} icon={<MousePointer2 className="w-3.5 h-3.5" />} title={t('tools.select')} />
          <ToolActionBtn active={state.activeTool === 'connect'} onClick={() => setState(p => ({ ...p, activeTool: 'connect' }), false)} icon={<Share2 className="w-3.5 h-3.5" />} title={t('tools.connect')} />
          <ToolActionBtn active={state.activeTool === 'curve'} onClick={() => setState(p => ({ ...p, activeTool: 'curve' }), false)} icon={<PenTool className="w-3.5 h-3.5" />} title={t('tools.pen')} />
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1 bg-zinc-100/50 p-1 rounded-lg">
          <button onClick={() => setState(prev => ({ ...prev, zoom: 1, offset: { x: window.innerWidth / 2 - 400, y: window.innerHeight / 2 - 300 } }), false)} className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-white hover:shadow-sm text-zinc-600 rounded-md transition-all group">
            <Search className="w-3 h-3 text-zinc-400 group-hover:text-indigo-600" />
            <span className="text-[10px] font-bold font-mono w-9 text-center">{zoomPercentage}%</span>
          </button>
        </div>

        <div className="h-6 w-[1px] bg-zinc-200 mx-1" />

        <button 
          onClick={() => setMode('preview')} 
          className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-all active:scale-95"
          title="预览模式"
        >
          <Play className="w-4 h-4 fill-current" />
        </button>
      </div>

      <div className="flex-none px-4 flex justify-center">
        {selectedShape && <Toolbar selectedShape={selectedShape} onUpdate={(updates, save) => actions.updateShape(selectedShape.id, updates, save)} />}
      </div>

      <div className="flex items-center justify-end gap-3 flex-1">
        <button onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')} className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-zinc-100 rounded-lg text-[10px] font-bold text-zinc-500 uppercase transition-all">
          <Languages className="w-3.5 h-3.5" />
          {language === 'en' ? 'English' : '中文'}
        </button>

        <div className="relative" ref={dropdownRef}>
          <button onClick={() => setIsExportOpen(!isExportOpen)} className="flex items-center gap-2 px-4 py-1.5 bg-zinc-900 text-white hover:bg-zinc-800 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95">
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('app.exportImport')}</span>
            <ChevronDown className="w-3.5 h-3.5 transition-transform" />
          </button>

          {isExportOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-zinc-100 py-1.5 z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="px-3 py-1.5 text-[9px] font-bold text-zinc-400 uppercase tracking-widest">导出</div>
              <DropdownItem icon={<ImageIcon className="w-4 h-4" />} label="导出图片..." onClick={() => { setIsExportOpen(false); setIsExportModalOpen(true); }} />
              <DropdownItem icon={<Code className="w-4 h-4" />} label={t('app.exportHTML')} onClick={() => { setIsExportOpen(false); actions.exportDesign('html'); }} />
              <DropdownItem icon={<FileDown className="w-4 h-4" />} label={t('app.exportXML')} onClick={() => { setIsExportOpen(false); actions.exportDesign('yoyo'); }} />
              <div className="h-[1px] bg-zinc-100 mx-2 my-1.5" />
              <div className="px-3 py-1.5 text-[9px] font-bold text-zinc-400 uppercase tracking-widest">导入</div>
              <DropdownItem icon={<FileUp className="w-4 h-4" />} label={t('app.importFile')} onClick={() => fileInputRef.current?.click()} />
              <DropdownItem icon={<Package className="w-4 h-4" />} label={t('app.importShapes')} onClick={() => shapeInputRef.current?.click()} />
            </div>
          )}
        </div>
      </div>

      <ExportModal 
        isOpen={isExportModalOpen} 
        onClose={() => setIsExportModalOpen(false)} 
        onExport={actions.exportImage} 
      />
    </div>
  );
};

const ToolActionBtn: React.FC<{ icon: React.ReactNode, active: boolean, onClick: () => void, title: string }> = ({ icon, active, onClick, title }) => (
  <button onClick={onClick} className={`p-1.5 rounded-md transition-all ${active ? 'bg-white shadow-sm text-indigo-600' : 'hover:bg-white/50 text-zinc-600'}`} title={title}>{icon}</button>
);

const DropdownItem: React.FC<{ icon: React.ReactNode, label: string, onClick: () => void, disabled?: boolean }> = ({ icon, label, onClick, disabled }) => (
  <button onClick={onClick} disabled={disabled} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left ${disabled ? 'opacity-30 cursor-not-allowed text-zinc-400' : 'text-zinc-600 hover:bg-zinc-50 hover:text-indigo-600'}`}>
    <span className={disabled ? 'text-zinc-300' : 'text-zinc-400'}>{icon}</span> {label}
  </button>
);

export default TopBar;
