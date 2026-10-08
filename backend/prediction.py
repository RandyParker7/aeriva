import joblib
import pandas as pd
from dataclasses import dataclass
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent


@dataclass(frozen=True)
class ModelConfig:
    path: Path
    # Maps each model input column to an Open-Meteo variable and hour lag.
    features: dict[str, tuple[str, int]]


MODEL_REGISTRY = {
    ("Surabaya", "PM2.5", "S1"): ModelConfig(
        path=BASE_DIR / "model" / "PM25_Surabaya_S1.joblib",
        features={
            "PM2.5_lag1": ("pm2_5", 1),
            "PM2.5_lag2": ("pm2_5", 2),
            "PM2.5_lag3": ("pm2_5", 3)
        }
    )
}


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