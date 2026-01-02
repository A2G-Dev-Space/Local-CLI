import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Nexus Coder',
  description: 'Enterprise AI Coding Assistant Documentation',

  // /docs 경로에서 서빙되므로 base 설정 필수
  base: '/docs/',

  // 폐쇄망용: 외부 리소스 비활성화
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/docs/images/logo.png' }],
    // 외부 리소스 차단 - CSP 설정
    ['meta', {
      'http-equiv': 'Content-Security-Policy',
      content: "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; img-src 'self' data:; font-src 'self' data:;"
    }],
  ],

  // Google Fonts 비활성화
  appearance: true,

  // 정적 빌드 설정 (docker-compose에서 docs/.vitepress/dist 마운트)
  // config.mts 위치 기준 상대경로
  outDir: './../.vitepress/dist',

  themeConfig: {
    logo: '/images/logo.png',

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Demos', link: '/demos/' },
      { text: 'Feedback', link: '/feedback', target: '_self' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Installation', link: '/guide/installation' },
          ]
        },
        {
          text: 'Usage',
          items: [
            { text: 'Basic Usage', link: '/guide/basic-usage' },
            { text: 'Advanced Usage', link: '/guide/advanced-usage' },
            { text: 'Compact Mode', link: '/guide/compact' },
          ]
        },
        {
          text: 'Tools',
          items: [
            { text: 'Browser Tools', link: '/guide/browser-tools' },
            { text: 'Office Tools', link: '/guide/office-tools' },
          ]
        }
      ],
      '/demos/': [
        {
          text: 'Demos',
          items: [
            { text: 'Overview', link: '/demos/' },
            { text: 'Understanding Codebase', link: '/demos/understanding-codebase' },
            { text: 'Vibe Coding Streamlit', link: '/demos/vibe-coding-streamlit' },
            { text: 'Vibe Coding React', link: '/demos/vibe-coding-react' },
            { text: 'Web Debugging', link: '/demos/web-debugging' },
            { text: 'Office Automation', link: '/demos/office-automation' },
            { text: 'Git Automation', link: '/demos/git-automation' },
          ]
        }
      ]
    },

    socialLinks: [
      // 폐쇄망이므로 외부 링크 제거 또는 내부 링크로 변경
    ],

    footer: {
      message: 'Developed by syngha.han, byeongju.lee, young87.kim',
      copyright: 'Nexus Coder - Internal Use Only'
    },

    search: {
      provider: 'local'  // 로컬 검색 (외부 Algolia 대신)
    }
  },

  // Markdown 설정
  markdown: {
    lineNumbers: true
  },

  // Vite 설정 (폐쇄망 최적화)
  vite: {
    // 외부 리소스 차단
    build: {
      rollupOptions: {
        external: []
      }
    }
  }
})
