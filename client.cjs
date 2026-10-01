/**
 * Browser half of `dsh-knowledge-dag`, in the harness client-bundle format
 * (`window.__ModuleLoader__.load({ id, factory })`).
 *
 * A research-steering console that lives in the RIGHT PANE, as a real tab
 * type beside Files / Terminal / Document — the same registration the
 * shipped tabs use (`sidebarRightTabs`), so it gets a strip chip, a title,
 * and the pane's own chrome. Two ways to open it:
 *
 *   - a graph icon pinned to the TOP-RIGHT of the frame (a `shell.overlay`
 *     entry, above every column), which opens the tab in one click;
 *   - the pane's "+" guide menu lists "Knowledge graph".
 *
 * The panel itself: the BOARD (every node with kind/track/status/verdict,
 * filterable, with live counts), the FRONTIER (what is open or running,
 * each with its prediction, falsifier and decision menu — the steering
 * view), and a node DETAIL page (story beats, decision menu with what each
 * path implies, measured outcome with numbers, lineage links, and
 * structural analogs). A store picker covers the model-knowledge store
 * when one is configured.
 *
 * Node bodies and pages are fetched from the host half rather than rebuilt
 * here: the record already generates them, and a view that rendered its
 * own version would be free to disagree with the file a reader trusts.
 *
 * Wire-format rules, each one learned the hard way in this repository:
 *
 * - The factory creates its OWN `var module = { exports: {} }` (no CommonJS
 *   wrapper exists; a bare `module` reference kills the client boot).
 * - The bundle exports `inject` + `apply`; the loader drives `apply(ctx)`.
 * - Services must be DECLARED in `inject` before use: `sidebarRight` and
 *   `sidebarRightTabs` are the right pane's cross-plugin faces, `layout`
 *   opens the pane. A slot name is never a service.
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
    /** The right-pane tab kind this bundle owns. */
    const KIND = 'knowledge-dag'
    const TYPE_ID = 'dsh-knowledge-dag.graph'

    const CLASS = {
      trigger: 'dsh-dag-trigger',
      triggerButton: 'dsh-dag-trigger-button',
      panel: 'dsh-dag-panel',
      head: 'dsh-dag-head',
      tabs: 'dsh-dag-tabs',
      tab: 'dsh-dag-tab',
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
      analog: 'dsh-dag-analog',
      analogHead: 'dsh-dag-analog-head',
      analogScore: 'dsh-dag-analog-score',
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
.${CLASS.trigger} {
  position: fixed; top: 8px; right: 12px; z-index: 70;
  display: inline-flex; align-items: center; gap: 6px;
}
.${CLASS.triggerButton} {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; padding: 0; border-radius: 8px;
  background: color-mix(in srgb, currentColor 8%, transparent);
  color: inherit; opacity: 0.75; cursor: pointer;
  border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
}
.${CLASS.triggerButton}:hover { opacity: 1; background: color-mix(in srgb, currentColor 15%, transparent); }
.${CLASS.triggerButton} svg { width: 17px; height: 17px; }
.${CLASS.panel} {
  display: flex; flex-direction: column; height: 100%; min-height: 0;
  font-size: 13px; color: inherit;
}
.${CLASS.head} {
  display: flex; align-items: center; gap: 10px; flex: none;
  padding: 6px 10px;
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
.${CLASS.counts} { margin-left: auto; font-size: 11px; opacity: 0.65; white-space: nowrap; }
.${CLASS.controls} {
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px; flex: none;
  padding: 6px 10px;
  border-bottom: 1px solid color-mix(in srgb, currentColor 12%, transparent);
}
.${CLASS.search} {
  flex: 1 1 160px; min-width: 120px; padding: 4px 8px; font-size: 12px;
  border-radius: 6px; color: inherit;
  background: color-mix(in srgb, currentColor 6%, transparent);
  border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
}
.${CLASS.select} {
  padding: 4px 6px; font-size: 12px; border-radius: 6px; color: inherit;
  background: transparent; max-width: 40vw;
  border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
}
.${CLASS.list} { flex: 1; overflow: auto; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; }
.${CLASS.card} {
  display: flex; flex-direction: column; gap: 3px; padding: 7px 9px;
  border-radius: 8px; cursor: pointer; text-align: left;
  border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
}
.${CLASS.card}:hover { background: color-mix(in srgb, currentColor 8%, transparent); }
.${CLASS.cardTitle} { font-weight: 550; }
.${CLASS.cardMeta} { font-size: 11px; opacity: 0.65; }
.${CLASS.prediction} { font-size: 12px; opacity: 0.8; }
.${CLASS.detail} { flex: 1; overflow: auto; padding: 10px 14px 20px; display: flex; flex-direction: column; gap: 12px; }
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
  display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
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
.${CLASS.analog} {
  display: flex; flex-direction: column; gap: 4px; padding: 7px 9px;
  border-radius: 8px; cursor: pointer; text-align: left;
  border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
}
.${CLASS.analog}:hover { background: color-mix(in srgb, currentColor 8%, transparent); }
.${CLASS.analogHead} { display: flex; align-items: baseline; gap: 8px; }
.${CLASS.analogScore} { margin-left: auto; font-size: 11px; opacity: 0.6; font-variant-numeric: tabular-nums; }
.${CLASS.note} { opacity: 0.75; padding: 8px 10px; }
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

    /** A knowledge-graph glyph: nodes and their descent edges. */
    const GraphIcon = () => React.createElement('svg',
      { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
        strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' },
      React.createElement('circle', { cx: 5, cy: 6, r: 2.4 }),
      React.createElement('circle', { cx: 19, cy: 6, r: 2.4 }),
      React.createElement('circle', { cx: 12, cy: 13, r: 2.8 }),
      React.createElement('circle', { cx: 5, cy: 20, r: 2.4 }),
      React.createElement('circle', { cx: 19, cy: 20, r: 2.4 }),
      React.createElement('path', { d: 'M6.6 7.9 10.3 11.3' }),
      React.createElement('path', { d: 'M17.4 7.9 13.7 11.3' }),
      React.createElement('path', { d: 'M10.4 15.4 6.3 18.2' }),
      React.createElement('path', { d: 'M13.6 15.4 17.7 18.2' }))

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
     * implies, the measured outcome, lineage links, and structural analogs.
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
        React.createElement(AnalogsSection, { id, store, onOpen }),
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

    // --- the structural-analogs section --------------------------------------

    /**
     * Gentner structure-mapping in the UI: for this node, the nodes with the
     * same RELATIONAL shape on a different surface. Loaded lazily because it
     * is a whole-store comparison, and rendered with the shared structure
     * spelled out — the analogy is the shared relations, not a score alone.
     */
    function AnalogsSection({ id, store, onOpen }) {
      const [shown, setShown] = React.useState(false)
      const [state, setState] = React.useState(null)

      React.useEffect(() => {
        if (!shown) return
        let alive = true
        setState({ loading: true })
        getJson(`/analogs?id=${encodeURIComponent(id)}`, store)
          .then((answer) => { if (alive) setState({ analogs: answer.analogs ?? [] }) })
          .catch((error) => { if (alive) setState({ error: String(error.message ?? error) }) })
        return () => { alive = false }
      }, [shown, id, store])

      if (!shown) {
        return React.createElement('button', {
          className: CLASS.back,
          onClick: () => setShown(true),
        }, 'find structural analogs →')
      }
      if (state === null || state.loading) {
        return React.createElement('div', { className: CLASS.note }, 'comparing structures…')
      }
      if (state.error !== undefined) {
        return React.createElement('div', { className: CLASS.note }, state.error)
      }
      const analogs = state.analogs ?? []
      if (analogs.length === 0) {
        return React.createElement('div', { className: CLASS.note },
          'no analogs: nothing else shares this node’s relational shape')
      }
      return Section({ title: 'Structural analogs — same shape, different domain' },
        analogs.map((analog) => React.createElement('div', {
          key: analog.id,
          className: CLASS.analog,
          onClick: () => onOpen(analog.id),
        },
          React.createElement('div', { className: CLASS.analogHead },
            React.createElement('b', null, analog.title || analog.id),
            React.createElement('span', { className: CLASS.analogScore },
              `structure ${Math.round(analog.structural * 100)}%`),
          ),
          React.createElement('div', { className: CLASS.cardMeta },
            [analog.id, analog.kind, analog.track, analog.status, analog.verdict]
              .filter(Boolean).join(' · ')),
          React.createElement('div', { className: CLASS.badges },
            ...analog.sharedStructure.slice(0, 8).map((token) =>
              React.createElement('span', { key: token, className: CLASS.badge }, token)),
            analog.sameTrack
              ? React.createElement('span', {
                  key: 'surface', className: CLASS.badge, 'data-tone': 'warn',
                }, 'same track — topical, not structural')
              : null),
        )))
    }

    // --- the panel body: board, frontier, filters ------------------------------

    /**
     * The steering console, rendered inside the right pane's tab body.
     * Board and frontier are two tabs over the same store; a card opens its
     * node page in place.
     */
    function GraphPanel() {
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

      return React.createElement('div', { className: CLASS.panel },
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
          React.createElement('div', { className: CLASS.counts }, countsLine(nodes)),
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

    // --- the frame's top-right trigger ---------------------------------------

    /** Whether any open tab in the on-screen session is this kind. */
    function useTabOpen(sidebarRight, kind) {
      const [open, setOpen] = React.useState(
        () => (sidebarRight.openTabs.getSnapshot() ?? []).some((tab) => tab.kind === kind))
      React.useEffect(() => {
        const sync = () => {
          setOpen((sidebarRight.openTabs.getSnapshot() ?? []).some((tab) => tab.kind === kind))
        }
        const unsubscribe = sidebarRight.openTabs.subscribe(sync)
        sync()
        return unsubscribe
      }, [sidebarRight, kind])
      return open
    }

    /**
     * The always-visible graph button, pinned above every column. One click
     * opens the pane and the tab; a second click closes the pane. The state
     * is read from the pane's own open-tab snapshot, so it survives reloads.
     */
    function TriggerButton({ sidebarRight, layout }) {
      const open = useTabOpen(sidebarRight, KIND)
      return React.createElement('div', { className: CLASS.trigger },
        React.createElement('button', {
          className: CLASS.triggerButton,
          type: 'button',
          title: open ? 'Hide the research graph' : 'Show the research graph',
          'data-state': open ? 'open' : 'closed',
          onClick: () => {
            if (open) {
              layout.closeRightbar()
            } else {
              sidebarRight.openTab(KIND)
              layout.openRightbar(true, false)
            }
          },
        }, React.createElement(GraphIcon)),
      )
    }

    /** The only declared dependencies: real client services, never slots. */
    const inject = ['slots', 'sidebarRight', 'sidebarRightTabs', 'layout']

    /** Register the tab type, its body, and the frame trigger. */
    function apply(ctx) {
      const removeStyles = insertStyles()
      ctx.effect(() => removeStyles, 'knowledge-dag styles')

      // The tab type: exactly what the shipped terminal/files tabs
      // register. The guide entry is the pane's "+" menu.
      ctx.effect(() => ctx.sidebarRightTabs.register({
        id: TYPE_ID,
        kind: KIND,
        multiple: false,
        priority: 'extension',
        title: () => 'Knowledge graph',
        guide: [{
          id: 'open',
          order: 60,
          title: () => 'Knowledge graph',
          description: () => 'The research knowledge graph: board, open frontier, and node pages.',
          icon: null,
        }],
      }), 'knowledge-dag.tab-type')

      // The tab body: the panel, dispatched by the pane with the key KIND.
      ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
        name: 'sidebar.right.pane.tab',
        key: KIND,
        locale: 'dsh-knowledge-dag',
        inject: () => ({}),
      }, GraphPanel)), 'knowledge-dag.tab-body')

      // The tab's title chip.
      ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
        name: 'sidebar.right.pane.tab.title',
        key: KIND,
        locale: 'dsh-knowledge-dag',
        inject: () => ({}),
      }, () => React.createElement('span', null, 'Knowledge graph'))),
        'knowledge-dag.tab-title')

      // The frame trigger: one entry in the frame-wide floating layer,
      // above every column and outside their scroll containers.
      ctx.effect(() => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        id: 'knowledge-dag-trigger',
        order: 80,
        label: 'Knowledge graph',
      }, () => React.createElement(TriggerButton, {
        sidebarRight: ctx.sidebarRight,
        layout: ctx.layout,
      }))), 'knowledge-dag.trigger')
    }

    module.exports.inject = inject
    module.exports.apply = apply
    return module.exports
  },
})
