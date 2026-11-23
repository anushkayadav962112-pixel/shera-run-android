import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FeatureModals } from './components/FeatureModals';
import { GameHUD } from './components/GameHUD';
import { HomeScreen } from './components/HomeScreen';
import { ProgressionModals } from './components/ProgressionModals';
import { GameOverModal, LoadingOverlay, PauseModal } from './components/RunOverlays';
import { LEVELS, WORLDS } from './data/gameData';
import { soundEngine } from './engine/audio';
import { SheraGameEngine } from './engine/GameEngine';
import { MonetizationService } from './services/monetization';
import { createDefaultSaveData, grantXp, loadSaveData, saveGameData } from './services/storage';
import {
  GameScreen,
  ModalType,
  PlayerSaveData,
  PowerUpType,
  RunHudState,
  RunResult,
  WorldId,
} from './types/game';

const INITIAL_HUD: RunHudState = {
  score: 0,
  distance: 0,
  runCoins: 0,
  runGems: 0,
  multiplier: 1,
  comboCount: 0,
  speed: 24,
  gameLevel: 1,
  levelProgress: 0,
  worldId: 'clouds',
  nextWorldId: 'lava',
  worldRotationSecondsRemaining: 120,
  activeTimers: {
    magnet: 0,
    shield: 0,
    rocket: 0,
    speedBoost: 0,
    doubleCoins: 0,
    invincibility: 0,
    hoverboard: 0,
    superJump: 0,
  },
  inventory: {
    magnet: 0,
    shield: 0,
    rocket: 0,
    speedBoost: 0,
    doubleCoins: 0,
    invincibility: 0,
    hoverboard: 0,
    superJump: 0,
  },
  shieldHitsRemaining: 0,
  nearMissText: null,
  bannerAlert: null,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<SheraGameEngine | null>(null);

  const [save, setSave] = useState<PlayerSaveData>(() => loadSaveData());
  const saveRef = useRef(save);
  saveRef.current = save;

  const [screen, setScreen] = useState<GameScreen>('loading');
  const screenRef = useRef<GameScreen>('loading');
  screenRef.current = screen;

  const [loadProgress, setLoadProgress] = useState(15);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const activeModalRef = useRef<ModalType>(null);
  activeModalRef.current = activeModal;

  const [hud, setHud] = useState<RunHudState>(INITIAL_HUD);
  const [runResult, setRunResult] = useState<RunResult | null>(null);

  // Touch swipe tracking refs
  const touchStartRef = useRef<{ x: number; y: number; handled: boolean } | null>(null);

  // Persist save changes & sync audio + 3D customization
  const updateSave = useCallback((updater: (prev: PlayerSaveData) => PlayerSaveData) => {
    setSave((prev) => {
      const next = updater(prev);
      saveGameData(next);
      return next;
    });
  }, []);

  useEffect(() => {
    soundEngine.setSettings(save.soundEnabled, save.musicEnabled);
    MonetizationService.setConsentStatus(save.adsConsentStatus);
    MonetizationService.syncBannerVisibility(
      screen === 'home' && !activeModal,
      save.removeAds || save.vipActive
    );
    engineRef.current?.setGraphicsQuality(save.graphicsQuality);
    engineRef.current?.applyCustomization(
      save.selectedWorld,
      save.selectedOutfit,
      save.selectedHoverboard,
      save.powerUpLevels,
      save.powerUpInventory,
      save.worldRotationEnabled
    );
  }, [
    save.soundEnabled,
    save.musicEnabled,
    save.graphicsQuality,
    save.selectedWorld,
    save.selectedOutfit,
    save.selectedHoverboard,
    save.powerUpLevels,
    save.powerUpInventory,
    save.worldRotationEnabled,
    save.adsConsentStatus,
    save.removeAds,
    save.vipActive,
    screen,
    activeModal,
  ]);

  // Mount Three.js Engine once
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const engine = new SheraGameEngine(container, {
      onHudUpdate: (nextHud) => {
        setHud(nextHud);
      },
      onConsumePowerUp: (type) => {
        updateSave((s) => ({
          ...s,
          powerUpInventory: {
            ...s.powerUpInventory,
            [type]: Math.max(0, (s.powerUpInventory[type] || 0) - 1),
          },
        }));
      },
      onMetricIncrement: (metric, amount = 1) => {
        updateSave((s) => ({
          ...s,
          totalJumps: metric === 'jumps' ? s.totalJumps + amount : s.totalJumps,
          totalSlides: metric === 'slides' ? s.totalSlides + amount : s.totalSlides,
          totalPowerUps: metric === 'powerups' ? s.totalPowerUps + amount : s.totalPowerUps,
          missions: s.missions.map((m) =>
            m.metric === metric && !m.claimed ? { ...m, progress: m.progress + amount } : m
          ),
        }));
      },
      onLevelUpMilestone: (clearedStage) => {
        const lvlDef = LEVELS[Math.min(LEVELS.length - 1, Math.max(0, clearedStage - 1))];
        updateSave((s) => {
          const nextStage = Math.min(150, Math.max(s.highestGameLevel, clearedStage + 1));
          const xpRes = grantXp(s, lvlDef.rewardXp * (s.vipActive ? 2 : 1));
          return {
            ...s,
            coins: s.coins + lvlDef.rewardCoins,
            gems: s.gems + lvlDef.rewardGems,
            highestGameLevel: nextStage,
            selectedGameLevel: nextStage,
            playerLevel: xpRes.playerLevel,
            xp: xpRes.xp,
            xpToNext: xpRes.xpToNext,
          };
        });
      },
      onGameOver: (rawResult) => {
        const curSave = saveRef.current;
        const isNewBest = rawResult.score > curSave.highScore;
        const vipMult = curSave.vipActive ? 2 : 1;
        const xpGain = rawResult.xpEarned * vipMult;

        updateSave((s) => {
          const xpRes = grantXp(s, xpGain);
          const prevWorldBest = s.worldHighScores[rawResult.worldId] || 0;
          return {
            ...s,
            coins: s.coins + rawResult.coins,
            gems: s.gems + rawResult.gems,
            highScore: Math.max(s.highScore, rawResult.score),
            worldHighScores: {
              ...s.worldHighScores,
              [rawResult.worldId]: Math.max(prevWorldBest, rawResult.score),
            },
            totalDistance: s.totalDistance + rawResult.distance,
            totalCoins: s.totalCoins + rawResult.coins,
            totalRuns: s.totalRuns + 1,
            playerLevel: xpRes.playerLevel,
            xp: xpRes.xp,
            xpToNext: xpRes.xpToNext,
            missions: s.missions.map((m) => {
              if (m.claimed) return m;
              if (m.metric === 'distance') return { ...m, progress: m.progress + rawResult.distance };
              if (m.metric === 'coins') return { ...m, progress: m.progress + rawResult.coins };
              if (m.metric === 'runs') return { ...m, progress: m.progress + 1 };
              if (m.metric === 'score') return { ...m, progress: Math.max(m.progress, rawResult.score) };
              return m;
            }),
          };
        });

        setRunResult({ ...rawResult, xpEarned: xpGain, isNewBest });
        setScreen('gameover');
        MonetizationService.recordCompletedRun();
        MonetizationService.triggerInterstitialIfAllowed(
          curSave.removeAds || curSave.vipActive
        ).catch(() => {});
      },
    });

    engineRef.current = engine;
    const s = saveRef.current;
    engine.applyCustomization(
      s.selectedWorld,
      s.selectedOutfit,
      s.selectedHoverboard,
      s.powerUpLevels,
      s.powerUpInventory,
      s.worldRotationEnabled
    );
    engine.setGraphicsQuality(s.graphicsQuality);
    engine.enterHome();
    soundEngine.preloadRewardClip();

    const t1 = window.setTimeout(() => setLoadProgress(65), 160);
    const t2 = window.setTimeout(() => {
      setLoadProgress(100);
      setScreen('home');
    }, 380);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      engine.dispose();
      engineRef.current = null;
      soundEngine.stopMusic();
    };
  }, [updateSave]);

  const startRun = useCallback((worldOverride?: WorldId, stageOverride?: number) => {
    soundEngine.init();
    soundEngine.playUiClick();
    const s = saveRef.current;
    const worldId = worldOverride || s.selectedWorld;
    const worldCfg = WORLDS.find((w) => w.id === worldId) || WORLDS[0];
    const stage =
      stageOverride ||
      Math.max(worldCfg.levelRange[0], Math.min(s.selectedGameLevel, worldCfg.levelRange[1]));

    setActiveModal(null);
    setRunResult(null);
    setScreen('playing');
    engineRef.current?.startRun(worldId, stage, s.powerUpInventory, s.worldRotationEnabled);
  }, []);

  const handlePause = useCallback(() => {
    if (screenRef.current === 'playing') {
      engineRef.current?.pause();
      setScreen('paused');
    }
  }, []);

  const handleResume = useCallback(() => {
    if (screenRef.current === 'paused') {
      engineRef.current?.resume();
      setScreen('playing');
    }
  }, []);

  const handleGoHome = useCallback(() => {
    soundEngine.playUiClick();
    setRunResult(null);
    setScreen('home');
    engineRef.current?.enterHome();
  }, []);

  // Keyboard Controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      soundEngine.init();

      if (screenRef.current === 'home' && !activeModalRef.current) {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          startRun();
        }
        return;
      }

      if (screenRef.current === 'playing') {
        switch (e.code) {
          case 'ArrowLeft':
          case 'KeyA':
            e.preventDefault();
            engineRef.current?.handleInput('left');
            break;
          case 'ArrowRight':
          case 'KeyD':
            e.preventDefault();
            engineRef.current?.handleInput('right');
            break;
          case 'ArrowUp':
          case 'KeyW':
          case 'Space':
            e.preventDefault();
            engineRef.current?.handleInput('jump');
            break;
          case 'ArrowDown':
          case 'KeyS':
            e.preventDefault();
            engineRef.current?.handleInput('slide');
            break;
          case 'Digit1':
            engineRef.current?.activatePowerUp('magnet', true);
            break;
          case 'Digit2':
            engineRef.current?.activatePowerUp('shield', true);
            break;
          case 'Digit3':
            engineRef.current?.activatePowerUp('rocket', true);
            break;
          case 'Digit4':
            engineRef.current?.activatePowerUp('speedBoost', true);
            break;
          case 'Digit5':
            engineRef.current?.activatePowerUp('invincibility', true);
            break;
          case 'Digit6':
            engineRef.current?.activatePowerUp('hoverboard', true);
            break;
          case 'Digit7':
            engineRef.current?.activatePowerUp('doubleCoins', true);
            break;
          case 'Digit8':
            engineRef.current?.activatePowerUp('superJump', true);
            break;
          case 'Escape':
          case 'KeyP':
            e.preventDefault();
            handlePause();
            break;
        }
      } else if (screenRef.current === 'paused') {
        if (e.code === 'Escape' || e.code === 'KeyP' || e.code === 'Space') {
          e.preventDefault();
          handleResume();
        }
      }
    };

    const onBlur = () => {
      saveGameData(saveRef.current);
      if (screenRef.current === 'playing') {
        handlePause();
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        saveGameData(saveRef.current);
        engineRef.current?.setAppBackgrounded(true);
        if (screenRef.current === 'playing') {
          setScreen('paused');
        }
      } else {
        engineRef.current?.setAppBackgrounded(false);
      }
    };

    const onPageHide = () => {
      saveGameData(saveRef.current);
      engineRef.current?.setAppBackgrounded(true);
      if (screenRef.current === 'playing') {
        setScreen('paused');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onBlur);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onPageHide);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onPageHide);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [startRun, handlePause, handleResume]);

  // Responsive Touch Swipe Gestures
  const onTouchStart = (e: React.TouchEvent) => {
    if (screen !== 'playing' || e.touches.length === 0) return;
    soundEngine.init();
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, handled: false };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (screen !== 'playing' || !touchStartRef.current || touchStartRef.current.handled) return;
    if (e.touches.length === 0) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    const threshold = 26;

    if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
      touchStartRef.current.handled = true;
      if (Math.abs(dx) > Math.abs(dy)) {
        engineRef.current?.handleInput(dx < 0 ? 'left' : 'right');
      } else {
        engineRef.current?.handleInput(dy < 0 ? 'jump' : 'slide');
      }
    }
  };

  const onTouchEnd = () => {
    touchStartRef.current = null;
  };

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-[#060914]"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Isolated WebGL 3D Viewport */}
      <div ref={canvasMountRef} className="fixed inset-0 z-0" />

      {screen === 'loading' && <LoadingOverlay progress={loadProgress} />}

      {screen === 'home' && (
        <HomeScreen
          save={save}
          onPlay={() => startRun()}
          onOpenModal={(m) => {
            soundEngine.init();
            soundEngine.playUiClick();
            setActiveModal(m);
          }}
        />
      )}

      {screen === 'playing' && (
        <GameHUD
          save={save}
          hud={hud}
          onPause={handlePause}
          onUsePowerUp={(type: PowerUpType) => engineRef.current?.activatePowerUp(type, true)}
          onAction={(act) => engineRef.current?.handleInput(act)}
        />
      )}

      {screen === 'paused' && (
        <PauseModal
          save={save}
          onResume={handleResume}
          onRestart={() => startRun()}
          onHome={handleGoHome}
          onToggleSound={() => updateSave((s) => ({ ...s, soundEnabled: !s.soundEnabled }))}
          onToggleMusic={() => updateSave((s) => ({ ...s, musicEnabled: !s.musicEnabled }))}
        />
      )}

      {screen === 'gameover' && runResult && (
        <GameOverModal
          result={runResult}
          save={save}
          onRestart={() => startRun()}
          onHome={handleGoHome}
          onReviveWithCoins={(coinCost) => {
            if (save.coins < coinCost) return;
            updateSave((s) => ({
              ...s,
              coins: s.coins - coinCost,
              coinContinuesTotal: s.coinContinuesTotal + 1,
              revivesUsedTotal: s.revivesUsedTotal + 1,
            }));
            setRunResult(null);
            setScreen('playing');
            engineRef.current?.revive('coin');
          }}
          onReviveWithGems={() => {
            const cost = 10 * (runResult.revivedCount + 1);
            if (save.gems < cost) return;
            updateSave((s) => ({
              ...s,
              gems: s.gems - cost,
              revivesUsedTotal: s.revivesUsedTotal + 1,
            }));
            setRunResult(null);
            setScreen('playing');
            engineRef.current?.revive('gem');
          }}
          onReviveViaAdSdk={() => {
            if (runResult.adRevivedCount >= 1) return;
            updateSave((s) => ({
              ...s,
              revivesUsedTotal: s.revivesUsedTotal + 1,
            }));
            setRunResult(null);
            setScreen('playing');
            engineRef.current?.revive('ad');
          }}
          onDoubleRunCoinsViaAd={(bonusCoins) => {
            if (bonusCoins <= 0) return;
            updateSave((s) => ({
              ...s,
              coins: s.coins + bonusCoins,
              totalCoins: s.totalCoins + bonusCoins,
            }));
          }}
        />
      )}

      {/* Home Modals */}
      {screen === 'home' && activeModal && (
        <>
          <ProgressionModals
            modal={activeModal}
            save={save}
            onClose={() => {
              soundEngine.playUiClick();
              setActiveModal(null);
            }}
            onUpdateSave={updateSave}
            onStartStage={(worldId, stage) => startRun(worldId, stage)}
          />
          <FeatureModals
            modal={activeModal}
            save={save}
            onClose={() => {
              soundEngine.playUiClick();
              setActiveModal(null);
            }}
            onOpenModal={(m) => setActiveModal(m)}
            onUpdateSave={updateSave}
            onSelectWorldAndPlay={(worldId) => {
              updateSave((s) => ({ ...s, selectedWorld: worldId }));
              startRun(worldId);
            }}
            onResetSave={() => {
              const fresh = createDefaultSaveData();
              saveGameData(fresh);
              setSave(fresh);
            }}
          />
        </>
      )}

      {/* Optional Dev Preview Banner Slot (Only shown when explicitly enabled in Settings) */}
      {save.adTestBannerEnabled && screen === 'home' && !activeModal && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 bg-slate-950/95 border border-amber-400/60 px-4 py-1 text-[10px] font-bold text-amber-200 rounded-t-lg">
          AdMob Banner Integration Slot (320×50) — Pending Android SDK Bridge
        </div>
      )}
    </div>
  );
}
