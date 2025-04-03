const { a, div, span, style } = makeTags(["a", "div", "span", "style"])

const SINKING_FUNDS = [
  1391931, // Roth IRAs
  1433085, // Car Replacement
]

const ACCOUNTS = {
  ally: 238120,
  loan: 154822,
}

const ANIMATION = "bm-selector-observer"
const ALLY = `.left > .card > .content > .card-content-wrapper:has(.account-sub-name [href*='account=${ACCOUNTS.ally}'])`

class Cache {
  #cache = new Map()

  /**
   * @param {string} key
   * @param {T extends (key: string) => Promise<any>} fn
   */
  async get(key, fn) {
    if (this.#cache.has(key)) {
      return this.#cache.get(key)
    }

    const value = fn()
    this.#cache.set(key, value)
    return value
  }
}

const cache = new Cache()

async function get(url) {
  return cache.get(url, async () => {
    const res = await fetch(`https://api-beta.lunchmoney.app${url}`, {
      method: "GET",
      credentials: "include",
    })

    return res.json()
  })
}

/**
 * @returns {Promise<Map<number, any>>}
 */
function getCategories() {
  return cache.get("#categories", async () => {
    const res = await get("/categories")
    const map = new Map()

    function addToMap(category) {
      map.set(category.id, {
        ...category,
        name: parseName(category.name),
      })

      if (category.children) {
        category.children.forEach(addToMap)
      }
    }

    res.nested.forEach(addToMap)

    return map
  })
}

/**
 * @param {string} id
 * @param {any} categories
 */
function findCategory(id, categories) {
  const category = categories.flattened.find((cat) => cat.id === id)
  if (!category) {
    return null
  }

  if (category.group_id) {
    const group = categories.nested.find((cat) => cat.id === category.group_id)
    if (!group) {
      return null
    }

    return group.children.find((cat) => cat.id === id)
  }

  return categories.nested.find((cat) => cat.id === id)
}

/**
 * @param {string} name
 */
function parseName(name) {
  return new DOMParser().parseFromString(name, "text/html").body.textContent
}

/**
 * @param {string} category
 */
function buildURL(category) {
  const { pathname } = window.location
  const match = pathname.match(/\/budget\/(\d{4})\/(\d{2})\/(\d{2})/)
  if (!match) {
    return null
  }

  const [_, year, month] = match

  return `https://beta.lunchmoney.app/transactions/${year}/${month}?category=${category}&match=all&time=month`
}

/**
 * @param {number} amount
 */
function formatMoney(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

async function sinkingFunds() {
  const divider = document.querySelector(
    ".right .ui.card .divider:last-of-type",
  )
  if (!divider) {
    return
  }

  const totalAmount = await getSinkingFunds()
  const formattedAmount = formatMoney(totalAmount)

  const sinkingFunds = document.querySelector("#sinking-funds")
  if (sinkingFunds) {
    sinkingFunds.textContent = formattedAmount
    return
  }

  const node = div(
    { class: "card-content-wrapper" },
    div(
      { class: "card-content no-wrap" },
      span({ class: "card-text ellipsis font--bold" }, "Total Sinking Funds"),
      span({ id: "sinking-funds", class: "card-number" }, formattedAmount),
    ),
  )

  divider.after(node)
}

/**
 * @param {string} id
 * @param {string} label
 * @param {number} amount
 */
function insertAllyRow(id, label, amount) {
  const formattedAmount = formatMoney(amount)
  const amountId = `ally-${id}`
  const existingNode = document.getElementById(amountId)
  if (existingNode) {
    existingNode.textContent = formattedAmount
    return
  }

  const node = div(
    { class: "card-content-wrapper" },
    div(
      { class: "card-content no-wrap" },
      span(
        {
          class: "card-text ellipsis",
          style: "margin-left: 1rem",
        },
        div(
          { class: "display--flex" },
          span({ class: "hierarchy-line-icon-4" }),
          span({ class: "account-sub-name" }, label),
        ),
      ),
      span(
        { class: "card-number" },
        span({ class: "account-sub-amount", id: amountId }, formattedAmount),
      ),
    ),
  )

  document.querySelector(ALLY)?.after(node)
}

function padZero(num) {
  return num < 10 ? `0${num}` : num
}

function formatCalendarDate(date) {
  return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())}`
}

async function getSinkingFunds() {
  const startDate = new Date()
  startDate.setDate(1)

  const endDate = new Date()
  endDate.setMonth(startDate.getMonth() + 1)
  endDate.setDate(endDate.getDate() - 1)

  const params = new URLSearchParams({
    start_date: formatCalendarDate(startDate),
    end_date: formatCalendarDate(endDate),
    include_exclude_from_budgets: "false",
    include_occurrences: "true",
    include_recurring: "true",
  })

  const budget = await get(`/summary?${params.toString()}`)
  const totalAmount = SINKING_FUNDS.map((id) => {
    const category = budget.categories.find(
      (cat) => cat.properties.category.id === id,
    )

    if (!category) {
      return 0
    }

    const occurence = category.occurrences.find(
      (occ) => occ.start_date === formatCalendarDate(startDate),
    )

    if (!occurence) {
      return 0
    }

    return occurence.available
  }).reduce((a, b) => a + b, 0)

  return totalAmount
}

async function allySplit() {
  const assets = await get("/assets")
  const ally = parseFloat(
    assets.find((asset) => asset.id === ACCOUNTS.ally).balance,
  )
  const loan = parseFloat(
    assets.find((asset) => asset.id === ACCOUNTS.loan).balance,
  )

  const sinkingFunds = await getSinkingFunds()
  const reserved = loan + sinkingFunds
  const available = ally - reserved

  insertAllyRow("available-funds", "Available", available)
  insertAllyRow("sinking-funds", "Reserved", reserved)
}

function init() {
  if (window.location.pathname.includes("/overview")) {
    observe(ALLY, () => allySplit())
  }

  if (window.location.pathname.includes("/budget")) {
    observe(
      ".p-budget-table:not(:has(.bm-cell)) tbody tr:first-of-type",
      () => {
        sinkingFunds()
      },
    )
  }
}

observe("h1", (h1) => {
  init()

  const observer = new MutationObserver(() => {
    init()
  })

  observer.observe(h1, {
    characterData: true,
    childList: true,
    subtree: true,
  })
})

function registerAnimation() {
  return cache.get(ANIMATION, () => {
    const rule = style(`@keyframes ${ANIMATION} {}`)
    document.head.append(rule)
  })
}

/**
 * @param {string} selector
 * @param {(element: HTMLElement) => void} listener
 */
function observe(selector, listener) {
  const seenMark = `bm-seen-${selector.replace(/[^a-zA-Z0-9]/g, "-")}`
  registerAnimation()

  const rule = style(
    `:where(${String(selector)}):not(.${seenMark}) {
      animation: 1ms ${ANIMATION};
    }`,
  )

  document.body.prepend(rule)

  globalThis.addEventListener("animationstart", (event) => {
    if (event.target.classList.contains(seenMark)) {
      return
    }

    event.target.classList.add(seenMark)
    listener(event.target)
  })
}

/**
 * @param {string} tag
 * @param {Record<string, string>} props
 * @param {Node[]} children
 * @returns {HTMLElement}
 */
function h(tag, props, children) {
  const element = document.createElement(tag)

  Object.entries(props).forEach(([key, value]) => {
    element.setAttribute(key, value)
  })

  children.forEach((child) => element.append(child))

  return element
}

/** @typedef {string | Element} Node */

/**
 * @typedef {{
 *   (props: Record<string, string>, ...children: Node[]) => HTMLElement;
 *   (...children: Node[]) => HTMLElement;
 * }} TagFunction
 */

/**
 * @param {string} tag
 * @returns {TagFunction}
 */
function makeTag(tag) {
  /** @type {TagFunction} */
  return function (props, ...children) {
    if (typeof props === "string" || props instanceof Element) {
      return h(tag, {}, [props])
    }

    return h(tag, props, children)
  }
}

/**
 * @param {string[]} tags
 * @returns {Record<string, TagFunction>}
 */
function makeTags(tags) {
  return tags.reduce((acc, tag) => {
    acc[tag] = makeTag(tag)
    return acc
  }, {})
}
