const cache = new Map()

async function fetchCategories() {
  if (cache.has("categories")) {
    return cache.get("categories")
  }

  const res = await fetch("https://api-beta.lunchmoney.app/categories", {
    credentials: "include",
  })

  const json = await res.json()
  const categories = json.assignable.map((category) => ({
    ...category,
    name: parseName(category.name),
  }))

  cache.set("categories", categories)
  return categories
}

/** @param {string} name */
function parseName(name) {
  return new DOMParser().parseFromString(name, "text/html").body.textContent
}

/** @param {string} category */
function buildURL(category) {
  const { pathname } = window.location
  const match = pathname.match(/\/budget\/(\d{4})\/(\d{2})\/(\d{2})/)
  if (!match) {
    return null
  }

  const [_, year, month] = match

  return `https://beta.lunchmoney.app/transactions/${year}/${month}?category=${category}&match=all&time=month`
}

async function budgetURLs() {
  const categories = await fetchCategories()
  const cells = document.querySelectorAll(
    ".p-budget-table tbody tr:has(td[colspan='1']:first-child) td:nth-child(3) > div > div:first-child",
  )

  cells.forEach((cell) => {
    const categoryName = cell.textContent
    const category = categories.find((cat) => cat.name === categoryName)
    if (!category) {
      return
    }

    const url = buildURL(category.id)
    if (!url) {
      return
    }

    const link = document.createElement("a")
    link.classList.add("bm-cell")
    link.href = url
    link.textContent = categoryName
    cell.replaceChildren(link)
  })
}

const SINKING_FUNDS = ["Car Replacement", "Roth IRAs"]

function sinkingFunds() {
  const divider = document.querySelector(
    ".right .ui.card .divider:last-of-type",
  )
  if (!divider) {
    return
  }

  const rows = [
    ...document.querySelectorAll(
      ".p-budget-table tbody tr:has(td[colspan='1']:first-child)",
    ),
  ]

  const totalAmount = rows
    .filter((row) => SINKING_FUNDS.includes(row.children[2].textContent))
    .map((row) => {
      const rawValue = row.children[8].textContent
      const value = parseFloat(rawValue.replace(/[$,]/g, ""))
      return value
    })
    .reduce((a, b) => a + b, 0)

  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(totalAmount)

  const sinkingFunds = document.querySelector("#sinking-funds")
  if (sinkingFunds) {
    sinkingFunds.textContent = formattedAmount
    return
  }

  const wrapper = document.createElement("div")
  wrapper.className = "card-content-wrapper"

  const content = document.createElement("div")
  content.className = "card-content no-wrap"

  const label = document.createElement("span")
  label.className = "card-text ellipsis font--bold"
  label.textContent = "Total Sinking Funds"

  const amount = document.createElement("span")
  amount.id = "sinking-funds"
  amount.className = "card-number"
  amount.textContent = formattedAmount

  content.appendChild(label)
  content.appendChild(amount)
  wrapper.appendChild(content)
  divider.after(wrapper)
}

const animation = "bm-selector-observer"

function registerAnimation() {
  if (cache.has(animation)) {
    return
  }

  const style = document.createElement("style")
  style.textContent = `@keyframes ${animation} {}`
  document.head.append(style)
  cache.set(animation, true)
}

function init() {
  observe(".p-budget-table:not(:has(.bm-cell)) tbody tr:first-of-type", () => {
    budgetURLs()
    sinkingFunds()
  })
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

/**
 * @param {string} selector
 * @param {() => void} listener
 */
function observe(selector, listener) {
  const seenMark = `bm-seen-${selector.replace(/[^a-zA-Z0-9]/g, "-")}`
  registerAnimation()

  const rule = document.createElement("style")
  rule.textContent = `
    :where(${String(selector)}):not(.${seenMark}) {
      animation: 1ms ${animation};
    }
  `
  document.body.prepend(rule)

  globalThis.addEventListener("animationstart", (event) => {
    if (event.target.classList.contains(seenMark)) {
      return
    }

    event.target.classList.add(seenMark)
    listener(event.target)
  })
}
