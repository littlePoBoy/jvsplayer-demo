import { createRouter, createWebHashHistory } from 'vue-router'

// 一协议一页：路由与方案「页面清单」一一对应，便于开发者只收藏/抄录需要的一页。
const routes = [
  { path: '/', redirect: '/private' },
  {
    path: '/private',
    name: 'private',
    component: () => import('../views/PrivatePage.vue'),
    meta: { title: '私协（websdk）' },
  },
  {
    path: '/flv',
    name: 'flv',
    component: () => import('../views/FlvPage.vue'),
    meta: { title: 'FLV 主路径（mpegts.js）' },
  },
  {
    path: '/hls',
    name: 'hls',
    component: () => import('../views/HlsPage.vue'),
    meta: { title: 'HLS 主路径（hls.js）' },
  },
  {
    path: '/flv-alt',
    name: 'flv-alt',
    component: () => import('../views/FlvAltPage.vue'),
    meta: { title: 'FLV 对照（h265web.js）' },
  },
  {
    path: '/hls-alt',
    name: 'hls-alt',
    component: () => import('../views/HlsAltPage.vue'),
    meta: { title: 'HLS 对照（h265web.js）' },
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('../views/AboutPage.vue'),
    meta: { title: '说明' },
  },
]

const router = createRouter({
  // hash 路由：构建产物可直接静态部署（内网 nginx / 任意相对路径），无需服务端 rewrite。
  history: createWebHashHistory(),
  routes,
})

router.afterEach((to) => {
  document.title = `${to.meta.title} · JVS Web 播放参考 Demo`
})

export default router
