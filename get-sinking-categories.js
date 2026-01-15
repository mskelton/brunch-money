async function getSinkingCategories() {
  const today = new Date();
  const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
  const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const params = new URLSearchParams({
    start_date: formatDate(startDate),
    end_date: formatDate(endDate),
    include_totals: "true",
    strict_dates: "true",
  });

  const res = await fetch(`https://api-beta.lunchmoney.app/summary?${params}`, {
    method: "GET",
    credentials: "include",
  });

  const budget = await res.json();

  const ids = budget.categories
    .filter(cat => cat.properties.budget_settings.rollover_option)
    .map(cat => ({
      id: cat.properties.category.id,
      name: cat.properties.category.name,
    })).map(cat => `${cat.id},`).join("\n");

  return ids;
}

console.log(await getSinkingCategories());
