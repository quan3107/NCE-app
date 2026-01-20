/**
 * Location: src/main.tsx
 * Purpose: Bootstrap the React application with the root component and global styles.
 * Why: Provides a single entry point aligned with the refactored structure.
 */

import { createRoot } from 'react-dom/client';
import App from './App';
import '../index.css';
import './styles/globals.css';

createRoot(document.getElementById('root')!).render(<App />);



