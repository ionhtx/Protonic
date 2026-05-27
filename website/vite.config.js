import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Custom Babel plugin to inject source details into JSX elements
function reactSourceAttributePlugin({ types: t }) {
  return {
    name: 'react-source-attribute-injector',
    visitor: {
      JSXOpeningElement(path, state) {
        const filePath = state.file.opts.filename || ''
        
        // Skip files in node_modules and outside of the src directory
        if (filePath.includes('node_modules') || !filePath.includes('/src/')) {
          return
        }

        // Simplify file path to make it relative to src/
        const relativePath = filePath.replace(/\\/g, '/').split('/src/').pop()
        const startLine = path.node.loc ? path.node.loc.start.line : null

        if (relativePath && startLine) {
          // Check if data attributes already exist to avoid duplicates
          const hasAttr = path.node.attributes.some(
            (attr) => attr.name && attr.name.name === 'data-source-file'
          )

          if (!hasAttr) {
            // Inject data-source-file attribute
            path.node.attributes.push(
              t.jsxAttribute(
                t.jsxIdentifier('data-source-file'),
                t.stringLiteral(`src/${relativePath}`)
              )
            )
            // Inject data-source-line attribute
            path.node.attributes.push(
              t.jsxAttribute(
                t.jsxIdentifier('data-source-line'),
                t.stringLiteral(String(startLine))
              )
            )
          }
        }
      }
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [reactSourceAttributePlugin]
      }
    })
  ],
})
