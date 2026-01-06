
import React, { useState } from 'react';
import { Zap } from 'lucide-react';
import { I18nProvider } from './lang/i18n';
import { CanvasProvider, useCanvas } from './context/CanvasContext';
import { usePluginsSetup } from './plugins/plugins.setup';
import { geminiService } from './services/geminiService';

import CanvasEditor from './components/CanvasEditor';
import SidePanel from './components/SidePanel';
import TopBar from './components/TopBar';
import LeftSidebar from './components/LeftSidebar';
import LayersPanel from './components/LayersPanel';
import IconPanel from './components/IconPanel';
import AICopilot from './components/AICopilot';

import './models';

/**
 * The inner application shell that consumes the CanvasContext.
 */
const AppShell: React.FC = () => {
  const { state, setState, undo, redo, actions, canUndo, canRedo } = useCanvas();
  
  // Local UI-only states
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [isLayersOpen, setIsLayersOpen] = useState(false);
  const [isIconPanelOpen, setIsIconPanelOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);

  // Initialize plugins with current shapes
  const plugins = usePluginsSetup(state.shapes);

  return (
    <div className="flex h-screen w-screen bg-zinc-50 text-zinc-900 font-inter select-none overflow-hidden">
      {/* 1. Left Navigation */}
      <LeftSidebar 
        isLayersOpen={isLayersOpen}
        onToggleLayers={() => { setIsLayersOpen(!isLayersOpen); setIsIconPanelOpen(false); }}
        isSidePanelOpen={isSidePanelOpen}
        onToggleSidePanel={() => { setIsSidePanelOpen(!isSidePanelOpen); }}
        isIconPanelOpen={isIconPanelOpen}
        onToggleIconPanel={() => { setIsIconPanelOpen(!isIconPanelOpen); setIsLayersOpen(false); }}
      />

      {/* 2. Panels (Layers / Icons) */}
      {isLayersOpen && <LayersPanel />}
      {isIconPanelOpen && <IconPanel onClose={() => setIsIconPanelOpen(false)} />}

      {/* 3. Main Design Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-white">
        <TopBar 
          canUndo={canUndo} 
          canRedo={canRedo} 
          onUndo={undo} 
          onRedo={redo} 
        />

        <div className="flex-1 flex relative bg-zinc-50/20">
          <CanvasEditor 
            state={state} 
            setState={setState} 
            updateShape={actions.updateShape} 
            plugins={plugins} 
            undo={undo} 
            redo={redo} 
            actions={actions}
          />

          {/* AI Side Assistant */}
          {isSidePanelOpen && (
            <div className="w-80 border-l bg-white z-20 shadow-xl overflow-y-auto shrink-0 animate-in slide-in-from-right duration-300">
              <SidePanel 
                shapes={state.shapes}
                isProcessing={isProcessing} 
                onAction={async (prompt) => {
                  setIsProcessing(true);
                  const result = await geminiService.getDesignSuggestions(state.shapes, prompt);
                  if (result?.newElements) {
                    setState(prev => ({
                      ...prev,
                      shapes: [...prev.shapes, ...result.newElements.map((ne: any) => ({
                        ...ne, id: Math.random().toString(36).substr(2, 9), rotation: 0
                      }))]
                    }), true);
                  }
                  setIsProcessing(false);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* 4. Global Overlays */}
      <AICopilot isOpen={isCopilotOpen} onClose={() => setIsCopilotOpen(false)} />

      {/* Floating Action Trigger */}
      <button 
        onClick={() => setIsCopilotOpen(true)}
        className="fixed bottom-6 right-6 p-4 bg-zinc-900 text-white rounded-2xl shadow-2xl hover:bg-indigo-600 transition-all active:scale-95 group z-50"
      >
        <Zap className="w-6 h-6" />
      </button>
    </div>
  );
};

/**
 * App Entry Point: Bootstraps Providers
 */
const App: React.FC = () => (
  <I18nProvider>
    <CanvasProvider>
      <AppShell />
    </CanvasProvider>
  </I18nProvider>
);

export default App;
