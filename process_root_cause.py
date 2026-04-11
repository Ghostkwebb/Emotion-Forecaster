import pandas as pd

print("1. Loading raw Reddit data...")
# REPLACE with your actual raw data filename!
df_raw = pd.read_csv('reddit_wsb.csv')

print("2. Fixing Dates and Text...")
# Fix the dates to match our main API
df_raw['timestamp'] = pd.to_datetime(df_raw['timestamp'], dayfirst=True, errors='coerce')
df_raw = df_raw.dropna(subset=['timestamp'])
df_raw['Date'] = df_raw['timestamp'].dt.strftime('%Y-%m-%d')

# Combine Title and Body so we have the full context to show the judges
df_raw['full_text'] = df_raw['title'].fillna('') + " - " + df_raw['body'].fillna('')

print("3. Finding the 'Root Cause' post for every single day...")
# We sort by Date, then by Score (Upvotes) descending
df_sorted = df_raw.sort_values(by=['Date', 'score'], ascending=[True, False])

# Drop duplicates based on Date, keeping only the FIRST one (which is the highest score)
top_posts_per_day = df_sorted.drop_duplicates(subset=['Date'], keep='first')

print("4. Cleaning up for the API...")
# Keep only what Sharad needs for the UI popup
root_cause_df = top_posts_per_day[['Date', 'full_text', 'score', 'url']].copy()

# Rename columns so they look nice in JSON
root_cause_df.rename(columns={
    'full_text': 'top_post_text',
    'score': 'top_post_upvotes',
    'url': 'top_post_url'
}, inplace=True)

# Truncate the text to 300 characters so it doesn't break Sharad's UI cards
root_cause_df['top_post_text'] = root_cause_df['top_post_text'].apply(lambda x: str(x)[:300] + "..." if len(str(x)) > 300 else str(x))

print("5. Saving to CSV...")
root_cause_df.to_csv('root_cause_data.csv', index=False)

print(f"SUCCESS! 'root_cause_data.csv' is ready with {len(root_cause_df)} daily narratives.")