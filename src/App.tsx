import React, { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";

// --- Types ---
type Lane = 0 | 1 | 2;
type GameState = "MENU" | "PLAYING" | "GAME_OVER";
type Difficulty = "EASY" | "MEDIUM" | "HARD";
type ObstacleType = "BARREL" | "BARRIER" | "OIL" | "POTHOLE";

interface Obstacle {
  id: number;
  lane: Lane;
  y: number;
  type: ObstacleType;
}

// --- Constants & Config ---
const GAME_TICK_MS = 50;
const CAR_Y_POSITION = 80;
const CAR_HEIGHT = 15;
const COLLISION_THRESHOLD = 10;

const LEVELS = {
  EASY: { speed: 1.5, spawnRate: 1800 },
  MEDIUM: { speed: 2.5, spawnRate: 1200 },
  HARD: { speed: 3.5, spawnRate: 800 },
};

const OBSTACLE_TYPES: ObstacleType[] = ["BARREL", "BARRIER", "OIL", "POTHOLE"];

// --- Web Audio API Synth Engine ---
class RetroSoundEngine {
  ctx: AudioContext | null = null;

  init() {
    if (!this.ctx) {
      this.ctx = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  playMove() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playScore() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.setValueAtTime(1200, this.ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playCrash() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(100, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.5);
  }

  playStart() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(800, this.ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }
}

const sfx = new RetroSoundEngine();

// --- UI SVGs ---
const LeftArrowSVG = () => (
  <svg
    viewBox="0 0 24 24"
    width="1em"
    height="1em"
    fill="currentColor"
    style={{ verticalAlign: "middle", marginRight: "8px" }}
    xmlns="http://www.w3.org/2000/svg"
  >
    <polygon points="15,4 5,12 15,20" />
  </svg>
);

const RightArrowSVG = () => (
  <svg
    viewBox="0 0 24 24"
    width="1em"
    height="1em"
    fill="currentColor"
    style={{ verticalAlign: "middle", marginLeft: "8px" }}
    xmlns="http://www.w3.org/2000/svg"
  >
    <polygon points="9,4 19,12 9,20" />
  </svg>
);

// --- Realistic SVGs ---
const PlayerCarSVG = () => (
  <svg
    viewBox="0 0 100 200"
    width="100%"
    height="100%"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="metalPaint" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#b30000" />
        <stop offset="25%" stopColor="#ff3333" />
        <stop offset="50%" stopColor="#ffcccc" />
        <stop offset="75%" stopColor="#ff3333" />
        <stop offset="100%" stopColor="#800000" />
      </linearGradient>

      <linearGradient id="glass" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1c2430" />
        <stop offset="45%" stopColor="#2d3748" />
        <stop offset="50%" stopColor="#ffffff" stopOpacity="0.8" />
        <stop offset="55%" stopColor="#2d3748" />
        <stop offset="100%" stopColor="#1c2430" />
      </linearGradient>

      <linearGradient id="headlightGlow" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#eef" stopOpacity="1" />
        <stop offset="100%" stopColor="#eef" stopOpacity="0" />
      </linearGradient>

      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="15" stdDeviation="10" floodOpacity="0.7" />
      </filter>
    </defs>

    {/* Shadow */}
    <ellipse
      cx="50"
      cy="100"
      rx="45"
      ry="95"
      fill="rgba(0,0,0,0.6)"
      filter="url(#shadow)"
    />

    {/* Tires */}
    <rect x="8" y="30" width="14" height="35" rx="3" fill="#0a0a0a" />
    <rect x="78" y="30" width="14" height="35" rx="3" fill="#0a0a0a" />
    <rect x="8" y="140" width="14" height="35" rx="3" fill="#0a0a0a" />
    <rect x="78" y="140" width="14" height="35" rx="3" fill="#0a0a0a" />

    {/* Chassis Base */}
    <path
      d="M 22 25 L 78 25 L 88 100 L 82 180 L 18 180 L 12 100 Z"
      fill="#111"
    />

    {/* Main Body */}
    <path
      d="M 24 28 C 40 10, 60 10, 76 28 L 84 100 C 86 140, 80 175, 76 178 C 60 185, 40 185, 24 178 C 20 175, 14 140, 16 100 Z"
      fill="url(#metalPaint)"
    />

    {/* Hood Detail */}
    <path d="M 35 30 L 65 30 L 70 80 L 30 80 Z" fill="rgba(255,255,255,0.15)" />
    <line x1="50" y1="30" x2="50" y2="80" stroke="#ff6666" strokeWidth="1" />

    {/* Windshield */}
    <path
      d="M 26 85 C 40 75, 60 75, 74 85 L 80 115 L 20 115 Z"
      fill="url(#glass)"
    />

    {/* Rear Window */}
    <path
      d="M 32 150 C 45 145, 55 145, 68 150 L 74 130 L 26 130 Z"
      fill="url(#glass)"
    />

    {/* Roof */}
    <path d="M 28 115 L 72 115 L 68 130 L 32 130 Z" fill="url(#metalPaint)" />

    {/* Side Mirrors */}
    <path d="M 20 90 L 12 95 L 15 100 L 22 95 Z" fill="url(#metalPaint)" />
    <path d="M 80 90 L 88 95 L 85 100 L 78 95 Z" fill="url(#metalPaint)" />

    {/* Headlights & Light Beams */}
    <path d="M 24 28 L 32 25 L 34 32 L 22 32 Z" fill="#fff" />
    <path d="M 76 28 L 68 25 L 66 32 L 78 32 Z" fill="#fff" />
    <polygon points="22,25 34,25 44,-50 12,-50" fill="url(#headlightGlow)" />
    <polygon points="66,25 78,25 88,-50 56,-50" fill="url(#headlightGlow)" />

    {/* Taillights */}
    <path d="M 22 176 L 35 178 L 35 180 L 20 178 Z" fill="#ff0000" />
    <path d="M 78 176 L 65 178 L 65 180 L 80 178 Z" fill="#ff0000" />
    <rect x="42" y="178" width="16" height="2" fill="#ff0000" />
  </svg>
);

const ObstacleBarrelSVG = () => (
  <svg
    viewBox="0 0 100 100"
    width="100%"
    height="100%"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <radialGradient id="barrelGrad" cx="30%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#ffff00" />
        <stop offset="50%" stopColor="#ff5500" />
        <stop offset="100%" stopColor="#990000" />
      </radialGradient>
      <radialGradient id="whiteStripe" cx="30%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="80%" stopColor="#eeeeee" />
        <stop offset="100%" stopColor="#aaaaaa" />
      </radialGradient>
      <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="5" dy="10" stdDeviation="5" floodOpacity="0.8" />
      </filter>
    </defs>
    <circle
      cx="50"
      cy="50"
      r="38"
      fill="rgba(0,0,0,0.5)"
      filter="url(#dropShadow)"
    />
    <circle
      cx="50"
      cy="50"
      r="35"
      fill="url(#barrelGrad)"
      stroke="#ffcc00"
      strokeWidth="2"
    />
    <circle cx="50" cy="50" r="26" fill="url(#whiteStripe)" />
    <circle cx="50" cy="50" r="18" fill="url(#barrelGrad)" />
    <circle cx="50" cy="50" r="8" fill="#111" />
  </svg>
);

const ObstacleBarrierSVG = () => (
  <svg
    viewBox="0 0 100 100"
    width="100%"
    height="100%"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="concrete" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="50%" stopColor="#b0b0b0" />
        <stop offset="100%" stopColor="#606060" />
      </linearGradient>
      <linearGradient id="yellowPaint" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#ffff00" />
        <stop offset="100%" stopColor="#ffaa00" />
      </linearGradient>
      <filter id="barrierShadow">
        <feDropShadow dx="0" dy="12" stdDeviation="6" floodOpacity="0.9" />
      </filter>
    </defs>
    <rect
      x="15"
      y="30"
      width="70"
      height="40"
      rx="4"
      fill="#111"
      filter="url(#barrierShadow)"
    />
    <path
      d="M 15 35 L 85 35 L 80 65 L 20 65 Z"
      fill="url(#concrete)"
      stroke="#ffffff"
      strokeWidth="1"
    />
    <path d="M 20 35 L 80 35 L 75 45 L 25 45 Z" fill="#e0e0e0" />

    <rect
      x="30"
      y="50"
      width="40"
      height="10"
      fill="#ff0000"
      transform="skewX(-10)"
    />
    <rect
      x="35"
      y="50"
      width="10"
      height="10"
      fill="url(#yellowPaint)"
      transform="skewX(-10)"
    />
    <rect
      x="55"
      y="50"
      width="10"
      height="10"
      fill="url(#yellowPaint)"
      transform="skewX(-10)"
    />
  </svg>
);

const ObstacleOilSVG = () => (
  <svg
    viewBox="0 0 100 100"
    width="100%"
    height="100%"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <radialGradient id="oilSheen" cx="40%" cy="40%" r="60%">
        <stop offset="0%" stopColor="#00ffcc" stopOpacity="1" />
        <stop offset="30%" stopColor="#ff00ff" stopOpacity="0.9" />
        <stop offset="70%" stopColor="#111111" stopOpacity="0.9" />
        <stop offset="100%" stopColor="#000000" stopOpacity="0.95" />
      </radialGradient>
    </defs>
    <path
      d="M 50 15 C 75 10, 90 35, 80 60 C 70 85, 40 95, 20 75 C 0 55, 15 25, 35 20 C 40 18, 45 16, 50 15 Z"
      fill="#000"
      stroke="#00ffcc"
      strokeWidth="2"
    />
    <path
      d="M 50 15 C 75 10, 90 35, 80 60 C 70 85, 40 95, 20 75 C 0 55, 15 25, 35 20 C 40 18, 45 16, 50 15 Z"
      fill="url(#oilSheen)"
    />
    <circle cx="35" cy="40" r="8" fill="#ffffff" fillOpacity="0.4" />
    <circle cx="65" cy="55" r="5" fill="#ffffff" fillOpacity="0.2" />
  </svg>
);

const ObstaclePotholeSVG = () => (
  <svg
    viewBox="0 0 100 100"
    width="100%"
    height="100%"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <radialGradient id="holeDepth" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#000000" />
        <stop offset="60%" stopColor="#1a1a1a" />
        <stop offset="100%" stopColor="#444444" />
      </radialGradient>
    </defs>
    <path
      d="M 50 20 C 80 22, 85 50, 75 70 C 60 90, 30 85, 15 65 C 5 45, 20 18, 50 20 Z"
      fill="#222"
      stroke="#ff5500"
      strokeWidth="3"
    />
    <path
      d="M 52 25 C 75 28, 78 48, 70 65 C 58 82, 35 78, 22 62 C 12 45, 28 23, 52 25 Z"
      fill="url(#holeDepth)"
    />
    <path
      d="M 15 65 L 5 75 M 75 70 L 90 80 M 80 35 L 95 30 M 30 22 L 20 5"
      stroke="#ffaa00"
      strokeWidth="3"
      fill="none"
    />
  </svg>
);

// --- Component Map ---
const getObstacleComponent = (type: ObstacleType) => {
  switch (type) {
    case "BARREL":
      return <ObstacleBarrelSVG />;
    case "BARRIER":
      return <ObstacleBarrierSVG />;
    case "OIL":
      return <ObstacleOilSVG />;
    case "POTHOLE":
      return <ObstaclePotholeSVG />;
    default:
      return <ObstacleBarrelSVG />;
  }
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>("MENU");
  const [difficulty, setDifficulty] = useState<Difficulty>("MEDIUM");
  const [score, setScore] = useState<number>(0);
  const [carLane, setCarLane] = useState<Lane>(1);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);

  const [activeKey, setActiveKey] = useState<"LEFT" | "RIGHT" | null>(null);

  const stateRef = useRef({
    carLane,
    obstacles,
    gameState,
    difficulty,
    score,
  });

  useEffect(() => {
    stateRef.current = { carLane, obstacles, gameState, difficulty, score };
  }, [carLane, obstacles, gameState, difficulty, score]);

  useEffect(() => {
    if (gameState !== "PLAYING") return;

    let obstacleIdCounter = Date.now();
    const currentSettings = LEVELS[difficulty];

    const spawnObstacle = () => {
      const newLane = Math.floor(Math.random() * 3) as Lane;
      const newType =
        OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
      setObstacles((prev) => [
        ...prev,
        { id: obstacleIdCounter++, lane: newLane, y: -20, type: newType },
      ]);
    };

    const spawnInterval = setInterval(spawnObstacle, currentSettings.spawnRate);

    const gameTick = setInterval(() => {
      setObstacles((prev) => {
        const speed = LEVELS[stateRef.current.difficulty].speed;
        let newObstacles = prev.map((obs) => ({ ...obs, y: obs.y + speed }));

        const passedObstacles = newObstacles.filter((obs) => obs.y > 100);
        if (passedObstacles.length > 0) {
          setScore((s) => s + passedObstacles.length * 10);
          sfx.playScore();
        }
        newObstacles = newObstacles.filter((obs) => obs.y <= 100);

        const currentCarLane = stateRef.current.carLane;
        const hasCollision = newObstacles.some((obs) => {
          const inSameLane = obs.lane === currentCarLane;
          const overlappingY =
            obs.y + COLLISION_THRESHOLD > CAR_Y_POSITION &&
            obs.y < CAR_Y_POSITION + CAR_HEIGHT;
          return inSameLane && overlappingY;
        });

        if (hasCollision) {
          setGameState("GAME_OVER");
          sfx.playCrash();
        }

        return newObstacles;
      });
    }, GAME_TICK_MS);

    return () => {
      clearInterval(spawnInterval);
      clearInterval(gameTick);
    };
  }, [gameState, difficulty]);

  const moveLeft = useCallback(() => {
    if (gameState === "PLAYING") {
      setCarLane((prev) => {
        if (prev > 0) sfx.playMove();
        return prev > 0 ? ((prev - 1) as Lane) : 0;
      });
    }
  }, [gameState]);

  const moveRight = useCallback(() => {
    if (gameState === "PLAYING") {
      setCarLane((prev) => {
        if (prev < 2) sfx.playMove();
        return prev < 2 ? ((prev + 1) as Lane) : 2;
      });
    }
  }, [gameState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "a", "A", "d", "D"].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") {
        setActiveKey("LEFT");
        moveLeft();
      } else if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") {
        setActiveKey("RIGHT");
        moveRight();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") {
        setActiveKey((prev) => (prev === "LEFT" ? null : prev));
      } else if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") {
        setActiveKey((prev) => (prev === "RIGHT" ? null : prev));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [moveLeft, moveRight]);

  const startGame = (selectedDiff: Difficulty) => {
    sfx.init();
    sfx.playStart();
    setDifficulty(selectedDiff);
    setCarLane(1);
    setObstacles([]);
    setScore(0);
    setGameState("PLAYING");
  };

  const getLanePosition = (lane: Lane) => {
    if (lane === 0) return "16.66%";
    if (lane === 1) return "50%";
    return "83.33%";
  };

  return (
    <div className="app-container">
      <div className="header">
        <h2>
          SCORE: {score} <span className="diff-badge">{difficulty}</span>
        </h2>
      </div>

      <div className="board">
        <div className="asphalt-texture" />
        <div
          className="road-marker left-marker"
          style={{
            animationPlayState: gameState === "PLAYING" ? "running" : "paused",
          }}
        />
        <div
          className="road-marker right-marker"
          style={{
            animationPlayState: gameState === "PLAYING" ? "running" : "paused",
          }}
        />

        <div className="edge-line left-edge" />
        <div className="edge-line right-edge" />

        <div
          className="car player-car"
          style={{
            left: getLanePosition(carLane),
            top: `${CAR_Y_POSITION}%`,
            height: `${CAR_HEIGHT}%`,
          }}
        >
          <PlayerCarSVG />
        </div>

        {obstacles.map((obs) => (
          <div
            key={obs.id}
            className={`car obstacle-car ${obs.type === "OIL" || obs.type === "POTHOLE" ? "flat-obstacle" : ""}`}
            style={{
              left: getLanePosition(obs.lane),
              top: `${obs.y}%`,
              height: `${CAR_HEIGHT}%`,
            }}
          >
            {getObstacleComponent(obs.type)}
          </div>
        ))}

        {gameState === "MENU" && (
          <div className="overlay menu-glass">
            <h1 className="title-text">
              SOFTY
              <br />
              RACE
            </h1>
            <div className="menu-buttons">
              <button
                className="button btn-tech"
                onClick={() => startGame("EASY")}
              >
                EASY
              </button>
              <button
                className="button btn-tech"
                onClick={() => startGame("MEDIUM")}
              >
                MEDIUM
              </button>
              <button
                className="button btn-tech"
                onClick={() => startGame("HARD")}
              >
                HARD
              </button>
            </div>
          </div>
        )}

        {gameState === "GAME_OVER" && (
          <div className="overlay crash-glass">
            <h1 className="crashed">WRECKED</h1>
            <h2 className="final-score">FINAL SCORE: {score}</h2>
            <div className="menu-buttons">
              <button
                className="button btn-tech"
                onClick={() => startGame(difficulty)}
              >
                RESTART ({difficulty})
              </button>
              <button
                className="button btn-alt"
                onClick={() => setGameState("MENU")}
              >
                MAIN MENU
              </button>
            </div>
          </div>
        )}
      </div>
      {gameState === "PLAYING" && (
        <div className="controls">
          <div
            className={`control-btn ${activeKey === "LEFT" ? "active" : ""}`}
            onPointerDown={moveLeft}
          >
            <h3>
              <LeftArrowSVG /> STEER LEFT
            </h3>
          </div>
          <div
            className={`control-btn ${activeKey === "RIGHT" ? "active" : ""}`}
            onPointerDown={moveRight}
          >
            <h3>
              STEER RIGHT <RightArrowSVG />
            </h3>
          </div>
        </div>
      )}
    </div>
  );
}
