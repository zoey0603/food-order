import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { DAILY_LIMIT, formatPrice, ROUND_SECONDS, scoreDiscount } from '../domain/orderRules';
import { useOrder } from '../state/OrderContext';

type Phase = 'idle' | 'starting' | 'playing';

interface ActiveRound {
  deadline: number;
  score: number;
  seconds: number;
}

function randomPosition() {
  return { left: Math.random() * 100 + '%', top: Math.random() * 100 + '%' };
}

export function DiscountGame() {
  const { state, ready, canPlay, beginGame, gameResult, saveGameResult, retryGameResult, clearGameResult } = useOrder();
  const [phase, setPhase] = useState<Phase>('idle');
  const [score, setScore] = useState(0);
  const [seconds, setSeconds] = useState(ROUND_SECONDS);
  const [position, setPosition] = useState({ left: '0%', top: '0%' });
  const [startError, setStartError] = useState('');
  const round = useRef<ActiveRound | null>(null);
  const pending = useRef(false);
  const mounted = useRef(false);
  const target = useRef<HTMLButtonElement>(null);
  const start = useRef<HTMLButtonElement>(null);
  const status = useRef<HTMLParagraphElement>(null);
  const remaining = DAILY_LIMIT - state.game.plays;
  const result = phase === 'idle' ? gameResult : null;
  const disabled = !ready || !canPlay || phase !== 'idle' || result?.status === 'saving'
    || (remaining === 0 && result?.status !== 'retry');

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const active = round.current;
      round.current = null;
      // A background tab may delay the timer. Credit a finished round on route exit.
      if (active && performance.now() >= active.deadline) void saveGameResult(active.score);
    };
  }, [saveGameResult]);

  const endRound = useCallback(() => {
    const active = round.current;
    if (!active) return;
    round.current = null;
    setSeconds(0);
    pending.current = false;
    setPhase('idle');
    void saveGameResult(active.score);
  }, [saveGameResult]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const timer = window.setInterval(() => {
      const active = round.current;
      if (!active) return;
      const left = Math.max(0, Math.ceil((active.deadline - performance.now()) / 1000));
      if (left === 0) {
        void endRound();
      } else if (left !== active.seconds) {
        active.seconds = left;
        setSeconds(left);
        setPosition(randomPosition());
      }
    }, 100);

    return () => window.clearInterval(timer);
  }, [phase, endRound]);

  const message = phase === 'playing' ? '遊戲開始！點擊飯糰，或用 Enter、空白鍵得分。'
    : startError ? startError
    : result?.status === 'retry' ? `本局得到 ${result.score} 分。暫時無法儲存折扣，可重試且不扣遊戲次數。${result.recoverable ? '' : '重新整理前請先重試。'}`
    : result?.status === 'saved' ? `本局得到 ${result.score} 分，折 ${formatPrice(scoreDiscount(result.score))}。目前可用最高折扣為 ${formatPrice(state.game.bestDiscount)}。`
    : '';

  useEffect(() => {
    const focused = document.activeElement;
    if (focused !== document.body && focused !== start.current && focused !== target.current) return;
    if (phase === 'playing') target.current?.focus({ preventScroll: true });
    else if (phase === 'idle' && message) {
      (start.current?.disabled ? status.current : start.current)?.focus({ preventScroll: true });
    }
  }, [phase, message]);

  async function startRound() {
    if (disabled || pending.current) return;
    pending.current = true;
    setPhase('starting');
    setStartError('');
    const result = await beginGame();
    if (!mounted.current) return;

    if (!result.ok || !result.value) {
      pending.current = false;
      setStartError(result.ok ? '今日遊戲次數已用完。' : '目前無法儲存開局，請重試。');
      setPhase('idle');
      return;
    }

    round.current = { deadline: performance.now() + ROUND_SECONDS * 1000, score: 0, seconds: ROUND_SECONDS };
    setSeconds(ROUND_SECONDS);
    setScore(0);
    setPosition(randomPosition());
    clearGameResult();
    setPhase('playing');
  }

  function hitTarget() {
    const active = round.current;
    if (!active) return;
    if (performance.now() >= active.deadline) {
      void endRound();
      return;
    }
    active.score++;
    setScore(active.score);
    setPosition(randomPosition());
  }

  const startLabel = phase === 'starting' ? '準備遊戲中'
    : phase === 'playing' ? '遊戲進行中'
    : result?.status === 'saving' ? '儲存結果中'
    : result?.status === 'retry' ? '重試儲存結果'
    : remaining === 0 ? '今日次數已用完'
    : '開始遊戲';

  return (
    <div className="page-container slide-in">
      <h1 tabIndex={-1}>折扣小遊戲</h1>
      <p className="hint" id="game-rules">
        在 10 秒內點擊飯糰，或用 Enter、空白鍵得分。每分折 NT$5，上限 NT$100。
        每天可玩 3 次，結帳會使用目前最高折扣。
      </p>

      <div className="game-panel">
        <div className="game-stats">
          <span>時間 <span id="time-left">{result ? 0 : seconds}</span> 秒</span>
          <span>分數 <span id="score">{result?.score ?? score}</span></span>
          <span>可用折扣 <span id="current-discount">{formatPrice(state.game.bestDiscount)}</span></span>
          <span>今日剩餘 <span id="remaining-plays">{ready ? remaining : '…'}</span> 次</span>
        </div>

        <button ref={start} type="button" id="start-game" className="glow-btn" aria-describedby="game-rules" disabled={disabled} onClick={() => {
          if (disabled || pending.current) return;
          if (result?.status === 'retry') void retryGameResult();
          else void startRound();
        }}>
          {startLabel}
        </button>
        <div id="game-area">
          <div className="target-travel">
            {phase === 'playing' && (
              <button
                ref={target}
                type="button"
                id="target"
                className="target"
                style={{ '--target-left': position.left, '--target-top': position.top } as CSSProperties}
                aria-label="點擊飯糰得分"
                onClick={hitTarget}
                onKeyDown={event => {
                  if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
                }}
              >
                🍙
              </button>
            )}
          </div>
        </div>

        <p ref={status} className="game-message" role="status" tabIndex={-1}>
          {ready && !canPlay ? '無法儲存遊戲紀錄，請允許瀏覽器儲存資料後重新整理。' : message}
        </p>
        <div className="game-back-links"><Link to="/" className="back-link">回到菜單</Link></div>
      </div>
    </div>
  );
}
