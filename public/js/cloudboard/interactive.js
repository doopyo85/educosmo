/**
 * CloudBoard Interactive
 * Padlet 스타일 드래그 앤 드롭 및 실시간 협업
 */

class CloudBoard {
  constructor(boardId) {
    this.boardId = boardId;
    this.socket = null;
    this.cards = new Map();
    this.isDragging = false;
    this.currentCard = null;
    this.offset = { x: 0, y: 0 };

    this.init();
  }

  init() {
    // Socket.IO 연결
    this.connectSocket();

    // 이벤트 리스너 등록
    this.setupEventListeners();

    // 기존 카드 초기화
    this.initializeCards();
  }

  connectSocket() {
    // Socket.IO 서버 URL (blog-server:3001)
    const socketUrl = window.location.protocol + '//' + window.location.host;
    this.socket = io(socketUrl);

    this.socket.on('connect', () => {
      console.log('[CloudBoard] Connected to server');
      this.socket.emit('join-board', this.boardId);
    });

    // 다른 사용자의 카드 업데이트 수신
    this.socket.on('card-updated', (data) => {
      this.updateCardPosition(data.cardId, data.x, data.y);
    });

    // 새 카드 생성 알림
    this.socket.on('new-card', (data) => {
      this.addCard(data);
    });

    // 카드 삭제 알림
    this.socket.on('card-removed', (data) => {
      this.removeCard(data.cardId);
    });

    // 접속자 수 업데이트
    this.socket.on('user-count', (count) => {
      this.updateUserCount(count);
    });

    // 연결 해제 시
    window.addEventListener('beforeunload', () => {
      if (this.socket) {
        this.socket.emit('leave-board', this.boardId);
        this.socket.disconnect();
      }
    });
  }

  setupEventListeners() {
    const board = document.getElementById('cloudboard');
    if (!board) return;

    // 카드에 이벤트 위임
    board.addEventListener('mousedown', (e) => {
      const card = e.target.closest('.card-item');
      if (card && e.target.classList.contains('card-header')) {
        this.startDrag(card, e);
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (this.isDragging && this.currentCard) {
        this.drag(e);
      }
    });

    document.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.stopDrag();
      }
    });
  }

  initializeCards() {
    const cards = document.querySelectorAll('.card-item');
    cards.forEach(card => {
      const cardId = card.dataset.cardId;
      const x = parseFloat(card.dataset.x) || 0;
      const y = parseFloat(card.dataset.y) || 0;

      this.cards.set(cardId, { x, y, element: card });
      this.applyPosition(card, x, y);
    });
  }

  startDrag(card, event) {
    this.isDragging = true;
    this.currentCard = card;

    const rect = card.getBoundingClientRect();
    this.offset.x = event.clientX - rect.left;
    this.offset.y = event.clientY - rect.top;

    card.classList.add('dragging');
    card.style.cursor = 'grabbing';
  }

  drag(event) {
    if (!this.currentCard) return;

    const board = document.getElementById('cloudboard');
    const boardRect = board.getBoundingClientRect();

    let x = event.clientX - boardRect.left - this.offset.x;
    let y = event.clientY - boardRect.top - this.offset.y;

    // 경계 제한
    const cardWidth = this.currentCard.offsetWidth;
    const cardHeight = this.currentCard.offsetHeight;

    x = Math.max(0, Math.min(x, boardRect.width - cardWidth));
    y = Math.max(0, Math.min(y, boardRect.height - cardHeight));

    this.applyPosition(this.currentCard, x, y);
  }

  stopDrag() {
    if (!this.currentCard) return;

    const cardId = this.currentCard.dataset.cardId;
    const x = parseFloat(this.currentCard.style.left);
    const y = parseFloat(this.currentCard.style.top);

    this.currentCard.classList.remove('dragging');
    this.currentCard.style.cursor = 'grab';

    this.isDragging = false;

    // 서버에 위치 저장
    this.saveCardPosition(cardId, x, y);

    // Socket.IO로 실시간 전파
    if (this.socket) {
      this.socket.emit('card-moved', {
        cardId,
        x,
        y,
        boardId: this.boardId
      });
    }

    this.currentCard = null;
  }

  applyPosition(card, x, y) {
    card.style.position = 'absolute';
    card.style.left = `${x}px`;
    card.style.top = `${y}px`;
  }

  updateCardPosition(cardId, x, y) {
    const cardData = this.cards.get(cardId);
    if (cardData && cardData.element) {
      this.applyPosition(cardData.element, x, y);
      cardData.x = x;
      cardData.y = y;
    }
  }

  async saveCardPosition(cardId, x, y) {
    try {
      const response = await fetch('/api/center/update-card-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, x, y })
      });

      if (!response.ok) {
        console.error('[CloudBoard] Failed to save position');
      }
    } catch (error) {
      console.error('[CloudBoard] Save error:', error);
    }
  }

  addCard(data) {
    const board = document.getElementById('cloudboard');
    if (!board) return;

    // 새 카드 생성
    const card = document.createElement('div');
    card.className = 'card-item';
    card.dataset.cardId = data.cardId;
    card.dataset.x = data.x || 0;
    card.dataset.y = data.y || 0;

    card.innerHTML = `
      <div class="card-header">${data.title || 'Untitled'}</div>
      <div class="card-body">${data.content || ''}</div>
    `;

    board.appendChild(card);
    this.cards.set(data.cardId, { x: data.x || 0, y: data.y || 0, element: card });
    this.applyPosition(card, data.x || 0, data.y || 0);
  }

  removeCard(cardId) {
    const cardData = this.cards.get(cardId);
    if (cardData && cardData.element) {
      cardData.element.remove();
      this.cards.delete(cardId);
    }
  }

  updateUserCount(count) {
    const userCountElement = document.getElementById('userCount');
    if (userCountElement) {
      userCountElement.textContent = `${count}명 접속 중`;
    }
  }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  const boardElement = document.getElementById('cloudboard');
  if (boardElement) {
    const boardId = boardElement.dataset.boardId;
    window.cloudBoard = new CloudBoard(boardId);
  }
});
