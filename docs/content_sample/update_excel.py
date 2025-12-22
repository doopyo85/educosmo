
import pandas as pd
import json

file_path = 'c:/Users/User/Documents/pioneer/educodingnplay/docs/content_sample/problems.xlsx'

try:
    df = pd.read_excel(file_path)

    # Define target
    target_filename = 'cospro_3-1_p04.html'
    
    # Find index
    mask = df.iloc[:, 0].str.contains(target_filename, na=False)
    
    if mask.any():
        idx = df.index[mask][0]
        print(f"Found {target_filename} at index {idx}")
        
        # Prepare Data
        # IO: [{"input": "HelloWorld", "output": "\"HelloWorld\""}, {"input": "Quote", "output": "\"Quote\""}]
        io_data = [{"input": "HelloWorld", "output": "\"HelloWorld\""}, {"input": "Quote", "output": "\"Quote\""}]
        io_json = json.dumps(io_data)
        
        # H (7): Solution URL - Already set? Let's ensure it follows pattern if needed, but user said "H:M 의 카테고리".
        # Assuming H-associated columns need checking.
        # I'll update K (10) and N (13).
        # M (12) - I will try to copy from p01 (index 20) if available to maintain consistency.
        
        p01_mask = df.iloc[:, 0].str.contains('cospro_3-1_p01.html', na=False)
        if p01_mask.any():
            p01_idx = df.index[p01_mask][0]
            # Copy M (12) from p01 to p04
            df.iloc[idx, 12] = df.iloc[p01_idx, 12]
            print(f"Copied Category (Col 12) from p01 to p04")
        
        df.iloc[idx, 10] = io_json
        df.iloc[idx, 13] = "string,print"
        
        # Save
        df.to_excel(file_path, index=False)
        print("Successfully updated problems.xlsx")
        
    else:
        print(f"Error: {target_filename} not found in excel file.")

except Exception as e:
    print(f"An error occurred: {e}")
