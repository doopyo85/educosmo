# Food 클래스 - 음식의 이름과 가격을 저장
class Food:
    def __init__(self, name, price):
        self.name = name
        self.price = price

# DeliveryStore 인터페이스 (Python에서는 추상 클래스로 구현)
from abc import ABC, abstractmethod

class DeliveryStore(ABC):
    @abstractmethod
    def set_order_list(self, order_list):
        pass
    
    @abstractmethod
    def get_total_price(self):
        pass

# PizzaStore 클래스 - DeliveryStore 인터페이스를 구현
class PizzaStore(DeliveryStore):
    def __init__(self):
        # 메뉴 리스트 초기화 (피자 종류와 가격)
        self.menu_list = [
            Food("Cheese", 11200),
            Food("Pepperoni", 12600), 
            Food("Pineapple", 13700),
            Food("Meatball", 26700),
            Food("Bulgogi", 17200)
        ]
        self.order_list = []
    
    def set_order_list(self, order_list):
        # 주문 메뉴 리스트를 저장
        self.order_list = order_list
    
    def get_total_price(self):
        # 주문한 음식들의 총 가격 계산
        total_price = 0
        
        # 주문한 각 음식에 대해
        for order_name in self.order_list:
            # 메뉴에서 해당 음식을 찾아 가격을 더함
            for food in self.menu_list:
                if food.name == order_name:
                    total_price += food.price
                    break
        
        return total_price

def solution(order_list):
    # PizzaStore 인스턴스 생성
    pizza_store = PizzaStore()
    
    # 주문 리스트 설정
    pizza_store.set_order_list(order_list)
    
    # 총 가격 계산 및 반환
    return pizza_store.get_total_price()

# 테스트 케이스
if __name__ == "__main__":
    # 예시
    order_list = ["Cheese", "Pineapple", "Meatball"]
    print(solution(order_list))  # 51600
    
    # 상세 분석
    print("\n상세 분석:")
    pizza_store = PizzaStore()
    
    print("메뉴판:")
    for food in pizza_store.menu_list:
        print(f"- {food.name}: {food.price}원")
    
    print(f"\n주문 내역: {order_list}")
    total = 0
    for item in order_list:
        for food in pizza_store.menu_list:
            if food.name == item:
                print(f"- {food.name}: {food.price}원")
                total += food.price
                break
    
    print(f"\n총 가격: {total}원")
    
    # 추가 테스트
    print(f"\n추가 테스트:")
    print(solution(["Cheese"]))  # 11200
    print(solution(["Pepperoni", "Bulgogi"]))  # 12600 + 17200 = 29800
    print(solution(["Cheese", "Pepperoni", "Pineapple", "Meatball", "Bulgogi"]))  # 모든 메뉴
