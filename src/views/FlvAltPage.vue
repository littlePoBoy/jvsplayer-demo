<script setup>
import { computed, onMounted, onUnmounted, ref, useTemplateRef } from 'vue'
import PlayerShell from '../components/PlayerShell.vue'
import InfoPanel from '../components/InfoPanel.vue'
import { loadScript } from '../utils/scriptLoader.js'
import { probeCapabilities } from '../utils/capability.js'
import { isAllowedStreamUrl } from '../utils/url.js'
import { formatVideoCodecName, formatAudioCodecName, formatDuration } from '../utils/format.js'

// FLV 对照页（方案 B）：h265web.js，展示硬解（WebCodec）→软解（WASM）的「能播」上限。
// 与 FLV 主路径（mpegts.js）页面级隔离：独立实例、独立生命周期，方便整页抄录。
const H265WEB_BASE = `${import.meta.env.BASE_URL}h265web/`
const PLAYER_ID = 'flv-alt-stage'

const stageEl = useTemplateRef('stageEl')
const url = ref('https://mister-ben.github.io/videojs-flvjs/bbb.flv')
// 直播/回放选择：h265web.js 按流时长自动识别直播/回放（duration>0 即回放），选择框只切换悬浮条形态
const MODE_OPTIONS = [
  { value: 'live', label: '直播' },
  { value: 'vod', label: '回放' },
]
// 回放倍速（h265web.js set_playback_rate 取值）
const SPEED_OPTIONS = [
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 4, label: '4' },
  { value: 8, label: '8' },
  { value: 0.5, label: '1/2' },
  { value: 0.25, label: '1/4' },
  { value: 0.125, label: '1/8' },
]
const streamMode = ref('live')
const volume = ref(1)
const isMuted = ref(false)
const core = ref('')
const hasPlayer = ref(false)
const isPaused = ref(false)
const playSpeed = ref(1)
const curTime = ref(0)
const probeInfo = ref(null)
const capRows = ref([])

let player = null

const isVod = computed(() => streamMode.value === 'vod')

// 流时长（秒，video_probe_callback 回执 media_info.duration）：>0 才可跳播
const duration = computed(() => {
  const d = Number(probeInfo.value?.duration)
  return Number.isFinite(d) && d > 0 ? d : 0
})

// h265web.js 解码内核展示名（CORE_TYPE_* 常量见 h265web.js）
function coreLabel(coreId) {
  const labels = {
    auto: '自动',
    webcodec_hevc: 'WebCodec（硬解）',
    wasm_hevc: 'WASM（软解）',
    mse_hevc: 'MSE（video标签）',
    mse_hls: 'MSE（video标签）',
    mse_mpegts_new: 'MSE（video标签）',
    mse_videojs: 'MSE（video标签）',
    native_hls: '原生 HLS（video标签）',
  }
  return labels[coreId] ?? coreId
}

const decodeMode = computed(() => {
  const wanted = coreLabel(core.value || 'auto')
  const selected = probeInfo.value?.selectedCore
  return selected ? `${wanted}: ${coreLabel(selected)}` : wanted
})

const videoRows = computed(() => {
  const mi = probeInfo.value
  return [
    { label: '视频编码', value: formatVideoCodecName(mi?.codec) },
    { label: '分辨率', value: mi?.w > 0 ? `${mi.w} × ${mi.h}` : null },
    { label: '帧率', value: mi?.fps > 0 ? `${Math.round(mi.fps * 100) / 100} fps` : null },
    { label: '解码模式', value: decodeMode.value },
    { label: '音频编码', value: mi?.hasAudio ? formatAudioCodecName(mi?.audioCodecName) : '无音频' },
    { label: '音频采样率', value: mi?.sampleRate > 0 ? `${mi.sampleRate} Hz` : null },
  ]
})

function releasePlayer() {
  if (player) {
    player.release()
    player = null
  }
  hasPlayer.value = false
  isPaused.value = false
}

async function play() {
  const target = url.value.trim()
  if (!isAllowedStreamUrl(target)) {
    return
  }
  await loadScript(`${H265WEB_BASE}h265web.js`)
  releasePlayer()

  const instance = window.H265webjsPlayer()
  instance.video_probe_callback = (mediaInfo) => {
    probeInfo.value = { ...mediaInfo }
  }
  instance.on_play_finished = () => {
    isPaused.value = true
  }
  instance.on_play_time = (sec) => {
    // 回放进度回执（秒），驱动跳播滑杆
    curTime.value = sec
  }

  const width = stageEl.value?.clientWidth || 960
  const height = stageEl.value?.clientHeight || 540
  const buildOk = instance.build({
    player_id: PLAYER_ID,
    wasm_js_uri: `${H265WEB_BASE}h265web_wasm.js`,
    wasm_wasm_uri: `${H265WEB_BASE}h265web_wasm.wasm`,
    width,
    height,
    color: 'black',
    auto_play: true,
    ignore_audio: false,
    core: core.value || null,
  })
  if (!buildOk) {
    instance.release()
    return
  }
  player = instance
  hasPlayer.value = true
  probeInfo.value = null
  playSpeed.value = 1
  curTime.value = 0
  // 浏览器自动播放策略：在用户手势内通知播放器，再加载媒体。
  instance.notify_user_gesture()
  applyVoice()
  instance.load_media(target)
}

function togglePause() {
  if (!player) {
    return
  }
  if (isPaused.value) {
    player.notify_user_gesture()
    player.play()
    isPaused.value = false
  } else {
    player.pause()
    isPaused.value = true
  }
}

// ---------- 回放控制（h265web.js 能力：set_playback_rate 倍速、seek(秒) 跳播） ----------

function onModeChange() {
  // 切换直播/回放形态时重建实例，避免残留播放状态
  releasePlayer()
}

function onSpeedChange() {
  player?.set_playback_rate(Number(playSpeed.value))
}

function onSeekInput(event) {
  const target = Number(event.target.value)
  if (!player || !Number.isFinite(target)) {
    return
  }
  curTime.value = target
  player.seek(target)
}

function applyVoice() {
  // h265web.js 无独立静音接口，静音即 set_voice(0)，滑杆值仍保留
  player?.set_voice(isMuted.value ? 0 : Number(volume.value))
}

function applyVolume() {
  // 拖动音量滑杆自动取消静音
  isMuted.value = false
  applyVoice()
}

function toggleMute() {
  isMuted.value = !isMuted.value
  applyVoice()
}

function goFullscreen() {
  player?.fullScreen()
}

onMounted(async () => {
  capRows.value = await probeCapabilities()
})

onUnmounted(releasePlayer)
</script>

<template>
  <PlayerShell>
    <template #top>
      <select v-model="streamMode" class="select" @change="onModeChange">
        <option v-for="opt in MODE_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
      <input
        v-model="url"
        class="input url-input"
        type="text"
        placeholder="粘贴 HTTP-FLV / WS-FLV 播放地址（h265web.js 对照）"
        @keyup.enter="play"
      />
      <span class="field-label">解码内核</span>
      <select v-model="core" class="select">
        <option value="">Auto</option>
        <option value="webcodec_hevc">WebCodec（硬解）</option>
        <option value="wasm_hevc">WASM（软解）</option>
      </select>
      <button class="btn btn-primary" type="button" @click="play">播放</button>
      <button class="btn" type="button" :disabled="!hasPlayer" @click="releasePlayer">停止</button>
    </template>

    <template #stage>
      <div :id="PLAYER_ID" ref="stageEl" class="stage-host"></div>
    </template>

    <template #overlay>
      <!-- h265web.js 无截图/录像能力，不渲染对应按钮 -->
      <template v-if="isVod">
        <button class="btn" type="button" :disabled="!hasPlayer" @click="togglePause">
          {{ isPaused ? '播放' : '暂停' }}
        </button>
        <span class="field-label">倍速</span>
        <select v-model.number="playSpeed" class="select" :disabled="!hasPlayer" @change="onSpeedChange">
          <option v-for="opt in SPEED_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <span class="field-label">跳播</span>
        <input
          type="range"
          min="0"
          :max="duration"
          step="0.1"
          :value="curTime"
          :disabled="!hasPlayer || duration <= 0"
          @input="onSeekInput"
        />
        <span class="field-label">{{ formatDuration(curTime) }} / {{ formatDuration(duration) }}</span>
        <button class="btn" type="button" @click="toggleMute">
          {{ isMuted ? '取消静音' : '静音' }}
        </button>
        <span class="field-label">音量</span>
        <input v-model.number="volume" type="range" min="0" max="1" step="0.01" @input="applyVolume" />
        <button class="btn" type="button" :disabled="!hasPlayer" @click="goFullscreen">全屏</button>
      </template>
      <template v-else>
        <button class="btn" type="button" :disabled="!hasPlayer" @click="togglePause">
          {{ isPaused ? '播放' : '暂停' }}
        </button>
        <button class="btn" type="button" @click="toggleMute">
          {{ isMuted ? '取消静音' : '静音' }}
        </button>
        <span class="field-label">音量</span>
        <input v-model.number="volume" type="range" min="0" max="1" step="0.01" @input="applyVolume" />
        <button class="btn" type="button" :disabled="!hasPlayer" @click="goFullscreen">全屏</button>
      </template>
    </template>

    <template #info>
      <InfoPanel title="视频信息" :rows="videoRows" />
      <InfoPanel title="浏览器 / 解码能力" :rows="capRows" />
    </template>
  </PlayerShell>
</template>
