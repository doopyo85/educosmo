// scripts/simple-metadata-generator.js - 기존 모듈 활용한 메타데이터 생성

const fs = require('fs');
const path = require('path');

// 📁 S3에 실제로 있는 파일들 (수동으로 확인한 목록)
const knownAssets = [
  'entrybot1_69.png',
  'entrybot.png',
  'cat.png',
  'dog.png',
  'bird.png',
  'fish.png',
  'rabbit.png',
  'car.png',
  'book.png',
  'ball.png',
  // 필요시 더 추가
];

// 파일명으로 카테고리 추정
function guessCategory(filename) {
  const name = filename.toLowerCase();
  
  if (name.includes('entrybot') || name.includes('entry_bot')) return 'entrybot_friends';
  if (name.includes('cat') || name.includes('dog') || name.includes('bird') || 
      name.includes('animal') || name.includes('fish') || name.includes('rabbit')) return 'animal';
  if (name.includes('car') || name.includes('book') || name.includes('ball') ||
      name.includes('thing') || name.includes('object')) return 'thing';
  if (name.includes('background') || name.includes('bg') || name.includes('scene')) return 'background';
  if (name.includes('character') || name.includes('person') || name.includes('people')) return 'characters';
  
  return 'other';
}

// ID 생성
function generateId(filename) {
  return path.parse(filename).name
    .replace(/[^a-zA-Z0-9가-힣]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

// 이름 생성
function generateName(filename) {
  const baseName = path.parse(filename).name;
  
  const nameMap = {
    'entrybot': '엔트리봇',
    'entrybot1_69': '엔트리봇',
    'cat': '고양이',
    'dog': '강아지',
    'bird': '새',
    'fish': '물고기',
    'rabbit': '토끼',
    'car': '자동차',
    'book': '책',
    'ball': '공',
    'background': '배경',
    'character': '캐릭터'
  };
  
  const lowerName = baseName.toLowerCase();
  for (const [eng, kor] of Object.entries(nameMap)) {
    if (lowerName.includes(eng)) {
      return kor;
    }
  }
  
  return baseName.replace(/[0-9_-]/g, ' ').trim() || baseName;
}

function generateMetadata() {
  try {
    console.log('🔍 메타데이터 생성 시작...');
    
    const BASE_URL = 'https://educodingnplaycont