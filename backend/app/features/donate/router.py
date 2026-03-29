"""Donation endpoints — Stripe Checkout for 'Buy a Carrot for Zumi'."""

import logging

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel

from core.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/donate", tags=["Donate"])

CARROT_TIERS = {
    1: {"name": "Carrotka for Zumi", "price_cents": 200, "emoji": "1 carrot"},
    3: {"name": "Carrotka for Zumi", "price_cents": 500, "emoji": "3 carrots"},
    5: {"name": "Carrotka for Zumi", "price_cents": 1000, "emoji": "bucket of carrots"},
}

# GitHub Sponsors URL — shown when Stripe is not configured.
# Change this to your own GitHub username.
GITHUB_SPONSORS_URL = "https://github.com/sponsors/mzsim"


class CheckoutRequest(BaseModel):
    tier: int = 1
    success_url: str
    cancel_url: str


@router.get("/config")
async def donate_config():
    """Tell the frontend whether Stripe donations are available."""
    settings = get_settings()
    return {
        "stripe_enabled": bool(settings.STRIPE_SECRET_KEY),
        "github_sponsors_url": GITHUB_SPONSORS_URL,
    }


@router.post("/create-checkout-session")
async def create_checkout_session(body: CheckoutRequest):
    settings = get_settings()
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    import stripe
    stripe.api_key = settings.STRIPE_SECRET_KEY

    tier = CARROT_TIERS.get(body.tier)
    if not tier:
        raise HTTPException(status_code=400, detail="Invalid tier")

    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{
            "price_data": {
                "currency": "usd",
                "product_data": {
                    "name": tier["name"],
                    "description": f"{tier['emoji']} for Zumi the rabbit",
                },
                "unit_amount": tier["price_cents"],
            },
            "quantity": 1,
        }],
        mode="payment",
        success_url=body.success_url,
        cancel_url=body.cancel_url,
        metadata={"message": "Carrotka for Zumi", "tier": str(body.tier)},
    )

    return {"checkout_url": session.url, "session_id": session.id}


@router.post("/webhook")
async def stripe_webhook(request: Request):
    settings = get_settings()

    import stripe
    stripe.api_key = settings.STRIPE_SECRET_KEY

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    # If webhook secret is configured, verify signature
    if settings.STRIPE_WEBHOOK_SECRET:
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
            )
        except (ValueError, stripe.error.SignatureVerificationError):
            raise HTTPException(status_code=400, detail="Invalid signature")
    else:
        # No webhook secret — accept but log a warning
        import json
        try:
            event = json.loads(payload)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid payload")
        logger.warning("Webhook received without signature verification (STRIPE_WEBHOOK_SECRET not set)")

    if event.get("type") == "checkout.session.completed":
        session = event["data"]["object"]
        amount = session.get("amount_total", 0) / 100
        metadata = session.get("metadata", {})
        message = metadata.get("message", "Carrotka for Zumi")
        logger.info(
            f"*** {message} *** "
            f"Payment received: ${amount:.2f} "
            f"(tier: {metadata.get('tier', '?')}, "
            f"email: {session.get('customer_details', {}).get('email', 'anonymous')})"
        )

    return {"status": "ok"}
