<script setup>
import { computed, onMounted, onUnmounted, ref, useTemplateRef } from 'vue'
import PlayerShell from '../components/PlayerShell.vue'
import InfoPanel from '../components/InfoPanel.vue'
import StreamSourceBar from '../components/StreamSourceBar.vue'
import RecordSourceBar from '../components/RecordSourceBar.vue'
import { loadScript } from '../utils/scriptLoader.js'
import { probeCapabilities } from '../utils/capability.js'
import { isAllowedStreamUrl } from '../utils/url.js'
import RecordTimeline from '../components/RecordTimeline.vue'
import { formatDateTime } from '../utils/format.js'

// 私协页：公司 websdk（JVMP 私协）直播 / 回放 / 截图 / 录像。
// 厂商要求：单 WebPlayer 实例承担全部业务；与开源方案页面级隔离。
// 接口/事件严格按 websdk/demo的使用说明.md 书写，勿凭记忆改签名。
const BASE_URL = import.meta.env.BASE_URL
const POLL_INTERVAL_MS = 500
const META_POLL_INTERVAL_MS = 1000

// DECODE_TYPE（wasm_decoder.bundle.js 常量核对）：0=默认(自动)、1=wasm、2=webcodec、3=video标签
const DECODE_TYPE_OPTIONS = [
  { value: 0, label: '默认（自动）' },
  { value: 3, label: 'video标签（MSE）' },
  { value: 2, label: 'webcodec（硬解）' },
  { value: 1, label: 'wasm（软解）' },
]
const FORCED_DECODE_NAMES = { 1: '指定: WASM（软解）', 2: '指定: WebCodec（硬解）', 3: '指定: video标签（MSE）' }

// 直播/回放选择：决定悬浮条形态（回放走暂停/倍速/跳播/录像/下载），SDK 仍按 URL 自动区分直播/回放
const MODE_OPTIONS = [
  { value: 'live', label: '直播' },
  { value: 'vod', label: '回放' },
]
// 时间轴刻度档位（JTimeLine timeWidth 下标；3 天档的拖动与录像段绘制原实现未支持，不提供）
const TIMELINE_RANGE_OPTIONS = [
  { value: 0, label: '1分钟' },
  { value: 1, label: '30分钟' },
  { value: 2, label: '1小时' },
  { value: 3, label: '1天' },
]
// 回放倍速（SetSpeed 取值，demo的使用说明.md 2.2.9）
const SPEED_OPTIONS = [
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 4, label: '4' },
  { value: 8, label: '8' },
  { value: 0.5, label: '1/2' },
  { value: 0.25, label: '1/4' },
  { value: 0.125, label: '1/8' },
]

const containerEl = useTemplateRef('containerEl')
const sourceBar = useTemplateRef('sourceBar')
const recordBar = useTemplateRef('recordBar')
const records = ref([]) // get_record_list 返回的录像文件
const recordTotal = ref(0)
const activeRecordKey = ref('')
const timelineRange = ref(2) // JTimeLine 刻度档位下标，默认 1 小时
const hasSourceUrl = ref(false)
const playUrl = ref('wss://mediadev02.cloudsee.com:20380/live/12221S8GAR8Y?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3NfbW9kZSI6IlB1YmxpY0Nsb3VkIiwiY2hhbm5lbF9pZCI6MCwiZGV2aWNlX2lkIjoiMTIyMjFTOEdBUjhZIiwiZXhwaXJlX3RpbWUiOjE4MDM4NTkyMDAsImlubmVyX2FkZHIiOiIxOTIuMTY4LjExNy42OjcwNzAiLCJtYXhfcGxheV9kdXJhdGlvbiI6MCwic3RyZWFtX3R5cGUiOjAsInRlbmFudF9pZCI6IiIsInVzZXJfaWQiOiI1NGFiYjE1OTNlYzM0YmVkODFkOGIwMWRkNTc4MTY0ZSJ9.FXnunl2VLMFlcw4eK_kA1lmz7UxKBsvYpC8SpoOw4Yo')
const streamMode = ref('live')
const decodeType = ref(0)
const volume = ref(1)
const isMuted = ref(false)
const codecReady = ref(false)
const hasPlayer = ref(false)
const isPaused = ref(false)
const isTalking = ref(false)
const talkUrl = ref('wss://mediadev02.cloudsee.com:20380/talk/12221S8GAR8Y?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3NfbW9kZSI6IlB1YmxpY0Nsb3VkIiwiY2hhbm5lbF9pZCI6MCwiZGV2aWNlX2lkIjoiMTIyMjFTOEdBUjhZIiwiZXhwaXJlX3RpbWUiOjE4MDM4NTkyMDAsImlubmVyX2FkZHIiOiIxOTIuMTY4LjExNy42OjcwNzAiLCJsaW5rX2tleSI6IjE3OTM4NDY0Mjc1MTE2OTYxNzIxOCIsIm1heF9wbGF5X2R1cmF0aW9uIjowLCJ0ZW5hbnRfaWQiOiIiLCJ1c2VyX2lkIjoiMDE0ZThmODg0OGVjNGNjNDk1NWJkYjc5ZTQ0MjA2NWYifQ.QABXQxcwq-eXpgxNL1tmA3GeAJjsavQuiybVfRiMSJA') // 与播放地址同款预填测试对讲流，弹窗内可改
const talkDialogVisible = ref(false)
const isRecording = ref(false)
const isDownloading = ref(false)
const curTs = ref(null)
const playSpeed = ref(1)
const seekDialogVisible = ref(false)
const seekTimeStr = ref('') // 跳播弹窗 datetime-local 值
const downloadUrl = ref('')
const downloadDialogVisible = ref(false)
const metaInfo = ref(null)
const capRows = ref([])

let webplayer = null
let playerOptions = null // 构造 options；Play() 时从其读取 decodeType
let progressTimer = null
let metaTimer = null

function normalizeSeconds(value) {
  // 兼容毫秒/秒两种时间戳
  return value > 1e12 ? value / 1000 : value
}

function handleProgressMsg(msg) {
  if (typeof msg === 'number') {
    const seconds = normalizeSeconds(msg)
    if (seconds > 1e9) {
      curTs.value = seconds
    }
    return
  }
  if (msg && typeof msg === 'object') {
    for (const key of ['timestamp', 'curTime', 'currentTime', 'pts', 'time', 'cur']) {
      const value = msg[key]
      if (typeof value === 'number') {
        curTs.value = normalizeSeconds(value)
        return
      }
    }
  }
}

// 流信息（与各播放页统一口径）。websdk 公开 API 未暴露流元数据（demo的使用说明.md 2.x/3.x
// 无相关接口），取自内部 m_mediaMetadata（stream_client.bundle.js 解析后经 HandleMetaDataUpdate 存放）：
// { v: { codecType, width, height, frameRate }, a: { codecType, sampleRate } }。
// codecType 枚举经 bundle 核对：视频 1=H264 2=H265；音频 1=G711A 2=G711U 4=AAC。
const VIDEO_CODEC_NAMES = { 1: 'H264', 2: 'H265' }
const AUDIO_CODEC_NAMES = { 1: 'G711A', 2: 'G711U', 4: 'AAC' }

// websdk 解码器自动链（wasm_decoder.bundle.js）：MSE(video标签) → WebCodec → WASM 软解；
// decodeType 默认(0)走自动链，实际解码器按右侧能力探测同序推断；指定后展示所选模式。
const decodeMode = computed(() => {
  if (decodeType.value !== 0) {
    return FORCED_DECODE_NAMES[decodeType.value]
  }
  const codecName = metaInfo.value ? VIDEO_CODEC_NAMES[metaInfo.value.v?.codecType] : null
  if (!codecName) {
    return '自动'
  }
  const cap = (label) => capRows.value.some((row) => row.label === label && row.value === '支持')
  const codecTag = codecName === 'H265' ? 'H.265' : 'H.264'
  if (cap(`MSE ${codecTag}`)) {
    return '自动: MSE（video标签）'
  }
  if (cap(`WebCodecs ${codecTag}`)) {
    return '自动: WebCodec（硬解）'
  }
  return '自动: WASM（软解）'
})

const isVod = computed(() => streamMode.value === 'vod')
const canPlay = computed(() => (isVod.value ? !!playUrl.value.trim() : hasSourceUrl.value))

const videoRows = computed(() => {
  const v = metaInfo.value?.v
  const a = metaInfo.value?.a
  return [
    { label: '视频编码', value: v ? (VIDEO_CODEC_NAMES[v.codecType] ?? null) : null },
    { label: '分辨率', value: v?.width ? `${v.width} × ${v.height}` : null },
    { label: '帧率', value: v?.frameRate ? `${Math.round(v.frameRate * 100) / 100} fps` : null },
    { label: '解码模式', value: decodeMode.value },
    { label: '音频编码', value: metaInfo.value ? (a?.isValid ? (AUDIO_CODEC_NAMES[a.codecType] ?? null) : '无音频') : null },
    { label: '音频采样率', value: a?.sampleRate ? `${a.sampleRate} Hz` : null },
  ]
})

// ---------- 进度轮询（GetCurTimestamp 驱动自研进度条） ----------

function startProgressPolling() {
  stopProgressPolling()
  progressTimer = setInterval(() => {
    if (!webplayer) {
      return
    }
    // GetCurTimestamp 仅回放 player 有实现（bundle 内 vod player 定义，直播 player 无此方法，
    // 见 demo的使用说明.md 2.2.12 回放章节），直播模式跳过轮询，避免抛 GetCurTimestamp is not a function
    if (typeof webplayer.m_player?.GetCurTimestamp !== 'function') {
      return
    }
    const ts = Number(webplayer.GetCurTimestamp())
    if (Number.isFinite(ts) && ts > 0) {
      curTs.value = normalizeSeconds(ts)
    }
  }, POLL_INTERVAL_MS)
}

function stopProgressPolling() {
  if (progressTimer) {
    clearInterval(progressTimer)
    progressTimer = null
  }
}

// ---------- 流信息轮询（内部 m_mediaMetadata，见 videoRows 注释） ----------

function startMetaPolling() {
  stopMetaPolling()
  metaTimer = setInterval(() => {
    const meta = webplayer?.m_player?.m_mediaMetadata ?? null
    metaInfo.value = meta ? { v: { ...meta.v }, a: { ...meta.a } } : null
  }, META_POLL_INTERVAL_MS)
}

function stopMetaPolling() {
  if (metaTimer) {
    clearInterval(metaTimer)
    metaTimer = null
  }
}

// ---------- 事件订阅（事件表见 demo的使用说明.md 第 3 节） ----------

function wireEvents(instance) {
  instance.on('codec_loaded', () => {
    codecReady.value = true
  })
  instance.on('media_play_success', () => {
    hasPlayer.value = true
    isPaused.value = false
  })
  instance.on('media_play_stopped', () => {
    hasPlayer.value = false
    isPaused.value = false
    isTalking.value = false // 直播模式 Stop 会连带关闭对讲
    stopProgressPolling()
    stopMetaPolling()
    metaInfo.value = null
  })
  instance.on('live_failed', (msg) => {
    console.warn('live_failed:', msg)
    hasPlayer.value = false
  })
  instance.on('vod_failed', (msg) => {
    console.warn('vod_failed:', msg)
    hasPlayer.value = false
  })
  instance.on('vod_pausing', () => {
    isPaused.value = true
  })
  instance.on('vod_speed', (msg) => {
    // SetSpeed/Resume 成功回执（bundle 内 emit GetSpeed() 数值），同步倍速下拉
    if (typeof msg === 'number') {
      playSpeed.value = msg
    }
  })
  instance.on('vod_over', () => {
    isPaused.value = true
    stopProgressPolling()
  })
  instance.on('vod_progress', (msg) => {
    handleProgressMsg(msg)
  })
  instance.on('talk_started', () => {
    isTalking.value = true
  })
  instance.on('talk_failed', (msg) => {
    console.warn('talk_failed:', msg)
    isTalking.value = false
  })
  instance.on('talk_stopped', () => {
    isTalking.value = false
  })
  instance.on('download_failed', (msg) => {
    console.warn('download_failed:', msg)
    isDownloading.value = false
  })
  instance.on('download_over', () => {
    isDownloading.value = false
  })
  instance.on('download_progress', () => {}) // 仅回执展示；订阅保留待 UI 补回
  instance.on('download_stopped', () => {
    isDownloading.value = false
  })
  instance.on('recordered_one_file', () => {}) // 仅回执展示；订阅保留待 UI 补回
}

// ---------- 业务操作 ----------

async function onPlay() {
  if (!webplayer) {
    return
  }
  if (!codecReady.value) {
    return
  }
  // 直播地址可在 StreamSourceBar 获取或手动输入，回放用手动地址（回放取址待做）
  const target = isVod.value ? playUrl.value.trim() : await sourceBar.value.ensureUrl()
  if (!target || !isAllowedStreamUrl(target)) {
    return
  }
  try {
    // 文档要求：每次播放前重设音量，避免页面残留值与默认值不一致（静音时按 0 生效）
    webplayer.SetVolume(isMuted.value ? 0 : Number(volume.value))
    // Play() 时从构造 options 读取 decodeType（m_options 即传入对象引用，bundle 核对），播放前同步下拉值
    playerOptions.decodeType = decodeType.value
    await webplayer.Play({ url: target })
    hasPlayer.value = true
    isPaused.value = false
    playSpeed.value = 1
    curTs.value = null
    metaInfo.value = null
    startMetaPolling()
    startProgressPolling()
  } catch (err) {
    console.warn('播放失败：', err)
  }
}

// ---------- 录像列表（回放） ----------

const RECORD_TYPE_NAMES = { alarm: '报警', normal: '普通' }

function recordKey(rec) {
  return `${rec.fileName}|${rec.startTime}`
}

// yyyyMMddHHmmss → HH:mm:ss
function formatRecordClock(value) {
  const s = String(value ?? '')
  return s.length === 14 ? `${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}` : s
}

// yyyyMMddHHmmss → unix 秒（按浏览器本地时区解析，默认设备与浏览器同时区）
function parseRecordTime(value) {
  const s = String(value ?? '')
  if (s.length !== 14) {
    return null
  }
  const ms = new Date(
    Number(s.slice(0, 4)),
    Number(s.slice(4, 6)) - 1,
    Number(s.slice(6, 8)),
    Number(s.slice(8, 10)),
    Number(s.slice(10, 12)),
    Number(s.slice(12, 14)),
  ).getTime()
  return Number.isFinite(ms) ? ms / 1000 : null
}

// 各录像的起止 unix 秒；时间轴据此画出有录像的时间段
const recordSpans = computed(() =>
  records.value
    .map((rec) => ({ rec, start: parseRecordTime(rec.startTime), end: parseRecordTime(rec.endTime) }))
    .filter((span) => span.start !== null && span.end !== null),
)
// JTimeLine 的 timeSection 用毫秒
const timelineSections = computed(() =>
  recordSpans.value.map((span) => ({ startTime: span.start * 1000, endTime: span.end * 1000 })),
)

// 时间轴拖动松手：目标时刻落在某段录像内才有效。
// 播放地址按单个录像的起止取得，所以目标在当前录像内用 SetStartTime，在其他录像内则换取该录像的地址重新播放再跳转。
async function onTimelineSeek(unixSeconds) {
  const target = Math.floor(unixSeconds)
  const span = recordSpans.value.find((s) => target >= s.start && target <= s.end)
  if (!webplayer || !span) {
    return
  }
  if (!hasPlayer.value || activeRecordKey.value !== recordKey(span.rec)) {
    await onPlayRecord(span.rec)
    if (!hasPlayer.value) {
      return
    }
  }
  curTs.value = target // 先行更新进度，避免等下一次轮询才动
  webplayer.SetStartTime(target).catch((err) => console.warn('SetStartTime:', err))
}

async function onPlayRecord(rec) {
  if (!webplayer || !codecReady.value) {
    return
  }
  const url = await recordBar.value.getPlaybackUrl(rec)
  if (!url) {
    return
  }
  activeRecordKey.value = recordKey(rec)
  playUrl.value = url
  // 切换录像前先停掉当前播放（Stop 同步；media_play_stopped 早于 Play 返回，不会覆盖 onPlay 的状态）
  if (hasPlayer.value || isDownloading.value || isRecording.value) {
    onStop()
  }
  await onPlay()
}

function onStop() {
  if (!webplayer) {
    return
  }
  // 文档：回放模式 Stop 不会关闭下载，这里主动补停；直播模式 Stop 会连带关闭对讲
  if (isDownloading.value) {
    webplayer.StopDownload().catch((err) => console.warn('StopDownload:', err))
  }
  if (isRecording.value) {
    webplayer.StopRecorde()
    isRecording.value = false
  }
  webplayer.Stop()
  stopProgressPolling()
  stopMetaPolling()
  metaInfo.value = null
  hasPlayer.value = false
  isPaused.value = false
  playSpeed.value = 1
  curTs.value = null
}

// ---------- 回放控制（demo的使用说明.md 2.2：Pause/Resume/SetSpeed/SetStartTime/StartDownload） ----------

function onModeChange() {
  // 直播/回放切换后当前播放上下文失效，先停止
  if (hasPlayer.value || isDownloading.value) {
    onStop()
  }
}

function onTogglePause() {
  if (!webplayer) {
    return
  }
  if (!hasPlayer.value) {
    onPlay()
    return
  }
  if (isPaused.value) {
    isPaused.value = false
    webplayer.Resume().catch((err) => {
      console.warn('Resume:', err)
      isPaused.value = true
    })
  } else {
    isPaused.value = true
    webplayer.Pause().catch((err) => {
      console.warn('Pause:', err)
      isPaused.value = false
    })
  }
}

function onSpeedChange() {
  if (!webplayer) {
    return
  }
  webplayer.SetSpeed(Number(playSpeed.value)).catch((err) => console.warn('SetSpeed:', err))
}

function toDatetimeLocalValue(unixSeconds) {
  const d = new Date(unixSeconds * 1000)
  const pad = (n) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  )
}

function onSeekClick() {
  // 预填当前进度（GetCurTimestamp 为 unix 秒，见 demo的使用说明.md 2.2.12）
  seekTimeStr.value = curTs.value > 1e9 ? toDatetimeLocalValue(curTs.value) : ''
  seekDialogVisible.value = true
}

function onSeekConfirm() {
  const ms = new Date(seekTimeStr.value).getTime()
  if (!webplayer || !Number.isFinite(ms)) {
    return
  }
  seekDialogVisible.value = false
  // SetStartTime 取 unix 秒（demo的使用说明.md 2.2.6；是否再偏移时区由设备/平台侧决定）
  webplayer.SetStartTime(Math.floor(ms / 1000)).catch((err) => console.warn('SetStartTime:', err))
}

function onToggleDownload() {
  if (isDownloading.value) {
    webplayer.StopDownload().catch((err) => console.warn('StopDownload:', err))
    return
  }
  if (!downloadUrl.value) {
    downloadUrl.value = playUrl.value
  }
  downloadDialogVisible.value = true
}

async function onDownloadConfirm() {
  const target = downloadUrl.value.trim()
  if (!webplayer || !isAllowedStreamUrl(target)) {
    return
  }
  downloadDialogVisible.value = false
  try {
    await webplayer.StartDownload({ url: target })
    isDownloading.value = true
  } catch (err) {
    console.warn('下载启动失败：', err)
  }
}

async function onScreenshot() {
  try {
    await webplayer.ScreenShot({ type: 'download', format: 'png' })
  } catch (err) {
    console.warn('截图失败：', err)
  }
}

async function onToggleRecord() {
  if (isRecording.value) {
    webplayer.StopRecorde()
    isRecording.value = false
    return
  }
  try {
    await webplayer.StartRecorde()
    isRecording.value = true
  } catch (err) {
    console.warn('录像启动失败：', err)
  }
}

function onTalkClick() {
  if (isTalking.value) {
    webplayer.StopTalk() // talk_stopped 事件里复位 isTalking
    return
  }
  talkDialogVisible.value = true
}

async function onTalkConfirm() {
  const target = talkUrl.value.trim()
  if (!webplayer || !isAllowedStreamUrl(target)) {
    return
  }
  talkDialogVisible.value = false
  try {
    // 文档要求：每次对讲前重设扬声器/麦克风音量，避免页面残留值与默认值不一致（麦克风默认 0.8）
    webplayer.SetVolume(isMuted.value ? 0 : Number(volume.value))
    webplayer.SetMicVolume(0.8)
    await webplayer.StartTalk({ url: target })
  } catch (err) {
    console.warn('对讲启动失败：', err)
  }
}

function applyVolume() {
  // 拖动音量滑杆自动取消静音
  isMuted.value = false
  webplayer?.SetVolume(Number(volume.value))
}

function toggleMute() {
  // websdk 无 SetMute，静音即 SetVolume(0)，滑杆值仍保留
  isMuted.value = !isMuted.value
  webplayer?.SetVolume(isMuted.value ? 0 : Number(volume.value))
}

function goFullscreen() {
  webplayer?.FullScreen()
}

// ---------- 生命周期 ----------

onMounted(async () => {
  capRows.value = await probeCapabilities()
  try {
    await loadScript(`${BASE_URL}websdk/JWebPlayer.bundle.js`)
  } catch (err) {
    // 加载失败通常是部署问题，保留提示文本便于排查
    console.warn(`websdk 加载失败：${err.message}。请确认 SDK 文件已部署到 public/websdk/。`)
    return
  }
  playerOptions = {
    container: containerEl.value,
    prefixPath: `${BASE_URL}websdk/`,
    decodeType: decodeType.value,
  }
  webplayer = new window.JWebPlayer(playerOptions)
  wireEvents(webplayer)
})

onUnmounted(() => {
  stopProgressPolling()
  stopMetaPolling()
  if (!webplayer) {
    return
  }
  if (isDownloading.value) {
    webplayer.StopDownload().catch((err) => console.warn('StopDownload:', err))
  }
  if (isRecording.value) {
    webplayer.StopRecorde()
  }
  if (isTalking.value) {
    webplayer.StopTalk()
  }
  webplayer.Stop()
})
</script>

<template>
  <PlayerShell :overlay-wide="isVod">
    <template #top>
      <select v-model="streamMode" class="select" @change="onModeChange">
        <option v-for="opt in MODE_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
      <RecordSourceBar
        v-show="isVod"
        ref="recordBar"
        v-model:records="records"
        v-model:total="recordTotal"
      />
      <StreamSourceBar
        v-show="!isVod"
        ref="sourceBar"
        v-model:has-url="hasSourceUrl"
        protocol-type="wss"
        @play="onPlay"
      />
      <label class="checkbox-label">
        解码模式
        <select v-model="decodeType" class="select">
          <option v-for="opt in DECODE_TYPE_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </label>
      <button class="btn btn-primary" type="button" :disabled="!codecReady || !canPlay" @click="onPlay">播放</button>
      <button class="btn" type="button" :disabled="!hasPlayer" @click="onStop">停止</button>
    </template>

    <template #stage>
      <!-- websdk 要求 container 必须是 div（不能是 video/canvas 标签） -->
      <div ref="containerEl" class="stage-host"></div>
    </template>

    <template #overlay>
      <!-- 回放模式：暂停/播放、倍速、跳播、录像、下载（对讲为直播专属，不渲染） -->
      <template v-if="isVod">
        <!-- 第一行：进度条（官方 JTimeLine，红色段 = 有录像）；其下为控制按钮 -->
        <RecordTimeline
          :cur-ts="curTs"
          :sections="timelineSections"
          :range="timelineRange"
          :disabled="!timelineSections.length"
          @seek="onTimelineSeek"
        />
        <button class="btn" type="button" :disabled="!hasPlayer && (!codecReady || !canPlay)" @click="onTogglePause">
          {{ !hasPlayer ? '播放' : isPaused ? '播放' : '暂停' }}
        </button>
        <span class="field-label">倍速</span>
        <select v-model.number="playSpeed" class="select" :disabled="!hasPlayer" @change="onSpeedChange">
          <option v-for="opt in SPEED_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <button class="btn" type="button" :disabled="!hasPlayer" @click="onScreenshot">截图</button>

        <button
          class="btn"
          type="button"
          :class="{ 'btn-danger': isRecording }"
          :disabled="!hasPlayer"
          @click="onToggleRecord"
        >
          {{ isRecording ? '停止录像' : '开始录像' }}
        </button>
        <button
          class="btn"
          type="button"
          :class="{ 'btn-danger': isDownloading }"
          :disabled="!hasPlayer"
          @click="onToggleDownload"
        >
          {{ isDownloading ? '停止下载' : '下载' }}
        </button>
        <button class="btn" type="button" @click="toggleMute">
          {{ isMuted ? '取消静音' : '静音' }}
        </button>
        <span class="field-label">音量</span>
        <input v-model.number="volume" type="range" min="0" max="1" step="0.01" @input="applyVolume" />
        <button class="btn" type="button" :disabled="!hasPlayer" @click="goFullscreen">全屏</button>
      </template>
      <template v-else>
        <button
          class="btn"
          type="button"
          :disabled="!hasPlayer && (!codecReady || !canPlay)"
          @click="hasPlayer ? onStop() : onPlay()"
        >
          {{ hasPlayer ? '停止' : '播放' }}
        </button>
        <button class="btn" type="button" @click="toggleMute">
          {{ isMuted ? '取消静音' : '静音' }}
        </button>
        <span class="field-label">音量</span>
        <input v-model.number="volume" type="range" min="0" max="1" step="0.01" @input="applyVolume" />

        <button class="btn" type="button" :disabled="!hasPlayer" @click="onScreenshot">截图</button>
        <button
          class="btn"
          type="button"
          :class="{ 'btn-danger': isRecording }"
          :disabled="!hasPlayer"
          @click="onToggleRecord"
        >
          {{ isRecording ? '停止录像' : '开始录像' }}
        </button>
        <button
          class="btn"
          type="button"
          :class="{ 'btn-danger': isTalking }"
          :disabled="!hasPlayer"
          @click="onTalkClick"
        >
          {{ isTalking ? '停止对讲' : '开始对讲' }}
        </button>
        <button class="btn" type="button" :disabled="!hasPlayer" @click="goFullscreen">全屏</button>
      </template>
    </template>

    <!-- 录像文件列表：独占一行，卡片横向滑动；封面接口不存在，用占位图 + 播放键 -->
    <template #strip>
      <section v-if="isVod" class="record-panel">
        <h3 class="record-title">
          录像文件列表
          <span v-if="recordTotal" class="record-total">共 {{ recordTotal }} 条<template v-if="recordTotal > records.length">，仅展示前 {{ records.length }} 条</template></span>
        </h3>
        <p v-if="!records.length" class="record-empty">暂无录像，请填写凭据后点击“获取录像文件列表”</p>
        <div v-else class="record-list">
          <button
            v-for="rec in records"
            :key="recordKey(rec)"
            type="button"
            class="record-card"
            :class="{ 'is-active': activeRecordKey === recordKey(rec) }"
            :title="rec.fileName"
            @click="onPlayRecord(rec)"
          >
            <span class="record-thumb">
              <span class="record-play" aria-hidden="true"></span>
              <span class="record-type" :class="{ 'is-alarm': rec.recordType === 'alarm' }">
                {{ RECORD_TYPE_NAMES[rec.recordType] ?? rec.recordType ?? '-' }}
              </span>
            </span>
            <span class="record-time">{{ formatRecordClock(rec.startTime) }} - {{ formatRecordClock(rec.endTime) }}</span>
          </button>
        </div>
      </section>
    </template>

    <template #info>
      <InfoPanel title="视频信息" :rows="videoRows" />
      <InfoPanel title="浏览器 / 解码能力" :rows="capRows" />
    </template>
  </PlayerShell>

  <!-- 对讲地址弹窗：点击悬浮条「开始对讲」弹出，确定后 StartTalk -->
  <div v-if="talkDialogVisible" class="dialog-mask" @click.self="talkDialogVisible = false">
    <div class="dialog">
      <div class="dialog-title">开始对讲</div>
      <input
        v-model="talkUrl"
        class="input dialog-input"
        type="text"
        placeholder="对讲地址（ws://…）"
        @keyup.enter="onTalkConfirm"
      />
      <div class="dialog-actions">
        <button class="btn" type="button" @click="talkDialogVisible = false">取消</button>
        <button class="btn btn-primary" type="button" :disabled="!talkUrl.trim()" @click="onTalkConfirm">确定</button>
      </div>
    </div>
  </div>

  <!-- 跳播弹窗（回放）：输入目标时刻，确定后 SetStartTime(unix 秒) -->
  <div v-if="seekDialogVisible" class="dialog-mask" @click.self="seekDialogVisible = false">
    <div class="dialog">
      <div class="dialog-title">跳播</div>
      <input
        v-model="seekTimeStr"
        class="input dialog-input"
        type="datetime-local"
        step="1"
        @keyup.enter="onSeekConfirm"
      />
      <div class="dialog-actions">
        <button class="btn" type="button" @click="seekDialogVisible = false">取消</button>
        <button class="btn btn-primary" type="button" :disabled="!seekTimeStr" @click="onSeekConfirm">确定</button>
      </div>
    </div>
  </div>

  <!-- 下载地址弹窗（回放）：确定后 StartDownload -->
  <div v-if="downloadDialogVisible" class="dialog-mask" @click.self="downloadDialogVisible = false">
    <div class="dialog">
      <div class="dialog-title">下载录像</div>
      <input
        v-model="downloadUrl"
        class="input dialog-input"
        type="text"
        placeholder="下载地址（ws://…）"
        @keyup.enter="onDownloadConfirm"
      />
      <div class="dialog-actions">
        <button class="btn" type="button" @click="downloadDialogVisible = false">取消</button>
        <button class="btn btn-primary" type="button" :disabled="!downloadUrl.trim()" @click="onDownloadConfirm">确定</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.record-panel {

  padding-left: 12px;
  padding-right: 12px;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.record-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
}

.record-total,
.record-empty {
  font-size: 12px;
  font-weight: 400;
  color: var(--color-text-sub);
}

.record-empty {
  margin: 0;
}

/* 横向滑动：单行不换行，触摸/触控板左右滑，鼠标用底部滚动条 */
.record-list {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 6px;
  scroll-snap-type: x proximity;
}

.record-card {
  flex: 0 0 120px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0;
  border: 2px solid transparent;
  border-radius: var(--radius);
  background: transparent;
  color: var(--color-text);
  font-size: 11px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  text-align: center;
  cursor: pointer;
  scroll-snap-align: start;
}

.record-card.is-active {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

/* 占位效果图（16:9）+ 居中播放键 */
.record-thumb {
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: 4px;
  background: linear-gradient(135deg, #1f2937, #0b0d10);
}

.record-play {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 24px;
  height: 24px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  transition: background 0.15s ease;
}

.record-play::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-35%, -50%);
  border-style: solid;
  border-width: 5px 0 5px 8px;
  border-color: transparent transparent transparent #fff;
}

.record-card:hover .record-play {
  background: var(--color-primary);
}

.record-type {
  position: absolute;
  top: 4px;
  left: 4px;
  padding: 0 4px;
  border-radius: 3px;
  font-size: 11px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
}

.record-type.is-alarm {
  background: var(--color-danger);
}

.dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
}

.dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(420px, calc(100vw - 32px));
  padding: 16px;
  border-radius: 8px;
  background: var(--color-panel);
}

.dialog-title {
  font-size: 15px;
  font-weight: 600;
}

.dialog-input {
  width: 100%;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
