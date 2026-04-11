from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import joblib
import numpy as np

# ==========================================
# 1. API SETUP & CONFIGURATION
# ==========================================
app = FastAPI(
    title="Emotion-Based Market Forecaster API",
    description="NatWest Hackathon Backend - Sentiment-driven S&P 500 predictions.",
    version="2.0"
)

# Enable CORS so React frontend can talk to your API locally
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 2. LOAD AI MODELS & DATA (Update filenames)
# ==========================================
try:
    # Assuming you saved your scikit-learn GradientBoosting models using pickle
    lower_model = joblib.load("lower_model.pkl")
    median_model = joblib.load("median_model.pkl")
    upper_model = joblib.load("upper_model.pkl")
        
    # Load your cleaned historical dataframe for the Time Machine simulation
    historical_df = pd.read_csv("final_training_data.csv") 

    # --- NEW: Load the mega-cap sentiment data ---
    mega_cap_df = pd.read_csv("mega_cap_sentiment.csv")

    # Ensure Dates are strings so they merge perfectly
    historical_df['Date'] = historical_df['Date'].astype(str)
    mega_cap_df['Date'] = mega_cap_df['Date'].astype(str)

    # MERGE MAGIC: This combines both files based on the Date column!
    merged_df = pd.merge(historical_df, mega_cap_df, on='Date', how='left')

    # Fill any missing days with 0.0 (Neutral sentiment) to prevent API crashes
    merged_df = merged_df.fillna(0.0)

except Exception as e:
    print(f"Warning: Could not load models or data. Check your file paths! Error: {e}")

# ==========================================
# 3. DATA VALIDATION SCHEMAS
# ==========================================
class ForecastRequest(BaseModel):
    current_price: float
    current_sentiment: float
    current_hype_volume: float
    days_to_forecast: int = 30

# ==========================================
# 4. API ENDPOINTS
# ==========================================

@app.post("/forecast")
def generate_forecast(req: ForecastRequest):
    """
    Phase 1 Core Endpoint: Takes current market conditions and runs a 30-day 
    forward simulation, applying the Quantile Crossing Bouncer to guarantee logic.
    """
    forecast_results = []
    
    # Initialize the starting variables for the simulation loop
    simulated_price_median = req.current_price
    sim_sentiment = req.current_sentiment
    sim_hype = req.current_hype_volume

    for day in range(1, req.days_to_forecast + 1):
        # Create a dataframe row exactly how your model expects the input
        features = pd.DataFrame([{
            'Prev_Close': simulated_price_median, 
            'Prev_Sentiment': sim_sentiment, 
            'Prev_Hype': sim_hype
        }])
        
        # Predict the numerical *change* in price
        change_lower = lower_model.predict(features)[0]
        change_median = median_model.predict(features)[0]
        change_upper = upper_model.predict(features)[0]
        
        # Add the predicted changes to yesterday's closing price
        raw_lower_price = simulated_price_median + change_lower
        raw_median_price = simulated_price_median + change_median
        raw_upper_price = simulated_price_median + change_upper
        
        # --- THE BOUNCER: Fixes Quantile Crossing ---
        # Sorts the predictions so lower is ALWAYS lowest, and upper is ALWAYS highest
        sorted_prices = sorted([raw_lower_price, raw_median_price, raw_upper_price])
        
        simulated_price_lower = sorted_prices[0]
        simulated_price_median = sorted_prices[1] 
        simulated_price_upper = sorted_prices[2]
        
        # Append the clean data to our results array
        forecast_results.append({
            "day": day,
            "lower_bound": round(simulated_price_lower, 2),
            "likely_price": round(simulated_price_median, 2),
            "upper_bound": round(simulated_price_upper, 2)
        })
        
        # Simulate sentiment decay (optional: gradually pulls extreme sentiment back to 0 over 30 days)
        sim_sentiment = sim_sentiment * 0.90 

    return {
        "status": "success",
        "horizon_days": req.days_to_forecast,
        "forecast": forecast_results
    }


@app.get("/simulation-data")
def get_historical_simulation():
    try:
        simulation_list = []
        
        # --- NEW: Sort the merged_df instead of the old historical_df ---
        sorted_df = merged_df.sort_values(by='Date').reset_index(drop=True)
        
        for index, row in sorted_df.iterrows():
            # We use the models to create the 'historical prediction' for this day
            features = pd.DataFrame([{
                'Prev_Close': row['SP500_Close'], 
                'Prev_Sentiment': row['Daily_Emotion_Score'], 
                'Prev_Hype': row['Total_Hype_Volume']
            }])
            
            # Generate the bounds using your models
            p_lower = lower_model.predict(features)[0] + row['SP500_Close']
            p_median = median_model.predict(features)[0] + row['SP500_Close']
            p_upper = upper_model.predict(features)[0] + row['SP500_Close']
            
            # Apply the Bouncer to keep them in order
            sorted_p = sorted([p_lower, p_median, p_upper])

            simulation_list.append({
                "day_index": index,
                "date": str(row['Date']),
                "actual_price": round(row['SP500_Close'], 2), # Matches your Column E
                "predicted_likely": round(sorted_p[1], 2), 
                "lower_bound": round(sorted_p[0], 2),
                "upper_bound": round(sorted_p[2], 2),
                "sentiment_score": round(row['Daily_Emotion_Score'], 2), # Matches your Column B
                
                # --- NEW MEGA CAP DATA EXPORT ---
                "apple_sentiment": round(row['apple_sent'], 3),
                "tesla_sentiment": round(row['tesla_sent'], 3),
                "microsoft_sentiment": round(row['msft_sent'], 3),
                "amazon_sentiment": round(row['amzn_sent'], 3),
                "nvidia_sentiment": round(row['nvda_sent'], 3)
            })
            
        return {
            "status": "success",
            "total_days": len(simulation_list),
            "simulation_data": simulation_list
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process historical data: {str(e)}")