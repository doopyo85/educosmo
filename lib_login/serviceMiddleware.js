const config = require('./config');

// 🔥 서비스 감지 미들웨어 - 모든 요청에서 서비스 타입 설정
const serviceDetectionMiddleware = (req, res, next) => {
  const serviceType = config.getServiceType(req);
  
  // 요청 객체에 서비스 타입 추가
  req.serviceType = serviceType;
  
  // 템플릿 변수에도 추가
  res.locals.serviceType = serviceType;
  res.locals.serviceName = serviceType === 'cosmoedu' ? '코스모에듀' : '코딩앤플레이';
  
  console.log(`[Service Detection] Host: ${req.get('host')}, Service: ${serviceType}`);
  
  next();
};

// 🔥 서비스별 페이지 접근 권한 체크 미들웨어
const checkServicePageAccess = (permissions) => {
  return (req, res, next) => {
    const serviceType = req.serviceType;
    const requestPath = req.path;
    const userRole = req.session?.role || 'guest';
    
    // 서비스별 페이지 목록 확인
    const servicePages = permissions.services[serviceType]?.pages || {};
    
    // 해당 서비스에 페이지가 없으면 404
    if (!servicePages[requestPath]) {
      console.log(`[Service Access] 페이지 없음: ${serviceType} - ${requestPath}`);
      return res.status(404).render('404', {
        message: `${res.locals.serviceName}에서는 해당 페이지를 제공하지 않습니다.`,
        serviceType: serviceType
      });
    }
    
    // 역할별 접근 권한 확인
    const allowedRoles = servicePages[requestPath].roles || [];
    if (!allowedRoles.includes(userRole)) {
      console.log(`[Service Access] 권한 없음: ${userRole} - ${requestPath}`);
      return res.status(403).render('403', {
        message: '해당 페이지에 접근할 권한이 없습니다.',
        serviceType: serviceType
      });
    }
    
    console.log(`[Service Access] 접근 허용: ${serviceType} - ${userRole} - ${requestPath}`);
    next();
  };
};

// 🔥 서비스별 메인 페이지 카드 데이터 제공
const getServiceCardData = (permissions, serviceType) => {
  const serviceConfig = permissions.services[serviceType];
  if (!serviceConfig) {
    return { elementary: [], secondary: [] };
  }
  
  return serviceConfig.cardConfig || { elementary: [], secondary: [] };
};

// 🔥 서비스별 헤더 네비게이션 필터링
const filterNavigationByService = (serviceType, userRole, permissions) => {
  const servicePages = permissions.services[serviceType]?.pages || {};
  const allowedPages = [];
  
  Object.entries(servicePages).forEach(([path, config]) => {
    if (config.roles.includes(userRole)) {
      allowedPages.push({
        path: path,
        name: config.name,
        roles: config.roles
      });
    }
  });
  
  return allowedPages;
};

module.exports = {
  serviceDetectionMiddleware,
  checkServicePageAccess,
  getServiceCardData,
  filterNavigationByService
};
