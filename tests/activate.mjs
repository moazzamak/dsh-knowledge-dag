/**
 * Activation gate for the knowledge-dag browser half.
 *
 * The bundle has no build step, so nothing type-checks it and nothing loads it
 * outside the browser. This script is that gate: it evaluates the real
 * `client.cjs`, materializes its closure factory, calls `apply` over service
 * fakes that enforce the 0.2.0 registry rules, and renders every registration
 * once. A throw here is what the browser's boot audit reports as "did not
 * activate", so a green run means the entry activates and draws.
 *
 * Run from this repository:
 *
 *     node tests/activate.mjs
 *
 * React is resolved from a `deepseek-harness` checkout (its client packages
 * declare it); point `DSH_CHECKOUT` at the checkout when it is not a sibling
 * directory named `deepseek-harness`.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const bundlePath = join(here, '..', 'client.cjs')

/**
 * Locate a checkout that can supply React.
 *
 * `DSH_CHECKOUT` wins; otherwise the usual sibling and grandparent layouts are
 * tried, because this repository sits beside other plugin repositories and the
 * checkout may be either next to it or one directory further up.
 */
function resolveCheckout() {
  const candidates = [
    process.env.DSH_CHECKOUT,
    join(here, '..', '..', 'deepseek-harness'),
    join(here, '..', '..', '..', 'deepseek-harness'),
    join(here, '..', '..', '..', '..', 'deepseek-harness'),
  ].filter(candidate => typeof candidate === 'string' && candidate !== '')
  const tried = []
  for (const candidate of candidates) {
    const absolute = resolve(candidate)
    tried.push(absolute)
    try {
      createRequire(join(absolute, 'apps', 'web', 'package.json'))('react')
      return absolute
    } catch {
      // Try the next layout; the report below names everything that was tried.
    }
  }
  throw new Error(
    'cannot find a deepseek-harness checkout that resolves react — '
    + `set DSH_CHECKOUT to one. Tried: ${tried.join(', ')}`,
  )
}

const checkout = resolveCheckout()

/** Resolve a module from the checkout. */
function requireFromCheckout(specifier) {
  return createRequire(join(checkout, 'apps', 'web', 'package.json'))(specifier)
}

const React = requireFromCheckout('react')
const { renderToStaticMarkup } = requireFromCheckout('react-dom/server')

/** Seats of the 0.2.0 slot catalog this bundle registers into. */
const DECLARED_SEATS = new Set([
  'conversation.session.header.actions',
  'sidebar.right.pane.tab',
  'sidebar.right.pane.tab.title',
])

/** The 0.2.0 tab registry's default band and its coexist rule. */
const DEFAULT_BAND = 'extension'
const coexists = (held, band) =>
  band !== 'fallback' && held.band !== 'fallback' && held.band !== band && held.shadowed === undefined

const failures = []

/** Assert one expectation, collecting failures instead of stopping at the first. */
function check(what, condition, detail = '') {
  if (condition) {
    console.log(`  ok    ${what}`)
    return
  }
  console.log(`  FAIL  ${what}${detail === '' ? '' : ` — ${detail}`}`)
  failures.push(what)
}

/**
 * Evaluate the bundle and activate it.
 *
 * The fakes follow the 0.2.0 contracts the bundle depends on: the tab registry
 * needs `id` and `kind` and refuses duplicate type ids and duplicate guide
 * entry ids; `slots.register` needs the `name` of a declared seat; `openTabs`
 * is a flat array of `{ sessionId, tabId, kind, contentId }` across sessions;
 * `mounted` is the on-screen session.
 * @param openTabs - records the pane reports as open.
 * @param mountedSession - the on-screen session, or undefined for none.
 */
function activate({ openTabs, mountedSession }) {
  let registered
  const styleTags = []
  const slotRegistrations = []
  const tabTypes = new Map()
  const effects = []

  globalThis.window = { __ModuleLoader__: { load: entry => { registered = entry } } }
  globalThis.document = {
    createElement: () => ({ dataset: {}, textContent: '', remove() {} }),
    head: { append: node => { styleTags.push(node) } },
    querySelector: () => null,
  }
  globalThis.fetch = async () => { throw new Error('the gate provides no network') }

  // eslint-disable-next-line no-eval
  ;(0, eval)(readFileSync(bundlePath, 'utf8'))
  if (registered === undefined) throw new Error('client.cjs never called window.__ModuleLoader__.load')

  const exports = registered.factory((specifier) => {
    if (specifier === 'react') return React
    if (specifier === 'react-dom') return requireFromCheckout('react-dom')
    throw new Error(`the bundle required an unexpected module: ${specifier}`)
  })

  const ctx = {
    effect(callback, label) {
      const disposer = callback()
      effects.push({ label, disposer })
      return disposer
    },
    sidebarRightTabs: {
      register(definition) {
        const { id, kind } = definition
        if (typeof id !== 'string' || id === '') throw new Error('sidebarRight: a tab type needs an id')
        if (typeof kind !== 'string' || kind === '') throw new Error('sidebarRight: a tab type needs a kind')
        const guideIds = (definition.guide ?? []).map(entry => entry.id)
        if (new Set(guideIds).size !== guideIds.length) throw new Error(`sidebarRight: duplicate guide entry id in "${id}"`)
        if (tabTypes.has(id)) throw new Error(`sidebarRight: tab type id "${id}" is already registered`)
        const held = tabTypes.get(kind)
        const band = definition.priority ?? DEFAULT_BAND
        if (held !== undefined && !coexists(held, band)) {
          throw new Error(`sidebarRight: tab kind "${kind}" is already registered (${held.band})`)
        }
        tabTypes.set(id, { definition, band })
        tabTypes.set(kind, { definition, band })
        return () => { tabTypes.delete(id); tabTypes.delete(kind) }
      },
    },
    slots: {
      inject(seat, callback) {
        if (!DECLARED_SEATS.has(seat)) throw new Error(`slots: seat "${seat}" is not declared`)
        return callback()
      },
      register(config, Component) {
        if (typeof config?.name !== 'string' || config.name === '') {
          throw new Error(`slot "${String(config?.name)}" is not declared`)
        }
        if (!DECLARED_SEATS.has(config.name)) throw new Error(`slots: seat "${config.name}" is not declared`)
        slotRegistrations.push({ seat: config.name, key: config.key ?? config.id, Component })
        return () => {}
      },
    },
    sidebarRight: {
      openTabs: { getSnapshot: () => openTabs, subscribe: () => () => {} },
      mounted: { getSnapshot: () => mountedSession, subscribe: () => () => {} },
      openTab() {},
      openResource() {},
      isMounted: () => true,
    },
    layout: { openRightbar() {}, closeRightbar() {} },
  }

  exports.apply(ctx)
  return { registered, exports, styleTags, slotRegistrations, tabTypes, effects }
}

/** The rendered trigger markup for one open-tab state. */
function renderTrigger(records, mountedSession) {
  const { slotRegistrations } = activate({ openTabs: records, mountedSession })
  const trigger = slotRegistrations.find(entry => entry.seat === 'conversation.session.header.actions')
  if (trigger === undefined) throw new Error('the bundle registered no session-header action entry')
  return renderToStaticMarkup(React.createElement(trigger.Component, { sessionId: 'probe' }))
}

const record = (sessionId, kind) => ({ sessionId, tabId: `tab-${sessionId}`, kind, contentId: kind })

console.log(`bundle: ${bundlePath}`)
console.log(`checkout: ${checkout}\n`)

console.log('activation')
const activated = activate({ openTabs: [], mountedSession: 'probe' })
check('registers the bundle id the composition row names', activated.registered.id === 'dsh-knowledge-dag',
  `got ${String(activated.registered.id)}`)
check('declares the four services it binds',
  JSON.stringify(activated.exports.inject) === JSON.stringify(['slots', 'sidebarRight', 'sidebarRightTabs', 'layout']),
  `got ${JSON.stringify(activated.exports.inject)}`)
check('injects its stylesheet once', activated.styleTags.length === 1)
check('registers the tab type', activated.tabTypes.has('dsh-knowledge-dag.graph'))
check('registers the tab body, the title, and the header action',
  activated.slotRegistrations.length === 3,
  `got ${activated.slotRegistrations.map(entry => entry.seat).join(', ')}`)
// `shell.overlay` is a frame-wide floating layer for badges, toasts and status
// pills, and it is click-through by design. A BUTTON registered there is drawn in
// the window's top-left, beside the application menus and the sidebar's reopen
// control, and cannot be clicked. Reported from the running app; this is the
// check that keeps it out.
check('registers nothing in the click-through shell.overlay layer',
  !activated.slotRegistrations.some(entry => entry.seat === 'shell.overlay'))

console.log('\nthe stylesheet is tagged the way the harness loader owns plugin styles')
// The loader claims every sheet WITHOUT data-plugin for whichever plugin
// materialises next, and deletes every sheet whose data-plugin equals an id when
// that entry is replaced or pruned. A sheet carrying only a private data-… marker
// is therefore taken by another plugin and deleted with it, which strips
// `fill: none` from the graph's paths — they fill black — and the trigger's
// styling. Both symptoms were reported from the running app.
const sheet = activated.styleTags[0]
check('the sheet names its owner', sheet?.dataset.plugin === 'dsh-knowledge-dag',
  `got ${String(sheet?.dataset.plugin)}`)
check('the sheet has a per-sheet identity', sheet?.dataset.pluginCss === 'dsh-knowledge-dag/styles',
  `got ${String(sheet?.dataset.pluginCss)}`)

console.log('\nregistration keys (the pane dispatches a body by the DEFINITION id)')
const body = activated.slotRegistrations.find(entry => entry.seat === 'sidebar.right.pane.tab')
const title = activated.slotRegistrations.find(entry => entry.seat === 'sidebar.right.pane.tab.title')
check('the body registers under the definition id', body?.key === 'dsh-knowledge-dag.graph', `got ${String(body?.key)}`)
check('the title registers under the definition id', title?.key === 'dsh-knowledge-dag.graph', `got ${String(title?.key)}`)

console.log('\nrendering every registration')
for (const entry of activated.slotRegistrations) {
  let markup
  try {
    markup = renderToStaticMarkup(React.createElement(entry.Component, { sessionId: 'probe', t: key => key }))
  } catch (error) {
    check(`renders ${entry.seat}`, false, error.message)
    continue
  }
  check(`renders ${entry.seat}`, markup.length > 0, 'rendered nothing')
}

console.log('\nthe header action reads the ON-SCREEN session, not any session')
const openHere = renderTrigger([record('probe', 'knowledge-dag')], 'probe')
check('open when this session has the tab open', openHere.includes('data-state="open"'), openHere.slice(0, 160))
const openElsewhere = renderTrigger([record('another-session', 'knowledge-dag')], 'probe')
check('closed when only ANOTHER session has the tab open', openElsewhere.includes('data-state="closed"'),
  openElsewhere.slice(0, 160))
const otherKind = renderTrigger([record('probe', 'files')], 'probe')
check('closed when this session has a different kind open', otherKind.includes('data-state="closed"'))
const noSession = renderTrigger([record('probe', 'knowledge-dag')], undefined)
check('closed when no session is on screen', noSession.includes('data-state="closed"'))
// The row's controls are icon-only, so each one has to name itself.
check('the icon-only action carries an accessible name',
  openHere.includes('aria-label="Knowledge graph"'), openHere.slice(0, 160))

console.log('')
if (failures.length > 0) {
  console.log(`${failures.length} check(s) failed:`)
  for (const failure of failures) console.log(`  - ${failure}`)
  process.exitCode = 1
} else {
  console.log('all checks passed')
}
