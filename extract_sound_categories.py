import json
from collections import Counter

file_path = r"C:\Users\User\Documents\pioneer\educodingnplay\entry\resources\db\sounds.json"

with open(file_path, 'r', encoding='utf-8') as f:
    sounds = json.load(f)

# categoryId 추출
category_ids = []
for sound in sounds:
    if 'categoryId' in sound:
        category_ids.append(sound['categoryId'])

# 중복 제거 및 카운트
id_counts = Counter(category_ids)

print("="*60)
print("📊 categoryId 목록")
print("="*60)
print(f"총 categoryId 사용 사운드: {len(category_ids)}개")
print(f"categoryId 종류: {len(id_counts)}개")
print("\ncategoryId별 개수:")
print("-"*40)
for cid, count in sorted(id_counts.items(), key=lambda x: -x[1]):
    print(f"  {cid}: {count}개")

# categoryId별 샘플 사운드 이름 출력
print("\n" + "="*60)
print("📋 categoryId별 샘플 사운드 (각 3개)")
print("="*60)
for cid in sorted(set(category_ids)):
    samples = [s['name'] for s in sounds if s.get('categoryId') == cid][:3]
    print(f"\n[{cid}]")
    for name in samples:
        print(f"  - {name}")