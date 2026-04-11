import pandas as pd
import nltk
from nltk.sentiment.vader import SentimentIntensityAnalyzer

# Download VADER if needed
nltk.download('vader_lexicon', quiet=True)

print("1. Loading raw Reddit data...")
df_raw = pd.read_csv('assets/reddit_wsb.csv') 

print("2. Fixing Dates and calculating Sentiment...")
df_raw['timestamp'] = pd.to_datetime(df_raw['timestamp'], dayfirst=True, errors='coerce')
df_raw = df_raw.dropna(subset=['timestamp'])
df_raw['Date'] = df_raw['timestamp'].dt.strftime('%Y-%m-%d')
df_raw['full_text'] = df_raw['title'].fillna('') + " " + df_raw['body'].fillna('')

sia = SentimentIntensityAnalyzer()
df_raw['Sentiment'] = df_raw['full_text'].apply(lambda x: sia.polarity_scores(str(x))['compound'])

print("3. Tagging Market Sectors...")
# Here is our Master Sector Dictionary
sector_map = {
    'TECH': ['Apple', 'AAPL', 'Microsoft', 'MSFT', 'Amazon', 'AMZN', 'Google', 'GOOGL', 'Palantir', 'PLTR', 'Cloud', 'AI'],
    'EV': ['Tesla', 'TSLA', 'Nio', 'NIO', 'Rivian', 'RIVN', 'Plug', 'PLUG', 'Solar', 'Battery', 'EV', 'CBAT', 'SUNW'],
    'FINANCE': ['Bank', 'NatWest', 'JPM', 'Bitcoin', 'BTC', 'Crypto', 'Ethereum', 'ETH', 'Robinhood', 'HOOD'],
    'MEME': ['GameStop', 'GME', 'AMC', 'BlackBerry', 'BB', 'Nokia', 'NOK', 'Short', 'Squeeze', 'Ape', 'WSB']
}

for sector, keywords in sector_map.items():
    df_raw[sector] = df_raw['full_text'].str.contains('|'.join(keywords), case=False, na=False)

print("4. Aggregating daily sector scores...")
def get_sector_sentiment(group, sector):
    sector_posts = group[group[sector] == True]
    if len(sector_posts) > 0:
        return sector_posts['Sentiment'].mean()
    else:
        return 0.0

daily_sector = df_raw.groupby('Date').apply(lambda x: pd.Series({
    'tech_sector': get_sector_sentiment(x, 'TECH'),
    'ev_sector': get_sector_sentiment(x, 'EV'),
    'finance_sector': get_sector_sentiment(x, 'FINANCE'),
    'meme_sector': get_sector_sentiment(x, 'MEME')
})).reset_index()

print("5. Saving to CSV...")
daily_sector.to_csv('sector_sentiment.csv', index=False)
print(f"SUCCESS! 'sector_sentiment.csv' is ready with {len(daily_sector)} days of data.")