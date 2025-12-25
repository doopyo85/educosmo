
import pandas as pd
import sys

file_path = '★커리큘럼로드맵+컨텐츠맵.xlsx'
output_file = 'excel_content.txt'

with open(output_file, 'w', encoding='utf-8') as f:
    try:
        xls = pd.ExcelFile(file_path)
        f.write(f"Sheet Names: {xls.sheet_names}\n")
        
        for sheet_name in xls.sheet_names:
            f.write(f"\n--- Sheet: {sheet_name} ---\n")
            df = pd.read_excel(xls, sheet_name=sheet_name, nrows=30)
            f.write(df.to_string())
            
    except Exception as e:
        f.write(f"Error: {e}")
