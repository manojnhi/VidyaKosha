import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';
import { isCapacitorNative } from './utils/api';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator && !isCapacitorNative()) {
  registerSW({ immediate: true });
}

createRoot(document.getElementById('root')!).render(<App />);
