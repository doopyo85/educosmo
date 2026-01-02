document.addEventListener('DOMContentLoaded', () => {
  // 현재 과제 정보 로드
  chrome.runtime.sendMessage({ action: 'GET_MISSION_INFO' }, (response) => {
    const missionTitle = document.getElementById('mission-title');

    if (response?.data) {
      missionTitle.textContent = response.data.missionTitle || `과제 #${response.data.missionId}`;
      missionTitle.style.color = '#11998e';
    } else {
      missionTitle.textContent = '없음';
    }
  });
});
