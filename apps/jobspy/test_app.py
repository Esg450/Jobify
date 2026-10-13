"""Tests for the wrapper. JobSpy itself is replaced with a stub; nothing is scraped."""

import os

import pandas as pd
import pytest
from fastapi.testclient import TestClient

os.environ["API_KEYS"] = "secret"
os.environ["RETRY_DELAY_SECONDS"] = "0"

import app as service  # noqa: E402 - after the env var so auth is on


@pytest.fixture
def client(monkeypatch):
    calls = []

    def fake_scrape_jobs(**options):
        calls.append(options)
        if "indeed" not in options["site_name"]:
            return pd.DataFrame()
        return pd.DataFrame(
            [
                {
                    "id": "in-1",
                    "site": "indeed",
                    "job_url": "https://www.indeed.com/viewjob?jk=1",
                    "title": "Platform Engineer",
                    "company": "Acme",
                    "location": "Austin, TX, US",
                    "date_posted": pd.Timestamp("2026-10-01").date(),
                    "job_type": "fulltime",
                    "is_remote": False,
                    "interval": "yearly",
                    "min_amount": 150000.0,
                    "max_amount": float("nan"),
                    "currency": "USD",
                    "description": "# Role\n\nBuild things.",
                }
            ]
        )

    monkeypatch.setattr(service, "scrape_jobs", fake_scrape_jobs)
    test_client = TestClient(service.app)
    test_client.calls = calls
    return test_client


def test_ping_needs_no_key(client):
    assert client.get("/ping").json() == {"status": "ok"}


def test_health_reports_version_and_sites(client):
    assert client.get("/health").status_code == 403
    body = client.get("/health", headers={"x-api-key": "secret"}).json()
    assert body["status"] == "ok"
    assert body["jobspy"]
    assert "indeed" in body["sites"] and "linkedin" in body["sites"]


def test_search_passes_options_and_cleans_results(client):
    response = client.get(
        "/api/v1/search_jobs",
        params={
            "search_term": "platform engineer",
            "site_name": "indeed, linkedin",
            "location": "Austin, TX",
            "is_remote": "true",
            "hours_old": 72,
            "results_wanted": 5,
        },
        headers={"x-api-key": "secret"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["count"] == 1
    job = body["jobs"][0]
    assert job["title"] == "Platform Engineer"
    assert job["max_amount"] is None  # NaN became null
    assert job["min_amount"] == 150000.0
    assert job["date_posted"] == "2026-10-01"
    assert job["is_remote"] is False
    assert body["retried"] == ["linkedin"]  # the stub only ever answers for Indeed

    options, retry = client.calls
    assert retry["site_name"] == ["linkedin"]
    assert options["site_name"] == ["indeed", "linkedin"]
    assert options["search_term"] == "platform engineer"
    assert options["location"] == "Austin, TX"
    assert options["is_remote"] is True
    assert options["hours_old"] == 72
    assert options["results_wanted"] == 5
    assert options["description_format"] == "markdown"


def test_retries_only_the_boards_that_returned_nothing(client, monkeypatch):
    calls = []

    def flaky_scrape_jobs(**options):
        calls.append(options["site_name"])
        rows = [{"id": "in-1", "site": "indeed", "title": "A", "company": "Acme"}]
        if len(calls) > 1:  # LinkedIn only answers the second time
            rows.append({"id": "li-1", "site": "linkedin", "title": "B", "company": "Globex"})
        return pd.DataFrame([row for row in rows if row["site"] in options["site_name"]])

    monkeypatch.setattr(service, "scrape_jobs", flaky_scrape_jobs)
    body = client.get(
        "/api/v1/search_jobs",
        params={"search_term": "x", "site_name": "indeed,linkedin"},
        headers={"x-api-key": "secret"},
    ).json()
    assert calls == [["indeed", "linkedin"], ["linkedin"]]
    assert body["count"] == 2
    assert {job["site"] for job in body["jobs"]} == {"indeed", "linkedin"}
    assert body["retried"] == ["linkedin"]


def test_search_rejects_unknown_site(client):
    response = client.get(
        "/api/v1/search_jobs",
        params={"search_term": "x", "site_name": "monster"},
        headers={"x-api-key": "secret"},
    )
    assert response.status_code == 400
    assert "monster" in response.json()["detail"]


def test_search_requires_key(client):
    response = client.get("/api/v1/search_jobs", params={"search_term": "x"})
    assert response.status_code == 403


def test_scraper_failure_is_a_502(client, monkeypatch):
    def broken(**_options):
        raise RuntimeError("LinkedIn returned 429")

    monkeypatch.setattr(service, "scrape_jobs", broken)
    response = client.get(
        "/api/v1/search_jobs", params={"search_term": "x"}, headers={"x-api-key": "secret"}
    )
    assert response.status_code == 502
    assert "429" in response.json()["detail"]
