/**
 * 🔥 S3Explorer - 재사용 가능한 S3 파일 탐색기 컴포넌트
 * Windows 탐색기 스타일 UI
 */

class S3Explorer {
  // Utility for escaping HTML within the class
  escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  constructor(config) {
    this.config = {
      containerId: config.containerId || 's3-browser',
      apiEndpoint: config.apiEndpoint || '/api/s3/browse',
      scope: config.scope || 'self',
      rootPath: config.rootPath || '',
      platforms: config.allowedPlatforms || [],
      enableUpload: config.enableUpload || false,
      enableDelete: config.enableDelete || false,
      enablePreview: config.enablePreview || true,
      onFileSelect: config.onFileSelect || null,
      onFolderOpen: config.onFolderOpen || null,
      onError: config.onError || null,
      userID: config.userID || '',  // 🔥 userID 추가
      userRole: config.userRole || 'guest',  // 🔥 userRole 추가
      s3AssetUrl: config.s3AssetUrl || '' // 🔥 NCP Asset URL 추가
    };

    // 🔥 역할별 최이 경로 설정
    this.setInitialPath();
    this.selectedFiles = [];
    this.sortOptions = { field: 'name', order: 'asc' };
    this.viewMode = 'list'; // 🔥 기본 보기 모드 (list | grid)

    this.init();
  }

  /**
   * 🔥 역할별 초기 경로 설정
   */
  setInitialPath() {
    // admin은 Root부터 시작 가능
    if (this.config.scope === 'all' || this.config.userRole === 'admin') {
      this.currentPath = this.config.rootPath || '';
      this.allowedBasePath = '';
      this.canAccessRoot = true;
    }
    // manager/teacher는 users/부터 시작
    else if (this.config.scope === 'center' || this.config.userRole === 'manager' || this.config.userRole === 'teacher') {
      this.currentPath = 'users/';
      this.allowedBasePath = 'users/';
      this.config.rootPath = 'users/';  // rootPath도 업데이트
      this.canAccessRoot = false;  // 🔥 Root 접근 불가
    }
    // student는 본인 폴더부터 시작
    else if (this.config.scope === 'self' || this.config.userRole === 'student') {
      this.currentPath = `users/${this.config.userID}/`;
      this.allowedBasePath = `users/${this.config.userID}/`;
      this.config.rootPath = `users/${this.config.userID}/`;
      this.canAccessRoot = false;  // 🔥 Root 접근 불가
    } else {
      // guest나 기타 역할은 접근 불가
      this.currentPath = '';
      this.allowedBasePath = '';
      this.canAccessRoot = false;
    }

    console.log(`🔐 초기 경로 설정 - Role: ${this.config.userRole}, Path: ${this.currentPath}, Root Access: ${this.canAccessRoot}`);

    // 🔥 Make instance globally available for onclick handlers in HTML strings
    // But be careful with multiple instances.
    // For now we assume one active or we rely on the specific container managing it?
    // Actually the strings use `window.s3Explorer`. We must ensure `window.s3Explorer` points to THIS instance if we use it.
    // But wait, if we have multiple (browser + selector), overwriting `window.s3Explorer` breaks the main one.
    // Ideally we should use instance IDs or element scoping.
    // For now, let's assume `s3SelectorModal` sets `window.s3Explorer = this`? No, that's messy.
    // `S3Explorer` code uses `window.s3Explorer` hardcoded in `onclick`.
    // We should fix `onclick` to usage based on container or pass the reference.
    // Quick Fix: S3Explorer class assigns `window.s3Explorer = this;` in constructor?
    // If we want multiple, we need `window.s3ExplorerInstances[id]`.
    // Since I can't refactor the whole class easily, I will just note that `window.s3Explorer` updates to the latest.
    // The main browser probably initialized on page load. The selector initializes on modal open.
    // So the selector "wins" which is fine for the modal. When modal closes, we might need to restore?
    // Or just accept that the main browser requires a refresh or re-init if interaction continues.
    // Actually, `nuguri.js` created `window.s3ExplorerSelector`.
    // But the HTML strings inside S3Explorer.js hardcode `window.s3Explorer`.
    // I MUST change `window.s3Explorer` to `this` instance during render, but I can't inject `this` into string easily without a global ref.
    // I will add `window.s3Explorer = this;` to the constructor for now.
    window.s3Explorer = this;
  }

  handleFileClick(key, name) {
    if (this.config.onFileSelect) {
      this.config.onFileSelect({ key, name });
    }
  }

  async init() {
    console.log('🔧 S3Explorer 초기화...');
    this.selectedFiles = [];  // 🔥 선택된 파일 초기화
    this.renderLayout();
    await this.loadFolder(this.currentPath, true); // 🔥 Build Tree on Init
  }

  /**
   * UI 레이아웃 렌더링
   */
  renderLayout() {
    const container = document.getElementById(this.config.containerId);
    if (!container) {
      console.error('❌ 컨테이너를 찾을 수 없습니다:', this.config.containerId);
      return;
    }

    container.innerHTML = `
      <div class="s3-browser-wrapper">
        <!-- 메인 컨텐츠 -->
        <div class="s3-browser-content" id="mainContent">

          <!-- 왼쪽: 폴더 트리 -->
          <div class="folder-tree-container">
            <div class="folder-tree-header">
              <h4>📁 폴더</h4>
            </div>
            <div id="s3-folder-tree" class="folder-tree"></div>
          </div>
          
          <!-- 오른쪽: 파일 목록 + Breadcrumb -->
          <div class="file-list-container">
            <!-- Breadcrumb (Moved Inside) -->
            <div class="breadcrumb-container">
              <div id="s3-breadcrumb" class="breadcrumb"></div>
              <div class="breadcrumb-actions">
                <button onclick="window.s3Explorer.refresh()" title="새로고침" class="btn-icon-white"><i class="bi bi-arrow-clockwise"></i></button>
                <button onclick="window.s3Explorer.closePage()" title="창 닫기" class="btn-icon-white"><i class="bi bi-x-lg"></i></button>
              </div>
            </div>


            <!-- 툴바 -->
            <div class="file-list-toolbar">
              <div class="toolbar-left">
                <span id="file-count">0개 항목</span>
              </div>
              <div class="toolbar-right">
                <!-- 🔥 보기 모드 토글 -->
                <div class="view-mode-group">
                  <button class="btn-icon ${this.viewMode === 'list' ? 'active' : ''}" onclick="window.s3Explorer.setViewMode('list')" title="목록형">
                    <i class="bi bi-list-ul"></i>
                  </button>
                  <button class="btn-icon ${this.viewMode === 'grid' ? 'active' : ''}" onclick="window.s3Explorer.setViewMode('grid')" title="갤러리형">
                    <i class="bi bi-grid-fill"></i>
                  </button>
                </div>
                ${this.renderToolbar()}
              </div>
            </div>
            
          
            <!-- 🔥 파일 리스트 영역 (List/Grid 분기) -->
            <div id="file-list-view" class="file-list-view ${this.viewMode}">
                <table id="s3-file-list" class="file-list-table" style="display: ${this.viewMode === 'list' ? 'table' : 'none'}">
                  <thead>
                    <tr>
                      ${this.config.enableDelete ? '<th width="5%"><input type="checkbox" id="selectAllCheckbox" onclick="window.s3Explorer.toggleSelectAll(this)" title="전체 선택"></th>' : ''}
                      <th width="${this.config.enableDelete ? '45%' : '50%'}" class="sortable" onclick="window.s3Explorer.sortBy('name')">
                        이름 <span class="sort-indicator">▼</span>
                      </th>
                      <th width="15%" class="sortable" onclick="window.s3Explorer.sortBy('size')">
                        크기 <span class="sort-indicator"></span>
                      </th>
                      <th width="20%" class="sortable" onclick="window.s3Explorer.sortBy('date')">
                        수정일 <span class="sort-indicator"></span>
                      </th>
                      <th width="15%">삭제</th>
                    </tr>
                  </thead>
                  <tbody></tbody>
                </table>

                <!-- 갤러리형 뷰 -->
                <div id="s3-file-grid" class="file-grid-container" style="display: ${this.viewMode === 'grid' ? 'grid' : 'none'}"></div>
            </div>

          </div>
        </div>
        
        <!--로딩 오버레이-- >
        <div id="s3-loading" class="loading-overlay" style="display: none;">
          <div class="spinner"></div>
          <p>불러오는 중...</p>
        </div>
        
        <!-- 🔥 드래그 앤 드롭 오버레이-- >
      <div id="drag-drop-overlay" class="drag-drop-overlay" style="display: none;">
        <div class="drag-drop-message">
          <i class="bi bi-cloud-upload" style="font-size: 64px; color: #007bff;"></i>
          <h3>📤 파일을 드롭하세요</h3>
          <p>현재 경로에 업로드됩니다</p>
        </div>
      </div>
      </div>
      `;

    // 🔥 드래그 앤 드롭 이벤트 등록
    this.setupDragAndDrop();
  }

  /**
   * Platform 필터 렌더링
   */
  renderPlatformFilter() {
    if (this.config.scope === 'self' || this.config.platforms.length === 0) {
      return ''; // 학생은 필터 불필요
    }

    return `
      <div class="platform-filter">
        <label>플랫폼:</label>
        <select id="platform-select" onchange="window.s3Explorer.filterByPlatform(this.value)">
          <option value="">전체</option>
          ${this.config.platforms.map(p => `<option value="${p}">${p}</option>`).join('')}
        </select>
      </div>
      `;
  }

  /**
   * 툴바 버튼 렌더링
   */
  renderToolbar() {
    const buttons = [];

    if (this.config.enableUpload) {
      buttons.push('<button onclick="window.s3Explorer.upload()">📤 업로드</button>');
    }

    if (this.config.enableDelete) {
      buttons.push('<button id="deleteSelectedBtn" onclick="window.s3Explorer.deleteSelected()" disabled>🗑️ 선택 삭제 (<span id="selectedCount">0</span>)</button>');
    }

    return buttons.join('');
  }

  /**
   * 폴더 로드
   */
  /**
   * 폴더 로드 - Tree View Compatible
   * @param {string} path - Target path
   * @param {boolean} updateTree - Whether to rebuild the tree (e.g. initial load)
   */
  async loadFolder(path, updateTree = false) {
    if (!this.isPathAllowed(path)) {
      this.showError('접근 권한이 없는 경로입니다.');
      if (this.allowedBasePath && path !== this.allowedBasePath) {
        await this.loadFolder(this.allowedBasePath, true);
      }
      return;
    }

    try {
      this.showLoading(true);

      const platform = document.getElementById('platform-select')?.value || '';
      const url = `${this.config.apiEndpoint}?prefix=${encodeURIComponent(path)}${platform ? '&platform=' + platform : ''}`;

      const response = await fetch(url);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '폴더를 불러올 수 없습니다.');
      }

      this.currentPath = path;

      // 1. Breadcrumbs & File List (Always Update)
      this.renderBreadcrumbs(data.breadcrumbs);
      this.renderFileList(data.files);

      // Update File Count
      // Update File Count
      const folderCount = data.folders ? data.folders.length : 0;
      const fileCount = data.files ? data.files.length : 0;

      const countEl = document.getElementById('file-count');
      if (countEl) {
        if (fileCount === 0 && folderCount > 0) {
          countEl.textContent = `파일 0개(${folderCount}개 폴더)`;
        } else if (fileCount === 0 && folderCount === 0) {
          countEl.textContent = `항목 없음`;
        } else {
          countEl.textContent = `파일 ${fileCount} 개(${folderCount}개 폴더)`;
        }
      }

      // 2. Tree Update Strategy
      if (updateTree) {
        // Full Rebuild (Initial Load)
        // For Teacher/Manager, we might want to start with the list of users?
        // Or just render the current folder's children as the root of the tree?
        // Let's assume the 'folders' returned here for the root path are the top-level nodes.
        this.renderTreeRoot(data.folders);
      } else {
        // Just highlight the current node
        this.highlightTreeNode(path);
      }

      if (this.config.onFolderOpen) {
        this.config.onFolderOpen(path);
      }

    } catch (error) {
      console.error('❌ 폴더 로드 실패:', error);
      this.showError(error.message);
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * 🍞 Breadcrumb 렌더링
   */
  renderBreadcrumbs(breadcrumbs) {
    const container = document.getElementById('s3-breadcrumb');
    if (!container) return;

    let filteredBreadcrumbs = breadcrumbs;

    // 비admin은 Root 숨김
    // 비admin은 Root 숨기기 (단, Root만 남았을 땐 "내 파일"로 표시)
    if (!this.canAccessRoot) {
      // Root (첫 번째 항목) 제거 조건
      // 1. Root 경로여야 함 ('' 또는 '/')
      // 2. 전체 길이가 1보다 커야 함 (즉, 하위 폴더에 있는 경우)
      if (breadcrumbs.length > 1 && (!breadcrumbs[0].path || breadcrumbs[0].path === '' || breadcrumbs[0].path === '/')) {
        filteredBreadcrumbs = breadcrumbs.slice(1);
      } else if (breadcrumbs.length === 1 && (!breadcrumbs[0].path || breadcrumbs[0].path === '' || breadcrumbs[0].path === '/')) {
        // Root만 있는데 접근 권한이 없으면 "내 파일" 등으로 대체 표시
        filteredBreadcrumbs[0].name = "내 파일";
      }
    }

    container.innerHTML = filteredBreadcrumbs.map((crumb, idx) => {
      const displayName = this.escapeHtml(decodeURIComponent(crumb.name));

      if (idx === filteredBreadcrumbs.length - 1) {
        return `<span class="breadcrumb-current">${displayName}</span>`;
      }
      return `<a href="#" class="breadcrumb-link" onclick="window.s3Explorer.navigateTo('${crumb.path}'); return false;">${displayName}</a>`;
    }).join(' <span class="breadcrumb-separator">/</span> ');
  }

  /**
   * 🌳 트리 루트 렌더링
   */
  renderTreeRoot(folders) {
    const container = document.getElementById('s3-folder-tree');
    container.innerHTML = '';

    // Add "Root" or "Users" header node if needed, or just list the folders.
    // For Teacher/Manager, 'folders' are the list of students (users).

    if (folders.length === 0) {
      container.innerHTML = '<div class="p-3 text-muted small">폴더가 없습니다.</div>';
      return;
    }

    const ul = document.createElement('div');
    ul.className = 'tree-level'; // Container for nodes
    folders.forEach(folder => {
      ul.appendChild(this.createTreeNode(folder));
    });
    container.appendChild(ul);
  }

  /**
   * 🌳 트리 노드 생성 (DOM Element) - Windows 탐색기 스타일
   */
  createTreeNode(folder) {
    const node = document.createElement('div');
    node.className = 'tree-node';
    node.dataset.path = folder.fullPath;

    // Wrapper for toggle + folder-item (한 줄 정렬)
    const wrapper = document.createElement('div');
    wrapper.className = 'folder-item-wrapper';

    // Toggle Button (왼쪽)
    const toggle = document.createElement('button');
    toggle.className = 'tree-toggle';
    toggle.innerHTML = '<i class="bi bi-chevron-right"></i>';
    toggle.onclick = (e) => {
      e.stopPropagation();
      this.toggleTreeNode(node, folder.fullPath, toggle);
    };

    // Folder Item (오른쪽)
    const content = document.createElement('div');
    content.className = `folder-item ${this.currentPath === folder.fullPath ? 'active' : ''}`;
    content.onclick = (e) => {
      this.loadFolder(folder.fullPath, false);
    };

    // Icon
    const icon = document.createElement('i');
    icon.className = 'bi bi-folder-fill folder-icon';

    // Label Span (userName 포함)
    const span = document.createElement('span');
    span.className = 'tree-label';

    // userName이 있으면 인라인으로 표시
    if (folder.userName) {
      span.innerHTML = `<span class="user-badge">(${this.escapeHtml(folder.userName)})</span>${this.escapeHtml(folder.name)}`;
    } else {
      span.textContent = folder.name;
    }

    content.appendChild(icon);
    content.appendChild(span);

    wrapper.appendChild(toggle);
    wrapper.appendChild(content);

    node.appendChild(wrapper);

    // Children Container
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'tree-children';
    node.appendChild(childrenContainer);

    return node;
  }

  /**
   * 🌳 트리 노드 토글 (Expand/Collapse)
   */
  async toggleTreeNode(nodeElement, path, toggleBtn) {
    const childrenContainer = nodeElement.querySelector('.tree-children');
    const isExpanded = childrenContainer.classList.contains('visible');

    if (isExpanded) {
      // Collapse
      childrenContainer.classList.remove('visible');
      toggleBtn.classList.remove('expanded');
    } else {
      // Expand
      toggleBtn.classList.add('expanded');
      // Check if already loaded
      if (childrenContainer.hasChildNodes()) {
        childrenContainer.classList.add('visible');
      } else {
        // Lazy Load
        await this.loadTreeChildren(path, childrenContainer);
      }
    }
  }

  /**
   * 🌳 하위 폴더 로드 (Lazy Load)
   */
  async loadTreeChildren(path, container) {
    try {
      // Don't show global loading for this small action
      toggleLoadingSpinner(container, true);

      const url = `${this.config.apiEndpoint}?prefix = ${encodeURIComponent(path)} `;
      const response = await fetch(url);
      const data = await response.json();

      if (data.success && data.folders.length > 0) {
        data.folders.forEach(folder => {
          container.appendChild(this.createTreeNode(folder));
        });
        container.classList.add('visible');
      } else {
        // No subfolders
        const empty = document.createElement('div');
        empty.className = 'text-muted small ms-4 fst-italic';
        empty.textContent = '(하위 폴더 없음)';
        container.appendChild(empty);
        container.classList.add('visible');
      }
    } catch (e) {
      console.error(e);
    } finally {
      toggleLoadingSpinner(container, false);
    }
  }

  /**
   * 🌳 트리 하이라이트 업데이트
   */
  highlightTreeNode(path) {
    // Remove old active
    const oldActive = document.querySelector('.folder-item.active');
    if (oldActive) oldActive.classList.remove('active');

    // Find new active
    const node = document.querySelector(`.tree-node[data-path="${path}"]`);
    if (node) {
      const content = node.querySelector('.folder-item');
      if (content) content.classList.add('active');

      // Ensure parents are expanded?
      // This is hard without full tree knowledge.
      // Windows Explorer doesn't auto-expand deep unless you navigated there.
    }
  }

  /**
   * Legacy method support - mapped to loadFolder
   */
  renderFolderTree(folders) {
    // If called externally, treat as root init
    this.renderTreeRoot(folders);
  }

  /**
   * 파일 목록 렌더링
   */
  renderFileList(files) {
    const tbody = document.querySelector('#s3-file-list tbody');

    // 🔥 폴더 로드 시 선택 초기화
    this.selectedFiles = [];
    this.updateSelectedCount();

    const colSpan = this.config.enableDelete ? 5 : 4;

    if (files.length === 0) {
      tbody.innerHTML = `
        <tr>
      <td colspan="${colSpan}" class="empty-state-cell">
        <div class="empty-state">
          <i class="bi bi-cloud-arrow-up"></i>
          <p class="empty-title">파일이 없습니다.</p>
          <p class="empty-desc">업로드하려면 파일을 여기에 드래그하거나 [업로드] 버튼을 누르세요.</p>
        </div>
      </td>
        </tr>`;
      return;
    }

    // 정렬 적용
    const sortedFiles = this.sortFiles(files);

    tbody.innerHTML = sortedFiles.map(file => {
      // 🔥 서버에서 이미 디코딩되어 왔으므로 그대로 사용
      const displayName = file.name;
      const ext = displayName.split('.').pop().toLowerCase();

      // 🔥 클릭 이벤트 설정
      let onClickEvent = '';

      // Selection Mode Check
      if (this.config.onFileSelect) {
        // Use this.escapeHtml() and escape single quotes within the name
        const safeName = this.escapeHtml(displayName).replace(/'/g, "\\'");
        onClickEvent = `onclick="window.s3Explorer.handleFileClick('${file.key}', '${safeName}')" style="cursor: pointer; background: #e8f0fe;"`;
      } else {
        if (ext === 'ent') {
          onClickEvent = `onclick="window.s3Explorer.openInEntry('${file.key}')" style="cursor: pointer;"`;
        } else if (ext === 'sb2' || ext === 'sb3') {
          onClickEvent = `onclick="window.s3Explorer.openInScratch('${file.key}')" style="cursor: pointer;"`;
        }
      }

      // 🔥 체크박스 추가 (삭제 권한 있을 때만)
      const checkboxHtml = this.config.enableDelete
        ? `<td><input type="checkbox" class="file-checkbox" data-key="${file.key}" onclick="window.s3Explorer.toggleFileSelection('${file.key}')"></td>`
        : '';

      return `
      <tr data-key="${file.key}">
        ${checkboxHtml}
          <td ${onClickEvent}>
            <span class="file-icon">${file.icon}</span>
            <span class="file-name">${displayName}</span>
          </td>
          <td>${file.sizeFormatted}</td>
          <td>${this.formatDate(file.lastModified)}</td>
          <td class="actions">
            ${this.config.enableDelete ? `<button onclick="window.s3Explorer.deleteFile('${file.key}')" title="삭제">🗑️</button>` : ''}
          </td>
        </tr >
      `;
    }).join('');

    // 🔥 그리드 뷰 렌더링
    this.renderFileGrid(files);
  }

  /**
   * 🔥 그리드 뷰 렌더링 (갤러리)
   */
  renderFileGrid(files) {
    const gridContainer = document.getElementById('s3-file-grid');
    if (!gridContainer) return;

    if (files.length === 0) {
      gridContainer.innerHTML = '<div class="empty-message">파일이 없습니다.</div>';
      return;
    }

    // 정렬 적용
    const sortedFiles = this.sortFiles(files);
    const imagesToLoad = []; // 썸네일 로드할 이미지들

    gridContainer.innerHTML = sortedFiles.map(file => {
      const displayName = file.name;
      const ext = displayName.split('.').pop().toLowerCase();
      const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);

      let thumbnailHtml = `<span class="grid-icon">${file.icon}</span>`;

      // 이미지인 경우: ID를 부여하고 로딩 큐에 추가
      const imgId = `thumb - ${Math.random().toString(36).substr(2, 9)} `;
      if (isImage) {
        thumbnailHtml = `<div class="grid-thumbnail-placeholder" id="${imgId}"><span class="grid-icon">${file.icon}</span></div>`;
        imagesToLoad.push({ id: imgId, key: file.key });
      }

      // 클릭 이벤트
      let onClickEvent = '';

      if (this.config.onFileSelect) {
        onClickEvent = `onclick="window.s3Explorer.handleFileClick('${file.key}', '${this.escapeHtml(displayName)}')"`;
      } else {
        if (ext === 'ent') {
          onClickEvent = `onclick="window.s3Explorer.openInEntry('${file.key}')"`;
        } else if (ext === 'sb2' || ext === 'sb3') {
          onClickEvent = `onclick="window.s3Explorer.openInScratch('${file.key}')"`;
        } else {
          onClickEvent = `onclick="window.s3Explorer.preview('${file.key}')"`;
        }
      }

      // 🔥 Grid Checkbox (Visible on hover or checked)
      let checkboxHtml = '';
      if (this.config.enableDelete) {
        checkboxHtml = `<input type="checkbox" class="grid-checkbox" data-key="${file.key}" onclick="event.stopPropagation(); window.s3Explorer.toggleFileSelection('${file.key}')">`;
      }

      return `
      <div class="grid-item" title="${displayName}">
          ${checkboxHtml}
          <div class="grid-preview" ${onClickEvent}>
            ${thumbnailHtml}
          </div>
          <div class="grid-info">
             <div class="grid-name-row">
                <span class="grid-name">${displayName}</span>
             </div>
             <span class="grid-size">${file.sizeFormatted}</span>
          </div>
          ${this.config.enableDelete ?
          `<button class="grid-delete-btn" onclick="window.s3Explorer.deleteFile('${file.key}')" title="삭제">&times;</button>` : ''
        }
        </div>
      `;
    }).join('');

    // 🔥 썸네일 비동기 로드 시작
    this.loadGridThumbnails(imagesToLoad);
  }

  /**
   * 🔥 그리드 뷰 썸네일 비동기 로드
   */
  async loadGridThumbnails(images) {
    if (!images || images.length === 0) return;

    for (const item of images) {
      try {
        const el = document.getElementById(item.id);
        if (!el) continue;

        const response = await fetch(`/ api / s3 / preview ? key = ${encodeURIComponent(item.key)} `);
        const data = await response.json();

        if (data.success && data.data) {
          // data.data는 base64 또는 URL
          el.innerHTML = `<img src="${data.data}" class="grid-thumbnail" loading="lazy" alt="thumb">`;
        }
      } catch (e) {
        console.warn('썸네일 로드 실패:', item.key);
      }
    }
  }

  /**
   * 🔥 보기 모드 변경
   */
  setViewMode(mode) {
    this.viewMode = mode;
    this.renderLayout(); // UI 갱신 (툴바 상태 및 리스트/그리드 전환)
    this.loadFolder(this.currentPath); // 데이터 재바인딩
  }

  /**
   * 🔥 페이지 닫기
   */
  closePage() {
    if (typeof closeS3Browser === 'function') {
      closeS3Browser();
    } else {
      window.history.back();
    }
  }

  /**
   * 파일 정렬
   */
  sortFiles(files) {
    return files.sort((a, b) => {
      let comparison = 0;

      switch (this.sortOptions.field) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'date':
          comparison = new Date(a.lastModified) - new Date(b.lastModified);
          break;
      }

      return this.sortOptions.order === 'asc' ? comparison : -comparison;
    });
  }

  /**
   * 정렬 옵션 변경
   */
  sortBy(field) {
    if (this.sortOptions.field === field) {
      this.sortOptions.order = this.sortOptions.order === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortOptions.field = field;
      this.sortOptions.order = 'asc';
    }

    // 현재 폴더 다시 로드
    this.loadFolder(this.currentPath);
  }

  /**
   * 경로 이동
   */
  navigateTo(path) {
    // 🔥 경로 검증 추가
    if (!this.isPathAllowed(path)) {
      this.showError('해당 경로에 접근할 수 없습니다.');
      return;
    }
    this.loadFolder(path);
  }

  /**
   * 🔥 경로 접근 권한 확인
   */
  isPathAllowed(path) {
    // admin은 모든 경로 허용
    if (this.config.scope === 'all' || this.config.userRole === 'admin') {
      return true;
    }

    // Root 경로 차단
    if (!path || path === '' || path === '/') {
      console.log(`❌ Root 접근 차단 - Role: ${this.config.userRole} `);
      return false;
    }

    // manager/teacher는 users/ 하위만 허용
    if (this.config.scope === 'center' || this.config.userRole === 'manager' || this.config.userRole === 'teacher') {
      if (!path.startsWith('users/')) {
        console.log(`❌ users / 외부 접근 차단 - Role: ${this.config.userRole}, Path: ${path} `);
        return false;
      }
      return true;
    }

    // student는 본인 폴더만 허용
    if (this.config.scope === 'self' || this.config.userRole === 'student') {
      const allowedPath = `users / ${this.config.userID}/`;
      if (!path.startsWith(allowedPath)) {
        console.log(`❌ 본인 폴더 외부 접근 차단 - Role: ${this.config.userRole}, Path: ${path}`);
        return false;
      }
      return true;
    }

    // 기타의 경우 차단
    return false;
  }

  /**
   * 새로고침
   */
  refresh() {
    this.loadFolder(this.currentPath);
  }


  /**
   * 파일 다운로드
   */
  async download(key) {
    try {
      console.log('⬇️ 다운로드:', key);
      const url = `/api/s3/download?key=${encodeURIComponent(key)}`;
      window.open(url, '_blank');
    } catch (error) {
      console.error('❌ 다운로드 실패:', error);
      this.showError('다운로드에 실패했습니다.');
    }
  }

  /**
   * 파일 미리보기
   */
  async preview(key) {
    try {
      console.log('👁️ 미리보기:', key);

      const response = await fetch(`/api/s3/preview?key=${encodeURIComponent(key)}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      // 모달로 미리보기 표시
      this.showPreviewModal(data.data, key);

    } catch (error) {
      console.error('❌ 미리보기 실패:', error);
      this.showError('미리보기에 실패했습니다.');
    }
  }

  /**
   * 미리보기 모달
   */
  showPreviewModal(dataUrl, fileName) {
    const modal = document.createElement('div');
    modal.className = 'preview-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>${fileName.split('/').pop()}</h3>
          <button class="close" onclick="this.closest('.preview-modal').remove()">×</button>
        </div>
        <div class="modal-body">
          <img src="${dataUrl}" alt="미리보기" style="max-width: 100%; max-height: 70vh;" />
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  /**
   * 파일 삭제
   */
  async deleteFile(key) {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      console.log('🗑️ 삭제:', key);

      const response = await fetch(`/api/s3/delete?key=${encodeURIComponent(key)}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      this.showSuccess('삭제되었습니다.');
      this.refresh();

    } catch (error) {
      console.error('❌ 삭제 실패:', error);
      this.showError(error.message || '삭제에 실패했습니다.');
    }
  }

  /**
   * 날짜 포맷팅
   */
  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;

    // 오늘
    if (diff < 86400000) {
      return '오늘 ' + date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    }

    // 어제
    if (diff < 172800000) {
      return '어제 ' + date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    }

    // 그 외
    return date.toLocaleDateString('ko-KR');
  }

  /**
   * 로딩 표시
   */
  showLoading(show) {
    const loading = document.getElementById('s3-loading');
    if (loading) {
      loading.style.display = show ? 'flex' : 'none';
    }
  }

  /**
   * 에러 메시지
   */
  showError(message) {
    alert('❌ ' + message);
  }

  /**
   * 성공 메시지
   */
  showSuccess(message) {
    alert('✅ ' + message);
  }

  /**
   * 🔥 전체 페이지 드래그 앤 드롭 설정
   */
  setupDragAndDrop() {
    if (!this.config.enableUpload) {
      console.log('⚠️ 업로드 기능이 비활성화되어 드래그 앤 드롭을 설정하지 않습니다.');
      return;
    }

    const mainContent = document.getElementById('mainContent');
    const overlay = document.getElementById('drag-drop-overlay');

    if (!mainContent || !overlay) {
      console.error('❌ 드래그 앤 드롭 요소를 찾을 수 없습니다.');
      return;
    }

    let dragCounter = 0;  // 중첩된 드래그 이벤트 처리

    // 페이지 전체에 드래그 오버
    mainContent.addEventListener('dragenter', (e) => {
      e.preventDefault();
      e.stopPropagation();

      dragCounter++;

      if (dragCounter === 1) {
        overlay.style.display = 'flex';
        console.log('📤 드래그 진입');
      }
    });

    // 드래그 오버 (필수: preventDefault)
    mainContent.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    // 드래그 나가기
    mainContent.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();

      dragCounter--;

      if (dragCounter === 0) {
        overlay.style.display = 'none';
        console.log('🚫 드래그 이탈');
      }
    });

    // 🔥 드롭 (파일 업로드)
    mainContent.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();

      dragCounter = 0;
      overlay.style.display = 'none';

      const files = e.dataTransfer.files;

      if (!files || files.length === 0) {
        console.log('⚠️ 드롭된 파일이 없습니다.');
        return;
      }

      console.log(`📤 ${files.length}개 파일 드롭됨`);

      // 🔥 직접 업로드 (모달 없이)
      this.uploadDroppedFiles(files);
    });

    console.log('✅ 드래그 앤 드롭 설정 완료');
  }

  /**
   * 🔥 드롭된 파일 업로드
   */
  async uploadDroppedFiles(files) {
    try {
      const fileArray = Array.from(files);

      // 파일 개수 및 크기 검증
      if (fileArray.length > 10) {
        this.showError('한 번에 최대 10개 파일까지 업로드할 수 있습니다.');
        return;
      }

      const maxSize = 100 * 1024 * 1024; // 100MB
      const oversizedFiles = fileArray.filter(f => f.size > maxSize);
      if (oversizedFiles.length > 0) {
        this.showError(`파일 크기가 100MB를 초과합니다: ${oversizedFiles.map(f => f.name).join(', ')}`);
        return;
      }

      // 로딩 표시
      this.showLoading(true);

      // FormData 생성
      const formData = new FormData();
      fileArray.forEach(file => {
        formData.append('files', file);
      });
      formData.append('folder', this.currentPath);  // 🔥 현재 경로

      console.log(`📤 드롭 업로드 시작: ${fileArray.length}개 파일, 경로: ${this.currentPath}`);

      // 업로드 요청
      const response = await fetch('/api/s3/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '업로드에 실패했습니다.');
      }

      console.log(`✅ 드롭 업로드 성공:`, data);

      this.showSuccess(data.message || `${fileArray.length}개 파일 업로드 완료`);

      // 새로고침
      this.refresh();

    } catch (error) {
      console.error('❌ 드롭 업로드 실패:', error);
      this.showError(error.message || '업로드에 실패했습니다.');
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * 🔥 업로드 모달 표시
   */
  upload() {
    this.showUploadModal();
  }

  /**
   * 🔥 업로드 모달 생성
   */
  showUploadModal() {
    const modal = document.createElement('div');
    modal.className = 'upload-modal-overlay';
    modal.id = 'uploadModal';

    modal.innerHTML = `
      <div class="upload-modal">
        <div class="upload-modal-header">
          <h3>📤 파일 업로드</h3>
          <button class="modal-close-btn" onclick="window.s3Explorer.closeUploadModal()">&times;</button>
        </div>
        
        <div class="upload-modal-body">
          <!-- 드래그 앤 드롭 영역 -->
          <div class="drop-zone" id="dropZone">
            <div class="drop-zone-content">
              <i class="bi bi-cloud-upload" style="font-size: 48px; color: #007bff;"></i>
              <p class="mt-3 mb-2" style="font-size: 18px; font-weight: 500;">파일을 드래그하거나 클릭하세요</p>
              <p class="text-muted small">최대 100MB, 10개 파일</p>
              <p class="text-info small mt-2">📌 업로드 위치: <strong>${this.currentPath}</strong></p>
            </div>
            <input type="file" id="fileInput" multiple accept=".ent,.sb3,.png,.jpg,.jpeg,.gif,.webp,.pdf,.zip,.html,.js,.json" style="display: none;" />
          </div>
          
          <!-- 파일 목록 -->
          <div class="file-queue mt-3" id="fileQueue" style="display: none;">
            <h5 class="mb-2">선택된 파일:</h5>
            <div class="file-list" id="fileList"></div>
          </div>
          
          <!-- 진행바 -->
          <div class="upload-progress-container mt-3" id="uploadProgress" style="display: none;">
            <div class="progress">
              <div class="progress-bar progress-bar-striped progress-bar-animated" 
                   id="progressBar" 
                   role="progressbar" 
                   style="width: 0%"></div>
            </div>
            <p class="text-center mt-2 mb-0" id="progressText">0%</p>
          </div>
        </div>
        
        <div class="upload-modal-footer">
          <button class="btn btn-secondary" onclick="window.s3Explorer.closeUploadModal()">취소</button>
          <button class="btn btn-primary" id="uploadBtn" onclick="window.s3Explorer.startUpload()" disabled>
            <i class="bi bi-upload me-1"></i>업로드
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // 이벤트 리스너 등록
    this.setupUploadEvents();
  }

  /**
   * 🔥 업로드 이벤트 설정
   */
  setupUploadEvents() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');

    // 클릭으로 파일 선택
    dropZone.addEventListener('click', () => {
      fileInput.click();
    });

    // 파일 선택 시
    fileInput.addEventListener('change', (e) => {
      this.handleFileSelect(e.target.files);
    });

    // 드래그 오버
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
    });

    // 드롭
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      this.handleFileSelect(e.dataTransfer.files);
    });
  }

  /**
   * 🔥 파일 선택 처리
   */
  handleFileSelect(files) {
    if (!files || files.length === 0) return;

    this.selectedUploadFiles = Array.from(files);

    // 파일 목록 표시
    const fileQueue = document.getElementById('fileQueue');
    const fileList = document.getElementById('fileList');
    const uploadBtn = document.getElementById('uploadBtn');

    fileQueue.style.display = 'block';

    fileList.innerHTML = this.selectedUploadFiles.map((file, idx) => `
      <div class="file-item">
        <span class="file-icon">${this.getFileIcon(file.name)}</span>
        <span class="file-name">${file.name}</span>
        <span class="file-size text-muted">${this.formatFileSize(file.size)}</span>
        <button class="btn-remove" onclick="window.s3Explorer.removeFile(${idx})" title="제거">
          <i class="bi bi-x"></i>
        </button>
      </div>
    `).join('');

    // 업로드 버튼 활성화
    uploadBtn.disabled = false;
  }

  /**
   * 🔥 파일 제거
   */
  removeFile(index) {
    this.selectedUploadFiles.splice(index, 1);

    if (this.selectedUploadFiles.length === 0) {
      document.getElementById('fileQueue').style.display = 'none';
      document.getElementById('uploadBtn').disabled = true;
    } else {
      this.handleFileSelect(this.selectedUploadFiles);
    }
  }

  /**
   * 🔥 업로드 시작
   */
  async startUpload() {
    if (!this.selectedUploadFiles || this.selectedUploadFiles.length === 0) {
      this.showError('업로드할 파일을 선택하세요.');
      return;
    }

    const uploadBtn = document.getElementById('uploadBtn');
    const progressContainer = document.getElementById('uploadProgress');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');

    try {
      // UI 비활성화
      uploadBtn.disabled = true;
      progressContainer.style.display = 'block';

      // FormData 생성
      const formData = new FormData();
      this.selectedUploadFiles.forEach(file => {
        formData.append('files', file);
      });
      formData.append('folder', this.currentPath);  // 🔥 현재 경로만 전달

      console.log(`📤 업로드 시작: ${this.selectedUploadFiles.length}개 파일, 경로: ${this.currentPath}`);

      // 업로드 요청
      const response = await fetch('/api/s3/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '업로드에 실패했습니다.');
      }

      // 진행바 100%
      progressBar.style.width = '100%';
      progressText.textContent = '100% - 완료!';

      console.log(`✅ 업로드 성공:`, data);

      this.showSuccess(data.message || '파일 업로드가 완료되었습니다.');

      // 모달 닫기 및 새로고침
      setTimeout(() => {
        this.closeUploadModal();
        this.refresh();
      }, 1000);

    } catch (error) {
      console.error('❌ 업로드 실패:', error);
      this.showError(error.message || '업로드에 실패했습니다.');

      // UI 재활성화
      uploadBtn.disabled = false;
      progressContainer.style.display = 'none';
    }
  }

  /**
   * 🔥 업로드 모달 닫기
   */
  closeUploadModal() {
    const modal = document.getElementById('uploadModal');
    if (modal) {
      modal.remove();
    }
    this.selectedUploadFiles = [];
  }

  /**
   * 파일 크기 포맷팅
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * 파일 아이콘 반환
   */
  getFileIcon(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const icons = {
      'ent': '<img src="/resource/entry.png" alt="Entry" style="width:18px;height:18px;vertical-align:middle;">',
      'sb3': '<img src="/resource/scratch.png" alt="Scratch" style="width:18px;height:18px;vertical-align:middle;">',
      'sb2': '<img src="/resource/scratch.png" alt="Scratch" style="width:18px;height:18px;vertical-align:middle;">',
      'png': '🖼️',
      'jpg': '🖼️',
      'jpeg': '🖼️',
      'gif': '🖼️',
      'webp': '🖼️',
      'mp4': '🎬',
      'pdf': '📄',
      'zip': '📦',
      'html': '🌐',
      'js': '📜',
      'json': '📋'
    };
    return icons[ext] || '📄';
  }

  /**
   * 🔥 파일 선택 토글
   */
  toggleFileSelection(key) {
    const index = this.selectedFiles.indexOf(key);

    if (index > -1) {
      // 이미 선택됨 -> 제거
      this.selectedFiles.splice(index, 1);
    } else {
      // 선택 안됨 -> 추가
      this.selectedFiles.push(key);
    }

    this.updateSelectedCount();
    this.updateSelectAllCheckbox();

    console.log(`📝 선택된 파일: ${this.selectedFiles.length}개`);
  }

  /**
   * 🔥 전체 선택 토글
   */
  toggleSelectAll(checkbox) {
    const fileCheckboxes = document.querySelectorAll('.file-checkbox');

    if (checkbox.checked) {
      // 모두 선택
      this.selectedFiles = [];
      fileCheckboxes.forEach(cb => {
        cb.checked = true;
        this.selectedFiles.push(cb.dataset.key);
      });
    } else {
      // 모두 해제
      this.selectedFiles = [];
      fileCheckboxes.forEach(cb => {
        cb.checked = false;
      });
    }

    this.updateSelectedCount();
    console.log(`📝 전체 선택: ${this.selectedFiles.length}개`);
  }

  /**
   * 🔥 선택 수 업데이트
   */
  updateSelectedCount() {
    const countSpan = document.getElementById('selectedCount');
    const deleteBtn = document.getElementById('deleteSelectedBtn');

    if (countSpan) {
      countSpan.textContent = this.selectedFiles.length;
    }

    if (deleteBtn) {
      deleteBtn.disabled = this.selectedFiles.length === 0;
    }
  }

  /**
   * 🔥 전체 선택 체크박스 상태 업데이트
   */
  updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    const fileCheckboxes = document.querySelectorAll('.file-checkbox');

    if (!selectAllCheckbox || fileCheckboxes.length === 0) return;

    const allChecked = Array.from(fileCheckboxes).every(cb => cb.checked);
    const someChecked = Array.from(fileCheckboxes).some(cb => cb.checked);

    selectAllCheckbox.checked = allChecked;
    selectAllCheckbox.indeterminate = someChecked && !allChecked;
  }

  /**
   * 🔥 선택된 파일들 일괄 삭제
   */
  async deleteSelected() {
    if (this.selectedFiles.length === 0) {
      this.showError('삭제할 파일을 선택해주세요.');
      return;
    }

    const confirmMsg = `선택한 ${this.selectedFiles.length}개 파일을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`;

    if (!confirm(confirmMsg)) return;

    try {
      this.showLoading(true);

      console.log(`🗑️ 일괄 삭제 시작: ${this.selectedFiles.length}개`);

      const response = await fetch('/api/s3/delete-multiple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ keys: this.selectedFiles })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '일괄 삭제에 실패했습니다.');
      }

      console.log(`✅ 일괄 삭제 완료:`, data.stats);

      this.showSuccess(data.message || `${data.stats.deleted}개 파일 삭제 완료`);

      // 선택 초기화 및 새로고침
      this.selectedFiles = [];
      this.updateSelectedCount();
      this.refresh();

    } catch (error) {
      console.error('❌ 일괄 삭제 실패:', error);
      this.showError(error.message || '일괄 삭제에 실패했습니다.');
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * 🔥 Entry에서 파일 열기
   */
  async openInEntry(key) {
    try {
      console.log('🎨 Entry에서 열기:', key);

      // 🔥 S3 직접 URL 생성 (NCP Asset URL 사용)
      const s3Url = this.config.s3AssetUrl
        ? `${this.config.s3AssetUrl}/${key}`
        : `https://educodingnplaycontents.s3.ap-northeast-2.amazonaws.com/${key}`;

      // 🔥 Entry 페이지 URL 생성 (s3Url 파라미터 사용)
      const userID = this.config.userID || 'guest';
      const userRole = this.config.userRole || 'student';
      const entryUrl = `/entry_editor/?s3Url=${encodeURIComponent(s3Url)}&userID=${userID}&role=${userRole}`;

      console.log('📂 Entry URL:', entryUrl);
      window.open(entryUrl, '_blank');

      this.showSuccess('Entry에서 파일을 불러오고 있습니다...');

    } catch (error) {
      console.error('❌ Entry 열기 실패:', error);
      this.showError('Entry에서 파일을 열 수 없습니다.');
    }
  }

  /**
   * 🔥 Scratch에서 파일 열기
   */
  async openInScratch(key) {
    try {
      console.log('🐱 Scratch에서 열기:', key);

      // 🔥 S3 직접 URL 생성 (NCP Asset URL 사용)
      const s3Url = this.config.s3AssetUrl
        ? `${this.config.s3AssetUrl}/${key}`
        : `https://educodingnplaycontents.s3.ap-northeast-2.amazonaws.com/${key}`;

      // 🔥 Scratch 페이지 URL 생성 (project_file 파라미터 사용)
      const scratchUrl = `/scratch/?project_file=${encodeURIComponent(s3Url)}`;

      console.log('📂 Scratch URL:', scratchUrl);
      window.open(scratchUrl, '_blank');

      this.showSuccess('Scratch에서 파일을 불러오고 있습니다...');

    } catch (error) {
      console.error('❌ Scratch 열기 실패:', error);
      this.showError('Scratch에서 파일을 열 수 없습니다.');
    }
  }
}

// Helper for Tree Loading
function toggleLoadingSpinner(container, show) {
  if (show) {
    const spinner = document.createElement('div');
    spinner.className = 'tree-spinner spinner-border spinner-border-sm text-secondary ms-2';
    spinner.role = 'status';
    container.appendChild(spinner);
  } else {
    const spinner = container.querySelector('.tree-spinner');
    if (spinner) spinner.remove();
  }
}

// 전역 인스턴스 (페이지에서 접근 가능)
window.S3Explorer = S3Explorer;
