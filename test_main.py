from fastapi.testclient import TestClient
from main import app  # Imports your FastAPI app

# Create a fake client to test the API without starting the server
client = TestClient(app)

def test_simulation_data_endpoint():
    """Tests if the historical 2021 data loads correctly with all XAI and Sector features."""
    response = client.get("/simulation-data")
    
    # 1. Did the server respond successfully?
    assert response.status_code == 200
    
    data = response.json()
    
    # 2. Is the JSON structure correct?
    assert data["status"] == "success"
    assert "simulation_data" in data
    
    # 3. Did it actually load the days?
    assert len(data["simulation_data"]) > 0
    
    # 4. Check if our custom H.I.V.E. features are inside the first day
    first_day = data["simulation_data"][0]
    assert "anomaly_status" in first_day
    assert "root_cause_text" in first_day
    assert "tech_sector" in first_day

def test_forecast_endpoint_math():
    """Tests if the What-If Sandbox successfully calculates a 5-day future projection."""
    payload = {
        "current_price": 4000.0,
        "current_sentiment": 0.8,
        "current_hype_volume": 2000000,
        "days_to_forecast": 5
    }
    
    response = client.post("/forecast", json=payload)
    
    # 1. Did the server accept our What-If scenario?
    assert response.status_code == 200
    
    data = response.json()
    
    # 2. Did it return exactly 5 days as requested?
    assert data["horizon_days"] == 5
    assert len(data["forecast"]) == 5
    
    # 3. Did the Quantile Bouncer logic work? (Lower < Median < Upper)
    day_one = data["forecast"][0]
    assert day_one["lower_bound"] <= day_one["likely_price"]
    assert day_one["likely_price"] <= day_one["upper_bound"]