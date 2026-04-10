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

# 2. Define the input UI  will send us
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
    
    # Loop for 1 to 6 weeks
    for day in range(1, req.days_to_forecast + 1):
        features = pd.DataFrame([{
            'Prev_Close': simulated_price_median, 
            'Prev_Sentiment': sim_sentiment, 
            'Prev_Hype': sim_hype
        }])
        
        # 1. Get raw predictions
        change_lower = lower_model.predict(features)[0]
        change_median = median_model.predict(features)[0]
        change_upper = upper_model.predict(features)[0]
        
        # 2. Add changes to the running price
        raw_lower_price = simulated_price_median + change_lower
        raw_median_price = simulated_price_median + change_median
        raw_upper_price = simulated_price_median + change_upper
        
        # 3. THE FIX: The Quantile Crossing Bouncer
        # We put the three prices in a list and sort them from lowest to highest.
        # This guarantees the bounds never cross each other, even in extreme scenarios.
        sorted_prices = sorted([raw_lower_price, raw_median_price, raw_upper_price])
        
        simulated_price_lower = sorted_prices[0]  # Guaranteed lowest
        simulated_price_median = sorted_prices[1] # Guaranteed middle
        simulated_price_upper = sorted_prices[2]  # Guaranteed highest
        
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