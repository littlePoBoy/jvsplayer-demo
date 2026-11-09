<script setup>
// 播放页共用 UI 骨架（方案 §2.2）：
// 顶=播放地址等控件；左=播放区（右下角悬浮控件条，悬停显示）；右=信息栏。
// 仅布局，不承载任何播放器逻辑。
// overlayWide：悬浮条撑满播放区宽度（私协页回放：进度条在上、按钮在下）。
defineProps({
  overlayWide: { type: Boolean, default: false },
})
</script>

<template>
  <div class="player-page">
    <header class="page-top">
      <slot name="top" />
    </header>
    <slot name="strip" />
    <div class="page-body">
      <section class="stage-col">
        <div class="stage">
          <slot name="stage" />
          <div v-if="$slots.overlay" class="stage-overlay" :class="{ 'is-wide': overlayWide }">
            <slot name="overlay" />
          </div>
        </div>
      </section>
      <aside class="info-col">
        <slot name="info" />
      </aside>
    </div>
  </div>
</template>
