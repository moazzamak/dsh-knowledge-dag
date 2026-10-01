# dsh-knowledge-dag: the plan

A DSH plugin that shows a research graph: the questions, what they derive
from, what they rest on, and what they ended in, with a page per node
written in plain English. Generic over any node store, so the DeepSeek
research graph is the first source and the model's own knowledge base can
be the second.

Status: **written, not installed.** All four files exist and both
JavaScript halves parse. Nothing has been copied into a profile, so the
boot audit has not yet been run against a real composition. The host half must not run anything
through `ctx.shell` on this desktop profile, because no shell-executor
row is mounted there and the call fails only on first use; use
`ctx.subprocess.spawn` or `ctx.fs`. This record was written from the working
reference plugin so the build does not have to guess the contract.

## What DSH plugins are

Learned from `moazzamak/dsh-voice-input`, installed on this machine at
`C:\Users\mak\.dsh\profiles\<profile>\node_modules\dsh-voice-input`, with
its source at `C:\Users\mak\Documents\projects\dsh-plugins\dsh-voice-input`.

A plugin is an npm package, installed per profile. Its `package.json`
registration surface is small:

```json
"dsh": {
  "bundle": { "patch": "./cordis.patch.yml" },
  "client": { "platform": "web" }
}
```

Four files, and no build step, so a direct install works:

| File | Role |
| --- | --- |
| `package.json` | the manifest above, plus `main` and `exports` for `./client` |
| `index.mjs` | the host half, in plain ESM JavaScript |
| `client.cjs` | the client half, in the harness client-bundle format |
| `cordis.patch.yml` | the bundle patch that wires the client in |

Three rules the reference plugin records in its own header, each from a
bug it hit:

1. **One row.** The boot audit fails on any entry left pending, so a
   second row that waits for the browser carrier breaks the headless, SDK
   and ACP profiles.
2. **Defer the browser carrier.** `ctx.inject(['webServer'], callback)`
   runs the callback when the carrier appears, and never runs where there
   is none.
3. **Do not read the carrier during `apply`.** Reading it once there sees
   `undefined`, which is how the reference plugin's route silently never
   registered.

The client half registers itself through the harness loader:

```js
window.__ModuleLoader__.load({ id, factory })
```

## The adapter

The plugin must work over any node store, so the store is behind four
operations and nothing else:

```
load(store)        -> nodes
validate(nodes)    -> problems
save(store, nodes)
render(nodes)      -> view
```

The first implementation is this repository's research graph: one JSON
file per node under `analysis/graph/nodes/`, with the invariants already
enforced by `tools/research_graph.py` and its `python -m tools.run.research`
adapter. The second is the model's knowledge base, where a claim about
what the seed knows becomes a node like any other.

The invariants stay in the library. The view may not become a second,
weaker checker: a plugin that decided for itself what a valid graph is
would drift from the one that the suite enforces.

## What the two halves do

**Host.** One row, registering a `knowledge_dag` tool with the operations
the library already has: list, show, check, and render. The browser route
for the client is deferred through `ctx.inject`, so a headless profile
still loads the row and the tool still works there.

**Client.** A view that draws the lineage as a graph and opens a node's
page on click, showing the four beats in English with the machine fields
beneath them. The same content as `analysis/INDEX.md` and
`analysis/nodes/<id>.md`, which the repository already generates.

## Where it will live, and how it installs

Reproducible source in its own directory (`dsh-plugins/dsh-knowledge-dag`,
moved out of the CG-MoE research repository), following the patch convention
already used for the voice plugin:

```
dsh-knowledge-dag/
  package.json
  index.mjs
  client.cjs
  cordis.patch.yml
  README.md
```

Installed by copying into `.dsh/profiles/<profile>/node_modules/`, one
copy per profile. The installed harness is never edited by hand, which is
the property that keeps a working GUI working.

## What to do next

1. Write the four files, with `index.mjs` as one row and the route
   deferred.
2. Install into one profile and confirm the harness still boots: the boot
   audit must report no pending entry.
3. Open a node in the GUI and check that its page matches the generated
   markdown, so the view and the record cannot disagree.
4. Add the model's knowledge base as the second store behind the same four
   operations, and check the invariants still hold there.

## Pointers

- The record it reads: `analysis/README.md`, `analysis/INDEX.md` (in the CG-MoE
  research repository, `..\..\Research Work\CG-MoE`).
- The library and its invariants: `tools/research_graph.py` (same repository).
- The command adapter: `tools/run/research.py` (same repository).
- The reference plugin: `C:\Users\mak\Documents\projects\dsh-plugins\dsh-voice-input`.
- The patch convention: `..\dsh-voice-input-patch\README.md`.

## Installing it the way this harness does

The earlier section describes copying this directory into a profile's
`node_modules`, which is not how the harness loads a plugin and was wrong. A
profile declares its plugins in its own `package.json` and composes its tree
from bundles plus `cordis.patch.yml`; copying a directory in by hand is
ignored at best and removed by the next `pnpm install`.

To install, in the profile directory (`<dsh home>/profiles/<profile>`):

1. add this package as a dependency, with a `file:` specifier pointing at
   this directory (`dsh-plugins/dsh-knowledge-dag`);
2. append its name to `dsh.profile.bundles` in the same `package.json`, so
   the bundle patch in this package is applied;
3. run `pnpm install --no-frozen-lockfile`, with `CI=true` set: pnpm refuses
   to remove the modules directory without a terminal, and under `CI` it
   defaults to a frozen lockfile that the new dependency invalidates;
4. reload the harness, and confirm the boot audit lists no pending entry.

Back up `package.json` first. If the install fails, restore it, otherwise the
profile is left declaring a dependency that is not there and can fail to
boot.

## Reading a second store

The tool and its routes read one store by default and any named store on
request, so the model's knowledge base is read through the same list, show,
frontier and page operations as the research record. Name the stores in the
plugin's configuration:

```yaml
- id: knowledge-dag
  name: dsh-knowledge-dag
  config:
    store: analysis/graph/nodes        # the default, unchanged
    pages: analysis/nodes
    stores:
      model:                            # read with store: "model"
        store: model/knowledge/graph/nodes
        pages: model/knowledge/nodes
```

Then `knowledge_dag` with no `store` reads the research record, and with
`store: "model"` reads the model's knowledge base. `GET
/dsh-knowledge-dag/graph?store=model` and `GET
/dsh-knowledge-dag/node/<id>?store=model` do the same over HTTP. An unknown
name is reported as an error rather than falling back to the default, so a
typo cannot quietly show the wrong store.

The second store keeps the same contract: nodes as JSON files, pages as
generated markdown. A store with a different shape needs its own reader
rather than a second interpretation of this one.
