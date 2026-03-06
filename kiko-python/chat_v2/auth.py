from functools import lru_cache
import time
import requests
from fastapi import Header, HTTPException
from jose import jwt

from .settings import settings


_jwks_last_good = None


@lru_cache(maxsize=1)
def get_jwks():
    global _jwks_last_good
    last_err = None
    for attempt in range(3):
        try:
            resp = requests.get(settings.PRIVY_JWKS_URL, timeout=3)
            resp.raise_for_status()
            data = resp.json()
            if "keys" not in data:
                raise ValueError("invalid JWKS")
            _jwks_last_good = data
            return data
        except Exception as e:
            last_err = e
            time.sleep(0.2 * (attempt + 1))
    if _jwks_last_good is not None:
        return _jwks_last_good
    raise HTTPException(status_code=401, detail=f"JWKS fetch failed: {last_err}")


def verify_privy_token(token: str):
    try:
        unverified = jwt.get_unverified_header(token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token header: {e}")

    jwks = get_jwks()
    kid = unverified.get("kid")
    key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)

    if not key:
        get_jwks.cache_clear()
        jwks = get_jwks()
        key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)

    if not key:
        raise HTTPException(status_code=401, detail="JWKS key not found")

    try:
        return jwt.decode(
            token,
            key,
            algorithms=[key.get("alg", "RS256")],
            audience=settings.PRIVY_APP_ID if settings.PRIVY_APP_ID else None,
        )
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


async def require_auth(authorization: str = Header(default=None), x_service_key: str = Header(default=None)):
    if settings.SKIP_AUTH:
        return {"sub": "dev-user", "dev": True}

    if settings.INTERNAL_SERVICE_KEY and x_service_key == settings.INTERNAL_SERVICE_KEY:
        return {"service": "internal"}

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    token = authorization.split(" ", 1)[1].strip()
    return verify_privy_token(token)


async def require_internal_service(
    x_service_key: str = Header(default=None),
    x_internal_service_key: str = Header(default=None),
):
    if settings.SKIP_AUTH:
        return {"service": "dev-internal", "dev": True}

    provided = x_internal_service_key or x_service_key
    if settings.INTERNAL_SERVICE_KEY and provided == settings.INTERNAL_SERVICE_KEY:
        return {"service": "internal"}

    raise HTTPException(status_code=401, detail="Missing or invalid internal service key")


def extract_user_id(claims: dict) -> str:
    return (
        claims.get("sub")
        or claims.get("user_id")
        or claims.get("did")
        or claims.get("privy_did")
        or "unknown-user"
    )
