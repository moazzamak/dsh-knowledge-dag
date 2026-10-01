/**
 * Browser half of `dsh-knowledge-dag`, in the harness client-bundle format
 * (`window.__ModuleLoader__.load({ id, factory })`).
 *
 * A research-steering console, not just a viewer. The composer's tool row
 * gets one button; pressing it opens a full-height drawer with:
 *
 *   - the BOARD: every node with kind/track/status/verdict, filterable by
 *     status and track, searchable, with live counts;
 *   - the FRONTIER: what is open or running, each with its prediction,
 *     falsifier, measurement and DECISION MENU — the "which path do we
 *     take" view this tool exists for;
 *   - a node DETAIL page rendered from the structured record: the story
 *     (investigating / assumed / found / means), the registered prediction
 *     and falsifier, the decision menu with what each choice implies, the
 *     measured outcome with its numbers, and lineage links that jump to
 *     the nodes this one derives from;
 *   - a store picker, because the same four operations read any node
 *     store — the research record today, the trained model's knowledge map
 *     tomorrow.
 *
 * The node bodies and pages are fetched from the host half rather than
 * rebuilt here: the record already generates them, and a view that rendered
 * its own version would be free to disagree with the file a reader trusts.
 *
 * Wire-format rules, each one the voice plugin (`dsh-voice-input`) learned
 * the hard way, so this half follows them exactly:
 *
 * - The factory creates its OWN `var module = { exports: {} }`. There is no
 *   CommonJS wrapper around a factory, so referencing a bare `module`
 *   throws `ReferenceError` the moment the bundle is evaluated — which
 *   fails the client boot audit and takes the whole GUI down with it.
 * - The bundle exports `inject` and `apply`; the loader drives `apply(ctx)`.
 * - A slot name is NOT a service: `inject` declares only real services.
 *   `slots.inject(SLOT, ...)` is the mechanism that waits for the slot
 *   declaration. The drawer renders inside this bundle's own component
 *   tree, fixed-positioned so it escapes the tool row.
 * - React comes from `require('react')` — the shared module table.
 *
 * @module dsh-knowledge-dag/client
 */
window.__ModuleLoader__.load({
  id: 'dsh-knowledge-dag',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')

    /** Host routes; must match index.mjs (the node id travels as a query). */
    const ROUTE = '/dsh-knowledge-dag'
    const SLOT = 'conversation.input.left'
    const ENTRY_ID = 'knowledge-dag-graph'

    const CLASS = {
      root: 'dsh-dag-root',
      button: 'dsh-dag-button',
      drawer: 'dsh-dag-drawer',
      head: 'dsh-dag-head',
      tabs: 'dsh-dag-tabs',
      tab: 'dsh-dag-tab',
      close: 'dsh-dag-close',
      controls: 'dsh-dag-controls',
      search: 'dsh-dag-search',
      select: 'dsh-dag-stores',
      counts: 'dsh-dag-counts',
      list: 'dsh-dag-list',
      card: 'dsh-dag-card',
      cardTitle: 'dsh-dag-card-title',
      cardMeta: 'dsh-dag-card-meta',
      prediction: 'dsh-dag-prediction',
      detail: 'dsh-dag-detail',
      badges: 'dsh-dag-badges',
      badge: 'dsh-dag-badge',
      section: 'dsh-dag-section',
      sectionTitle: 'dsh-dag-section-title',
      menu: 'dsh-dag-menu',
      menuOption: 'dsh-dag-menu-option',
      menuArrow: 'dsh-dag-menu-arrow',
      numbers: 'dsh-dag-numbers',
      lineage: 'dsh-dag-lineage',
      chip: 'dsh-dag-chip',
      note: 'dsh-dag-note',
      page: 'dsh-dag-page',
      story: 'dsh-dag-story',
      back: 'dsh-dag-back',
    }

    /** Status/verdict → tone, so the board can be read at a glance. */
    const TONES = {
      open: 'warn', running: 'info',
      adopted: 'good', confirmed: 'good', supported: 'good',
      rejected: 'bad', falsified: 'bad', withdrawn: 'bad',
    }
    const toneOf = (value) => TONES[String(value ?? '').toLowerCase()] ?? 'neutral'

    const CSS = `
.${CLASS.root} { display: inline-flex; }
.${CLASS.button} {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; padding: 0; border: 0; border-radius: 50%;
  background: transparent; color: inherit; opacity: 0.75; cursor: pointer;
  font-size: 11px;
}
.${CLASS.button}:hover { opacity: 1; background: color-mix(in srgb, currentColor 12%, transparent); }
.${CLASS.button}[data-state='open'] { opacity: 1; }
.${CLASS.drawer} {
  position: fixed; top: 8px; right: 8px; bottom: 8px; z-index: 60;
  width: min(920px, 96vw); display: flex; flex-direction: column;
  border-radius: 10px; font-size: 13px;
  background: var(--dsh-surface, #1c1c1f); color: inherit;
  border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
  box-shadow: 0 12px 44px rgba(0, 0, 0, 0.45);
}
.${CLASS.head} {
  display: flex; align-items: center; gap: 10px; flex: none;
  padding: 8px 12px;
  border-bottom: 1px solid color-mix(in srgb, currentColor 15%, transparent);
}
.${CLASS.tabs} { display: inline-flex; gap: 4px; }
.${CLASS.tab} {
  padding: 3px 10px; border: 1px solid transparent; border-radius: 6px;
  background: transparent; color: inherit; opacity: 0.65; cursor: pointer;
  font-size: 12px;
}
.${CLASS.tab}[data-active='true'] {
  opacity: 1; border-color: color-mix(in srgb, currentColor 30%, transparent);
  background: color-mix(in srgb, currentColor 10%, transparent);
}
.${CLASS.close} {
  margin-left: auto; padding: 2px 8px; border: 0; border-radius: 6px;
  background: transparent; color: inherit; opacity: 0.6; cursor: pointer;
  font-size: 15px;
}
.${CLASS.close}:hover { opacity: 1; }
.${CLASS.controls} {
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px; flex: none;
  padding: 6px 12px;
  border-bottom: 1px solid color-mix(in srgb, currentColor 12%, transparent);
}
.${CLASS.search} {
  flex: 1 1 220px; min-width: 160px; padding: 4px 8px; font-size: 12px;
  border-radius: 6px; color: inherit;
  background: color-mix(in srgb, currentColor 6%, transparent);
  border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
}
.${CLASS.select} {
  padding: 4px 6px; font-size: 12px; border-radius: 6px; color: inherit;
  background: transparent;
  border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
}
.${CLASS.counts} { font-size: 11px; opacity: 0.65; white-space: nowrap; }
.${CLASS.list} { flex: 1; overflow: auto; padding: 8px 12px; display: flex; flex-direction: column; gap: 6px; }
.${CLASS.card} {
  display: flex; flex-direction: column; gap: 3px; padding: 7px 9px;
  border-radius: 8px; cursor: pointer; text-align: left;
  border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
}
.${CLASS.card}:hover { background: color-mix(in srgb, currentColor 8%, transparent); }
.${CLASS.cardTitle} { font-weight: 550; }
.${CLASS.cardMeta} { font-size: 11px; opacity: 0.65; }
.${CLASS.prediction} { font-size: 12px; opacity: 0.8; }
.${CLASS.detail} { flex: 1; overflow: auto; padding: 10px 16px 20px; display: flex; flex-direction: column; gap: 12px; }
.${CLASS.badges} { display: flex; flex-wrap: wrap; gap: 5px; }
.${CLASS.badge} {
  padding: 1px 8px; border-radius: 999px; font-size: 11px;
  border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
}
.${CLASS.badge}[data-tone='good'] { color: #46a758; border-color: #46a75855; }
.${CLASS.badge}[data-tone='bad'] { color: #e5484d; border-color: #e5484d55; }
.${CLASS.badge}[data-tone='warn'] { color: #e5a34d; border-color: #e5a34d55; }
.${CLASS.badge}[data-tone='info'] { color: #6ca0ff; border-color: #6ca0ff55; }
.${CLASS.section} { display: flex; flex-direction: column; gap: 4px; }
.${CLASS.sectionTitle} {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em;
  opacity: 0.55;
}
.${CLASS.menu} { display: flex; flex-direction: column; gap: 6px; }
.${CLASS.menuOption} {
  display: flex; flex-direction: column; gap: 1px; padding: 6px 9px;
  border-radius: 7px; font-size: 12.5px;
  border: 1px dashed color-mix(in srgb, currentColor 25%, transparent);
}
.${CLASS.menuArrow} { opacity: 0.7; font-size: 12px; }
.${CLASS.numbers} {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 4px; font-size: 12px;
}
.${CLASS.numbers} div { display: flex; gap: 6px; }
.${CLASS.numbers} span { opacity: 0.6; }
.${CLASS.lineage} { display: flex; flex-wrap: wrap; gap: 5px; }
.${CLASS.chip} {
  padding: 1px 8px; border-radius: 999px; font-size: 11.5px; cursor: pointer;
  color: inherit; background: transparent;
  border: 1px solid color-mix(in srgb, currentColor 35%, transparent);
}
.${CLASS.chip}:hover { background: color-mix(in srgb, currentColor 12%, transparent); }
.${CLASS.note} { opacity: 0.75; padding: 8px 12px; }
.${CLASS.page} { white-space: pre-wrap; line-height: 1.5; font-size: 12.5px; opacity: 0.9; }
.${CLASS.story} { display: flex; flex-direction: column; gap: 8px; }
.${CLASS.back} {
  align-self: flex-start; padding: 3px 10px; font-size: 12px;
  border-radius: 6px; cursor: pointer; color: inherit; background: transparent;
  border: 1px solid color-mix(in srgb, currentColor 30%, transparent);
}
.${CLASS.back}:hover { background: color-mix(in srgb, currentColor 10%, transparent); }
`

    /** Install this bundle's stylesheet once per page. */
    function insertStyles() {
      const tag = document.createElement('style')
      tag.dataset.dshKnowledgeDag = 'true'
      tag.textContent = CSS
      document.head.append(tag)
      return () => { tag.remove() }
    }

    async function getJson(path, store) {
      const params = new URLSearchParams()
      if (store) params.set('store', store)
      const query = params.toString()
      const suffix = query !== '' ? `${path}?${query}` : path
      const response = await fetch(`${ROUTE}${suffix}`)
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
      return response.json()
    }

    // --- small presentational helpers ---------------------------------------

    function Badge({ value, tone }) {
      if (value === undefined || value === null || value === '') return null
      return React.createElement('span',
        { className: CLASS.badge, 'data-tone': tone ?? 'neutral' }, String(value))
    }

    function Section({ title, children }) {
      return React.createElement('div', { className: CLASS.section },
        React.createElement('div', { className: CLASS.sectionTitle }, title),
        children)
    }

    /** A board/frontier card. `rich` adds the prediction line. */
    function Card({ node, rich, onOpen }) {
      return React.createElement('div', {
        className: CLASS.card,
        onClick: () => onOpen(node.id),
      },
        React.createElement('div', { className: CLASS.cardTitle },
          node.title || node.id),
        rich && node.prediction
          ? React.createElement('div', { className: CLASS.prediction },
              `if true: ${node.prediction}`)
          : null,
        React.createElement('div', { className: CLASS.cardMeta },
          [node.id, node.kind, node.track, node.status, node.verdict]
            .filter(Boolean).join(' · ')),
      )
    }

    /** Counts by status, computed from the board so the header stays live. */
    function countsLine(nodes) {
      const counts = new Map()
      for (const node of nodes) {
        const key = String(node.status ?? '?')
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
      const order = ['open', 'running', 'adopted', 'rejected']
      const known = order.filter((key) => counts.has(key))
        .map((key) => `${counts.get(key)} ${key}`)
      const other = [...counts.entries()]
        .filter(([key]) => !order.includes(key))
        .map(([key, n]) => `${n} ${key}`)
      return `${nodes.length} nodes · ${[...known, ...other].join(' · ')}`
    }

    // --- the node detail page -------------------------------------------------

    /**
     * One node, rendered from the structured record. Every section the
     * steering decision needs is its own block: the story, the registered
     * prediction and falsifier, the decision menu with what each choice
     * implies, the measured outcome, and lineage links.
     */
    function NodeDetail({ id, store, titles, onOpen, onBack }) {
      const [state, setState] = React.useState({ loading: true })

      React.useEffect(() => {
        let alive = true
        setState({ loading: true })
        getJson(`/node?id=${encodeURIComponent(id)}`, store)
          .then((answer) => { if (alive) setState({ answer }) })
          .catch((error) => { if (alive) setState({ error: String(error.message ?? error) }) })
        return () => { alive = false }
      }, [id, store])

      if (state.loading) {
        return React.createElement('div', { className: CLASS.note }, 'loading…')
      }
      if (state.error) {
        return React.createElement('div', { className: CLASS.note }, state.error)
      }

      const { node, markdown } = state.answer
      const outcome = node.outcome ?? {}
      const story = node.story ?? {}
      const menu = node.decision_menu ?? {}
      const lineage = node.lineage ?? []
      const numbers = outcome.numbers ?? {}

      return React.createElement('div', { className: CLASS.detail },
        React.createElement('button', { className: CLASS.back, onClick: onBack }, '← back'),
        React.createElement('div', { className: CLASS.section },
          React.createElement('h2', { style: { margin: 0, fontSize: 16 } },
            node.title ?? id),
          React.createElement('div', { className: CLASS.badges },
            React.createElement(Badge, { value: node.kind }),
            React.createElement(Badge, { value: node.track }),
            React.createElement(Badge, { value: node.status, tone: toneOf(node.status) }),
            React.createElement(Badge, { value: outcome.verdict, tone: toneOf(outcome.verdict) }),
            React.createElement(Badge, { value: node.cost_tier }),
          ),
        ),
        node.question
          ? Section({ title: 'Question' },
              React.createElement('div', null, node.question))
          : null,
        lineage.length > 0
          ? Section({ title: 'Derives from' },
              React.createElement('div', { className: CLASS.lineage },
                lineage.map((parent) => React.createElement('button', {
                  key: parent,
                  className: CLASS.chip,
                  title: parent,
                  onClick: () => onOpen(parent),
                }, titles.get(parent) ?? parent))))
          : null,
        story.investigating || story.assumed || story.found || story.means
          ? Section({ title: 'The story so far' },
              React.createElement('div', { className: CLASS.story },
                story.investigating
                  ? React.createElement('div', null,
                      React.createElement('b', null, 'Investigating. '), story.investigating)
                  : null,
                story.assumed
                  ? React.createElement('div', null,
                      React.createElement('b', null, 'Assumed. '), story.assumed)
                  : null,
                story.found
                  ? React.createElement('div', null,
                      React.createElement('b', null, 'Found. '), story.found)
                  : null,
                story.means
                  ? React.createElement('div', null,
                      React.createElement('b', null, 'What it means. '), story.means)
                  : null))
          : null,
        node.prediction
          ? Section({ title: 'Registered prediction' },
              React.createElement('div', null, node.prediction))
          : null,
        node.falsifier
          ? Section({ title: 'Falsifier' },
              React.createElement('div', null, node.falsifier))
          : null,
        node.measurement
          ? Section({ title: 'How it is measured' },
              React.createElement('div', null, node.measurement))
          : null,
        Object.keys(menu).length > 0
          ? Section({ title: 'Decision menu — what each path implies' },
              React.createElement('div', { className: CLASS.menu },
                Object.entries(menu).map(([option, consequence]) =>
                  React.createElement('div', { key: option, className: CLASS.menuOption },
                    React.createElement('b', null, option),
                    React.createElement('div', { className: CLASS.menuArrow }, `→ ${consequence}`)))))
          : null,
        outcome.verdict || outcome.decision || outcome.reason
          ? Section({ title: 'Measured outcome' },
              React.createElement('div', { className: CLASS.story },
                outcome.verdict
                  ? React.createElement('div', null,
                      React.createElement('b', null, 'Verdict: '),
                      React.createElement(Badge, { value: outcome.verdict, tone: toneOf(outcome.verdict) }))
                  : null,
                outcome.decision
                  ? React.createElement('div', null,
                      React.createElement('b', null, 'Decision. '), outcome.decision)
                  : null,
                outcome.reason
                  ? React.createElement('div', null,
                      React.createElement('b', null, 'Why. '), outcome.reason)
                  : null,
                Object.keys(numbers).length > 0
                  ? React.createElement('div', { className: CLASS.numbers },
                      Object.entries(numbers).map(([key, value]) =>
                        React.createElement('div', { key },
                          React.createElement('span', null, key),
                          String(value))))
                  : null))
          : null,
        node.displacement
          ? Section({ title: 'What it replaces' },
              React.createElement('div', null, node.displacement))
          : null,
        (node.artifacts ?? []).length > 0
          ? Section({ title: 'Artifacts' },
              React.createElement('div', { className: CLASS.page },
                node.artifacts.join('\n')))
          : null,
        markdown
          ? Section({ title: 'Record page' },
              React.createElement('div', { className: CLASS.page }, markdown))
          : null,
      )
    }

    // --- the drawer: board, frontier, filters ---------------------------------

    /**
     * The steering console. Board and frontier are two tabs over the same
     * store; a card opens its node page in place.
     */
    function Drawer({ onClose }) {
      const [store, setStore] = React.useState('')
      const [tab, setTab] = React.useState('board')
      const [query, setQuery] = React.useState('')
      const [status, setStatus] = React.useState('')
      const [track, setTrack] = React.useState('')
      const [data, setData] = React.useState({ loading: true })
      const [selected, setSelected] = React.useState(null)

      React.useEffect(() => {
        let alive = true
        setData({ loading: true })
        Promise.all([getJson('/graph', store), getJson('/frontier', store)])
          .then(([graph, frontier]) => { if (alive) setData({ graph, frontier }) })
          .catch((error) => { if (alive) setData({ error: String(error.message ?? error) }) })
        return () => { alive = false }
      }, [store])

      const nodes = data.graph?.nodes ?? []
      const frontier = data.frontier?.nodes ?? []
      const names = data.graph?.stores ?? []
      const tracks = [...new Set(nodes.map((n) => n.track).filter(Boolean))].sort()
      const statuses = [...new Set(nodes.map((n) => n.status).filter(Boolean))].sort()
      const titles = new Map(nodes.map((n) => [n.id, n.title || n.id]))

      const matches = (node) => {
        if (status !== '' && node.status !== status) return false
        if (track !== '' && node.track !== track) return false
        if (query !== '') {
          const needle = query.toLowerCase()
          const hay = `${node.id} ${node.title ?? ''}`.toLowerCase()
          if (!hay.includes(needle)) return false
        }
        return true
      }
      const boardList = nodes.filter(matches)
      const frontierList = frontier.filter((node) => {
        if (track !== '' && node.track !== track) return false
        if (query !== '') {
          const needle = query.toLowerCase()
          const hay = `${node.id} ${node.title ?? ''} ${node.prediction ?? ''}`.toLowerCase()
          if (!hay.includes(needle)) return false
        }
        return true
      })

      const openNode = (id) => setSelected(id)

      return React.createElement('div', { className: CLASS.drawer },
        React.createElement('div', { className: CLASS.head },
          React.createElement('div', { className: CLASS.tabs },
            React.createElement('button', {
              className: CLASS.tab,
              'data-active': tab === 'board',
              onClick: () => { setTab('board'); setSelected(null) },
            }, 'Board'),
            React.createElement('button', {
              className: CLASS.tab,
              'data-active': tab === 'frontier',
              onClick: () => { setTab('frontier'); setSelected(null) },
            }, `Frontier (${frontier.length})`),
          ),
          React.createElement('div', { className: CLASS.counts },
            countsLine(nodes)),
          React.createElement('button', { className: CLASS.close, onClick: onClose }, '✕'),
        ),
        React.createElement('div', { className: CLASS.controls },
          React.createElement('input', {
            className: CLASS.search,
            placeholder: 'search nodes…',
            value: query,
            onChange: (event) => setQuery(event.target.value),
          }),
          React.createElement('select', {
            className: CLASS.select,
            value: status,
            onChange: (event) => setStatus(event.target.value),
          },
            React.createElement('option', { value: '' }, 'any status'),
            statuses.map((s) => React.createElement('option', { key: s, value: s }, s))),
          React.createElement('select', {
            className: CLASS.select,
            value: track,
            onChange: (event) => setTrack(event.target.value),
          },
            React.createElement('option', { value: '' }, 'any track'),
            tracks.map((t) => React.createElement('option', { key: t, value: t }, t))),
          names.length > 0
            ? React.createElement('select', {
                className: CLASS.select,
                value: store,
                onChange: (event) => { setStore(event.target.value); setSelected(null) },
              },
                React.createElement('option', { value: '' }, 'research'),
                names.map((n) => React.createElement('option', { key: n, value: n }, n)))
            : null,
          tab === 'board' && (status !== '' || track !== '' || query !== '')
            ? React.createElement('button', {
                className: CLASS.tab,
                onClick: () => { setStatus(''); setTrack(''); setQuery('') },
              }, 'clear')
            : null,
        ),
        data.loading
          ? React.createElement('div', { className: CLASS.note }, 'loading…')
          : data.error
            ? React.createElement('div', { className: CLASS.note },
                `the graph is unavailable: ${data.error}. The host half serves ${ROUTE}/graph.`)
            : selected !== null
              ? NodeDetail({
                  id: selected, store, titles,
                  onOpen: openNode,
                  onBack: () => setSelected(null),
                })
              : React.createElement('div', { className: CLASS.list },
                  tab === 'board'
                    ? (boardList.length === 0
                        ? React.createElement('div', { className: CLASS.note }, 'no nodes match')
                        : boardList.map((node) => React.createElement(Card, {
                            key: node.id, node, onOpen: openNode })))
                    : (frontierList.length === 0
                        ? React.createElement('div', { className: CLASS.note },
                            'nothing is open or running — the frontier is clear')
                        : frontierList.map((node) => React.createElement(Card, {
                            key: node.id, node, rich: true, onOpen: openNode })))),
      )
    }

    /** The tool-row control: a graph button that toggles the drawer. */
    function KnowledgeDagButton() {
      const [open, setOpen] = React.useState(false)

      return React.createElement(React.Fragment, null,
        React.createElement('div', { className: CLASS.root },
          React.createElement('button', {
            className: CLASS.button,
            type: 'button',
            title: 'Research graph — board, open frontier, and node pages',
            'data-state': open ? 'open' : 'closed',
            onClick: () => setOpen(!open),
          }, 'graph'),
        ),
        open ? React.createElement(Drawer, { onClose: () => setOpen(false) }) : null,
      )
    }

    /** The only declared dependency: the slot registry. */
    const inject = ['slots']

    /** Register the graph button for the life of this plugin fiber. */
    function apply(ctx) {
      const removeStyles = insertStyles()
      ctx.effect(() => removeStyles, 'knowledge-dag styles')
      const slots = ctx.slots
      slots.inject(SLOT, () => slots.register(
        { name: SLOT, id: ENTRY_ID, order: 60, label: 'Knowledge graph' },
        () => React.createElement(KnowledgeDagButton),
      ))
    }

    module.exports.inject = inject
    module.exports.apply = apply
    return module.exports
  },
})
