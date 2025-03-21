async function fetchCategories() {
  const res = await fetch("https://api-beta.lunchmoney.app/categories", {
    credentials: "include",
  })
  const json = await res.json()

  return json.assignable.map((category) => ({
    ...category,
    name: parseName(category.name),
  }))
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
    link.href = url
    link.textContent = categoryName
    cell.replaceChildren(link)
  })
}

const notRun = Symbol("false")
const animation = "brunch-money-selector-observer"
const registerAnimation = onetime(() => {
  const style = document.createElement("style")
  style.textContent = `@keyframes ${animation} {}`
  document.head.append(style)
})

observe(".p-budget-table:has(.padded-cell)", () => {
  budgetURLs()
})

/**
 * @param {string} selector
 * @param {() => void} listener
 */
function observe(selector, listener) {
  const seenMark = `brunch-money-seen-${selector}`

  registerAnimation()

  const rule = document.createElement("style")
  rule.textContent = `
    :where(${String(selector)}):not(.${seenMark}) {
      animation: 1ms ${animation};
    }
  `
  document.body.prepend(rule)

  globalThis.addEventListener("animationstart", (event) => {
    const target = event.target
    // The target can match a selector even if the animation actually happened on a ::before pseudo-element, so it needs an explicit exclusion here
    if (target.classList.contains(seenMark) || !target.matches(selector)) {
      return
    }

    // Removes this specific selector’s animation once it was seen
    target.classList.add(seenMark)

    listener(target)
  })
}

/** @param {() => void} fn */
function onetime(fn) {
  let returnValue = notRun

  return function (...args) {
    if (returnValue !== notRun) {
      return returnValue
    }

    returnValue = Reflect.apply(fn, this, args)
    return returnValue
  }
}
