const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const marked = require('marked');
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const hljs = require('highlight.js');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');

// 환경변수 로드
require('dotenv').config();

const app = express();

// 프록시 신뢰 설정 (프테로닥틸 환경)
app.set('trust proxy', true);

// 포트 설정 - 프테로닥틸은 SERVER_PORT를 사용
const PORT = process.env.SERVER_PORT || process.env.PORT || 3000;
// 프테로닥틸 환경에서는 항상 0.0.0.0으로 바인딩해야 함
const HOST = '0.0.0.0';

// 사이트 설정
const SITE_URL = process.env.SITE_URL || `http://localhost:${PORT}`;
const SITE_NAME = process.env.SITE_NAME || 'Premium Forum';
const SESSION_SECRET = process.env.SESSION_SECRET || 'your-secret-key-change-in-production-' + Math.random();
const DATABASE_PATH = process.env.DATABASE_PATH || './forum.db';

// 개발자 계정 설정
const DEV_EMAIL = process.env.DEV_EMAIL || 'ingwannu@gmail.com';
const DEV_PASSWORD = process.env.DEV_PASSWORD || 'ddkcy1914';

console.log('===== 서버 설정 =====');
console.log(`포트: ${PORT}`);
console.log(`호스트: ${HOST}`);
console.log(`사이트 URL: ${SITE_URL}`);
console.log(`환경: ${process.env.NODE_ENV || 'development'}`);
console.log('===================');

// DOMPurify 설정
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// Marked 설정
marked.setOptions({
  highlight: function(code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
    return hljs.highlight(code, { language }).value;
  },
  langPrefix: 'hljs language-',
  breaks: true,
  gfm: true
});

// 미들웨어 설정
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", SITE_URL]
    },
  },
}));

// CORS 설정
app.use(cors({
  origin: function(origin, callback) {
    // 허용할 오리진들
    const allowedOrigins = [
      'http://119.202.156.3:50012',
      'http://localhost:50012',
      'http://localhost:3000'
    ];
    
    // origin이 없거나 (같은 도메인) 허용된 오리진에 포함되면 허용
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true
}));

app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 요청 로깅 미들웨어
app.use((req, res, next) => {
  const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip;
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - IP: ${clientIp} - User-Agent: ${req.headers['user-agent']}`);
  next();
});

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// 데이터베이스 초기화
const db = new sqlite3.Database(DATABASE_PATH);

// 데이터베이스 스키마 생성
db.serialize(() => {
  // 사용자 테이블
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'normal',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    theme_preference TEXT DEFAULT 'light',
    custom_colors TEXT,
    notification_count INTEGER DEFAULT 0,
    avatar_url TEXT,
    bio TEXT
  )`);

  // 카테고리 테이블
  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    min_role TEXT DEFAULT 'normal',
    icon TEXT
  )`);

  // 게시글 테이블
  db.run(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    likes INTEGER DEFAULT 0,
    dislikes INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    is_pinned BOOLEAN DEFAULT 0,
    FOREIGN KEY (author_id) REFERENCES users(id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
  )`);

  // 댓글 테이블
  db.run(`CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    author_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    parent_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    likes INTEGER DEFAULT 0,
    dislikes INTEGER DEFAULT 0,
    FOREIGN KEY (author_id) REFERENCES users(id),
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (parent_id) REFERENCES comments(id)
  )`);

  // 반응 테이블
  db.run(`CREATE TABLE IF NOT EXISTS reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    target_type TEXT NOT NULL,
    target_id INTEGER NOT NULL,
    reaction_type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, target_type, target_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // 알림 테이블
  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    target_id INTEGER,
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // 관리 로그 테이블
  db.run(`CREATE TABLE IF NOT EXISTS admin_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id INTEGER,
    details TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(id)
  )`);

  // 기본 카테고리 생성
  const categories = [
    { name: '자유게시판', slug: 'free', description: '자유롭게 글을 작성하는 공간', min_role: 'normal', icon: '💬' },
    { name: '질문게시판', slug: 'question', description: '궁금한 것을 질문하는 공간', min_role: 'normal', icon: '❓' },
    { name: '정보게시판', slug: 'info', description: '유용한 정보를 공유하는 공간', min_role: 'guide', icon: '📚' },
    { name: '공지사항', slug: 'notice', description: '포럼 공지사항', min_role: 'admin', icon: '📢' }
  ];

  const stmt = db.prepare("INSERT OR IGNORE INTO categories (name, slug, description, min_role, icon) VALUES (?, ?, ?, ?, ?)");
  categories.forEach(cat => {
    stmt.run(cat.name, cat.slug, cat.description, cat.min_role, cat.icon);
  });
  stmt.finalize();

  // 개발자 계정 생성
  bcrypt.hash(DEV_PASSWORD, 10, (err, hash) => {
    if (!err) {
      db.run("INSERT OR IGNORE INTO users (username, email, password, role) VALUES (?, ?, ?, ?)",
        ['Developer', DEV_EMAIL, hash, 'developer']);
    }
  });
});

// 권한 확인 미들웨어
const checkRole = (minRole) => {
  const roleHierarchy = {
    'blocked': 0,
    'normal': 1,
    'guide': 2,
    'admin': 3,
    'developer': 4
  };

  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ error: '로그인이 필요합니다.' });
    }

    const userRole = req.session.user.role;
    if (roleHierarchy[userRole] >= roleHierarchy[minRole]) {
      next();
    } else {
      res.status(403).json({ error: '권한이 없습니다.' });
    }
  };
};

// 정적 파일 제공
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, path) => {
    // CSS 파일에 대한 MIME 타입 명시
    if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
    // JavaScript 파일에 대한 MIME 타입 명시
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// API 라우트들

// 회원가입
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ error: '모든 필드를 입력해주세요.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run("INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      [username, email, hashedPassword],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(409).json({ error: '이미 존재하는 사용자명 또는 이메일입니다.' });
          }
          return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
        
        res.json({ message: '회원가입이 완료되었습니다.' });
      }
    );
  } catch (error) {
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 로그인
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }
    
    if (user.role === 'blocked') {
      return res.status(403).json({ error: '차단된 계정입니다.' });
    }
    
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      theme_preference: user.theme_preference,
      custom_colors: user.custom_colors,
      avatar_url: user.avatar_url
    };
    
    res.json({ 
      message: '로그인 성공',
      user: req.session.user
    });
  });
});

// 로그아웃
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: '로그아웃되었습니다.' });
});

// 계정 삭제
app.delete('/api/auth/account', checkRole('normal'), (req, res) => {
  const userId = req.session.user.id;
  
  db.run("DELETE FROM users WHERE id = ?", [userId], (err) => {
    if (err) {
      return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
    
    req.session.destroy();
    res.json({ message: '계정이 삭제되었습니다.' });
  });
});

// 현재 사용자 정보
app.get('/api/auth/me', (req, res) => {
  if (req.session.user) {
    res.json({ user: req.session.user });
  } else {
    res.status(401).json({ error: '로그인되지 않았습니다.' });
  }
});

// 테마 설정 업데이트
app.put('/api/user/theme', checkRole('normal'), (req, res) => {
  const { theme, customColors } = req.body;
  const userId = req.session.user.id;
  
  db.run("UPDATE users SET theme_preference = ?, custom_colors = ? WHERE id = ?",
    [theme, JSON.stringify(customColors), userId],
    (err) => {
      if (err) {
        return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
      }
      
      req.session.user.theme_preference = theme;
      req.session.user.custom_colors = JSON.stringify(customColors);
      
      res.json({ message: '테마 설정이 업데이트되었습니다.' });
    }
  );
});

// 카테고리 목록
app.get('/api/categories', (req, res) => {
  db.all("SELECT * FROM categories", (err, categories) => {
    if (err) {
      return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
    res.json(categories);
  });
});

// 게시글 목록
app.get('/api/posts', (req, res) => {
  const { category, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  
  let query = `
    SELECT p.*, u.username, u.avatar_url, u.role as author_role, c.name as category_name, c.slug as category_slug, c.icon as category_icon
    FROM posts p
    JOIN users u ON p.author_id = u.id
    JOIN categories c ON p.category_id = c.id
  `;
  
  const params = [];
  if (category) {
    query += " WHERE c.slug = ?";
    params.push(category);
  }
  
  query += " ORDER BY p.is_pinned DESC, p.created_at DESC LIMIT ? OFFSET ?";
  params.push(parseInt(limit), parseInt(offset));
  
  db.all(query, params, (err, posts) => {
    if (err) {
      return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
    res.json(posts);
  });
});

// 게시글 작성
app.post('/api/posts', checkRole('normal'), (req, res) => {
  const { title, content, categoryId } = req.body;
  const authorId = req.session.user.id;
  const clientIp = req.ip;
  
  if (req.session.user.role === 'blocked') {
    return res.status(403).json({ error: '차단된 사용자는 글을 작성할 수 없습니다.' });
  }
  
  // 카테고리별 권한 확인
  db.get("SELECT min_role FROM categories WHERE id = ?", [categoryId], (err, category) => {
    if (err || !category) {
      return res.status(400).json({ error: '유효하지 않은 카테고리입니다.' });
    }
    
    const roleHierarchy = {
      'blocked': 0,
      'normal': 1,
      'guide': 2,
      'admin': 3,
      'developer': 4
    };
    
    if (roleHierarchy[req.session.user.role] < roleHierarchy[category.min_role]) {
      return res.status(403).json({ error: '이 카테고리에 글을 작성할 권한이 없습니다.' });
    }
    
    db.run("INSERT INTO posts (title, content, author_id, category_id) VALUES (?, ?, ?, ?)",
      [title, content, authorId, categoryId],
      function(err) {
        if (err) {
          return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
        
        // 관리 로그 기록
        if (req.session.user.role === 'admin' || req.session.user.role === 'developer') {
          db.run("INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)",
            [authorId, 'create_post', 'post', this.lastID, `제목: ${title}`, clientIp]);
        }
        
        res.json({ id: this.lastID, message: '게시글이 작성되었습니다.' });
      }
    );
  });
});

// 게시글 상세
app.get('/api/posts/:id', (req, res) => {
  const postId = req.params.id;
  
  // 조회수 증가
  db.run("UPDATE posts SET view_count = view_count + 1 WHERE id = ?", [postId]);
  
  db.get(`
    SELECT p.*, u.username, u.avatar_url, u.role as author_role, u.bio, c.name as category_name, c.slug as category_slug, c.icon as category_icon
    FROM posts p
    JOIN users u ON p.author_id = u.id
    JOIN categories c ON p.category_id = c.id
    WHERE p.id = ?
  `, [postId], (err, post) => {
    if (err || !post) {
      return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
    }
    
    // 마크다운을 HTML로 변환
    post.content_html = DOMPurify.sanitize(marked.parse(post.content));
    
    // 현재 사용자의 반응 확인
    if (req.session.user) {
      db.get("SELECT reaction_type FROM reactions WHERE user_id = ? AND target_type = 'post' AND target_id = ?",
        [req.session.user.id, postId], (err, reaction) => {
          post.userReaction = reaction ? reaction.reaction_type : null;
          res.json(post);
        });
    } else {
      res.json(post);
    }
  });
});

// 게시글 수정
app.put('/api/posts/:id', checkRole('normal'), (req, res) => {
  const postId = req.params.id;
  const { title, content } = req.body;
  const userId = req.session.user.id;
  const userRole = req.session.user.role;
  
  db.get("SELECT author_id FROM posts WHERE id = ?", [postId], (err, post) => {
    if (err || !post) {
      return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
    }
    
    // 작성자 본인이거나 관리자/개발자만 수정 가능
    if (post.author_id !== userId && userRole !== 'admin' && userRole !== 'developer') {
      return res.status(403).json({ error: '수정 권한이 없습니다.' });
    }
    
    db.run("UPDATE posts SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [title, content, postId], (err) => {
        if (err) {
          return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
        
        res.json({ message: '게시글이 수정되었습니다.' });
      });
  });
});

// 게시글 삭제
app.delete('/api/posts/:id', checkRole('normal'), (req, res) => {
  const postId = req.params.id;
  const userId = req.session.user.id;
  const userRole = req.session.user.role;
  const clientIp = req.ip;
  
  db.get("SELECT author_id, title FROM posts WHERE id = ?", [postId], (err, post) => {
    if (err || !post) {
      return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
    }
    
    // 작성자 본인이거나 관리자/개발자만 삭제 가능
    if (post.author_id !== userId && userRole !== 'admin' && userRole !== 'developer') {
      return res.status(403).json({ error: '삭제 권한이 없습니다.' });
    }
    
    db.run("DELETE FROM posts WHERE id = ?", [postId], (err) => {
      if (err) {
        return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
      }
      
      // 관리 로그 기록
      if (userRole === 'admin' || userRole === 'developer') {
        db.run("INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)",
          [userId, 'delete_post', 'post', postId, `제목: ${post.title}`, clientIp]);
      }
      
      res.json({ message: '게시글이 삭제되었습니다.' });
    });
  });
});

// 게시글 고정/고정해제
app.put('/api/posts/:id/pin', checkRole('admin'), (req, res) => {
  const postId = req.params.id;
  const { isPinned } = req.body;
  
  db.run("UPDATE posts SET is_pinned = ? WHERE id = ?", [isPinned ? 1 : 0, postId], (err) => {
    if (err) {
      return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
    
    res.json({ message: isPinned ? '게시글이 고정되었습니다.' : '게시글 고정이 해제되었습니다.' });
  });
});

// 댓글 목록
app.get('/api/posts/:postId/comments', (req, res) => {
  const postId = req.params.postId;
  
  db.all(`
    SELECT c.*, u.username, u.avatar_url, u.role as author_role
    FROM comments c
    JOIN users u ON c.author_id = u.id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
  `, [postId], (err, comments) => {
    if (err) {
      return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
    
    // 마크다운을 HTML로 변환
    comments.forEach(comment => {
      comment.content_html = DOMPurify.sanitize(marked.parse(comment.content));
    });
    
    // 현재 사용자의 반응 확인
    if (req.session.user) {
      const commentIds = comments.map(c => c.id);
      if (commentIds.length > 0) {
        db.all("SELECT target_id, reaction_type FROM reactions WHERE user_id = ? AND target_type = 'comment' AND target_id IN (" + commentIds.map(() => '?').join(',') + ")",
          [req.session.user.id, ...commentIds], (err, reactions) => {
            const reactionMap = {};
            if (reactions) {
              reactions.forEach(r => {
                reactionMap[r.target_id] = r.reaction_type;
              });
            }
            comments.forEach(comment => {
              comment.userReaction = reactionMap[comment.id] || null;
            });
            res.json(comments);
          });
      } else {
        res.json(comments);
      }
    } else {
      res.json(comments);
    }
  });
});

// 댓글 작성
app.post('/api/posts/:postId/comments', checkRole('normal'), (req, res) => {
  const { content, parentId } = req.body;
  const postId = req.params.postId;
  const authorId = req.session.user.id;
  
  if (req.session.user.role === 'blocked') {
    return res.status(403).json({ error: '차단된 사용자는 댓글을 작성할 수 없습니다.' });
  }
  
  db.run("INSERT INTO comments (content, author_id, post_id, parent_id) VALUES (?, ?, ?, ?)",
    [content, authorId, postId, parentId || null],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
      }
      
      // 게시글 작성자에게 알림
      db.get("SELECT author_id FROM posts WHERE id = ?", [postId], (err, post) => {
        if (!err && post && post.author_id !== authorId) {
          db.get("SELECT username FROM users WHERE id = ?", [authorId], (err, user) => {
            if (!err && user) {
              const message = `${user.username}님이 당신의 게시글에 댓글을 달았습니다.`;
              db.run("INSERT INTO notifications (user_id, type, message, target_id) VALUES (?, ?, ?, ?)",
                [post.author_id, 'comment', message, postId]);
              db.run("UPDATE users SET notification_count = notification_count + 1 WHERE id = ?", [post.author_id]);
            }
          });
        }
      });
      
      res.json({ id: this.lastID, message: '댓글이 작성되었습니다.' });
    }
  );
});

// 반응 추가/변경
app.post('/api/reactions', checkRole('normal'), (req, res) => {
  const { targetType, targetId, reactionType } = req.body;
  const userId = req.session.user.id;
  
  if (!['like', 'dislike'].includes(reactionType)) {
    return res.status(400).json({ error: '유효하지 않은 반응 타입입니다.' });
  }
  
  // 기존 반응 확인
  db.get("SELECT * FROM reactions WHERE user_id = ? AND target_type = ? AND target_id = ?",
    [userId, targetType, targetId],
    (err, existingReaction) => {
      if (existingReaction) {
        // 같은 반응이면 취소
        if (existingReaction.reaction_type === reactionType) {
          db.run("DELETE FROM reactions WHERE id = ?", [existingReaction.id], (err) => {
            if (err) {
              return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
            updateReactionCount(targetType, targetId, existingReaction.reaction_type, -1);
            res.json({ message: '반응이 취소되었습니다.', removed: true });
          });
        } else {
          // 다른 반응으로 변경
          db.run("UPDATE reactions SET reaction_type = ? WHERE id = ?",
            [reactionType, existingReaction.id],
            (err) => {
              if (err) {
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
              }
              updateReactionCount(targetType, targetId, existingReaction.reaction_type, -1);
              updateReactionCount(targetType, targetId, reactionType, 1);
              createNotification(targetType, targetId, reactionType, userId);
              res.json({ message: '반응이 변경되었습니다.', changed: true });
            }
          );
        }
      } else {
        // 새로운 반응 추가
        db.run("INSERT INTO reactions (user_id, target_type, target_id, reaction_type) VALUES (?, ?, ?, ?)",
          [userId, targetType, targetId, reactionType],
          (err) => {
            if (err) {
              return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
            updateReactionCount(targetType, targetId, reactionType, 1);
            createNotification(targetType, targetId, reactionType, userId);
            res.json({ message: '반응이 추가되었습니다.', added: true });
          }
        );
      }
    }
  );
});

// 반응 수 업데이트 함수
function updateReactionCount(targetType, targetId, reactionType, delta) {
  const table = targetType === 'post' ? 'posts' : 'comments';
  const column = reactionType === 'like' ? 'likes' : 'dislikes';
  
  db.run(`UPDATE ${table} SET ${column} = ${column} + ? WHERE id = ?`, [delta, targetId]);
}

// 알림 생성 함수
function createNotification(targetType, targetId, reactionType, fromUserId) {
  const table = targetType === 'post' ? 'posts' : 'comments';
  
  db.get(`SELECT author_id FROM ${table} WHERE id = ?`, [targetId], (err, item) => {
    if (!err && item && item.author_id !== fromUserId) {
      db.get("SELECT username FROM users WHERE id = ?", [fromUserId], (err, user) => {
        if (!err && user) {
          const message = `${user.username}님이 당신의 ${targetType === 'post' ? '게시글' : '댓글'}에 ${reactionType === 'like' ? '좋아요' : '싫어요'}를 눌렀습니다.`;
          
          db.run("INSERT INTO notifications (user_id, type, message, target_id) VALUES (?, ?, ?, ?)",
            [item.author_id, 'reaction', message, targetId]);
          
          // 알림 수 증가
          db.run("UPDATE users SET notification_count = notification_count + 1 WHERE id = ?", [item.author_id]);
        }
      });
    }
  });
}

// 알림 목록
app.get('/api/notifications', checkRole('normal'), (req, res) => {
  const userId = req.session.user.id;
  
  db.all("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
    [userId],
    (err, notifications) => {
      if (err) {
        return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
      }
      res.json(notifications);
    }
  );
});

// 알림 읽음 처리
app.put('/api/notifications/read', checkRole('normal'), (req, res) => {
  const userId = req.session.user.id;
  const { notificationIds } = req.body;
  
  if (notificationIds && notificationIds.length > 0) {
    // 특정 알림들만 읽음 처리
    const placeholders = notificationIds.map(() => '?').join(',');
    db.run(`UPDATE notifications SET is_read = 1 WHERE user_id = ? AND id IN (${placeholders})`,
      [userId, ...notificationIds], (err) => {
        if (err) {
          return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
        updateNotificationCount(userId);
        res.json({ message: '알림이 읽음 처리되었습니다.' });
      });
  } else {
    // 모든 알림 읽음 처리
    db.run("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0", [userId], (err) => {
      if (err) {
        return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
      }
      db.run("UPDATE users SET notification_count = 0 WHERE id = ?", [userId]);
      res.json({ message: '모든 알림이 읽음 처리되었습니다.' });
    });
  }
});

// 알림 수 업데이트 함수
function updateNotificationCount(userId) {
  db.get("SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0",
    [userId], (err, result) => {
      if (!err && result) {
        db.run("UPDATE users SET notification_count = ? WHERE id = ?", [result.count, userId]);
      }
    });
}

// 관리자 패널 - 사용자 목록
app.get('/api/admin/users', checkRole('admin'), (req, res) => {
  const userRole = req.session.user.role;
  const { page = 1, limit = 50, search = '' } = req.query;
  const offset = (page - 1) * limit;
  
  let query = "SELECT id, username, email, role, created_at, notification_count FROM users";
  let countQuery = "SELECT COUNT(*) as total FROM users";
  const params = [];
  
  if (userRole === 'developer') {
    query = "SELECT * FROM users"; // 개발자는 모든 정보 볼 수 있음
  }
  
  if (search) {
    query += " WHERE username LIKE ? OR email LIKE ?";
    countQuery += " WHERE username LIKE ? OR email LIKE ?";
    params.push(`%${search}%`, `%${search}%`);
  }
  
  query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(parseInt(limit), parseInt(offset));
  
  db.get(countQuery, search ? [`%${search}%`, `%${search}%`] : [], (err, count) => {
    if (err) {
      return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
    
    db.all(query, params, (err, users) => {
      if (err) {
        return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
      }
      res.json({
        users,
        total: count.total,
        page: parseInt(page),
        totalPages: Math.ceil(count.total / limit)
      });
    });
  });
});

// 관리자 패널 - 사용자 역할 변경
app.put('/api/admin/users/:userId/role', checkRole('admin'), (req, res) => {
  const { role } = req.body;
  const targetUserId = req.params.userId;
  const adminId = req.session.user.id;
  const adminRole = req.session.user.role;
  const clientIp = req.ip;
  
  // 역할 검증
  const validRoles = ['blocked', 'normal', 'guide'];
  if (adminRole === 'developer') {
    validRoles.push('admin');
  }
  
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: '유효하지 않은 역할입니다.' });
  }
  
  // 자기 자신의 역할은 변경할 수 없음
  if (targetUserId == adminId) {
    return res.status(400).json({ error: '자신의 역할은 변경할 수 없습니다.' });
  }
  
  db.get("SELECT username, role FROM users WHERE id = ?", [targetUserId], (err, targetUser) => {
    if (err || !targetUser) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    
    const oldRole = targetUser.role;
    
    db.run("UPDATE users SET role = ? WHERE id = ?", [role, targetUserId], (err) => {
      if (err) {
        return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
      }
      
      // 관리 로그 기록
      db.run("INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)",
        [adminId, 'change_role', 'user', targetUserId, `${targetUser.username}: ${oldRole} → ${role}`, clientIp]);
      
      res.json({ message: '사용자 역할이 변경되었습니다.' });
    });
  });
});

// 관리자 패널 - 관리 로그
app.get('/api/admin/logs', checkRole('admin'), (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;
  
  db.get("SELECT COUNT(*) as total FROM admin_logs", (err, count) => {
    if (err) {
      return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
    
    db.all(`
      SELECT l.*, u.username as admin_username
      FROM admin_logs l
      JOIN users u ON l.admin_id = u.id
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `, [parseInt(limit), parseInt(offset)], (err, logs) => {
      if (err) {
        return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
      }
      res.json({
        logs,
        total: count.total,
        page: parseInt(page),
        totalPages: Math.ceil(count.total / limit)
      });
    });
  });
});

// 검색 기능
app.get('/api/search', (req, res) => {
  const { q, type = 'all' } = req.query;
  
  if (!q || q.length < 2) {
    return res.status(400).json({ error: '검색어는 2자 이상이어야 합니다.' });
  }
  
  const searchTerm = `%${q}%`;
  const results = { posts: [], comments: [] };
  
  const searchPosts = (callback) => {
    if (type === 'all' || type === 'posts') {
      db.all(`
        SELECT p.*, u.username, u.avatar_url, c.name as category_name, c.icon as category_icon
        FROM posts p
        JOIN users u ON p.author_id = u.id
        JOIN categories c ON p.category_id = c.id
        WHERE p.title LIKE ? OR p.content LIKE ?
        ORDER BY p.created_at DESC
        LIMIT 20
      `, [searchTerm, searchTerm], (err, posts) => {
        if (!err) results.posts = posts;
        callback();
      });
    } else {
      callback();
    }
  };
  
  const searchComments = (callback) => {
    if (type === 'all' || type === 'comments') {
      db.all(`
        SELECT c.*, u.username, u.avatar_url, p.title as post_title
        FROM comments c
        JOIN users u ON c.author_id = u.id
        JOIN posts p ON c.post_id = p.id
        WHERE c.content LIKE ?
        ORDER BY c.created_at DESC
        LIMIT 20
      `, [searchTerm], (err, comments) => {
        if (!err) results.comments = comments;
        callback();
      });
    } else {
      callback();
    }
  };
  
  searchPosts(() => {
    searchComments(() => {
      res.json(results);
    });
  });
});

// 사용자 프로필
app.get('/api/users/:username', (req, res) => {
  const username = req.params.username;
  
  db.get(`
    SELECT id, username, role, created_at, avatar_url, bio,
      (SELECT COUNT(*) FROM posts WHERE author_id = users.id) as post_count,
      (SELECT COUNT(*) FROM comments WHERE author_id = users.id) as comment_count,
      (SELECT SUM(likes) FROM posts WHERE author_id = users.id) as total_likes,
      (SELECT SUM(dislikes) FROM posts WHERE author_id = users.id) as total_dislikes
    FROM users
    WHERE username = ?
  `, [username], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    res.json(user);
  });
});

// 사용자 프로필 업데이트
app.put('/api/users/profile', checkRole('normal'), (req, res) => {
  const { bio, avatarUrl } = req.body;
  const userId = req.session.user.id;
  
  db.run("UPDATE users SET bio = ?, avatar_url = ? WHERE id = ?",
    [bio, avatarUrl, userId],
    (err) => {
      if (err) {
        return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
      }
      
      req.session.user.avatar_url = avatarUrl;
      res.json({ message: '프로필이 업데이트되었습니다.' });
    }
  );
});

// 통계 API
app.get('/api/stats', (req, res) => {
  const stats = {};
  
  db.get("SELECT COUNT(*) as count FROM users WHERE role != 'blocked'", (err, result) => {
    stats.totalUsers = result ? result.count : 0;
    
    db.get("SELECT COUNT(*) as count FROM posts", (err, result) => {
      stats.totalPosts = result ? result.count : 0;
      
      db.get("SELECT COUNT(*) as count FROM comments", (err, result) => {
        stats.totalComments = result ? result.count : 0;
        
        db.get("SELECT COUNT(*) as count FROM users WHERE created_at >= datetime('now', '-7 days')", (err, result) => {
          stats.newUsersThisWeek = result ? result.count : 0;
          
          db.all("SELECT c.name, c.icon, COUNT(p.id) as post_count FROM categories c LEFT JOIN posts p ON c.id = p.category_id GROUP BY c.id ORDER BY post_count DESC", (err, categories) => {
            stats.categoriesStats = categories || [];
            res.json(stats);
          });
        });
      });
    });
  });
});

// 인기 게시글
app.get('/api/posts/popular', (req, res) => {
  const { period = 'week' } = req.query;
  let dateFilter = "datetime('now', '-7 days')";
  
  if (period === 'month') {
    dateFilter = "datetime('now', '-30 days')";
  } else if (period === 'all') {
    dateFilter = "datetime('1970-01-01')";
  }
  
  db.all(`
    SELECT p.*, u.username, u.avatar_url, c.name as category_name, c.icon as category_icon,
      (p.likes - p.dislikes) as score
    FROM posts p
    JOIN users u ON p.author_id = u.id
    JOIN categories c ON p.category_id = c.id
    WHERE p.created_at >= ${dateFilter}
    ORDER BY score DESC, p.view_count DESC
    LIMIT 10
  `, (err, posts) => {
    if (err) {
      return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
    res.json(posts);
  });
});

// HTML 파일 제공
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 서버 시작
app.listen(PORT, HOST, () => {
  console.log('===== 서버 시작 완료 =====');
  console.log(`서버가 포트 ${PORT}에서 실행중입니다.`);
  console.log(`로컬 접속: http://localhost:${PORT}`);
  console.log(`외부 접속: ${SITE_URL}`);
  console.log('=========================');
});