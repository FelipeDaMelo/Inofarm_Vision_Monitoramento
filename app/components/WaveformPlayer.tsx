"use client";

import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';

export default function WaveformPlayer({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState('0:00');
  const [currentTime, setCurrentTime] = useState('0:00');

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#A59D92',
      progressColor: '#2C3E50',
      cursorColor: 'transparent',
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      height: 30,
      url: `/api/proxy?url=${encodeURIComponent(url)}`,
    });

    ws.on('ready', () => {
      setDuration(formatTime(ws.getDuration()));
    });

    ws.on('audioprocess', () => {
      setCurrentTime(formatTime(ws.getCurrentTime()));
    });

    ws.on('seeking', () => {
      setCurrentTime(formatTime(ws.getCurrentTime()));
    });

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => setIsPlaying(false));

    wavesurferRef.current = ws;

    return () => {
      ws.destroy();
    };
  }, [url]);

  const handlePlayPause = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };

  return (
    <div className="flex items-center gap-3 w-64 bg-slate-100/50 p-2 rounded-xl border border-slate-200/50 mb-1">
      <button 
        onClick={handlePlayPause}
        className="w-10 h-10 rounded-full bg-[#2C3E50] text-white flex items-center justify-center shrink-0 shadow-sm hover:scale-105 transition-transform"
      >
        {isPlaying ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
        ) : (
          <svg className="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        )}
      </button>
      
      <div className="flex-1 flex flex-col">
        <div ref={containerRef} className="w-full" />
        <div className="flex justify-between mt-1 px-1">
          <span className="text-[10px] text-slate-500 font-medium">{currentTime}</span>
          <span className="text-[10px] text-slate-500 font-medium">{duration}</span>
        </div>
      </div>
    </div>
  );
}
