# Jobify JobSpy

A small HTTP service that lets Jobify's **Find jobs** page search Indeed, LinkedIn, Glassdoor,
ZipRecruiter, Google and other boards through [JobSpy](https://github.com/speedyapply/JobSpy).
It runs as a second container next to Jobify; see the
[Job search section of the main README](../../README.md#job-search) for setup.

Image: `ghcr.io/esg450/jobify-jobspy`

## Configuration

| Variable                  | Default | Description                                                                                    |
| ------------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| `API_KEYS`                | _unset_ | Comma-separated keys accepted in the `x-api-key` header. Unset means no authentication.        |
| `PORT`                    | `8000`  | Port to listen on.                                                                             |
| `DEFAULT_PROXIES`         | _unset_ | Comma-separated proxies (`user:pass@host:port`) used for every search. Helps with rate limits. |
| `MAX_RESULTS`             | `100`   | The most results one search may ask for.                                                       |
| `MAX_CONCURRENT_SEARCHES` | `2`     | How many searches run at the same time; the rest wait.                                         |
| `RETRY_EMPTY_BOARDS`      | `1`     | How many times to retry a board that returned nothing before giving up on it.                  |
| `RETRY_DELAY_SECONDS`     | `3`     | How long to wait before such a retry.                                                          |
| `LOG_LEVEL`               | `INFO`  | Python log level.                                                                              |

## Endpoints

- `GET /ping` — liveness check, no key needed.
- `GET /health` — JobSpy version and the sites it supports.
- `GET /api/v1/search_jobs?search_term=…` — search. Accepts JobSpy's options as query parameters
  (`site_name`, `location`, `is_remote`, `hours_old`, `job_type`, `results_wanted`, `country_indeed`,
  …) and returns `{ "count": n, "jobs": [...], "retried": [...] }` with JobSpy's columns. `retried`
  lists the boards that returned nothing on the first attempt and were tried again.

The paths and header match the community [jobspy-api](https://github.com/rainmanjam/jobspy-api)
project, so Jobify can talk to that too.

## Development

```sh
cd apps/jobspy
python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
pytest
API_KEYS=dev python app.py
```
