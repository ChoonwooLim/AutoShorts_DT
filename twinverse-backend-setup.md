# TwinVerse 백엔드 API 배포 가이드

## 필요한 백엔드 API 서버 구조

### 1. Express 서버 파일 생성
`C:\WORK\TwinVerse\twinverse-backend\server.js`

```javascript
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS 설정
app.use(cors({
    origin: ['https://twinverse.org', 'http://localhost:*'],
    credentials: true
}));

app.use(express.json());

// 파일 업로드 설정
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadPath = path.join(__dirname, 'uploads', 'devlogs');
        await fs.mkdir(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const date = new Date().toISOString().split('T')[0];
        cb(null, `devlog_${date}_${Date.now()}.md`);
    }
});

const upload = multer({ storage });

// API 엔드포인트들
app.post('/api/devlogs', upload.single('file'), async (req, res) => {
    try {
        const { title, content, author } = req.body;
        const devlog = {
            id: Date.now(),
            title,
            content,
            author,
            date: new Date().toISOString(),
            file: req.file ? req.file.filename : null
        };
        
        // 데이터베이스 저장 로직 (MongoDB, PostgreSQL 등)
        
        res.json({ success: true, devlog });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/devlogs', async (req, res) => {
    try {
        // 개발일지 목록 반환
        const devlogs = []; // DB에서 가져오기
        res.json({ devlogs });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
```

### 2. package.json 생성
```json
{
  "name": "twinverse-backend",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "multer": "^1.4.5-lts.1",
    "dotenv": "^16.0.3"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

## Render.com 배포 절차

### 1. GitHub 리포지토리 생성
1. GitHub에 `twinverse-backend` 리포지토리 생성
2. 위 코드들을 푸시

### 2. Render.com 설정
1. [render.com](https://render.com) 로그인
2. "New +" → "Web Service" 선택
3. GitHub 리포지토리 연결
4. 설정:
   - **Name**: twinverse-backend
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free

### 3. 환경 변수 설정
Render 대시보드에서:
- `NODE_ENV`: production
- `CORS_ORIGIN`: https://twinverse.org
- 필요한 API 키들

### 4. 배포 후 웹사이트 연동
twinverse.org의 JavaScript 파일에서:
```javascript
const API_URL = 'https://twinverse-backend.onrender.com';

async function uploadDevLog(data) {
    const response = await fetch(`${API_URL}/api/devlogs`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });
    return response.json();
}
```

## 현재 MCP 서버와의 연동

MCP 서버 (로컬)는 Claude Code에서 사용하고,
백엔드 API (Render)는 웹사이트에서 사용하는 구조입니다.

### MCP → 백엔드 API 통신
```javascript
// MCP 서버에서 백엔드 API 호출
async function publishToWeb(content) {
    const response = await fetch('https://twinverse-backend.onrender.com/api/devlogs', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            title: content.title,
            content: content.body,
            author: 'Claude AI'
        })
    });
    return response.json();
}
```

## 다음 단계
1. 백엔드 서버 코드 완성
2. GitHub에 푸시
3. Render.com에 배포
4. twinverse.org 웹사이트 JavaScript 수정
5. 테스트

이렇게 하면 Claude Code에서 MCP를 통해 개발일지를 작성하고,
자동으로 웹사이트에 업로드할 수 있습니다.