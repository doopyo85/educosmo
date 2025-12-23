import pandas as pd
import os

base_path = r'c:\Users\User\Documents\pioneer\educodingnplay\docs\content_sample'
excel_file = os.path.join(base_path, 'problems.xlsx')

df = pd.read_excel(excel_file)

# Updates for p09 (3-1, 3-2, 3-3, 3-4)
updates = {
    'cospro_3-1_p09': {
        'input_1': '12345', 'output_1': '5\n4\n3\n2\n1',
        'input_2': '987', 'output_2': '7\n8\n9',
        'category': 'implementation', 'tags': 'string,loop,reverse'
    },
    'cospro_3-2_p09': {
        'input_1': '6\n12 1 9 17 31 7', 'output_1': '77\n12.8',
        'input_2': '3\n10 20 30', 'output_2': '60\n20.0',
        'category': 'implementation', 'tags': 'math,sum,average'
    },
    'cospro_3-3_p09': {
        'input_1': '7\n12 4 2 10 83 6 8', 'output_1': '12 2 83 8\n4 10 6',
        'input_2': '4\n1 2 3 4', 'output_2': '1 3\n2 4',
        'category': 'implementation', 'tags': 'array,index,mod,loop'
    },
    'cospro_3-4_p09': {
        'input_1': '12 25 31 10 58 100 95 46 78 60', 'output_1': '60 78 46 95 100 58 10 31 25 12\n31 46', 
        # Case 2 derived for validity check
        'input_2': '30 35 40 45 50 1 2 3 4 5', 'output_2': '5 4 3 2 1 50 45 40 35 30\n30 35 40 45 50',
        'category': 'implementation', 'tags': 'array,reverse,filter'
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
