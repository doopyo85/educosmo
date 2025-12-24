import pandas as pd
import sys

file_path = r'c:\Users\User\Documents\pioneer\educodingnplay\docs\content_sample\pongtube.xlsx'

try:
    df = pd.read_excel(file_path)
    print("Successfully read Excel file.")
    print("-" * 50)
    print(df)
except Exception as e:
    print(f"Error reading Excel file: {e}")
