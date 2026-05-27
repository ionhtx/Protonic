import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { transformAsync } from '@babel/core'

// Custom Vite plugin to transform code using Babel before framework plugins
function visualEditorSourcePlugin() {
  return {
    name: 'protonic-source-injector',
    enforce: 'pre',
    async transform(code, id) {
      // Process JSX/TSX source files inside src directory
      const normalizedPath = id.replace(/\\/g, '/').split('?')[0]
      if (normalizedPath.includes('node_modules') || !normalizedPath.includes('/src/') || !/\.[jt]sx$/.test(normalizedPath)) {
        return null
      }

      const result = await transformAsync(code, {
        filename: id,
        plugins: [
          function ({ types: t }) {
            return {
              name: 'react-source-attribute-injector',
              visitor: {
                JSXOpeningElement(path, state) {
                  // Get file path from state or opts
                  const filePath = state.file.opts.filename || id || ''
                  const normPath = filePath.replace(/\\/g, '/')
                  const relativePath = normPath.split('/src/').pop()
                  const startLine = path.node.loc ? path.node.loc.start.line : null

                  if (relativePath && startLine) {
                    const hasAttr = path.node.attributes.some(
                      (attr) => attr.name && attr.name.name === 'data-source-file'
                    )

                    if (!hasAttr) {
                      path.node.attributes.push(
                        t.jSXAttribute(
                          t.jSXIdentifier('data-source-file'),
                          t.stringLiteral(`src/${relativePath}`)
                        )
                      )
                      path.node.attributes.push(
                        t.jSXAttribute(
                          t.jSXIdentifier('data-source-line'),
                          t.stringLiteral(String(startLine))
                        )
                      )
                    }
                  }
                }
              }
            }
          }
        ],
        parserOpts: {
          plugins: ['jsx', 'typescript']
        },
        sourceMaps: true
      })

      if (!result) return null

      return {
        code: result.code,
        map: result.map
      }
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    visualEditorSourcePlugin(),
    react()
  ],
})
