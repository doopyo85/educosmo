import pandas as pd
import os

base_path = r'c:\Users\User\Documents\pioneer\educodingnplay\docs\content_sample'
excel_file = os.path.join(base_path, 'problems.xlsx')

df = pd.read_excel(excel_file)

# Updates for p06 (3-1, 3-2, 3-3, 3-4)
updates = {
    'cospro_3-1_p06': {
        'input_1': '5 5', 'output_1': '10',
        'input_2': '7 10', 'output_2': '3',
        'category': 'implementation', 'tags': 'math,if,condition'
    },
    'cospro_3-2_p06': {
        'input_1': '5 7', 'output_1': '2',
        'input_2': '10 2', 'output_2': '8',
        'category': 'implementation', 'tags': 'math,abs,minus'
    },
    'cospro_3-3_p06': {
        'input_1': '10', 'output_1': '18',
        'input_2': '1000', 'output_2': '166833',
        'category': 'implementation', 'tags': 'loop,while,sum,mod'
    },
    'cospro_3-4_p06': {
        'input_1': '30', 'output_1': '3 6 7 9 12 14 15 18 21 24 27 28 30',
        # Case 2 not provided, we can skip or use same
        'input_2': '10', 'output_2': '3 6 7 9', # Generated derived example
        'category': 'implementation', 'tags': 'loop,while,print,mod,or'
    }
}

for key, data in updates.items():
    mask = df.iloc[:, 1] == key
    if mask.any():
        idx = mask.idxmax()
        df.iloc[idx, 7] = data['input_1']
        df.iloc[idx, 8] = data['output_1']
        df.iloc[idx, 9] = data['input_2']
        df.iloc[idx, 10] = data['output_2']
        df.iloc[idx, 11] = data['category']
        df.iloc[idx, 12] = data['tags']
        print(f"Updated {key}")
    else:
        print(f"Warning: {key} not found in Excel")

df.to_excel(excel_file, index=False)
print("Excel updated successfully.")
