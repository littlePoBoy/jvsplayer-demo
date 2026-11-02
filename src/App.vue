<script setup>
const navItems = [
  { to: '/private', label: '私协（websdk）' },
  { to: '/flv', label: 'FLV 主路径' },
  { to: '/hls', label: 'HLS 主路径' },
  { to: '/flv-alt', label: 'FLV 对照' },
  { to: '/hls-alt', label: 'HLS 对照' },
  { to: '/about', label: '说明' },
]
</script>

<template>
  <header class="app-header">
    <div class="app-title">JVS Web 播放参考 Demo</div>
    <nav class="app-nav">
      <router-link v-for="item in navItems" :key="item.to" :to="item.to">
        {{ item.label }}
      </router-link>
    </nav>
  </header>
  <main class="app-main">
    <router-view />
  </main>
</template>
