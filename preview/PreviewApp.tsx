
import React from 'react';
import { useCanvas } from '../context/CanvasContext';
import CanvasEditor from '../components/CanvasEditor';
import PreviewSidebar from './PreviewSidebar';
import PreviewTopBar from './PreviewTopBar';
import { useRulerPlugin } from '../plugins/RulerPlugin';

/**
 * The application shell that renders the preview interface.
 */
const PreviewApp: React.FC = () => {
  const { state, setState, undo, redo, actions } = useCanvas();

  // 预览模式仅保留标尺和视野控制
  const rulerPlugin = useRulerPlugin();
  const plugins = [rulerPlugin];

  return (
    <div className="flex h-screen w-screen bg-zinc-50 text-zinc-900 font-inter select-none overflow-hidden">
      {/* 1. 左侧场景导航 */}
      <PreviewSidebar />

      {/* 2. 主预览区 */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-white">
        <PreviewTopBar />

        <div className="flex-1 flex relative bg-zinc-50/10">
          <CanvasEditor 
            state={state} 
            setState={setState} 
            updateShape={() => {}} // 预览模式禁止更新
            plugins={plugins} 
            undo={undo} 
            redo={redo} 
            actions={actions}
          />
        </div>
      </div>
    </div>
  );
};

export default PreviewApp;
