import joblib
import pandas as pd
from dataclasses import dataclass
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent

LOCATIONS = ("Surabaya", "Pasuruan", "Malang", "Kediri", "Jember")
POLLUTANT_MODEL_PREFIXES = {
    "PM2.5": "PM25",
    "CO": "CO",
    "NO2": "NO2",
    "SO2": "SO2",
    "O3": "O3",
}
POLLUTANT_VARIABLES = {
    "PM2.5": "pm2_5",
    "CO": "carbon_monoxide",
    "NO2": "nitrogen_dioxide",
    "SO2": "sulphur_dioxide",
    "O3": "ozone",
}
METEOROLOGICAL_VARIABLES = {
    "temperature": "temperature_2m",
    "humidity": "relative_humidity_2m",
    "rain": "rain",
    "pressure": "surface_pressure",
    "wind_speed": "wind_speed_10m",
    "wind_direction": "wind_direction_10m",
}
SCENARIOS = ("S1", "S2")


@dataclass(frozen=True)
class ModelConfig:
    path: Path
    features: dict[str, tuple[str, int]]


def _build_model_registry():
    registry = {}

    for location in LOCATIONS:
        for pollutant, model_prefix in POLLUTANT_MODEL_PREFIXES.items():
            for scenario in SCENARIOS:
                pollutant_variable = POLLUTANT_VARIABLES[pollutant]
                features = {
                    f"{pollutant}_lag{lag}": (pollutant_variable, lag)
                    for lag in range(1, 4)
                }

                if scenario == "S2":
                    features.update({
                        f"{name}_lag{lag}": (variable, lag)
                        for name, variable in METEOROLOGICAL_VARIABLES.items()
                        for lag in range(1, 4)
                    })

                registry[(location, pollutant, scenario)] = ModelConfig(
                    path=(
                        BASE_DIR
                        / "model"
                        / f"{model_prefix}_{location}_{scenario}.joblib"
                    ),
                    features=features,
                )

    return registry


MODEL_REGISTRY = _build_model_registry()


def get_available_predictions():
    return [
        {
            "location": location,
            "pollutant": pollutant,
            "scenario": scenario
        }
        for location, pollutant, scenario in MODEL_REGISTRY
    ]


def is_prediction_available(location, pollutant, scenario):
    return get_model_config(location, pollutant, scenario) is not None


def get_model_config(location, pollutant, scenario):
    return MODEL_REGISTRY.get((location, pollutant, scenario))


def predict_model(location, pollutant, scenario, input_values):
    config = get_model_config(location, pollutant, scenario)

    if config is None:
        raise ValueError(
            f"Model belum tersedia untuk {location}, {pollutant}, {scenario}"
        )

    if not config.path.exists():
        raise FileNotFoundError(
            f"Model tidak ditemukan: {config.path}"
        )

    X_input = pd.DataFrame([input_values], columns=config.features)
    model = joblib.load(config.path)

    prediction = model.predict(X_input)[0]

    return float(prediction)