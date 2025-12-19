// public/js/admin/dashboard.js
async function fetchWithAuth(url) {
    const response = await fetch(url, {
        credentials: 'include',
        headers: {
            'Accept': 'application/json'
        }
    });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
}

let centerList = []; // 센터 목록 캐시

async function loadCenters() {
    try {
        const result = await fetchWithAuth('/admin/api/centers');
        if (result.success) {
            centerList = result.centers;
            console.log('Centers loaded:', centerList.length);
        }
    } catch (error) {
        console.error('Failed to load centers:', error);
    }
}

function updateDashboardStats(data) {
    if (!data?.totalStats) return;

    try {
        // 기본 통계 업데이트
        const elements = {
            'totalUsers': data.totalStats.total_users || 0,
            'studentCount': data.totalStats.student_count || 0,
            'teacherCount': data.totalStats.teacher_count || 0, // Updated to Teacher
            'activeCenters': data.totalStats.active_centers || 0
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    } catch (error) {
        console.error('Error updating dashboard stats:', error);
    }
}

async function loadStats() {
    try {
        console.log('Fetching dashboard stats...');
        const result = await fetchWithAuth('/admin/api/stats');
        console.log('Received stats:', result);

        if (result.success && result.data) {
            updateDashboardStats(result.data);
        }
    } catch (error) {
        console.error('Error loading stats:', error);
        if (error.message.includes('401')) {
            window.location.href = '/auth/login';
        }
    }
}

async function loadUsers(sortField = 'no', sortOrder = 'asc', filter = {}) {
    try {
        const result = await fetchWithAuth('/admin/api/users');
        if (!result.success || !result.data) return;

        let filteredData = result.data;

        // 필터 적용
        Object.entries(filter).forEach(([field, value]) => {
            if (value) {
                filteredData = filteredData.filter(user => {
                    // centerID 필드는 센터명까지 포함하여 검색
                    if (field === 'centerID') {
                        const centerInfo = `${user.centerID} ${user.centerName || ''}`.toLowerCase();
                        return centerInfo.includes(value.toLowerCase());
                    }
                    // 다른 필드들은 기존처럼 포함 여부로 검색
                    return String(user[field]).toLowerCase().includes(value.toLowerCase());
                });
            }
        });

        // 정렬 적용
        filteredData.sort((a, b) => {
            let comparison = 0;
            if (a[sortField] < b[sortField]) comparison = -1;
            if (a[sortField] > b[sortField]) comparison = 1;
            return sortOrder === 'asc' ? comparison : -comparison;
        });

        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = filteredData.map(user => `
            <tr>
                <td>${user.no}</td>
                <td>${user.userID}</td>
                <td>${user.name || '-'}</td>
                <td>${user.role}</td>
                <td>
                    ${user.centerID ? `${user.centerID} (${user.centerName})` : '-'}
                    <button class="btn btn-sm btn-link text-secondary p-0 ms-1" onclick="openEditCenterModal(${user.id}, '${user.centerID || ''}', '${user.name || user.userID}')">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                </td>
                <td>${user.last_activity ? new Date(user.last_activity).toLocaleString() : '-'}</td>
                <td>${user.activity_count || 0}</td>
                <td>${user.email}</td>
                <td>${new Date(user.created_at).toLocaleDateString()}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="showUserActivities(${user.id})">
                        활동보기
                    </button>
                </td>
            </tr>

        `).join('');
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

async function loadCenterStats() {
    try {
        console.log('Fetching center stats...');
        const result = await fetchWithAuth('/admin/api/stats');
        console.log('Received center stats:', result);

        if (!result.success || !result.data?.centerStats) {
            console.error('Invalid center stats data');
            return;
        }

        const tbody = document.getElementById('centersTableBody');
        if (!tbody) {
            console.error('Centers table body not found');
            return;
        }

        tbody.innerHTML = result.data.centerStats.map(center => `
            <tr>
                <td>${center.centerID} ${center.centerName ? `(${center.centerName})` : ''}</td>
                <td>${center.total_users || 0}</td>
                <td>${center.student_count || 0}</td>
                <td>${center.manager_count || 0}</td>
                <td>${center.teacher_count || 0}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="showCenterDetails(${center.centerID})">
                        상세보기
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading center stats:', error);
    }
}

// 권한 매트릭스 로드
async function loadPermissionsMatrix() {
    try {
        console.log('Loading permissions matrix');
        const result = await fetchWithAuth('/admin/api/pages');
        console.log('Received permissions data:', result);

        if (!result.success) {
            throw new Error(result.error || 'Failed to load permissions');
        }

        const tbody = document.getElementById('permissionsTableBody');
        const roles = ['admin', 'kinder', 'school', 'manager', 'teacher', 'student'];
        const pages = result.data;

        tbody.innerHTML = Object.entries(pages).map(([page, config]) => {
            console.log(`Rendering row for page: ${page}`, config);
            return `
                <tr>
                    <td class="align-middle">
                        <div class="fw-bold">${config.name}</div>
                        <small class="text-muted">${page}</small>
                    </td>
                    ${roles.map(role => `
                        <td class="text-center">
                            <div class="form-check d-flex justify-content-center">
                                <input class="form-check-input permission-checkbox" 
                                       type="checkbox" 
                                       ${config.roles.includes(role) ? 'checked' : ''}
                                       data-page="${page}"
                                       data-role="${role}"
                                       id="perm_${page.replace(/\//g, '_')}_${role}">
                            </div>
                        </td>
                    `).join('')}
                </tr>
            `;
        }).join('');

        // 전체 선택 행 추가
        addSelectAllRow(roles);

        // 이벤트 리스너 추가
        initializeEventListeners();

    } catch (error) {
        console.error('Error loading permissions matrix:', error);
        // 사용자에게 에러 표시
        tbody.innerHTML = `
            <tr>
                <td colspan="${roles.length + 1}" class="text-center text-danger">
                    권한 설정을 불러오는 중 오류가 발생했습니다.
                </td>
            </tr>
        `;
    }
}

// 권한 변경사항 저장
async function savePermissionChanges() {
    try {
        const permissions = {};
        const checkboxes = document.querySelectorAll('.permission-checkbox');

        // 페이지별로 권한 수집
        checkboxes.forEach(checkbox => {
            const page = checkbox.dataset.page;
            const role = checkbox.dataset.role;

            if (!permissions[page]) {
                permissions[page] = {
                    name: checkbox.closest('tr').querySelector('div.fw-bold').textContent,
                    roles: []
                };
            }

            if (checkbox.checked) {
                permissions[page].roles.push(role);
            }
        });

        const response = await fetch('/admin/api/permissions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ pages: permissions })
        });

        const result = await response.json();
        if (result.success) {
            showToast('성공', '권한 설정이 저장되었습니다.', 'success');
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Error saving permissions:', error);
        showToast('오류', '권한 설정 저장 중 오류가 발생했습니다.', 'error');
    }
}


function showSection(sectionName) {
    console.log('Showing section:', sectionName);

    // 모든 섹션 숨기기
    document.querySelectorAll('.section').forEach(section => {
        section.style.display = 'none';
    });

    // 선택된 섹션 보이기
    const selectedSection = document.getElementById(`${sectionName}-section`);
    console.log('Selected section element:', selectedSection);
    if (selectedSection) {
        selectedSection.style.display = 'block';
    }

    // 메뉴 활성화 상태 변경
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    const activeLink = document.querySelector(`[data-section="${sectionName}"]`);
    console.log('Active link element:', activeLink);
    if (activeLink) {
        activeLink.classList.add('active');
    }

    // 섹션별 데이터 로드
    switch (sectionName) {
        case 'overview':
            loadStats();
            break;
        case 'users':
            loadUsers();
            break;
        case 'centers':
            loadCenterStats();
            break;
        case 'permissions':
            loadPermissionsMatrix();
            break;
        case 'sql-manager':
            loadSQLManager();
            break;
    }
}

// 테이블 헤더 클릭 이벤트 처리
function initTableSorting() {
    const headers = document.querySelectorAll('#usersTable th[data-sort]');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const field = header.dataset.sort;
            const currentOrder = header.dataset.order || 'asc';
            const newOrder = currentOrder === 'asc' ? 'desc' : 'asc';

            // 모든 헤더의 정렬 표시 초기화
            headers.forEach(h => {
                h.dataset.order = '';
                h.classList.remove('sorted-asc', 'sorted-desc');
            });

            // 클릭된 헤더의 정렬 표시 업데이트
            header.dataset.order = newOrder;
            header.classList.add(`sorted-${newOrder}`);

            loadUsers(field, newOrder, getCurrentFilters());
        });
    });
}

// 필터 적용
function getCurrentFilters() {
    const filters = {};
    document.querySelectorAll('.column-filter').forEach(filter => {
        filters[filter.dataset.field] = filter.value;
    });
    return filters;
}

// 필터 초기화
function initFilters() {
    document.querySelectorAll('.column-filter').forEach(filter => {
        filter.addEventListener('input', () => {
            loadUsers('no', 'asc', getCurrentFilters());
        });
    });
}

// ========================================
// SQL 관리 기능
// ========================================

let currentTable = null;
let currentPage = 1;
const itemsPerPage = 50;

// SQL 관리 초기화
async function loadSQLManager() {
    try {
        console.log('SQL 관리 초기화...');
        await loadTableList();
    } catch (error) {
        console.error('SQL 관리 초기화 실패:', error);
    }
}

// 테이블 목록 로드
async function loadTableList() {
    try {
        const result = await fetchWithAuth('/admin/api/tables');
        if (!result.success) throw new Error('테이블 목록 조회 실패');

        const tableList = document.getElementById('tableList');
        tableList.innerHTML = result.tables.map(table => `
            <a href="#" class="list-group-item list-group-item-action" 
               onclick="selectTable('${table}'); return false;">
                <i class="bi bi-table me-2"></i>${table}
            </a>
        `).join('');

        console.log(`${result.tables.length}개 테이블 로드 완료`);
    } catch (error) {
        console.error('테이블 목록 로드 실패:', error);
    }
}

// 테이블 선택
async function selectTable(tableName) {
    currentTable = tableName;
    currentPage = 1;

    // 활성 상태 표시
    document.querySelectorAll('#tableList .list-group-item').forEach(item => {
        item.classList.remove('active');
    });
    event.target.closest('.list-group-item').classList.add('active');

    // 테이블명 표시
    document.getElementById('currentTableName').textContent = tableName;
    document.getElementById('uploadTableName').value = tableName;

    // 테이블 구조 및 데이터 로드
    await loadTableStructure(tableName);
    await loadTableData(tableName, currentPage);
}

// 테이블 구조 로드
async function loadTableStructure(tableName) {
    try {
        const result = await fetchWithAuth(`/admin/api/table-structure/${tableName}`);
        if (!result.success) throw new Error('테이블 구조 조회 실패');

        const tbody = document.querySelector('#structureTable tbody');
        tbody.innerHTML = result.structure.map(field => `
            <tr>
                <td>${field.Field}</td>
                <td>${field.Type}</td>
                <td>${field.Null}</td>
                <td>${field.Key}</td>
                <td>${field.Default || '-'}</td>
            </tr>
        `).join('');

        document.getElementById('tableStructureDiv').style.display = 'block';
    } catch (error) {
        console.error('테이블 구조 로드 실패:', error);
    }
}

// 테이블 데이터 로드
async function loadTableData(tableName, page = 1) {
    try {
        const result = await fetchWithAuth(
            `/admin/api/table-data/${tableName}?page=${page}&limit=${itemsPerPage}`
        );
        if (!result.success) throw new Error('데이터 조회 실패');

        const table = document.getElementById('sqlDataTable');

        // 헤더 생성
        if (result.data.length > 0) {
            const columns = Object.keys(result.data[0]);
            const thead = table.querySelector('thead');
            thead.innerHTML = `
                <tr>
                    ${columns.map(col => `<th>${col}</th>`).join('')}
                </tr>
            `;

            // 데이터 생성
            const tbody = table.querySelector('tbody');
            tbody.innerHTML = result.data.map(row => `
                <tr>
                    ${columns.map(col => {
                let value = row[col];
                // 날짜 형식 처리
                if (value instanceof Date || (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/))) {
                    value = new Date(value).toLocaleString('ko-KR');
                }
                return `<td>${value !== null ? value : '-'}</td>`;
            }).join('')}
                </tr>
            `).join('');

            // 페이지네이션 표시
            renderPagination(result.page, result.totalPages);
        } else {
            table.querySelector('thead').innerHTML = '<tr><th>데이터가 없습니다</th></tr>';
            table.querySelector('tbody').innerHTML = '';
            document.getElementById('sqlPagination').style.display = 'none';
        }

    } catch (error) {
        console.error('테이블 데이터 로드 실패:', error);
    }
}

// 페이지네이션 렌더링
function renderPagination(currentPage, totalPages) {
    const pagination = document.getElementById('sqlPagination');
    const ul = pagination.querySelector('.pagination');

    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }

    pagination.style.display = 'block';

    let html = '';

    // 이전 버튼
    html += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage - 1}); return false;">이전</a>
        </li>
    `;

    // 페이지 번호
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    if (startPage > 1) {
        html += `<li class="page-item"><a class="page-link" href="#" onclick="changePage(1); return false;">1</a></li>`;
        if (startPage > 2) html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `
            <li class="page-item ${i === currentPage ? 'active' : ''}">
                <a class="page-link" href="#" onclick="changePage(${i}); return false;">${i}</a>
            </li>
        `;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        html += `<li class="page-item"><a class="page-link" href="#" onclick="changePage(${totalPages}); return false;">${totalPages}</a></li>`;
    }

    // 다음 버튼
    html += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage(${currentPage + 1}); return false;">다음</a>
        </li>
    `;

    ul.innerHTML = html;
}

// 페이지 변경
function changePage(page) {
    if (!currentTable || page < 1) return;
    currentPage = page;
    loadTableData(currentTable, page);
}

// CSV 업로드
async function uploadCSV() {
    const fileInput = document.getElementById('csvFileInput');
    const file = fileInput.files[0];

    if (!file) {
        alert('CSV 파일을 선택해주세요.');
        return;
    }

    if (!currentTable) {
        alert('테이블을 먼저 선택해주세요.');
        return;
    }

    const formData = new FormData();
    formData.append('csvFile', file);

    try {
        const response = await fetch(`/admin/api/upload-csv/${currentTable}`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            alert(result.message);
            // 모달 닫기
            const modal = bootstrap.Modal.getInstance(document.getElementById('csvUploadModal'));
            modal.hide();
            // 데이터 새로고침
            loadTableData(currentTable, currentPage);
        } else {
            alert('업로드 실패: ' + result.error);
        }
    } catch (error) {
        console.error('CSV 업로드 실패:', error);
        alert('업로드 중 오류가 발생했습니다.');
    }
}

// 테이블 새로고침
function refreshTable() {
    if (currentTable) {
        loadTableData(currentTable, currentPage);
    } else {
        loadTableList();
    }
}



// ========================================
// Helper Functions (Permissions & UI)
// ========================================

function addSelectAllRow(roles) {
    const tbody = document.getElementById('permissionsTableBody');
    const tr = document.createElement('tr');
    tr.className = 'table-light fw-bold';

    let html = `
        <td class="align-middle">
            <div class="fw-bold">전체 선택</div>
        </td>
    `;

    roles.forEach(role => {
        html += `
            <td class="text-center">
                <div class="form-check d-flex justify-content-center">
                    <input class="form-check-input select-all-role" 
                           type="checkbox" 
                           data-role="${role}"
                           id="select_all_${role}">
                </div>
            </td>
        `;
    });

    tr.innerHTML = html;
    tbody.insertBefore(tr, tbody.firstChild);
}

function initializeEventListeners() {
    // Role별 전체 선택
    document.querySelectorAll('.select-all-role').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const role = e.target.dataset.role;
            const isChecked = e.target.checked;

            document.querySelectorAll(`.permission-checkbox[data-role="${role}"]`).forEach(permCheckbox => {
                permCheckbox.checked = isChecked;
            });
        });
    });

    // Save Permissions Button
    const saveBtn = document.getElementById('savePermissions');
    if (saveBtn) {
        saveBtn.removeEventListener('click', savePermissionChanges); // Prevent duplicate
        saveBtn.addEventListener('click', savePermissionChanges);
    }
}

function showToast(title, message, type = 'info') {
    // Create toast container if not exists
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        document.body.appendChild(container);
    }

    const toastHtml = `
        <div class="toast align-items-center text-white bg-${type === 'error' ? 'danger' : type}" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">
                    <strong>${title}</strong>: ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;

    const range = document.createRange();
    const toastElement = range.createContextualFragment(toastHtml).firstElementChild;
    container.appendChild(toastElement);

    const toast = new bootstrap.Toast(toastElement);
    toast.show();

    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

// ========================================
// 사용자 센터 변경
// ========================================

async function openEditCenterModal(userId, currentCenterId, userName) {
    if (centerList.length === 0) {
        await loadCenters();
    }

    const select = document.getElementById('editCenterSelect');
    select.innerHTML = '<option value="">센터 선택 (미지정)</option>' +
        centerList.map(center => `
            <option value="${center.id}" ${String(center.id) === String(currentCenterId) ? 'selected' : ''}>
                ${center.id} (${center.name})
            </option>
        `).join('');

    document.getElementById('editCenterUserId').value = userId;
    document.getElementById('editCenterUserName').value = userName;

    const modal = new bootstrap.Modal(document.getElementById('centerEditModal'));
    modal.show();
}

async function saveUserCenter() {
    const userId = document.getElementById('editCenterUserId').value;
    const centerId = document.getElementById('editCenterSelect').value;

    try {
        const response = await fetch(`/admin/api/users/${userId}/center`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ centerId })
        });

        const result = await response.json();

        if (result.success) {
            showToast('성공', '센터 정보가 수정되었습니다.', 'success');

            // 모달 닫기
            const modalEl = document.getElementById('centerEditModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            modal.hide();

            // 목록 새로고침
            loadUsers();

            // 센터 통계도 갱신될 수 있으므로
            loadStats();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        console.error('Center update error:', error);
        alert('센터 수정 실패: ' + error.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');

    // 메뉴 클릭 이벤트 리스너 추가 (페이지 이동이 아닌 내부 섹션만)
    const navLinks = document.querySelectorAll('.nav-link:not(.external-link)');
    console.log('Found nav links:', navLinks.length);

    navLinks.forEach(link => {
        console.log('Adding click listener to:', link.dataset.section);
        link.addEventListener('click', (e) => {
            // data-section이 있는 경우만 이벤트 차단
            if (link.dataset.section) {
                e.preventDefault();
                console.log('Nav link clicked:', e.currentTarget.dataset.section);
                const section = e.currentTarget.dataset.section;
                showSection(section);
            }
        });
    });

    // 테이블 정렬과 필터 초기화
    initTableSorting();
    initFilters();

    // SQL 관리 버튼 이벤트
    const refreshTableBtn = document.getElementById('refreshTableBtn');
    if (refreshTableBtn) {
        refreshTableBtn.addEventListener('click', refreshTable);
    }

    const uploadCsvBtn = document.getElementById('uploadCsvBtn');
    if (uploadCsvBtn) {
        uploadCsvBtn.addEventListener('click', uploadCSV);
    }

    // 초기 섹션 로드 (대시보드 개요)
    showSection('overview');
    loadStats();
    loadCenters(); // 미리 로드

    // 센터 저장 버튼
    const saveCenterBtn = document.getElementById('saveCenterBtn');
    if (saveCenterBtn) {
        saveCenterBtn.addEventListener('click', saveUserCenter);
    }

    console.log('Loading initial section');
});
