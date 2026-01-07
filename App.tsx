
import React, { useState } from 'react';
import { useCanvas } from './context/CanvasContext';
import { usePluginsSetup } from './plugins/plugins.setup';

import CanvasEditor from './components/CanvasEditor';
import TopBar from './components/TopBar';
import LeftSidebar from './components/LeftSidebar';
import LayersPanel from './components/LayersPanel';
import IconPanel from './components/IconPanel';

import './models';

/**
 * The application shell that renders the editor interface.
 */
const App: React.FC = () => {
  const { state, setState, undo, redo, actions, canUndo, canRedo } = useCanvas();
  
  // Local UI-only states
  const [isLayersOpen, setIsLayersOpen] = useState(false);
  const [isIconPanelOpen, setIsIconPanelOpen] = useState(false);

  // Initialize plugins with current shapes
  const plugins = usePluginsSetup(state.shapes);

  return (
    <div className="flex h-screen w-screen bg-zinc-50 text-zinc-900 font-inter select-none overflow-hidden">
      {/* 1. Left Navigation */}
      <LeftSidebar 
        isLayersOpen={isLayersOpen}
        onToggleLayers={() => { setIsLayersOpen(!isLayersOpen); setIsIconPanelOpen(false); }}
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
        </div>
      </div>
    </div>
  );
};

export default App;
