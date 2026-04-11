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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 2. LOAD AI MODELS & DATA (With Radar Logic)
# ==========================================
try:
    lower_model = joblib.load("lower_model.pkl")
    median_model = joblib.load("median_model.pkl")
    upper_model = joblib.load("upper_model.pkl")
        
    historical_df = pd.read_csv("final_training_data.csv") 
    mega_cap_df = pd.read_csv("mega_cap_sentiment.csv")

    historical_df['Date'] = historical_df['Date'].astype(str)
    mega_cap_df['Date'] = mega_cap_df['Date'].astype(str)

    merged_df = pd.merge(historical_df, mega_cap_df, on='Date', how='left')
    merged_df = merged_df.fillna(0.0)

    # --- NEW: EARLY WARNING RADAR LOGIC ---
    # Sort chronologically so rolling math works correctly
    merged_df = merged_df.sort_values(by='Date').reset_index(drop=True)
    
    # Calculate 7-Day Rolling Mean and Standard Deviation for Sentiment
    merged_df['Rolling_Mean'] = merged_df['Daily_Emotion_Score'].rolling(window=7, min_periods=1).mean()
    merged_df['Rolling_Std'] = merged_df['Daily_Emotion_Score'].rolling(window=7, min_periods=1).std().fillna(0)
    
    # Calculate Z-Score (safely handling division by zero)
    merged_df['Z_Score'] = np.where(
        merged_df['Rolling_Std'] > 0,
        (merged_df['Daily_Emotion_Score'] - merged_df['Rolling_Mean']) / merged_df['Rolling_Std'],
        0
    )
    
    # Tag anomalies based on Z-Score
    merged_df['Anomaly_Status'] = "NORMAL"
    merged_df.loc[merged_df['Z_Score'] <= -2.0, 'Anomaly_Status'] = "CRITICAL_FEAR"
    merged_df.loc[merged_df['Z_Score'] >= 2.0, 'Anomaly_Status'] = "EXTREME_HYPE"

except Exception as e:
    print(f"Warning: Could not load models or data. Error: {e}")

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
    forecast_results = []
    
    simulated_price_median = req.current_price
    sim_sentiment = req.current_sentiment
    sim_hype = req.current_hype_volume

    for day in range(1, req.days_to_forecast + 1):
        features = pd.DataFrame([{
            'Prev_Close': simulated_price_median, 
            'Prev_Sentiment': sim_sentiment, 
            'Prev_Hype': sim_hype
        }])
        
        change_lower = lower_model.predict(features)[0]
        change_median = median_model.predict(features)[0]
        change_upper = upper_model.predict(features)[0]
        
        raw_lower_price = simulated_price_median + change_lower
        raw_median_price = simulated_price_median + change_median
        raw_upper_price = simulated_price_median + change_upper
        
        # Bouncer Logic
        sorted_prices = sorted([raw_lower_price, raw_median_price, raw_upper_price])
        simulated_price_lower = sorted_prices[0]
        simulated_price_median = sorted_prices[1] 
        simulated_price_upper = sorted_prices[2]
        
        forecast_results.append({
            "day": day,
            "lower_bound": round(simulated_price_lower, 2),
            "likely_price": round(simulated_price_median, 2),
            "upper_bound": round(simulated_price_upper, 2)
        })
        
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
        
        for index, row in merged_df.iterrows():
            features = pd.DataFrame([{
                'Prev_Close': row['SP500_Close'], 
                'Prev_Sentiment': row['Daily_Emotion_Score'], 
                'Prev_Hype': row['Total_Hype_Volume']
            }])
            
            p_lower = lower_model.predict(features)[0] + row['SP500_Close']
            p_median = median_model.predict(features)[0] + row['SP500_Close']
            p_upper = upper_model.predict(features)[0] + row['SP500_Close']
            sorted_p = sorted([p_lower, p_median, p_upper])

            simulation_list.append({
                "day_index": index,
                "date": str(row['Date']),
                "actual_price": round(row['SP500_Close'], 2),
                "predicted_likely": round(sorted_p[1], 2), 
                "lower_bound": round(sorted_p[0], 2),
                "upper_bound": round(sorted_p[2], 2),
                "sentiment_score": round(row['Daily_Emotion_Score'], 2),
                
                # Mega Cap Data
                "apple_sentiment": round(row['apple_sent'], 3),
                "tesla_sentiment": round(row['tesla_sent'], 3),
                "microsoft_sentiment": round(row['msft_sent'], 3),
                "amazon_sentiment": round(row['amzn_sent'], 3),
                "nvidia_sentiment": round(row['nvda_sent'], 3),

                # --- NEW EARLY WARNING RADAR ---
                "anomaly_status": str(row['Anomaly_Status']),
                "z_score": round(row['Z_Score'], 2)
            })
            
        return {
            "status": "success",
            "total_days": len(simulation_list),
            "simulation_data": simulation_list
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process historical data: {str(e)}")