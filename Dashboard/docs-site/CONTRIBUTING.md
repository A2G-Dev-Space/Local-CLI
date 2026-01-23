# Docs 기여 가이드

## 개발 환경 설정

```bash
cd docs-site
npm install
npm run dev
```

브라우저에서 `http://localhost:5173` 접속

---

## 페이지 추가 방법

### 1. 새 페이지 파일 생성

`docs/` 폴더에 `.md` 파일 생성:

```bash
docs/
├── guide/
│   └── new-page.md    # 새 페이지
└── features/
```

### 2. Frontmatter 추가 (선택)

```md
---
title: 페이지 제목
description: 페이지 설명
---

# 페이지 제목

내용...
```

### 3. 사이드바에 추가

`.vitepress/config.ts` 수정:

```ts
sidebar: {
  '/guide/': [
    {
      text: 'Guide',
      items: [
        { text: 'New Page', link: '/guide/new-page' },  // 추가
      ]
    }
  ]
}
```

---

## 스크린샷 추가 방법

### 1. 이미지 파일 저장

```bash
docs-site/public/screenshots/my-screenshot.png
```

### 2. 마크다운에서 참조

```md
![설명](/screenshots/my-screenshot.png)
```

### 권장 사항
- 형식: PNG 또는 WebP
- 너비: 최대 1200px
- 용량: 500KB 이하 권장

---

## 영상 추가 방법

### 1. 영상 파일 저장

```bash
docs-site/public/videos/my-video.mp4
```

### 2. 마크다운에서 참조

```md
<video controls width="100%">
  <source src="/videos/my-video.mp4" type="video/mp4">
</video>
```

### 포스터 이미지 추가 (선택)

```md
<video controls width="100%" poster="/screenshots/video-poster.png">
  <source src="/videos/my-video.mp4" type="video/mp4">
</video>
```

### 권장 사항
- 형식: MP4 (H.264 코덱)
- 해상도: 1080p 이하
- 용량: 가능한 작게 압축

---

## 빌드 및 배포

### 로컬 빌드

```bash
npm run build
```

빌드 결과물: `dist/` 폴더

### 미리보기

```bash
npm run preview
```

### 서버 배포

`dist/` 폴더를 웹 서버에 복사:

```bash
# 예: nginx
cp -r dist/* /var/www/nexus-docs/
```

---

## 폴더 구조

```
docs-site/
├── .vitepress/
│   └── config.ts          # VitePress 설정
├── docs/
│   ├── index.md           # 홈페이지
│   ├── guide/             # 가이드 문서
│   ├── features/          # 기능 설명
│   └── api/               # API 문서
├── public/
│   ├── images/            # 로고, 아이콘 등
│   ├── screenshots/       # 스크린샷
│   └── videos/            # 영상 파일
├── dist/                  # 빌드 결과물 (git ignore)
└── package.json
```

---

## 마크다운 확장 기능

### 코드 블록 (라인 넘버)

~~~md
```ts{1,3-5}
const a = 1  // 하이라이트
const b = 2
const c = 3  // 하이라이트
const d = 4  // 하이라이트
const e = 5  // 하이라이트
```
~~~

### 팁/경고 박스

```md
::: tip
유용한 팁입니다.
:::

::: warning
주의사항입니다.
:::

::: danger
위험한 내용입니다.
:::
```

### 테이블

```md
| 헤더1 | 헤더2 |
|-------|-------|
| 내용1 | 내용2 |
```
