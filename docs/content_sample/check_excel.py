import pandas as pd
import os

base_path = r'c:\Users\User\Documents\pioneer\educodingnplay\docs\content_sample'
excel_file = os.path.join(base_path, 'problems.xlsx')

try:
    df = pd.read_excel(excel_file)
    print("Columns:", df.columns.tolist())
    print("\nExisting CTRpython entries:")
    print(df[df.iloc[:, 1].astype(str).str.contains('CTRpython', na=False)].head(10))
except Exception as e:
    print(e)
