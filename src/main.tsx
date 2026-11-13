import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import LongAudioVerification from './components/LongAudioVerification';
import './index.css';

createRoot(document.getElementById('root')!).render(
  new URLSearchParams(location.search).get('verify30') === '1' ? <LongAudioVerification /> : <App />
);

if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
