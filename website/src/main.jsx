import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Check if running inside the editor's iframe
if (window.self !== window.top) {
  // Intercept click events to prevent default behaviors and send node details to editor
  window.addEventListener('click', (e) => {
    const target = e.target.closest('[data-source-file]');
    if (target) {
      // Prevent navigation and standard click actions during editing mode
      e.preventDefault();
      e.stopPropagation();

      const file = target.getAttribute('data-source-file');
      const line = target.getAttribute('data-source-line');

      window.parent.postMessage({
        type: 'VISUAL_ELEMENT_SELECTED',
        file,
        line: parseInt(line, 10),
        tagName: target.tagName.toLowerCase(),
        textContent: target.textContent.trim(),
        className: target.className
      }, '*');
    }
  }, true); // Use capture phase to intercept prior to React events
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

