from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import pandas as pd

app = FastAPI(title="Emotion-Based Forecaster API")

# 1. Load the frozen brain
print("Loading AI Models...")
lower_model = joblib.load('assets/models/lower_model.pkl')
median_model = joblib.load('assets/models/median_model.pkl')
upper_model = joblib.load('assets/models/upper_model.pkl')

# 2. Define the input Sharad's UI will send us
class ForecastRequest(BaseModel):
    current_price: float
    current_sentiment: float
    current_hype_volume: int
    days_to_forecast: int = 30  # Default to 6 weeks (30 trading days)

# 3. The 1-6 Week Simulation Endpoint
@app.post("/forecast")
def generate_forecast(req: ForecastRequest):
    forecast_results = []
    
    # We start with the actual data from the UI
    simulated_price_lower = req.current_price
    simulated_price_median = req.current_price
    simulated_price_upper = req.current_price
    
    # We assume sentiment holds steady for this basic scenario test
    sim_sentiment = req.current_sentiment
    sim_hype = req.current_hype_volume
    
    # Loop for 1 to 6 weeks (depending on what Sharad requests)
    for day in range(1, req.days_to_forecast + 1):
        # Create a dataframe for the AI to read
        features = pd.DataFrame([{
            'Prev_Close': simulated_price_median, 
            'Prev_Sentiment': sim_sentiment, 
            'Prev_Hype': sim_hype
        }])
        
        # Predict the CHANGE for tomorrow
        change_lower = lower_model.predict(features)[0]
        change_median = median_model.predict(features)[0]
        change_upper = upper_model.predict(features)[0]
        
        # Add the change to the running total prices
        simulated_price_lower += change_lower
        simulated_price_median += change_median
        simulated_price_upper += change_upper
        
        # Save this day's results
        forecast_results.append({
            "day": day,
            "lower_bound": round(simulated_price_lower, 2),
            "likely_price": round(simulated_price_median, 2),
            "upper_bound": round(simulated_price_upper, 2)
        })
        
    return {
        "status": "success",
        "horizon_days": req.days_to_forecast,
        "forecast": forecast_results
    }