import pandas as pd
import os
import glob
from bs4 import BeautifulSoup

# Paths
base_path = r'c:\Users\User\Documents\pioneer\educodingnplay\docs\content_sample'
excel_file = os.path.join(base_path, 'problems.xlsx')
content_dir = r'c:\Users\User\Documents\pioneer\Conents_AWS_S3_educodingnplay\python'

# Load Excel
df = pd.read_excel(excel_file)
print("Columns:", df.columns.tolist())

# Problem List (ID -> info)
html_files = glob.glob(os.path.join(content_dir, 'CT-*-L1-*.html'))

new_entries = []
path_prefix = "Github_sync_contents/python/"

# Identify column names by index to handle garbled text
col_url = df.columns[0]
col_group = df.columns[1]
col_num = df.columns[2]
col_tmpl = df.columns[4]
col_ans = df.columns[6]
col_sol = df.columns[7]
col_type = df.columns[8]

for html_path in html_files:
    filename = os.path.basename(html_path)
    problem_id = os.path.splitext(filename)[0] # e.g. CT-REV-L1-001
    
    parts = problem_id.split('-')
    # CT-REV-L1-001 -> Group: CT-REV-L1, Num: 001
    group_val = "-".join(parts[:-1])
    num_val = parts[-1]
    
    # Files
    solution_path = os.path.join(content_dir, f"{problem_id}_s.py")
    template_path = os.path.join(content_dir, f"{problem_id}_e.py")
    
    # Read Code
    answer_code = ""
    if os.path.exists(solution_path):
        with open(solution_path, 'r', encoding='utf-8') as f:
            answer_code = f.read()
            
    template_code = ""
    if os.path.exists(template_path):
        with open(template_path, 'r', encoding='utf-8') as f:
            template_code = f.read()
            
    # Parse HTML
    description = ""
    inputs = []
    outputs = []
    
    with open(html_path, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f, 'html.parser')
        
        desc_badges = soup.find_all('span', class_='badge')
        for badge in desc_badges:
            if "문제 설명" in badge.get_text():
                desc_p = badge.find_next('p', class_='description')
                if desc_p:
                    description = desc_p.get_text().strip()
                break
        
        table = soup.find('table', class_='example-table')
        if table:
            rows = table.find('tbody').find_all('tr')
            for row in rows:
                cols = row.find_all('td')
                if len(cols) >= 3:
                    input_cell = cols[1]
                    for br in input_cell.find_all('br'):
                        br.replace_with('\n')
                    inputs.append(input_cell.get_text().strip())
                    
                    output_cell = cols[2]
                    for br in output_cell.find_all('br'):
                        br.replace_with('\n')
                    outputs.append(output_cell.get_text().strip())

    # Map Category & CT Tags
    ct_tags = "Unknown"
    category = "computational thinking"
    
    prefix = problem_id.split('-')[1] # VAR, COND, etc.
    
    tag_map = {
        "VAR": "Abstraction, Data Representation",
        "TYPE": "Abstraction, Data Representation",
        "COND": "Algorithm, Logic, Evaluation",
        "LOOP": "Algorithm, Pattern Recognition, Automation",
        "FUNC": "Decomposition, Abstraction, Algorithm",
        "LIST": "Data Representation, Abstraction",
        "DICT": "Data Representation, Abstraction",
        "REV": "Algorithm, Logic, Evaluation", # 1-5 Review
        "FILE": "Automation, Data Handling",
        "GUILD": "Algorithm, Logic, Evaluation", # 2-5 Review
        "CLASS": "Abstraction, Decomposition, Pattern Recognition",
        "MOD": "Abstraction, Automation",
        "EXCEPT": "Evaluation, Reliability, Logic",
        "DATA": "Pattern Recognition, Data Analysis, Visualization",
        "FINAL": "Algorithm, Complex Problem Solving, Integration"
    }
    
    if prefix in tag_map:
        ct_tags = tag_map[prefix]
        category = prefix.lower()
        if category == "var": category = "variable"
        if category == "cond": category = "conditional"
        if category == "func": category = "function"
        if category == "mod": category = "module"
        if category == "except": category = "exception"
        if category == "data": category = "data_analysis"

    
    # Prepare Row Data
    url_val = f"{path_prefix}{filename}"
    tmpl_val = f"{path_prefix}{problem_id}_e.py"
    ans_val = f"{path_prefix}{problem_id}_s.py"

    row_data = {
        'problem_id': problem_id,
        'title': problem_id,
        'description': description,
        'difficulty': 1,
        'category': category,
        'tags': ct_tags,
        'template_code': template_code,
        'answer_code': answer_code,
        'test_input_1': inputs[0] if len(inputs) > 0 else "",
        'test_output_1': outputs[0] if len(outputs) > 0 else "",
        'is_active': True,
        
        # Legacy Columns
        col_url: url_val,
        col_group: group_val,
        col_num: num_val,
        col_tmpl: tmpl_val,
        col_ans: ans_val,
        col_sol: "_", # No separate solution markdown
        col_type: "io",
        df.columns[3]: "_",
        df.columns[5]: "_",
        df.columns[9]: "_",
        df.columns[10]: "_",
        df.columns[11]: "_",
        df.columns[12]: "_",
        df.columns[13]: ct_tags,
    }
    
    # Determine List 1 (Group) and List 2 (Number/Topic)
    # Default fallback
    list1_val = group_val
    list2_val = num_val
    
    # Readable Map for Connectome
    readable_map = {
        "VAR": "1. Variables & I/O",
        "TYPE": "2. Data Types",
        "LIST": "3. List & Tuple",
        "DICT": "4. Dict & Set",
        "REV": "5. Logic Review",
        "COND": "6. Conditionals",
        "LOOP": "7. Loops",
        "FUNC": "8. Functions",
        "FILE": "9. File I/O",
        "GUILD": "10. Guild Review",
        "CLASS": "11. Classes",
        "MOD": "12. Modules",
        "EXCEPT": "13. Exceptions",
        "DATA": "14. Data Analysis",
        "FINAL": "15. Final Assessment"
    }

    if prefix in readable_map:
        list1_val = readable_map[prefix]
        # Format "001" -> "p01"
        try:
            num_int = int(num_val)
            list2_val = f"p{num_int:02d}"
        except:
            list2_val = num_val # Fallback
    
    # Update Row Data with new List values
    # Note: We update the legacy columns specifically
    row_data.update({
        col_group: list1_val,
        col_num: list2_val
    })
    
    # Update or Append
    mask = df['problem_id'] == problem_id
    if mask.any():
        idx = mask.idxmax()
        # Update existing
        for col, val in row_data.items():
            df.at[idx, col] = val
        print(f"Updated existing {problem_id}")
    else:
        # Append new
        new_entries.append(row_data)
        print(f"Prepared new {problem_id}")

# Concat new entries
if new_entries:
    new_df = pd.DataFrame(new_entries)
    df = pd.concat([df, new_df], ignore_index=True)

# Save
df.to_excel(excel_file, index=False)
print("Excel update complete.")
