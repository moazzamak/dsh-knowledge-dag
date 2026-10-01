/**
 * Host half of `dsh-knowledge-dag`: the `knowledge_dag` tool, plus the two
 * browser routes the client half reads.
 *
 * Three rules, each learned from the voice plugin in this same repository:
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
 * The invariants are NOT reimplemented here. Validation lives in
 * `tools/research_graph.py` and is enforced by the suite and by
 * `python -m tools.run.research check`; this half reads the store and the
 * rendered pages. A second checker in JavaScript would be free to disagree
 * with the one the build trusts.
 *
 * Plain JavaScript, no build step, so a direct install works.
 *
 * @module dsh-knowledge-dag
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

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

async function readJson(ctx, path) {
  const resolved = await ctx.fs.resolve(path)
  return JSON.parse(await readFile(resolved, 'utf8'))
}

async function loadNodes(ctx, config, name) {
  const where = config.pick(name)
  if (!where) return null
  const resolved = await ctx.fs.resolve(where.store)
  const entries = await ctx.fs.list(resolved)
  const nodes = []
  for (const entry of entries) {
    if (!String(entry).endsWith('.json')) continue
    nodes.push(await readJson(ctx, join(where.store, String(entry))))
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

function registerRoute(ctx, config) {
  ctx.effect(() => ctx.webServer.register({
    method: 'GET',
    path: `${ROUTE}/graph`,
    handler: async (request, response) => {
      const name = request.query?.store ? String(request.query.store) : ''
      const nodes = await loadNodes(ctx, config, name)
      if (!nodes) {
        response.status(404).json({ error: `no such store ${name}` })
        return
      }
      const where = config.pick(name)
      response.json({ store: where.store, name: name || 'research',
                      stores: Object.keys(config.stores),
                      nodes: board(nodes) })
    },
  }))
  ctx.effect(() => ctx.webServer.register({
    method: 'GET',
    path: `${ROUTE}/node/:id`,
    handler: async (request, response) => {
      const id = String(request.params?.id ?? '')
      // The page is generated by the library, so the view and the record
      // cannot disagree about what a node says.
      const name = request.query?.store ? String(request.query.store) : ''
      const where = config.pick(name)
      if (!where) {
        response.status(404).json({ error: `no such store ${name}` })
        return
      }
      const page = await ctx.fs.resolve(`${where.pages}/${id}.md`)
      response.json({ id, markdown: await readFile(page, 'utf8') })
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
