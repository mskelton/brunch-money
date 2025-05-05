// @ts-check

const { a, div, span, style } = makeTags(["a", "div", "span", "style"])

const ACCOUNTS = {
  ally: 238120,
  loan: 154822,
  summit: 231611,
}

const SINKING_FUNDS = {
  [ACCOUNTS.ally]: {
    accounts: [ACCOUNTS.loan],
    categories: [
      1391931, // Roth IRAs
      1433085, // Car Replacement
    ],
  },
  [ACCOUNTS.summit]: {
    /** @param {BudgetCategory} category */
    categories: (category) => {
      const allyCategories = SINKING_FUNDS[ACCOUNTS.ally].categories
      if (typeof allyCategories === "function") {
        return false
      }

      return (
        category.properties.budget_settings.rollover_option &&
        !allyCategories.includes(category.properties.category.id)
      )
    },
  },
}

/** @param {number} accountId */
const accountCard = (accountId) =>
  `.left > .card > .content > .card-content-wrapper:has(.account-sub-name [href*='account=${accountId}'])`

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
function getAssets() {
  return get("/assets")
}

/**
 * @typedef BudgetOccurrence
 * @property {number} id
 * @property {string} start_date
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
 * @property {BudgetOccurrence[]} occurrences
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
 * @param {number} amount
 */
function createSplitNode(accountId, id, label, amount) {
  const scopedId = `${id}-${accountId}`
  const formattedAmount = formatMoney(amount)
  const existingNode = document.getElementById(scopedId)
  if (existingNode) {
    existingNode.textContent = formattedAmount
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
        span({ class: "account-sub-amount", id: scopedId }, formattedAmount),
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

/** @param {number} accountId */
async function getSinkingCategories(accountId) {
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

  const budget = await getBudget(params)
  let categories = SINKING_FUNDS[accountId].categories

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

      const occurence = category.occurrences.find(
        (occ) => occ.start_date === formatCalendarDate(startDate),
      )

      if (!occurence) {
        return 0
      }

      return Math.max(occurence.available, 0)
    })
    .reduce((a, b) => a + b, 0)

  return totalAmount
}

/** @param {number} accountId */
async function splitAccount(accountId) {
  const assets = await getAssets()
  const total = parseFloat(
    assets.find((asset) => asset.id === accountId)?.balance ?? "0",
  )

  const sinkingAccounts = assets
    .filter((asset) => SINKING_FUNDS[accountId].accounts?.includes(asset.id))
    .map((asset) => parseFloat(asset.balance))
    .reduce((acc, cur) => acc + cur, 0)

  const sinkingCategories = await getSinkingCategories(accountId)

  const reserved = sinkingAccounts + sinkingCategories
  const available = total - reserved

  createSplitNode(accountId, "sinking-funds", "Reserved", reserved)
  createSplitNode(accountId, "available-funds", "Available", available)
}

/** @param {HTMLElement} root */
function fixAccounts(root) {
  root.querySelectorAll(".card-content-wrapper:has(.caret)").forEach((node) => {
    const title = node.querySelector(".card-text .clickable")?.textContent

    if (title?.endsWith("(1)")) {
      node.nextElementSibling?.querySelector(".hierarchy-line-icon-4")?.remove()
      node.remove()
    }
  })
}

function init() {
  if (window.location.pathname.includes("/overview")) {
    observe(accountCard(ACCOUNTS.ally), () => splitAccount(ACCOUNTS.ally))
    observe(accountCard(ACCOUNTS.summit), () => splitAccount(ACCOUNTS.summit))
    observe(
      ".left > .card > .content:has(.card-content-wrapper .account-sub-name)",
      (element) => fixAccounts(element),
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
