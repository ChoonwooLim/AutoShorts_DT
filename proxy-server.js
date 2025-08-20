/**
 * CORS 프록시 서버
 * 브라우저에서 직접 호출할 수 없는 API를 중계
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS 설정
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000', 'https://twinverse.org'],
    credentials: true
}));

// JSON 및 URL 인코딩 파싱
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 파일 업로드 설정
const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB 제한
});

// 상태 확인 엔드포인트
app.get('/api/status', (req, res) => {
    res.json({ status: 'ok', message: 'Proxy server is running' });
});

// OpenAI Whisper API 프록시
app.post('/api/openai/transcriptions', upload.single('file'), async (req, res) => {
    try {
        const apiKey = req.headers['authorization']?.replace('Bearer ', '');
        
        if (!apiKey) {
            return res.status(401).json({ error: 'API key is required' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'Audio file is required' });
        }

        // FormData 생성
        const formData = new FormData();
        formData.append('file', fs.createReadStream(req.file.path), {
            filename: 'audio.webm',
            contentType: req.file.mimetype
        });
        formData.append('model', req.body.model || 'whisper-1');
        
        if (req.body.language) {
            formData.append('language', req.body.language);
        }
        
        if (req.body.response_format) {
            formData.append('response_format', req.body.response_format);
        }

        // OpenAI API 호출
        const response = await axios.post(
            'https://api.openai.com/v1/audio/transcriptions',
            formData,
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    ...formData.getHeaders()
                },
                maxBodyLength: Infinity
            }
        );

        // 임시 파일 삭제
        fs.unlinkSync(req.file.path);

        res.json(response.data);
    } catch (error) {
        // 임시 파일 삭제
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        console.error('OpenAI Proxy Error:', error.response?.data || error.message);
        
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// OpenAI Whisper Translation API 프록시
app.post('/api/openai/translations', upload.single('file'), async (req, res) => {
    try {
        const apiKey = req.headers['authorization']?.replace('Bearer ', '');
        
        if (!apiKey) {
            return res.status(401).json({ error: 'API key is required' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'Audio file is required' });
        }

        // FormData 생성
        const formData = new FormData();
        formData.append('file', fs.createReadStream(req.file.path), {
            filename: 'audio.webm',
            contentType: req.file.mimetype
        });
        formData.append('model', req.body.model || 'whisper-1');

        // OpenAI API 호출
        const response = await axios.post(
            'https://api.openai.com/v1/audio/translations',
            formData,
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    ...formData.getHeaders()
                },
                maxBodyLength: Infinity
            }
        );

        // 임시 파일 삭제
        fs.unlinkSync(req.file.path);

        res.json(response.data);
    } catch (error) {
        // 임시 파일 삭제
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        console.error('OpenAI Translation Proxy Error:', error.response?.data || error.message);
        
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// AssemblyAI Upload 프록시
app.post('/api/assemblyai/upload', upload.single('audio'), async (req, res) => {
    try {
        const apiKey = req.headers['authorization'];
        
        if (!apiKey) {
            return res.status(401).json({ error: 'API key is required' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'Audio file is required' });
        }

        const audioData = fs.readFileSync(req.file.path);

        // AssemblyAI API 호출
        const response = await axios.post(
            'https://api.assemblyai.com/v2/upload',
            audioData,
            {
                headers: {
                    'authorization': apiKey,
                    'content-type': 'application/octet-stream'
                }
            }
        );

        // 임시 파일 삭제
        fs.unlinkSync(req.file.path);

        res.json(response.data);
    } catch (error) {
        // 임시 파일 삭제
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        console.error('AssemblyAI Upload Proxy Error:', error.response?.data || error.message);
        
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// AssemblyAI Transcript 프록시
app.post('/api/assemblyai/transcript', async (req, res) => {
    try {
        const apiKey = req.headers['authorization'];
        
        if (!apiKey) {
            return res.status(401).json({ error: 'API key is required' });
        }

        // AssemblyAI API 호출
        const response = await axios.post(
            'https://api.assemblyai.com/v2/transcript',
            req.body,
            {
                headers: {
                    'authorization': apiKey,
                    'content-type': 'application/json'
                }
            }
        );

        res.json(response.data);
    } catch (error) {
        console.error('AssemblyAI Transcript Proxy Error:', error.response?.data || error.message);
        
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// AssemblyAI Transcript Status 프록시
app.get('/api/assemblyai/transcript/:id', async (req, res) => {
    try {
        const apiKey = req.headers['authorization'];
        
        if (!apiKey) {
            return res.status(401).json({ error: 'API key is required' });
        }

        // AssemblyAI API 호출
        const response = await axios.get(
            `https://api.assemblyai.com/v2/transcript/${req.params.id}`,
            {
                headers: {
                    'authorization': apiKey
                }
            }
        );

        res.json(response.data);
    } catch (error) {
        console.error('AssemblyAI Status Proxy Error:', error.response?.data || error.message);
        
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// Google Speech-to-Text 프록시
app.post('/api/google/speech', async (req, res) => {
    try {
        const apiKey = req.query.key;
        
        if (!apiKey) {
            return res.status(401).json({ error: 'API key is required' });
        }

        // Google API 호출
        const response = await axios.post(
            `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
            req.body,
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json(response.data);
    } catch (error) {
        console.error('Google Speech Proxy Error:', error.response?.data || error.message);
        
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// uploads 디렉토리 생성
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// 서버 시작
app.listen(PORT, () => {
    console.log(`🚀 CORS Proxy Server is running on http://localhost:${PORT}`);
    console.log('📡 Available endpoints:');
    console.log('   - POST /api/openai/transcriptions');
    console.log('   - POST /api/openai/translations');
    console.log('   - POST /api/assemblyai/upload');
    console.log('   - POST /api/assemblyai/transcript');
    console.log('   - GET  /api/assemblyai/transcript/:id');
    console.log('   - POST /api/google/speech');
});

module.exports = app;