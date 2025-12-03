// routes/api/ttsRouter.js
const express = require('express');
const router = express.Router();

// EntryJS TTS 블록에서 호출하는 API 엔드포인트
router.get('/expansionBlock/tts/read.mp3', (req, res) => {
    const text = decodeURIComponent(req.query.text || '');
    const speed = parseInt(req.query.speed || 0);
    const pitch = parseInt(req.query.pitch || 0);
    const speaker = req.query.speaker || 'default';
    const volume = parseFloat(req.query.volume || 1);
    
    console.log('🔊 TTS 요청:', {
        text: text,
        speed: speed,
        pitch: pitch,
        speaker: speaker,
        volume: volume
    });
    
    // Web Speech API 명령을 JSON으로 반환
    res.json({
        success: true,
        type: 'web_speech_command',
        command: {
            text: text,
            speed: speed,
            pitch: pitch,
            speaker: speaker,
            volume: volume,
            lang: 'ko-KR'
        },
        message: 'Web Speech API로 실행하세요'
    });
});

// TTS 상태 확인 API
router.get('/tts/status', (req, res) => {
    res.json({
        status: 'active',
        engine: 'Web Speech API',
        supported_languages: ['ko-KR', 'en-US'],
        features: {
            speed_control: true,
            pitch_control: true,
            voice_selection: true,
            volume_control: true
        }
    });
});

// TTS 테스트 API
router.post('/tts/test', (req, res) => {
    const { text } = req.body;
    res.json({
        success: true,
        text: text || '안녕하세요, TTS 테스트입니다.',
        command: 'executeWebSpeech'
    });
});

module.exports = router;