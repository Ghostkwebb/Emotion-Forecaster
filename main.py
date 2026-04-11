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
    version="3.0" # Upgraded to V3 - Final Boss Edition!
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 2. LOAD AI MODELS & DATA (The Master Merge)
# ==========================================
try:
    lower_model = joblib.load("assets/models/lower_model.pkl")
    median_model = joblib.load("assets/models/median_model.pkl")
    upper_model = joblib.load("assets/models/upper_model.pkl")
        
    # Load all FOUR datasets
    historical_df = pd.read_csv("assets/final_training_data.csv") 
    mega_cap_df = pd.read_csv("assets/mega_cap_sentiment.csv")
    root_cause_df = pd.read_csv("assets/root_cause_data.csv") 
    sector_df = pd.read_csv("assets/sector_sentiment.csv") # --- NEW: Load Sector Data

    # Ensure Dates are strings
    historical_df['Date'] = historical_df['Date'].astype(str)
    mega_cap_df['Date'] = mega_cap_df['Date'].astype(str)
    root_cause_df['Date'] = root_cause_df['Date'].astype(str) 
    sector_df['Date'] = sector_df['Date'].astype(str) # --- NEW: Stringify Date

    # MERGE MAGIC: Combine all four!
    merged_df = pd.merge(historical_df, mega_cap_df, on='Date', how='left')
    merged_df = pd.merge(merged_df, root_cause_df, on='Date', how='left') 
    merged_df = pd.merge(merged_df, sector_df, on='Date', how='left') # --- NEW: Merge Sectors

    # Clean up missing Reddit posts
    merged_df['top_post_text'] = merged_df['top_post_text'].fillna("No major narrative detected today.")
    merged_df['top_post_upvotes'] = merged_df['top_post_upvotes'].fillna(0)
    merged_df['top_post_url'] = merged_df['top_post_url'].fillna("")

    # Fill remaining missing numbers with 0.0
    merged_df = merged_df.fillna(0.0)

    # EARLY WARNING RADAR LOGIC
    merged_df = merged_df.sort_values(by='Date').reset_index(drop=True)
    merged_df['Rolling_Mean'] = merged_df['Daily_Emotion_Score'].rolling(window=7, min_periods=1).mean()
    merged_df['Rolling_Std'] = merged_df['Daily_Emotion_Score'].rolling(window=7, min_periods=1).std().fillna(0)
    
    merged_df['Z_Score'] = np.where(
        merged_df['Rolling_Std'] > 0,
        (merged_df['Daily_Emotion_Score'] - merged_df['Rolling_Mean']) / merged_df['Rolling_Std'],
        0
    )
    
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

                # --- NEW SECTOR TUG-OF-WAR ---
                "tech_sector": round(row['tech_sector'], 3),
                "ev_sector": round(row['ev_sector'], 3),
                "finance_sector": round(row['finance_sector'], 3),
                "meme_sector": round(row['meme_sector'], 3),

                # EARLY WARNING RADAR
                "anomaly_status": str(row['Anomaly_Status']),
                "z_score": round(row['Z_Score'], 2),

                # ROOT CAUSE XAI
                "root_cause_text": str(row['top_post_text']),
                "root_cause_upvotes": int(row['top_post_upvotes']),
                "root_cause_url": str(row['top_post_url'])
            })
            
        return {
            "status": "success",
            "total_days": len(simulation_list),
            "simulation_data": simulation_list
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process historical data: {str(e)}")