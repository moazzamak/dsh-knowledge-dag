# dsh-knowledge-dag

A DSH plugin that shows a research graph: the questions, what they derive
from, what they rest on, and what they ended in, with a page per node
written in plain English. It reads a node store from disk — one JSON file
per node, plus the generated markdown page for each — and puts it in the
right pane of the harness as a node-link picture, a filterable board and a
steering frontier, with the same content available to the model as a
`knowledge_dag` tool. The store is generic: the research record this was
written for is the first source, and the model's own knowledge base can be
a second.

The package is four files and no build step, so a direct install works:

- `index.mjs` — the host half, in plain ESM JavaScript
- `client.cjs` — the browser half, in the harness client-bundle format
- `cordis.patch.yml` — the bundle patch that wires the plugin into a profile
- `package.json` — the manifest, whose registration surface is small:

```json
"dsh": {
  "bundle": { "patch": "./cordis.patch.yml" },
  "client": { "platform": "web" }
}
```

## Install

Install the bundle into a profile with the plugin manager:

```
dsh plugin --profile <profile> add github:moazzamak/dsh-knowledge-dag
```

Target the profile you actually boot, then restart the harness.

### From a local checkout

Point the profile at this directory instead. In the profile directory
(`~/.dsh/profiles/<profile>`):

1. add this package as a dependency, with a `file:` specifier pointing at
   this directory;
2. append its name to `dsh.profile.bundles` in the same `package.json`, so
   the bundle patch in this package is applied;
3. run `pnpm install --no-frozen-lockfile`, with `CI=true` set: pnpm refuses
   to remove the modules directory without a terminal, and under `CI` it
   defaults to a frozen lockfile that the new dependency invalidates;
4. restart the harness, and confirm the boot audit lists no pending entry.

Back up `package.json` first. If the install fails, restore it, otherwise
the profile is left declaring a dependency that is not there and can fail
to boot. The installed copy is read from
`~/.dsh/profiles/<profile>/node_modules/dsh-knowledge-dag`.

## What you get

### In the browser

- **A frame trigger.** A graph button pinned to the top right of the frame
  (`shell.overlay`, above every column). One click opens the pane and the
  tab, a second closes the pane. Its state is read from the pane's open-tab
  inventory for the on-screen session, so it survives reloads and does not
  read as open in a session that never opened it.
- **A guide entry.** The pane's "+" menu lists "Knowledge graph", through
  the same tab registration the shipped Files and Terminal tabs use
  (`sidebarRightTabs`, kind `knowledge-dag`).
- **The panel**, three views over one fetch:
  - **Graph** — the record as a node-link picture. A layered DAG layout (a
    node's column is the longest chain of parents beneath it,
    barycenter-ordered within the column), drawn as SVG: one box per node,
    one arrow per lineage edge, dashed when the edge crosses tracks. A
    node's dot carries its status tone; search and filters dim rather than
    remove, so the shape of the record survives the question "where is this
    one". Drag to pan, wheel to zoom, `fit` for the whole record, click a
    node for its page. The layout is deterministic, so a node stays where
    the reader last found it.
  - **Board** — the same nodes as rows, filtered by the search box, the
    status list and the track list, with live counts.
  - **Frontier** — what is open or running, each with its prediction, its
    falsifier and its decision menu.
- **A node detail page**, opened from the graph, the board or the frontier:
  the question, the story beats in English (investigating, assumed, found,
  what it means), the registered prediction and falsifier, how it is
  measured, the decision menu with what each path implies, lineage chips,
  the measured outcome with its numbers, and its structural analogs — with
  the library-generated markdown page beneath them, so the view and the
  record cannot disagree.

### In the model's tool list

`knowledge_dag` answers four operations, each over the default store or a
named one:

- `list` — every node with its kind, track, status and verdict
- `show` — one node's full body, by id
- `frontier` — what is open or running, with the prediction and the
  falsifier for each
- `analogs` — nodes whose *structure* matches one node (the same relational
  shape: prediction, falsifier, decision menu, measured numbers, lineage)
  while their surface — track, topic — differs

### Over HTTP

Four GET routes under `/dsh-knowledge-dag`:

- `GET /dsh-knowledge-dag/graph` — the whole record, with its lineage edges
  and the names of the configured stores
- `GET /dsh-knowledge-dag/frontier` — the open-or-running subset
- `GET /dsh-knowledge-dag/node?id=<id>` — one node plus its markdown page
- `GET /dsh-knowledge-dag/analogs?id=<id>` — one node's structural analogs

Each accepts `?store=<name>`. The node id travels as a query parameter
rather than a path segment, and a malformed id is rejected before any file
is touched. The routes are registered only where a browser carrier appears:
the host half uses the deferred form, so the tool still works in a headless
profile.

## Configuration

The bundle patch mounts one row. Its `config`:

| Field | Default | Meaning |
| --- | --- | --- |
| `store` | `analysis/graph/nodes` | directory of the `<id>.json` node files |
| `pages` | `analysis/nodes` | directory of the `<id>.md` pages |
| `workspace` | `""`, the host process's working directory | the base a relative `store` or `pages` resolves against |
| `stores` | `{}` | further named stores, each `{ store, pages }` |

Example row:

```yaml
- id: knowledge-dag
  name: dsh-knowledge-dag
  config:
    workspace: ~/projects/my-record    # what the paths below are relative to
    store: analysis/graph/nodes        # the default, unchanged
    pages: analysis/nodes
    stores:
      model:                           # read with store: "model"
        store: model/knowledge/graph/nodes
        pages: model/knowledge/nodes
```

`workspace` is what a relative `store`/`pages` resolves against. Name it
whenever the record is not read by a CLI started inside the project: the fs
backend resolves a relative path from the host process's working directory,
and the Desktop application starts its host in the profile directory, where
`analysis/graph/nodes` resolves to nothing and every read answers `not
found`. Absolute `store`/`pages` values need no `workspace`; leaving it out
keeps the process-directory behaviour.

## The node-store contract

A store is two directories and the files in them:

- **Nodes** are JSON files, one per node, named `<id>.json`. The file stem
  is the id — node bodies carry no `id` field of their own, and the pages
  are named after the same stem.
- **Pages** are generated markdown, `<id>.md` under `pages`. A node without
  a page is still a node: the view degrades to the structured body alone.
- **Ids** match `[a-z0-9][a-z0-9._-]*`; anything else is refused as a
  malformed request rather than resolved as a path.

The plugin works over any node store behind four operations and nothing
else:

```
load(store)        -> nodes
validate(nodes)    -> problems
save(store, nodes)
render(nodes)      -> view
```

The fields the views and the tool project from a node:

- identity and fate: `kind`, `track`, `status`, `outcome.verdict`
- one line of English: the first of `question`, `title`, `mechanism`,
  `statement`
- derivation: `lineage`, the parent ids the arrows are drawn from. A parent
  that is not in the store is dropped rather than drawn as a stub
- registered uncertainty: `question`, `prediction`, `falsifier`,
  `measurement`, `cost_tier` — what the frontier shows
- the decision space: `decision_menu`, a map from an option to what it
  implies
- the account: `story.investigating`, `story.assumed`, `story.found`,
  `story.means`
- the outcome: `outcome.verdict`, `outcome.decision`, `outcome.reason`,
  `outcome.numbers`
- what it replaced (`displacement`) and its `artifacts`

The vocabulary is open: a store names its own statuses and verdicts, and
the view tones the ones it knows while everything else stays neutral rather
than being forced into a colour it does not mean.

The invariants stay in the library. Validation lives in
`tools/research_graph.py`, in the research record this plugin was written
for, and is enforced by its suite; this plugin reads stores and rendered
pages and never becomes a second, weaker checker. A plugin that decided for
itself what a valid graph is would drift from the one the build trusts.

## Reading a second store

The tool and its routes read one store by default and any named store on
request, so a second source — the model's knowledge base — is read through
the same list, show, frontier, analogs and page operations as the research
record. Name the stores in the row configuration, as in the example above.
Then `knowledge_dag` with no `store` reads the default store, and with
`store: "model"` reads the named one — the same over HTTP, where
`/dsh-knowledge-dag/graph?store=model` and
`/dsh-knowledge-dag/node?id=<id>&store=model` answer it. The default store
is reported as `research`, and the panel's store picker lists whatever the
row configures.

An unknown name is reported as an error rather than falling back to the
default, so a typo cannot quietly show the wrong store. A second store
keeps the same contract: nodes as JSON files, pages as generated markdown.
A store with a different shape needs its own reader rather than a second
interpretation of this one.

## Checking that the browser half still activates

The browser half has no build step, so nothing type-checks it and nothing
loads it outside a browser: a broken `client.cjs` surfaces only as the
harness boot audit reporting that this entry did not activate.
`tests/activate.mjs` is the gate that catches it without the application.
It evaluates the real `client.cjs`, calls `apply` over service fakes that
enforce the 0.2.0 registry rules, renders every registration once, and
checks that the frame trigger reads the **on-screen** session rather than
any session:

```
node tests/activate.mjs
```

React comes from a `deepseek-harness` checkout; set `DSH_CHECKOUT` when the
checkout is not a sibling or grandparent `deepseek-harness` directory.

**A restart is what loads either half.** The host reconciles the client
bundle roster at boot and versions the bytes it serves by a content hash,
so after editing `client.cjs` a page reload asks for the revision it
already holds and gets the cached copy. Restart the application after
changing `index.mjs` or `client.cjs`, then reload the page.

## How the two halves are put together

**Host half** (`index.mjs`) registers one row: the `knowledge_dag` tool,
and the four routes deferred through `ctx.inject(['webServer'], …)`. Two
rules, both taken from the working reference plugin
[`moazzamak/dsh-voice-input`](https://github.com/moazzamak/dsh-voice-input),
are what keep it booting: one row only, because the boot audit fails on any
entry left pending and a second row that waits for the browser carrier
breaks the headless, SDK and ACP profiles; and never read the carrier
during `apply`, because reading it there sees `undefined` — which is how the
reference plugin's route silently never registered. It reads everything
through `ctx.fs` and deliberately injects no shell service: a profile that
mounts no shell-executor row registers the call fine and fails on first
use.

**Client half** (`client.cjs`) registers itself through the harness loader:

```js
window.__ModuleLoader__.load({ id, factory })
```

It declares the services it binds (`slots`, `sidebarRight`,
`sidebarRightTabs`, `layout`) and registers the tab type, the tab body, the
title chip and the frame trigger. Node bodies and pages are fetched from
the host half rather than rebuilt here, so the view cannot disagree with
the file a reader trusts.
