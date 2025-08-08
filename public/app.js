// Global Variables
let currentUser = null;
let currentTheme = localStorage.getItem('theme') || 'light';
let categories = [];
let currentPage = 'home';

// API Base URL 설정
const API_BASE_URL = window.location.origin;

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('Initializing app...');
        
        // Apply saved theme
        applyTheme(currentTheme);
        
        // Initialize mouse glow effect
        initMouseGlow();
        
        // Load user session
        console.log('Loading user session...');
        await loadUserSession();
        
        // Load categories
        console.log('Loading categories...');
        await loadCategories();
        
        // Setup event listeners
        setupEventListeners();
        
        // Setup router
        setupRouter();
        
        console.log('App initialized successfully');
        
        // Hide loading screen
        setTimeout(() => {
            const loadingScreen = document.querySelector('.loading-screen');
            if (loadingScreen) {
                loadingScreen.classList.add('fade-out');
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 500);
            }
        }, 1000);
    } catch (error) {
        console.error('Error initializing app:', error);
        // Still hide loading screen on error
        const loadingScreen = document.querySelector('.loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.add('fade-out');
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }
    }
});

// Mouse Glow Effect
function initMouseGlow() {
    const mouseGlow = document.querySelector('.mouse-glow');
    const mouseGlowTrail = document.querySelector('.mouse-glow-trail');
    let mouseX = 0, mouseY = 0;
    let glowX = 0, glowY = 0;
    let trailX = 0, trailY = 0;
    
    // Update mouse position
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });
    
    // Smooth animation loop
    function animate() {
        // Main glow follows mouse quickly
        glowX += (mouseX - glowX) * 0.2;
        glowY += (mouseY - glowY) * 0.2;
        
        // Trail follows more slowly
        trailX += (mouseX - trailX) * 0.05;
        trailY += (mouseY - trailY) * 0.05;
        
        mouseGlow.style.left = glowX + 'px';
        mouseGlow.style.top = glowY + 'px';
        
        mouseGlowTrail.style.left = trailX + 'px';
        mouseGlowTrail.style.top = trailY + 'px';
        
        requestAnimationFrame(animate);
    }
    
    animate();
    
    // Hide glow when mouse leaves window
    document.addEventListener('mouseout', (e) => {
        if (!e.relatedTarget) {
            mouseGlow.style.opacity = '0';
            mouseGlowTrail.style.opacity = '0';
        }
    });
    
    document.addEventListener('mouseover', () => {
        mouseGlow.style.opacity = '1';
        mouseGlowTrail.style.opacity = '1';
    });
}

// Theme Management
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    currentTheme = theme;
    
    // Update theme toggle icon
    const themeToggle = document.getElementById('theme-toggle');
    if (theme === 'dark') {
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    } else if (theme === 'ing') {
        themeToggle.innerHTML = '<i class="fas fa-leaf"></i>';
    } else {
        themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    }
    
    // Update theme radio in settings
    const themeRadio = document.getElementById(`theme-${theme}`);
    if (themeRadio) {
        themeRadio.checked = true;
    }
}

function cycleTheme() {
    const themes = ['light', 'dark', 'ing'];
    const currentIndex = themes.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    applyTheme(themes[nextIndex]);
}

// User Session Management
async function loadUserSession() {
    try {
        console.log('Fetching user session from:', `${API_BASE_URL}/api/auth/me`);
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
            credentials: 'include',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        console.log('User session response status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            console.log('User loaded:', currentUser);
            updateUserUI();
            
            // Apply user's theme preference
            if (currentUser.theme_preference) {
                applyTheme(currentUser.theme_preference);
            }
            
            // Apply custom colors if set
            if (currentUser.custom_colors) {
                applyCustomColors(JSON.parse(currentUser.custom_colors));
            }
            
            // Load notifications
            loadNotifications();
        } else {
            console.log('No user session found');
            updateUserUI();
        }
    } catch (error) {
        console.error('Failed to load user session:', error);
        updateUserUI();
    }
}

function updateUserUI() {
    const navUser = document.getElementById('nav-user');
    
    if (currentUser) {
        // User is logged in
        navUser.innerHTML = `
            <div class="user-menu-toggle" onclick="toggleUserMenu()" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 1rem; border-radius: 12px; background: var(--glass-bg); border: 1px solid var(--glass-border); cursor: pointer; transition: all 0.3s ease;">
                ${currentUser.avatar_url ? 
                    `<img src="${currentUser.avatar_url}" alt="${currentUser.username}" class="user-avatar" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 2px solid var(--glass-border);">` :
                    `<div class="user-avatar" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 2px solid var(--glass-border); background: var(--gradient-primary); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">${currentUser.username[0].toUpperCase()}</div>`
                }
                <span style="font-weight: 500; color: var(--text-primary);">${currentUser.username}</span>
                ${currentUser.notification_count > 0 ? 
                    `<span class="notification-badge" style="display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 20px; padding: 0 6px; background: var(--gradient-danger); color: white; font-size: 0.75rem; font-weight: 600; border-radius: 10px;">${currentUser.notification_count}</span>` : ''
                }
                <i class="fas fa-chevron-down" style="font-size: 0.75rem; color: var(--text-secondary); transition: transform 0.3s ease;"></i>
            </div>
            <div class="dropdown-menu glass-effect" id="user-menu" style="position: absolute; top: calc(100% + 0.5rem); right: 0; min-width: 200px; padding: 0.5rem; border-radius: 16px; opacity: 0; visibility: hidden; transform: translateY(-10px); transition: all 0.3s ease; background: var(--glass-bg); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid var(--glass-border); box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15);">
                <a href="/profile/${currentUser.username}" class="dropdown-item" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border-radius: 12px; text-decoration: none; color: var(--text-secondary); transition: all 0.2s ease;">
                    <i class="fas fa-user"></i>
                    <span>프로필</span>
                </a>
                <a href="#" class="dropdown-item" onclick="openModal('settings-modal')" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border-radius: 12px; text-decoration: none; color: var(--text-secondary); transition: all 0.2s ease;">
                    <i class="fas fa-cog"></i>
                    <span>설정</span>
                </a>
                ${currentUser.role === 'admin' || currentUser.role === 'developer' ? `
                    <a href="#" class="dropdown-item" onclick="openModal('admin-modal')" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border-radius: 12px; text-decoration: none; color: var(--text-secondary); transition: all 0.2s ease;">
                        <i class="fas fa-shield-alt"></i>
                        <span>관리자 패널</span>
                    </a>
                ` : ''}
                <div class="dropdown-divider" style="height: 1px; background: var(--glass-border); margin: 0.5rem 0;"></div>
                <a href="#" class="dropdown-item" onclick="toggleNotifications(event)" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border-radius: 12px; text-decoration: none; color: var(--text-secondary); transition: all 0.2s ease;">
                    <i class="fas fa-bell"></i>
                    <span>알림</span>
                    ${currentUser.notification_count > 0 ? 
                        `<span class="notification-count" style="margin-left: auto; background: var(--gradient-danger); color: white; font-size: 0.75rem; font-weight: 600; padding: 0.125rem 0.5rem; border-radius: 9999px;">${currentUser.notification_count}</span>` : ''
                    }
                </a>
                <div class="dropdown-divider" style="height: 1px; background: var(--glass-border); margin: 0.5rem 0;"></div>
                <a href="#" class="dropdown-item" onclick="logout()" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border-radius: 12px; text-decoration: none; color: var(--text-secondary); transition: all 0.2s ease;">
                    <i class="fas fa-sign-out-alt"></i>
                    <span>로그아웃</span>
                </a>
            </div>
        `;
    } else {
        // User is not logged in
        navUser.innerHTML = `
            <button class="btn btn-gradient" onclick="openModal('login-modal')" style="display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.75rem 1.5rem; border-radius: 12px; font-weight: 600; text-decoration: none; border: none; cursor: pointer; transition: all 0.3s ease; position: relative; overflow: hidden; font-size: 1rem; font-family: inherit; background: var(--gradient-primary); color: white;">
                <i class="fas fa-sign-in-alt"></i>
                <span>로그인</span>
                <div class="btn-glow" style="position: absolute; top: 50%; left: 50%; width: 100%; height: 100%; transform: translate(-50%, -50%); filter: blur(20px); background: inherit; opacity: 0; transition: opacity 0.3s ease; z-index: -1;"></div>
            </button>
        `;
    }
}

// Categories Management
async function loadCategories() {
    try {
        console.log('Fetching categories from:', `${API_BASE_URL}/api/categories`);
        const response = await fetch(`${API_BASE_URL}/api/categories`, {
            headers: {
                'Accept': 'application/json'
            }
        });
        
        console.log('Categories response status:', response.status);
        
        if (response.ok) {
            categories = await response.json();
            console.log('Categories loaded:', categories);
            updateCategoriesUI();
        } else {
            console.error('Failed to load categories, status:', response.status);
        }
    } catch (error) {
        console.error('Failed to load categories:', error);
    }
}

function updateCategoriesUI() {
    const dropdown = document.getElementById('categories-dropdown');
    dropdown.innerHTML = categories.map(category => `
        <a href="/category/${category.slug}" class="dropdown-item" data-category="${category.slug}" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border-radius: 12px; text-decoration: none; color: var(--text-secondary); transition: all 0.2s ease;">
            <span>${category.icon}</span>
            <span>${category.name}</span>
        </a>
    `).join('');
}

// Router
function setupRouter() {
    // Handle navigation
    document.addEventListener('click', (e) => {
        if (e.target.matches('a[href^="/"]') || e.target.closest('a[href^="/"]')) {
            e.preventDefault();
            const link = e.target.closest('a');
            const path = link.getAttribute('href');
            navigateTo(path);
        }
    });
    
    // Handle browser back/forward
    window.addEventListener('popstate', () => {
        loadPage(window.location.pathname);
    });
    
    // Initial page load
    loadPage(window.location.pathname);
}

function navigateTo(path) {
    window.history.pushState({}, '', path);
    loadPage(path);
}

async function loadPage(path) {
    const app = document.getElementById('app');
    
    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    if (path === '/' || path === '/home') {
        currentPage = 'home';
        document.querySelector('[data-page="home"]').classList.add('active');
        await loadHomePage();
    } else if (path.startsWith('/category/')) {
        const categorySlug = path.split('/')[2];
        await loadCategoryPage(categorySlug);
    } else if (path.startsWith('/post/')) {
        const postId = path.split('/')[2];
        await loadPostPage(postId);
    } else if (path === '/search') {
        currentPage = 'search';
        document.querySelector('[data-page="search"]').classList.add('active');
        await loadSearchPage();
    } else if (path.startsWith('/profile/')) {
        const username = path.split('/')[2];
        await loadProfilePage(username);
    } else {
        app.innerHTML = '<div class="text-center p-3"><h2>404 - 페이지를 찾을 수 없습니다</h2></div>';
    }
}

// Page Loaders
async function loadHomePage() {
    const app = document.getElementById('app');
    
    app.innerHTML = `
        <div class="page-header">
            <h1 class="page-title">Weird Forum</h1>
            <p class="page-subtitle">고품질 커뮤니티에 오신 것을 환영합니다</p>
        </div>
        
        ${currentUser ? `
            <div class="create-post-card glass-card mb-3">
                <h3>새 게시글 작성</h3>
                <button class="btn btn-gradient" onclick="openCreatePostModal()">
                    <i class="fas fa-pen"></i>
                    <span>글쓰기</span>
                    <div class="btn-glow"></div>
                </button>
            </div>
        ` : ''}
        
        <div class="posts-section">
            <div class="section-header">
                <h2>최신 게시글</h2>
                <div class="filter-buttons">
                    <button class="filter-btn active" onclick="filterPosts('all')">전체</button>
                    <button class="filter-btn" onclick="filterPosts('popular')">인기</button>
                </div>
            </div>
            <div id="posts-container" class="posts-container">
                <div class="loading-posts">
                    <div class="spinner-ring"></div>
                    <p>게시글을 불러오는 중...</p>
                </div>
            </div>
        </div>
    `;
    
    // Load posts
    await loadPosts();
}

async function loadPosts(category = null, page = 1) {
    try {
        let url = `${API_BASE_URL}/api/posts?page=${page}`;
        if (category) {
            url += `&category=${category}`;
        }
        
        const response = await fetch(url);
        if (response.ok) {
            const posts = await response.json();
            displayPosts(posts);
        }
    } catch (error) {
        console.error('Failed to load posts:', error);
        showToast('게시글을 불러오는데 실패했습니다.', 'error');
    }
}

function displayPosts(posts) {
    const container = document.getElementById('posts-container');
    
    if (posts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox fa-3x text-muted"></i>
                <p class="text-muted mt-2">아직 게시글이 없습니다.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = posts.map(post => `
        <article class="post-card" style="background: var(--glass-bg); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid var(--glass-border); border-radius: 20px; padding: 1.5rem; margin-bottom: 1rem; transition: all 0.3s ease; position: relative; overflow: hidden;">
            ${post.is_pinned ? '<div class="post-pinned" style="position: absolute; top: 1rem; right: 1rem; background: var(--gradient-primary); color: white; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.875rem; font-weight: 600;"><i class="fas fa-thumbtack"></i> 고정됨</div>' : ''}
            <div class="post-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                <div class="post-meta" style="display: flex; align-items: center; gap: 1rem;">
                    <a href="/profile/${post.username}" class="post-author" style="display: flex; align-items: center; gap: 0.75rem; text-decoration: none; color: var(--text-primary); transition: all 0.2s ease;">
                        ${post.avatar_url ? 
                            `<img src="${post.avatar_url}" alt="${post.username}" class="user-avatar" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid var(--glass-border);">` :
                            `<div class="user-avatar" style="width: 40px; height: 40px; border-radius: 50%; background: var(--gradient-primary); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">${post.username[0].toUpperCase()}</div>`
                        }
                        <div>
                            <div class="author-name" style="font-weight: 600; color: var(--text-primary);">${post.username}</div>
                            <div class="post-time" style="font-size: 0.875rem; color: var(--text-tertiary);">${formatDate(post.created_at)}</div>
                        </div>
                    </a>
                    ${post.author_role !== 'normal' ? `<span class="user-role-badge role-${post.author_role}" style="display: inline-flex; align-items: center; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; background: ${post.author_role === 'developer' ? 'var(--gradient-danger)' : post.author_role === 'admin' ? 'var(--gradient-primary)' : 'var(--gradient-success)'}; color: white;">${getRoleName(post.author_role)}</span>` : ''}
                </div>
                <a href="/category/${post.category_slug}" class="post-category" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 20px; text-decoration: none; color: var(--text-secondary); font-size: 0.875rem; transition: all 0.2s ease;">
                    <span>${post.category_icon}</span>
                    <span>${post.category_name}</span>
                </a>
            </div>
            
            <a href="/post/${post.id}" class="post-title" style="font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem; color: var(--text-primary); text-decoration: none; display: block; transition: all 0.2s ease;">${escapeHtml(post.title)}</a>
            
            <div class="post-content" style="color: var(--text-secondary); line-height: 1.6; margin-bottom: 1rem;">
                ${truncateText(post.content, 200)}
            </div>
            
            <div class="post-footer">
                <div class="post-stats" style="display: flex; align-items: center; gap: 1.5rem; color: var(--text-tertiary); font-size: 0.875rem;">
                    <span class="post-stat" style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-eye"></i>
                        <span>${post.view_count}</span>
                    </span>
                    <span class="post-stat" style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-thumbs-up"></i>
                        <span>${post.likes}</span>
                    </span>
                    <span class="post-stat" style="display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-thumbs-down"></i>
                        <span>${post.dislikes}</span>
                    </span>
                </div>
            </div>
        </article>
    `).join('');
}

async function loadPostPage(postId) {
    const app = document.getElementById('app');
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/posts/${postId}`);
        if (!response.ok) {
            throw new Error('Post not found');
        }
        
        const post = await response.json();
        
        app.innerHTML = `
            <article class="post-detail">
                <div class="post-detail-header">
                    <h1 class="post-detail-title">${escapeHtml(post.title)}</h1>
                    <div class="post-detail-meta">
                        <a href="/profile/${post.username}" class="post-author">
                            ${post.avatar_url ? 
                                `<img src="${post.avatar_url}" alt="${post.username}" class="user-avatar">` :
                                `<div class="user-avatar" style="background: var(--gradient-primary); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">${post.username[0].toUpperCase()}</div>`
                            }
                            <div>
                                <div class="author-name">${post.username}</div>
                                <div class="author-bio">${post.bio || '소개가 없습니다.'}</div>
                            </div>
                        </a>
                        <div class="post-info">
                            <a href="/category/${post.category_slug}" class="post-category">
                                <span>${post.category_icon}</span>
                                <span>${post.category_name}</span>
                            </a>
                            <div class="post-time">${formatDate(post.created_at)}</div>
                            ${post.updated_at !== post.created_at ? `<div class="post-edited">(수정됨)</div>` : ''}
                        </div>
                    </div>
                </div>
                
                <div class="post-detail-content markdown-content">
                    ${post.content_html}
                </div>
                
                <div class="post-detail-actions">
                    <div class="reaction-buttons">
                        <button class="reaction-btn like ${post.userReaction === 'like' ? 'active' : ''}" 
                                onclick="toggleReaction('post', ${post.id}, 'like')"
                                ${!currentUser ? 'disabled title="로그인이 필요합니다"' : ''}>
                            <i class="fas fa-thumbs-up"></i>
                            <span>${post.likes}</span>
                        </button>
                        <button class="reaction-btn dislike ${post.userReaction === 'dislike' ? 'active' : ''}" 
                                onclick="toggleReaction('post', ${post.id}, 'dislike')"
                                ${!currentUser ? 'disabled title="로그인이 필요합니다"' : ''}>
                            <i class="fas fa-thumbs-down"></i>
                            <span>${post.dislikes}</span>
                        </button>
                    </div>
                    
                    ${currentUser && (currentUser.id === post.author_id || currentUser.role === 'admin' || currentUser.role === 'developer') ? `
                        <div class="post-controls">
                            <button class="btn btn-secondary" onclick="editPost(${post.id})">
                                <i class="fas fa-edit"></i>
                                <span>수정</span>
                            </button>
                            <button class="btn btn-danger" onclick="deletePost(${post.id})">
                                <i class="fas fa-trash"></i>
                                <span>삭제</span>
                            </button>
                        </div>
                    ` : ''}
                </div>
                
                <div class="comments-section">
                    <h3 class="comments-title">댓글</h3>
                    ${currentUser ? `
                        <form class="comment-form glass-card" onsubmit="submitComment(event, ${post.id})">
                            <textarea class="form-input glass-input" name="content" rows="3" placeholder="댓글을 작성하세요..." required></textarea>
                            <div class="input-glow"></div>
                            <button type="submit" class="btn btn-primary btn-gradient mt-2">
                                <span>댓글 작성</span>
                                <div class="btn-glow"></div>
                            </button>
                        </form>
                    ` : `
                        <div class="login-prompt glass-card">
                            <p>댓글을 작성하려면 로그인이 필요합니다.</p>
                            <button class="btn btn-gradient" onclick="openModal('login-modal')">
                                <i class="fas fa-sign-in-alt"></i>
                                <span>로그인</span>
                                <div class="btn-glow"></div>
                            </button>
                        </div>
                    `}
                    <div id="comments-container" class="comments-container mt-3">
                        <div class="loading-comments">
                            <div class="spinner-ring"></div>
                            <p>댓글을 불러오는 중...</p>
                        </div>
                    </div>
                </div>
            </article>
        `;
        
        // Load comments
        await loadComments(postId);
        
        // Initialize code highlighting
        document.querySelectorAll('pre code').forEach(block => {
            hljs.highlightElement(block);
        });
        
    } catch (error) {
        console.error('Failed to load post:', error);
        app.innerHTML = '<div class="text-center p-3"><h2>게시글을 찾을 수 없습니다</h2></div>';
    }
}

async function loadComments(postId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/posts/${postId}/comments`);
        if (response.ok) {
            const comments = await response.json();
            displayComments(comments);
        }
    } catch (error) {
        console.error('Failed to load comments:', error);
    }
}

function displayComments(comments) {
    const container = document.getElementById('comments-container');
    
    if (comments.length === 0) {
        container.innerHTML = '<p class="text-muted text-center">아직 댓글이 없습니다.</p>';
        return;
    }
    
    container.innerHTML = comments.map(comment => `
        <div class="comment glass-card">
            <div class="comment-header">
                <a href="/profile/${comment.username}" class="comment-author">
                    ${comment.avatar_url ? 
                        `<img src="${comment.avatar_url}" alt="${comment.username}" class="user-avatar">` :
                        `<div class="user-avatar" style="background: var(--gradient-primary); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; width: 32px; height: 32px; font-size: 0.875rem;">${comment.username[0].toUpperCase()}</div>`
                    }
                    <div>
                        <div class="author-name">${comment.username}</div>
                        <div class="comment-time">${formatDate(comment.created_at)}</div>
                    </div>
                </a>
                ${comment.author_role !== 'normal' ? `<span class="user-role-badge role-${comment.author_role}">${getRoleName(comment.author_role)}</span>` : ''}
            </div>
            
            <div class="comment-content markdown-content">
                ${comment.content_html}
            </div>
            
            <div class="comment-actions">
                <div class="reaction-buttons">
                    <button class="reaction-btn like ${comment.userReaction === 'like' ? 'active' : ''}" 
                            onclick="toggleReaction('comment', ${comment.id}, 'like')"
                            ${!currentUser ? 'disabled title="로그인이 필요합니다"' : ''}>
                        <i class="fas fa-thumbs-up"></i>
                        <span>${comment.likes}</span>
                    </button>
                    <button class="reaction-btn dislike ${comment.userReaction === 'dislike' ? 'active' : ''}" 
                            onclick="toggleReaction('comment', ${comment.id}, 'dislike')"
                            ${!currentUser ? 'disabled title="로그인이 필요합니다"' : ''}>
                        <i class="fas fa-thumbs-down"></i>
                        <span>${comment.dislikes}</span>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Event Listeners
function setupEventListeners() {
    // Theme toggle
    document.getElementById('theme-toggle').addEventListener('click', cycleTheme);
    
    // Login form
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    
    // Register form
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    
    // Theme selection in settings
    document.querySelectorAll('input[name="theme"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            applyTheme(e.target.value);
            saveThemeSettings();
        });
    });
    
    // Color pickers
    document.querySelectorAll('.color-picker').forEach(picker => {
        picker.addEventListener('change', updateCustomColors);
    });
    
    // Close modals on backdrop click
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-backdrop')) {
            closeModal(e.target.parentElement.id);
        }
    });
    
    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.nav-dropdown') && !e.target.closest('.nav-user')) {
            document.querySelectorAll('.dropdown-menu').forEach(menu => {
                menu.style.display = 'none';
            });
        }
    });
}

// Authentication
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            closeModal('login-modal');
            updateUserUI();
            showToast('로그인되었습니다!', 'success');
            loadPage(window.location.pathname);
        } else {
            showToast(data.error || '로그인에 실패했습니다.', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('서버 오류가 발생했습니다.', 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('회원가입이 완료되었습니다! 로그인해주세요.', 'success');
            switchModal('register-modal', 'login-modal');
            document.getElementById('login-email').value = email;
        } else {
            showToast(data.error || '회원가입에 실패했습니다.', 'error');
        }
    } catch (error) {
        console.error('Register error:', error);
        showToast('서버 오류가 발생했습니다.', 'error');
    }
}

async function logout() {
    try {
        await fetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST' });
        currentUser = null;
        updateUserUI();
        showToast('로그아웃되었습니다.', 'success');
        navigateTo('/');
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Reactions
async function toggleReaction(targetType, targetId, reactionType) {
    if (!currentUser) {
        showToast('로그인이 필요합니다.', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/reactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetType, targetId, reactionType })
        });
        
        if (response.ok) {
            // Reload the current page to update reaction counts
            loadPage(window.location.pathname);
        } else {
            showToast('반응 처리에 실패했습니다.', 'error');
        }
    } catch (error) {
        console.error('Reaction error:', error);
        showToast('서버 오류가 발생했습니다.', 'error');
    }
}

// Comments
async function submitComment(e, postId) {
    e.preventDefault();
    
    const form = e.target;
    const content = form.content.value;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/posts/${postId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        
        if (response.ok) {
            form.reset();
            await loadComments(postId);
            showToast('댓글이 작성되었습니다.', 'success');
        } else {
            const data = await response.json();
            showToast(data.error || '댓글 작성에 실패했습니다.', 'error');
        }
    } catch (error) {
        console.error('Comment error:', error);
        showToast('서버 오류가 발생했습니다.', 'error');
    }
}

// Modal Management
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    document.body.style.overflow = '';
}

function switchModal(fromModalId, toModalId) {
    closeModal(fromModalId);
    setTimeout(() => openModal(toModalId), 300);
}

// Toast Notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // 타입별 색상 설정
    let borderColor = 'var(--gradient-primary)';
    if (type === 'success') borderColor = 'var(--gradient-success)';
    else if (type === 'error') borderColor = 'var(--gradient-danger)';
    
    toast.style.cssText = `
        background: var(--glass-bg);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid var(--glass-border);
        border-radius: 16px;
        padding: 1rem 1.5rem;
        margin-bottom: 1rem;
        min-width: 300px;
        box-shadow: 0 10px 30px var(--shadow-color);
        animation: slideInRight 0.3s ease;
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
    `;
    
    toast.innerHTML = `
        <div style="content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: ${borderColor};"></div>
        <div class="toast-message" style="font-weight: 500; color: var(--text-primary); padding-left: 0.5rem;">${message}</div>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Utility Functions
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return '방금 전';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}일 전`;
    
    return date.toLocaleDateString('ko-KR');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return escapeHtml(text);
    return escapeHtml(text.substring(0, maxLength)) + '...';
}

function getRoleName(role) {
    const roleNames = {
        developer: '개발자',
        admin: '관리자',
        guide: '가이드',
        normal: '일반',
        blocked: '차단됨'
    };
    return roleNames[role] || role;
}

// User Menu Toggle
function toggleUserMenu() {
    const menu = document.getElementById('user-menu');
    menu.style.opacity = menu.style.opacity === '0' ? '1' : '0';
    menu.style.visibility = menu.style.visibility === 'hidden' ? 'visible' : 'hidden';
    menu.style.transform = menu.style.transform === 'translateY(-10px)' ? 'translateY(0)' : 'translateY(-10px)';
}

// Notifications
async function loadNotifications() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/notifications`);
        if (response.ok) {
            const notifications = await response.json();
            updateNotificationsUI(notifications);
        }
    } catch (error) {
        console.error('Failed to load notifications:', error);
    }
}

function updateNotificationsUI(notifications) {
    const list = document.getElementById('notification-list');
    
    if (notifications.length === 0) {
        list.innerHTML = '<p class="text-center text-muted p-3">알림이 없습니다.</p>';
        return;
    }
    
    list.innerHTML = notifications.map(notification => `
        <div class="notification-item ${!notification.is_read ? 'unread' : ''}" 
             onclick="markNotificationRead(${notification.id})">
            <div class="notification-content">
                <p>${notification.message}</p>
                <span class="notification-time">${formatDate(notification.created_at)}</span>
            </div>
        </div>
    `).join('');
}

function toggleNotifications(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const dropdown = document.getElementById('notification-dropdown');
    dropdown.classList.toggle('active');
    
    if (dropdown.classList.contains('active')) {
        loadNotifications();
    }
}

async function markNotificationRead(notificationId) {
    try {
        await fetch(`${API_BASE_URL}/api/notifications/read`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notificationIds: [notificationId] })
        });
        
        // Update notification count
        if (currentUser.notification_count > 0) {
            currentUser.notification_count--;
            updateUserUI();
        }
        
        // Reload notifications
        loadNotifications();
    } catch (error) {
        console.error('Failed to mark notification as read:', error);
    }
}

async function markAllNotificationsRead() {
    try {
        await fetch(`${API_BASE_URL}/api/notifications/read`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' }
        });
        
        currentUser.notification_count = 0;
        updateUserUI();
        loadNotifications();
        showToast('모든 알림을 읽음 처리했습니다.', 'success');
    } catch (error) {
        console.error('Failed to mark all notifications as read:', error);
    }
}

// Settings
async function saveThemeSettings() {
    if (!currentUser) return;
    
    const customColors = {
        primary: document.getElementById('primary-color').value,
        secondary: document.getElementById('secondary-color').value,
        accent: document.getElementById('accent-color').value
    };
    
    try {
        await fetch(`${API_BASE_URL}/api/user/theme`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                theme: currentTheme,
                customColors
            })
        });
        
        showToast('테마 설정이 저장되었습니다.', 'success');
    } catch (error) {
        console.error('Failed to save theme settings:', error);
        showToast('설정 저장에 실패했습니다.', 'error');
    }
}

function updateCustomColors() {
    const primary = document.getElementById('primary-color').value;
    const secondary = document.getElementById('secondary-color').value;
    const accent = document.getElementById('accent-color').value;
    
    document.getElementById('primary-color-text').value = primary;
    document.getElementById('secondary-color-text').value = secondary;
    document.getElementById('accent-color-text').value = accent;
    
    applyCustomColors({ primary, secondary, accent });
}

function applyCustomColors(colors) {
    document.documentElement.style.setProperty('--custom-primary', colors.primary);
    document.documentElement.style.setProperty('--custom-secondary', colors.secondary);
    document.documentElement.style.setProperty('--custom-accent', colors.accent);
}

function resetColors() {
    const defaultColors = {
        primary: '#667eea',
        secondary: '#764ba2',
        accent: '#f093fb'
    };
    
    document.getElementById('primary-color').value = defaultColors.primary;
    document.getElementById('secondary-color').value = defaultColors.secondary;
    document.getElementById('accent-color').value = defaultColors.accent;
    
    updateCustomColors();
    saveThemeSettings();
}

async function saveProfile() {
    if (!currentUser) return;
    
    const bio = document.getElementById('profile-bio').value;
    const avatarUrl = document.getElementById('profile-avatar').value;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/users/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bio, avatarUrl })
        });
        
        if (response.ok) {
            currentUser.avatar_url = avatarUrl;
            updateUserUI();
            showToast('프로필이 업데이트되었습니다.', 'success');
        } else {
            showToast('프로필 업데이트에 실패했습니다.', 'error');
        }
    } catch (error) {
        console.error('Failed to save profile:', error);
        showToast('서버 오류가 발생했습니다.', 'error');
    }
}

async function confirmDeleteAccount() {
    if (!confirm('정말로 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/account`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            currentUser = null;
            updateUserUI();
            closeModal('settings-modal');
            showToast('계정이 삭제되었습니다.', 'success');
            navigateTo('/');
        } else {
            showToast('계정 삭제에 실패했습니다.', 'error');
        }
    } catch (error) {
        console.error('Failed to delete account:', error);
        showToast('서버 오류가 발생했습니다.', 'error');
    }
}

// Create Post Modal
function openCreatePostModal() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'create-post-modal';
    
    modal.innerHTML = `
        <div class="modal-backdrop" onclick="closeModal('create-post-modal')"></div>
        <div class="modal-content glass-effect modal-large">
            <div class="modal-header">
                <h2 class="modal-title">새 게시글 작성</h2>
                <button class="modal-close" onclick="closeModal('create-post-modal')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <form class="modal-body" onsubmit="createPost(event)">
                <div class="form-group">
                    <label for="post-category">카테고리</label>
                    <select id="post-category" class="form-input glass-input" required>
                        ${categories.map(category => {
                            const roleHierarchy = { normal: 1, guide: 2, admin: 3, developer: 4 };
                            const userLevel = roleHierarchy[currentUser.role] || 1;
                            const categoryLevel = roleHierarchy[category.min_role] || 1;
                            const canPost = userLevel >= categoryLevel;
                            
                            return `<option value="${category.id}" ${!canPost ? 'disabled' : ''}>
                                ${category.icon} ${category.name} ${!canPost ? '(권한 필요)' : ''}
                            </option>`;
                        }).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label for="post-title">제목</label>
                    <input type="text" id="post-title" class="form-input glass-input" required>
                    <div class="input-glow"></div>
                </div>
                <div class="form-group">
                    <label for="post-content">내용 (마크다운 지원)</label>
                    <textarea id="post-content" class="form-input glass-input" rows="10" required></textarea>
                    <div class="input-glow"></div>
                    <small class="form-hint">마크다운 문법을 사용할 수 있습니다.</small>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="closeModal('create-post-modal')">
                        취소
                    </button>
                    <button type="submit" class="btn btn-primary btn-gradient">
                        <span>게시글 작성</span>
                        <div class="btn-glow"></div>
                    </button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
}

async function createPost(e) {
    e.preventDefault();
    
    const categoryId = document.getElementById('post-category').value;
    const title = document.getElementById('post-title').value;
    const content = document.getElementById('post-content').value;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/posts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categoryId, title, content })
        });
        
        if (response.ok) {
            const data = await response.json();
            closeModal('create-post-modal');
            showToast('게시글이 작성되었습니다.', 'success');
            navigateTo(`/post/${data.id}`);
        } else {
            const data = await response.json();
            showToast(data.error || '게시글 작성에 실패했습니다.', 'error');
        }
    } catch (error) {
        console.error('Failed to create post:', error);
        showToast('서버 오류가 발생했습니다.', 'error');
    }
}

// Admin Panel
async function switchAdminTab(tab) {
    // Update active tab
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    
    const content = document.getElementById('admin-content');
    
    if (tab === 'users') {
        await loadAdminUsers();
    } else if (tab === 'logs') {
        await loadAdminLogs();
    } else if (tab === 'stats') {
        await loadAdminStats();
    }
}

async function loadAdminUsers() {
    const content = document.getElementById('admin-content');
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/users`);
        if (response.ok) {
            const data = await response.json();
            
            content.innerHTML = `
                <div class="admin-users">
                    <div class="admin-search mb-3">
                        <input type="text" class="form-input glass-input" placeholder="사용자 검색..." onkeyup="searchAdminUsers(this.value)">
                    </div>
                    <div class="admin-table-container">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>사용자명</th>
                                    <th>이메일</th>
                                    <th>역할</th>
                                    <th>가입일</th>
                                    <th>액션</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.users.map(user => `
                                    <tr>
                                        <td>${user.id}</td>
                                        <td>${user.username}</td>
                                        <td>${currentUser.role === 'developer' ? user.email : '***'}</td>
                                        <td>
                                            <span class="user-role-badge role-${user.role}">${getRoleName(user.role)}</span>
                                        </td>
                                        <td>${formatDate(user.created_at)}</td>
                                        <td>
                                            <select class="role-select" onchange="changeUserRole(${user.id}, this.value)">
                                                <option value="blocked" ${user.role === 'blocked' ? 'selected' : ''}>차단</option>
                                                <option value="normal" ${user.role === 'normal' ? 'selected' : ''}>일반</option>
                                                <option value="guide" ${user.role === 'guide' ? 'selected' : ''}>가이드</option>
                                                ${currentUser.role === 'developer' ? `
                                                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>관리자</option>
                                                ` : ''}
                                            </select>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div class="admin-pagination mt-3">
                        <p>총 ${data.total}명의 사용자</p>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load admin users:', error);
        content.innerHTML = '<p class="text-center text-muted">사용자 목록을 불러오는데 실패했습니다.</p>';
    }
}

async function changeUserRole(userId, newRole) {
    if (!confirm(`정말로 이 사용자의 역할을 ${getRoleName(newRole)}(으)로 변경하시겠습니까?`)) {
        loadAdminUsers(); // Reset select
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/role`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: newRole })
        });
        
        if (response.ok) {
            showToast('사용자 역할이 변경되었습니다.', 'success');
            loadAdminUsers();
        } else {
            const data = await response.json();
            showToast(data.error || '역할 변경에 실패했습니다.', 'error');
            loadAdminUsers();
        }
    } catch (error) {
        console.error('Failed to change user role:', error);
        showToast('서버 오류가 발생했습니다.', 'error');
        loadAdminUsers();
    }
}

async function loadAdminLogs() {
    const content = document.getElementById('admin-content');
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/logs`);
        if (response.ok) {
            const data = await response.json();
            
            content.innerHTML = `
                <div class="admin-logs">
                    <div class="admin-table-container">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>시간</th>
                                    <th>관리자</th>
                                    <th>액션</th>
                                    <th>대상</th>
                                    <th>상세</th>
                                    <th>IP</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.logs.map(log => `
                                    <tr>
                                        <td>${formatDate(log.created_at)}</td>
                                        <td>${log.admin_username}</td>
                                        <td>${log.action}</td>
                                        <td>${log.target_type} #${log.target_id || 'N/A'}</td>
                                        <td>${log.details || '-'}</td>
                                        <td>${log.ip_address || '-'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div class="admin-pagination mt-3">
                        <p>총 ${data.total}개의 로그</p>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load admin logs:', error);
        content.innerHTML = '<p class="text-center text-muted">관리 로그를 불러오는데 실패했습니다.</p>';
    }
}

async function loadAdminStats() {
    const content = document.getElementById('admin-content');
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/stats`);
        if (response.ok) {
            const stats = await response.json();
            
            content.innerHTML = `
                <div class="admin-stats">
                    <div class="stats-grid">
                        <div class="stat-card glass-card">
                            <i class="fas fa-users fa-2x mb-2"></i>
                            <h3>${stats.totalUsers}</h3>
                            <p>전체 사용자</p>
                        </div>
                        <div class="stat-card glass-card">
                            <i class="fas fa-file-alt fa-2x mb-2"></i>
                            <h3>${stats.totalPosts}</h3>
                            <p>전체 게시글</p>
                        </div>
                        <div class="stat-card glass-card">
                            <i class="fas fa-comments fa-2x mb-2"></i>
                            <h3>${stats.totalComments}</h3>
                            <p>전체 댓글</p>
                        </div>
                        <div class="stat-card glass-card">
                            <i class="fas fa-user-plus fa-2x mb-2"></i>
                            <h3>${stats.newUsersThisWeek}</h3>
                            <p>이번 주 신규 가입</p>
                        </div>
                    </div>
                    
                    <div class="category-stats mt-3">
                        <h3>카테고리별 통계</h3>
                        <div class="stats-list">
                            ${stats.categoriesStats.map(cat => `
                                <div class="stat-item glass-card">
                                    <span>${cat.icon} ${cat.name}</span>
                                    <span>${cat.post_count} 게시글</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Failed to load admin stats:', error);
        content.innerHTML = '<p class="text-center text-muted">통계를 불러오는데 실패했습니다.</p>';
    }
}