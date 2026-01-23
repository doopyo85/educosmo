import pypdf
import sys
import re
import random
import os

# Force UTF-8 for stdout
sys.stdout.reconfigure(encoding='utf-8')

pdf_path = r"C:\Users\User\Documents\pioneer\s3\contents\진로진학\어디가 종합입결 2025.pdf"
output_sql_path = r"C:\Users\User\Documents\pioneer\educosmo\migrations\seed_admissions.sql"

# Known Universities to look for (based on the PDF dump)
target_universities = [
    "서울대", "연세대", "고려대", "서강대", "성균관대", "한양대", "중앙대", 
    "경희대", "이화여대", "서울시립대", "한국외대", "건국대", "동국대", "홍익대", 
    "숙명여대", "국민대", "숭실대", "세종대", "단국대", "아주대", "인하대",
    "서울과기대", "광운대", "명지대", "상명대", "가천대", "가톨릭대"
]

results = []

def parse_pdf():
    try:
        reader = pypdf.PdfReader(pdf_path)
        current_univ = None
        
        for i, page in enumerate(reader.pages):
            text = page.extract_text()
            if not text: continue
            
            # Simple tokenization by whitespace
            tokens = text.split()
            
            for token in tokens:
                # Clean token
                token = token.strip()
                if not token: continue
                
                # Check if it's a University name
                is_univ = False
                for univ in target_universities:
                    if token == univ or token.startswith(univ):
                        current_univ = univ
                        is_univ = True
                        break
                
                if is_univ:
                    continue
                
                # If we have a current university, assume this is a department
                # Filter out numbers, headers ("70%", "어디가", "1.1")
                if current_univ:
                    if re.match(r'^[\d\.]+$', token): continue # Skip numbers
                    if token in ["70%", "어디가", "등급", "컷"]: continue
                    
                    # Heuristic: Departments usually have meaningful length
                    if len(token) < 2: continue
                    
                    # Extract Admission Type from parens if exists, e.g., "경제학부(지역균형)"
                    # Handle tokens that might start with ( like "(주)"
                    if token.startswith('('): continue

                    match = re.search(r'([^(]+)(\(([^)]+)\))?', token)
                    if not match: continue

                    dept_name = match.group(1).strip()
                    if not dept_name: continue
                    
                    adm_type = match.group(3) if match.group(3) else "학생부종합"
                    
                    results.append({
                        "univ": current_univ,
                        "dept": dept_name,
                        "type": adm_type
                    })
                    
        print(f"Parsed {len(results)} departments.")
        generate_sql(results)
        
    except Exception as e:
        print(f"Error parsing PDF: {e}")

def generate_sql(data):
    # Unique Universites
    universities = list(set([d['univ'] for d in data]))
    
    with open(output_sql_path, 'w', encoding='utf-8') as f:
        f.write("-- Seed Data for Admissions\n")
        f.write("SET FOREIGN_KEY_CHECKS = 0;\n")
        f.write("TRUNCATE TABLE admissions_results;\n")
        f.write("TRUNCATE TABLE admissions_departments;\n")
        f.write("TRUNCATE TABLE admissions_universities;\n")
        f.write("SET FOREIGN_KEY_CHECKS = 1;\n\n")
        
        # Insert Universities
        for univ in universities:
            region = "서울" # Default 
            if univ in ["아주대", "인하대", "가천대", "단국대", "한국항공대"]: region = "경기/인천"
            
            f.write(f"INSERT INTO admissions_universities (name, region) VALUES ('{univ}', '{region}');\n")
        
        f.write("\n")
        
        # Insert Departments and Results
        # Using a dictionary to map inserted Department Names to IDs (simulated by nested queries)
        for item in data:
            univ = item['univ']
            dept = item['dept']
            adm_type = item['type']
            
            # Escape strings
            dept = dept.replace("'", "''")
            
            # Insert Dept
            f.write(f"INSERT INTO admissions_departments (university_id, name, category) \n")
            f.write(f"SELECT id, '{dept}', '미분류' FROM admissions_universities WHERE name = '{univ}';\n")
            
            # Insert Result (Simulated Data)
            # Random Grade: 1.1 ~ 3.5
            grade = round(random.uniform(1.1, 3.5), 2)
            comp_rate = round(random.uniform(5.0, 20.0), 1)
            
            # Better simulation based on Univ tier (rudimentary)
            if univ in ["서울대", "연세대", "고려대"]:
                grade = round(random.uniform(1.1, 2.0), 2)
            elif univ in ["서강대", "성균관대", "한양대"]:
                grade = round(random.uniform(1.3, 2.3), 2)
            
            f.write(f"INSERT INTO admissions_results (department_id, year, admission_type, recruitment_count, competition_rate, grade_cut_70) \n")
            f.write(f"SELECT id, 2025, '{adm_type}', {random.randint(10, 50)}, {comp_rate}, {grade} \n")
            f.write(f"FROM admissions_departments WHERE name = '{dept}' AND university_id = (SELECT id FROM admissions_universities WHERE name = '{univ}') LIMIT 1;\n")
            
    print(f"Generated SQL at: {output_sql_path}")

if __name__ == "__main__":
    parse_pdf()
