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
    /** The right-pane tab kind this bundle owns: what `openTab` names. */
    const KIND = 'knowledge-dag'
    /**
     * The tab type's identity, and — this is the part that bites — the KEY its
     * body and title register under.
     *
     * The pane dispatches a tab's body with
     * `renderSlot('sidebar.right.pane.tab', {}, { entryKey: definition.id ?? tab.kind })`,
     * so the seat looks for the DEFINITION'S ID, not the kind. Registering the
     * body under `KIND` finds no registrant and the pane draws its own
     * "Nothing here can view this kind of content yet." — a tab that opens and
     * a chip that titles itself, over an empty body.
     */
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
      graph: 'dsh-dag-graph',
      canvas: 'dsh-dag-canvas',
      gnode: 'dsh-dag-gnode',
      gnodeBox: 'dsh-dag-gnode-box',
      gnodeDot: 'dsh-dag-gnode-dot',
      gnodeTitle: 'dsh-dag-gnode-title',
      gnodeMeta: 'dsh-dag-gnode-meta',
      edge: 'dsh-dag-edge',
      zoom: 'dsh-dag-zoom',
      zoomButton: 'dsh-dag-zoom-button',
      legend: 'dsh-dag-legend',
      legendItem: 'dsh-dag-legend-item',
      legendDot: 'dsh-dag-legend-dot',
    }

    /**
     * Status/verdict → tone, so the board and the graph can be read at a
     * glance. The vocabulary is open — a store names its own fates — so this
     * maps the ones the research record uses and everything else stays neutral
     * rather than being forced into a colour it does not mean.
     */
    const TONES = {
      open: 'warn', parked: 'warn', queued: 'warn', blocked: 'warn',
      running: 'info', active: 'info', measuring: 'info',
      adopted: 'good', confirmed: 'good', supported: 'good', grounded: 'good',
      settled: 'good', done: 'good', kept: 'good',
      rejected: 'bad', falsified: 'bad', withdrawn: 'bad', killed: 'bad',
      failed: 'bad', abandoned: 'bad',
    }
    const toneOf = (value) => TONES[String(value ?? '').toLowerCase()] ?? 'neutral'
    /** Legend order: fates first, then live states, then everything else. */
    const TONE_ORDER = ['good', 'bad', 'warn', 'info', 'neutral']

    const CSS = `
/* The trigger sits in the frame's own overlay seat, in the window's control row.
   It is NOT position:fixed at the top right: that end of the row belongs to the
   window controls, so a fixed trigger is painted underneath them and cannot be
   clicked. */
.${CLASS.trigger} {
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

/* The node-link view. Colors stay with the tones the board already uses, and
   the shapes inherit currentColor, so both themes work without a second
   palette. */
.${CLASS.graph} { flex: 1; min-height: 0; position: relative; display: flex; }
.${CLASS.canvas} {
  flex: 1; min-height: 0; width: 100%; display: block;
  cursor: grab; touch-action: none; user-select: none;
}
.${CLASS.canvas}[data-panning='true'] { cursor: grabbing; }
.${CLASS.gnode} { cursor: pointer; }
.${CLASS.gnodeBox} {
  fill: color-mix(in srgb, currentColor 7%, transparent);
  stroke: color-mix(in srgb, currentColor 26%, transparent);
  stroke-width: 1;
}
.${CLASS.gnode}:hover .${CLASS.gnodeBox},
.${CLASS.gnode}[data-hot='true'] .${CLASS.gnodeBox} {
  stroke: color-mix(in srgb, currentColor 75%, transparent);
  stroke-width: 1.7;
}
.${CLASS.gnode}[data-dim='true'] { opacity: 0.2; }
.${CLASS.gnode}[data-dim='true'] .${CLASS.gnodeBox} { fill: transparent; }
.${CLASS.gnodeTitle} { font-size: 12px; fill: currentColor; }
.${CLASS.gnodeMeta} { font-size: 10px; fill: currentColor; opacity: 0.62; }
.${CLASS.gnodeDot} { fill: currentColor; opacity: 0.5; }
.${CLASS.gnode}[data-tone='good'] .${CLASS.gnodeDot} { fill: #46a758; opacity: 1; }
.${CLASS.gnode}[data-tone='bad'] .${CLASS.gnodeDot} { fill: #e5484d; opacity: 1; }
.${CLASS.gnode}[data-tone='warn'] .${CLASS.gnodeDot} { fill: #e5a34d; opacity: 1; }
.${CLASS.gnode}[data-tone='info'] .${CLASS.gnodeDot} { fill: #6ca0ff; opacity: 1; }
.${CLASS.edge} {
  fill: none; stroke: color-mix(in srgb, currentColor 28%, transparent);
  stroke-width: 1.2;
}
.${CLASS.edge}[data-cross='true'] { stroke-dasharray: 4 3; }
.${CLASS.edge}[data-hot='true'] { stroke: currentColor; stroke-width: 1.8; opacity: 0.9; }
.${CLASS.edge}[data-dim='true'] { opacity: 0.12; }
.${CLASS.zoom} { position: absolute; right: 10px; top: 8px; display: inline-flex; gap: 4px; }
.${CLASS.zoomButton} {
  min-width: 24px; padding: 2px 7px; font-size: 11.5px; line-height: 1.4;
  border-radius: 6px; color: inherit; cursor: pointer;
  background: color-mix(in srgb, currentColor 8%, transparent);
  border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
}
.${CLASS.zoomButton}:hover { background: color-mix(in srgb, currentColor 16%, transparent); }
.${CLASS.legend} {
  position: absolute; left: 10px; bottom: 10px; right: 10px;
  display: flex; flex-wrap: wrap; gap: 10px; font-size: 10.5px; opacity: 0.85;
  pointer-events: none;
}
.${CLASS.legendItem} { display: inline-flex; align-items: center; gap: 4px; }
.${CLASS.legendItem}[data-tone='warn'] { color: #e5a34d; }
.${CLASS.legendDot} {
  width: 8px; height: 8px; border-radius: 999px; display: inline-block;
  background: color-mix(in srgb, currentColor 45%, transparent);
}
.${CLASS.legendDot}[data-tone='good'] { background: #46a758; }
.${CLASS.legendDot}[data-tone='bad'] { background: #e5484d; }
.${CLASS.legendDot}[data-tone='warn'] { background: #e5a34d; }
.${CLASS.legendDot}[data-tone='info'] { background: #6ca0ff; }
`

    /**
     * Install this bundle's stylesheet once per page.
     *
     * `data-plugin` is not decoration: the harness client loader owns plugin
     * styles by it. `claimStyles` marks every style tag that LACKS it as
     * belonging to whichever plugin materialises next, and `removeOwnedStyles`
     * deletes every tag whose `data-plugin` equals an id when that entry is
     * replaced or pruned. A sheet carrying only a private `data-…` marker
     * therefore looks untagged to the loader: another plugin takes ownership,
     * and that plugin's first refresh or prune deletes this one's sheet. The
     * sheet is injected while `apply` runs, which is after the loader's claim
     * pass, so this plugin's own claim never sees it either. Losing the sheet is
     * not subtle — an SVG <path> with no `fill: none` fills black, so the graph
     * draws as black shapes, and buttons fall back to the browser default.
     * `data-plugin-css` is the loader's per-sheet identity and this bundle's
     * duplicate guard.
     */
    const STYLE_OWNER = 'dsh-knowledge-dag'
    const STYLE_KEY = `${STYLE_OWNER}/styles`

    function insertStyles() {
      if (document.querySelector(`style[data-plugin-css="${STYLE_KEY}"]`) !== null) return () => {}
      const tag = document.createElement('style')
      tag.dataset.plugin = STYLE_OWNER
      tag.dataset.pluginCss = STYLE_KEY
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

    /**
     * A titled block. Deliberately a plain hookless render helper, called as a
     * function at its use sites; anything with state or an effect is rendered
     * with `React.createElement` instead, because a called component's hooks
     * land on the CALLER's hook list.
     */
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

    // --- the record as a picture: a layered DAG --------------------------------

    /** Node geometry in graph coordinates. One transform moves the whole picture. */
    const NODE_W = 214
    const NODE_H = 46
    const GAP_X = 100
    const GAP_Y = 16

    const clamp = (value, low, high) => Math.min(high, Math.max(low, value))

    /** One line of text for a node box, ellipsized to the width it has. */
    function ellipsize(text, limit) {
      const value = String(text ?? '')
      return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`
    }

    /**
     * A node's parent ids, always an array.
     *
     * `lineage` is the edge list, and a host half older than this bundle does
     * not send it. Reading it as an empty list draws the nodes with no
     * connections instead of throwing inside a React render, which is the
     * difference between a stale half and a crashed pane.
     */
    const lineageOf = (node) => (Array.isArray(node.lineage) ? node.lineage : [])

    /**
     * Layered coordinates for the record.
     *
     * The record is a DAG — `lineage` is "derives from" — so this is the
     * classic layered layout rather than a force simulation. A node's LAYER is
     * the longest chain of parents beneath it, which puts every node to the
     * right of everything it derives from and makes the arrows read left to
     * right; two barycenter passes then order each layer by where its parents
     * sit, which is what stops the edges from braiding.
     *
     * Deterministic on purpose: the same record draws the same picture, so a
     * reader learns where a node lives instead of re-finding it on every load.
     * Cycles are tolerated (depth stops at a repeated id) because a store is a
     * file on disk, not a promise.
     *
     * @param nodes - `/graph` nodes, each with `lineage` parent ids.
     * @returns positions, edges, and the bounds the picture occupies.
     */
    function layoutDag(nodes) {
      const byId = new Map(nodes.map((node) => [node.id, node]))
      const depths = new Map()
      const depth = (id, seen) => {
        if (depths.has(id)) return depths.get(id)
        if (seen.has(id)) return 0
        seen.add(id)
        const node = byId.get(id)
        let value = 0
        if (node !== undefined) {
          let best = 0
          for (const parent of lineageOf(node)) best = Math.max(best, depth(parent, seen))
          value = best + 1
        }
        seen.delete(id)
        depths.set(id, value)
        return value
      }

      const layers = []
      for (const node of nodes) {
        // `depth` counts a node with no parents as 1; layers are 0-based, so
        // the first column is index 0. (Indexing by the raw depth would leave
        // a hole at 0, and a `for…of` over a sparse array hands back
        // `undefined` for it.)
        const at = Math.max(0, depth(node.id, new Set()) - 1)
        if (layers[at] === undefined) layers[at] = []
        layers[at].push(node)
      }
      for (const layer of layers) {
        layer.sort((left, right) => String(left.track ?? '')
          .localeCompare(String(right.track ?? '')) || left.id.localeCompare(right.id))
      }

      const order = new Map()
      const remember = () => {
        layers.forEach((layer) => layer.forEach((node, at) => order.set(node.id, at)))
      }
      remember()
      const barycenter = (node) => {
        const parents = lineageOf(node)
        if (parents.length === 0) return order.get(node.id) ?? 0
        let sum = 0
        for (const parent of parents) sum += order.get(parent) ?? 0
        return sum / parents.length
      }
      for (let pass = 0; pass < 2; pass += 1) {
        for (let at = 1; at < layers.length; at += 1) {
          layers[at].sort((left, right) => barycenter(left) - barycenter(right)
            || left.id.localeCompare(right.id))
          remember()
        }
      }

      const rows = Math.max(1, ...layers.map((layer) => layer.length))
      const positions = new Map()
      layers.forEach((layer, at) => {
        const offset = ((rows - layer.length) * (NODE_H + GAP_Y)) / 2
        layer.forEach((node, slot) => {
          positions.set(node.id, {
            x: at * (NODE_W + GAP_X),
            y: offset + slot * (NODE_H + GAP_Y),
          })
        })
      })

      const edges = []
      for (const node of nodes) {
        for (const parent of lineageOf(node)) {
          const from = positions.get(parent)
          const to = positions.get(node.id)
          if (from === undefined || to === undefined) continue
          edges.push({
            key: `${parent}->${node.id}`,
            fromId: parent,
            toId: node.id,
            from,
            to,
            crossTrack: byId.get(parent)?.track !== node.track,
          })
        }
      }

      return {
        positions,
        edges,
        width: Math.max(1, layers.length) * (NODE_W + GAP_X) + GAP_X,
        height: rows * (NODE_H + GAP_Y) + GAP_Y,
      }
    }

    /**
     * The record drawn as a node-link graph.
     *
     * SVG and nothing else: a client bundle shares one module table (`react`),
     * so a graph library would have to be vendored into this file, and a
     * layered layout for a record this size is a hundred lines instead. Pan and
     * zoom belong to the reader, not the layout — the picture is drawn once in
     * graph coordinates and one transform moves it.
     *
     * Reading aids, in the order they matter: a node's tone is its status, a
     * dashed edge crosses tracks (inheritance that is not topical), hovering
     * lights the node's own edges, and the panel's filters dim the nodes they
     * exclude instead of removing them, so the shape of the record survives the
     * question "where is this one".
     */
    function GraphView({ nodes, layout, matches, onOpen }) {
      const [view, setView] = React.useState({ k: 1, x: 0, y: 0 })
      const [hot, setHot] = React.useState(null)
      const [panning, setPanning] = React.useState(false)
      const hostRef = React.useRef(null)
      const drag = React.useRef(null)

      const fit = React.useCallback(() => {
        const host = hostRef.current
        if (host === null) return
        const width = host.clientWidth
        const height = host.clientHeight
        if (width === 0 || height === 0) return
        const k = clamp(Math.min(width / layout.width, height / layout.height), 0.15, 1)
        setView({ k, x: (width - layout.width * k) / 2, y: (height - layout.height * k) / 2 })
      }, [layout.width, layout.height])

      /**
       * The opening frame: the top-left of the record at a readable scale.
       *
       * Fitting the WHOLE record is the wrong first view — a 120-node record is
       * several thousand pixels wide, and shrinking it into a 600px pane renders
       * 12px labels at two or three pixels, which is a map nobody can read.
       * Fitting the height instead keeps the labels legible, and `fit` is one
       * click away for the overview.
       */
      const reset = React.useCallback(() => {
        const host = hostRef.current
        if (host === null) return
        const height = host.clientHeight
        const k = height === 0 ? 1 : clamp((height - 28) / layout.height, 0.55, 1)
        setView({ k, x: 16, y: 14 })
      }, [layout.height])

      // Wheel must zoom rather than scroll the pane, and React's wheel listener
      // is passive by contract, so this binds a native one.
      React.useEffect(() => {
        const host = hostRef.current
        if (host === null) return undefined
        const onWheel = (event) => {
          event.preventDefault()
          const rect = host.getBoundingClientRect()
          const px = event.clientX - rect.left
          const py = event.clientY - rect.top
          setView((current) => {
            const k = clamp(current.k * (event.deltaY < 0 ? 1.15 : 1 / 1.15), 0.15, 2.6)
            const ratio = k / current.k
            return { k, x: px - (px - current.x) * ratio, y: py - (py - current.y) * ratio }
          })
        }
        host.addEventListener('wheel', onWheel, { passive: false })
        return () => { host.removeEventListener('wheel', onWheel) }
      }, [])

      // A new record means a new picture: frame it rather than inherit the last
      // record's pan.
      React.useEffect(() => { reset() }, [reset])

      const neighbors = hot === null ? null : new Set([
        hot,
        ...(layout.edges.filter((edge) => edge.toId === hot).map((edge) => edge.fromId)),
        ...(layout.edges.filter((edge) => edge.fromId === hot).map((edge) => edge.toId)),
      ])

      const onPointerDown = (event) => {
        drag.current = { x: event.clientX, y: event.clientY, ox: view.x, oy: view.y }
        setPanning(true)
        event.currentTarget.setPointerCapture?.(event.pointerId)
      }
      const onPointerMove = (event) => {
        const start = drag.current
        if (start === null) return
        setView((current) => ({
          ...current,
          x: start.ox + (event.clientX - start.x),
          y: start.oy + (event.clientY - start.y),
        }))
      }
      const onPointerUp = (event) => {
        drag.current = null
        setPanning(false)
        event.currentTarget.releasePointerCapture?.(event.pointerId)
      }

      const zoomBy = (factor) => setView((current) => ({ ...current, k: clamp(current.k * factor, 0.15, 2.6) }))

      /**
       * A record with nodes and no edges at all.
       *
       * Two very different situations look identical on screen: a record whose
       * nodes declare no derivation, and a HOST half older than this bundle
       * (`/graph` served the compact board projection, which carries no
       * lineage). The Host is re-imported only when the application starts, so
       * the second case is what an updated plugin looks like until the next
       * restart — and silently drawing isolated boxes made that look like a
       * broken graph. Say which it is instead of guessing.
       */
      const edgeless = nodes.length > 0 && layout.edges.length === 0

      // The legend is the STORE's vocabulary, not ours: whatever statuses this
      // record actually uses, counted and ordered by tone. A fixed list would
      // silently omit "killed" or "parked" while the picture showed them.
      const statusCounts = new Map()
      for (const node of nodes) {
        const key = String(node.status ?? '?')
        statusCounts.set(key, (statusCounts.get(key) ?? 0) + 1)
      }
      const legend = [...statusCounts.entries()]
        .sort((left, right) => TONE_ORDER.indexOf(toneOf(left[0])) - TONE_ORDER.indexOf(toneOf(right[0]))
          || right[1] - left[1] || left[0].localeCompare(right[0]))
        .map(([label, count]) => React.createElement('span', {
          key: label, className: CLASS.legendItem,
        },
          React.createElement('span', { className: CLASS.legendDot, 'data-tone': toneOf(label) }),
          `${label} (${count})`))

      return React.createElement('div', { className: CLASS.graph, ref: hostRef },
        React.createElement('svg', {
          className: CLASS.canvas,
          'data-panning': panning ? 'true' : 'false',
          onPointerDown,
          onPointerMove,
          onPointerUp,
          onPointerCancel: onPointerUp,
        },
          React.createElement('defs', null,
            React.createElement('marker', {
              id: 'dsh-dag-arrow', viewBox: '0 0 8 8', refX: 7.5, refY: 4,
              markerWidth: 6, markerHeight: 6, orient: 'auto',
            }, React.createElement('path', { d: 'M0,0 L8,4 L0,8 z', fill: 'currentColor', opacity: 0.5 }))),
          React.createElement('g', { transform: `translate(${view.x},${view.y}) scale(${view.k})` },
            layout.edges.map((edge) => {
              const x1 = edge.from.x + NODE_W
              const y1 = edge.from.y + NODE_H / 2
              const x2 = edge.to.x
              const y2 = edge.to.y + NODE_H / 2
              const bend = Math.max(30, (x2 - x1) / 2)
              const lit = hot !== null && (edge.fromId === hot || edge.toId === hot)
              return React.createElement('path', {
                key: edge.key,
                className: CLASS.edge,
                'marker-end': 'url(#dsh-dag-arrow)',
                'data-cross': edge.crossTrack ? 'true' : 'false',
                'data-hot': lit ? 'true' : 'false',
                'data-dim': hot !== null && !lit ? 'true' : 'false',
                d: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`,
              })
            }),
            nodes.map((node) => {
              const at = layout.positions.get(node.id)
              if (at === undefined) return null
              const lit = neighbors === null ? false : neighbors.has(node.id)
              return React.createElement('g', {
                key: node.id,
                className: CLASS.gnode,
                transform: `translate(${at.x},${at.y})`,
                'data-tone': toneOf(node.status),
                'data-hot': lit ? 'true' : 'false',
                'data-dim': matches(node) ? 'false' : 'true',
                onMouseEnter: () => setHot(node.id),
                onMouseLeave: () => setHot(null),
                onClick: () => onOpen(node.id),
              },
                React.createElement('title', null,
                  `${node.title || node.id}\n${node.id} · ${node.kind ?? '?'} · ${node.status ?? '?'}` +
                  `${node.verdict ? ` · ${node.verdict}` : ''}\n${lineageOf(node).length} parent(s)`),
                React.createElement('rect', {
                  className: CLASS.gnodeBox, width: NODE_W, height: NODE_H, rx: 8,
                }),
                React.createElement('circle', { className: CLASS.gnodeDot, cx: 13, cy: 15, r: 4 }),
                React.createElement('text', { className: CLASS.gnodeTitle, x: 25, y: 19 },
                  ellipsize(node.title || node.id, 29)),
                React.createElement('text', { className: CLASS.gnodeMeta, x: 25, y: 34 },
                  ellipsize(`${node.id} · ${node.status ?? '?'}`, 33)),
              )
            }),
          ),
        ),
        React.createElement('div', { className: CLASS.zoom },
          React.createElement('button', {
            className: CLASS.zoomButton, type: 'button', title: 'Zoom in',
            onClick: () => zoomBy(1.2),
          }, '+'),
          React.createElement('button', {
            className: CLASS.zoomButton, type: 'button', title: 'Zoom out',
            onClick: () => zoomBy(1 / 1.2),
          }, '−'),
          React.createElement('button', {
            className: CLASS.zoomButton, type: 'button', title: 'Fit the whole record',
            onClick: fit,
          }, 'fit')),
        React.createElement('div', { className: CLASS.legend },
          legend,
          edgeless
            ? React.createElement('span', {
                className: CLASS.legendItem, 'data-tone': 'warn',
              }, 'no lineage edges: this record declares none, or the Host half is older than this bundle — restart the app')
            : null,
          React.createElement('span', { className: CLASS.legendItem }, '┄ crosses tracks'),
          React.createElement('span', { className: CLASS.legendItem }, 'drag to pan · wheel to zoom · fit shows the whole record')),
      )
    }

    // --- the panel body: board, frontier, filters ------------------------------

    /**
     * The steering console, rendered inside the right pane's tab body.
     *
     * Three tabs over one store and one fetch: the GRAPH is the record's shape
     * (what derives from what, where the open work sits), the Board is the same
     * nodes as rows, and the Frontier is the steering list. Clicking a node —
     * in any of them — opens its page in place.
     */
    function GraphPanel() {
      const [store, setStore] = React.useState('')
      const [tab, setTab] = React.useState('graph')
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
      // Keyed on the fetch, not on `nodes`: the array identity changes every
      // render, and re-laying out the record on every keystroke would make the
      // picture twitch while the reader types in the search box.
      const layout = React.useMemo(() => layoutDag(nodes), [data.graph])

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
              'data-active': tab === 'graph',
              onClick: () => { setTab('graph'); setSelected(null) },
            }, 'Graph'),
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
          // The filters narrow the board rows and dim the graph's nodes; the
          // frontier has its own idea of what matters and ignores them.
          tab !== 'frontier' && (status !== '' || track !== '' || query !== '')
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
              // As an ELEMENT, never as a call: `NodeDetail` holds state and an
              // effect, and calling it would append those hooks to GraphPanel's
              // own list the moment a card is opened — React then throws #310
              // ("rendered more hooks than during the previous render") and the
              // pane's slot entry crashes, which is what a click on any board
              // card used to do.
              ? React.createElement(NodeDetail, {
                  id: selected, store, titles,
                  onOpen: openNode,
                  onBack: () => setSelected(null),
                })
              : tab === 'graph'
                ? React.createElement(GraphView, {
                    nodes, layout, matches, onOpen: openNode,
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

    /**
     * Whether the ON-SCREEN session holds a tab of this kind.
     *
     * `openTabs` is not this session's tab list: it is the pane's inventory of
     * saved and adopted layouts, flattened across every session, so a record
     * there carries the `sessionId` it belongs to. Asking it without naming the
     * session answers "is this kind open anywhere", which reads as open in a
     * session that never opened it — and the trigger's click would then close
     * the column instead of opening the graph. The on-screen session comes from
     * `mounted`; with none on screen nothing can be open, so the button offers
     * to open rather than to close.
     *
     * Both sources are watched: the inventory changes when a tab opens or
     * closes, and `mounted` changes when the reader switches sessions, which can
     * change this answer without the inventory moving at all.
     */
    function useTabOpen(sidebarRight, kind) {
      const mounted = sidebarRight.mounted
      const read = React.useCallback(() => {
        const sessionId = mounted === undefined ? undefined : mounted.getSnapshot()
        if (sessionId === undefined) return false
        return (sidebarRight.openTabs.getSnapshot() ?? []).some(
          (tab) => tab.sessionId === sessionId && tab.kind === kind)
      }, [sidebarRight, mounted, kind])
      const [open, setOpen] = React.useState(read)
      React.useEffect(() => {
        const sync = () => { setOpen(read()) }
        const stopTabs = sidebarRight.openTabs.subscribe(sync)
        const stopMounted = mounted === undefined ? undefined : mounted.subscribe(sync)
        sync()
        return () => {
          stopTabs()
          if (stopMounted !== undefined) stopMounted()
        }
      }, [read, sidebarRight, mounted])
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

      // The tab body: the panel, dispatched by the pane with the definition's
      // own id — see TYPE_ID. This bundle keeps its copy inline, so no locale
      // namespace is bound; naming one that nothing registered would only make
      // a later `t()` call answer with raw keys.
      ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
        name: 'sidebar.right.pane.tab',
        key: TYPE_ID,
        inject: () => ({}),
      }, GraphPanel)), 'knowledge-dag.tab-body')

      // The tab's title chip.
      ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
        name: 'sidebar.right.pane.tab.title',
        key: TYPE_ID,
        inject: () => ({}),
      }, () => React.createElement('span', null, 'Knowledge graph'))),
        'knowledge-dag.tab-title')

      // The frame trigger: one entry in the frame-wide floating layer,
      // above every column and outside their scroll containers.
      //
      // `name` is the registration's own address in the slot registry: it is
      // what resolves the declaring entry and its declaration, and a
      // registration without it throws `slot "undefined" is not declared`
      // while `apply` runs. That throw fails this entry's fiber, which the
      // browser's boot audit reports as "did not activate" and the desktop
      // application treats as a failed startup — the tab body and the title
      // below name themselves; this one has to as well.
      ctx.effect(() => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
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
