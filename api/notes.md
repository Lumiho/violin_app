# Resonance Learning Notes

---

## CSS Concepts

### Keyframes
- Define animation states at different points (0%, 50%, 100%)
- Syntax: `@keyframes name { 0% { ... } 100% { ... } }`
- Used with `animation: name duration timing-function`

### Pseudo-elements (::before, ::after)
- Create virtual elements before/after an element's content
- Require `content: ''` to render (even if empty)
- Great for decorative effects without extra HTML

### :root
- Targets the document root (`<html>`)
- Used for CSS custom properties (variables): `--color-primary: #e0a850`
- Access with `var(--color-primary)`

---

## TypeScript + Vite Setup

### Project structure
```
/src
  main.ts       # App code
  types.ts      # Shared type definitions (with exports)
  styles.css    # Styles
  vite-env.d.ts # Ambient declarations (CSS modules, etc.)
/api
  ask.py        # Backend endpoint
```

### Key config files
- `package.json` - dependencies, scripts (`npm run dev`, `npm run build`)
- `tsconfig.json` - TypeScript compiler options
- `vite.config.ts` - Vite bundler config

### Types file patterns
| File | Purpose |
|------|---------|
| `types.ts` | Your own types with `export interface Foo {...}` |
| `types.d.ts` | Declaration files for ambient/global types or external JS |

### Import syntax (option 2 - specific imports)
```typescript
import { NoteInfo, PitchReading, PostureFlags } from './types'
```

### Common TS strict mode fixes
- Regex match: check `if (!match || !match[1])` before using
- Index access: use `array[i]!` or null checks with `noUncheckedIndexedAccess`
- Nullable types: `Float32Array<ArrayBuffer> | null`

---

## Python Backend (Flask)

### For Vercel deployment
- Place files in `/api` folder at project root
- Route path becomes `/api/filename` (e.g., `/api/ask`)

### Flask basics
```python
from flask import Flask, jsonify, request

app = Flask(__name__)

@app.route('/api/ask', methods=['POST'])  # methods is a LIST
def ask():
    data = request.get_json()        # Parse incoming JSON body
    question = data.get('question')  # Safe dict access (returns None if missing)

    # ... do stuff ...

    return jsonify({"answer": result})  # Return JSON response
```

### Anthropic SDK usage
```python
from anthropic import Anthropic
import os

client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

message = client.messages.create(
    model="claude-sonnet-4-20250514",  # Use valid model name
    max_tokens=1024,
    messages=[{"role": "user", "content": question}]
)

response_text = message.content[0].text  # Extract text from response
```

### Why Python backend?
- API keys in browser JS are exposed (view source, network tab)
- Server-side keeps keys secure
- Vercel serverless functions work well for this

---

## Agent Architecture (Future)

### Tools vs Agent
- **Tools**: Functions that read/expose state (get_pitch_stats, get_posture_flags)
- **Agent**: LLM that reasons over tool outputs and provides recommendations

### Data payload pattern
Frontend sends everything, agent uses what it needs:
```typescript
{
  question: "Where am I struggling?",
  pitch_stats: { ... },
  posture: { ... },
  correlations: { ... },
  session_history: { ... }
}
```

### Preset questions approach
Instead of free-form chat, offer preset questions:
- "Where am I struggling?" (needs pitch + posture data)
- "What should I practice next?" (needs correlations)
- "Am I improving?" (needs session history)

---

## Quick Reference

### npm commands
- `npm install` - install dependencies
- `npm run dev` - start dev server
- `npm run build` - production build (outputs to /dist)

### Git
- `.env` in `.gitignore` to protect API keys
- Never commit secrets