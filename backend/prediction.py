import joblib
import pandas as pd
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent

MODEL_PATH = (
    BASE_DIR
    / "model"
    / "PM25_Surabaya_S1.joblib"
)


def predict_pm25_surabaya(lag1, lag2, lag3):

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model tidak ditemukan: {MODEL_PATH}"
        )

    model = joblib.load(MODEL_PATH)

    X_input = pd.DataFrame([{
        "PM2.5_lag1": lag1,
        "PM2.5_lag2": lag2,
        "PM2.5_lag3": lag3
    }])

    prediction = model.predict(X_input)[0]

    return float(prediction)