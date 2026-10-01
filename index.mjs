/**
 * Host half of `dsh-knowledge-dag`: the `knowledge_dag` tool, plus the two
 * browser routes the client half reads.
 *
 * Three rules, each learned from the voice plugin in this same repository
 * (`../dsh-voice-input`, the working reference):
 *
 * - ONE row. The boot audit fails on any entry left pending, so a second
 *   row that waits for the browser carrier breaks the headless, SDK and ACP
 *   profiles.
 * - NO `ctx.shell`. This desktop profile mounts no shell-executor row, and
 *   Cordis resolves an absent injected service leniently, so a shell call
 *   registers fine and fails on first use. Everything here reads files
 *   through `ctx.fs`.
 * - Do not read the browser carrier during `apply`. Reading it there sees
 *   `undefined`, which is the bug that made the voice plugin's route
 *   silently never register. `ctx.inject(['webServer'], cb)` is the
 *   deferred form: the callback runs when the carrier appears, and never
 *   runs where there is none.
 *
 * The route handlers speak RAW Node req/res — the carrier's only contract
 * (the voice plugin's routes are the proof: `req.method`, `req.headers`,
 * `req.url`, and `res.statusCode`/`res.end()`). Express-style
 * `request.query`/`response.status().json()` do not exist here and throw
 * on first call, which is exactly what the previous version did.
 *
 * The invariants are NOT reimplemented here. Validation lives in
 * `tools/research_graph.py` (CG-MoE) and is enforced by its suite; this
 * half reads the store and the rendered pages. A second checker in
 * JavaScript would be free to disagree with the one the build trusts.
 *
 * Plain JavaScript, no build step, so a direct install works.
 *
 * @module dsh-knowledge-dag
 */

export const name = 'knowledge-dag'

/** `shell` is deliberately absent: see the header. */
export const inject = ['tools', 'fs']

export const ROUTE = '/dsh-knowledge-dag'
export const DAG_TOOL_NAME = 'knowledge_dag'

/**
 * Where a store's nodes are and where its rendered pages are.
 *
 * `stores` holds further stores behind the same four operations, so the
 * model's knowledge base is read the way the research record is rather than
 * through a second tool. The default store stays what it was, so a profile
 * that configures nothing behaves as before.
 */
export class Config {
  constructor(options = {}) {
    this.store = options.store ?? 'analysis/graph/nodes'
    this.pages = options.pages ?? 'analysis/nodes'
    this.stores = options.stores ?? {}
  }

  /** The paths for a named store, or null when the name is unknown. */
  pick(name) {
    if (!name) return { store: this.store, pages: this.pages }
    const found = this.stores[name]
    if (!found) return null
    return {
      store: found.store ?? this.store,
      pages: found.pages ?? this.pages,
    }
  }
}

export const DAG_PARAMETERS = {
  type: 'object',
  properties: {
    operation: {
      type: 'string',
      enum: ['list', 'show', 'frontier'],
      description:
        'list every node with its kind, track, status and verdict; show one ' +
        'node by id; frontier lists what is open or running, with the ' +
        'prediction and the falsifier for each',
    },
    id: {
      type: 'string',
      description: 'the node id, required for the show operation',
    },
    store: {
      type: 'string',
      description:
        'which store to read: the research record by default, or a name ' +
        'listed in the profile configuration, such as the model knowledge ' +
        'base',
    },
  },
  required: ['operation'],
}

function describe() {
  return 'Read the research knowledge graph: the questions, what they ' +
         'derive from, what they rest on and what they ended in.'
}

/**
 * The file names of one store directory, `.json` entries only.
 *
 * `ctx.fs.listDir` is the fs service's directory API (there is no `list`).
 * An entry may be a bare name or an object with a `name` field, so both
 * shapes are accepted rather than assuming one.
 */
async function jsonEntries(ctx, dir) {
  const resolved = await ctx.fs.resolve(dir)
  const entries = await ctx.fs.listDir(resolved)
  const names = []
  for (const entry of entries) {
    const value = typeof entry === 'string' ? entry : String(entry?.name ?? '')
    if (value.endsWith('.json')) names.push(value)
  }
  return names
}

async function readJson(ctx, path) {
  const resolved = await ctx.fs.resolve(path)
  return JSON.parse(await ctx.fs.readText(resolved))
}

async function loadNodes(ctx, config, name) {
  const where = config.pick(name)
  if (!where) return null
  const names = await jsonEntries(ctx, where.store)
  const nodes = []
  for (const file of names) {
    const node = await readJson(ctx, `${where.store}/${file}`)
    // The store's files are named `<id>.json` and the node bodies carry no
    // `id` field of their own — the file stem IS the id, and the pages are
    // named after it too. Without this, every board entry would answer
    // `undefined` and no page could ever be opened.
    nodes.push({ id: file.slice(0, -'.json'.length), ...node })
  }
  return nodes.sort((left, right) => String(left.id ?? '')
    .localeCompare(String(right.id ?? '')))
}

function oneLine(node) {
  for (const field of ['question', 'title', 'mechanism', 'statement']) {
    if (node[field]) return String(node[field])
  }
  return ''
}

function board(nodes) {
  return nodes.map((node) => ({
    id: node.id,
    kind: node.kind,
    track: node.track,
    status: node.status,
    verdict: (node.outcome ?? {}).verdict ?? '',
    title: oneLine(node),
  }))
}

function frontier(nodes) {
  return nodes
    .filter((node) => ['open', 'running'].includes(node.status))
    .map((node) => ({
      id: node.id,
      title: oneLine(node),
      prediction: node.prediction ?? '',
      falsifier: node.falsifier ?? '',
    }))
}

/** Write one JSON answer the carrier's way: status, headers, end. */
function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(payload))
}

/** Parse this request's query string, Node URL style with no dependencies. */
function queryOf(req) {
  const raw = String(req.url ?? '')
  const at = raw.indexOf('?')
  if (at === -1) return new Map()
  return new Map(new URLSearchParams(raw.slice(at + 1)))
}

function registerRoute(ctx, config) {
  // The browser-trust fence the voice plugin's routes taught us about: an
  // untrusted request is answered with the carrier's own rejection status
  // before any store path is touched.
  const connection = ctx.get('connection')
  const rejected = (req, res) => {
    if (connection === undefined) return false
    const rejection = connection.requestRejection(req)
    if (rejection === undefined) return false
    res.statusCode = rejection
    res.end()
    return true
  }

  // Exact routes only: the carrier matches literal paths, and the node id
  // travels as a query parameter (`?id=...`) rather than a path segment,
  // because a `:param` route kind is not part of this contract.
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${ROUTE}/graph`,
    handler: async (req, res) => {
      if (rejected(req, res)) return
      if (req.method !== 'GET') {
        res.statusCode = 405
        res.setHeader('allow', 'GET')
        res.end()
        return
      }
      const name = queryOf(req).get('store') ?? ''
      const nodes = await loadNodes(ctx, config, name)
      if (!nodes) {
        sendJson(res, 404, { error: `no such store ${name}` })
        return
      }
      const where = config.pick(name)
      sendJson(res, 200, {
        store: where.store,
        name: name || 'research',
        stores: Object.keys(config.stores),
        nodes: board(nodes),
      })
    },
  }))

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${ROUTE}/node`,
    handler: async (req, res) => {
      if (rejected(req, res)) return
      if (req.method !== 'GET') {
        res.statusCode = 405
        res.setHeader('allow', 'GET')
        res.end()
        return
      }
      const id = queryOf(req).get('id') ?? ''
      const name = queryOf(req).get('store') ?? ''
      if (id === '') {
        sendJson(res, 400, { error: 'the id query parameter is required' })
        return
      }
      const where = config.pick(name)
      if (!where) {
        sendJson(res, 404, { error: `no such store ${name}` })
        return
      }
      // The page is generated by the library, so the view and the record
      // cannot disagree about what a node says.
      try {
        const page = await ctx.fs.resolve(`${where.pages}/${id}.md`)
        const markdown = await ctx.fs.readText(page)
        sendJson(res, 200, { id, markdown })
      } catch {
        sendJson(res, 404, { error: `no such node ${id}` })
      }
    },
  }))
}

function registerTool(ctx, config) {
  ctx.effect(() => ctx.tools.register({
    name: DAG_TOOL_NAME,
    description: describe(),
    parameters: DAG_PARAMETERS,
    execute: async (args) => {
      const nodes = await loadNodes(ctx, config, args.store)
      if (!nodes) {
        return { error: `no such store ${args.store}` }
      }
      if (args.operation === 'list') {
        return { operation: 'list', nodes: board(nodes) }
      }
      if (args.operation === 'frontier') {
        return { operation: 'frontier', nodes: frontier(nodes) }
      }
      if (args.operation === 'show') {
        const found = nodes.find((node) => node.id === args.id)
        if (!found) {
          return { operation: 'show', id: args.id, error: 'no such node' }
        }
        return { operation: 'show', node: found }
      }
      return { error: `unknown operation ${args.operation}` }
    },
  }))
}

export function apply(ctx, rawConfig = {}) {
  const config = rawConfig instanceof Config ? rawConfig : new Config(rawConfig)
  registerTool(ctx, config)
  // Deferred: the route exists only where a browser can reach it, and the
  // row does not wait for one.
  ctx.inject(['webServer'], (routeCtx) => registerRoute(routeCtx, config))
}
