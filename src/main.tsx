import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { storageService } from './services/storageService';

storageService.applyThemeToDocument(storageService.getFallbackTheme());

createRoot(document.getElementById('root')!).render(<App />);
