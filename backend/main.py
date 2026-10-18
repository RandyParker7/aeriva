from fastapi import FastAPI, HTTPException
import openmeteo_requests
import requests_cache
from retry_requests import retry
import math
from pydantic import BaseModel
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from prediction import (
    get_model_config,
    get_available_predictions,
    predict_model_with_explanation,
    POLLUTANT_VARIABLES as pollutants,
    METEOROLOGICAL_VARIABLES,
    SCENARIOS as scenarios,
)
from evaluation import create_evaluation_router


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

@app.get("/prediction-options")
def prediction_options():
    return {
        "locations": list(locations.keys()),
        "location_coordinates": locations,
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

@app.get("/current-conditions")
def get_current_conditions(location: str):
    if location not in locations:
        raise HTTPException(
            status_code=404,
            detail="Location not found"
        )

    latitude = locations[location]["latitude"]
    longitude = locations[location]["longitude"]
    timezone = "Asia/Jakarta"

    pollutant_variables = list(pollutants.values())
    pollutant_response = openmeteo.weather_api(
        "https://air-quality-api.open-meteo.com/v1/air-quality",
        params={
            "latitude": latitude,
            "longitude": longitude,
            "current": pollutant_variables,
            "timezone": timezone
        }
    )[0]
    weather_variables = list(METEOROLOGICAL_VARIABLES.values())
    weather_response = openmeteo.weather_api(
        "https://api.open-meteo.com/v1/forecast",
        params={
            "latitude": latitude,
            "longitude": longitude,
            "current": weather_variables,
            "timezone": timezone
        }
    )[0]

    pollutant_current = pollutant_response.Current()
    weather_current = weather_response.Current()
    current_time = datetime.fromtimestamp(
        weather_current.Time(),
        tz=ZoneInfo(timezone)
    ).strftime("%Y-%m-%dT%H:%M")
    values = {
        variable: clean_values([
            pollutant_current.Variables(index).Value()
        ])[0]
        for index, variable in enumerate(pollutant_variables)
    }
    values.update({
        variable: clean_values([
            weather_current.Variables(index).Value()
        ])[0]
        for index, variable in enumerate(weather_variables)
    })

    return {
        "location": location,
        "latitude": latitude,
        "longitude": longitude,
        "updated_at": current_time,
        "values": values
    }

class PredictionRequest(BaseModel):
    location: str
    pollutant: str
    scenario: str
    prediction_time: datetime

@app.post("/prediction")
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
    jakarta_timezone = ZoneInfo("Asia/Jakarta")
    prediction_time = request.prediction_time
    if prediction_time.tzinfo is None:
        prediction_time = prediction_time.replace(tzinfo=jakarta_timezone)
    else:
        prediction_time = prediction_time.astimezone(jakarta_timezone)

    latitude = locations[request.location]["latitude"]
    longitude = locations[request.location]["longitude"]
    feature_values = {}
    pollutant_variable_names = set(pollutants.values())
    pollutant_features = {
        feature: (variable, lag)
        for feature, (variable, lag) in model_config.features.items()
        if variable in pollutant_variable_names
    }
    weather_features = {
        feature: (variable, lag)
        for feature, (variable, lag) in model_config.features.items()
        if variable in METEOROLOGICAL_VARIABLES.values()
    }

    if pollutant_features:
        pollutant_lags = [lag for _, lag in pollutant_features.values()]
        max_pollutant_lag = max(pollutant_lags)
        min_pollutant_lag = min(pollutant_lags)
        time_start = prediction_time - timedelta(hours=max_pollutant_lag)
        time_end = prediction_time - timedelta(hours=min_pollutant_lag)
        latest_supported_date = (
            datetime.now(jakarta_timezone).date() + timedelta(days=5)
        )
        if time_end.date() > latest_supported_date:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Data polutan untuk prediksi hanya tersedia hingga "
                    f"{latest_supported_date.isoformat()}"
                )
            )
        pollutant_variables = list(dict.fromkeys(
            variable for variable, _ in pollutant_features.values()
        ))
        pollutant_url = (
            "https://air-quality-api.open-meteo.com/v1/air-quality"
        )
        pollutant_params = {
            "latitude": latitude,
            "longitude": longitude,
            "hourly": pollutant_variables,
            "timezone": "Asia/Jakarta",
            "start_hour": time_start.strftime("%Y-%m-%dT%H:%M"),
            "end_hour": time_end.strftime("%Y-%m-%dT%H:%M")
        }
        pollutant_response = openmeteo.weather_api(
            pollutant_url,
            params=pollutant_params
        )[0]
        pollutant_hourly = pollutant_response.Hourly()
        pollutant_values = {
            variable: clean_values(
                pollutant_hourly.Variables(index).ValuesAsNumpy()
            )
            for index, variable in enumerate(pollutant_variables)
        }
        expected_pollutant_hours = (
            max_pollutant_lag - min_pollutant_lag + 1
        )
        if any(
            len(values) < expected_pollutant_hours
            for values in pollutant_values.values()
        ):
            raise HTTPException(
                status_code=500,
                detail="Data polutan untuk waktu prediksi tidak lengkap"
            )

        feature_values.update({
            feature: pollutant_values[variable][max_pollutant_lag - lag]
            for feature, (variable, lag) in pollutant_features.items()
        })

    if weather_features:
        weather_lags = [lag for _, lag in weather_features.values()]
        weather_start = prediction_time - timedelta(hours=max(weather_lags))
        weather_end = prediction_time - timedelta(hours=min(weather_lags))
        weather_variables = list(dict.fromkeys(
            variable for variable, _ in weather_features.values()
        ))
        weather_params = {
            "latitude": latitude,
            "longitude": longitude,
            "hourly": weather_variables,
            "timezone": "Asia/Jakarta",
        }
        today = datetime.now(jakarta_timezone).date()
        if weather_end.date() < today:
            weather_url = "https://archive-api.open-meteo.com/v1/archive"
            weather_params.update({
                "start_date": weather_start.strftime("%Y-%m-%d"),
                "end_date": weather_end.strftime("%Y-%m-%d"),
            })
        else:
            forecast_days = (weather_end.date() - today).days + 1
            if forecast_days > 16:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Data meteorologi untuk prediksi hanya tersedia "
                        "hingga 16 hari ke depan"
                    )
                )

            weather_url = "https://api.open-meteo.com/v1/forecast"
            weather_params["forecast_days"] = forecast_days
            past_days = (today - weather_start.date()).days
            if past_days > 0:
                weather_params["past_days"] = past_days

        weather_response = openmeteo.weather_api(
            weather_url,
            params=weather_params
        )[0]
        weather_hourly = weather_response.Hourly()
        weather_values = {
            variable: clean_values(
                weather_hourly.Variables(index).ValuesAsNumpy()
            )
            for index, variable in enumerate(weather_variables)
        }
        weather_series_start = datetime.fromtimestamp(
            weather_hourly.Time(),
            tz=jakarta_timezone
        )
        weather_feature_values = {}
        for feature, (variable, lag) in weather_features.items():
            feature_time = prediction_time - timedelta(hours=lag)
            hour_index = int(
                (feature_time - weather_series_start).total_seconds() // 3600
            )
            variable_values = weather_values[variable]
            if hour_index < 0 or hour_index >= len(variable_values):
                raise HTTPException(
                    status_code=500,
                    detail="Data meteorologi untuk waktu prediksi tidak lengkap"
                )
            weather_feature_values[feature] = variable_values[hour_index]

        feature_values.update(weather_feature_values)

    input_values = {
        feature: feature_values[feature]
        for feature in model_config.features
    }
    missing_features = [
        feature
        for feature, value in input_values.items()
        if value is None
    ]
    if missing_features:
        raise HTTPException(
            status_code=400,
            detail=(
                "Data tidak tersedia untuk fitur "
                f"{', '.join(missing_features)} pada waktu prediksi ini"
            )
        )

    prediction, interpretation = predict_model_with_explanation(
        location=request.location,
        pollutant=request.pollutant,
        scenario=request.scenario,
        input_values=input_values
    )

    return {
        "status": "success",
        "location": request.location,
        "latitude": latitude,
        "longitude": longitude,
        "pollutant": request.pollutant,
        "scenario": request.scenario,
        "prediction_time": prediction_time.strftime(
            "%Y-%m-%dT%H:%M"
        ),
        "previous_hour_pollutant": {
            "time": (prediction_time - timedelta(hours=1)).strftime(
                "%Y-%m-%dT%H:%M"
            ),
            "value": input_values[f"{request.pollutant}_lag1"],
        },
        "input": input_values,
        "interpretation": interpretation,
        "prediction": prediction
    }


app.include_router(create_evaluation_router(
    openmeteo=openmeteo,
    locations=locations,
    pollutants=pollutants,
    meteorological_variables=METEOROLOGICAL_VARIABLES,
    scenarios=scenarios
))