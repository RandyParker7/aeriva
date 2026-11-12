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
FINAL_MODELS = {
    "Surabaya": {
        "PM2.5": "S2",
        "CO": "S2",
        "NO2": "S2",
        "SO2": "S2",
        "O3": "S2",
    },
    "Pasuruan": {
        "PM2.5": "S2",
        "CO": "S1",
        "NO2": "S2",
        "SO2": "S2",
        "O3": "S1",
    },
    "Malang": {
        "PM2.5": "S2",
        "CO": "S2",
        "NO2": "S2",
        "SO2": "S2",
        "O3": "S2",
    },
    "Kediri": {
        "PM2.5": "S2",
        "CO": "S2",
        "NO2": "S1",
        "SO2": "S2",
        "O3": "S2",
    },
    "Jember": {
        "PM2.5": "S2",
        "CO": "S1",
        "NO2": "S2",
        "SO2": "S2",
        "O3": "S2",
    },
}


@dataclass(frozen=True)
class ModelConfig:
    path: Path
    features: dict[str, tuple[str, int]]


def _build_model_registry():
    registry = {}

    for location in LOCATIONS:
        for pollutant, model_prefix in POLLUTANT_MODEL_PREFIXES.items():
            pollutant_variable = POLLUTANT_VARIABLES[pollutant]
            for scenario in SCENARIOS:
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
                        / "model_tune"
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


def get_final_predictions():
    return [
        {
            "location": location,
            "pollutant": pollutant,
            "scenario": scenario,
        }
        for location, pollutant_scenarios in FINAL_MODELS.items()
        for pollutant, scenario in pollutant_scenarios.items()
    ]


def is_prediction_available(location, pollutant, scenario):
    return get_model_config(location, pollutant, scenario) is not None


def get_model_config(location, pollutant, scenario):
    return MODEL_REGISTRY.get((location, pollutant, scenario))


def _load_model(config):
    if not config.path.exists():
        raise FileNotFoundError(f"Model tidak ditemukan: {config.path}")

    model = joblib.load(config.path)
    expected_features = list(config.features)
    actual_feature_count = getattr(model, "n_features_in_", None)
    if actual_feature_count != len(expected_features):
        raise ValueError(
            f"Jumlah fitur model {config.path.name} tidak sesuai: "
            f"diharapkan {len(expected_features)}, ditemukan "
            f"{actual_feature_count}"
        )

    booster = getattr(model, "booster_", None)
    if booster is not None:
        actual_features = booster.feature_name()
        if actual_features != expected_features:
            raise ValueError(
                f"Urutan fitur model {config.path.name} tidak sesuai: "
                f"diharapkan {expected_features}, ditemukan {actual_features}"
            )

    return model


def predict_model(location, pollutant, scenario, input_values):
    return predict_models(location, pollutant, scenario, [input_values])[0]


def predict_model_with_explanation(location, pollutant, scenario, input_values):
    config = get_model_config(location, pollutant, scenario)

    if config is None:
        raise ValueError(
            f"Model belum tersedia untuk {location}, {pollutant}, {scenario}"
        )

    X_input = pd.DataFrame([input_values], columns=config.features)
    model = _load_model(config)
    prediction = float(model.predict(X_input)[0])

    from shap_explainer import explain_prediction

    interpretation = explain_prediction(model, X_input)
    return prediction, interpretation


def predict_models(location, pollutant, scenario, input_rows):
    config = get_model_config(location, pollutant, scenario)

    if config is None:
        raise ValueError(
            f"Model belum tersedia untuk {location}, {pollutant}, {scenario}"
        )

    X_input = pd.DataFrame(input_rows, columns=config.features)
    model = _load_model(config)

    return [float(prediction) for prediction in model.predict(X_input)]