-- 카테고리명 변경: "여우의 다락방" → "고양이 다락방"
UPDATE board_categories
SET name = '고양이 다락방',
    description = '고양이의 창작물과 작품을 공유하는 갤러리 공간'
WHERE id = 101 AND slug = 'agit';

-- 확인 쿼리
SELECT id, name, slug, description FROM board_categories WHERE id = 101;
