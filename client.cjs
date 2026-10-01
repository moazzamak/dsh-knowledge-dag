/**
 * Browser half of `dsh-knowledge-dag`, in the harness client-bundle format
 * (`window.__ModuleLoader__.load({ id, factory })`).
 *
 * Shows the research graph. The composer row gets one button; pressing it
 * opens a panel that lists every node with its kind, track, status and
 * verdict, and clicking a node shows that node's page: the four beats in
 * English, with the machine fields beneath them.
 *
 * The page is fetched from the host half rather than rebuilt here. The
 * record already generates it (`analysis/nodes/<id>.md`), and a view that
 * rendered its own version would be free to disagree with the file a
 * reader trusts.
 *
 * Plain CommonJS in a factory, no build step, so a direct install works.
 *
 * @module dsh-knowledge-dag/client
 */
window.__ModuleLoader__.load({
  id: 'dsh-knowledge-dag',
  factory: (require) => {
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const SLOT = 'conversation.input.left'
    const ROUTE = '/dsh-knowledge-dag'
    const CLASS = {
      button: 'dsh-dag-button',
      panel: 'dsh-dag-panel',
      list: 'dsh-dag-list',
      node: 'dsh-dag-node',
      page: 'dsh-dag-page',
      note: 'dsh-dag-note',
      stores: 'dsh-dag-stores',
    }

    const CSS = `
      .${CLASS.button} { opacity: 0.7; cursor: pointer; }
      .${CLASS.button}:hover { opacity: 1; }
      .${CLASS.button}[data-state='open'] { opacity: 1; }
      .${CLASS.panel} {
        position: absolute; right: 8px; bottom: 48px; z-index: 40;
        width: min(680px, 90vw); max-height: 60vh; overflow: auto;
        padding: 10px 12px; border-radius: 8px; font-size: 13px;
        background: var(--dsh-surface, #1c1c1f); color: inherit;
        border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
      }
      .${CLASS.list} { display: flex; flex-direction: column; gap: 2px; }
      .${CLASS.node} {
        display: grid; gap: 2px; padding: 4px 6px; cursor: pointer;
        border-radius: 6px; grid-template-columns: 1fr auto;
      }
      .${CLASS.node}:hover { background: color-mix(in srgb, currentColor 8%, transparent); }
      .${CLASS.node} small { opacity: 0.7; }
      .${CLASS.page} { white-space: pre-wrap; line-height: 1.45; }
      .${CLASS.page} h1 { font-size: 15px; margin: 0 0 6px; }
      .${CLASS.note} { opacity: 0.75; }
      .${CLASS.stores} {
        margin-bottom: 6px; background: transparent; color: inherit;
        border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
        border-radius: 5px; padding: 2px 4px; font-size: 12px;
      }
    `

    function styleOnce(doc) {
      if (doc.querySelector('style[data-dsh-dag]') !== null) return
      const style = doc.createElement('style')
      style.setAttribute('data-dsh-dag', '')
      style.textContent = CSS
      doc.head.appendChild(style)
    }

    async function getJson(path, store) {
      // The host reads a named store behind the same routes; unnamed stays
      // the research record.
      const suffix = store
        ? `${path}${path.includes('?') ? '&' : '?'}store=${encodeURIComponent(store)}`
        : path
      const response = await fetch(`${ROUTE}${suffix}`)
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
      return response.json()
    }

    function renderList(panel, nodes, open) {
      const list = panel.ownerDocument.createElement('div')
      list.className = CLASS.list
      for (const node of nodes) {
        const row = panel.ownerDocument.createElement('div')
        row.className = CLASS.node
        const title = panel.ownerDocument.createElement('span')
        title.textContent = node.title || node.id
        const meta = panel.ownerDocument.createElement('small')
        meta.textContent = [node.kind, node.track, node.status,
                            node.verdict].filter(Boolean).join(' | ')
        row.appendChild(title)
        row.appendChild(meta)
        row.addEventListener('click', () => open(node.id))
        list.appendChild(row)
      }
      panel.replaceChildren(list)
    }

    function renderNote(panel, message) {
      const note = panel.ownerDocument.createElement('div')
      note.className = CLASS.note
      note.textContent = message
      panel.replaceChildren(note)
    }

    async function openPage(panel, id, store) {
      renderNote(panel, 'loading…')
      const page = await getJson(`/node/${encodeURIComponent(id)}`, store)
      const body = panel.ownerDocument.createElement('div')
      body.className = CLASS.page
      body.textContent = page.markdown || '(no page)'
      panel.replaceChildren(body)
    }

    function mount(ctx) {
      const doc = ctx.document
      styleOnce(doc)

      const button = doc.createElement('button')
      button.className = CLASS.button
      button.type = 'button'
      button.title = 'Show the research graph'
      button.textContent = 'graph'
      button.dataset.state = 'closed'

      const panel = doc.createElement('div')
      panel.className = CLASS.panel
      panel.hidden = true

      let store = ''
      let picker = null

      async function load() {
        try {
          const graph = await getJson('/graph', store)
          const names = graph.stores || []
          if (names.length) {
            if (picker === null) {
              picker = doc.createElement('select')
              picker.className = CLASS.stores
              picker.addEventListener('change', () => {
                store = picker.value
                load()
              })
            }
            const wanted = [{ value: '', label: 'research' }]
              .concat(names.map((name) => ({ value: name, label: name })))
            if (picker.options.length !== wanted.length) {
              picker.replaceChildren()
              for (const option of wanted) {
                const item = doc.createElement('option')
                item.value = option.value
                item.textContent = option.label
                picker.appendChild(item)
              }
            }
            picker.value = store
          }
          const holder = doc.createElement('div')
          if (picker !== null) holder.appendChild(picker)
          holder.appendChild(doc.createElement('div'))
          renderList(holder, graph.nodes || [],
                     (id) => openPage(panel, id, store))
          panel.replaceChildren(holder)
        } catch (error) {
          renderNote(panel, `the graph is unavailable: ${error.message}. ` +
                            `The host half serves ${ROUTE}/graph.`)
        }
      }

      async function toggle() {
        const opened = !panel.hidden
        panel.hidden = opened
        button.dataset.state = opened ? 'closed' : 'open'
        if (opened) return
        renderNote(panel, 'loading…')
        try {
          await load()
        } catch (error) {
          // The host half serves this route. Saying so beats an empty panel.
          renderNote(panel, `the graph is unavailable: ${error.message}. ` +
                            `The host half serves ${ROUTE}/graph.`)
        }
      }

      button.addEventListener('click', toggle)
      return { button, panel }
    }

    exports.register = (ctx) => {
      const { button, panel } = mount(ctx)
      ctx.slot(SLOT, button)
      ctx.slot('conversation.overlay', panel)
    }
    return exports
  },
})
