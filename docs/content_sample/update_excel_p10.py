import pandas as pd
import os

base_path = r'c:\Users\User\Documents\pioneer\educodingnplay\docs\content_sample'
excel_file = os.path.join(base_path, 'problems.xlsx')

df = pd.read_excel(excel_file)

# Updates for p10 (3-1, 3-2, 3-3, 3-4)
updates = {
    'cospro_3-1_p10': {
        'input_1': '1234', 'output_1': '4\n3\n2\n1',
        'input_2': '567', 'output_2': '7\n6\n5',
        'category': 'implementation', 'tags': 'string,loop,reverse'
    },
    'cospro_3-2_p10': {
        'input_1': 'Happy', 'output_1': '2',
        'input_2': 'Programmingpython', 'output_2': '2',
        'category': 'implementation', 'tags': 'string,loop,count'
    },
    'cospro_3-3_p10': {
        'input_1': '5\n4 8 1 1 9', 'output_1': '1 1 9\n4 8\n11 12',
        'input_2': '9\n2 5 1 7 9 9 4 1 2', 'output_2': '5 1 7 9 9 1\n2 4 2\n32 8',
        'category': 'implementation', 'tags': 'array,odd-even,sum,filter'
    },
    'cospro_3-4_p10': {
        'input_1': '12 25 31 10 58 100 95 46 78 60', 'output_1': '100 10',
        # Case 2 derived val check
        'input_2': '1 2 3 4 5 6 7 8 9 10', 'output_2': '10 1',
        'category': 'implementation', 'tags': 'array,max,min'
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
