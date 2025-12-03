/**
 * 게시판 기능 관련 클라이언트 로직
 */

// DOM이 로드된 후 실행
document.addEventListener("DOMContentLoaded", function() {
    console.log("게시판 클라이언트 스크립트 로드됨");
    
    // 메시지 전송 버튼 이벤트 연결
    const sendBtn = document.getElementById("send-btn");
    if (sendBtn) {
        sendBtn.addEventListener("click", sendMessage);
    }
    
    // 입력 필드 엔터키 이벤트 연결
    const chatInput = document.getElementById("chat-input");
    if (chatInput) {
        chatInput.addEventListener("keypress", function(event) {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
            }
        });
    }
    
    // 삭제 버튼들에 이벤트 리스너 추가
    setupDeleteButtons();
    
    // 답글 버튼들에 이벤트 리스너 추가
    setupReplyButtons();
    
    // 댓글 제출 버튼 이벤트 리스너
    setupCommentForms();
    
    // 답글 취소 버튼 이벤트
    const cancelReplyBtns = document.querySelectorAll('.cancel-reply');
    cancelReplyBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            cancelReply(this);
        });
    });
});

// 전역 변수 - 현재 답글 작성 중인 댓글 ID
let currentReplyToId = null;
let currentPostId = null;

// 삭제 버튼 이벤트 설정
function setupDeleteButtons() {
    const deleteButtons = document.querySelectorAll('.delete-btn');
    console.log("삭제 버튼 개수:", deleteButtons.length);
    
    deleteButtons.forEach(button => {
        button.addEventListener('click', function(event) {
            event.preventDefault();
            
            if (confirm('이 글을 정말 삭제하시겠습니까?')) {
                const deleteUrl = this.getAttribute('href');
                console.log("삭제 URL:", deleteUrl);
                
                // AJAX로 삭제 요청 보내기
                fetch(deleteUrl, {
                    method: 'GET', // DELETE 메서드 대신 GET 사용 (호환성 위해)
                    headers: {
                        'Content-Type': 'application/json'
                    }
                })
                .then(response => {
                    console.log("삭제 응답:", response.status);
                    if (response.ok) {
                        // 삭제 성공 시 화면에서 메시지 요소 제거
                        const messageContainer = this.closest('.message-container, .comment-container');
                        if (messageContainer) {
                            messageContainer.remove();
                        } else {
                            // 요소를 찾지 못한 경우 페이지 새로고침
                            location.reload();
                        }
                    } else if (response.status === 403) {
                        alert('삭제 권한이 없습니다.');
                    } else {
                        alert('삭제 중 오류가 발생했습니다.');
                        console.error('삭제 실패:', response.status);
                    }
                })
                .catch(error => {
                    console.error('삭제 요청 오류:', error);
                    alert('네트워크 오류가 발생했습니다.');
                });
            }
        });
    });
}

// 답글 버튼 이벤트 설정
function setupReplyButtons() {
    const replyButtons = document.querySelectorAll('.reply-btn');
    console.log("답글 버튼 개수:", replyButtons.length);
    
    replyButtons.forEach(button => {
        button.addEventListener('click', function(event) {
            event.preventDefault();
            
            // 답글 대상 정보 가져오기
            const commentId = this.getAttribute('data-comment-id');
            const postId = this.getAttribute('data-post-id');
            const author = this.getAttribute('data-author');
            
            // 가장 가까운 댓글 컨테이너 찾기
            const commentContainer = this.closest('.comment-container');
            const commentText = commentContainer.querySelector('.comment-text').textContent;
            
            // 해당 댓글에 답글 폼 추가
            activateReplyMode(commentContainer, commentId, postId, author, commentText);
        });
    });
}

// 댓글 폼 이벤트 설정
function setupCommentForms() {
    const commentForms = document.querySelectorAll('.comment-form');
    
    commentForms.forEach(form => {
        form.addEventListener('submit', function(event) {
            event.preventDefault();
            
            const postId = this.getAttribute('data-post-id');
            const contentInput = this.querySelector('.comment-input');
            const content = contentInput.value.trim();
            
            if (!content) return;
            
            submitComment(postId, content);
        });
    });
}

// 답글 모드 활성화
function activateReplyMode(commentContainer, commentId, postId, author, commentText) {
    // 이미 답글 폼이 있는지 확인
    const existingForm = commentContainer.querySelector('.reply-form');
    if (existingForm) {
        return; // 이미 폼이 있으면 중복 생성 방지
    }
    
    // 다른 모든 답글 폼 제거
    document.querySelectorAll('.reply-form').forEach(form => {
        form.remove();
    });
    
    // 현재 답글 대상 정보 저장
    currentReplyToId = commentId;
    currentPostId = postId;
    
    // 답글 폼 생성
    const replyForm = document.createElement('div');
    replyForm.className = 'reply-form';
    replyForm.innerHTML = `
        <div class="reply-info">
            <span class="reply-to-label">답글:</span>
            <span class="reply-to-preview">${author}: ${commentText.length > 15 ? commentText.substring(0, 15) + '...' : commentText}</span>
            <span class="cancel-reply">취소</span>
        </div>
        <div class="input-area">
            <input type="text" class="reply-input" placeholder="답글을 입력하세요...">
            <button class="reply-submit-btn">답글 전송</button>
        </div>
    `;
    
    // 답글 폼을 댓글 컨테이너 뒤에 추가
    commentContainer.after(replyForm);
    
    // 입력 필드에 포커스
    replyForm.querySelector('.reply-input').focus();
    
    // 취소 버튼 이벤트
    replyForm.querySelector('.cancel-reply').addEventListener('click', function() {
        replyForm.remove();
        currentReplyToId = null;
        currentPostId = null;
    });
    
    // 답글 전송 버튼 이벤트
    replyForm.querySelector('.reply-submit-btn').addEventListener('click', function() {
        const replyContent = replyForm.querySelector('.reply-input').value.trim();
        if (replyContent) {
            submitReply(currentPostId, currentReplyToId, replyContent);
        }
    });
    
    // 답글 입력 필드 엔터키 이벤트
    replyForm.querySelector('.reply-input').addEventListener('keypress', function(event) {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            const replyContent = this.value.trim();
            if (replyContent) {
                submitReply(currentPostId, currentReplyToId, replyContent);
            }
        }
    });
}

// 답글 제출
async function submitReply(postId, commentId, content) {
    try {
        const response = await fetch('/board/reply', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                postId: postId,
                commentId: commentId,
                content: content
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // 성공 시 페이지 새로고침
            location.reload();
        } else {
            alert(data.error || '답글 작성 중 오류가 발생했습니다.');
        }
    } catch (error) {
        console.error('답글 작성 오류:', error);
        alert('네트워크 오류가 발생했습니다.');
    }
}

// 댓글 제출
async function submitComment(postId, content) {
    try {
        const response = await fetch('/board/comment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                postId: postId,
                content: content
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // 성공 시 페이지 새로고침
            location.reload();
        } else {
            alert(data.error || '댓글 작성 중 오류가 발생했습니다.');
        }
    } catch (error) {
        console.error('댓글 작성 오류:', error);
        alert('네트워크 오류가 발생했습니다.');
    }
}

// 답글 모드 취소
function cancelReply(button) {
    const replyForm = button.closest('.reply-form');
    if (replyForm) {
        replyForm.remove();
        currentReplyToId = null;
        currentPostId = null;
    }
}

// 메시지 전송 함수 (게시글 작성)
async function sendMessage() {
    const inputField = document.getElementById("chat-input");
    const message = inputField.value.trim();
    if (!message) return;

    console.log("메시지 전송 시도:", message);

    try {
        const response = await fetch("/board/write", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: message })
        });

        console.log("메시지 전송 응답 상태:", response.status);

        // 응답이 JSON인지 확인
        const contentType = response.headers.get("content-type");
        const isJson = contentType && contentType.includes("application/json");
        console.log("응답 콘텐츠 타입:", contentType);

        if (response.status === 403) {
            if (isJson) {
                const data = await response.json();
                alert(data.error || "로그인이 필요합니다.");
            } else {
                alert("로그인이 필요합니다.");
            }
            return;
        }

        if (!response.ok) {
            if (isJson) {
                const data = await response.json();
                alert(data.error || "게시글 작성 중 오류 발생");
            } else {
                alert("서버 오류 발생");
            }
            return;
        }

        // 성공 시 입력 필드 초기화 & 새로고침
        inputField.value = "";
        location.reload();
    } catch (error) {
        console.error("게시글 작성 오류:", error);
        alert("네트워크 오류가 발생했습니다.");
    }
}