import pandas as pd
import os

base_path = r'c:\Users\User\Documents\pioneer\educodingnplay\docs\content_sample'
excel_file = os.path.join(base_path, 'problems.xlsx')

df = pd.read_excel(excel_file)

# Updates for p07 (3-1, 3-2, 3-3, 3-4)
updates = {
    'cospro_3-1_p07': {
        'input_1': '5', 'output_1': '1\n2\n3\n4\n5',
        'input_2': '3', 'output_2': '1\n2\n3',
        'category': 'implementation', 'tags': 'loop,while,print'
    },
    'cospro_3-2_p07': {
        'input_1': '5', 'output_1': '5\n4\n3\n2\n1',
        'input_2': '3', 'output_2': '3\n2\n1',
        'category': 'implementation', 'tags': 'loop,while,print'
    },
    'cospro_3-3_p07': {
        'input_1': '3 4', 'output_1': '****\n****\n****',
        'input_2': '2 2', 'output_2': '**\n**',
        'category': 'implementation', 'tags': 'loop,for,print,string,multiply'
    },
    'cospro_3-4_p07': {
        'input_1': '3', 'output_1': '3 x 1 = 3\n3 x 2 = 6\n3 x 3 = 9\n3 x 4 = 12\n3 x 5 = 15\n3 x 6 = 18\n3 x 7 = 21\n3 x 8 = 24\n3 x 9 = 27',
        'input_2': '2', 'output_2': '2 x 1 = 2\n2 x 2 = 4\n2 x 3 = 6\n2 x 4 = 8\n2 x 5 = 10\n2 x 6 = 12\n2 x 7 = 14\n2 x 8 = 16\n2 x 9 = 18',
        'category': 'implementation', 'tags': 'loop,while,print,multiply'
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
