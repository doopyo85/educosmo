import os
import pypdf
import json
import sys

# Force UTF-8 for stdout
sys.stdout.reconfigure(encoding='utf-8')

target_dir = r"C:\Users\User\Documents\pioneer\s3\contents\진로진학"
results = []

def analyze_pdf(filepath):
    try:
        reader = pypdf.PdfReader(filepath)
        num_pages = len(reader.pages)
        
        # Extract text from first few pages for summary
        text_summary = ""
        for i in range(min(3, num_pages)):
            page = reader.pages[i]
            text = page.extract_text()
            if text:
                text_summary += text[:500] + " "
        
        # Simple keyword analysis for importance/topic
        keywords = {
            "입결": "Admission Results",
            "수시": "Susi (Early Admission)",
            "정시": "Jeongsi (Regular Admission)",
            "등급": "Grade/Cutoff",
            "모집요강": "Guidelines",
            "경쟁률": "Competition Rate",
            "진로": "Career Path",
            "학과": "Major/Department"
        }
        
        found_keywords = [k for k in keywords if k in text_summary]
        
        return {
            "filename": os.path.basename(filepath),
            "pages": num_pages,
            "summary_preview": text_summary[:200].replace('\n', ' '),
            "keywords": found_keywords
        }
    except Exception as e:
        return {
            "filename": os.path.basename(filepath),
            "error": str(e)
        }

if not os.path.exists(target_dir):
    print(json.dumps({"error": f"Directory not found: {target_dir}"}))
    sys.exit(1)

for filename in os.listdir(target_dir):
    if filename.lower().endswith('.pdf'):
        filepath = os.path.join(target_dir, filename)
        results.append(analyze_pdf(filepath))

print(json.dumps(results, ensure_ascii=False, indent=2))
