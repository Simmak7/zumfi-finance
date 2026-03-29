"""Property investment CRUD, valuation engine, and snapshot management."""
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from features.portfolio.models import PropertyInvestment, PropertySnapshot


# ── Pre-seeded base prices (per m²) by country → city ──
# Prices are in the local currency for each country.

BASE_PRICES = {
    "Czech Republic": {
        "_currency": "CZK",
        "Prague": 150000, "Brno": 116000, "Ostrava": 62000,
        "Plzen": 78000, "Liberec": 62000, "Olomouc": 72000,
        "Hradec Kralove": 70000, "Ceske Budejovice": 68000,
        "Pardubice": 68000, "Zlin": 55000, "Usti nad Labem": 38000,
        "Karlovy Vary": 52000, "Jihlava": 55000,
    },
    "Slovakia": {
        "_currency": "EUR",
        "Bratislava": 4800, "Kosice": 2900, "Zilina": 3000,
        "Nitra": 2600, "Presov": 2400, "Banska Bystrica": 2500,
        "Trnava": 2900, "Trencin": 2400,
    },
    "Germany": {
        "_currency": "EUR",
        "Berlin": 6500, "Munich": 9800, "Hamburg": 6000,
        "Frankfurt": 6800, "Cologne": 4800, "Dusseldorf": 5500,
        "Stuttgart": 6500, "Leipzig": 3800, "Dresden": 3800,
        "Nuremberg": 4800,
    },
    "Austria": {
        "_currency": "EUR",
        "Vienna": 6500, "Graz": 4500, "Salzburg": 6000,
        "Linz": 4500, "Innsbruck": 6500, "Klagenfurt": 3800,
    },
    "Poland": {
        "_currency": "PLN",
        "Warsaw": 17000, "Krakow": 16000, "Wroclaw": 14000,
        "Gdansk": 15500, "Poznan": 12000, "Lodz": 9000,
        "Katowice": 9500, "Lublin": 9500, "Szczecin": 10000,
    },
    "Hungary": {
        "_currency": "HUF",
        "Budapest": 1270000, "Debrecen": 750000, "Szeged": 700000,
        "Pecs": 550000, "Gyor": 800000, "Miskolc": 420000,
    },
    "Spain": {
        "_currency": "EUR",
        "Madrid": 5500, "Barcelona": 5800, "Valencia": 2800,
        "Seville": 2700, "Malaga": 3500, "Bilbao": 4000,
    },
    "Italy": {
        "_currency": "EUR",
        "Rome": 3800, "Milan": 5200, "Florence": 4500,
        "Turin": 2200, "Naples": 2800, "Bologna": 4000,
    },
    "France": {
        "_currency": "EUR",
        "Paris": 9600, "Lyon": 5600, "Marseille": 3500,
        "Toulouse": 3800, "Nice": 5500, "Bordeaux": 4800,
    },
    "United Kingdom": {
        "_currency": "GBP",
        "London": 7400, "Manchester": 3800, "Birmingham": 3200,
        "Edinburgh": 4500, "Bristol": 4800, "Leeds": 3200,
    },
    "Netherlands": {
        "_currency": "EUR",
        "Amsterdam": 8900, "Rotterdam": 5000, "The Hague": 5000,
        "Utrecht": 6000, "Eindhoven": 4500,
    },
    "Portugal": {
        "_currency": "EUR",
        "Lisbon": 5900, "Porto": 3900, "Faro": 3700, "Braga": 2800,
    },
    "Croatia": {
        "_currency": "EUR",
        "Zagreb": 3700, "Split": 4200, "Rijeka": 2800, "Dubrovnik": 5500,
    },
    "Ukraine": {
        "_currency": "UAH",
        "Kyiv": 55000, "Lviv": 45000, "Odesa": 38000, "Kharkiv": 25000,
        "Dnipro": 32000, "Zaporizhzhia": 22000, "Ivano-Frankivsk": 30000,
        "Uzhhorod": 35000, "Vinnytsia": 28000, "Chernivtsi": 26000,
    },
}


def get_country_average(country: str) -> int | None:
    """Return average price/m² across all cities in a country."""
    data = BASE_PRICES.get(country)
    if not data:
        return None
    prices = [v for k, v in data.items() if k != "_currency"]
    return round(sum(prices) / len(prices)) if prices else None


# ── Historical price index (end-of-year, 2025 = 1.0) ──
# Based on Eurostat House Price Index and national statistics offices.
# Each list: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]
_PI_YEARS = list(range(2015, 2027))
_PI = {
    "Czech Republic": [.45, .50, .56, .61, .65, .68, .79, .91, .88, .95, 1.0, 1.0],
    "Slovakia":       [.54, .57, .62, .68, .72, .73, .82, .95, .89, .95, 1.0, 1.0],
    "Germany":        [.65, .70, .75, .80, .85, .90, .98, 1.06, .97, .96, 1.0, 1.0],
    "Austria":        [.65, .70, .73, .78, .82, .87, .95, 1.06, .98, .97, 1.0, 1.0],
    "Poland":         [.51, .52, .55, .58, .60, .64, .70, .79, .85, .92, 1.0, 1.0],
    "Hungary":        [.38, .44, .52, .58, .62, .65, .75, .88, .88, .94, 1.0, 1.0],
    "Spain":          [.65, .68, .72, .77, .80, .74, .78, .83, .88, .94, 1.0, 1.0],
    "Italy":          [.94, .93, .92, .92, .92, .92, .93, .94, .96, .98, 1.0, 1.0],
    "France":         [.78, .80, .83, .87, .90, .94, 1.00, 1.05, 1.00, .98, 1.0, 1.0],
    "United Kingdom": [.70, .75, .78, .80, .80, .85, .92, 1.02, .95, .97, 1.0, 1.0],
    "Netherlands":    [.53, .58, .64, .70, .75, .76, .86, .97, .91, .95, 1.0, 1.0],
    "Portugal":       [.45, .50, .56, .62, .68, .66, .74, .84, .90, .95, 1.0, 1.0],
    "Croatia":        [.54, .55, .57, .60, .63, .62, .68, .76, .85, .92, 1.0, 1.0],
    "Ukraine":        [.55, .50, .52, .58, .65, .62, .78, .48, .62, .82, 1.0, 1.0],
}
PRICE_INDEX = {c: dict(zip(_PI_YEARS, v)) for c, v in _PI.items()}


def _get_price_multiplier(country: str, month_str: str) -> float:
    """Return historical price multiplier for a country at a given month.

    Interpolates linearly within each year between end-of-prev-year and
    end-of-current-year index values.
    """
    idx = PRICE_INDEX.get(country)
    if not idx:
        return 1.0
    year, month = int(month_str[:4]), int(month_str[5:7])
    min_yr, max_yr = min(idx), max(idx)
    if year >= max_yr:
        return 1.0
    if year < min_yr:
        return idx[min_yr]
    prev_val = idx.get(year - 1, idx[min_yr])
    curr_val = idx.get(year, 1.0)
    return prev_val + (curr_val - prev_val) * month / 12


# ── Valuation coefficients ──

COEFFICIENTS = {
    "balcony": Decimal("1.03"),
    "garden": Decimal("1.07"),
    "parking": Decimal("1.05"),
    "renovation": {
        "new": Decimal("1.00"),
        "good": Decimal("0.95"),
        "needs_renovation": Decimal("0.85"),
    },
    "floor": {
        "ground": Decimal("0.95"),
        "middle": Decimal("1.00"),
        "top": Decimal("0.98"),
    },
}


def compute_property_value(prop: PropertyInvestment) -> Decimal | None:
    """Compute estimated value using coefficient model.

    Priority: manual estimated_value > price_per_sqm > city default.
    Returns None if no price information is available.
    """
    if prop.estimated_value is not None:
        return prop.estimated_value

    base_price = prop.price_per_sqm
    if base_price is None and prop.country:
        country_data = BASE_PRICES.get(prop.country, {})
        if prop.city:
            city_price = country_data.get(prop.city)
            if city_price is None:
                for k, v in country_data.items():
                    if k != "_currency" and k.lower() == prop.city.lower():
                        city_price = v
                        break
            if city_price is not None:
                base_price = Decimal(str(city_price))
        if base_price is None:
            avg = get_country_average(prop.country)
            if avg is not None:
                base_price = Decimal(str(avg))

    if base_price is None:
        return None

    value = prop.square_meters * base_price
    if prop.has_balcony:
        value *= COEFFICIENTS["balcony"]
    if prop.has_garden:
        value *= COEFFICIENTS["garden"]
    if prop.has_parking:
        value *= COEFFICIENTS["parking"]
    renovation = COEFFICIENTS["renovation"].get(prop.renovation_state, Decimal("1.0"))
    value *= renovation
    if prop.property_type == "flat" and prop.floor:
        value *= COEFFICIENTS["floor"].get(prop.floor, Decimal("1.0"))
    return value.quantize(Decimal("0.01"))


def compute_property_metrics(prop: PropertyInvestment) -> dict:
    """Compute display metrics for a property (display_value, gain/loss)."""
    computed = compute_property_value(prop)
    purchase = float(prop.purchase_price)
    dv = float(computed) if computed else None
    gl = round(dv - purchase, 2) if dv is not None else None
    pct = round((gl / purchase) * 100, 2) if gl is not None and purchase > 0 else None
    return {"computed_value": dv, "display_value": dv, "gain_loss": gl, "gain_loss_pct": pct}


def _generate_months(start: date, end: date) -> list[str]:
    """Generate YYYY-MM strings from start to end inclusive."""
    result, y, m = [], start.year, start.month
    while (y, m) <= (end.year, end.month):
        result.append(f"{y}-{m:02d}")
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return result


class PropertyService:
    """CRUD and snapshot management for property investments."""

    @staticmethod
    async def get_properties_for_month(
        db: AsyncSession, owner_id: int, month: str,
    ) -> list[dict]:
        """Get property data as it was in a specific month using snapshots."""
        result = await db.execute(
            select(PropertySnapshot, PropertyInvestment)
            .join(PropertyInvestment, PropertySnapshot.property_id == PropertyInvestment.id)
            .where(PropertySnapshot.owner_id == owner_id, PropertySnapshot.snapshot_month == month)
        )
        responses = []
        for snap, prop in result.all():
            sv = float(snap.estimated_value)
            pp = float(prop.purchase_price)
            gl = round(sv - pp, 2)
            pct = round((gl / pp) * 100, 2) if pp > 0 else None
            responses.append({
                **{c.name: getattr(prop, c.name) for c in prop.__table__.columns},
                "computed_value": sv, "display_value": sv,
                "gain_loss": gl, "gain_loss_pct": pct,
            })
        return responses

    @staticmethod
    async def get_all(db: AsyncSession, owner_id: int) -> list[PropertyInvestment]:
        result = await db.execute(
            select(PropertyInvestment).where(
                PropertyInvestment.owner_id == owner_id,
                PropertyInvestment.status == "active",
            ).order_by(PropertyInvestment.created_at.desc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def create(db: AsyncSession, owner_id: int, **kwargs) -> PropertyInvestment:
        prop = PropertyInvestment(owner_id=owner_id, **kwargs)
        db.add(prop)
        await db.flush()
        await db.refresh(prop)
        return prop

    @staticmethod
    async def update(
        db: AsyncSession, owner_id: int, property_id: int, **kwargs,
    ) -> PropertyInvestment | None:
        result = await db.execute(select(PropertyInvestment).where(
            PropertyInvestment.id == property_id, PropertyInvestment.owner_id == owner_id,
        ))
        prop = result.scalar_one_or_none()
        if not prop:
            return None
        for key, value in kwargs.items():
            if value is not None:
                setattr(prop, key, value)
        await db.flush()
        await db.refresh(prop)
        return prop

    @staticmethod
    async def delete(db: AsyncSession, owner_id: int, property_id: int) -> bool:
        result = await db.execute(select(PropertyInvestment).where(
            PropertyInvestment.id == property_id, PropertyInvestment.owner_id == owner_id,
        ))
        prop = result.scalar_one_or_none()
        if not prop:
            return False
        await db.delete(prop)
        await db.flush()
        return True

    @staticmethod
    async def create_or_update_snapshot(
        db: AsyncSession, owner_id: int, property_id: int,
        snapshot_month: str, estimated_value: float, price_per_sqm: float | None = None,
    ) -> PropertySnapshot:
        result = await db.execute(select(PropertySnapshot).where(
            PropertySnapshot.owner_id == owner_id, PropertySnapshot.property_id == property_id,
            PropertySnapshot.snapshot_month == snapshot_month,
        ))
        snap = result.scalar_one_or_none()
        ev = Decimal(str(round(estimated_value, 2)))
        pp = Decimal(str(round(price_per_sqm, 2))) if price_per_sqm else None
        if snap:
            snap.estimated_value = ev
            if pp is not None:
                snap.price_per_sqm = pp
        else:
            snap = PropertySnapshot(
                owner_id=owner_id, property_id=property_id,
                snapshot_month=snapshot_month, estimated_value=ev, price_per_sqm=pp,
            )
            db.add(snap)
        await db.flush()
        return snap

    @staticmethod
    async def record_property_snapshots(db: AsyncSession, owner_id: int) -> float:
        """Compute current property values, save snapshots, return total."""
        month_str = f"{date.today().year}-{date.today().month:02d}"
        properties = await PropertyService.get_all(db, owner_id)
        total = 0.0
        for prop in properties:
            value = compute_property_value(prop)
            if value is not None:
                fval = float(value)
                total += fval
                await PropertyService.create_or_update_snapshot(
                    db, owner_id, prop.id, month_str, fval,
                    float(prop.price_per_sqm) if prop.price_per_sqm else None,
                )
            else:
                total += float(prop.purchase_price)
        return round(total, 2)

    @staticmethod
    async def get_property_history(
        db: AsyncSession, owner_id: int, property_id: int, months: int = 120,
    ) -> list[dict]:
        """Return monthly value history for a property, backfilled to purchase date."""
        prop_result = await db.execute(select(PropertyInvestment).where(
            PropertyInvestment.id == property_id, PropertyInvestment.owner_id == owner_id,
        ))
        prop = prop_result.scalar_one_or_none()
        if not prop:
            return []

        result = await db.execute(select(PropertySnapshot).where(
            PropertySnapshot.owner_id == owner_id, PropertySnapshot.property_id == property_id,
        ).order_by(PropertySnapshot.snapshot_month.asc()))
        snap_map = {s.snapshot_month: s for s in result.scalars().all()}

        today = date.today()
        current_value = compute_property_value(prop)
        current_fval = float(current_value) if current_value else float(prop.purchase_price)
        purchase = float(prop.purchase_price)
        country = prop.country or ""

        start = prop.purchase_date or today
        all_months = _generate_months(start, today)
        if len(all_months) > months:
            all_months = all_months[-months:]

        history = []
        for m in all_months:
            if m in snap_map:
                s = snap_map[m]
                val = float(s.estimated_value)
                ppsqm = float(s.price_per_sqm) if s.price_per_sqm else None
            elif m == all_months[0] and prop.purchase_date:
                val, ppsqm = purchase, None
            else:
                # Estimate historical value using price index
                mult = _get_price_multiplier(country, m)
                val, ppsqm = round(current_fval * mult, 2), None
            history.append({
                "month": m, "estimated_value": round(val, 2), "price_per_sqm": ppsqm,
            })
        return history

    @staticmethod
    async def get_total_properties_value(db: AsyncSession, owner_id: int) -> float:
        """Sum current estimated values of all active properties."""
        props = await PropertyService.get_all(db, owner_id)
        total = 0.0
        for p in props:
            v = compute_property_value(p)
            total += float(v) if v else float(p.purchase_price)
        return round(total, 2)

    @staticmethod
    async def get_all_properties_history(
        db: AsyncSession, owner_id: int, months: int = 120,
    ) -> dict:
        """Return monthly aggregated property values, backfilled to earliest purchase."""
        props_result = await db.execute(select(PropertyInvestment).where(
            PropertyInvestment.owner_id == owner_id, PropertyInvestment.status == "active",
        ))
        properties = list(props_result.scalars().all())
        if not properties:
            return {"history": [], "total_purchase_price": 0}

        prop_info = {}
        for prop in properties:
            cv = compute_property_value(prop)
            prop_info[prop.id] = {
                "name": prop.name, "country": prop.country or "",
                "currency": prop.currency or "CZK",
                "purchase_price": float(prop.purchase_price),
                "purchase_date": prop.purchase_date,
                "current_value": float(cv) if cv else float(prop.purchase_price),
            }

        result = await db.execute(
            select(PropertySnapshot).where(PropertySnapshot.owner_id == owner_id)
        )
        snap_idx: dict[tuple[int, str], float] = {}
        for s in result.scalars().all():
            snap_idx[(s.property_id, s.snapshot_month)] = float(s.estimated_value)

        today = date.today()
        earliest = today
        for info in prop_info.values():
            pd = info["purchase_date"]
            if pd and pd < earliest:
                earliest = pd
        all_months = _generate_months(earliest, today)
        if len(all_months) > months:
            all_months = all_months[-months:]

        history = []
        for m in all_months:
            total_value = 0.0
            month_properties = []
            for pid, info in prop_info.items():
                pd = info["purchase_date"]
                start_month = f"{pd.year}-{pd.month:02d}" if pd else m
                if m < start_month:
                    continue

                key = (pid, m)
                if key in snap_idx:
                    val = snap_idx[key]
                elif m == start_month and pd:
                    val = info["purchase_price"]
                else:
                    # Estimate historical value using price index
                    mult = _get_price_multiplier(info["country"], m)
                    val = round(info["current_value"] * mult, 2)

                total_value += val
                month_properties.append({
                    "property_id": pid, "name": info["name"],
                    "estimated_value": round(val, 2),
                })

            if month_properties:
                history.append({
                    "month": m, "total_value": round(total_value, 2),
                    "properties": month_properties,
                })

        total_purchase = sum(i["purchase_price"] for i in prop_info.values())
        purchase_prices = {
            info["name"]: round(info["purchase_price"], 2)
            for info in prop_info.values()
        }
        currencies = {
            info["name"]: info["currency"]
            for info in prop_info.values()
        }
        return {
            "history": history,
            "total_purchase_price": round(total_purchase, 2),
            "purchase_prices": purchase_prices,
            "currencies": currencies,
        }
