import { useRef, useState } from 'react';
import { Link, NavLink } from 'react-router';
import logo from '../../images/logo.png';
import musicTrack from '../../audio/bg-music.mp3';

export function Header() {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState('');

  async function toggleMusic() {
    const player = audio.current;
    if (!player) return;
    if (!player.paused) {
      player.pause();
      return;
    }
    try {
      await player.play();
      setStatus('');
    } catch {
      if (player.paused) setStatus('目前無法播放背景音樂。');
    }
  }

  return (
    <header className="site-header">
      <Link to="/" className="logo">
        <img src={logo} alt="" className="logo-icon" />
        <span>溫馨小食堂</span>
      </Link>

      <nav className="nav" aria-label="主要導覽">
        <NavLink to="/" end>菜單</NavLink>
        <NavLink to="/game">折扣遊戲</NavLink>
        <NavLink to="/orders">訂單紀錄</NavLink>
        <NavLink to="/about">關於</NavLink>
      </nav>

      <button type="button" id="music-toggle" className="glow-btn" aria-pressed={playing} onClick={toggleMusic}>
        背景音樂
      </button>
      <audio ref={audio} src={musicTrack} loop preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
      <p className="visually-hidden" role="status">{status}</p>
    </header>
  );
}
