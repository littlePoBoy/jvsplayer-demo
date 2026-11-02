<script setup>
// 播放页共用 UI 骨架（方案 §2.2）：
// 顶=播放地址等控件；左=播放区+底栏控件；右=信息栏。仅布局，不承载任何播放器逻辑。
</script>

<template>
  <div class="player-page">
    <header class="page-top">
      <slot name="top" />
    </header>
    <div class="page-body">
      <section class="stage-col">
        <div class="stage">
          <slot name="stage" />
        </div>
        <div class="controls-wrap">
          <slot name="controls" />
        </div>
        <div class="status-line">
          <slot name="status" />
        </div>
      </section>
      <aside class="info-col">
        <slot name="info" />
      </aside>
    </div>
  </div>
</template>
