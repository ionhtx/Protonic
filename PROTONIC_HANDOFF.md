# Protonic — Project Handoff Document

> **This document exists so you can hand it to a new AI session (e.g., Antigravity) and pick up exactly where you left off without losing any context.**

---

## 1. What Is Protonic?

Protonic is a **Git-first, AI-augmented visual web editor** — think Webflow or Framer, but for arbitrary React/Node.js codebases that you own and host yourself.

Instead of locking you into a proprietary platform, Protonic:
- Renders your actual running website inside an `iframe` preview canvas.
- Lets you **click any element** to visually edit its text or CSS classes.
- Writes changes **directly back to your source code files** (`.jsx`, `.css`) on disk.
- Uses **GitHub** as the source of truth for all layout/code changes.
- Uses **Notion** as the CMS source of truth for dynamic content (blog posts, etc.).
- Has an **AI guardrail layer** (Antigravity) to review diffs before committing.

### The core insight
> Sanity and headless CMSes let you edit *content*. Webflow lets you edit *layouts* but locks you in. Protonic lets you edit *both*, while keeping your real codebase clean and on GitHub.

---

## 2. Project Location

| Resource | Location |
| :--- | :--- |
| **GitHub Repo** | [https://github.com/ionhtx/Protonic](https://github.com/ionhtx/Protonic) |
| **Local Workspace** | `C:\Users\heyde\Documents\antigravity\blissful-heisenberg\` |
| **Editor App** | `…\blissful-heisenberg\editor\` (runs on port **5174**) |
| **Website App** | `…\blissful-heisenberg\website\` (runs on port **5173**) |

### To get running locally
```powershell
# Clone (if on a new machine)
git clone https://github.com/ionhtx/Protonic.git
cd Protonic

# Install both projects
cd website; npm install; cd ..
cd editor; npm install; cd ..

# Run both (in separate terminals)
cd website; npm run dev
cd editor; npm run dev -- --port 5174
```
Then open **http://localhost:5174** to use Protonic.

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                   Protonic Editor Dashboard                     │
│                    (editor/ — port 5174)                        │
│                                                                 │
│  ┌──────────────┐   ┌────────────────────┐   ┌──────────────┐  │
│  │  Left Panel  │   │   Preview Canvas   │   │ Right Panel  │  │
│  │  (Inspector) │   │  (iframe :5173)    │   │  (Notion CMS)│  │
│  │              │   │                    │   │              │  │
│  │ - Source file│   │  postMessage ↕     │   │ - Blog posts │  │
│  │ - Line number│   │  click intercept   │   │ - Sync btn   │  │
│  │ - Text editor│   │                    │   │ - Status     │  │
│  │ - CSS classes│   │                    │   │              │  │
│  │ - Apply btn  │   │                    │   │              │  │
│  └──────────────┘   └────────────────────┘   └──────────────┘  │
│          │                                                      │
│          │ POST /api/save                                       │
│          ▼                                                      │
│  Vite Middleware (vite.config.js)                               │
│  - Reads target file                                            │
│  - Replaces line content                                        │
│  - Writes back to disk                                          │
│  - HMR triggers iframe reload                                   │
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│               Client Website (website/ — port 5173)             │
│                                                                 │
│  - React + Vite                                                 │
│  - Babel plugin injects data-source-file & data-source-line     │
│    into every JSX element at compile time                       │
│  - main.jsx intercepts clicks when inside iframe and            │
│    postMessages element metadata to parent (editor)             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Key Files & What They Do

### `website/vite.config.js`
Contains the custom **Babel compiler plugin** (`reactSourceAttributePlugin`) that auto-injects `data-source-file` and `data-source-line` attributes into every JSX element during development compilation. This is how Protonic knows which file and line to edit when you click an element.

> ⚠️ **Known Issue:** The Babel auto-injection is **not yet fully verified** as working end-to-end. During testing, we manually added `data-source-file="src/App.jsx" data-source-line="19"` directly to the `<h1>` tag in `website/src/App.jsx` to confirm the bridge and file-writing engine work (they do). The Babel plugin needs a full end-to-end test on a **fresh component** (one that has never had manual attributes added) to confirm it's injecting correctly at compile time. This is the **first thing to fix** in the next session.

### `website/src/main.jsx`
Checks if the site is running inside an iframe. If yes, it adds a global click event listener (capture phase) that intercepts clicks, reads the `data-source-*` attributes from the clicked element, prevents default browser behavior, and fires `window.parent.postMessage()` back to the editor dashboard.

### `editor/src/App.jsx`
The main Protonic dashboard UI. Key features:
- Listens for `VISUAL_ELEMENT_SELECTED` postMessage events from the website iframe.
- Displays selected element metadata (file, line, tag name, CSS class, text content).
- Two edit tabs: **Layout & Styles** (CSS class editing) and **Static Text** (text content editing).
- Shows a live proposed **code diff** before saving.
- **Apply Changes** button calls `POST /api/save` with the file path, line number, original value, and new value.
- Right panel: Notion CMS mock UI with blog post feed and sync button (mock only — not yet wired to real Notion API).

### `editor/vite.config.js`
Contains the **`/api/save` middleware** — a custom Vite dev server route. When called:
1. Parses the request body for `{ file, line, type, originalValue, newValue }`.
2. Resolves the absolute path to the target file inside `../website/`.
3. Reads the file, splits into lines.
4. Replaces the exact string on the target line.
5. Writes the file back to disk.
6. Vite HMR automatically recompiles and refreshes the preview iframe.

### `editor/src/App.css`
Full custom dark-mode design system for the Protonic dashboard. Uses CSS custom properties (`--bg-dark`, `--accent-color`, etc.). No Tailwind — pure vanilla CSS. Uses the `Outfit` Google Font.

---

## 5. Design Decisions & Rationale

| Decision | Rationale |
| :--- | :--- |
| **Git-first over Sanity/Webflow** | Clients have custom Node.js/React apps on Hostinger. Sanity only edits content, not layout. Webflow can't import arbitrary code. |
| **Notion for blog posts/content** | Writers already use Notion. Zero extra CMS to learn. Notion API handles reads; Protonic patches edits back via API. |
| **StackBlitz WebContainers (future)** | For cloud-hosted client previews. Currently runs locally. Phase 3 will migrate to WebContainers for zero-install client access. |
| **Vite middleware for file-writing** | No external backend needed for local dev. The editor's own Vite dev server doubles as the API. Production will need a lightweight Express or Node.js server. |
| **Babel plugin for source injection** | Mirrors how Onlook (open-source visual editor) works. Zero manual work for developers — every element is automatically trackable. |
| **AI guardrail (future)** | Instead of blind file writes, the AI (Antigravity) will review the proposed diff, verify no logic is broken, and approve before committing to GitHub. |
| **React (Vite) first** | Most client sites use React/Next.js. Vue/Svelte support can be added later since the Babel injection concept is framework-agnostic. |
| **Hostinger Node.js hosting** | Client's current hosting. Hostinger pulls directly from GitHub `main` branch. Production deploys = push to main. |
| **Component restrictions** | Arbitrary layout drag-and-drop (e.g., moving a sidebar) is **out of scope** for Phase 1/2. Only text and CSS class edits are supported to prevent AST corruption. |

---

## 6. Completed Work (Phases 1 & 2)

- [x] Scaffolded `website/` and `editor/` as separate Vite + React apps
- [x] Wrote Babel plugin that injects `data-source-file` / `data-source-line` into all JSX elements
- [x] Wrote iframe click interceptor in `website/src/main.jsx` using `postMessage`
- [x] Built full Protonic dashboard UI with left inspector panel, center iframe canvas, right Notion panel
- [x] Wrote `/api/save` Vite middleware that reads/writes files on disk
- [x] Wired "Apply Changes" button in the dashboard to the file-writing API
- [x] **Verified end-to-end:** Clicking `<h1>` in iframe → sidebar populates → edit text → Apply Changes → file on disk mutates → HMR reloads preview ✅
- [x] Committed and pushed all code to [https://github.com/ionhtx/Protonic](https://github.com/ionhtx/Protonic)

---

## 7. What Needs To Be Done Next (Phase 3+)

### 🔴 Immediate Fix (Start Here)
- [ ] **Verify the Babel auto-injection plugin** works end-to-end on a fresh `.jsx` component with no manual `data-source-*` attributes. Test by:
  1. Creating a new component `website/src/components/Hero.jsx`.
  2. Adding a `<h2>Hero Title</h2>` with no manual attributes.
  3. Importing it in `App.jsx`.
  4. Clicking the heading in the Protonic preview and confirming the inspector populates with file + line.
  5. If it doesn't, debug the Babel plugin — the likely issue is that `@vitejs/plugin-react` may be using SWC instead of Babel in this Vite 8 version, which would bypass our plugin entirely.

### 🟡 Phase 3: GitHub Integration (Real Commits)
- [ ] Add GitHub OAuth login to the editor dashboard.
- [ ] Connect the editor to the GitHub API (`@octokit/rest`) to:
  - [ ] Pull the list of files in the connected repo.
  - [ ] Create a new branch for edit sessions (e.g., `protonic/edit-session-2026-05-27`).
  - [ ] Push file changes as commits to that branch.
  - [ ] Open a Pull Request from the edit branch → `main` for review.
- [ ] Add a "Publish" button that merges the PR (or directly pushes to `main`).

### 🟡 Phase 3: Real Notion Integration
- [ ] Set up Notion OAuth or Internal Integration token in the editor settings.
- [ ] Create a `notion-map.json` file in the website project that maps component IDs to Notion page/block IDs.
- [ ] When a Notion-mapped element is clicked, open an inline edit panel that calls the Notion API to patch the block content.
- [ ] Add a real "Sync Notion" button that fetches the latest database pages and triggers a local build refresh.

### 🟢 Phase 4: Cloud Preview (WebContainers)
- [ ] Replace the local `http://localhost:5173` iframe with a **StackBlitz WebContainers** sandbox.
- [ ] When a client opens Protonic, the editor clones the GitHub repo into a WebContainer and serves it in-browser.
- [ ] This removes the need for the client to run any local dev server — full cloud-based visual editing.

### 🟢 Phase 5: AI Guardrail Layer (Antigravity Integration)
- [ ] Before writing any file change to disk (or committing to GitHub), pipe the proposed diff to the Antigravity AI API.
- [ ] The AI checks: Does this change break any JS logic? Are the Tailwind classes valid? Does the layout remain responsive?
- [ ] If the AI approves → write the change. If not → show the AI's feedback to the user with a suggested correction.
- [ ] Add an "Ask AI" button in the inspector panel for freeform prompts (e.g., "Make this hero section look more modern").

### 🔵 Phase 6: Image Replacement
- [ ] When an `<img>` tag is selected in the inspector, show an "Replace Image" panel.
- [ ] Allow file upload → either save to `website/public/` or upload to a CDN (Cloudinary).
- [ ] Update the `src` attribute in the source file via the existing `/api/save` mechanism.
- [ ] Support AI-generated images via the Antigravity image generation API.

---

## 8. Known Issues & Gotchas

| Issue | Status | Notes |
| :--- | :--- | :--- |
| Babel auto-injection not fully verified | 🔴 Open | See immediate fix above. May need to switch to an SWC plugin if Vite 8 uses SWC by default. |
| `/api/save` does string replacement, not full AST | 🟡 Acceptable | Works for simple text and class edits. Will break if the same string appears multiple times on the same line. Full Babel/AST replacement needed for Phase 3. |
| No auth on `/api/save` | 🟡 Dev only | Any page loaded in the browser can call this API and write to disk. This is fine for local dev but **must be locked down** before any cloud deployment. |
| Notion panel is mock UI only | 🟡 Open | No real Notion API calls yet. Phase 3 work. |
| iframe CORS | 🟡 Local only | Works because both servers are on `localhost`. Cloud deployment will need proper CORS headers or a proxy. |
| No undo/redo | 🟡 Open | File writes are immediate and permanent. Phase 3 should add git-branch-based undo (revert commit). |

---

## 9. Tech Stack Summary

| Layer | Technology |
| :--- | :--- |
| Editor Dashboard | React + Vite (port 5174) |
| Client Website (demo) | React + Vite (port 5173) |
| Styling | Vanilla CSS with custom properties |
| Font | Outfit (Google Fonts) |
| Babel Plugin | `@vitejs/plugin-react` with custom Babel visitor |
| File Writing API | Custom Vite dev server middleware |
| Version Control | Git → GitHub (`ionhtx/Protonic`) |
| Planned CMS | Notion API (`@notionhq/client`) |
| Planned Cloud Preview | StackBlitz WebContainers |
| Planned Hosting | Hostinger Node.js (pulls from GitHub `main`) |
| Planned AI Layer | Antigravity (diff review + freeform prompts) |

---

## 10. How To Brief A New AI Session

Paste the following prompt to a new Antigravity session along with this document:

> "I am building a project called **Protonic** — a Git-first visual web editor for React codebases. The full context, architecture, completed work, and next steps are in the attached handoff document. Please read it carefully. The most urgent thing to fix is verifying that the Babel auto-injection plugin in `website/vite.config.js` is actually injecting `data-source-file` and `data-source-line` attributes into compiled JSX elements. The repo is at https://github.com/ionhtx/Protonic. Start by cloning it, reading the handoff doc, and diagnosing the Babel plugin."
