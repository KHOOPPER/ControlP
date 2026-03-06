/**
 * @fileoverview main.jsx - Punto de montaje de la aplicación React.
 * Renderiza el componente raíz dentro del DOM con StrictMode habilitado.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
