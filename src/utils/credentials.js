import { ref, watch } from 'vue'

// 平台取流凭据（AccessToken / 设备 SN / 通道 ID）：模块级单例 + localStorage 持久化。
// 私协页直播取址（StreamSourceBar）与回放录像查询（RecordSourceBar）共用，一处输入两处生效。
const STORAGE_KEYS = {
  token: 'jvsplayer.stream-source.token',
  deviceSn: 'jvsplayer.stream-source.device-sn',
  channelId: 'jvsplayer.stream-source.channel-id',
}

export const token = ref(localStorage.getItem(STORAGE_KEYS.token) ?? '')
export const deviceSn = ref(localStorage.getItem(STORAGE_KEYS.deviceSn) ?? '')
export const channelId = ref(localStorage.getItem(STORAGE_KEYS.channelId) ?? '')

watch(token, (value) => localStorage.setItem(STORAGE_KEYS.token, value))
watch(deviceSn, (value) => localStorage.setItem(STORAGE_KEYS.deviceSn, value))
watch(channelId, (value) => localStorage.setItem(STORAGE_KEYS.channelId, value))
