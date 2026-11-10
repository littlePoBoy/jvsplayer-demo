import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

const OPENAPI_BASE_URL = '/webplayer'
const DEFAULT_OPENAPI_PROXY_TARGET = 'https://apitest.cloudsee.com:6443'

// base: './' 让构建产物可直接从任意相对路径部署（静态目录 / 内网 nginx）。
// 开发时代理目标只在 vite 进程内使用，不注入到前端包。复制 .env.example 为 .env 可改目标。
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'OPENAPI_')
  const proxyTarget = env.OPENAPI_PROXY_TARGET || DEFAULT_OPENAPI_PROXY_TARGET

  return {
    base: './',
    plugins: [vue()],
    define: {
      __OPENAPI_BASE_URL__: JSON.stringify(OPENAPI_BASE_URL),
    },
    server: {
      proxy: {
        [OPENAPI_BASE_URL]: {
          target: proxyTarget,
          changeOrigin: true,
          // 测试环境证书不走系统信任链，开发代理跳过校验。
          secure: false,
          rewrite: (path) => path.replace(/^\/webplayer/, ''),
        },
      },
    },
  }
})
