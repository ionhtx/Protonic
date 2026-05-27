import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Check if running inside the editor's iframe
if (window.self !== window.top) {
  // Intercept click events to prevent default behaviors and send node details to editor
  window.addEventListener('click', (e) => {
    // We want to handle clicks on ANY element inside the preview when inside the iframe.
    // If a nested element (like a span, h2, etc.) is clicked, we want to find the nearest parent
    // or the element itself that has data-source-file and data-source-line.
    const target = e.target.closest('[data-source-file]');
    if (target) {
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
    } else {
      // If we clicked an element that has no data-source attributes, let's at least see if any ancestor has it
      // or block it to prevent unexpected navigation/actions in the preview iframe.
      e.preventDefault();
      e.stopPropagation();
    }
  }, true); // Use capture phase to intercept prior to React events
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

