/**
 * 私协页冒烟回归测试。
 * 背景：PlaybackTimeline 曾用 TS 元组写法 defineEmits({ seek: [timestamp] })，
 * 纯 JS 下模块求值即抛 ReferenceError，导致私协页路由整页打不开。
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PrivatePage from './PrivatePage.vue'

// 单测环境不加载外部脚本（websdk），桩掉网络侧依赖；页面结构与控件逻辑照常断言。
vi.mock('../utils/scriptLoader.js', () => ({
  loadScript: () => Promise.reject(new Error('单测环境跳过 websdk 加载')),
}))

// happy-dom 不实现媒体能力 API；探测逻辑依赖它，这里补齐环境缺口。
if (!HTMLMediaElement.prototype.canPlayType) {
  HTMLMediaElement.prototype.canPlayType = () => ''
}

describe('PrivatePage', () => {
  it('正常打开并渲染播放器骨架与回放进度条', () => {
    // Arrange & Act
    const wrapper = mount(PrivatePage)

    // Assert
    expect(wrapper.find('.player-page').exists()).toBe(true)
    expect(wrapper.find('.stage-host').exists()).toBe(true)
    // PlaybackTimeline 能渲染 = 私协页模块求值未再崩溃
    expect(wrapper.find('.timeline').exists()).toBe(true)
  })

  it('解码器未就绪前播放按钮禁用', () => {
    // Arrange & Act
    const wrapper = mount(PrivatePage)

    // Assert
    const playButton = wrapper
      .findAll('button')
      .find((button) => button.text() === '播放')
    expect(playButton).toBeDefined()
    expect(playButton.attributes('disabled')).toBeDefined()
  })
})
