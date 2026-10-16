import math
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from prediction import get_model_config, predict_models


class EvaluationRequest(BaseModel):
    location: str
    pollutant: str
    prediction_time: datetime


def _clean_values(values):
    return [
        None if math.isnan(float(value)) else float(value)
        for value in values
    ]


def _calculate_metrics(actuals, predicted):
    errors = [
        actual - prediction
        for actual, prediction in zip(actuals, predicted)
    ]
    mae = sum(abs(error) for error in errors) / len(errors)
    rmse = math.sqrt(sum(error ** 2 for error in errors) / len(errors))
    nonzero_actuals = [
        (actual, prediction)
        for actual, prediction in zip(actuals, predicted)
        if actual != 0
    ]
    mape = (
        sum(
            abs((actual - prediction) / actual) * 100
            for actual, prediction in nonzero_actuals
        ) / len(nonzero_actuals)
        if nonzero_actuals
        else None
    )
    mean_actual = sum(actuals) / len(actuals)
    total_variation = sum(
        (actual - mean_actual) ** 2 for actual in actuals
    )
    r2 = (
        1 - sum(error ** 2 for error in errors) / total_variation
        if total_variation
        else None
    )
    return {"mae": mae, "mape": mape, "rmse": rmse, "r2": r2}


def create_evaluation_router(
    openmeteo,
    locations,
    pollutants,
    meteorological_variables,
    scenarios
):
    router = APIRouter()

    @router.post("/evaluation")
    def evaluate(request: EvaluationRequest):
        if request.location not in locations:
            raise HTTPException(
                status_code=404,
                detail=(
                    "Location tidak ditemukan. Pilihan: "
                    f"{', '.join(locations)}"
                )
            )

        if request.pollutant not in pollutants:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Pollutant tidak dikenal. Pilihan: "
                    f"{', '.join(pollutants)}"
                )
            )

        model_configs = {
            scenario: get_model_config(
                request.location,
                request.pollutant,
                scenario
            )
            for scenario in scenarios
        }
        if any(config is None for config in model_configs.values()):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Model S1 dan S2 harus tersedia untuk kombinasi "
                    f"{request.location} dan {request.pollutant}."
                )
            )

        jakarta_timezone = ZoneInfo("Asia/Jakarta")
        evaluation_end = request.prediction_time
        if evaluation_end.tzinfo is None:
            evaluation_end = evaluation_end.replace(tzinfo=jakarta_timezone)
        else:
            evaluation_end = evaluation_end.astimezone(jakarta_timezone)
        if evaluation_end > datetime.now(jakarta_timezone):
            raise HTTPException(
                status_code=400,
                detail="Waktu evaluasi tidak boleh berada di masa depan."
            )

        evaluation_start = evaluation_end - timedelta(hours=23)
        feature_start = evaluation_start - timedelta(hours=3)
        latitude = locations[request.location]["latitude"]
        longitude = locations[request.location]["longitude"]
        pollutant_variable = pollutants[request.pollutant]

        pollutant_response = openmeteo.weather_api(
            "https://air-quality-api.open-meteo.com/v1/air-quality",
            params={
                "latitude": latitude,
                "longitude": longitude,
                "hourly": [pollutant_variable],
                "timezone": "Asia/Jakarta",
                "start_hour": feature_start.strftime("%Y-%m-%dT%H:%M"),
                "end_hour": evaluation_end.strftime("%Y-%m-%dT%H:%M")
            }
        )[0]
        pollutant_hourly = pollutant_response.Hourly()
        pollutant_values = _clean_values(
            pollutant_hourly.Variables(0).ValuesAsNumpy()
        )
        if len(pollutant_values) < 27:
            raise HTTPException(
                status_code=500,
                detail="Data polutan untuk periode evaluasi tidak lengkap."
            )

        weather_start_date = feature_start.date()
        weather_variables = list(meteorological_variables.values())
        weather_response = openmeteo.weather_api(
            "https://archive-api.open-meteo.com/v1/archive",
            params={
                "latitude": latitude,
                "longitude": longitude,
                "hourly": weather_variables,
                "timezone": "Asia/Jakarta",
                "start_date": weather_start_date.strftime("%Y-%m-%d"),
                "end_date": evaluation_end.date().strftime("%Y-%m-%d")
            }
        )[0]
        weather_hourly = weather_response.Hourly()
        weather_values = {
            variable: _clean_values(
                weather_hourly.Variables(index).ValuesAsNumpy()
            )
            for index, variable in enumerate(weather_variables)
        }

        input_rows = {scenario: [] for scenario in scenarios}
        actual_values = []
        timestamps = []
        for point_index in range(24):
            actual_index = point_index + 3
            actual = pollutant_values[actual_index]
            point_time = evaluation_start + timedelta(hours=point_index)
            rows_for_point = {}

            for scenario, config in model_configs.items():
                row = {}
                for feature, (variable, lag) in config.features.items():
                    if variable == pollutant_variable:
                        value = pollutant_values[actual_index - lag]
                    else:
                        feature_time = point_time - timedelta(hours=lag)
                        hour_index = (
                            (feature_time.date() - weather_start_date).days * 24
                            + feature_time.hour
                        )
                        variable_values = weather_values[variable]
                        value = (
                            variable_values[hour_index]
                            if 0 <= hour_index < len(variable_values)
                            else None
                        )
                    row[feature] = value
                rows_for_point[scenario] = row

            if actual is None or any(
                value is None
                for row in rows_for_point.values()
                for value in row.values()
            ):
                raise HTTPException(
                    status_code=500,
                    detail=(
                        "Data aktual atau fitur model tidak lengkap pada "
                        f"{point_time.strftime('%Y-%m-%dT%H:%M')}."
                    )
                )

            actual_values.append(actual)
            timestamps.append(point_time)
            for scenario in scenarios:
                input_rows[scenario].append(rows_for_point[scenario])

        predictions = {
            scenario: predict_models(
                request.location,
                request.pollutant,
                scenario,
                input_rows[scenario]
            )
            for scenario in scenarios
        }

        return {
            "status": "success",
            "location": request.location,
            "pollutant": request.pollutant,
            "start_time": timestamps[0].strftime("%Y-%m-%dT%H:%M"),
            "end_time": timestamps[-1].strftime("%Y-%m-%dT%H:%M"),
            "metrics": {
                scenario: _calculate_metrics(
                    actual_values,
                    predictions[scenario]
                )
                for scenario in scenarios
            },
            "points": [
                {
                    "time": timestamp.strftime("%Y-%m-%dT%H:%M"),
                    "actual": actual,
                    "prediction_s1": predictions["S1"][index],
                    "prediction_s2": predictions["S2"][index]
                }
                for index, (timestamp, actual) in enumerate(
                    zip(timestamps, actual_values)
                )
            ]
        }

    return router
