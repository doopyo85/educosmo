const StudentManagement = {
    students: [],
    progressData: [],
    editingStudentId: null, // 수정 중인 학생 ID
    isSaving: false, // 저장 중 플래그 (중복 방지)

    // 정렬 상태 관리
    currentSort: {
        key: null,
        order: 'asc' // or 'desc'
    },

    init() {
        console.log('🚀 StudentManagement initialized. Path:', window.location.pathname);
        this.bindEvents();

        // URL 기반 초기 데이터 로드
        const path = window.location.pathname;
        if (path.includes('/list')) {
            console.log('📂 Loading Student List View...');
            this.loadStudents();
        } else if (path.includes('/attendance')) {
            console.log('📅 Loading Attendance View...');
            const now = new Date();
            this.currentAttendanceDate = { year: now.getFullYear(), month: now.getMonth() + 1 };
            this.renderCalendar(this.currentAttendanceDate.year, this.currentAttendanceDate.month);
        } else {
            // Default to progress
            this.loadProgress();
        }
    },

    bindEvents() {
        // 학생 검색
        $('#studentSearch').on('input', (e) => {
            this.filterStudents(e.target.value);
        });

        // 진도 검색
        $('#progressSearch').on('input', (e) => {
            this.filterProgress(e.target.value);
        });

        // 학생 추가 버튼
        $('#addStudentBtn').on('click', () => this.showAddModal());

        // 학생 저장 버튼
        $('#saveStudentBtn').on('click', () => this.saveStudent());

        // 모달 닫힐 때 폼 초기화
        $('#studentModal').on('hidden.bs.modal', () => {
            this.resetForm();
        });

        // 폼 제출 방지 및 엔터키 처리
        $('#studentForm').on('submit', (e) => {
            e.preventDefault();
            this.saveStudent();
        });

        // 테이블 헤더 정렬 클릭 이벤트
        $('.premium-table th[data-sort]').on('click', (e) => {
            const $th = $(e.currentTarget);
            const sortKey = $th.data('sort');
            this.handleSort(sortKey, $th);
        });
    },

    // ============================================
    // 메인 뷰 전환 (사이드바 메뉴)
    // ============================================
    // ============================================
    // 메인 뷰 전환 (사이드바 메뉴)
    // ============================================
    switchMainView(viewType) {
        console.log('switchMainView called with:', viewType);
        // 사이드바 활성화 상태 업데이트
        $('.board-category-item').removeClass('active');
        $(`#nav-${viewType}`).addClass('active');

        // 메인 컨텐츠 전환
        if (viewType === 'class-materials' || viewType === 'career-info') {
            $('#student-management-view').hide();
            $('#coming-soon-view').css('display', 'flex'); // Flex for centering
        } else {
            $('#coming-soon-view').hide();
            $('#student-management-view').show();
        }
    },

    // ============================================
    // 탭 뷰 전환 (학생관리 내부 탭)
    // ============================================
    // switchView Removed - Handled by Server-side Routing & Init

    // ============================================
    // 데이터 로드
    // ============================================
    async loadStudents() {
        console.log('🔄 Fetching student list...');
        try {
            const response = await fetch('/teacher/api/students');
            const data = await response.json();
            console.log('✅ Student list loaded:', data.success, 'Count:', data.students ? data.students.length : 0);

            if (data.success) {
                this.students = data.students || [];
                this.renderStudents();
            } else {
                console.error('❌ API Error:', data.message);
            }
        } catch (error) {
            console.error('학생 목록 로드 오류:', error);
            this.showAlert('학생 목록을 불러오는데 실패했습니다.', 'danger');
        }
    },

    async loadProgress() {
        try {
            const response = await fetch('/teacher/api/student-progress');
            const data = await response.json();

            if (data.success) {
                this.progressData = data.students;
                this.renderProgress();
            } else {
                console.error('진도 데이터 로드 실패:', data.message);
            }
        } catch (error) {
            console.error('진도 데이터 로드 오류:', error);
        }
    },

    // ============================================
    // 정렬 로직
    // ============================================
    handleSort(key, $clickedTh) {
        // 정렬 순서 토글
        if (this.currentSort.key === key) {
            this.currentSort.order = this.currentSort.order === 'asc' ? 'desc' : 'asc';
        } else {
            this.currentSort.key = key;
            this.currentSort.order = 'asc';
        }

        // UI 업데이트 (헤더 아이콘)
        $('.premium-table th').removeClass('sorted-asc sorted-desc');
        if (this.currentSort.order === 'asc') {
            $clickedTh.addClass('sorted-asc');
        } else {
            $clickedTh.addClass('sorted-desc');
        }

        // 활성화된 탭에 따라 데이터 정렬 및 렌더링
        const activeView = $('.tab-pane.active').attr('id');

        if (activeView === 'student-progress') {
            this.sortData(this.progressData);
            this.renderProgress();
        } else {
            this.sortData(this.students);
            this.renderStudents();
        }
    },

    sortData(dataList) {
        const { key, order } = this.currentSort;
        if (!key) return;

        dataList.sort((a, b) => {
            let valA = a[key] || '';
            let valB = b[key] || '';

            // 숫자형 데이터 처리
            if (typeof valA === 'number' && typeof valB === 'number') {
                return order === 'asc' ? valA - valB : valB - valA;
            }

            // 날짜/문자열 처리
            valA = String(valA).toLowerCase();
            valB = String(valB).toLowerCase();

            if (valA < valB) return order === 'asc' ? -1 : 1;
            if (valA > valB) return order === 'asc' ? 1 : -1;
            return 0;
        });
    },

    // ============================================
    // 렌더링 (학생 목록)
    // ============================================
    renderStudents(listToRender = this.students) {
        const tbody = $('#studentTableBody');
        console.log('🎨 Rendering students. Target found:', tbody.length > 0, 'Count:', listToRender ? listToRender.length : 0);

        if (tbody.length === 0) {
            console.error('❌ Critical Error: #studentTableBody not found in DOM!');
            return;
        }

        tbody.empty();

        if (!listToRender || listToRender.length === 0) {
            tbody.append(`
                <tr>
                    <td colspan="8" class="empty-state">
                        <i class="bi bi-people"></i>
                        <p>등록된 학생이 없습니다.</p>
                    </td>
                </tr>
            `);
            return;
        }

        listToRender.forEach((student, index) => {
            tbody.append(`
                <tr>
                    <td class="col-number">${index + 1}</td>
                    <td>
                        <img src="${student.profile_image || '/resource/profiles/default.webp'}" 
                             class="profile-img" width="36" height="36">
                    </td>
                    <td>
                        <span class="fw-bold">${student.name || '-'}</span>
                    </td>
                    <td>
                        <a href="#" onclick="StudentManagement.openStudentDetail(${student.id}); return false;" 
                           class="student-link">
                            ${student.userID}
                        </a>
                    </td>
                    <td><span class="text-muted">${student.email || '-'}</span></td>
                    <td><span class="text-muted">${student.created_at ? new Date(student.created_at).toLocaleDateString('ko-KR') : '-'}</span></td>
                    <td><span class="text-muted">${student.last_access ? new Date(student.last_access).toLocaleDateString('ko-KR') : '-'}</span></td>
                    <td>
                        <button class="btn-icon edit me-1" 
                                onclick="StudentManagement.editStudent(${student.id})" title="수정">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn-icon delete" 
                                onclick="StudentManagement.deleteStudent(${student.id}, '${student.name}')" title="삭제">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `);
        });
    },

    // ============================================
    // 렌더링 (학습 진도)
    // ============================================
    renderProgress(listToRender = this.progressData) {
        const tbody = $('#progressTableBody');
        tbody.empty();

        if (listToRender.length === 0) {
            tbody.append(`
                <tr>
                    <td colspan="12" class="empty-state">
                        <i class="bi bi-clipboard-data"></i>
                        <p>학습 진도 데이터가 없습니다.</p>
                    </td>
                </tr>
            `);
            return;
        }

        listToRender.forEach((student, index) => {
            console.log(student); // Add console.log(student) to check data structure and ensure zero handling
            const storageUsage = this.formatBytes(student.storage_usage || 0);

            // Platforms Data
            const platforms = [
                { key: 'scratch', label: '스크래치', completed: student.scratch_completed || 0, total: student.scratch_total || 0 },
                { key: 'entry', label: '엔트리', completed: student.entry_completed || 0, total: student.entry_total || 0 },
                { key: 'appinventor', label: '앱인벤터', completed: student.appinventor_completed || 0, total: student.appinventor_total || 0 },
                { key: 'python', label: '파이썬', completed: student.python_completed || 0, total: student.python_total || 0 },
                { key: 'dataanalysis', label: '데이터', completed: student.dataanalysis_completed || 0, total: student.dataanalysis_total || 0 }
            ];

            let platformCells = '';
            platforms.forEach(p => {
                const percent = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
                // If total is 0, show - or 0%?
                const displayPercent = p.total > 0 ? `${percent}%` : '0%';

                // Clickable chart triggering collapse
                // Wrap ID in quotes to be safe
                platformCells += `
                    <td class="text-center clickable-cell">
                        <div onclick="StudentManagement.toggleDetail(this, '${student.user_id}', '${p.key}', event)" style="cursor: pointer;">
                            <div class="circular-chart small" data-percent="${percent}" 
                                style="background: conic-gradient(#0d6efd 0% ${percent}%, #e9ecef ${percent}% 100%); width: 28px; height: 28px; margin: 0 auto;"
                                title="${p.label}: ${p.completed}/${p.total}">
                            </div>
                            <div class="small text-muted mt-1" style="font-size: 0.7rem;">${p.completed}/${p.total}</div>
                        </div>
                    </td>
                `;
            });

            // Main Row
            tbody.append(`
                <tr id="row-${student.user_id}">
                    <td class="col-number">${index + 1}</td>
                    <td>
                        <img src="${student.profile_image || '/resource/profiles/default.webp'}" 
                            class="profile-img" width="36" height="36">
                    </td>
                    <td>
                        <span class="badge-soft-success">
                            Lv. ${student.ct_level || 0}
                        </span>
                    </td>
                    <td><span class="fw-bold text-dark">${student.name || '-'}</span></td>
                    <td>
                        <a href="#" onclick="StudentManagement.openStudentDetail(${student.user_id}); return false;" 
                           class="student-link">
                            ${student.username}
                        </a>
                    </td>
                    
                    ${platformCells}

                    <td class="text-center">
                        <a href="#" onclick="openStudentS3Folder('${student.username}'); return false;" 
                           class="btn-icon mb-1" title="파일 폴더 열기">
                            <i class="bi bi-folder2-open fs-5"></i>
                        </a>
                        <div class="small text-muted" style="line-height:1;">${storageUsage}</div>
                    </td>
                    <td><span class="text-muted small">${student.last_learning_at || '-'}</span></td>
                </tr>
            `);
        });

        // Remove existing handler to prevent duplicates
        $(document).off('click.popover').on('click.popover', (e) => {
            if (!$(e.target).closest('.clickable-cell').length && !$(e.target).closest('#global-platform-popover').length) {
                this.closeAllPopovers();
            }
        });

        $(window).off('scroll.popover').on('scroll.popover', () => {
            this.closeAllPopovers();
        });
    },

    generateDots(completed, total) {
        let dotsHtml = '';
        for (let i = 0; i < total; i++) {
            const isCompleted = i < completed;
            const activeClass = isCompleted ? 'completed' : '';
            dotsHtml += `<div class="dot ${activeClass}" style="width: 8px; height: 8px; margin: 2px;" title="콘텐츠 ${i + 1}"></div>`;
        }
        return dotsHtml;
    },

    toggleDetail(element, userId, platformKey, event) {
        if (event) event.stopPropagation();

        console.log('toggleDetail called:', userId, platformKey); // Debug log

        const $popover = $('#global-platform-popover');

        // Identify if this is a toggle (clicking same element while open)
        // We can store the current target on the popover
        const currentTargetId = $popover.data('target-id');
        const newTargetId = `${userId}-${platformKey}`;

        if ($popover.is(':visible') && currentTargetId === newTargetId) {
            this.closeAllPopovers();
            return;
        }

        // Loose comparison for ID (string vs number)
        const student = this.progressData.find(s => s.user_id == userId);

        if (!student) {
            console.error('Student not found for ID:', userId);
            return;
        }

        // Map platform key to data fields
        let completed = 0, total = 0, label = '';
        if (platformKey === 'scratch') { completed = student.scratch_completed; total = student.scratch_total; label = '스크래치'; }
        else if (platformKey === 'entry') { completed = student.entry_completed; total = student.entry_total; label = '엔트리'; }
        else if (platformKey === 'appinventor') { completed = student.appinventor_completed; total = student.appinventor_total; label = '앱인벤터'; }
        else if (platformKey === 'python') { completed = student.python_completed; total = student.python_total; label = '파이썬'; }
        else if (platformKey === 'dataanalysis') { completed = student.dataanalysis_completed; total = student.dataanalysis_total; label = '데이터분석'; }

        // Content
        let contentHtml = `
            <div class="d-flex justify-content-between align-items-center mb-2">
                <div>
                    <span class="badge bg-primary me-1">${label}</span>
                    <span class="small text-muted">${completed} / ${total} 완료</span>
                </div>
                <button type="button" class="btn-close btn-close-sm" aria-label="Close" 
                        onclick="StudentManagement.closeAllPopovers()"></button>
            </div>
            <div class="completion-dots" style="justify-content: flex-start;">
                ${this.generateDots(completed, total)}
            </div>
        `;
        $popover.html(contentHtml);

        // Positioning
        // Positioning (Fixed - Viewport Relative)
        const rect = element.getBoundingClientRect();

        // Center horizontally relative to the clicked element
        let left = rect.left + (rect.width / 2) - ($popover.outerWidth() / 2);
        // Position below, with a small gap
        let top = rect.bottom + 8;

        // Boundary checks (Simple)
        // If it goes too far right, shift left
        if (left + $popover.outerWidth() > window.innerWidth) {
            left = window.innerWidth - $popover.outerWidth() - 20;
        }
        if (left < 10) left = 10;

        $popover.css({
            top: top + 'px',
            left: left + 'px',
            position: 'fixed' // Ensure fixed positioning via JS too
        }).data('target-id', newTargetId).fadeIn(150);
    },

    closeAllPopovers() {
        $('#global-platform-popover').fadeOut(100).data('target-id', null);
    },

    // ============================================
    // 검색 필터
    // ============================================
    filterStudents(searchText) {
        const searchLower = searchText.toLowerCase();
        const filtered = this.students.filter(s =>
            (s.name && s.name.toLowerCase().includes(searchLower)) ||
            (s.userID && s.userID.toLowerCase().includes(searchLower))
        );
        this.renderStudents(filtered);
    },

    filterProgress(searchText) {
        const searchLower = searchText.toLowerCase();
        const filtered = this.progressData.filter(s =>
            (s.name && s.name.toLowerCase().includes(searchLower)) ||
            (s.username && s.username.toLowerCase().includes(searchLower))
        );
        this.renderProgress(filtered);
    },

    // ============================================
    // 유틸리티
    // ============================================
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    },

    openStudentDetail(userId) {
        const width = 900;
        const height = 700;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;
        window.open(`/teacher/student-detail/${userId}`, 'studentDetail', `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`);
    },

    // ============================================
    // 학생 추가/수정/삭제 (기존 유지)
    // ============================================
    showAddModal() {
        this.editingStudentId = null;
        $('#modalTitle').text('학생 추가');
        $('#studentForm')[0].reset();
        $('#studentId').val('');
        $('#userID').prop('disabled', false);
        $('#password').attr('placeholder', '비밀번호');
        $('#studentModal').modal('show');
    },

    editStudent(id) {
        const student = this.students.find(s => s.id === id);
        if (!student) {
            this.showAlert('학생 정보를 찾을 수 없습니다.', 'danger');
            return;
        }

        this.editingStudentId = id;
        $('#modalTitle').text('학생 정보 수정');
        $('#studentId').val(id);
        $('#userID').val(student.userID).prop('disabled', true);
        $('#name').val(student.name || '');
        $('#email').val(student.email || '');
        $('#password').val('').attr('placeholder', '변경 시에만 입력');
        $('#phone').val(student.phone || '');
        $('#birthdate').val(student.birthdate ? student.birthdate.split('T')[0] : '');
        $('#studentModal').modal('show');
    },

    resetForm() {
        this.editingStudentId = null;
        $('#studentForm')[0].reset();
        $('#studentId').val('');
        $('#userID').prop('disabled', false);
        $('#password').attr('placeholder', '비밀번호');
    },

    async saveStudent() {
        if (this.isSaving) return;

        // ... (기존 비즈니스 로직 유지)
        const userID = $('#userID').val().trim();
        const name = $('#name').val().trim();
        const email = $('#email').val().trim();
        const password = $('#password').val();
        const phone = $('#phone').val().trim();
        const birthdate = $('#birthdate').val();

        if (!userID) { this.showAlert('아이디를 입력해주세요.', 'warning'); $('#userID').focus(); return; }
        if (!name) { this.showAlert('이름을 입력해주세요.', 'warning'); $('#name').focus(); return; }
        if (!this.editingStudentId && !password) { this.showAlert('비밀번호를 입력해주세요.', 'warning'); $('#password').focus(); return; }

        const $saveBtn = $('#saveStudentBtn');
        const originalText = $saveBtn.text();

        this.isSaving = true;
        $saveBtn.prop('disabled', true).text('저장 중...');

        try {
            let url, method, body;
            if (this.editingStudentId) {
                url = `/teacher/api/students/${this.editingStudentId}`;
                method = 'PUT';
                body = { name, email, phone, birthdate };
                if (password) body.password = password;
            } else {
                url = '/teacher/api/students';
                method = 'POST';
                body = { userID, name, email, password, phone, birthdate };
            }

            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await response.json();
            if (data.success) {
                this.showAlert(data.message || '저장되었습니다.', 'success');
                $('#studentModal').modal('hide');
                this.loadStudents();
                this.loadProgress();
            } else {
                this.showAlert(data.message || '저장에 실패했습니다.', 'danger');
            }
        } catch (error) {
            console.error('학생 저장 오류:', error);
            this.showAlert('저장 중 오류가 발생했습니다.', 'danger');
        } finally {
            this.isSaving = false;
            $saveBtn.prop('disabled', false).text(originalText);
        }
    },

    async deleteStudent(id, name) {
        if (!confirm(`정말 "${name || '이 학생'}"을(를) 삭제하시겠습니까?\n\n삭제된 학생 정보는 복구할 수 없습니다.`)) return;
        try {
            const response = await fetch(`/teacher/api/students/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
            const data = await response.json();
            if (data.success) {
                this.showAlert(data.message || '학생이 삭제되었습니다.', 'success');
                this.loadStudents();
                this.loadProgress();
            } else {
                this.showAlert(data.message || '삭제에 실패했습니다.', 'danger');
            }
        } catch (error) {
            console.error('학생 삭제 오류:', error);
            this.showAlert('삭제 중 오류가 발생했습니다.', 'danger');
        }
    },

    // ============================================
    // 출석부 (캘린더)
    // ============================================
    prevMonth() {
        let { year, month } = this.currentAttendanceDate;
        month--;
        if (month < 1) { month = 12; year--; }
        this.currentAttendanceDate = { year, month };
        this.renderCalendar(year, month);
    },

    nextMonth() {
        let { year, month } = this.currentAttendanceDate;
        month++;
        if (month > 12) { month = 1; year++; }
        this.currentAttendanceDate = { year, month };
        this.renderCalendar(year, month);
    },

    async renderCalendar(year, month) {
        $('#currentMonthLabel').text(`${year}. ${String(month).padStart(2, '0')}`);

        const $calendar = $('#attendance-calendar');
        $calendar.empty();

        // 1. Fetch Data
        let attendanceMap = {};
        try {
            const response = await fetch(`/teacher/api/attendance/monthly?year=${year}&month=${month}`);
            const result = await response.json();
            if (result.success) {
                // Group by day (1~31)
                result.data.forEach(item => {
                    const day = parseInt(item.day);
                    if (!attendanceMap[day]) attendanceMap[day] = [];
                    attendanceMap[day].push(item);
                });
            } else {
                console.error('출석 데이터 로드 실패:', result.message);
            }
        } catch (error) {
            console.error('출석 데이터 API 오류:', error);
        }

        // 2. Header (Sun ~ Sat)
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        days.forEach(day => {
            $calendar.append(`<div class="calendar-header">${day}</div>`);
        });

        // 3. Days
        const firstDay = new Date(year, month - 1, 1).getDay();
        const lastDate = new Date(year, month, 0).getDate();

        // Empty cells for previous month
        for (let i = 0; i < firstDay; i++) {
            $calendar.append(`<div class="calendar-day empty" style="background:none; border:none;"></div>`);
        }

        // Days
        for (let d = 1; d <= lastDate; d++) {
            const dayOfWeek = new Date(year, month - 1, d).getDay();

            let dayClass = 'day-number';
            if (dayOfWeek === 0) dayClass += ' sunday';
            if (dayOfWeek === 6) dayClass += ' saturday';

            // Check if today
            const today = new Date();
            const isToday = today.getFullYear() === year && (today.getMonth() + 1) === month && today.getDate() === d;
            const todayClass = isToday ? 'today' : '';

            // Attendance List
            const attendees = attendanceMap[d] || [];
            let attendeesHtml = '';
            attendees.forEach(att => {
                attendeesHtml += `<div class="attendance-item" title="${att.name} (${att.time})">${att.name} <span style="font-size:0.7em; color:#888;">${att.time}</span></div>`;
            });

            $calendar.append(`
                <div class="calendar-day ${todayClass}">
                    <div class="${dayClass}">${d}</div>
                    <div class="attendance-list">
                        ${attendeesHtml}
                    </div>
                </div>
            `);
        }
    },

    showAlert(message, type = 'info') {
        $('.student-management-alert').remove();
        const alertHtml = `
            <div class="alert alert-${type} alert-dismissible fade show student-management-alert" 
                 role="alert" style="position: fixed; top: 80px; right: 20px; z-index: 9999; min-width: 300px;">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        $('body').append(alertHtml);
        setTimeout(() => {
            $('.student-management-alert').fadeOut(300, function () { $(this).remove(); });
        }, 3000);
    }
};

window.StudentManagement = StudentManagement;

// !! Initialize !!
$(document).ready(function () {
    StudentManagement.init();
});
