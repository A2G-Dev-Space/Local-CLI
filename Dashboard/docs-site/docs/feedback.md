---
layout: page
---

<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  window.location.href = window.location.origin + '/feedback'
})
</script>

<div style="text-align: center; padding: 60px 20px;">
  <p style="color: #666;">피드백 페이지로 이동 중...</p>
</div>
