import {createRoot} from 'react-dom/client';
import { lazy, Suspense } from 'react';
import App from './App.tsx';
import LongAudioVerification from './components/LongAudioVerification';
import './index.css';
const BatchVerification = lazy(() => import('./components/BatchVerification'));

createRoot(document.getElementById('root')!).render(
  new URLSearchParams(location.search).get('verifyBatch') === '1'
    ? <Suspense fallback={<p>در حال آماده‌سازی آزمون متن…</p>}><BatchVerification /></Suspense>
    : new URLSearchParams(location.search).get('verify30') === '1' ? <LongAudioVerification /> : <App />
);

if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
