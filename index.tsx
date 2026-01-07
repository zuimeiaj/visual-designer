
import React, { useState, createContext, useContext } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import PreviewApp from './preview/PreviewApp';
import { I18nProvider } from './lang/i18n';
import { CanvasProvider } from './context/CanvasContext';
import './index.css';

// Create a simple context to manage the view mode globally
export type ViewMode = 'edit' | 'preview';

interface ViewContextType {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
}

const ViewContext = createContext<ViewContextType | undefined>(undefined);

export const useViewMode = () => {
  const context = useContext(ViewContext);
  if (!context) throw new Error('useViewMode must be used within ViewProvider');
  return context;
};

const Root = () => {
  const [mode, setMode] = useState<ViewMode>('edit');

  return (
    <ViewContext.Provider value={{ mode, setMode }}>
      <I18nProvider>
        <CanvasProvider>
          {mode === 'edit' ? <App /> : <PreviewApp />}
        </CanvasProvider>
      </I18nProvider>
    </ViewContext.Provider>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>
  );
}
