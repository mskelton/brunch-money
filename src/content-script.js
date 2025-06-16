// @ts-check

const { a, div, span, style } = makeTags(["a", "div", "span", "style"])

const ACCOUNTS = {
  ally: 238120,
  loan: 154822,
  summit: 231611,
  chase: 231609,
}

const CATEGORIES = {
  income: 1391926,
  salary: 1391925,
  interest: 1391927,
  otherIncome: 1391928,
  giving: 1391942,
  lordsWork: 1391929,
  givingToOthers: 1391921,
  christmasGifts: 1391930,
  savings: 1391943,
  rothIras: 1391931,
  brokerageAccounts: 1391932,
  housing: 1391944,
  mortgage: 1391933,
  homeImprovement: 1391934,
  household: 1391935,
  electric: 1391936,
  gas: 1391938,
  waterSewerTrash: 1391937,
  internet: 1391939,
  cellPhone: 1391940,
  transportation: 1391945,
  autoGasOil: 1391920,
  carRepairs: 1391941,
  carReplacement: 1433085,
  food: 1391946,
  groceries: 1391922,
  restaurantsSnacks: 1391924,
  lifestyle: 1391956,
  clothing: 1391947,
  health: 1391948,
  personalCareProducts: 1391923,
  sportsEntertainment: 1391919,
  electronics: 1391949,
  subscriptions: 1391950,
  vacations: 1391952,
  marriage: 1391951,
  funMoneyMark: 1391953,
  funMoneyYanna: 1391954,
  miscellaneous: 1391955,
  insuranceTax: 1391961,
  homeownersInsurance: 1497458,
  autoInsuranceLicensing: 1391957,
  healthInsurance: 1391958,
  lifeInsurance: 1391959,
  propertyTaxes: 1391960,
  transfers: 1391964,
  paymentTransfer: 1394068,
  balanceAdjustment: 1391963,
}

const SINKING_FUNDS = {
  [ACCOUNTS.ally]: {
    accounts: [ACCOUNTS.loan],
    categories: [
      CATEGORIES.rothIras,
      CATEGORIES.carReplacement,
      CATEGORIES.homeImprovement,
    ],
  },
  [ACCOUNTS.summit]: {
    accounts: [ACCOUNTS.chase],
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

/** @param {number} accountId */
async function getSinkingCategories(accountId) {
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

      return Math.max(category.totals.available, 0)
    })
    .reduce((a, b) => a + b, 0)

  return totalAmount
}

/** @param {number} accountId */
async function splitAccount(accountId) {
  createSplitNode(accountId, "sinking-funds", "Reserved", "-")
  createSplitNode(accountId, "available-funds", "Available", "-")

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

  createSplitNode(accountId, "sinking-funds", "Reserved", formatMoney(reserved))
  createSplitNode(
    accountId,
    "available-funds",
    "Available",
    formatMoney(available),
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
    observe(accountCard(ACCOUNTS.ally), () => splitAccount(ACCOUNTS.ally))
    observe(accountCard(ACCOUNTS.summit), () => splitAccount(ACCOUNTS.summit))
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
