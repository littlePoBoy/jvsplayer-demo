import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base: './' 让构建产物可直接从任意相对路径部署（静态目录 / 内网 nginx）。
export default defineConfig({
  base: './',
  plugins: [vue()],
})
