<script setup>
import { computed } from 'vue'
import { formatDateTime } from '../utils/format.js'

// 回放进度条（自研，替代官方 JTimeLine 组件——它不属于 websdk，本仓库不引入）。
// 驱动：页面轮询 GetCurTimestamp() 更新 curTs；跳转：点击轨道 emit seek(unix 秒)。
const props = defineProps({
  curTs: { type: Number, default: null },
  startTs: { type: Number, default: null },
  endTs: { type: Number, default: null },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits({ seek: [timestamp] })

const hasRange = computed(
  () => props.startTs !== null && props.endTs !== null && props.endTs > props.startTs,
)

const percent = computed(() => {
  if (!hasRange.value || props.curTs === null) {
    return 0
  }
  const ratio = (props.curTs - props.startTs) / (props.endTs - props.startTs)
  return Math.min(100, Math.max(0, ratio * 100))
})

function onTrackClick(event) {
  if (props.disabled || !hasRange.value) {
    return
  }
  const rect = event.currentTarget.getBoundingClientRect()
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  emit('seek', props.startTs + ratio * (props.endTs - props.startTs))
}
</script>

<template>
  <div class="timeline">
    <div
      class="timeline-track"
      :class="{ 'is-disabled': props.disabled || !hasRange }"
      :title="hasRange ? '点击跳转' : '时间范围未知（回放列表未提供起止时间），仅展示当前进度'"
      @click="onTrackClick"
    >
      <div class="timeline-fill" :style="{ width: percent + '%' }"></div>
    </div>
    <span class="timeline-time">
      {{ formatDateTime(props.curTs) }}
      <template v-if="hasRange"> / {{ formatDateTime(props.endTs) }}</template>
    </span>
  </div>
</template>

<style scoped>
.timeline-track.is-disabled {
  cursor: default;
  opacity: 0.6;
}
</style>
