import pandas as pd
import os

# Define paths
input_file = 'docs/content_sample/edu.xlsx'
output_file = 'docs/content_sample/edu_consolidated.xlsx'

def consolidate_excel():
    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found.")
        return

    print(f"Reading {input_file}...")
    try:
        xls = pd.ExcelFile(input_file)
    except Exception as e:
        print(f"Error reading Excel file: {e}")
        return

    all_data = []

    # Iterate through all sheets
    for sheet_name in xls.sheet_names:
        print(f"Processing sheet: {sheet_name}")
        
        # Skip description/meta sheets if any (customize as needed)
        if sheet_name.startswith('설명') or sheet_name == 'Parameters':
            continue

        df = pd.read_excel(xls, sheet_name=sheet_name)
        
        # Normalize Data
        # Add 'Category' column derived from Sheet Name (e.g., '프리-LV1(5세)' -> 'LV1(5세)')
        # We'll keep the full sheet name as 'Category' for now to be safe, or map it.
        # Let's clean it up slightly if it follows the pattern '프리-LV1(5세)'
        
        category = sheet_name
        
        # Insert Category as the FIRST column
        df.insert(0, 'Category', category)
        
        # Append to list
        all_data.append(df)

    if not all_data:
        print("No data found to consolidate.")
        return

    # Concatenate all dataframes
    print("Consolidating data...")
    combined_df = pd.concat(all_data, ignore_index=True)

    # Save to new Excel file with specific sheet name
    print(f"Saving to {output_file}...")
    with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
        combined_df.to_excel(writer, sheet_name='교육영상', index=False)
    
    print("Done! Please verify the 'edu_consolidated.xlsx' file.")

if __name__ == "__main__":
    consolidate_excel()
