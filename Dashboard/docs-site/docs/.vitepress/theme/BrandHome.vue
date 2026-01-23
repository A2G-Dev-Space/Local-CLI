<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { withBase } from 'vitepress'

const videos = [
  '/videos/vibe-coding-react.mp4',
  '/videos/vibe-coding-streamlit.mp4',
  '/videos/office-word.mp4',
  '/videos/office-excel.mp4',
  '/videos/office-powerpoint.mp4',
]

const currentVideoIndex = ref(0)
const videoRef = ref<HTMLVideoElement | null>(null)

const currentVideoSrc = computed(() => withBase(videos[currentVideoIndex.value]))

const onVideoEnded = () => {
  currentVideoIndex.value = (currentVideoIndex.value + 1) % videos.length
}

const setPlaybackRate = () => {
  if (videoRef.value) {
    videoRef.value.playbackRate = 5.0
  }
}

onMounted(() => {
  setPlaybackRate()
})

const feedbackLink = withBase('/feedback')

const services = [
  {
    name: 'Nexus Coder',
    tagline: 'Vibe Coding Tool for WSL',
    desc: 'CLI 기반 AI Coding Agent로 코드 작성, 리팩토링, 디버깅을 AI와 함께',
    icon: '🚀',
    tags: ['WSL', 'CLI', 'Coding Agent'],
    link: '/docs/nexus-coder',
    status: 'available',
    featured: true,
  },
  {
    name: 'Nexus Coder for Windows',
    tagline: 'Native Windows Support',
    desc: 'WSL 없이 Windows 환경에서 직접 사용 가능한 Coding Agent',
    icon: '💻',
    tags: ['Windows', 'Native'],
    link: '/docs/nexus-coder-windows',
    status: 'coming',
    featured: false,
  },
  {
    name: 'Aipo',
    tagline: 'Smart Posting App',
    desc: '문서 작성, 요약, 번역 등 개인 업무 효율화를 위한 AI 도구',
    icon: '✨',
    tags: ['Productivity', 'Writing'],
    link: '/docs/aipo',
    status: 'coming',
    featured: false,
  },
]
</script>

<template>
  <div class="brand-home">
    <!-- Hero Section with Video -->
    <div class="brand-hero">
      <div class="hero-background">
        <div class="gradient-orb orb-1"></div>
        <div class="gradient-orb orb-2"></div>
      </div>

      <div class="hero-grid">
        <!-- Text Content -->
        <div class="hero-content">
          <p class="hero-label">syngha.han's AX Portal</p>
          <h1 class="hero-title">
            <span class="highlight">혁신</span>은 여러분이<br>하실 수 있도록
          </h1>
          <p class="hero-subtitle">발판을 만들어 드리겠습니다</p>
          <p class="hero-desc">
            AI 기반 개발 도구와 자동화 서비스로<br>
            업무 효율을 극대화하세요
          </p>
        </div>

        <!-- Demo Video -->
        <div class="hero-video">
          <div class="video-container">
            <video
              ref="videoRef"
              autoplay
              muted
              playsinline
              :src="currentVideoSrc"
              @ended="onVideoEnded"
              @loadeddata="setPlaybackRate"
            >
            </video>
            <div class="video-overlay"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Services Section -->
    <div class="services-section">
      <h2 class="section-title">Services</h2>
      <p class="section-desc">현재 제공 중인 서비스와 준비 중인 서비스입니다</p>

      <div class="services-grid">
        <a
          v-for="service in services"
          :key="service.name"
          :href="service.link"
          :class="['service-card', { featured: service.featured }]"
        >
          <div class="card-content">
            <div :class="['service-status', service.status]">
              {{ service.status === 'available' ? 'Available' : 'Coming Soon' }}
            </div>
            <div class="service-icon">{{ service.icon }}</div>
            <h3>{{ service.name }}</h3>
            <p class="service-tagline">{{ service.tagline }}</p>
            <p class="service-desc">{{ service.desc }}</p>
            <div class="service-tags">
              <span v-for="tag in service.tags" :key="tag">{{ tag }}</span>
            </div>
            <div class="card-cta">Click!</div>
          </div>
        </a>
      </div>
    </div>

    <!-- Contact Section -->
    <div class="contact-section">
      <div class="contact-card">
        <div class="contact-icon">💬</div>
        <div class="contact-content">
          <h3>문의사항이 있으신가요?</h3>
          <p class="contact-info">
            서비스 이용 중 궁금한 점이나 개선 요청은
            <span class="contact-name">syngha.han</span>에게 연락하시거나
          </p>
          <a :href="feedbackLink" class="contact-btn">
            <span>📝</span> Feedback 페이지 바로가기
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.brand-home {
  width: 100%;
}

/* Hero Section */
.brand-hero {
  position: relative;
  min-height: 85vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  margin: -24px -24px 0 -24px;
  padding: 60px 24px;
}

.hero-background {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #020617 0%, #0f172a 50%, #020617 100%);
  z-index: 0;
}

.gradient-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  opacity: 0.4;
  animation: float 10s ease-in-out infinite;
}

.orb-1 {
  width: 500px;
  height: 500px;
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  top: -150px;
  left: -100px;
  animation-delay: 0s;
}

.orb-2 {
  width: 400px;
  height: 400px;
  background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
  bottom: -100px;
  right: -100px;
  animation-delay: -3s;
}

@keyframes float {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-30px) scale(1.05); }
}

.hero-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
  max-width: 1200px;
  width: 100%;
  align-items: center;
}

.hero-content {
  text-align: left;
}

.hero-label {
  display: inline-block;
  padding: 8px 20px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 50px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.85rem;
  font-weight: 500;
  margin-bottom: 24px;
  backdrop-filter: blur(10px);
}

.hero-title {
  font-size: 3.2rem;
  font-weight: 800;
  color: white;
  line-height: 1.15;
  margin: 0 0 16px 0;
  letter-spacing: -0.02em;
}

.hero-title .highlight {
  background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%, #f472b6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-subtitle {
  font-size: 2rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin: 0 0 20px 0;
  letter-spacing: -0.01em;
}

.hero-desc {
  font-size: 1.05rem;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.8;
  margin: 0;
}

/* Video */
.hero-video {
  position: relative;
}

.video-container {
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.1),
    0 25px 50px -12px rgba(0, 0, 0, 0.5),
    0 0 100px rgba(99, 102, 241, 0.15);
}

.video-container video {
  width: 100%;
  height: auto;
  display: block;
  border-radius: 16px;
}

.video-overlay {
  position: absolute;
  inset: 0;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  pointer-events: none;
}

/* Services Section */
.services-section {
  max-width: 1000px;
  margin: 0 auto;
  padding: 80px 24px;
}

.section-title {
  font-size: 2rem;
  font-weight: 700;
  color: var(--vp-c-text-1);
  text-align: center;
  margin: 0 0 8px 0;
}

.section-desc {
  text-align: center;
  color: var(--vp-c-text-2);
  margin: 0 0 48px 0;
}

.services-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
}

.service-card {
  position: relative;
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 20px;
  padding: 28px;
  text-decoration: none !important;
  color: inherit;
  transition: all 0.3s ease;
  overflow: hidden;
  backdrop-filter: blur(10px);
}

.service-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 20px;
  padding: 1px;
  background: linear-gradient(135deg, rgba(148, 163, 184, 0.2), transparent 50%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}

.service-card:hover {
  transform: translateY(-4px);
  background: rgba(30, 41, 59, 0.7);
  border-color: rgba(99, 102, 241, 0.4);
  box-shadow:
    0 20px 40px rgba(0, 0, 0, 0.3),
    0 0 40px rgba(99, 102, 241, 0.1);
}

.service-card.featured {
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(99, 102, 241, 0.15) 100%);
  border-color: rgba(99, 102, 241, 0.3);
}

.service-card.featured::before {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.5), transparent 60%);
}

.card-content {
  position: relative;
  z-index: 1;
}

.service-status {
  display: inline-block;
  padding: 5px 14px;
  border-radius: 20px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 20px;
}

.service-status.available {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
}

.service-status.coming {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
}

.service-icon {
  font-size: 3rem;
  margin-bottom: 16px;
}

.service-card h3 {
  font-size: 1.3rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
  margin: 0 0 6px 0;
}

.service-tagline {
  font-size: 0.9rem;
  color: #60a5fa;
  font-weight: 500;
  margin: 0 0 14px 0;
}

.service-desc {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.7;
  margin: 0 0 20px 0;
}

.service-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.service-tags span {
  padding: 5px 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.7);
}

.card-cta {
  margin-top: 20px;
  padding: 8px 20px;
  background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  color: white;
  text-align: center;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.service-card:hover .card-cta {
  transform: scale(1.02);
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
}

/* Contact Section */
.contact-section {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 24px 80px 24px;
}

.contact-card {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 32px 40px;
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 20px;
  backdrop-filter: blur(10px);
}

.contact-icon {
  font-size: 3rem;
  flex-shrink: 0;
}

.contact-content {
  flex: 1;
}

.contact-content h3 {
  font-size: 1.25rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
  margin: 0 0 8px 0;
}

.contact-info {
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.6);
  margin: 0 0 16px 0;
  line-height: 1.6;
}

.contact-name {
  color: #60a5fa;
  font-weight: 600;
}

.contact-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 0.9rem;
  font-weight: 600;
  text-decoration: none !important;
  transition: all 0.2s ease;
  background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
}

.contact-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(59, 130, 246, 0.4);
}

/* Responsive */
@media (max-width: 900px) {
  .hero-grid {
    grid-template-columns: 1fr;
    gap: 40px;
    text-align: center;
  }

  .hero-content {
    text-align: center;
    order: 1;
  }

  .hero-video {
    order: 2;
    max-width: 500px;
    margin: 0 auto;
  }

  .hero-title {
    font-size: 2.4rem;
  }

  .hero-subtitle {
    font-size: 1.5rem;
  }
}

@media (max-width: 640px) {
  .hero-title {
    font-size: 2rem;
  }

  .hero-subtitle {
    font-size: 1.3rem;
  }

  .contact-card {
    flex-direction: column;
    text-align: center;
    padding: 28px 24px;
  }
}

</style>

<style>
/* Light mode styles - unscoped to access html class */
html:not(.dark) .service-card {
  background: white !important;
  border: 1px solid #e2e8f0 !important;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06) !important;
}

html:not(.dark) .service-card:hover {
  background: white !important;
  border-color: #6366f1 !important;
  box-shadow: 0 12px 40px rgba(99, 102, 241, 0.15) !important;
}

html:not(.dark) .service-card.featured {
  background: linear-gradient(135deg, #ffffff 0%, #eef2ff 100%) !important;
  border-color: #6366f1 !important;
}

html:not(.dark) .service-card h3 {
  color: #1e293b !important;
}

html:not(.dark) .service-tagline {
  color: #6366f1 !important;
}

html:not(.dark) .service-desc {
  color: #64748b !important;
}

html:not(.dark) .service-tags span {
  background: #f1f5f9 !important;
  border-color: #e2e8f0 !important;
  color: #475569 !important;
}

html:not(.dark) .card-cta {
  background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%) !important;
  color: white !important;
}

html:not(.dark) .contact-card {
  background: linear-gradient(135deg, #ffffff 0%, #eef2ff 100%) !important;
  border: 1px solid #e2e8f0 !important;
}

html:not(.dark) .contact-content h3 {
  color: #1e293b !important;
}

html:not(.dark) .contact-info {
  color: #64748b !important;
}
</style>
