# Third-Party Notices

maliv-code bundles the following third-party content. All other dependencies
(opencode, oh-my-opencode) are **not** bundled — they are installed from their
official sources under their own licenses.

## karpathy-guidelines  (skills/karpathy-guidelines)

- **Source:** andrej-karpathy-skills by forrestchang — https://github.com/forrestchang/andrej-karpathy-skills
- **License:** MIT
- Bundled unmodified (frontmatter aside). Derived from Andrej Karpathy's observations on LLM coding pitfalls.

```
MIT License

Copyright (c) forrestchang

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## playwright MCP  (wired by the installer, not bundled)

maliv-code's installer adds the `@playwright/mcp` server to your opencode config
(`mcp` section). The package itself is fetched via `npx` from npm under its own
license (Apache-2.0) — maliv-code does not bundle it.
