import numpy as np
import pandas as pd
import shap


def explain_prediction(model, input_data):
    if isinstance(input_data, pd.DataFrame):
        input_frame = input_data
    else:
        input_frame = pd.DataFrame([input_data])

    explainer = shap.TreeExplainer(model)
    shap_values = np.asarray(explainer.shap_values(input_frame))
    if shap_values.ndim != 2 or shap_values.shape[0] != 1:
        raise ValueError("SHAP hanya mendukung satu hasil prediksi regresi.")

    base_values = np.asarray(explainer.expected_value).reshape(-1)
    if base_values.size != 1:
        raise ValueError("SHAP mengembalikan base value yang tidak didukung.")

    features = [
        {
            "feature": feature,
            "value": float(input_frame.iloc[0][feature]),
            "shap_value": float(shap_values[0, index]),
            "impact": (
                "positive"
                if shap_values[0, index] > 0
                else "negative"
                if shap_values[0, index] < 0
                else "neutral"
            ),
        }
        for index, feature in enumerate(input_frame.columns)
    ]
    features.sort(key=lambda item: abs(item["shap_value"]), reverse=True)

    return {
        "base_value": float(base_values[0]),
        "features": features,
    }
