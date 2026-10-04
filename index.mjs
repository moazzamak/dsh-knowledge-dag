/**
 * Host half of `dsh-knowledge-dag`: the `knowledge_dag` tool, plus the three
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
 * - A registered tool must declare `output: { schema, render }`. The
 *   registry rejects a definition without it AT BOOT, validates every
 *   execute() result against the schema at run time, and shows the model
 *   whatever `render` returns. The schema stays in the wire's supported
 *   subset (type/properties/items + annotations) and leaves node bodies
 *   open, because their fields are the store's to define.
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
 * on first call.
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

/** Node ids are file stems; anything else is a traversal attempt. */
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/i

/**
 * Where a store's nodes are and where its rendered pages are.
 *
 * `stores` holds further stores behind the same operations, so the model's
 * knowledge base is read the way the research record is rather than
 * through a second tool. The default store stays what it was, so a profile
 * that configures nothing behaves as before.
 *
 * `workspace` is the base a RELATIVE `store`/`pages` resolves against. The fs
 * backend resolves a relative path from the host process's working directory
 * (`Context.cwd` in `dsh-fs-local`, defaulting to `process.cwd()`), which is
 * the workspace only for a CLI launched from it: the Desktop application
 * starts its host in the profile directory, so every relative store there
 * answered `not found`. Naming the workspace makes the paths mean the same
 * thing in both surfaces. Absolute `store`/`pages` values ignore it, and an
 * empty `workspace` keeps the old process-directory behaviour.
 */
export class StoreConfig {
  constructor(options = {}) {
    this.store = options.store ?? 'analysis/graph/nodes'
    this.pages = options.pages ?? 'analysis/nodes'
    this.workspace = options.workspace ?? ''
    this.stores = options.stores ?? {}
  }

  /**
   * The fs base directory for relative paths, if one is configured.
   * @returns `{ cwd }` for `ctx.fs.resolve`, or an empty object.
   */
  base() {
    return this.workspace === '' ? {} : { cwd: this.workspace }
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

/**
 * The row-config schema, in the Standard Schema protocol Cordis drives.
 *
 * Cordis `resolveConfig` calls `Config['~standard'].validate(config)`
 * UNCONDITIONALLY whenever a plugin exports a `Config` — a class here reads
 * as a schema, `Config['~standard']` is undefined, and `.validate` throws a
 * TypeError that fails the whole fiber at boot: the row shows `failed`, no
 * route registers, and the browser gets 404s that look like a missing graph.
 * The runtime paths live in {@link StoreConfig}; this is only the schema.
 */
export const Config = {
  '~standard': {
    version: 1,
    vendor: 'dsh-knowledge-dag',
    /**
     * Validate and default one raw row config.
     * @param {unknown} value - the row's `config` value.
     * @returns `{ value }` when valid, `{ issues }` otherwise.
     */
    validate(value) {
      if (value !== undefined && (typeof value !== 'object' || value === null || Array.isArray(value))) {
        return { issues: [{ message: 'knowledge-dag config must be an object' }] }
      }
      const input = value ?? {}
      const issues = []
      const text = (key, fallback) => {
        const raw = input[key]
        if (raw === undefined) return fallback
        if (typeof raw !== 'string' || raw === '') {
          issues.push({ message: `${key} must be a non-empty string` })
          return fallback
        }
        return raw
      }
      const store = text('store', 'analysis/graph/nodes')
      const pages = text('pages', 'analysis/nodes')
      // Optional: the base directory a relative store resolves against. An
      // absent value is legal (the fs backend's own process-directory
      // default), so it is only rejected when present and not a string.
      const workspace = text('workspace', '')
      const rawStores = input.stores
      let stores = {}
      if (rawStores !== undefined) {
        if (typeof rawStores !== 'object' || rawStores === null || Array.isArray(rawStores)) {
          issues.push({ message: 'stores must be an object mapping a name to { store, pages }' })
        } else {
          for (const [name, entry] of Object.entries(rawStores)) {
            if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
              issues.push({ message: `stores.${name} must be an object with store and pages` })
              continue
            }
            stores[name] = {
              store: typeof entry.store === 'string' && entry.store !== '' ? entry.store : store,
              pages: typeof entry.pages === 'string' && entry.pages !== '' ? entry.pages : pages,
            }
          }
        }
      }
      if (issues.length > 0) return { issues }
      return { value: { ...input, store, pages, workspace, stores } }
    },
  },
}

export const DAG_PARAMETERS = {
  type: 'object',
  properties: {
    operation: {
      type: 'string',
      enum: ['list', 'show', 'frontier', 'analogs'],
      description:
        'list every node with its kind, track, status and verdict; show one ' +
        'node by id; frontier lists what is open or running, with the ' +
        'prediction and the falsifier for each; analogs finds nodes whose ' +
        'STRUCTURE matches one node (same relational shape: prediction, ' +
        'falsifier, decision menu, measured numbers, lineage) while their ' +
        'surface (track, topic) differs — Gentner structure-mapping: good ' +
        'analogies transfer relations, not topics',
    },
    id: {
      type: 'string',
      description: 'the node id, required for the show and analogs operations',
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

/**
 * The answer schema, in the registry's supported JSON-Schema subset. It is
 * deliberately open — no `required`, no `additionalProperties: false` —
 * because the four operations answer with different shapes and the node
 * bodies are the store's to define. Every execute() result is validated
 * against it at run time.
 */
export const DAG_OUTPUT = {
  type: 'object',
  description: 'one knowledge_dag answer: a board, a frontier, analogs, one node, or an error',
  properties: {
    operation: { type: 'string', description: 'the operation that produced this answer' },
    id: { type: 'string', description: 'the node id the operation targeted' },
    nodes: {
      type: 'array',
      items: { type: 'object' },
    },
    node: { type: 'object', description: 'the full node body, for the show operation' },
    analogs: {
      type: 'array',
      items: { type: 'object' },
    },
    error: { type: 'string', description: 'why the operation could not answer' },
  },
}

/**
 * Render one answer as the text blocks the transcript shows. The registry
 * calls this on every successful execute(): the value is what machines
 * read, and this is what the model reads, so an answer that does not
 * render is a tool that does not work.
 */
function renderAnswer(_args, value) {
  const line = (node) => {
    const verdict = node.verdict ? `, ${node.verdict}` : ''
    return `- ${node.id ?? '?'} [${node.kind ?? '?'}] ` +
      `(${node.track ?? '?'}${verdict}, ${node.status ?? '?'}): ${node.title ?? ''}`
  }
  const lines = []
  if (typeof value.error === 'string' && value.error !== '') {
    lines.push(`knowledge_dag could not answer: ${value.error}`)
  } else if (value.operation === 'list') {
    const nodes = value.nodes ?? []
    lines.push(`Knowledge DAG board — ${nodes.length} node${nodes.length === 1 ? '' : 's'}`)
    for (const node of nodes) lines.push(line(node))
  } else if (value.operation === 'frontier') {
    const nodes = value.nodes ?? []
    lines.push(`Knowledge DAG frontier — ${nodes.length} open or running`)
    for (const node of nodes) {
      lines.push(line(node))
      if (node.question) lines.push(`    question: ${node.question}`)
      if (node.prediction) lines.push(`    prediction: ${node.prediction}`)
      if (node.falsifier) lines.push(`    falsifier: ${node.falsifier}`)
    }
  } else if (value.operation === 'analogs') {
    const analogs = value.analogs ?? []
    lines.push(`Structural analogs of ${value.id ?? '?'} — ${analogs.length} found`)
    analogs.forEach((analog, index) => {
      lines.push(`${index + 1}. ${analog.id ?? '?'} (score ${analog.score ?? '?'}) ` +
        `[${analog.kind ?? '?'}, ${analog.status ?? '?'}] ${analog.title ?? ''}`)
      const shared = analog.sharedStructure
      if (Array.isArray(shared) && shared.length > 0) {
        lines.push(`   shared structure: ${shared.join(', ')}`)
      }
    })
  } else if (value.operation === 'show') {
    lines.push(`Node ${value.id ?? value.node?.id ?? '?'}`)
    lines.push('```json')
    lines.push(JSON.stringify(value.node, null, 2))
    lines.push('```')
  } else {
    lines.push(JSON.stringify(value, null, 2))
  }
  return [{ type: 'text', text: lines.join('\n') }]
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
async function jsonEntries(ctx, config, dir) {
  const resolved = await ctx.fs.resolve(dir, config.base())
  const entries = await ctx.fs.listDir(resolved)
  const names = []
  for (const entry of entries) {
    const value = typeof entry === 'string' ? entry : String(entry?.name ?? '')
    if (value.endsWith('.json')) names.push(value)
  }
  return names
}

async function readJson(ctx, config, path) {
  const resolved = await ctx.fs.resolve(path, config.base())
  return JSON.parse(await ctx.fs.readText(resolved))
}

async function loadNodes(ctx, config, name) {
  const where = config.pick(name)
  if (!where) return null
  const names = await jsonEntries(ctx, config, where.store)
  const nodes = []
  for (const file of names) {
    const node = await readJson(ctx, config, `${where.store}/${file}`)
    // The store's files are named `<id>.json` and the node bodies carry no
    // `id` field of their own — the file stem IS the id, and the pages are
    // named after it too. Without this, every board entry would answer
    // `undefined` and no page could ever be opened.
    nodes.push({ id: file.slice(0, -'.json'.length), ...node })
  }
  return nodes.sort((left, right) => String(left.id ?? '')
    .localeCompare(String(right.id ?? '')))
}

/** One node file by id, without loading the whole store. */
async function loadNode(ctx, config, name, id) {
  const where = config.pick(name)
  if (!where) return { noStore: true }
  const node = await readJson(ctx, config, `${where.store}/${id}.json`)
  return { node: { id, ...node } }
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
      status: node.status,
      track: node.track,
      question: node.question ?? '',
      prediction: node.prediction ?? '',
      falsifier: node.falsifier ?? '',
      measurement: node.measurement ?? '',
      costTier: node.cost_tier ?? '',
      decisionMenu: node.decision_menu ?? {},
      lineage: node.lineage ?? [],
    }))
}

/**
 * The whole record as a graph: the board's fields plus the lineage EDGES a
 * node-link view draws. `board` stays the compact projection the `list`
 * operation answers with; this is what `/graph` serves, so the pane can draw
 * one picture from one fetch.
 *
 * `lineage` is the node's parents — the things it derives from — which is the
 * direction the arrows run. A parent that is not in the store is dropped
 * rather than drawn as a stub: the view shows the record it read, and a
 * dangling id has no box to point at.
 */
function dag(nodes) {
  const known = new Set(nodes.map((node) => node.id))
  return nodes.map((node) => ({
    id: node.id,
    kind: node.kind,
    track: node.track,
    status: node.status,
    verdict: (node.outcome ?? {}).verdict ?? '',
    title: oneLine(node),
    lineage: (Array.isArray(node.lineage) ? node.lineage : [])
      .filter((parent) => parent !== node.id && known.has(parent)),
  }))
}

// ---------------------------------------------------------------------------
// Structural analogs — Gentner structure-mapping over the node store.
//
// "Good analogies transfer RELATIONAL structure, not surface topic." So a
// node's SIGNATURE here is built from its relational shape only:
//
//   - its role and fate in the record (kind, status, verdict)
//   - the shape of its registered uncertainty: whether it carries a
//     prediction, a falsifier, a measurement plan, a cost tier, and the
//     interrogative FORM of its question (whether / what / how / why) —
//     the type of the unknown, never its words
//   - the shape of its decision space (menu option count)
//   - the shape of its evidence (story beats present, outcome numbers)
//   - its lineage topology (in-degree, ancestry depth, whether its parents
//     come from another track)
//
// Its SURFACE — the track it lives on and the words of its title — is
// deliberately excluded from the signature and used only to PENALISE
// surface-similar pairs, because a match that is merely topical is not an
// analogy. This is the registered route (a) (structure, CPU-instant);
// embedding proximity (b) and teacher-proposed bridges (c) can re-rank it.
// The measured LEVEL is named, per the M3 caveat: node-record structure.
// ---------------------------------------------------------------------------

/** Bucket a count into a small ordinal, so magnitude does not dominate. */
function bucket(count) {
  if (count <= 0) return '0'
  if (count === 1) return '1'
  if (count === 2) return '2'
  if (count <= 5) return 'few'
  return 'many'
}

/** The interrogative form of the question — the type of the unknown. */
function questionForm(node) {
  const question = String(node.question ?? node.title ?? '').toLowerCase()
  if (question.startsWith('whether')) return 'whether'
  if (/^(does|do|is|are|can|will|would|has|have)\b/.test(question)) return 'whether'
  if (/^(what|which|who)\b/.test(question)) return 'what'
  if (/^how\b/.test(question)) return 'how'
  if (/^why\b/.test(question)) return 'why'
  return 'other'
}

/**
 * Build the structural signature token set for every node at once.
 *
 * Lineage needs the parent records, so signatures are computed over the
 * whole store in one pass and returned as a Map keyed by node id.
 */
function structuralSignatures(nodes) {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const depthCache = new Map()

  /** Ancestry depth, cycle-safe: the longest acyclic parent chain. */
  const depth = (id, seen = new Set()) => {
    if (depthCache.has(id)) return depthCache.get(id)
    if (seen.has(id)) return 0
    seen.add(id)
    const node = byId.get(id)
    let value = 0
    if (node !== undefined) {
      let best = 0
      for (const parent of node.lineage ?? []) {
        best = Math.max(best, depth(parent, seen))
      }
      value = best + 1
    }
    seen.delete(id)
    depthCache.set(id, value)
    return value
  }

  const signatures = new Map()
  for (const node of nodes) {
    const tokens = new Set()
    tokens.add(`kind:${node.kind ?? '?'}`)
    tokens.add(`status:${node.status ?? '?'}`)
    const verdict = (node.outcome ?? {}).verdict
    if (verdict) tokens.add(`verdict:${verdict}`)
    tokens.add(`form:${questionForm(node)}`)
    if (node.prediction) tokens.add('predicts')
    if (node.falsifier) tokens.add('falsifiable')
    if (node.measurement) tokens.add('measured-plan')
    if (node.cost_tier) tokens.add(`cost:${node.cost_tier}`)
    tokens.add(`menu:${bucket(Object.keys(node.decision_menu ?? {}).length)}`)
    const numbers = Object.keys((node.outcome ?? {}).numbers ?? {}).length
    tokens.add(`numbers:${bucket(numbers)}`)
    const story = node.story ?? {}
    tokens.add(`story:${bucket(['investigating', 'assumed', 'found', 'means']
      .filter((beat) => story[beat]).length)}`)
    if (node.displacement) tokens.add('displaces')
    tokens.add(`artifacts:${bucket((node.artifacts ?? []).length)}`)
    const parents = node.lineage ?? []
    tokens.add(`parents:${bucket(parents.length)}`)
    tokens.add(`depth:${bucket(depth(node.id))}`)
    if (parents.some((parent) => byId.get(parent)?.track !== node.track)) {
      tokens.add('cross-track-lineage')
    }
    if (parents.length > 0) tokens.add('derives')
    signatures.set(node.id, tokens)
  }
  return signatures
}

/** Dice coefficient over two token sets: 2|A∩B| / (|A|+|B|). */
function dice(a, b) {
  let shared = 0
  for (const token of a) if (b.has(token)) shared += 1
  return (2 * shared) / (a.size + b.size)
}

/** Title-word Jaccard, lower-cased, the surface term. */
function titleJaccard(a, b) {
  const words = (text) => new Set(String(text ?? '')
    .toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3))
  const left = words(a)
  const right = words(b)
  if (left.size === 0 || right.size === 0) return 0
  let shared = 0
  for (const word of left) if (right.has(word)) shared += 1
  return shared / (left.size + right.size - shared)
}

/**
 * Rank one node's structural analogs across the whole store.
 *
 * Score = structural similarity (Dice over signatures) MINUS a surface
 * penalty (same track, shared title words), so the pairs that surface are
 * structurally close AND topically distant — the creative-analog shape.
 * Lineage relatives are excluded: an ancestor is inheritance, not analogy.
 */
function findAnalogs(nodes, signatures, id, limit = 8) {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const self = byId.get(id)
  if (self === undefined) return null
  const family = new Set([id, ...(self.lineage ?? [])])
  for (const node of nodes) {
    if ((node.lineage ?? []).includes(id)) family.add(node.id)
  }
  const mine = signatures.get(id)
  const ranked = []
  for (const node of nodes) {
    if (family.has(node.id)) continue
    const theirs = signatures.get(node.id)
    const structural = dice(mine, theirs)
    if (structural < 0.5) continue
    const sameTrack = node.track === self.track ? 1 : 0
    const surface = sameTrack + titleJaccard(self.title, node.title)
    const score = structural - 0.5 * surface
    if (score <= 0) continue
    const shared = [...mine].filter((token) => theirs.has(token))
    ranked.push({
      id: node.id,
      title: oneLine(node),
      kind: node.kind,
      status: node.status,
      verdict: (node.outcome ?? {}).verdict ?? '',
      track: node.track,
      score: Math.round(score * 1000) / 1000,
      structural: Math.round(structural * 1000) / 1000,
      sharedStructure: shared,
      sameTrack: sameTrack === 1,
    })
  }
  return ranked.sort((a, b) => b.score - a.score).slice(0, limit)
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

/** The GET-only guard every route shares. */
function getOnly(req, res) {
  if (req.method === 'GET') return false
  res.statusCode = 405
  res.setHeader('allow', 'GET')
  res.end()
  return true
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

  // The whole board: every node, compact, for filters and counts.
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${ROUTE}/graph`,
    handler: async (req, res) => {
      if (rejected(req, res)) return
      if (getOnly(req, res)) return
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
        // With lineage: this one fetch feeds both the board list and the
        // node-link view, so it carries the edges as well as the rows.
        nodes: dag(nodes),
      })
    },
  }))

  // The frontier: what is open or running, with the prediction, the
  // falsifier and the decision menu for each — the board a researcher (or
  // a model) steers from.
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${ROUTE}/frontier`,
    handler: async (req, res) => {
      if (rejected(req, res)) return
      if (getOnly(req, res)) return
      const name = queryOf(req).get('store') ?? ''
      const nodes = await loadNodes(ctx, config, name)
      if (!nodes) {
        sendJson(res, 404, { error: `no such store ${name}` })
        return
      }
      sendJson(res, 200, {
        store: config.pick(name).store,
        name: name || 'research',
        nodes: frontier(nodes),
      })
    },
  }))

  // Structural analogs for one node: the Gentner route. One route answers
  // "which other node has this one's SHAPE on a different surface".
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${ROUTE}/analogs`,
    handler: async (req, res) => {
      if (rejected(req, res)) return
      if (getOnly(req, res)) return
      const query = queryOf(req)
      const id = query.get('id') ?? ''
      const name = query.get('store') ?? ''
      if (id === '') {
        sendJson(res, 400, { error: 'the id query parameter is required' })
        return
      }
      if (!ID_PATTERN.test(id)) {
        sendJson(res, 400, { error: 'malformed node id' })
        return
      }
      const nodes = await loadNodes(ctx, config, name)
      if (!nodes) {
        sendJson(res, 404, { error: `no such store ${name}` })
        return
      }
      const signatures = structuralSignatures(nodes)
      const analogs = findAnalogs(nodes, signatures, id)
      if (analogs === null) {
        sendJson(res, 404, { error: `no such node ${id}` })
        return
      }
      sendJson(res, 200, { id, store: name || 'research', analogs })
    },
  }))

  // One node: the full structured body (story, decision menu, outcome,
  // lineage, numbers) plus the library-generated markdown page, so the
  // view and the record cannot disagree about what a node says.
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${ROUTE}/node`,
    handler: async (req, res) => {
      if (rejected(req, res)) return
      if (getOnly(req, res)) return
      const query = queryOf(req)
      const id = query.get('id') ?? ''
      const name = query.get('store') ?? ''
      if (id === '') {
        sendJson(res, 400, { error: 'the id query parameter is required' })
        return
      }
      if (!ID_PATTERN.test(id)) {
        sendJson(res, 400, { error: 'malformed node id' })
        return
      }
      const where = config.pick(name)
      if (!where) {
        sendJson(res, 404, { error: `no such store ${name}` })
        return
      }
      let node
      try {
        node = (await loadNode(ctx, config, name, id)).node
      } catch {
        sendJson(res, 404, { error: `no such node ${id}` })
        return
      }
      let markdown = null
      try {
        const page = await ctx.fs.resolve(`${where.pages}/${id}.md`, config.base())
        markdown = await ctx.fs.readText(page)
      } catch {
        // A node without a page is still a node; the view degrades to the
        // structured body alone.
      }
      sendJson(res, 200, { id, node, markdown })
    },
  }))
}

function registerTool(ctx, config) {
  ctx.effect(() => ctx.tools.register({
    name: DAG_TOOL_NAME,
    description: describe(),
    parameters: DAG_PARAMETERS,
    output: {
      schema: DAG_OUTPUT,
      render: renderAnswer,
    },
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
      if (args.operation === 'analogs') {
        if (!args.id) return { error: 'the analogs operation requires an id' }
        const signatures = structuralSignatures(nodes)
        const analogs = findAnalogs(nodes, signatures, args.id)
        if (analogs === null) {
          return { operation: 'analogs', id: args.id, error: 'no such node' }
        }
        return { operation: 'analogs', id: args.id, analogs }
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
  // `rawConfig` arrives already validated and defaulted by the row schema
  // (a plain object); a StoreConfig is also accepted for direct callers.
  const config = rawConfig instanceof StoreConfig ? rawConfig : new StoreConfig(rawConfig)
  registerTool(ctx, config)
  // Deferred: the route exists only where a browser can reach it, and the
  // row does not wait for one.
  ctx.inject(['webServer'], (routeCtx) => registerRoute(routeCtx, config))
}
