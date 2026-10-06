package com.shinian.pay.service

import android.app.Service
import android.content.Intent
import android.media.MediaPlayer
import android.os.IBinder
import android.util.Log
import com.shinian.pay.R
import com.shinian.pay.manager.AppConstants

/**
 * 循环播放一段无声音频，以提升进程优先级（Kotlin 版）。
 */
class PlayerMusicService : Service() {

    private var mMediaPlayer: MediaPlayer? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        if (AppConstants.DEBUG) Log.d(TAG, "$TAG---->onCreate,启动服务")
        mMediaPlayer = MediaPlayer.create(applicationContext, R.raw.service)?.apply {
            isLooping = true
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Thread { startPlayMusic() }.start()
        return START_STICKY
    }

    private fun startPlayMusic() {
        mMediaPlayer?.let {
            if (AppConstants.DEBUG) Log.d(TAG, "启动后台播放音乐")
            it.start()
        }
    }

    private fun stopPlayMusic() {
        mMediaPlayer?.let {
            if (AppConstants.DEBUG) Log.d(TAG, "关闭后台播放音乐")
            try {
                it.stop()
            } catch (ignored: IllegalStateException) {
            }
            // 释放底层资源（旧实现只 stop 不 release，MediaPlayer 及其音频资源泄漏）
            it.release()
            mMediaPlayer = null
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        stopPlayMusic()
        if (AppConstants.DEBUG) Log.d(TAG, "$TAG---->onDestroy,停止服务")
        // 修复：用户主动退出时不自我复活（与 DaemonService 同样的退出死循环问题）
        if (!AppConstants.IS_USER_EXIT) {
            startService(Intent(applicationContext, PlayerMusicService::class.java))
        }
    }

    companion object {
        private const val TAG = "PlayerMusicService"
    }
}