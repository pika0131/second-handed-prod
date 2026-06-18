/**
 * 애플리케이션 진입점
 *
 * React 18의 createRoot API를 사용해 index.html의 #root 엘리먼트에 앱을 마운트한다.
 * StrictMode는 개발 환경에서만 동작하며, 잠재적 문제를 조기에 감지하기 위해 일부
 * 라이프사이클을 두 번 호출한다. 프로덕션 빌드에는 영향 없다.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
