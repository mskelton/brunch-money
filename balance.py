def function():
    import os
    import requests
    from datetime import datetime, timedelta

    api_key = os.getenv("LUNCH_MONEY_API_KEY")

    headers = {"Authorization": f"Bearer {api_key}"}
    base_url = "https://api.lunchmoney.dev/v2"

    ally_savings_id = 238120
    chase_id = 231609
    emergency_fund = 30000
    threshold = 15000

    sinking_categories = [
        1391920,  # Auto Gas & Oil
        1391957,  # Auto Insurance & Licensing
        # 1391963,  # Balance Adjustment
        1391941,  # Car Repairs
        1433085,  # Car Replacement
        1391940,  # Cell Phone
        1391930,  # Christmas
        1391947,  # Clothing
        1391936,  # Electric
        1391949,  # Electronics
        1576410,  # Family
        1391953,  # Fun Money - Mark
        1391954,  # Fun Money - Yanna
        # 1391942,  # Giving
        1391921,  # Giving to Others
        1391922,  # Groceries
        1391948,  # Health
        # 1391958,  # Health Insurance
        1391934,  # Home Improvement
        1497458,  # Homeowners Insurance
        1391935,  # Household
        # 1391944,  # Housing
        # 1391926,  # Income
        # 1391961,  # Insurance & Tax
        # 1391927,  # Interest
        # 1391939,  # Internet
        1391959,  # Life Insurance
        # 1391956,  # Lifestyle
        # 1391932,  # Long Term Savings (Brokerage accounts)
        1391929,  # Lord's Work
        1391951,  # Marriage
        1391955,  # Miscellaneous
        # 1391933,  # Mortgage
        1391938,  # Natural Gas
        # 1391928,  # Other Income
        # 1394068,  # Payment, Transfer
        1391923,  # Personal Care Products
        # 1391950,  # Personal Development
        1557406,  # Professional Development
        1391960,  # Property Taxes
        # 1585212,  # Reimbursements
        1391924,  # Restaurants/Snacks
        1391931,  # Retirement Savings (Roth IRAs)
        # 1391925,  # Salary
        # 1391943,  # Savings
        1391919,  # Sports/Entertainment
        # 1391964,  # Transfers
        # 1391945,  # Transportation
        1563762,  # Umbrella Insurance
        1391952,  # Vacations
        1391937,  # Water/Sewer/Trash
    ]

    # Get the Ally Savings asset balance
    asset_response = requests.get(
        f"{base_url}/plaid_accounts/{ally_savings_id}", headers=headers
    )
    asset_response.raise_for_status()
    total_balance = float(asset_response.json().get("balance", 0))

    # Get Chase account balance (part of sinking funds)
    chase_response = requests.get(
        f"{base_url}/plaid_accounts/{chase_id}", headers=headers
    )
    chase_response.raise_for_status()
    chase_balance = float(chase_response.json().get("balance", 0))

    # Get budget summary for current month
    today = datetime.now()
    start_date = today.replace(day=1).strftime("%Y-%m-%d")
    if today.month == 12:
        last_day = datetime(today.year + 1, 1, 1) - timedelta(days=1)
    else:
        last_day = datetime(today.year, today.month + 1, 1) - timedelta(days=1)
    end_date = last_day.strftime("%Y-%m-%d")

    summary_response = requests.get(
        f"{base_url}/summary",
        headers=headers,
        params={
            "start_date": start_date,
            "end_date": end_date,
            "include_totals": "false",
            "include_occurrences": "true",
        },
    )
    summary_response.raise_for_status()
    budget = summary_response.json()

    # Sum up categories with rollover_option set (sinking fund categories)
    sinking_categories_total = sum(
        max(
            cat.get("totals", {}).get("available", 0) or 0,
            cat.get("totals", {}).get("budgeted", 0) or 0,
        )
        for cat in budget.get("categories", [])
        if cat.get("category_id") in sinking_categories
    )

    # Available = total balance - chase - sinking categories - emergency fund
    available = (
        total_balance - chase_balance - sinking_categories_total - emergency_fund
    )

    should_send = available > threshold

    return should_send


if __name__ == "__main__":
    print(function())
