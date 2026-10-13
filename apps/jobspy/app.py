"""
A small HTTP wrapper around JobSpy (https://github.com/speedyapply/JobSpy) for Jobify.

Jobify's "Find jobs" page calls this service to search job boards. It runs as its own
container so the scraping dependencies stay out of the Jobify image and can be updated on
their own. The endpoints follow the shape of the community `jobspy-api` project, so Jobify
works with either.

    GET /ping                      liveness check, no auth (used by Docker's HEALTHCHECK)
    GET /health                    version and supported sites
    GET /api/v1/search_jobs        search; every JobSpy option is a query parameter

Requests must carry one of the keys in API_KEYS in the `x-api-key` header. Leave API_KEYS
unset to run without authentication (only do that on a private network).
"""

from __future__ import annotations

import asyncio
import inspect
import logging
import math
import os
from datetime import date, datetime
from importlib.metadata import PackageNotFoundError, version
from typing import Any

import pandas as pd
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.concurrency import run_in_threadpool
from jobspy import scrape_jobs

try:  # JobSpy 1.1.7x and later
    from jobspy.model import Site
except ImportError:  # pragma: no cover - older releases
    from jobspy.scrapers import Site  # type: ignore[no-redef]

logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO").upper())
log = logging.getLogger("jobspy-api")

API_KEYS = {key.strip() for key in os.environ.get("API_KEYS", "").split(",") if key.strip()}
API_KEY_HEADER = os.environ.get("API_KEY_HEADER_NAME", "x-api-key")
DEFAULT_PROXIES = [p.strip() for p in os.environ.get("DEFAULT_PROXIES", "").split(",") if p.strip()]
MAX_RESULTS = int(os.environ.get("MAX_RESULTS", "100"))
# Scrapes are slow and the boards rate-limit aggressively, so only a few run at once.
CONCURRENCY = int(os.environ.get("MAX_CONCURRENT_SEARCHES", "2"))

SITES = [site.value for site in Site]
JOB_TYPES = ["fulltime", "parttime", "internship", "contract"]


def jobspy_version() -> str:
    try:
        return version("python-jobspy")
    except PackageNotFoundError:  # pragma: no cover
        return "unknown"


def require_api_key(request: Request) -> None:
    if not API_KEYS:
        return
    if request.headers.get(API_KEY_HEADER) not in API_KEYS:
        raise HTTPException(status_code=403, detail="Invalid or missing API key")


app = FastAPI(title="JobSpy API for Jobify", version=jobspy_version())
searches = asyncio.Semaphore(CONCURRENCY)


@app.get("/ping")
def ping() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health", dependencies=[Depends(require_api_key)])
def health() -> dict[str, Any]:
    return {"status": "ok", "jobspy": jobspy_version(), "sites": SITES}


def clean(value: Any) -> Any:
    """Makes a DataFrame cell JSON-friendly: NaN becomes null, numpy scalars become Python."""
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if hasattr(value, "item"):  # numpy scalar
        return clean(value.item())
    if isinstance(value, (list, tuple)):
        return [clean(item) for item in value]
    if value is pd.NaT:
        return None
    return value


def to_records(frame: pd.DataFrame) -> list[dict[str, Any]]:
    return [
        {column: clean(cell) for column, cell in row.items()}
        for row in frame.to_dict(orient="records")
    ]


def split_list(value: str | None) -> list[str] | None:
    if not value:
        return None
    return [item.strip() for item in value.split(",") if item.strip()]


@app.get("/api/v1/search_jobs", dependencies=[Depends(require_api_key)])
async def search_jobs(
    search_term: str = Query(..., min_length=1, max_length=200),
    site_name: str | None = Query(None, description="Comma-separated: " + ", ".join(SITES)),
    location: str | None = Query(None, max_length=200),
    distance: int | None = Query(None, ge=0, le=500),
    job_type: str | None = Query(None),
    is_remote: bool = False,
    results_wanted: int = Query(20, ge=1, le=MAX_RESULTS),
    hours_old: int | None = Query(None, ge=1),
    easy_apply: bool | None = None,
    offset: int = Query(0, ge=0),
    country_indeed: str | None = Query(None, max_length=50),
    google_search_term: str | None = Query(None, max_length=300),
    description_format: str = Query("markdown", pattern="^(markdown|html)$"),
    fetch_description: bool = Query(
        False, description="Fetch every LinkedIn posting for its description (slow)"
    ),
    enforce_annual_salary: bool = False,
    proxies: str | None = Query(None, description="Comma-separated, overrides DEFAULT_PROXIES"),
) -> dict[str, Any]:
    sites = split_list(site_name) or ["indeed", "linkedin"]
    unknown = [site for site in sites if site not in SITES]
    if unknown:
        raise HTTPException(400, f"Unknown site(s): {', '.join(unknown)}. Choose from {', '.join(SITES)}")
    if job_type and job_type not in JOB_TYPES:
        raise HTTPException(400, f"Unknown job_type. Choose from {', '.join(JOB_TYPES)}")

    options: dict[str, Any] = {
        "site_name": sites,
        "search_term": search_term,
        "google_search_term": google_search_term,
        "location": location,
        "distance": distance if distance is not None else 50,
        "is_remote": is_remote,
        "job_type": job_type,
        "results_wanted": results_wanted,
        "hours_old": hours_old,
        "easy_apply": easy_apply,
        "offset": offset,
        "description_format": description_format,
        "enforce_annual_salary": enforce_annual_salary,
        "proxies": split_list(proxies) or DEFAULT_PROXIES or None,
        "verbose": 0,
    }
    if country_indeed:
        options["country_indeed"] = country_indeed
    # JobSpy 1.3 renamed linkedin_fetch_description; pass whichever this version knows.
    params = inspect.signature(scrape_jobs).parameters
    if "fetch_description" in params:
        options["fetch_description"] = fetch_description
    elif "linkedin_fetch_description" in params:
        options["linkedin_fetch_description"] = fetch_description

    log.info("Searching %s for %r in %r", ", ".join(sites), search_term, location)
    async with searches:
        try:
            frame = await run_in_threadpool(scrape_jobs, **options)
        except Exception as error:  # noqa: BLE001 - every scraper failure becomes a 502
            log.exception("Search failed")
            raise HTTPException(502, f"JobSpy failed: {error}") from error

    jobs = to_records(frame) if frame is not None else []
    return {"count": len(jobs), "jobs": jobs}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")), log_level="info")
