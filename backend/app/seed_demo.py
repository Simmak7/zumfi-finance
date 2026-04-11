"""Seed demo data for Zumfi Finance App - test@me account"""
import requests
import json
from datetime import datetime, timedelta

API = "http://localhost:8001"

# Login
r = requests.post(f"{API}/auth/login", json={"email": "test@me", "password": "Testme2026!"})
TOKEN = r.json()["access_token"]
H = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
print(f"Logged in. Token: {TOKEN[:20]}...")

# --- SETTINGS ---
print("\n=== SETTINGS ===")
r = requests.put(f"{API}/settings", headers=H, json={
    "preferred_currency": "CZK",
    "language": "en",
    "show_zumfi_rabbit": True
})
print(f"Settings: {r.status_code}")

# --- ACCOUNTS ---
print("\n=== ACCOUNTS ===")
accounts = {}
for acc in [
    {"name": "Main Account", "bank_name": "Raiffeisen", "currency": "CZK", "account_type": "checking", "is_default": True},
    {"name": "Travel Card", "bank_name": "Revolut", "currency": "EUR", "account_type": "checking", "is_default": False},
    {"name": "Savings", "bank_name": "ČSOB", "currency": "CZK", "account_type": "savings", "is_default": False},
]:
    r = requests.post(f"{API}/accounts/", headers=H, json=acc)
    data = r.json()
    accounts[acc["name"]] = data["id"]
    print(f"  Account '{acc['name']}': id={data['id']}")

MAIN_ACC = accounts["Main Account"]
REVOLUT_ACC = accounts["Travel Card"]

# --- CATEGORIES ---
print("\n=== CATEGORIES ===")
r = requests.post(f"{API}/categories/seed-defaults", headers=H)
print(f"Seed defaults: {r.status_code} - {r.json()}")

r = requests.get(f"{API}/categories/", headers=H)
categories = {c["name"]: c for c in r.json()}
print(f"  Categories loaded: {len(categories)}")

# Get category IDs by name
def cat_id(name):
    return categories.get(name, {}).get("id")

# --- TRANSACTIONS ---
print("\n=== TRANSACTIONS ===")
# We insert transactions directly via the database since the upload endpoint expects files.
# Instead, we'll use the imports/excel-history or create statements + transactions via SQL.
# The simplest approach: use the /imports/execute approach with a temp CSV.

# Actually, let's insert via direct SQL through the backend container
# We'll create statements and transactions for each month

import csv
import io
import os
import tempfile

# Monthly transaction templates - realistic Czech finance
# Income ~85,000 CZK/month
monthly_transactions = {
    "2025-09": [
        # Income
        ("2025-09-05", "Salary - TechCorp s.r.o.", 85000, "income", "Salary"),
        ("2025-09-15", "Freelance project - Website redesign", 12000, "income", "Freelance"),
        # Fixed costs
        ("2025-09-01", "Mortgage payment - Hypoteční banka", -15800, "expense", "Mortgage"),
        ("2025-09-05", "Electricity - ČEZ", -2350, "expense", "Electricity"),
        ("2025-09-05", "Internet - O2", -699, "expense", "Internet"),
        ("2025-09-06", "Phone - T-Mobile", -549, "expense", "Phone"),
        ("2025-09-07", "Netflix subscription", -319, "expense", "Subscriptions"),
        ("2025-09-07", "Spotify Premium", -169, "expense", "Subscriptions"),
        ("2025-09-10", "Gym - John Reed Fitness", -990, "expense", "Gym"),
        # Groceries
        ("2025-09-02", "Albert hypermarket", -1850, "expense", "Groceries"),
        ("2025-09-08", "Lidl - weekly shopping", -1320, "expense", "Groceries"),
        ("2025-09-14", "Billa supermarket", -980, "expense", "Groceries"),
        ("2025-09-20", "Kaufland groceries", -2100, "expense", "Groceries"),
        ("2025-09-26", "Albert - food shopping", -1560, "expense", "Groceries"),
        # Restaurants & cafes
        ("2025-09-03", "Lokál Dlouhá - lunch", -385, "expense", "Restaurants"),
        ("2025-09-11", "Starbucks Coffee", -145, "expense", "Coffee"),
        ("2025-09-16", "Ambiente Brasileiro - dinner", -890, "expense", "Restaurants"),
        ("2025-09-22", "Café Savoy - brunch", -520, "expense", "Coffee"),
        ("2025-09-28", "U Fleků - dinner with friends", -750, "expense", "Restaurants"),
        # Transport
        ("2025-09-01", "Lítačka - monthly pass", -550, "expense", "Transport"),
        ("2025-09-12", "Bolt taxi", -189, "expense", "Transport"),
        ("2025-09-25", "Shell - fuel", -1400, "expense", "Transport"),
        # Shopping & personal
        ("2025-09-09", "Zara - autumn jacket", -2490, "expense", "Clothing"),
        ("2025-09-18", "DM drogerie", -450, "expense", "Health"),
        ("2025-09-21", "Cinema City - movie tickets", -398, "expense", "Entertainment"),
        # Insurance
        ("2025-09-15", "Health insurance supplement - VZP", -1800, "expense", "Insurance"),
    ],
    "2025-10": [
        ("2025-10-05", "Salary - TechCorp s.r.o.", 85000, "income", "Salary"),
        ("2025-10-01", "Mortgage payment - Hypoteční banka", -15800, "expense", "Mortgage"),
        ("2025-10-05", "Electricity - ČEZ", -2580, "expense", "Electricity"),
        ("2025-10-05", "Internet - O2", -699, "expense", "Internet"),
        ("2025-10-06", "Phone - T-Mobile", -549, "expense", "Phone"),
        ("2025-10-07", "Netflix subscription", -319, "expense", "Subscriptions"),
        ("2025-10-07", "Spotify Premium", -169, "expense", "Subscriptions"),
        ("2025-10-10", "Gym - John Reed Fitness", -990, "expense", "Gym"),
        ("2025-10-03", "Albert hypermarket", -2150, "expense", "Groceries"),
        ("2025-10-09", "Lidl - weekly shopping", -1480, "expense", "Groceries"),
        ("2025-10-15", "Tesco - big shopping", -2350, "expense", "Groceries"),
        ("2025-10-22", "Billa supermarket", -1100, "expense", "Groceries"),
        ("2025-10-28", "Kaufland groceries", -1890, "expense", "Groceries"),
        ("2025-10-04", "Café Imperial - brunch", -680, "expense", "Coffee"),
        ("2025-10-12", "Kantýna - lunch", -320, "expense", "Restaurants"),
        ("2025-10-19", "Eska restaurant - dinner", -1250, "expense", "Restaurants"),
        ("2025-10-26", "Costa Coffee", -125, "expense", "Coffee"),
        ("2025-10-01", "Lítačka - monthly pass", -550, "expense", "Transport"),
        ("2025-10-08", "Bolt taxi", -215, "expense", "Transport"),
        ("2025-10-20", "Shell - fuel", -1350, "expense", "Transport"),
        ("2025-10-11", "Alza.cz - USB-C hub", -890, "expense", "Electronics"),
        ("2025-10-17", "Lékárna - pharmacy", -380, "expense", "Health"),
        ("2025-10-24", "Book - Martinus.cz", -349, "expense", "Entertainment"),
        ("2025-10-15", "Health insurance supplement - VZP", -1800, "expense", "Insurance"),
        ("2025-10-30", "Veterinarian - cat checkup", -1200, "expense", "Health"),
    ],
    "2025-11": [
        ("2025-11-05", "Salary - TechCorp s.r.o.", 85000, "income", "Salary"),
        ("2025-11-20", "Freelance - API integration", 8500, "income", "Freelance"),
        ("2025-11-01", "Mortgage payment - Hypoteční banka", -15800, "expense", "Mortgage"),
        ("2025-11-05", "Electricity - ČEZ", -2890, "expense", "Electricity"),
        ("2025-11-05", "Internet - O2", -699, "expense", "Internet"),
        ("2025-11-06", "Phone - T-Mobile", -549, "expense", "Phone"),
        ("2025-11-07", "Netflix subscription", -319, "expense", "Subscriptions"),
        ("2025-11-07", "Spotify Premium", -169, "expense", "Subscriptions"),
        ("2025-11-10", "Gym - John Reed Fitness", -990, "expense", "Gym"),
        ("2025-11-02", "Albert hypermarket", -1950, "expense", "Groceries"),
        ("2025-11-09", "Lidl - weekly shopping", -1680, "expense", "Groceries"),
        ("2025-11-16", "Globus - big shopping", -2780, "expense", "Groceries"),
        ("2025-11-23", "Billa supermarket", -1350, "expense", "Groceries"),
        ("2025-11-29", "Albert - food shopping", -1420, "expense", "Groceries"),
        ("2025-11-05", "Maitrea restaurant - lunch", -410, "expense", "Restaurants"),
        ("2025-11-13", "Starbucks Coffee", -155, "expense", "Coffee"),
        ("2025-11-18", "La Degustation - anniversary dinner", -3200, "expense", "Restaurants"),
        ("2025-11-25", "Kavárna co hledá jméno", -190, "expense", "Coffee"),
        ("2025-11-01", "Lítačka - monthly pass", -550, "expense", "Transport"),
        ("2025-11-14", "Uber taxi", -245, "expense", "Transport"),
        ("2025-11-22", "Shell - fuel", -1500, "expense", "Transport"),
        ("2025-11-08", "IKEA - shelves and lamp", -3450, "expense", "Home"),
        ("2025-11-15", "DM drogerie - cosmetics", -520, "expense", "Health"),
        ("2025-11-27", "National Theatre - tickets", -680, "expense", "Entertainment"),
        ("2025-11-15", "Health insurance supplement - VZP", -1800, "expense", "Insurance"),
    ],
    "2025-12": [
        ("2025-12-05", "Salary - TechCorp s.r.o.", 85000, "income", "Salary"),
        ("2025-12-20", "Year-end bonus - TechCorp", 42000, "income", "Salary"),
        ("2025-12-01", "Mortgage payment - Hypoteční banka", -15800, "expense", "Mortgage"),
        ("2025-12-05", "Electricity - ČEZ", -3100, "expense", "Electricity"),
        ("2025-12-05", "Internet - O2", -699, "expense", "Internet"),
        ("2025-12-06", "Phone - T-Mobile", -549, "expense", "Phone"),
        ("2025-12-07", "Netflix subscription", -319, "expense", "Subscriptions"),
        ("2025-12-07", "Spotify Premium", -169, "expense", "Subscriptions"),
        ("2025-12-10", "Gym - John Reed Fitness", -990, "expense", "Gym"),
        ("2025-12-03", "Albert hypermarket", -2450, "expense", "Groceries"),
        ("2025-12-10", "Lidl - weekly shopping", -1890, "expense", "Groceries"),
        ("2025-12-17", "Tesco - Christmas shopping", -4200, "expense", "Groceries"),
        ("2025-12-22", "Billa - holiday food", -3100, "expense", "Groceries"),
        ("2025-12-06", "Manifesto Market - dinner", -950, "expense", "Restaurants"),
        ("2025-12-14", "Café Louvre - brunch", -620, "expense", "Coffee"),
        ("2025-12-20", "V Zátiší - Christmas dinner", -2800, "expense", "Restaurants"),
        ("2025-12-28", "U Medvídků - beer & dinner", -580, "expense", "Restaurants"),
        ("2025-12-01", "Lítačka - monthly pass", -550, "expense", "Transport"),
        ("2025-12-15", "Bolt taxi - airport", -450, "expense", "Transport"),
        ("2025-12-18", "Shell - fuel", -1600, "expense", "Transport"),
        # Christmas gifts & holiday spending
        ("2025-12-08", "Palladium - Christmas gifts", -5800, "expense", "Gifts"),
        ("2025-12-12", "Alza.cz - headphones gift", -3200, "expense", "Gifts"),
        ("2025-12-16", "Christmas tree & decorations", -1200, "expense", "Home"),
        ("2025-12-24", "Christmas market - food & drinks", -850, "expense", "Entertainment"),
        ("2025-12-15", "Health insurance supplement - VZP", -1800, "expense", "Insurance"),
        ("2025-12-30", "NYE party supplies", -1500, "expense", "Entertainment"),
    ],
    "2026-01": [
        ("2026-01-05", "Salary - TechCorp s.r.o.", 85000, "income", "Salary"),
        ("2026-01-01", "Mortgage payment - Hypoteční banka", -15800, "expense", "Mortgage"),
        ("2026-01-05", "Electricity - ČEZ", -3200, "expense", "Electricity"),
        ("2026-01-05", "Internet - O2", -699, "expense", "Internet"),
        ("2026-01-06", "Phone - T-Mobile", -549, "expense", "Phone"),
        ("2026-01-07", "Netflix subscription", -319, "expense", "Subscriptions"),
        ("2026-01-07", "Spotify Premium", -169, "expense", "Subscriptions"),
        ("2026-01-10", "Gym - John Reed Fitness", -990, "expense", "Gym"),
        ("2026-01-04", "Albert hypermarket", -1780, "expense", "Groceries"),
        ("2026-01-11", "Lidl - weekly shopping", -1450, "expense", "Groceries"),
        ("2026-01-18", "Kaufland groceries", -2050, "expense", "Groceries"),
        ("2026-01-25", "Billa supermarket", -1320, "expense", "Groceries"),
        ("2026-01-06", "Lokál Dlouhá - lunch", -350, "expense", "Restaurants"),
        ("2026-01-14", "Starbucks Coffee", -145, "expense", "Coffee"),
        ("2026-01-20", "SaSaZu - dinner", -1100, "expense", "Restaurants"),
        ("2026-01-27", "Kavárna Místo", -165, "expense", "Coffee"),
        ("2026-01-01", "Lítačka - monthly pass", -550, "expense", "Transport"),
        ("2026-01-09", "Uber taxi", -198, "expense", "Transport"),
        ("2026-01-22", "Shell - fuel", -1450, "expense", "Transport"),
        ("2026-01-08", "New Year sale - winter boots", -1890, "expense", "Clothing"),
        ("2026-01-16", "Lékárna - vitamins", -590, "expense", "Health"),
        ("2026-01-23", "O2 Arena - concert tickets", -1600, "expense", "Entertainment"),
        ("2026-01-15", "Health insurance supplement - VZP", -1800, "expense", "Insurance"),
        ("2026-01-30", "Car service - annual checkup", -4500, "expense", "Transport"),
    ],
    "2026-02": [
        ("2026-02-05", "Salary - TechCorp s.r.o.", 85000, "income", "Salary"),
        ("2026-02-18", "Freelance - mobile app consulting", 15000, "income", "Freelance"),
        ("2026-02-01", "Mortgage payment - Hypoteční banka", -15800, "expense", "Mortgage"),
        ("2026-02-05", "Electricity - ČEZ", -2950, "expense", "Electricity"),
        ("2026-02-05", "Internet - O2", -699, "expense", "Internet"),
        ("2026-02-06", "Phone - T-Mobile", -549, "expense", "Phone"),
        ("2026-02-07", "Netflix subscription", -319, "expense", "Subscriptions"),
        ("2026-02-07", "Spotify Premium", -169, "expense", "Subscriptions"),
        ("2026-02-10", "Gym - John Reed Fitness", -990, "expense", "Gym"),
        ("2026-02-03", "Albert hypermarket", -1920, "expense", "Groceries"),
        ("2026-02-10", "Lidl - weekly shopping", -1350, "expense", "Groceries"),
        ("2026-02-17", "Tesco - shopping", -1980, "expense", "Groceries"),
        ("2026-02-24", "Billa supermarket", -1150, "expense", "Groceries"),
        ("2026-02-04", "Sisters Bistro - lunch", -420, "expense", "Restaurants"),
        ("2026-02-12", "Costa Coffee", -135, "expense", "Coffee"),
        ("2026-02-14", "La Bottega - Valentine dinner", -2400, "expense", "Restaurants"),
        ("2026-02-22", "Café Savoy - weekend brunch", -550, "expense", "Coffee"),
        ("2026-02-01", "Lítačka - monthly pass", -550, "expense", "Transport"),
        ("2026-02-11", "Bolt taxi", -175, "expense", "Transport"),
        ("2026-02-20", "Shell - fuel", -1380, "expense", "Transport"),
        ("2026-02-08", "Sephora - Valentine gift", -1800, "expense", "Gifts"),
        ("2026-02-14", "Flowers - Valentine's Day", -890, "expense", "Gifts"),
        ("2026-02-19", "DM drogerie", -380, "expense", "Health"),
        ("2026-02-26", "Lucerna cinema - movie night", -450, "expense", "Entertainment"),
        ("2026-02-15", "Health insurance supplement - VZP", -1800, "expense", "Insurance"),
    ],
}

# Create transactions via CSV import for each month
for month, txns in monthly_transactions.items():
    print(f"\n--- {month} ---")

    # Build CSV content
    csv_content = "date,description,amount,type,category\n"
    for date, desc, amount, tx_type, category in txns:
        csv_content += f"{date},{desc},{amount},{tx_type},{category}\n"

    # Write to temp file
    tmp_path = f"/tmp/txns_{month.replace('-','_')}.csv"
    with open(tmp_path, 'w') as f:
        f.write(csv_content)

    # Upload
    with open(tmp_path, 'rb') as f:
        r = requests.post(
            f"{API}/imports/upload",
            headers={"Authorization": f"Bearer {TOKEN}"},
            files={"file": (f"transactions_{month}.csv", f, "text/csv")}
        )
    upload = r.json()
    print(f"  Upload: {r.status_code} - {upload.get('filename', 'error')}, rows: {upload.get('total_rows', 'N/A')}")

    if r.status_code != 200 or "filename" not in upload:
        print(f"  ERROR: {upload}")
        continue

    # Execute import
    mapping = {
        "date_column": "date",
        "description_column": "description",
        "amount_column": "amount",
        "type_column": "type",
        "category_column": "category"
    }

    r = requests.post(f"{API}/imports/execute", headers=H, json={
        "filename": upload["filename"],
        "mapping": mapping,
        "date_format": "%Y-%m-%d",
        "decimal_separator": ".",
        "account_id": MAIN_ACC,
        "default_currency": "CZK"
    })
    result = r.json()
    print(f"  Import: {r.status_code} - imported: {result.get('transactions_imported', 'N/A')}, skipped: {result.get('transactions_skipped', 'N/A')}")

# Confirm all transactions
print("\n=== CONFIRMING TRANSACTIONS ===")
r = requests.get(f"{API}/transactions/search?limit=500&status=review", headers=H)
if r.status_code == 200:
    data = r.json()
    txns = data.get("transactions", data) if isinstance(data, dict) else data
    if isinstance(txns, list) and len(txns) > 0:
        tx_ids = [t["id"] for t in txns]
        # Bulk update in batches
        for i in range(0, len(tx_ids), 50):
            batch = tx_ids[i:i+50]
            r2 = requests.post(f"{API}/transactions/bulk-update", headers=H, json={
                "transaction_ids": batch,
                "status": "confirmed",
                "category_name": None
            })
            print(f"  Confirmed batch {i//50 + 1}: {r2.status_code}")

# Also classify by their category names
r = requests.get(f"{API}/transactions/search?limit=500&sort_by=date&sort_order=desc", headers=H)
search_data = r.json()
all_txns = search_data.get("transactions", []) if isinstance(search_data, dict) else search_data
print(f"  Total transactions: {len(all_txns)}")

# --- BUDGETS ---
print("\n=== BUDGETS ===")
# Get categories to map names to IDs
r = requests.get(f"{API}/categories/", headers=H)
cats = {c["name"]: c["id"] for c in r.json()}

budget_template = {
    "Groceries": 9000,
    "Restaurants": 3000,
    "Coffee": 800,
    "Transport": 3500,
    "Subscriptions": 600,
    "Electricity": 3000,
    "Internet": 700,
    "Phone": 600,
    "Gym": 1000,
    "Clothing": 2000,
    "Health": 1500,
    "Entertainment": 1500,
    "Home": 2000,
    "Insurance": 2000,
    "Gifts": 1000,
    "Electronics": 1000,
    "Mortgage": 16000,
}

for month in ["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02"]:
    created = 0
    for cat_name, amount in budget_template.items():
        cid = cats.get(cat_name)
        if not cid:
            continue
        # Slight variation per month
        import random
        variation = random.uniform(0.95, 1.05)
        adj_amount = round(amount * variation / 100) * 100

        r = requests.post(f"{API}/budgets/", headers=H, json={
            "category_id": cid,
            "month": month,
            "planned_amount": adj_amount
        })
        if r.status_code == 200:
            created += 1
    print(f"  {month}: {created} budgets created")

# --- GOALS ---
print("\n=== GOALS ===")
goals_data = [
    {"name": "Emergency Fund", "target_amount": 150000, "current_amount": 92000, "monthly_allocation": 5000, "color": "#4CAF50", "deadline": "2026-12-31"},
    {"name": "Summer Vacation 2026", "target_amount": 50000, "current_amount": 21000, "monthly_allocation": 4000, "color": "#2196F3", "deadline": "2026-06-30"},
    {"name": "New Car Fund", "target_amount": 300000, "current_amount": 35000, "monthly_allocation": 8000, "color": "#FF9800", "deadline": "2027-12-31"},
    {"name": "MacBook Pro M5", "target_amount": 65000, "current_amount": 48000, "monthly_allocation": 6000, "color": "#9C27B0", "deadline": "2026-05-31"},
]
goal_ids = []
for g in goals_data:
    r = requests.post(f"{API}/goals/", headers=H, json=g)
    data = r.json()
    gid = data.get("id")
    goal_ids.append(gid)
    print(f"  Goal '{g['name']}': id={gid} - {r.status_code}")
    # Set monthly_allocation (not in GoalCreate schema)
    if gid and g.get("monthly_allocation"):
        requests.put(f"{API}/goals/{gid}", headers=H, json={"monthly_allocation": g["monthly_allocation"]})

# Backdate goals so they appear in allocation suggestions for historical months
r = requests.post(f"{API}/goals/seed-backdate", headers=H, json={"created_at": "2025-08-15T10:00:00"})
print(f"  Goals backdated: {r.status_code}")

# --- BILLS ---
print("\n=== BILLS ===")
bills_data = [
    {"name": "Electricity - ČEZ", "expected_amount": 2800, "frequency": "monthly", "due_day": 5, "category_id": cats.get("Electricity")},
    {"name": "Internet - O2", "expected_amount": 699, "frequency": "monthly", "due_day": 5, "category_id": cats.get("Internet")},
    {"name": "Phone - T-Mobile", "expected_amount": 549, "frequency": "monthly", "due_day": 6, "category_id": cats.get("Phone")},
    {"name": "Netflix", "expected_amount": 319, "frequency": "monthly", "due_day": 7, "category_id": cats.get("Subscriptions")},
    {"name": "Spotify Premium", "expected_amount": 169, "frequency": "monthly", "due_day": 7, "category_id": cats.get("Subscriptions")},
    {"name": "Gym - John Reed", "expected_amount": 990, "frequency": "monthly", "due_day": 10, "category_id": cats.get("Gym")},
    {"name": "Health Insurance - VZP", "expected_amount": 1800, "frequency": "monthly", "due_day": 15, "category_id": cats.get("Insurance")},
    {"name": "Lítačka Transport Pass", "expected_amount": 550, "frequency": "monthly", "due_day": 1, "category_id": cats.get("Transport")},
]
for b in bills_data:
    if b["category_id"] is None:
        print(f"  SKIP '{b['name']}' - category not found")
        continue
    r = requests.post(f"{API}/bills/", headers=H, json=b)
    print(f"  Bill '{b['name']}': {r.status_code}")

# --- MORTGAGE ---
print("\n=== MORTGAGE ===")
mortgage_data = {
    "name": "Apartment Prague 5 - Hypoteční banka",
    "original_amount": 3500000,
    "interest_rate": 3.49,
    "term_months": 300,
    "monthly_payment": 15800,
    "start_date": "2023-06-01",
    "extra_payments": 0,
    "category_id": cats.get("Mortgage"),
    "currency": "CZK",
    "fix_end_date": "2028-06-01"
}
r = requests.post(f"{API}/bills/mortgages", headers=H, json=mortgage_data)
mortgage = r.json()
mortgage_id = mortgage.get("id")
print(f"  Mortgage created: id={mortgage_id} - {r.status_code}")
if r.status_code != 200:
    print(f"  ERROR: {mortgage}")

# --- PORTFOLIO: SAVINGS ---
print("\n=== PORTFOLIO: SAVINGS ===")
savings_data = [
    {"name": "Raiffeisen Savings", "institution": "Raiffeisen Bank", "balance": 185000, "interest_rate": 4.5, "currency": "CZK", "notes": "Emergency savings", "color": "#FFD700"},
    {"name": "ČSOB Term Deposit", "institution": "ČSOB", "balance": 250000, "interest_rate": 5.2, "currency": "CZK", "notes": "12-month term deposit, matures Dec 2026", "color": "#1976D2"},
    {"name": "Revolut Savings Vault", "institution": "Revolut", "balance": 1200, "interest_rate": 3.36, "currency": "EUR", "notes": "Travel fund", "color": "#7C4DFF"},
]
for s in savings_data:
    r = requests.post(f"{API}/portfolio/savings", headers=H, json=s)
    print(f"  Savings '{s['name']}': {r.status_code}")

# --- PORTFOLIO: INVESTMENTS (ETFs) ---
print("\n=== PORTFOLIO: INVESTMENTS ===")
investments_data = [
    {"name": "Vanguard S&P 500 ETF", "ticker": "VOO", "investment_type": "etf", "units": 3.5, "avg_purchase_price": 420.50, "current_price": 478.30, "currency": "USD", "notes": "Core US market exposure", "color": "#4CAF50"},
    {"name": "iShares MSCI World", "ticker": "IWDA", "investment_type": "etf", "units": 25, "avg_purchase_price": 78.40, "current_price": 89.15, "currency": "EUR", "notes": "Global diversification", "color": "#2196F3"},
    {"name": "Xtrackers Euro Stoxx 50", "ticker": "XESC", "investment_type": "etf", "units": 40, "avg_purchase_price": 52.80, "current_price": 56.20, "currency": "EUR", "notes": "European blue chips", "color": "#FF9800"},
]
for inv in investments_data:
    r = requests.post(f"{API}/portfolio/investments", headers=H, json=inv)
    print(f"  Investment '{inv['name']}': {r.status_code}")

# --- PORTFOLIO: STOCKS ---
print("\n=== PORTFOLIO: STOCKS ===")
stocks_data = [
    {"name": "Apple Inc.", "ticker": "AAPL", "holding_type": "stock", "shares": 8, "avg_cost_per_share": 178.50, "current_price": 228.40, "currency": "USD", "notes": "Long-term hold", "color": "#A8A8A8"},
    {"name": "Microsoft Corp.", "ticker": "MSFT", "holding_type": "stock", "shares": 5, "avg_cost_per_share": 340.20, "current_price": 415.80, "currency": "USD", "notes": "Tech portfolio core", "color": "#00BCF2"},
    {"name": "NVIDIA Corp.", "ticker": "NVDA", "holding_type": "stock", "shares": 10, "avg_cost_per_share": 95.80, "current_price": 138.50, "currency": "USD", "notes": "AI & GPU leader", "color": "#76B900"},
    {"name": "Alphabet Inc.", "ticker": "GOOGL", "holding_type": "stock", "shares": 12, "avg_cost_per_share": 142.30, "current_price": 178.90, "currency": "USD", "notes": "Search & cloud", "color": "#4285F4"},
    {"name": "ASML Holding", "ticker": "ASML", "holding_type": "stock", "shares": 2, "avg_cost_per_share": 680.00, "current_price": 745.50, "currency": "EUR", "notes": "European tech leader", "color": "#0077C8"},
    {"name": "Komerční banka", "ticker": "KOMB.PR", "holding_type": "stock", "shares": 30, "avg_cost_per_share": 820.00, "current_price": 895.00, "currency": "CZK", "notes": "Czech banking sector", "color": "#C62828"},
]
for st in stocks_data:
    r = requests.post(f"{API}/portfolio/stocks", headers=H, json=st)
    print(f"  Stock '{st['name']}': {r.status_code}")

# --- PORTFOLIO: PROPERTY ---
print("\n=== PORTFOLIO: PROPERTY ===")
property_data = {
    "name": "Apartment Smíchov",
    "property_type": "apartment",
    "country": "CZ",
    "city": "Prague",
    "address": "Štefánikova 15, Praha 5",
    "square_meters": 62,
    "rooms": 2,
    "has_balcony": True,
    "has_garden": False,
    "has_parking": True,
    "renovation_state": "renovated",
    "floor": 4,
    "purchase_price": 4200000,
    "price_per_sqm": 67742,
    "estimated_value": 4850000,
    "currency": "CZK",
    "purchase_date": "2023-06-01",
    "notes": "2+kk apartment in Smíchov, Prague 5. Walking distance to metro Anděl.",
    "color": "#795548"
}
r = requests.post(f"{API}/portfolio/properties", headers=H, json=property_data)
prop = r.json()
print(f"  Property: {r.status_code} - id={prop.get('id')}")

# Link mortgage to property if both succeeded
if mortgage_id and prop.get("id"):
    r = requests.put(f"{API}/bills/mortgages/{mortgage_id}", headers=H, json={
        "property_id": prop["id"]
    })
    print(f"  Linked mortgage to property: {r.status_code}")

# --- CATEGORY MAPPINGS ---
print("\n=== CATEGORY MAPPINGS ===")
mappings = [
    ("Salary", "TechCorp", "substring"),
    ("Salary", "Salary", "substring"),
    ("Freelance", "Freelance", "substring"),
    ("Groceries", "Albert", "substring"),
    ("Groceries", "Lidl", "substring"),
    ("Groceries", "Billa", "substring"),
    ("Groceries", "Kaufland", "substring"),
    ("Groceries", "Tesco", "substring"),
    ("Groceries", "Globus", "substring"),
    ("Restaurants", "restaurant", "substring"),
    ("Restaurants", "Lokál", "substring"),
    ("Restaurants", "dinner", "substring"),
    ("Coffee", "Starbucks", "substring"),
    ("Coffee", "Coffee", "substring"),
    ("Coffee", "Café", "substring"),
    ("Coffee", "Kavárna", "substring"),
    ("Transport", "Lítačka", "substring"),
    ("Transport", "Shell", "substring"),
    ("Transport", "Bolt taxi", "substring"),
    ("Transport", "Uber", "substring"),
    ("Subscriptions", "Netflix", "substring"),
    ("Subscriptions", "Spotify", "substring"),
    ("Electricity", "ČEZ", "substring"),
    ("Internet", "O2", "substring"),
    ("Phone", "T-Mobile", "substring"),
    ("Mortgage", "Hypoteční", "substring"),
    ("Mortgage", "Mortgage", "substring"),
    ("Insurance", "VZP", "substring"),
    ("Insurance", "insurance", "substring"),
    ("Gym", "Gym", "substring"),
    ("Gym", "John Reed", "substring"),
]
for cat_name, keyword, match_type in mappings:
    cid = cats.get(cat_name)
    if not cid:
        continue
    r = requests.post(f"{API}/categories/mappings", headers=H, json={
        "category_id": cid,
        "keyword": keyword,
        "match_type": match_type
    })
    # Ignore duplicates
    if r.status_code == 200:
        pass

print(f"  Created {len(mappings)} mapping rules")

# --- RECLASSIFY TRANSACTIONS ---
print("\n=== RECLASSIFYING TRANSACTIONS ===")
r = requests.post(f"{API}/transactions/reclassify", headers=H)
print(f"  Reclassify: {r.status_code} - {r.json()}")

# Final confirm all
r = requests.get(f"{API}/transactions/search?limit=500&status=classified", headers=H)
search = r.json()
txns_list = search.get("transactions", []) if isinstance(search, dict) else []
if txns_list:
    tx_ids = [t["id"] for t in txns_list]
    for i in range(0, len(tx_ids), 50):
        batch = tx_ids[i:i+50]
        requests.post(f"{API}/transactions/bulk-update", headers=H, json={
            "transaction_ids": batch,
            "status": "confirmed",
            "category_name": None
        })

# Also confirm any remaining in review
r = requests.get(f"{API}/transactions/search?limit=500&status=review", headers=H)
search = r.json()
txns_list = search.get("transactions", []) if isinstance(search, dict) else []
if txns_list:
    tx_ids = [t["id"] for t in txns_list]
    for i in range(0, len(tx_ids), 50):
        batch = tx_ids[i:i+50]
        requests.post(f"{API}/transactions/bulk-update", headers=H, json={
            "transaction_ids": batch,
            "status": "confirmed",
            "category_name": None
        })

print(f"\n  All transactions confirmed")

# --- GOAL ALLOCATIONS ---
# Only allocate Sep-Dec so the Allocate Savings wizard works for Jan/Feb showcase
print("\n=== GOAL ALLOCATIONS ===")
for month in ["2025-09", "2025-10", "2025-11", "2025-12"]:
    allocations = []
    for i, g in enumerate(goals_data):
        if goal_ids[i]:
            allocations.append({"goal_id": goal_ids[i], "amount": g["monthly_allocation"]})
    if allocations:
        r = requests.post(f"{API}/goals/allocate", headers=H, json={
            "month": month,
            "allocations": allocations
        })
        print(f"  {month}: {r.status_code}")

# --- HISTORICAL PORTFOLIO & STOCK SNAPSHOTS ---
# Creates 6 months of portfolio development + per-stock history
print("\n=== HISTORICAL SNAPSHOTS ===")

# Monthly savings balances (gradual growth)
savings_history = {
    "2025-09": {"Raiffeisen": 145000, "CSOB": 250000, "Revolut": 800},
    "2025-10": {"Raiffeisen": 152000, "CSOB": 250000, "Revolut": 900},
    "2025-11": {"Raiffeisen": 160000, "CSOB": 250000, "Revolut": 1000},
    "2025-12": {"Raiffeisen": 170000, "CSOB": 250000, "Revolut": 1050},
    "2026-01": {"Raiffeisen": 178000, "CSOB": 250000, "Revolut": 1100},
    "2026-02": {"Raiffeisen": 185000, "CSOB": 250000, "Revolut": 1200},
}

# EUR -> CZK approximate rate for savings conversion
EUR_CZK = 25.2

# Monthly stock prices (realistic growth trajectory)
stock_price_history = {
    "2025-09": {"AAPL": 195.50, "MSFT": 365.40, "NVDA": 108.20, "GOOGL": 155.80, "ASML": 695.00, "KOMB.PR": 835.00},
    "2025-10": {"AAPL": 202.80, "MSFT": 378.50, "NVDA": 115.40, "GOOGL": 160.30, "ASML": 710.30, "KOMB.PR": 850.00},
    "2025-11": {"AAPL": 210.30, "MSFT": 390.20, "NVDA": 122.80, "GOOGL": 165.70, "ASML": 720.50, "KOMB.PR": 865.00},
    "2025-12": {"AAPL": 218.60, "MSFT": 400.80, "NVDA": 128.50, "GOOGL": 170.20, "ASML": 730.80, "KOMB.PR": 878.00},
    "2026-01": {"AAPL": 223.90, "MSFT": 408.50, "NVDA": 133.40, "GOOGL": 174.50, "ASML": 738.20, "KOMB.PR": 888.00},
    "2026-02": {"AAPL": 228.40, "MSFT": 415.80, "NVDA": 138.50, "GOOGL": 178.90, "ASML": 745.50, "KOMB.PR": 895.00},
}

# ETF prices
etf_price_history = {
    "2025-09": {"VOO": 438.20, "IWDA": 80.50, "XESC": 53.20},
    "2025-10": {"VOO": 448.50, "IWDA": 82.30, "XESC": 54.10},
    "2025-11": {"VOO": 455.80, "IWDA": 84.70, "XESC": 54.80},
    "2025-12": {"VOO": 462.30, "IWDA": 86.20, "XESC": 55.40},
    "2026-01": {"VOO": 470.50, "IWDA": 87.80, "XESC": 55.90},
    "2026-02": {"VOO": 478.30, "IWDA": 89.15, "XESC": 56.20},
}

# Stock holdings: ticker -> {shares, avg_cost, currency, name, holding_type}
stock_holdings_meta = {
    "AAPL":    {"shares": 8,  "avg_cost": 178.50, "currency": "USD", "name": "Apple Inc.",       "holding_type": "stock"},
    "MSFT":    {"shares": 5,  "avg_cost": 340.20, "currency": "USD", "name": "Microsoft Corp.",   "holding_type": "stock"},
    "NVDA":    {"shares": 10, "avg_cost": 95.80,  "currency": "USD", "name": "NVIDIA Corp.",      "holding_type": "stock"},
    "GOOGL":   {"shares": 12, "avg_cost": 142.30, "currency": "USD", "name": "Alphabet Inc.",     "holding_type": "stock"},
    "ASML":    {"shares": 2,  "avg_cost": 680.00, "currency": "EUR", "name": "ASML Holding",      "holding_type": "stock"},
    "KOMB.PR": {"shares": 30, "avg_cost": 820.00, "currency": "CZK", "name": "Komerční banka",   "holding_type": "stock"},
}

etf_holdings_meta = {
    "VOO":  {"units": 3.5, "avg_cost": 420.50, "currency": "USD", "name": "Vanguard S&P 500 ETF",    "holding_type": "etf"},
    "IWDA": {"units": 25,  "avg_cost": 78.40,  "currency": "EUR", "name": "iShares MSCI World",      "holding_type": "etf"},
    "XESC": {"units": 40,  "avg_cost": 52.80,  "currency": "EUR", "name": "Xtrackers Euro Stoxx 50", "holding_type": "etf"},
}

# USD -> CZK approximate rate
USD_CZK = 23.5

# Property estimated values (gradual appreciation)
property_values = {
    "2025-09": 4200000, "2025-10": 4280000, "2025-11": 4380000,
    "2025-12": 4500000, "2026-01": 4680000, "2026-02": 4850000,
}

# Build snapshot payload
portfolio_snapshots = []
stock_snapshots = []

for month in ["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02"]:
    sav = savings_history[month]
    # Total savings in CZK (Revolut EUR converted)
    total_savings = sav["Raiffeisen"] + sav["CSOB"] + round(sav["Revolut"] * EUR_CZK)

    # Total investments (ETFs) in CZK
    total_investments = 0
    for ticker, meta in etf_holdings_meta.items():
        price = etf_price_history[month][ticker]
        value = meta["units"] * price
        if meta["currency"] == "USD":
            total_investments += value * USD_CZK
        elif meta["currency"] == "EUR":
            total_investments += value * EUR_CZK

    # Total stocks in CZK
    total_stocks = 0
    for ticker, meta in stock_holdings_meta.items():
        price = stock_price_history[month][ticker]
        value = meta["shares"] * price
        if meta["currency"] == "USD":
            total_stocks += value * USD_CZK
        elif meta["currency"] == "EUR":
            total_stocks += value * EUR_CZK
        else:
            total_stocks += value

    total_properties = property_values[month]

    portfolio_snapshots.append({
        "month": month,
        "total_savings": round(total_savings, 2),
        "total_investments": round(total_investments, 2),
        "total_stocks": round(total_stocks, 2),
        "total_properties": total_properties,
    })

    # Stock holding snapshots (individual stocks)
    for ticker, meta in stock_holdings_meta.items():
        price = stock_price_history[month][ticker]
        stock_snapshots.append({
            "month": month,
            "ticker": ticker,
            "currency": meta["currency"],
            "name": meta["name"],
            "holding_type": meta["holding_type"],
            "shares": meta["shares"],
            "price": price,
            "avg_cost": meta["avg_cost"],
        })

    # ETF snapshots (treated as stock holdings for chart)
    for ticker, meta in etf_holdings_meta.items():
        price = etf_price_history[month][ticker]
        stock_snapshots.append({
            "month": month,
            "ticker": ticker,
            "currency": meta["currency"],
            "name": meta["name"],
            "holding_type": meta["holding_type"],
            "shares": meta["units"],
            "price": price,
            "avg_cost": meta["avg_cost"],
        })

r = requests.post(f"{API}/portfolio/seed-demo-snapshots", headers=H, json={
    "portfolio_snapshots": portfolio_snapshots,
    "stock_snapshots": stock_snapshots,
})
print(f"  Snapshots: {r.status_code} - {r.json()}")

print("\n\n=== DEMO DATA SEEDING COMPLETE ===")
print("Login: test@me / Testme2026!")
print(f"Total categories: {len(cats)}")
print(f"Total transactions: {len(all_txns)}")
print(f"Months covered: Sep 2025 - Feb 2026")
print(f"Portfolio snapshots: 6 months")
print(f"Stock snapshots: {len(stock_snapshots)} records")
print(f"Goal allocations: Sep-Dec 2025 (Jan/Feb left for wizard showcase)")
