from fastapi import FastAPI, HTTPException
import openmeteo_requests
import requests_cache
from retry_requests import retry
import math
from pydantic import BaseModel
from datetime import datetime, timedelta
from prediction import (
    get_model_config,
    get_available_predictions,
    predict_model
)


app = FastAPI(
    title="AERIVA API",
    description="Air Pollution Prediction API",
    version="1.0.0"
)

cache_session = requests_cache.CachedSession(
    ".cache",
    expire_after=3600
)

retry_session = retry(
    cache_session,
    retries=5,
    backoff_factor=0.2
)

openmeteo = openmeteo_requests.Client(
    session=retry_session
)

locations = {
    "Surabaya": {
        "latitude": -7.32062855823035,
        "longitude": 112.7330345
    },
    "Pasuruan": {
        "latitude": -7.64262822182269,
        "longitude": 112.905360538744
    },
    "Malang": {
        "latitude": -7.90215270692051,
        "longitude": 112.561357925255
    },
    "Kediri": {
        "latitude": -7.81725998049425,
        "longitude": 112.013018709909
    },
    "Jember": {
        "latitude": -8.17271105338658,
        "longitude": 113.701550796421
    }
}

pollutants = {
    "PM2.5": "pm2_5",
    "CO": "carbon_monoxide",
    "NO2": "nitrogen_dioxide",
    "SO2": "sulphur_dioxide",
    "O3": "ozone"
}
scenarios = ["S1", "S2"]

@app.get("/")
def root():
    return {
        "message": "AERIVA API is running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok"
    }

@app.get("/prediction-options")
def prediction_options():
    return {
        "locations": list(locations.keys()),
        "pollutants": list(pollutants.keys()),
        "scenarios": scenarios,
        "available_predictions": get_available_predictions()
    }

def clean_values(values):
    result = []

    for value in values:
        value = float(value)

        if math.isnan(value):
            result.append(None)
        else:
            result.append(value)

    return result

@app.get("/pollution")
def get_pollution(location: str):

    if location not in locations:
        raise HTTPException(
            status_code=404,
            detail="Location not found"
        )

    latitude = locations[location]["latitude"]
    longitude = locations[location]["longitude"]

    url = "https://air-quality-api.open-meteo.com/v1/air-quality"

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": [
            "pm2_5",
            "carbon_monoxide",
            "nitrogen_dioxide",
            "sulphur_dioxide",
            "ozone"
        ],
        "timezone": "Asia/Jakarta"
    }

    responses = openmeteo.weather_api(
        url,
        params=params
    )

    response = responses[0]
    hourly = response.Hourly()

    return {
    "location": location,
    "latitude": float(response.Latitude()),
    "longitude": float(response.Longitude()),
    "timezone": response.Timezone().decode(),
    "hourly": {
        "pm2_5": clean_values(hourly.Variables(0).ValuesAsNumpy()),
        "carbon_monoxide": clean_values(hourly.Variables(1).ValuesAsNumpy()),
        "nitrogen_dioxide": clean_values(hourly.Variables(2).ValuesAsNumpy()),
        "sulphur_dioxide": clean_values(hourly.Variables(3).ValuesAsNumpy()),
        "ozone": clean_values(hourly.Variables(4).ValuesAsNumpy())
    }
}

class PredictionRequest(BaseModel):
    location: str
    pollutant: str
    scenario: str
    prediction_time: datetime



@app.post("/predict")
def predict(request: PredictionRequest):

    if request.location not in locations:
        raise HTTPException(
            status_code=404,
            detail=f"Location tidak ditemukan. Pilihan: {', '.join(locations)}"
        )

    if request.pollutant not in pollutants:
        raise HTTPException(
            status_code=400,
            detail=f"Pollutant tidak dikenal. Pilihan: {', '.join(pollutants)}"
        )

    if request.scenario not in scenarios:
        raise HTTPException(
            status_code=400,
            detail=f"Scenario tidak dikenal. Pilihan: {', '.join(scenarios)}"
        )

    model_config = get_model_config(
        request.location,
        request.pollutant,
        request.scenario
    )
    if model_config is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Model prediksi belum tersedia untuk kombinasi "
                f"{request.location}, {request.pollutant}, {request.scenario}. "
                "Kombinasi yang tersedia: "
                f"{get_available_predictions()}"
            )
        )
    prediction_time = request.prediction_time
    prediction_time = request.prediction_time

    latitude = locations[request.location]["latitude"]
    longitude = locations[request.location]["longitude"]
    max_lag = max(lag for _, lag in model_config.features.values())
    min_lag = min(lag for _, lag in model_config.features.values())
    time_start = prediction_time - timedelta(hours=max_lag)
    time_end = prediction_time - timedelta(hours=min_lag)
    hourly_variables = list(dict.fromkeys(
        variable for variable, _ in model_config.features.values()
    ))

    url = "https://air-quality-api.open-meteo.com/v1/air-quality"

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": hourly_variables,
        "timezone": "Asia/Jakarta",
        "start_hour": time_start.strftime("%Y-%m-%dT%H:%M"),
        "end_hour": time_end.strftime("%Y-%m-%dT%H:%M")
    }

    responses = openmeteo.weather_api(
        url,
        params=params
    )

    response = responses[0]
    hourly = response.Hourly()

    expected_hours = max_lag - min_lag + 1
    values_by_variable = {
        variable: clean_values(hourly.Variables(index).ValuesAsNumpy())
        for index, variable in enumerate(hourly_variables)
    }
    if any(len(values) < expected_hours for values in values_by_variable.values()):
        raise HTTPException(
            status_code=500,
            detail="Data polutan untuk waktu prediksi tidak lengkap"
        )

    input_values = {
        feature: values_by_variable[variable][max_lag - lag]
        for feature, (variable, lag) in model_config.features.items()
    }
    if any(value is None for value in input_values.values()):
        raise HTTPException(
            status_code=500,
            detail="Terdapat data polutan yang kosong"
        )

    prediction = predict_model(
        location=request.location,
        pollutant=request.pollutant,
        scenario=request.scenario,
        input_values=input_values
    )

    return {
        "status": "success",
        "location": request.location,
        "pollutant": request.pollutant,
        "scenario": request.scenario,
        "prediction_time": prediction_time.strftime(
            "%Y-%m-%dT%H:%M"
        ),
        "input": input_values,
        "prediction": prediction
    }