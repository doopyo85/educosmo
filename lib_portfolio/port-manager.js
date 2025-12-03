// 단순 포트 관리자 구현
const db = require('../lib_login/db');

module.exports = {
  allocatePort: async function(userId, projectId) {
    console.log(`포트 할당: 사용자 ${userId}, 프로젝트 ${projectId}`);
    return 6080;  // 고정 포트 사용
  },
  
  updateActivity: async function(userId, projectId) {
    console.log(`활동 시간 업데이트: 사용자 ${userId}, 프로젝트 ${projectId}`);
    return true;
  },
  
  updateContainerId: async function(userId, projectId, containerId) {
    console.log(`컨테이너 ID 업데이트: ${containerId}`);
    return true;
  },
  
  cleanupOldAllocations: async function(maxAgeMinutes = 30) {
    console.log(`${maxAgeMinutes}분 이상 비활성 컨테이너 정리 (임시 비활성화)`);
    return 0;
  }
};