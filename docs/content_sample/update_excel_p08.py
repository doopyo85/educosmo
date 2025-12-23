import pandas as pd
import os

base_path = r'c:\Users\User\Documents\pioneer\educodingnplay\docs\content_sample'
excel_file = os.path.join(base_path, 'problems.xlsx')

df = pd.read_excel(excel_file)

# Updates for p08 (3-1, 3-2, 3-3, 3-4)
updates = {
    'cospro_3-1_p08': {
        'input_1': '4\n1 3 6 2', 'output_1': '-2\n-3\n4',
        'input_2': '3\n5 10 5', 'output_2': '-5\n5',
        'category': 'implementation', 'tags': 'array,loop'
    },
    'cospro_3-2_p08': {
        'input_1': '5\n3 6 2 1 10', 'output_1': '2 3',
        'input_2': '4\n1 2 3 4', 'output_2': '2 2',
        'category': 'implementation', 'tags': 'array,loop,if'
    },
    'cospro_3-3_p08': {
        'input_1': '6\n3 6 2 12 8 20', 'output_1': '18',
        'input_2': '5\n-2 -6 10 -10 4', 'output_2': '20',
        'category': 'implementation', 'tags': 'array,max,min'
    },
    'cospro_3-4_p08': {
        'input_1': '4 6', 'output_1': '1 2 3 4 5 6\n2 3 4 5 6 7\n3 4 5 6 7 8\n4 5 6 7 8 9',
        'input_2': '2 2', 'output_2': '1 2\n2 3',
        'category': 'implementation', 'tags': 'loop,nested_loop'
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
