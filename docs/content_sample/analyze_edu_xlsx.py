
import pandas as pd
import sys

# Set encoding to utf-8 for stdout
sys.stdout.reconfigure(encoding='utf-8')

file_path = 'edu.xlsx'


try:
    # Read all sheets
    xls = pd.ExcelFile(file_path)
    
    with open('analysis_result.utf8.txt', 'w', encoding='utf-8') as f:
        f.write(f"Sheet Names: {xls.sheet_names}\n")
        
        for sheet_name in xls.sheet_names:
            f.write(f"\n--- Sheet: {sheet_name} ---\n")
            try:
                df = pd.read_excel(xls, sheet_name=sheet_name, nrows=5) # Read first 5 rows for sample
                f.write(f"Columns: {list(df.columns)}\n")
                f.write("Data Types:\n")
                f.write(f"{df.dtypes}\n")
                f.write("Sample Data:\n")
                f.write(f"{df.to_string()}\n")
            except Exception as e:
                f.write(f"Error reading sheet {sheet_name}: {e}\n")
        
except Exception as e:
    with open('analysis_result.utf8.txt', 'w', encoding='utf-8') as f:
        f.write(f"Error reading excel file: {e}\n")

