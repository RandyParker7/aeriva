from fastapi import FastAPI, HTTPException
import openmeteo_requests
import requests_cache
from retry_requests import retry
import math
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from prediction import predict_pm25_surabaya
from pydantic import BaseModel
from datetime import datetime, timedelta
from prediction import predict_pm25_surabaya


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

    if request.location != "Surabaya":
        raise HTTPException(
            status_code=400,
            detail="Untuk sementara prediction hanya tersedia untuk Surabaya"
        )

    if request.pollutant != "PM2.5":
        raise HTTPException(
            status_code=400,
            detail="Untuk sementara prediction hanya tersedia untuk PM2.5"
        )

    if request.scenario != "S1":
        raise HTTPException(
            status_code=400,
            detail="Untuk sementara prediction hanya tersedia untuk S1"
        )

    prediction_time = request.prediction_time

    # 3 jam sebelum waktu prediksi
    time_lag3 = prediction_time - timedelta(hours=3)
    time_lag2 = prediction_time - timedelta(hours=2)
    time_lag1 = prediction_time - timedelta(hours=1)

    # Ambil data dari Open-Meteo
    latitude = locations["Surabaya"]["latitude"]
    longitude = locations["Surabaya"]["longitude"]

    url = "https://air-quality-api.open-meteo.com/v1/air-quality"

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": [
            "pm2_5"
        ],
        "timezone": "Asia/Jakarta",
        "start_hour": time_lag3.strftime("%Y-%m-%dT%H:%M"),
        "end_hour": time_lag1.strftime("%Y-%m-%dT%H:%M")
    }

    responses = openmeteo.weather_api(
        url,
        params=params
    )

    response = responses[0]
    hourly = response.Hourly()

    pm25_values = clean_values(
        hourly.Variables(0).ValuesAsNumpy()
    )

    if len(pm25_values) < 3:
        raise HTTPException(
            status_code=500,
            detail="Data PM2.5 3 jam sebelumnya tidak lengkap"
        )

    lag3 = pm25_values[0]
    lag2 = pm25_values[1]
    lag1 = pm25_values[2]

    if lag1 is None or lag2 is None or lag3 is None:
        raise HTTPException(
            status_code=500,
            detail="Terdapat data PM2.5 yang kosong"
        )

    prediction = predict_pm25_surabaya(
        lag1=lag1,
        lag2=lag2,
        lag3=lag3
    )

    return {
        "status": "success",
        "location": "Surabaya",
        "pollutant": "PM2.5",
        "scenario": "S1",
        "prediction_time": prediction_time.strftime(
            "%Y-%m-%dT%H:%M"
        ),
        "input": {
            "PM2.5_lag1": lag1,
            "PM2.5_lag2": lag2,
            "PM2.5_lag3": lag3
        },
        "prediction": prediction
    }