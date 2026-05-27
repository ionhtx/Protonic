import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Custom Vite plugin to handle visual editor file write requests
// Custom Vite plugin to handle visual editor file write requests
function visualEditorApiPlugin() {
  const configPath = path.resolve('./config.json')

  return {
    name: 'protonic-editor-api',
    configureServer(server) {
      // Endpoint to load settings
      server.middlewares.use('/api/settings', (req, res, next) => {
        if (req.url === '/' || req.url === '') {
          if (req.method === 'GET') {
            try {
              let data = {}
              if (fs.existsSync(configPath)) {
                data = JSON.parse(fs.readFileSync(configPath, 'utf8'))
              }
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(data))
            } catch (err) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: err.message }))
            }
            return
          }

          if (req.method === 'POST') {
            let body = ''
            req.on('data', (chunk) => { body += chunk })
            req.on('end', () => {
              try {
                const settings = JSON.parse(body)
                fs.writeFileSync(configPath, JSON.stringify(settings, null, 2), 'utf8')
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ success: true, settings }))
              } catch (err) {
                res.statusCode = 500
                res.end(JSON.stringify({ error: err.message }))
              }
            })
            return
          }
        }
        next()
      })

      // Endpoint to write changes
      server.middlewares.use('/api/save', (req, res, next) => {
        if (req.method === 'POST') {
          let body = ''
          req.on('data', (chunk) => { body += chunk })
          req.on('end', () => {
            try {
              const { file, line, type, originalValue, newValue } = JSON.parse(body)

              if (!file || !line) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: 'Missing file path or line number' }))
                return
              }

              // Resolve target file path inside the client website directory
              const absolutePath = path.resolve('../website', file)

              if (!fs.existsSync(absolutePath)) {
                res.statusCode = 404
                res.end(JSON.stringify({ error: `File not found at ${absolutePath}` }))
                return
              }

              // Read file content
              const fileContent = fs.readFileSync(absolutePath, 'utf8')
              const lines = fileContent.split(/\r?\n/)
              const lineIndex = line - 1

              if (lineIndex < 0 || lineIndex >= lines.length) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: 'Line number out of bounds' }))
                return
              }

              const targetLine = lines[lineIndex]

              // Perform precision replacement on the target line
              let updatedLine = targetLine
              if (type === 'content') {
                // Replace text node content
                updatedLine = targetLine.replace(originalValue, newValue)
              } else if (type === 'styles') {
                // Replace CSS class values
                updatedLine = targetLine.replace(originalValue, newValue)
              }

              lines[lineIndex] = updatedLine
              fs.writeFileSync(absolutePath, lines.join('\n'), 'utf8')

              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true, updatedLine }))
            } catch (err) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: err.message }))
            }
          })
        } else {
          next()
        }
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), visualEditorApiPlugin()],
})

