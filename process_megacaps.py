import pandas as pd
import nltk
from nltk.sentiment.vader import SentimentIntensityAnalyzer

nltk.download('vader_lexicon', quiet=True)

print("1. Loading raw data...")
# REPLACE with your actual raw data filename!
df_raw = pd.read_csv('reddit_wsb.csv') 
print(f"   -> Loaded {len(df_raw)} rows.")

print("2. Fixing Dates...")
# Using 'dayfirst=True' is much safer than forcing a strict format string
df_raw['timestamp'] = pd.to_datetime(df_raw['timestamp'], dayfirst=True, errors='coerce')

# Drop any rows where the date couldn't be read so it doesn't crash
df_raw = df_raw.dropna(subset=['timestamp'])
df_raw['Date'] = df_raw['timestamp'].dt.strftime('%Y-%m-%d')
print(f"   -> {len(df_raw)} rows survived the date fix.")

print("3. Combining Text & Calculating Sentiment (This takes a minute)...")
df_raw['full_text'] = df_raw['title'].fillna('') + " " + df_raw['body'].fillna('')

sia = SentimentIntensityAnalyzer()
df_raw['Sentiment'] = df_raw['full_text'].apply(lambda x: sia.polarity_scores(str(x))['compound'])

print("4. Tagging Mega-Caps...")
ticker_map = {
    'AAPL': ['AAPL', 'Apple', 'iPhone', 'Macbook', 'Tim Cook'],
    'MSFT': ['MSFT', 'Microsoft', 'Windows', 'Azure', 'Satya'],
    'AMZN': ['AMZN', 'Amazon', 'Bezos', 'AWS'],
    'TSLA': ['TSLA', 'Tesla', 'Elon', 'Model 3', 'Model Y'],
    'NVDA': ['NVDA', 'Nvidia', 'GPU', 'GeForce']
}

for ticker, keywords in ticker_map.items():
    df_raw[ticker] = df_raw['full_text'].str.contains('|'.join(keywords), case=False, na=False)

print("5. Aggregating daily scores...")
def get_ticker_sentiment(group, ticker):
    ticker_posts = group[group[ticker] == True]
    if len(ticker_posts) > 0:
        return ticker_posts['Sentiment'].mean()
    else:
        return 0.0

daily_megacap = df_raw.groupby('Date').apply(lambda x: pd.Series({
    'apple_sent': get_ticker_sentiment(x, 'AAPL'),
    'tesla_sent': get_ticker_sentiment(x, 'TSLA'),
    'msft_sent': get_ticker_sentiment(x, 'MSFT'),
    'amzn_sent': get_ticker_sentiment(x, 'AMZN'),
    'nvda_sent': get_ticker_sentiment(x, 'NVDA')
})).reset_index()

print("6. Saving final file...")
# Make sure we save the GROUPED data (daily_megacap), not df_raw!
daily_megacap.to_csv('mega_cap_sentiment.csv', index=False)

print(f"SUCCESS! Created 'mega_cap_sentiment.csv' with {len(daily_megacap)} days of data.")