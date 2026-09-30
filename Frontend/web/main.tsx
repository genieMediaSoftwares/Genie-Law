import '../global.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { enableScreens } from 'react-native-screens';

enableScreens(false);

import App from '../App';

const container = document.getElementById('root');

if (!container) {
  throw new Error('index.html is missing its #root element.');
}

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
