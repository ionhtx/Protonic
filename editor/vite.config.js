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

      // Endpoint to fetch Notion CMS database pages
      server.middlewares.use('/api/notion/sync', async (req, res, next) => {
        if (req.method === 'GET') {
          try {
            let settings = {}
            if (fs.existsSync(configPath)) {
              settings = JSON.parse(fs.readFileSync(configPath, 'utf8'))
            }

            const notionToken = settings.notionToken ? settings.notionToken.trim() : ''
            const notionDbId = settings.notionDbId ? settings.notionDbId.trim() : ''

            // If credentials are not set or are mock placeholders, return realistic mock data
            if (!notionToken || !notionDbId || notionToken.includes('mock') || notionDbId.includes('mock')) {
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify([
                { id: 'mock-1', title: 'Why AST Visual Editors are the Future (Demo)', status: 'Published', url: 'https://notion.so' },
                { id: 'mock-2', title: 'Integrating Notion as a Headless CMS (Demo)', status: 'Draft', url: 'https://notion.so' },
                { id: 'mock-3', title: 'Antigravity AI Bridge Walkthrough (Demo)', status: 'Published', url: 'https://notion.so' }
              ]))
              return
            }

            // Real Notion Integration
            const { Client } = await import('@notionhq/client')
            const notion = new Client({ auth: notionToken })

            // Query database rows using dataSources.query
            const response = await notion.dataSources.query({
              data_source_id: notionDbId
            })

            const posts = response.results.map((page) => {
              // Extract page properties robustly
              const properties = page.properties
              let title = 'Untitled Article'
              
              // Resolve Title property
              const titleProp = properties.Name || properties.Title || properties.title || properties.name
              if (titleProp && titleProp.title && titleProp.title.length > 0) {
                title = titleProp.title[0].plain_text
              }

              // Resolve Status property
              let status = 'Published'
              const statusProp = properties.Status || properties.status
              if (statusProp && statusProp.select) {
                status = statusProp.select.name
              } else if (statusProp && statusProp.status) {
                status = statusProp.status.name
              }

              return {
                id: page.id,
                title,
                status,
                url: page.url
              }
            })

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(posts))
          } catch (err) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: err.message }))
          }
          return
        }
        next()
      })

      // Endpoint to fetch Git branch and change status
      server.middlewares.use('/api/git/status', async (req, res, next) => {
        if (req.method === 'GET') {
          try {
            const { execSync } = await import('child_process')
            let status = 'Up to Date'
            let localChanges = false
            let activeBranch = 'main'

            try {
              activeBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim()
              const diff = execSync('git status --porcelain', { encoding: 'utf8' }).trim()
              if (diff) {
                localChanges = true
                status = 'Local Changes (Uncommitted)'
              }
            } catch (gitErr) {
              console.error('Git command error', gitErr)
            }

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ status, localChanges, activeBranch }))
          } catch (err) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: err.message }))
          }
          return
        }
        next()
      })

      // Endpoint to commit, push and create a Pull Request on GitHub
      server.middlewares.use('/api/git/commit', async (req, res, next) => {
        if (req.method === 'POST') {
          try {
            let settings = {}
            if (fs.existsSync(configPath)) {
              settings = JSON.parse(fs.readFileSync(configPath, 'utf8'))
            }

            const githubToken = settings.githubToken ? settings.githubToken.trim() : ''
            const githubRepo = settings.githubRepo ? settings.githubRepo.trim() : 'ionhtx/Protonic'

            if (!githubToken || !githubRepo || githubToken.includes('mock')) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'GitHub PAT credentials not configured or using mock values' }))
              return
            }

            const [owner, repo] = githubRepo.split('/')
            if (!owner || !repo) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'Invalid repository format. Must be owner/repo.' }))
              return
            }

            const { execSync } = await import('child_process')
            
            // Check status of modifications
            const porcelainStatus = execSync('git status --porcelain', { encoding: 'utf8' }).trim()
            if (!porcelainStatus) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'No local changes found to push' }))
              return
            }

            // Define session branch name
            const timestamp = Math.floor(Date.now() / 1000)
            const sessionBranch = `protonic/edit-session-${timestamp}`

            // Git actions: checkout branch, add, commit, push
            execSync(`git checkout -b ${sessionBranch}`, { encoding: 'utf8' })
            execSync('git add .', { encoding: 'utf8' })
            execSync('git commit -m "style(visual): apply layout and content modifications via Protonic"', { encoding: 'utf8' })
            
            // Push branch using token authentication
            const remoteUrl = `https://${githubToken}@github.com/${githubRepo}.git`
            execSync(`git push ${remoteUrl} ${sessionBranch}`, { encoding: 'utf8' })

            // Return back to main
            execSync('git checkout main', { encoding: 'utf8' })

            // Call Octokit API to open a Pull Request
            const { Octokit } = await import('@octokit/rest')
            const octokit = new Octokit({ auth: githubToken })

            const prResponse = await octokit.pulls.create({
              owner,
              repo,
              title: `Protonic: Visual Editor session updates - ${new Date().toLocaleDateString()}`,
              head: sessionBranch,
              base: 'main',
              body: 'This Pull Request was generated automatically by **Protonic** visual web editor after a design configuration session. It patches layout styling and text nodes in the client workspace files.'
            })

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ 
              success: true, 
              sessionBranch, 
              prUrl: prResponse.data.html_url,
              prNumber: prResponse.data.number
            }))
          } catch (err) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: err.message }))
          }
          return
        }
        next()
      })

      // Endpoint to run AI Guardrail validation checks before saving changes
      server.middlewares.use('/api/ai/guard', (req, res, next) => {
        if (req.method === 'POST') {
          let body = ''
          req.on('data', (chunk) => { body += chunk })
          req.on('end', () => {
            try {
              const { file, line, type, originalValue, newValue } = JSON.parse(body)

              let passed = true
              const warnings = []
              const errors = []

              if (type === 'content') {
                // Rule 1: Prevent empty copy
                if (!newValue.trim()) {
                  passed = false
                  errors.push('Visual Copy Error: Content node text cannot be left completely empty.')
                }
                // Rule 2: Warn about extremely long copy breaking designs
                if (newValue.length > 200) {
                  warnings.push('AI layout advice: Heading or copy exceeds 200 characters. Verify that it fits nicely on mobile viewports.')
                }
              }

              if (type === 'styles') {
                const classes = newValue.split(/\s+/)
                // Rule 3: Check for mutually exclusive utility classes
                const flexGridConflict = classes.includes('flex') && classes.includes('grid')
                if (flexGridConflict) {
                  passed = false
                  errors.push("AST layout error: Conflict utility classes. Element cannot have both 'flex' and 'grid' active.")
                }

                // Rule 4: Verify correct spacing values (padding/margin boundaries)
                classes.forEach(c => {
                  if (c.startsWith('p-') || c.startsWith('m-')) {
                    const val = parseInt(c.split('-')[1], 10)
                    if (val > 64) {
                      warnings.push(`AI design advice: Large layout spacing values detected ('${c}'). Check if standard padding fits container boundaries nicely.`)
                    }
                  }
                })
              }

              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ passed, errors, warnings }))
            } catch (err) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: err.message }))
            }
          })
          return
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

