
import pandas as pd
import sys

# Set encoding to utf-8 for stdout
sys.stdout.reconfigure(encoding='utf-8')

file_path = '★커리큘럼로드맵+컨텐츠맵.xlsx'

try:
    # Read all sheets
    xls = pd.ExcelFile(file_path)
    print(f"Sheet Names: {xls.sheet_names}")
    
    for sheet_name in xls.sheet_names:
        print(f"\n--- Sheet: {sheet_name} ---")
        df = pd.read_excel(xls, sheet_name=sheet_name, nrows=20) # Read first 20 rows
        print(df.to_string())
        
except Exception as e:
    print(f"Error reading excel: {e}")
