<script setup>
import { onMounted, onUnmounted, useTemplateRef, watch } from 'vue'
import JTimeLine from '../utils/JtimeLine.js'

// 回放时间轴：封装官方 JTimeLine（canvas）。中线 = 当前播放时刻，拖动松手后 emit seek(unix 秒)。
// JTimeLine 依赖全局选择器 .time-line-body / #canvas-container，故同一页面只能挂一个实例。
// 时间单位：JTimeLine 用毫秒；本组件对外 curTs / seek 用 unix 秒，sections 用毫秒 [{ startTime, endTime }]。
const props = defineProps({
  curTs: { type: Number, default: null }, // 当前播放时刻（unix 秒）
  sections: { type: Array, default: () => [] }, // 有录像的时间段（毫秒）
  range: { type: Number, default: 2 }, // JTimeLine 刻度档位下标：0=1分钟 1=30分钟 2=1小时 3=1天
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['seek'])

const HEIGHT = 48
const wrapEl = useTemplateRef('wrapEl')
const canvasEl = useTemplateRef('canvasEl')

let timeline = null
let resizeObserver = null

function centerTimeMs() {
  if (Number.isFinite(props.curTs) && props.curTs > 0) {
    return props.curTs * 1000
  }
  return props.sections[0]?.startTime ?? Date.now()
}

function applyDisabled() {
  if (!timeline) {
    return
  }
  if (props.disabled) {
    timeline.readOnly()
  } else {
    timeline.unReadOnly()
  }
}

// 画布像素宽度随容器变化：重设 canvas 宽高属性（会清空画布）后让 JTimeLine 重绘
function resize() {
  const width = wrapEl.value?.clientWidth
  if (!timeline || !width || width === timeline.canvasWidth) {
    return
  }
  canvasEl.value.width = width
  timeline.options.width = width
  timeline.canvasWidth = width
  timeline.updata()
}

onMounted(() => {
  const width = wrapEl.value.clientWidth || 600
  canvasEl.value.width = width
  canvasEl.value.height = HEIGHT
  timeline = new JTimeLine()
  // init 前必须设好 width（默认 null 会写出 "nullpx"）
  timeline.options.width = width
  timeline.options.height = HEIGHT
  timeline.options.time = centerTimeMs()
  timeline.options.timeSection = props.sections
  timeline.options.timeWidth = props.range
  timeline.init({ onChange: (ms) => emit('seek', ms / 1000) })
  applyDisabled()
  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(wrapEl.value)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  timeline = null
})

// 播放进度驱动：run() 在用户拖动期间不会覆盖位置
watch(
  () => props.curTs,
  (value) => {
    if (timeline && Number.isFinite(value) && value > 0) {
      timeline.run({ time: value * 1000 })
    }
  },
)

watch(
  () => props.sections,
  (sections) => {
    if (!timeline) {
      return
    }
    // 尚未播放时把时间轴移到第一段录像；updata 的 time 为 0/空时保持原位置
    timeline.updata({ timeSection: sections, time: Number.isFinite(props.curTs) ? undefined : sections[0]?.startTime })
  },
)

watch(
  () => props.range,
  (value) => timeline?.changeSize(value),
)

watch(() => props.disabled, applyDisabled)
</script>

<template>
  <div ref="wrapEl" class="record-timeline">
    <div id="canvas-container">
      <canvas ref="canvasEl" class="time-line-body"></canvas>
    </div>
  </div>
</template>

<style scoped>
.record-timeline {
  flex: 1 1 100%;
  min-width: 0;
  overflow: hidden;
  border-radius: 4px;
}

.time-line-body {
  display: block;
  cursor: pointer;
}
</style>
