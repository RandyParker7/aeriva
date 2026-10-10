# Aeriva — AGENTS.md

This file contains high-signal guidance for future OpenCode sessions working
in this repository. Every line was verified against the codebase.

## Monorepo structure

This repo has two distinct parts that must both be running for the full app:

- **frontend/** — React + Vite single-page app (ports default: 5173)
- **backend/** — FastAPI air-pollution prediction API (port default: 8000)

Neither works in isolation; the frontend calls the backend API.

## Frontend (React + Vite)

| Command | Action |
|---------|--------|
| `npm run dev` | Start Vite dev server at http://localhost:5173 |
| `npm run build` | Produce production build in `frontend/dist/` |
| `npm run lint` | Run ESLint on source |
| `npm run preview` | Serve the production build locally |

**Gotchas:**
- Source is in `frontend/src/`: `main.jsx`, `sidebar.jsx`, and page components
- `sidebar.jsx` wires navigation (`Prediction`, `Evaluation`, `Information`, `About`)
- The app uses `react-dom/client` with `StrictMode`
- ESLint config includes `react-hooks` and `react-refresh` plugins
- No TypeScript — `.js` and `.jsx` files are plain JavaScript

## Backend (FastAPI / Python)

**Prerequisite:** The `.venv` virtual environment must be active.

| Command | Action |
|---------|--------|
| `.\.venv\Scripts\activate` | Activate the backend venv |
| `uvicorn main:app --reload` | Start the API at http://127.0.0.1:8000 |
| `curl http://127.0.0.1:8000/docs` | Open interactive OpenAPI docs |

**Key endpoints:**
- `GET /` — "AERIVA API is running"
- `GET /health` — `{"status": "ok"}`
- `GET /prediction-options` — lists locations, pollutants, scenarios, and available model combos
- `GET /pollution?location=Surabaya` — fetches real-time air-quality data from Open-Meteo
- `POST /predict` — ML prediction; body JSON with `location`, `pollutant`, `scenario`, `prediction_time`

**Model data:**
- Only one model exists: `PM25_Surabaya_S1.joblib` at `backend/model/`
- Trained on Surabaya PM2.5, scenario S1, with lag features `PM2.5_lag1/2/3`
- `prediction.py` `MODEL_REGISTRY` maps `(location, pollutant, scenario)` → `ModelConfig`
- If you add a new model, also add its entry to `MODEL_REGISTRY` in `prediction.py`
- The model is loaded via `joblib.load()`; input is a DataFrame with column names matching `features` keys

**External dependencies:**
- Calls Open-Meteo API (`air-quality-api.open-meteo.com`) for hourly air-quality data
- Uses `requests_cache` with a `.cache` sqlite file and `retry_requests` with 5 retries
- Cache expires after 3600 seconds; cached responses live in `.cache/`
- If the external API is down, `GET /pollution` and `POST /predict` will fail

## Full workflow (development)

1. Start the backend: `cd backend && .\.venv\Scripts\activate && uvicorn main:app --reload`
2. Start the frontend: `cd frontend && npm run dev`
3. Visit http://localhost:5173 to use the UI
4. API docs at http://127.0.0.1:8000/docs

**Order matters:** Start the backend first; the frontend polls it for prediction options and pollution data.

## Common pitfalls

- **Forgetting to activate `.venv`** — the backend Python won't find `fastapi`, `uvicorn`, `joblib`, etc.
- **Model not found** — if you modify `MODEL_REGISTRY` without placing the corresponding `.joblib` file, `get_model_config()` returns `None` and the API returns 400.
- **Stale cache** — `.cache.sqlite` may serve outdated air-quality data; delete it to force a fresh Open-Meteo request.
- **Prediction time window** — `POST /predict` computes `time_start`/`time_end` from the requested time and the model's min/max lag. If the Open-Meteo API doesn't have data for that window, you'll get a 500 error.
- **Location/pollutant/scenario combo** — only `("Surabaya", "PM2.5", "S1")` is currently available. Other combinations exist in the options list but have no model behind them.