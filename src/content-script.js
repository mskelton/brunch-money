// @ts-check

const { a, div, span, style } = makeTags(["a", "div", "span", "style"])

const ACCOUNTS = {
  allyChecking: 295673,
  allySavings: 238120,
  boltonRoadLoan: 191505,
  brokerage: 158172,
  cash: 158174,
  chase: 231609,
  house: 154821,
  houseLoan: 154822,
  ramp401k: 231657,
  summitChecking: 231611,
  summitSavings: 231610,
  wex: 261256,
}

const SINKING_FUNDS = {
  [ACCOUNTS.allySavings]: {
    "Sinking Funds": {
      accounts: [ACCOUNTS.chase],
      /** @param {BudgetCategory} category */
      categories: (category) => {
        return category.properties.budget_settings.rollover_option
      },
    },
    "Emergency Fund": {
      amount: 30_000,
    },
  },
}

/** @param {number} accountId */
const accountCard = (accountId) =>
  `.left > .card > .content > .card-content-wrapper:has(.account-sub-name :is([href*='account=${accountId}'], [href*='asset=${accountId}']))`

const ANIMATION = "bm-selector-observer"

class AsyncCache {
  #cache = new Map()

  /**
   * @template {() => any} T
   * @param {string} key
   * @param {T} fn
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

const cache = new AsyncCache()

/** @param {string} url */
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
 * @typedef Asset
 * @property {number} id
 * @property {string} balance
 */

/** @returns {Promise<Asset[]>} */
async function getAssets() {
  const res = await get("/assets")
  return res ?? []
}

/**
 * @typedef BudgetTotal
 * @property {number} available
 */

/**
 * @typedef BudgetProperties
 * @property {{ id: number }} category
 * @property {{ rollover_option: string }} budget_settings
 */

/**
 * @typedef BudgetCategory
 * @property {BudgetProperties} properties
 * @property {BudgetTotal} totals
 */

/**
 * @typedef Budget
 * @property {BudgetCategory[]} categories
 */

/**
 * @param {URLSearchParams} params
 * @returns {Promise<Budget>}
 */
function getBudget(params) {
  return get(`/summary?${params.toString()}`)
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

/**
 * @param {number} accountId
 * @param {string} id
 * @param {string} label
 * @param {string} amount
 */
function createSplitNode(accountId, id, label, amount) {
  const scopedId = `${id}-${accountId}`
  const existingNode = document.getElementById(scopedId)
  if (existingNode) {
    existingNode.textContent = amount
    return
  }

  const node = div(
    { style: "margin-top: 10px" },
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
        span({ class: "account-sub-amount", id: scopedId }, amount),
      ),
    ),
  )

  document.querySelector(accountCard(accountId))?.appendChild(node)
}

/** @param {number} num */
function padZero(num) {
  return num < 10 ? `0${num}` : num
}

/** @param {Date} date */
function formatCalendarDate(date) {
  return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())}`
}

/** @param {number[] | ((category: BudgetCategory) => boolean)} categories */
async function getSinkingCategories(categories) {
  const startDate = new Date()
  startDate.setDate(1)

  const endDate = new Date()
  endDate.setMonth(startDate.getMonth() + 1)
  endDate.setDate(0)

  const params = new URLSearchParams({
    start_date: formatCalendarDate(startDate),
    end_date: formatCalendarDate(endDate),
    include_totals: "true",
    strict_dates: "true",
  })

  const budget = await getBudget(params)

  if (typeof categories === "function") {
    const predicate = categories

    categories = budget.categories
      .filter((category) => predicate(category))
      .map((category) => category.properties.category.id)
  }

  const totalAmount = categories
    .map((id) => {
      const category = budget.categories.find(
        (cat) => cat.properties.category.id === id,
      )

      if (!category) {
        return 0
      }

      return Math.max(category.totals.available, 0)
    })
    .reduce((a, b) => a + b, 0)

  return totalAmount
}

/** @param {number} accountId */
async function splitAccount(accountId) {
  for (const key of Object.keys(SINKING_FUNDS[accountId])) {
    createSplitNode(accountId, key, key, "-")
  }

  createSplitNode(accountId, "available-funds", "Available", "-")

  const assets = await getAssets()
  const total = parseFloat(
    assets.find((asset) => asset.id === accountId)?.balance ?? "0",
  )

  let totalSinking = 0

  const promises = Object.entries(SINKING_FUNDS[accountId]).map(
    async ([key, value]) => {
      const sinkingAccounts = assets
        .filter((asset) => value.accounts?.includes(asset.id))
        .map((asset) => parseFloat(asset.balance))
        .reduce((acc, cur) => acc + cur, 0)

      const sinkingCategories = value.categories
        ? await getSinkingCategories(value.categories)
        : 0

      const fund = sinkingAccounts + sinkingCategories + (value.amount ?? 0)
      totalSinking += fund

      createSplitNode(accountId, key, key, formatMoney(fund))
    },
  )

  await Promise.all(promises)

  createSplitNode(
    accountId,
    "available-funds",
    "Available",
    formatMoney(total - totalSinking),
  )
}

/** @param {HTMLElement} node */
function fixAccounts(node) {
  node.querySelectorAll(".card-content-wrapper:has(.caret)").forEach((node) => {
    const title = node.querySelector(".card-text .clickable")?.textContent

    if (title?.endsWith("(1)")) {
      node.nextElementSibling?.querySelector(".hierarchy-line-icon-4")?.remove()
      node.remove()
    }
  })
}

function init() {
  if (window.location.pathname.includes("/overview")) {
    Object.keys(SINKING_FUNDS).forEach((accountId) => {
      const id = parseInt(accountId)
      observe(accountCard(id), () => splitAccount(id))
    })

    observe(
      ".left > .card > .content:has(.card-content-wrapper .account-sub-name)",
      (node) => fixAccounts(node),
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
    if (!(event.target instanceof HTMLElement)) {
      return
    }

    if (event.target.classList.contains(seenMark)) {
      return
    }

    event.target.classList.add(seenMark)
    listener(event.target)
  })
}

/** @typedef {string | Element} HNode */

/**
 * @param {string} tag
 * @param {Record<string, string>} props
 * @param {HNode[]} children
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

/** @param {string} tag */
function makeTag(tag) {
  /**
   * @overload
   * @param {Record<string, string>} props
   * @param {...HNode[]} children
   */

  /**
   * @overload
   * @param {...HNode[]} children
   */

  /**
   * @param {HNode | Record<string, string>} props
   * @param {HNode[]} children
   */
  return function (props, ...children) {
    if (typeof props === "string" || props instanceof Element) {
      return h(tag, {}, [props])
    }

    return h(tag, props, children)
  }
}

/**
 * @template {string} T
 * @param {T[]} tags
 * @returns {Record<T, ReturnType<makeTag>>}
 */
function makeTags(tags) {
  /** @type {any} */
  const acc = {}

  return tags.reduce((acc, tag) => {
    acc[tag] = makeTag(tag)
    return acc
  }, acc)
}
