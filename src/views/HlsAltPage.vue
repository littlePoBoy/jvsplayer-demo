<script setup>
import { computed, onMounted, onUnmounted, ref, useTemplateRef } from 'vue'
import PlayerShell from '../components/PlayerShell.vue'
import InfoPanel from '../components/InfoPanel.vue'
import { loadScript } from '../utils/scriptLoader.js'
import { probeCapabilities } from '../utils/capability.js'
import { isAllowedStreamUrl } from '../utils/url.js'
import { formatVideoCodecName, formatAudioCodecName } from '../utils/format.js'

// HLS 对照页（方案 B）：h265web.js，展示硬解（WebCodec）→软解（WASM）的「能播」上限。
// 与 HLS 主路径（hls.js）页面级隔离：独立实例、独立生命周期，方便整页抄录。
//（与 FLV 对照页有意重复：「一协议一页」是架构决策，不做公共 Facade。）
const H265WEB_BASE = `${import.meta.env.BASE_URL}h265web/`
const PLAYER_ID = 'hls-alt-stage'

const stageEl = useTemplateRef('stageEl')
const url = ref('')
const volume = ref(1)
const isMuted = ref(false)
const core = ref('')
const hasPlayer = ref(false)
const isPaused = ref(false)
const probeInfo = ref(null)
const capRows = ref([])

let player = null

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
      <input
        v-model="url"
        class="input url-input"
        type="text"
        placeholder="粘贴 HLS 播放地址（.m3u8，h265web.js 对照）"
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

    <template #info>
      <InfoPanel title="视频信息" :rows="videoRows" />
      <InfoPanel title="浏览器 / 解码能力" :rows="capRows" />
    </template>
  </PlayerShell>
</template>
