def func_a(gloves):
    # 제품 번호별 개수를 세는 함수
    count = {}
    for glove in gloves:
        if glove in count:
            count[glove] += 1
        else:
            count[glove] = 1
    return count

def solution(left_gloves, right_gloves):
    left_count = func_a(left_gloves)
    right_count = func_a(right_gloves)
    
    total_pairs = 0
    
    # 모든 제품 번호에 대해 확인
    all_numbers = set(left_count.keys()) | set(right_count.keys())
    
    for number in all_numbers:
        left_num = left_count.get(number, 0)
        right_num = right_count.get(number, 0)
        # 각 제품 번호별로 만들 수 있는 쌍의 개수는 min(왼손, 오른손)
        total_pairs += min(left_num, right_num)
    
    return total_pairs
