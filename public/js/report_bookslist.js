// report_bookslist.js - 수정된 버전

document.addEventListener('DOMContentLoaded', function() {
  // 카테고리 컨테이너 요소
  const categoryContainer = document.getElementById('categoryContainer');
  
  // 카테고리별 교재 데이터를 저장할 객체
  let booksByCategory = {};
  
  // 교재 데이터 로드 및 표시 함수
  async function loadBooksList() {
      try {
          // 교재 데이터 가져오기 - books 시트 활용
          const response = await fetch('/api/get-books-data');
          
          if (!response.ok) {
              throw new Error('교재 데이터를 불러오는데 실패했습니다.');
          }
          
          const booksData = await response.json();
          
          // 카테고리별로 교재 데이터 그룹화
          booksByCategory = groupBooksByCategory(booksData);
          
          // UI 렌더링
          renderCategories(booksByCategory);
          
      } catch (error) {
          console.error('Error:', error);
          categoryContainer.innerHTML = `
              <div class="alert alert-danger">
                  <i class="bi bi-exclamation-circle me-2"></i>
                  교재 정보를 불러오는데 실패했습니다: ${error.message}
              </div>
          `;
      }
  }
  
  // 교재 데이터를 카테고리별로 그룹화하는 함수
  function groupBooksByCategory(booksData) {
      const groupedData = {};
      
      booksData.forEach(book => {
          // 카테고리는 [1] 인덱스에 위치 (교재카테고리)
          const category = book[1] || '기타';
          
          if (!groupedData[category]) {
              groupedData[category] = [];
          }
          
          // 교재 객체 생성
          const bookObj = {
              id: book[0],
              category: book[1],
              volume: book[2],
              title: book[3],
              description: book[4],
              thumbnail: book[5]
          };
          
          groupedData[category].push(bookObj);
      });
      
      return groupedData;
  }
  
  // 카테고리별 UI 렌더링 함수
  function renderCategories(booksByCategory) {
      // 컨테이너 초기화
      categoryContainer.innerHTML = '';
      
      // 카테고리가 없을 경우
      if (Object.keys(booksByCategory).length === 0) {
          categoryContainer.innerHTML = `
              <div class="alert alert-info">
                  <i class="bi bi-info-circle me-2"></i>
                  등록된 교재가 없습니다.
              </div>
          `;
          return;
      }
      
      // 카테고리별 아코디언 생성
      const accordion = document.createElement('div');
      accordion.className = 'accordion';
      accordion.id = 'booksAccordion';
      
      // 카테고리 정렬 (프리스쿨, 주니어, 기타 순서로)
      const sortedCategories = Object.keys(booksByCategory).sort((a, b) => {
          if (a.includes('프리스쿨') && !b.includes('프리스쿨')) return -1;
          if (!a.includes('프리스쿨') && b.includes('프리스쿨')) return 1;
          if (a.includes('주니어') && !b.includes('주니어')) return -1;
          if (!a.includes('주니어') && b.includes('주니어')) return 1;
          return a.localeCompare(b);
      });
      
      // 각 카테고리에 대한 아코디언 아이템 생성
      sortedCategories.forEach((category, index) => {
          const books = booksByCategory[category];
          const isOpen = index === 0; // 첫 번째 카테고리는 열린 상태로 시작
          
          const accordionItem = createAccordionItem(category, books, index, isOpen);
          accordion.appendChild(accordionItem);
      });
      
      categoryContainer.appendChild(accordion);
  }
  
  // 아코디언 아이템 생성 함수
  function createAccordionItem(category, books, index, isOpen) {
      const itemId = `category-${index}`;
      const headingId = `heading-${index}`;
      const collapseId = `collapse-${index}`;
      
      const item = document.createElement('div');
      item.className = 'accordion-item';
      
      // 아코디언 헤더
      item.innerHTML = `
          <h2 class="accordion-header" id="${headingId}">
              <button class="accordion-button ${isOpen ? '' : 'collapsed'}" type="button" 
                      data-bs-toggle="collapse" data-bs-target="#${collapseId}" 
                      aria-expanded="${isOpen ? 'true' : 'false'}" aria-controls="${collapseId}">
                  <span class="fw-bold">${category}</span>
                  <span class="badge bg-primary rounded-pill ms-2">${books.length}</span>
              </button>
          </h2>
          <div id="${collapseId}" class="accordion-collapse collapse ${isOpen ? 'show' : ''}" 
               aria-labelledby="${headingId}" data-bs-parent="#booksAccordion">
              <div class="accordion-body p-0">
                  <div class="row g-3 p-3" id="books-${index}">
                  </div>
              </div>
          </div>
      `;
      
      // 아이템 추가 후 교재 카드 렌더링
      setTimeout(() => {
          const booksContainer = document.getElementById(`books-${index}`);
          renderBooksCards(books, booksContainer, category);
      }, 0);
      
      return item;
  }
  
  // 교재 카드 렌더링 함수
  function renderBooksCards(books, container, category) {
      if (!container) return;
      
      // 레벨별로 정렬 (LV1, LV2, ... 순서로)
      const sortedBooks = [...books].sort((a, b) => {
          // 레벨 정보 추출
          const getLevelNumber = (vol) => {
              const match = vol.match(/LV(\d+)/i);
              return match ? parseInt(match[1]) : 0;
          };
          
          // 호수 정보 추출
          const getIssueNumber = (vol) => {
              const match = vol.match(/[-_](\d+)호$/);
              return match ? parseInt(match[1]) : 0;
          };
          
          // 먼저 레벨로 정렬
          const levelA = getLevelNumber(a.volume);
          const levelB = getLevelNumber(b.volume);
          
          if (levelA !== levelB) {
              return levelA - levelB;
          }
          
          // 레벨이 같으면 호수로 정렬
          return getIssueNumber(a.volume) - getIssueNumber(b.volume);
      });
      
      // 각 책에 대한 카드 생성
      sortedBooks.forEach(book => {
          const col = document.createElement('div');
          col.className = 'col-md-3 col-sm-6';
          
          // 호수 표시를 위한 정규화
          let displayVolume = book.volume;
          if (book.volume.includes('LV')) {
              const lvMatch = book.volume.match(/LV(\d+)/i);
              const volMatch = book.volume.match(/[-_](\d+)호$/);
              
              if (lvMatch && volMatch) {
                  displayVolume = `LV${lvMatch[1]}-${volMatch[1]}호`;
              }
          } else if (!book.volume.endsWith('호')) {
              displayVolume = book.volume + '호';
          }
          
          // 교재 카드 HTML
          col.innerHTML = `
              <div class="card h-100 book-card shadow-sm">
                  <div class="card-header bg-light py-2">
                      <h6 class="mb-0 text-truncate" title="${book.title || displayVolume}">
                          ${book.title || displayVolume}
                      </h6>
                  </div>
                  <div class="card-body text-center">
                      <img src="${book.thumbnail || '/resource/book_placeholder.png'}" 
                           class="img-fluid book-thumbnail mb-2" 
                           alt="${book.title || displayVolume}">
                      <p class="card-text small text-muted mb-0">${displayVolume}</p>
                  </div>
                  <div class="card-footer bg-white border-top-0">
                      <a href="/report/book/${encodeURIComponent(category)}/${encodeURIComponent(book.volume)}" 
                         class="btn btn-primary btn-sm w-100">
                          <i class="bi bi-file-earmark-text me-1"></i> 리포트 생성
                      </a>
                  </div>
              </div>
          `;
          
          container.appendChild(col);
      });
  }
  
  // 초기 로드
  loadBooksList();
});