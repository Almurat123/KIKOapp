from __future__ import annotations

import logging
import sys
from typing import Any


LOG_FORMAT = "%(levelname)s:%(name)s:%(message)s"
ACCESS_LOG_FORMAT = '%(levelprefix)s %(client_addr)s - "%(request_line)s" %(status_code)s'


def configure_service_logging(level: str = "INFO") -> None:
    logging.basicConfig(
        level=getattr(logging, str(level or "INFO").upper(), logging.INFO),
        format=LOG_FORMAT,
        stream=sys.stdout,
        force=True,
    )


def build_uvicorn_log_config(level: str = "INFO") -> dict[str, Any]:
    normalized_level = str(level or "INFO").upper()
    return {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": LOG_FORMAT,
            },
            "access": {
                "()": "uvicorn.logging.AccessFormatter",
                "fmt": ACCESS_LOG_FORMAT,
            },
        },
        "handlers": {
            "default": {
                "class": "logging.StreamHandler",
                "formatter": "default",
                "stream": "ext://sys.stdout",
            },
            "access": {
                "class": "logging.StreamHandler",
                "formatter": "access",
                "stream": "ext://sys.stdout",
            },
        },
        "root": {
            "handlers": ["default"],
            "level": normalized_level,
        },
        "loggers": {
            "uvicorn": {
                "handlers": ["default"],
                "level": normalized_level,
                "propagate": False,
            },
            "uvicorn.error": {
                "handlers": ["default"],
                "level": normalized_level,
                "propagate": False,
            },
            "uvicorn.access": {
                "handlers": ["access"],
                "level": normalized_level,
                "propagate": False,
            },
        },
    }
