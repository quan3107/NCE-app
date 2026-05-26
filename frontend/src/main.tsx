/**
 * Location: src/main.tsx
 * Purpose: Bootstrap the React application with the root component and global styles.
 * Why: Provides a single entry point aligned with the refactored structure.
 */

import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import './styles/authoring.css';
import './styles/rich-text.css';
import './styles/reading-panels.css';

createRoot(document.getElementById('root')!).render(<App />);



