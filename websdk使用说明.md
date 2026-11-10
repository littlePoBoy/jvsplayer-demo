# websdk使用说明

## 1. 功能特性说明

### 1.1 简述
本文档主要对websdk使用说明

### 1.2 支持的格式

#### 1.2.1 音频编码格式

支持G711、AAC音频解码

#### 1.2.2 视频编码格式

支持H.264（AVC）<br/>支持H.265（HEVC）


### 1.3 浏览器兼容性

支持Chrome（85及以上）<br/>
支持火狐浏览器（82.0.3及以上）

### 1.4 支持的协议

目前仅支持JVMP私协播放

### 1.5 音频控制

音频控制：支持

### 1.6 视频下载

支持 

## 2. api接口及参数说明

### 2.1 直播

#### 2.1.1 引入sdk


```js
// 将public/websdk文件夹下的文件全部引入到项目中，在个人页面中引入如下js文件
<script src="JWebPlayer.bundle.js"></script>
```
**注意：SDK文件必须放到WEB服务器的root根目录下，即与index.html放在同级目录，或者在调用play方法时传入路径prefixPath参数**

#### 2.1.2 初始化

```js
let WebPlayer = JWebPlayer;              // 获取
options = {
    container: dom,     // 视频容器dom元素          必填   请参照demo使用，推荐div控件(不能是video标签或者canvas标签)
    prefixPath:,        // sdk路径                必填   请参照demo使用
	  decodeType:,        // 选择解码器类型           非必填  参照DECODE_TYPE定义：默认、wasm、webcodec、video标签,通常不用特别指定，除非业务场景需要
    loading_el_str: ,   // loading状态提示生成函数  非必填 请参照demo使用
    pauseing_el_str: ,  // 暂停状态提示生成函数      非必填  请参照demo使用
    msg_el_str:,        // 消息提示生成函数         非必填 请参照demo使用,此函数通过this.webplayer.ShowMsg(type，msg)调用， type用于指定具体的css样式，msg为提示内容
}
this.webplayer = new WebPlayer(options); // 实例化，此实例可以同时完成直播、对讲、回放、下载，不需要另行创建
```

#### 2.1.3 播放

```js
// 此接口为异步接口，返回Promise，开始直播或者回放，直播和回放共用此接口
this.webplayer.Play(
	{
		url:"ws://*******************",           // 播放地址   必填     请参照demo使用，webplayer根据url判断是直播、回放
        deviceName:"设备名称",                     // 设备名称   非必填
	}                            
)
```

#### 2.1.4 停止

```js
// 此接口为同步接口，无返回值，停止播放和推流，直播和回放共用此接口。直播模式下调用Stop接口，会将对讲一块关闭；回放模式下不会将下载关闭
// 接口调用后，会抛出停止完毕事件
this.webplayer.Stop()  
```

#### 2.1.5 全屏

```js
// 同步接口，无返回值， 视频画面的全屏(双击视频画面或者点击全屏按钮均可进入全拼模式)
this.webplayer.FullScreen();
// 注意webplayer同时支持ESC和双击退出全屏
```

#### 2.1.6 截图

```js
// 异步接口，返回Promise，截图，内部会自动保存(文件名称：快照20241206_100606.png)
options = {
    filename: "快照20241206_100606", // 图片名称，默认格式：快照20241206_100606
    format: "png",                   // 图片格式：png、jpeg、image，默认：png
    quality: 0,                      // 图片质量，number类型，png不适用
    type: "download"                 // 图片类型：download、base64、blob，默认：download。base64、blob下直接返回图片数据，不保存；download类型直接保存文件
}
// options非必填
this.webplayer.ScreenShot(options);
```

#### 2.1.7 播放器当前是否处于播放状态

```js
// 是否处于播放状态(内部对应的player是否创建，如果成功创建则处于播放状态，否则处于未播放状态)
this.webplayer.IsPlaying()    // true:处于播放状态(此时可能暂停)，false:未播放
```


#### 2.1.8 开始对讲

```js
// 异步接口，返回Promise
this.webplayer.StartTalk({
    url: "ws://*******************",           // 对讲地址   必填     请参照demo使用
}) 
```

#### 2.1.9 停止对讲


```js
// 同步接口，无返回值。此接口发送talk stop信令到平台，连接关闭后会抛出对讲停止成功事件
this.webplayer.StopTalk() 
```

#### 2.1.10 设置音量

```js
this.webplayer.SetVolume(vol);    // 设置扬声器音量：vol number 0 ~ 1数字。默认1.0，注意每次欧方前需要重新设置此数值，以免默认值和页面当前值不一致(尤其是不刷新页面多次不同视频时)
this.webplayer.SetMicVolume(vol); // 设置麦克风音量：vol number 0 ~ 1数字。默认0.8，注意每次对讲前需要重新设置此数值，以免默认值和页面当前值不一致
```

### 2.2 回放

#### 2.2.1 引入sdk

```js
<script src="JWebPlayer.bundle.js"></script>
 // 在js文件中引入录播进度条 JtimeLine 
 // 提示 JtimeLine.js 不是websdk内部文件，可在demo/src/js文件夹下找到；
 // 时间进度条可自己实现，无需引入JtimeLine.js
import JTimeLine from "./js/JtimeLine"; 
```

#### 2.2.2 初始化

#####  2.2.2.1  播放器初始化

```js

// 和直播相同

```


#####  2.2.2.2  回放进度条初始化

```js
 //提示 JtimeLine.js 不是websdk内部文件，可在demo/src/js文件夹下找到；
 //     时间进度条可自己实现，无需引入JtimeLine.js
this.jTimeLine = new JTimeLine();
this.jTimeLine.init({
    id: "canvas", 
    onChange: this.handleTimeChange  //滑动播放进度条时触发并返回滑动当前位置的时间戳
});
```

#### 2.2.3 播放

录播的视频播放需要播放URL

```js
this.webplayer.Play(
	{
		url:"ws://*******************",           // 播放地址                         必填
        deviceName: '设备名称'，                   // 用在错误提示显示上                非必填 
        prefixPath：'/',                          // sdk等文件相对根目录的位置 默认"/"  非必填 
		maxDecodedFrameNumInBuffer: 15,           // 视频解码后最大缓存帧数             非必填   直播默认5帧，回放默认15，视频解码后缓存不宜过大
		startTime: 0,                             // 回放相对于文件开始的偏移时间        非必填   播放mp4文件时使用
	}  
);

//录播时间进度条处理
//录播时间进度条处理需要播放列表（lsit）
 this.jTimeLine.getRecord(lsit);  // 回放返回的播放list
 this.jTimeLine.run({ time: parseInt(this.webplayer.GetCurTimestamp())}); // 进度条滚动

```


#### 2.2.4 暂停

```js
// 异步接口，返回Promise，此接口处理成功时会发出JV_WEBPLALYER_EVENT.VOD_PAUSING事件，通知外部暂停成功
this.webplayer.Pause()
```

#### 2.2.5 恢复

```js
// 异步接口，返回Promise
this.webplayer.Resume()
```

#### 2.2.6 seek播放

```js
// 异步接口，返回Promise
// timestamp: 必填，  number（unix时间戳，根据设备类型决定是否加上8小时）
// timedate:  非必填，string（设备时区的年月日时分秒）
this.webplayer.SetStartTime(timestamp, timedate)
```

#### 2.2.7 全屏

```js
// 和直播使用同一接口
this.webplayer.FullScreen();
```

#### 2.2.8 停止

```js
// 和直播使用同一接口
this.webplayer.Stop()  
```
#### 2.2.9 倍速

```js
// 异步接口，返回Promise
// speed: 必填，number（1, 2, 4, 8, 4, 2, 1, 0.5, 0.25, 0.125, 0.25, 0.5）
this.webplayer.SetSpeed(speed);
```

#### 2.2.10 截图

```js
// 和直播使用同一接口
// 参数说明 
// options {
//   type: 'blob'、'download'、'base64'，返回值类型
//   filename: 保存的文件名称
//   format: 'png' 'jpeg' 'webp'
//   
//}
this.webplayer.ScreenShot(options)  
```


#### 2.2.11 获取播放器当前状态

```js
// 是否处于播放状态(内部对应的player是否创建，如果成功创建则处于播放状态，否则处于未播放状态)
this.webplayer.IsPlaying()    // true:处于播放状态(此时可能暂停)，false:未播放
// 回放是否暂停
this.webplayer.IsPause()      //  true:处于暂停状态，false:未暂停(回放可能已经关闭)
```


#### 2.2.12 获取播放器播放当前帧的时间戳

```js
this.webplayer.GetCurTimestamp() //获取播放当前帧的时间戳
```

#### 2.2.13 开始录像

```js
// 异步接口，返回Promise。录像开始后会等待最新的I帧，每100M保存一个mp4文件；每一次切换音视频编解码参数也会导致保存一个mp4文件
options = {
    prefixName: "设备名称",          // 录像文件名称前缀，非必填， 录像文件名称:[recorder]设备名称_20241206151644-1.mp4，默认录像文件名称：[recorder]20241206151644-1.mp4   
    maxFileSize: 100 * 1024 * 1024, // 录像文件最大大小，非必填 单位Byte，默认100M，
}
// options非必填
this.webplayer.StartRecorde(options)
// 直播下也可以使用
```
#### 2.2.14 停止录像

```js
// 同步接口，无返回值
this.webplayer.StopRecorde()
// 直播下也可以使用
```

#### 2.2.15 开始下载

```js
// 异步接口，返回Promise，执行完成后会返回下载结束成功事件
this.webplayer.StartDownload({
    url: "ws://*******************", // 下载地址         必填    请参照demo使用
    prefixName: "设备名称",           // 录像文件名称前缀  非必填  录像文件名称:[recorder]设备名称_20241206151644-1.mp4，默认录像文件名称：[recorder]20241206151644-1.mp4   
    maxFileSize: 100 * 1024 * 1024,  // 录像文件最大大小，非必填，单位Byte，默认100M，
})
```

#### 2.2.16 停止下载

```js
// 异步接口，返回Promise
this.webplayer.StopDownload()
```

### 3 事件
JV_WEBPLALYER_EVENT定义的全部事件

#### 3.1 解码器加载成功
```js

/**
 * 事件名：codec_loaded
 * 描述：当wasm解码器加载成功后触发此事件，如果此事件未触发不能使用直播、对讲、回放功能
 * 例：
 * */ 
this.webplayer.on('codec_loaded')=>{
	//todo...
})

```

#### 3.2 媒体播放成功
```js

/**
 * 事件名：media_play_success
 * 描述：直播、回放Play成功后触发此事件。这个和Play接口返回的Promise有同样功能，可以选择一种使用
 * 例：
 * */ 
this.webplayer.on('media_play_success')=>{
	//todo...
})

```


#### 3.3 媒体播放结束完毕
```js

/**
 * 事件名：media_play_stopped
 * 描述：直播、回放Stop成功后触发此事件。Stop可以被外部主动调用，也可以由内部事件触发(例如直播、回放失败导致关闭)，不论谁调用都会触发此消息
 * 例：
 * */ 
this.webplayer.on('media_play_stopped')=>{
	//todo...
})

```

#### 3.4 直播播放失败
```js

/**
 * 事件名： live_failed
 * 描述：直播异常断开时触发此事件:网络异常、协议解析异常、收到异常断开事件等
 * 例：
 * */ 
this.webplayer.on('live_failed', msg)=>{
	//todo...
})

```

#### 3.5 回放播放失败
```js

/**
 * 事件名： vod_failed
 * 描述：回放异常断开时触发此事件:网络异常、协议解析异常、收到异常断开事件等
 * 例：
 * */ 
this.webplayer.on('vod_failed', msg)=>{
	//todo...
})

```

#### 3.6 回放暂停成功
```js

/**
 * 事件名： vod_pausing
 * 描述：回放暂停成功时触发此事件
 * 例：
 * */ 
this.webplayer.on('vod_pausing')=>{
	//todo...
})

```
#### 3.7 回放倍速成功
```js

/**
 * 事件名： vod_speed
 * 描述：回放倍速成功时触发此事件
 * 例：
 * */ 
this.webplayer.on('vod_speed', msg)=>{
	//todo...
})

```

#### 3.8 回放播放完毕
```js

/**
 * 事件名： vod_over
 * 描述：回放播放完毕的时候触发此事件，jvmp收到play over事件触发此事件
 * 例：
 * */ 
this.webplayer.on('vod_over')=>{
	//todo...
})

```

#### 3.9 回放进度
```js

/**
 * 事件名： vod_progress
 * 描述：回放进度更新,周期性消息，用于更新回放进度条
 * 例：
 * */ 
this.webplayer.on('vod_progress', msg)=>{
	//todo...
})

```

#### 3.10 下载失败
```js

/**
 * 事件名： download_failed
 * 描述：下载异常断开时触发此事件:网络异常、协议解析异常、收到异常断开事件等
 * 例：
 * */ 
this.webplayer.on('download_failed', msg)=>{
	//todo...
})

```

#### 3.11 下载完毕
```js

/**
 * 事件名： download_over
 * 描述：下载完毕的时候触发此事件，jvmp收到play over事件触发此事件
 * 例：
 * */ 
this.webplayer.on('download_over')=>{
	//todo...
})

```

#### 3.12 下载进度
```js

/**
 * 事件名： download_progress
 * 描述：下载进度更新,周期性消息，用于更新回放进度条
 * 例：
 * */ 
this.webplayer.on('download_progress', msg)=>{
	//todo...
})

```

#### 3.13 下载停止完成
```js

/**
 * 事件名： download_stopped
 * 描述：StopDownload成功后触发此事件。StopDownload可以被外部主动调用，也可以由内部事件触发(例如下载失败、下载完成调用StopDownload)，不论谁调用都会触发此消息
 * 例：
 * */ 
this.webplayer.on('download_stopped', msg)=>{
	//todo...
})

```

#### 3.14 对讲打开成功
```js

/**
 * 事件名： talk_started
 * 描述：对讲打开成功后触发此事件，jvmp需要收到talk start response
 * 例：
 * */ 
this.webplayer.on('talk_started')=>{
	//todo...
})

```

#### 3.15 对讲打开失败
```js

/**
 * 事件名： talk_failed
 * 描述：对讲信令响应失败或者启动失败时触发此消息
 * 例：
 * */ 
this.webplayer.on('talk_failed'， msg)=>{
	//todo...
})

```

#### 3.16 对讲关闭完成
```js

/**
 * 事件名： talk_stopped
 * 描述：StopTalk调用后，收到talk stop response或者连接直接断开触发此事件。StopTalk可以被外部调用，也可以被内部调用(对讲失败等)，不论谁调用都会触发此消息
 * 例：
 * */ 
this.webplayer.on('talk_stopped'， msg)=>{
	//todo...
})

```

#### 3.17 窗口可见性变更
```js

/**
 * 事件名： visibility_change
 * 描述：窗口被隐藏或者窗口由隐藏变为可见时触发。此事件内部会自动处理直播(暂停解码、清理缓存队列)、回放(暂停解码和渲染、发送暂停命令、显示暂停图标)和对讲(音频采样音量置为0)业务，外部仅需要处理外部相关业务即可
 * 例：
 * */ 
this.webplayer.on('visibility_change', isVisible)=>{
	//todo...
})

```

#### 3.18 文件录制完成
```js

/**
 * 事件名： recordered_one_file
 * 描述：录制完毕一个文件时触发此消息(直播或者回放关闭后，即使存在录制文件的保存也不会触发此消息)
 * 例：
 * */ 
this.webplayer.on('recordered_one_file', fileName)=>{
	//todo...
})

```
