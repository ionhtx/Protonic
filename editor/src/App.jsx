import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [selectedElement, setSelectedElement] = useState(null)
  const [activeTab, setActiveTab] = useState('styles')
  const [iframeUrl, setIframeUrl] = useState('http://localhost:5173')
  const [editorText, setEditorText] = useState('')
  const [tailwindClasses, setTailwindClasses] = useState('')
  
  // Notion Mock Sync State
  const [notionSyncing, setNotionSyncing] = useState(false)
  const [notionPosts, setNotionPosts] = useState([
    { id: '1', title: 'Why AST Visual Editors are the Future', status: 'Published' },
    { id: '2', title: 'Integrating Notion as a Lightweight Headless CMS', status: 'Draft' },
  ])

  const [saving, setSaving] = useState(false)

  // Settings State
  const [showSettings, setShowSettings] = useState(false)
  const [githubToken, setGithubToken] = useState('')
  const [githubRepo, setGithubRepo] = useState('ionhtx/Protonic')
  const [notionToken, setNotionToken] = useState('')
  const [notionDbId, setNotionDbId] = useState('')

  const triggerNotionSync = async () => {
    setNotionSyncing(true)
    try {
      const res = await fetch('/api/notion/sync')
      if (res.ok) {
        const posts = await res.json()
        setNotionPosts(posts)
      } else {
        const errData = await res.json()
        alert(`Notion Sync failed: ${errData.error || 'Unknown error'}`)
      }
    } catch (err) {
      alert(`Network error syncing Notion: ${err.message}`)
    } finally {
      setNotionSyncing(false)
    }
  }

  const saveSettings = async () => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          githubToken,
          githubRepo,
          notionToken,
          notionDbId
        })
      })
      if (res.ok) {
        setShowSettings(false)
        alert('Settings saved locally to config.json!')
        fetchGitStatus()
      } else {
        alert('Failed to save settings')
      }
    } catch (err) {
      alert(`Save error: ${err.message}`)
    }
  }

  // GitHub / Git State
  const [gitStatus, setGitStatus] = useState('Up to Date')
  const [hasGitChanges, setHasGitChanges] = useState(false)
  const [activeBranch, setActiveBranch] = useState('main')
  const [pushing, setPushing] = useState(false)

  const fetchGitStatus = async () => {
    try {
      const res = await fetch('/api/git/status')
      if (res.ok) {
        const data = await res.json()
        setGitStatus(data.status)
        setHasGitChanges(data.localChanges)
        setActiveBranch(data.activeBranch)
      }
    } catch (err) {
      console.error('Failed to load git status', err)
    }
  }

  const pushToGitHub = async () => {
    if (!hasGitChanges) {
      alert('No uncommitted changes to push!')
      return
    }

    setPushing(true)
    try {
      const res = await fetch('/api/git/commit', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        alert(`Successfully committed changes to new branch: ${data.sessionBranch}!\nPull Request created successfully!`)
        if (data.prUrl) window.open(data.prUrl, '_blank')
        fetchGitStatus()
      } else {
        alert(`Failed to push to GitHub: ${data.error || 'Unknown error'}`)
      }
    } catch (err) {
      alert(`Network error pushing: ${err.message}`)
    } finally {
      setPushing(false)
    }
  }

  // Load configuration and Notion posts on startup
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings')
        if (res.ok) {
          const data = await res.json()
          if (data.githubToken) setGithubToken(data.githubToken)
          if (data.githubRepo) setGithubRepo(data.githubRepo)
          if (data.notionToken) setNotionToken(data.notionToken)
          if (data.notionDbId) setNotionDbId(data.notionDbId)
        }
      } catch (err) {
        console.error('Failed to load settings', err)
      }
    }

    const fetchNotion = async () => {
      try {
        const res = await fetch('/api/notion/sync')
        if (res.ok) {
          const posts = await res.json()
          setNotionPosts(posts)
        }
      } catch (err) {
        console.error('Failed to load Notion posts', err)
      }
    }

    fetchSettings().then(() => {
      fetchNotion()
      fetchGitStatus()
    })
  }, [])

  useEffect(() => {
    // Listen to postMessage from the website iframe
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'VISUAL_ELEMENT_SELECTED') {
        setSelectedElement(event.data)
        setEditorText(event.data.textContent || '')
        setTailwindClasses(event.data.className || '')
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const handleTextChange = (e) => {
    setEditorText(e.target.value)
  }

  const handleClassesChange = (e) => {
    setTailwindClasses(e.target.value)
  }

  const saveChanges = async () => {
    if (!selectedElement) return

    setSaving(true)
    try {
      const type = activeTab
      const originalValue = type === 'content' ? selectedElement.textContent : selectedElement.className
      const newValue = type === 'content' ? editorText : tailwindClasses

      // 1. Run AI Guardrail validation checks
      const guardResponse = await fetch('/api/ai/guard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file: selectedElement.file,
          line: selectedElement.line,
          type,
          originalValue,
          newValue
        })
      })

      if (guardResponse.ok) {
        const guardResult = await guardResponse.json()
        
        if (!guardResult.passed) {
          alert(`🚫 Protonic AI Guardrail Blocked this Change:\n\n${guardResult.errors.join('\n')}`)
          setSaving(false)
          return
        }

        if (guardResult.warnings && guardResult.warnings.length > 0) {
          const confirmProceed = window.confirm(`⚠️ Protonic AI Layout Review Warnings:\n\n${guardResult.warnings.join('\n')}\n\nDo you want to override and apply this change anyway?`)
          if (!confirmProceed) {
            setSaving(false)
            return
          }
        }
      }

      // 2. Commit visual changes
      const response = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file: selectedElement.file,
          line: selectedElement.line,
          type,
          originalValue,
          newValue
        })
      })

      const data = await response.json()
      if (response.ok) {
        // Update local element state to match new values
        setSelectedElement(prev => ({
          ...prev,
          textContent: type === 'content' ? editorText : prev.textContent,
          className: type === 'styles' ? tailwindClasses : prev.className
        }))
        
        // Temporarily reload the iframe to ensure HMR resolves instantly
        const iframe = document.querySelector('.preview-iframe')
        if (iframe) iframe.src = iframe.src
        fetchGitStatus()
      } else {
        alert(`Error saving changes: ${data.error}`)
      }
    } catch (err) {
      alert(`Network error: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }


  return (
    <div className="editor-container">
      {/* Top Header */}
      <header className="editor-header">
        <div className="logo-section">
          <div className="pulse-dot"></div>
          <h1>Protonic <span>Visual Editor</span></h1>
        </div>
        <div className="branch-selector">
          <span className={`dot ${hasGitChanges ? 'warning' : 'active'}`} style={{ backgroundColor: hasGitChanges ? 'var(--warning-color)' : 'var(--success-color)' }}></span>
          <span>Source: GitHub ({activeBranch}) — {gitStatus}</span>
        </div>
        <div className="action-buttons">
          <button className="btn-icon" title="Developer Settings" onClick={() => setShowSettings(true)}>
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          <button className="btn-secondary" onClick={() => setIframeUrl('http://localhost:5173')}>
            Reload Preview
          </button>
          <button 
            className="btn-primary" 
            onClick={pushToGitHub}
            disabled={pushing || !hasGitChanges}
            style={{ opacity: (!hasGitChanges || pushing) ? 0.6 : 1, cursor: (!hasGitChanges || pushing) ? 'not-allowed' : 'pointer' }}
          >
            {pushing ? 'Pushing...' : 'Push to Production'}
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="editor-main">
        {/* Left Control Panel */}
        <aside className="editor-sidebar left">
          <div className="tab-menu">
            <button 
              className={activeTab === 'styles' ? 'active' : ''} 
              onClick={() => setActiveTab('styles')}
            >
              Layout & Styles
            </button>
            <button 
              className={activeTab === 'content' ? 'active' : ''} 
              onClick={() => setActiveTab('content')}
            >
              Static Text
            </button>
          </div>

          <div className="panel-content">
            {selectedElement ? (
              <div className="element-details animate-fade-in">
                <h3>Selected Element: <code>&lt;{selectedElement.tagName}&gt;</code></h3>
                <div className="file-info">
                  <span>File:</span>
                  <code>{selectedElement.file}</code>
                </div>
                <div className="file-info">
                  <span>Line:</span>
                  <code>{selectedElement.line}</code>
                </div>

                {activeTab === 'styles' && (
                  <div className="form-group">
                    <label>CSS Classes (Tailwind)</label>
                    <textarea 
                      value={tailwindClasses}
                      onChange={handleClassesChange}
                      placeholder="e.g. text-2xl font-bold text-gray-800"
                    />
                    <div className="helper-text">
                      Edits here will rewrite this element's Tailwind classes in the AST code.
                    </div>
                  </div>
                )}

                {activeTab === 'content' && (
                  <div className="form-group">
                    <label>Text Content</label>
                    <textarea 
                      value={editorText} 
                      onChange={handleTextChange} 
                    />
                    <div className="helper-text">
                      Modifies the static text in the React codebase on GitHub.
                    </div>
                  </div>
                )}

                <div className="diff-preview">
                  <h4>Proposed Code Diff:</h4>
                  <pre>
                    {activeTab === 'content' ? (
                      `- textContent: "${selectedElement.textContent}"\n+ textContent: "${editorText}"`
                    ) : (
                      `- className: "${selectedElement.className}"\n+ className: "${tailwindClasses}"`
                    )}
                  </pre>
                </div>

                <button 
                  className="btn-primary" 
                  style={{ width: '100%', marginTop: '10px' }}
                  onClick={saveChanges}
                  disabled={saving}
                >
                  {saving ? 'Applying...' : 'Apply Changes'}
                </button>
              </div>
            ) : (
              <div className="empty-state">
                <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" strokeWidth="1.5" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 3v18M15 3v18" />
                </svg>
                <p>Click any element in the live website preview to edit its layout or static text.</p>
              </div>
            )}
          </div>
        </aside>

        {/* Middle Live Preview Canvas */}
        <section className="editor-canvas">
          <div className="canvas-header">
            <div className="address-bar">
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>{iframeUrl}</span>
            </div>
            <div className="viewport-controls">
              <button className="active">Desktop</button>
              <button>Tablet</button>
              <button>Mobile</button>
            </div>
          </div>
          <div className="iframe-wrapper">
            <iframe 
              src={iframeUrl} 
              title="Live Preview" 
              className="preview-iframe"
            />
          </div>
        </section>

        {/* Right Content CMS Panel */}
        <aside className="editor-sidebar right">
          <div className="panel-header">
            <h3>Notion Integration</h3>
            <span className="notion-badge">CMS</span>
          </div>
          <div className="panel-content">
            <div className="notion-config">
              <div className="db-status">
                <span className="status-label">Database Status:</span>
                <span className="badge connected">Connected</span>
              </div>
              <p className="notion-help">
                Writers can write articles directly in Notion. Press "Sync" to pull live updates into your preview workspace.
              </p>
              <button 
                className={`btn-sync ${notionSyncing ? 'syncing' : ''}`}
                onClick={triggerNotionSync}
                disabled={notionSyncing}
              >
                {notionSyncing ? 'Syncing...' : 'Sync Notion Database'}
              </button>
            </div>

            <div className="posts-list">
              <h4>Blog Articles (Notion Feed)</h4>
              {notionPosts.map(post => (
                <div key={post.id} className="post-item">
                  <div className="post-meta">
                    <h5>{post.title}</h5>
                    <span className={`post-status ${post.status.toLowerCase()}`}>{post.status}</span>
                  </div>
                  <button className="btn-edit-notion" onClick={() => window.open(post.url || 'https://notion.so', '_blank')}>
                    Edit in Notion
                  </button>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>

      {/* Developer Settings Modal */}
      {showSettings && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in">
            <header className="modal-header">
              <h2>Developer Configuration</h2>
              <button className="btn-close" onClick={() => setShowSettings(false)}>&times;</button>
            </header>
            <div className="modal-body">
              {/* GitHub Settings */}
              <div className="form-group">
                <label>GitHub Personal Access Token</label>
                <div className="input-group">
                  <input 
                    type="password" 
                    value={githubToken} 
                    onChange={(e) => setGithubToken(e.target.value)} 
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  />
                </div>
                <div className="input-help">
                  Required to push layout and styling changes directly back as commits and PRs.
                </div>
              </div>

              <div className="form-group">
                <label>GitHub Repository</label>
                <div className="input-group">
                  <input 
                    type="text" 
                    value={githubRepo} 
                    onChange={(e) => setGithubRepo(e.target.value)} 
                    placeholder="username/repository"
                  />
                </div>
                <div className="input-help">
                  The target repository format is 'owner/repo' (e.g. ionhtx/Protonic).
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />

              {/* Notion Settings */}
              <div className="form-group">
                <label>Notion API Token</label>
                <div className="input-group">
                  <input 
                    type="password" 
                    value={notionToken} 
                    onChange={(e) => setNotionToken(e.target.value)} 
                    placeholder="secret_xxxxxxxxxxxxxxxxxxxx"
                  />
                </div>
                <div className="input-help">
                  Required to authenticate with Notion's workspace and map your headless content pages.
                </div>
              </div>

              <div className="form-group">
                <label>Notion Blog Database ID</label>
                <div className="input-group">
                  <input 
                    type="text" 
                    value={notionDbId} 
                    onChange={(e) => setNotionDbId(e.target.value)} 
                    placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  />
                </div>
                <div className="input-help">
                  The unique 32-character ID of the Notion Blog database to pull feed articles from.
                </div>
              </div>
            </div>
            <footer className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowSettings(false)}>Cancel</button>
              <button className="btn-primary" onClick={saveSettings}>Save Config</button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
