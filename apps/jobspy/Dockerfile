# syntax=docker/dockerfile:1
# The JobSpy sidecar for Jobify: a small FastAPI service around python-jobspy.
FROM python:3.12-slim
ARG VERSION=dev
LABEL org.opencontainers.image.title="Jobify JobSpy" \
      org.opencontainers.image.description="Job board search service for Jobify, powered by JobSpy" \
      org.opencontainers.image.licenses="AGPL-3.0-or-later" \
      org.opencontainers.image.version="$VERSION"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .

RUN useradd --system --uid 1000 jobspy
USER jobspy

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ[\"PORT\"]}/ping')"

CMD ["python", "app.py"]
