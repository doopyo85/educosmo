import pypdf
import sys

# Force UTF-8 for stdout
sys.stdout.reconfigure(encoding='utf-8')

filepath = r"C:\Users\User\Documents\pioneer\s3\contents\진로진학\어디가 종합입결 2025.pdf"

try:
    reader = pypdf.PdfReader(filepath)
    print(f"Total Pages: {len(reader.pages)}")
    
    # Check first 5 pages
    for i in range(5):
        print(f"\n--- Page {i+1} ---")
        text = reader.pages[i].extract_text()
        print(text)
        
except Exception as e:
    print(f"Error: {e}")
