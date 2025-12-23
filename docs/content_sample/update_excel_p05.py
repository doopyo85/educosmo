import pandas as pd
import os

# Define file paths
# Note: Using 'update_excel_p05.py' so we assume it is in 'docs/content_sample' or adjacent.
# The user's path is 'c:\Users\User\Documents\pioneer\educodingnplay\docs\content_sample\problems.xlsx'
base_path = r'c:\Users\User\Documents\pioneer\educodingnplay\docs\content_sample'
excel_file = os.path.join(base_path, 'problems.xlsx')

# Load the Excel file
df = pd.read_excel(excel_file)

# Define the updates for p05 (3-2, 3-3, 3-4)
# Columns:
# B: problem_num (e.g. cospro_3-2_p05)
# H: input_1
# I: output_1
# J: input_2
# K: output_2
# L: category (e.g. implementation)
# M: tags (e.g. math,string)

updates = {
    'cospro_3-2_p05': {
        'input_1': '13', 'output_1': '홀수',
        'input_2': '6', 'output_2': '짝수',
        'category': 'implementation', 'tags': 'math,mod,if'
    },
    'cospro_3-3_p05': {
        'input_1': '65', 'output_1': '1 5',
        'input_2': '150', 'output_2': '2 30',
        'category': 'implementation', 'tags': 'math,mod,div'
    },
    'cospro_3-4_p05': {
        'input_1': '10 6', 'output_1': '16',
        'input_2': '8 7', 'output_2': '1',
        'category': 'implementation', 'tags': 'math,condition'
    }
}

# Apply updates
for key, data in updates.items():
    # Find the row
    # Assuming Column B contains the key 'cospro_3-2_p05'
    mask = df.iloc[:, 1] == key
    if mask.any():
        idx = mask.idxmax()
        # Update columns H, I, J, K, L, M (indices 7, 8, 9, 10, 11, 12)
        df.iloc[idx, 7] = data['input_1']
        df.iloc[idx, 8] = data['output_1']
        df.iloc[idx, 9] = data['input_2']
        df.iloc[idx, 10] = data['output_2']
        df.iloc[idx, 11] = data['category']
        df.iloc[idx, 12] = data['tags']
        print(f"Updated {key}")
    else:
        print(f"Warning: {key} not found in Excel")

# Save
df.to_excel(excel_file, index=False)
print("Excel updated successfully.")
