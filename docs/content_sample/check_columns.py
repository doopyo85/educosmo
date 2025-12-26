import pandas as pd
import os

base_path = r'c:\Users\User\Documents\pioneer\educodingnplay\docs\content_sample'
excel_file = os.path.join(base_path, 'problems.xlsx')

df = pd.read_excel(excel_file)
print(list(df.columns))
