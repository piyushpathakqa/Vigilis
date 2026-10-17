# Public framework documentation lookup

Vigilis's shared tool registry includes `web_search` and `web_fetch`, so its CLI
agent and MCP clients can consult current Playwright, Cypress or Selenium
documentation. [Parallel Search MCP](https://docs.parallel.ai/integrations/mcp/search-mcp)
provides anonymous Fast-mode search and page extraction at
`https://search.parallel.ai/mcp`. No Parallel account or API key is needed.
Anonymous access has usage limits; a failed lookup returns a tool error so the
agent can continue with local evidence. It never switches providers silently.

The tools are available by default. A registry does not make a network connection
until a tool is called. This adds external documentation lookup to installations
that previously only had local browser, file and test tools.

## Private or offline projects

Queries, objectives and fetched URLs go to Parallel. Send only public framework
questions and public documentation URLs, never private application URLs, spec
contents, failure logs, personal data or secrets. The tool descriptions and triage
prompt reinforce this boundary, but they are model guidance, not a data-loss
prevention filter. Remove the tools when external lookup is not permitted:

```bash
VIGILIS_SEARCH=off npx vigilis triage http://localhost:3100/login --spec tests/login.spec.ts
```

Set the same environment variable before starting `vigilis-mcp` to omit the tools
from MCP discovery. In a client server entry, use
`"env": { "VIGILIS_SEARCH": "off" }`. Restart the server after changes. MCP client
permission settings continue to govern calls to exposed tools.

`VIGILIS_SEARCH=parallel` explicitly selects the anonymous provider; unset is the
same. Other values fail configuration rather than enabling search unexpectedly.
This integration does not read `PARALLEL_API_KEY` or other saved credentials.
Existing model, framework and attestation configuration stays in effect.

## Core embedders

`createDefaultRegistry()` supplies the default tools. For an explicit choice:

```ts
import { createDefaultRegistry, type SearchProvider } from '@argus/core';

const localOnly = createDefaultRegistry({ search: false });
const chosen: SearchProvider = {
  async call(name, args, signal) {
    // Route to your existing provider, honoring signal. Return { content, isError? }.
    return { content: await lookupWithYourProvider(name, args, signal) };
  },
};
const registry = createDefaultRegistry({ search: chosen });
```

Explicit `search` options override the environment. A custom provider's errors
return through the registry without a Parallel fallback. Pass an `AbortSignal` as
`ToolContext.signal` when executing tools to cancel an in-flight lookup. The MCP
server forwards its request cancellation automatically. Default Parallel calls
have one 30-second deadline covering connection, discovery and tool execution;
each call closes its connection. Search and fetch in the same registry share a
stable conversation identifier.

`web_search` takes an `objective` and one to five `search_queries`. `web_fetch`
takes one to twenty HTTP(S) `urls`, plus optional `objective` (up to 200 characters)
and `search_queries`. It returns excerpts rather than requesting full pages.
Source URLs and text pass back into the agent's normal tool-result messages.
The CLI and MCP server use Vigilis's existing browser context, so their normal
Chromium installation requirement still applies.
Treat page content as untrusted reference material, never instructions. A web
reference cannot establish that a test is DOM drift or make a real bug safe to heal;
Vigilis must still verify the live application.
