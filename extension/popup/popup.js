document.addEventListener('DOMContentLoaded', () => {
  console.log('[CNP-Popup] 팝업 로드됨');
  
  // 현재 과제 정보 로드
  chrome.runtime.sendMessage({ action: 'GET_MISSION_INFO' }, (response) => {
    console.log('[CNP-Popup] 과제 정보 응답:', response);
    
    const missionTitle = document.getElementById('mission-title');
    const missionDetail = document.getElementById('mission-detail');

    if (response?.data) {
      const data = response.data;
      missionTitle.textContent = data.missionTitle || `과제 #${data.missionId}`;
      missionTitle.style.color = '#34c759';
      
      // 상세 정보 표시
      if (missionDetail) {
        missionDetail.innerHTML = `
          <div class="detail-row"><span class="label">플랫폼:</span> ${getPlatformName(data.platform)}</div>
          <div class="detail-row"><span class="label">과제 ID:</span> ${data.missionId || '-'}</div>
          <div class="detail-row"><span class="label">시작:</span> ${formatDate(data.startedAt)}</div>
        `;
        missionDetail.style.display = 'block';
      }
    } else {
      missionTitle.textContent = '없음';
      missionTitle.style.color = '#8e8e93';
      if (missionDetail) {
        missionDetail.innerHTML = '<p class="no-mission-hint">코딩앤플레이에서 과제를 선택하면<br>여기에 정보가 표시됩니다.</p>';
        missionDetail.style.display = 'block';
      }
    }
  });
  
  // 디버그 버튼 (있는 경우)
  const debugBtn = document.getElementById('debug-btn');
  if (debugBtn) {
    debugBtn.addEventListener('click', () => {
      chrome.storage.local.get(null, (data) => {
        console.log('[CNP-Popup] 전체 저장소:', data);
        alert('콘솔에서 저장소 데이터를 확인하세요.');
      });
    });
  }
});

function getPlatformName(platform) {
  const names = {
    'scratch': '🐱 Scratch',
    'entry': '🎮 Entry',
    'appinventor': '📱 App Inventor'
  };
  return names[platform] || platform || '-';
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return dateStr;
  }
}
