/**
 * Browser half of `dsh-knowledge-dag`, in the harness client-bundle format
 * (`window.__ModuleLoader__.load({ id, factory })`).
 *
 * Shows the research graph. The composer's tool row gets one button; pressing
 * it opens a floating panel that lists every node with its kind, track,
 * status and verdict, and clicking a node shows that node's page: the four
 * beats in English, with the machine fields beneath them.
 *
 * The page is fetched from the host half rather than rebuilt here. The
 * record already generates it (`analysis/nodes/<id>.md`), and a view that
 * rendered its own version would be free to disagree with the file a
 * reader trusts.
 *
 * Wire-format rules, each one the voice plugin (`dsh-voice-input`) learned
 * the hard way, so this half follows them exactly:
 *
 * - The factory creates its OWN `var module = { exports: {} }`. There is no
 *   CommonJS wrapper around a factory, so referencing a bare `module`
 *   throws `ReferenceError` the moment the bundle is evaluated — which
 *   fails the client boot audit and takes the whole GUI down with it. That
 *   is precisely the bug that made this plugin block startup before.
 * - The bundle exports `inject` and `apply`; the loader drives `apply(ctx)`.
 *   Any other export name (the old version used `register`) is simply
 *   never called.
 * - A slot name is NOT a service: `inject` declares only real services.
 *   `slots.inject(SLOT, ...)` is the mechanism that waits for the slot
 *   declaration, and `conversation.overlay` (the old version's target) is
 *   not a slot that exists. The panel renders inside this bundle's own
 *   component tree instead, fixed-positioned so it escapes the tool row.
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
      panel: 'dsh-dag-panel',
      list: 'dsh-dag-list',
      node: 'dsh-dag-node',
      page: 'dsh-dag-page',
      note: 'dsh-dag-note',
      stores: 'dsh-dag-stores',
    }

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
.${CLASS.panel} {
  position: fixed; right: 16px; bottom: 56px; z-index: 40;
  width: min(680px, 90vw); max-height: 60vh; overflow: auto;
  padding: 10px 12px; border-radius: 8px; font-size: 13px;
  background: var(--dsh-surface, #1c1c1f); color: inherit;
  border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
}
.${CLASS.list} { display: flex; flex-direction: column; gap: 2px; }
.${CLASS.node} {
  display: grid; gap: 2px; padding: 4px 6px; cursor: pointer;
  border-radius: 6px; grid-template-columns: 1fr auto; text-align: left;
}
.${CLASS.node}:hover { background: color-mix(in srgb, currentColor 8%, transparent); }
.${CLASS.node} small { opacity: 0.7; }
.${CLASS.page} { white-space: pre-wrap; line-height: 1.45; }
.${CLASS.note} { opacity: 0.75; }
.${CLASS.stores} {
  margin-bottom: 6px; background: transparent; color: inherit;
  border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
  border-radius: 5px; padding: 2px 4px; font-size: 12px;
}
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

    /**
     * The panel: the store picker, the node list, and the node pages it
     * swaps in. One component, because the open/closed state and the chosen
     * store live with the button that toggles them.
     */
    function GraphPanel({ store, onStore, onClose }) {
      const [state, setState] = React.useState({ loading: true })
      const [nodeId, setNodeId] = React.useState('')

      React.useEffect(() => {
        let alive = true
        setState({ loading: true })
        getJson('/graph', store)
          .then((graph) => { if (alive) setState({ graph }) })
          .catch((error) => {
            if (alive) setState({
              error: `the graph is unavailable: ${error.message}. ` +
                      `The host half serves ${ROUTE}/graph.`,
            })
          })
        return () => { alive = false }
      }, [store])

      async function open(id) {
        setNodeId(id)
        setState({ loading: true })
        try {
          const page = await getJson(`/node?id=${encodeURIComponent(id)}`, store)
          setState({ page: page.markdown || '(no page)' })
        } catch (error) {
          setState({ error: `the page is unavailable: ${error.message}` })
        }
      }

      const names = state.graph?.stores ?? []
      return React.createElement('div', { className: CLASS.panel },
        state.loading ? React.createElement('div', { className: CLASS.note }, 'loading…') : null,
        state.error ? React.createElement('div', { className: CLASS.note }, state.error) : null,
        state.graph ? React.createElement('div', null,
          names.length > 0 ? React.createElement('select', {
            className: CLASS.stores,
            value: store,
            onChange: (event) => onStore(event.target.value),
          },
            React.createElement('option', { value: '' }, 'research'),
            names.map((name) => React.createElement('option', { key: name, value: name }, name)),
          ) : null,
          nodeId !== '' ? React.createElement('div', null,
            React.createElement('button', {
              className: CLASS.button,
              onClick: () => setNodeId(''),
            }, '← back to the list'),
            React.createElement('div', { className: CLASS.page }, state.page ?? ''),
          ) : React.createElement('div', { className: CLASS.list },
            (state.graph.nodes ?? []).map((node) => React.createElement('div', {
              key: node.id,
              className: CLASS.node,
              onClick: () => { void open(node.id) },
            },
              React.createElement('span', null, node.title || node.id),
              React.createElement('small', null,
                [node.kind, node.track, node.status, node.verdict]
                  .filter(Boolean).join(' | ')),
            )),
          ),
        ) : null,
        React.createElement('button', {
          className: CLASS.button,
          style: { position: 'absolute', top: 6, right: 6 },
          onClick: onClose,
        }, '×'),
      )
    }

    /** The tool-row control: a graph button that toggles the panel. */
    function KnowledgeDagButton() {
      const [open, setOpen] = React.useState(false)
      const [store, setStore] = React.useState('')

      return React.createElement(React.Fragment, null,
        React.createElement('div', { className: CLASS.root },
          React.createElement('button', {
            className: CLASS.button,
            type: 'button',
            title: 'Show the research graph',
            'data-state': open ? 'open' : 'closed',
            onClick: () => setOpen(!open),
          }, 'graph'),
        ),
        open ? React.createElement(GraphPanel, {
          store,
          onStore: setStore,
          onClose: () => setOpen(false),
        }) : null,
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
