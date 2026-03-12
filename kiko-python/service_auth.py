from __future__ import annotations

import os
import time
from functools import lru_cache

import requests
from fastapi import Header, HTTPException
from jose import jwt


def _bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).lower() in ("1", "true", "yes", "on")


SKIP_AUTH = _bool("SKIP_AUTH", False)
INTERNAL_SERVICE_KEY = os.getenv("INTERNAL_SERVICE_KEY", "")
PRIVY_APP_ID = os.getenv("PRIVY_APP_ID")
PRIVY_JWKS_URL = os.getenv(
    "PRIVY_JWKS_URL",
    f"https://auth.privy.io/api/v1/apps/{PRIVY_APP_ID}/jwks.json" if PRIVY_APP_ID else "https://auth.privy.io/api/v1/keys",
)

_jwks_last_good = None


@lru_cache(maxsize=1)
def get_jwks():
    global _jwks_last_good
    last_err = None
    for attempt in range(3):
        try:
            resp = requests.get(PRIVY_JWKS_URL, timeout=3)
            resp.raise_for_status()
            data = resp.json()
            if "keys" not in data:
                raise ValueError("invalid JWKS")
            _jwks_last_good = data
            return data
        except Exception as exc:
            last_err = exc
            time.sleep(0.2 * (attempt + 1))
    if _jwks_last_good is not None:
        return _jwks_last_good
    raise HTTPException(status_code=401, detail=f"JWKS fetch failed: {last_err}")


def verify_privy_token(token: str):
    try:
        unverified = jwt.get_unverified_header(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token header: {exc}") from exc

    jwks = get_jwks()
    kid = unverified.get("kid")
    key = next((item for item in jwks.get("keys", []) if item.get("kid") == kid), None)

    if not key:
        get_jwks.cache_clear()
        jwks = get_jwks()
        key = next((item for item in jwks.get("keys", []) if item.get("kid") == kid), None)

    if not key:
        raise HTTPException(status_code=401, detail="JWKS key not found")

    try:
        return jwt.decode(
            token,
            key,
            algorithms=[key.get("alg", "RS256")],
            audience=PRIVY_APP_ID if PRIVY_APP_ID else None,
        )
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}") from exc


async def require_auth(
    authorization: str = Header(default=None),
    x_service_key: str = Header(default=None),
    x_internal_service_key: str = Header(default=None),
):
    if SKIP_AUTH:
        return {"sub": "dev-user", "dev": True}

    provided = x_internal_service_key or x_service_key
    if INTERNAL_SERVICE_KEY and provided == INTERNAL_SERVICE_KEY:
        return {"service": "internal"}

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    token = authorization.split(" ", 1)[1].strip()
    return verify_privy_token(token)


async def require_internal_service(
    x_service_key: str = Header(default=None),
    x_internal_service_key: str = Header(default=None),
):
    if SKIP_AUTH:
        return {"service": "dev-internal", "dev": True}

    provided = x_internal_service_key or x_service_key
    if INTERNAL_SERVICE_KEY and provided == INTERNAL_SERVICE_KEY:
        return {"service": "internal"}

    raise HTTPException(status_code=401, detail="Missing or invalid internal service key")
