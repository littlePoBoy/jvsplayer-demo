import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const OPENAPI_BASE_URL = '/openapi'
const OPENAPI_PROXY_TARGET = 'https://192.168.117.4:7443'

// base: './' 让构建产物可直接从任意相对路径部署（静态目录 / 内网 nginx）。
export default defineConfig({
  base: './',
  plugins: [vue()],
  define: {
    __OPENAPI_BASE_URL__: JSON.stringify(OPENAPI_BASE_URL),
  },
  server: {
    proxy: {
      [OPENAPI_BASE_URL]: {
        target: OPENAPI_PROXY_TARGET,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/openapi/, ''),
      },
    },
  },
})
