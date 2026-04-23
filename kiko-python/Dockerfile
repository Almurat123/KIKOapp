FROM python:3.11-slim

WORKDIR /app

# Build this image from the repo root so Python services can bundle the
# shared kiko-api prompt/skill assets they read at runtime.
COPY kiko-python/requirements.txt /app/requirements.txt
RUN PIP_REQUIRE_HASHES=0 pip install --no-cache-dir -r /app/requirements.txt

COPY kiko-python/ /app
COPY kiko-api/src /app/kiko-api/src

ENV PYTHONUNBUFFERED=1

CMD ["python", "main.py"]
