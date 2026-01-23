// 폐쇄망 환경을 위한 커스텀 테마
// 외부 폰트 대신 시스템 폰트 사용

import DefaultTheme from 'vitepress/theme'
import './custom.css'
import BrandHome from './BrandHome.vue'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('BrandHome', BrandHome)
  }
}
