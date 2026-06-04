# TRACE — Algorithm Visualizer

A free, interactive **Python algorithm visualizer** that runs code line-by-line in your browser and visualizes every step — arrays, linked lists, trees, heaps, graphs, recursion, and more.

Perfect for **LeetCode practice, DSA learning, teaching, and debugging** tricky algorithms.

## Features

✨ **Line-by-line execution** — watch every variable mutation in real-time  
📊 **Data structure visualization** — arrays as bars, trees as nodes, heaps as shapes, linked lists as chains  
🌳 **Recursion tree** — see the entire call stack and how recursive functions branch  
⚡ **Live mode** — edit code and auto-rerun as you type (1s debounce)  
💾 **Save & share** — snapshot your trace, share via URL, no account needed  
🎨 **5 themes** — light, dark, ocean, slate, nord  
🔍 **Auto-parse LeetCode input** — paste directly from problem statements  

## Quick Start

1. Visit **[trace.pages.dev](https://trace.pages.dev)**
2. Pick an example or paste your Python code
3. Paste test input in LeetCode format: `nums = [1,2,3], target = 9`
4. Click **RUN** (or **Cmd+Enter**)
5. Step through or hit **▶ Play** to watch it execute

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Cmd/Ctrl + Enter** | Run code |
| **Cmd/Ctrl + /** | Toggle comments |
| **←** / **→** | Step backward / forward |
| **Space** | Play / Pause animation |
| **Cmd/Ctrl + S** | Save as snippet |
| **Cmd/Ctrl + K** | Open snippets menu |
| **Cmd/Ctrl + D** | Toggle dark/light mode |
| **?** | Help & shortcuts |

## Supported Input Formats

```
# Standard LeetCode
nums = [1,2,3], target = 9
head = [1,2,3], pos = 1

# Trees (auto-builds from array)
root = [3,9,20,null,null,15,7]

# Design problems
["MedianFinder","addNum","findMedian"] / [[],[1],[]]

# Paste directly from LeetCode site
Input: nums = [1,2,3], target = 9
Output: 0
Explanation: ...
```

## How It Works

1. **Python code** → runs via **Pyodide** (CPython compiled to WebAssembly)
2. **Tracer** hooks every line execution and captures state snapshots
3. **Visualizers** render data structures from the captured state
4. **UI** lets you step through, play, jump to lines, edit live

All execution happens **in your browser** — no server, no uploads, no sign-up.

## Supported Data Structures

- **Arrays & Lists** — bar charts or pill lists
- **Heaps** — tree visualization with heap-order highlighting
- **Linked Lists** — node chains with cycle detection
- **Binary Trees** — full tree layout with node IDs
- **Graphs** — adjacency-list or matrix visualization
- **Dicts / Sets** — key-value tables and set members
- **Queues / Deques** — FIFO/LIFO element order
- **Recursion** — call stack tree with active path highlighted

## Analytics & Feedback

TRACE uses **PostHog** to collect usage metrics (anonymously):
- Page views and code-run events (step counts, error rates)
- JavaScript errors and exceptions
- User bug reports (via the 🐞 button)

Zero personal data is collected. All data stays private to your PostHog account.

To opt out: disable JavaScript or use a privacy-focused browser.

## Tech Stack

- **Frontend:** Vanilla HTML5 + CSS3 + JavaScript (no build step)
- **Runtime:** Pyodide (CPython 3.x in WASM)
- **Editor:** CodeMirror 5 (Python syntax, themes, indent guides)
- **Hosting:** Cloudflare Pages (free, global CDN)
- **Analytics:** PostHog (free tier)

## Development

Clone the repo:
```bash
git clone https://github.com/soumil007-pdg/TRACE-visualizer.git
cd TRACE-visualizer
```

Serve locally:
```bash
python3 -m http.server 8765
# or: npx http-server -p 8765
# or: any local server on port 8765
```

Visit **http://localhost:8765** in your browser.

No build step, no dependencies — just edit files and refresh.

## Project Structure

```
TRACE-visualizer/
├── index.html              # Main app shell
├── favicon.svg             # Logo
├── og-image.png            # Social media preview (1200×630)
├── robots.txt              # SEO crawler instructions
├── sitemap.xml             # Site structure for Google
│
├── css/
│   ├── base.css            # Design tokens, layout grid, resets
│   ├── visualizer.css      # Data structure visualizations
│   ├── themes.css          # 5 color themes
│   └── pro.css             # UI polish (modals, mobile, animations)
│
├── js/
│   ├── config.js           # PostHog / Sentry keys
│   ├── analytics.js        # Event tracking + bug reports
│   ├── utils.js            # Helpers (HTML escape, format values)
│   ├── storage.js          # LocalStorage + toast notifications
│   ├── tracer.js           # Python tracer code (runs in Pyodide)
│   ├── parser.js           # LeetCode input parser
│   ├── templates.js        # Example code snippets
│   ├── renderers.js        # Data structure visualizers
│   ├── renderers-recursion.js
│   ├── render-core.js      # Main render loop + state management
│   ├── controls.js         # Editor, buttons, theme, live mode
│   ├── runner.js           # Pyodide bootstrap + execution
│   ├── pro-ui.js           # Modals, snippets, mobile menu
│   ├── shortcuts.js        # Keyboard binding
│   └── app.js              # Startup + state restore
│
└── README.md               # This file
```

## Configuration

Edit **`js/config.js`** to add your own keys:

```javascript
window.TRACE_CONFIG = {
  POSTHOG_KEY:  'phc_xxxxx',           // PostHog analytics (free)
  POSTHOG_HOST: 'https://us.i.posthog.com',
  SENTRY_DSN:   'https://...',         // Optional error tracking
  SITE_URL:     'https://trace.dev',   // Your domain
};
```

Leave them empty (`''`) to disable analytics.

## Deployment

### To Cloudflare Pages (recommended)

1. Create empty GitHub repo
2. Push your code: `git push -u origin main`
3. In Cloudflare dashboard → **Workers & Pages** → **Create application** → **Pages** tab
4. Choose **"Connect to Git"** → select this repo
5. Build command: (leave blank)
6. Build output: `.`
7. Click **"Save and Deploy"**

Your site lives at **`[repo-name].pages.dev`** and auto-deploys on every push.

To use a custom domain later, add it in **Cloudflare → Domains** (or via CNAME).

## License

MIT — use freely, modify, share.

## Questions?

- 🐞 Found a bug? Click the **🐞** button in the app to report it
- 💭 Want a feature? Open an issue on GitHub
- 📧 Email: soumilpdg@gmail.com

---

**Built with ❤️ by Soumil**

*Making algorithm learning visual, interactive, and fun.*
