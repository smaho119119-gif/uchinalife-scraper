import sqlite3
import pandas as pd

try:
    conn = sqlite3.connect('output/properties.db')
    query = "SELECT category, COUNT(*) as count FROM properties GROUP BY category"
    df = pd.read_sql_query(query, conn)
    print(df)
    conn.close()
except Exception as e:
    print(e)
