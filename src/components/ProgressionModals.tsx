import React, { useState } from 'react';
import { Check, Crown, Globe2, Lock, Sparkles, UploadCloud, X, Zap } from 'lucide-react';
import {
  CHARACTER_OUTFITS,
  HOVERBOARDS,
  LEVELS,
  POWERUP_INFO,
  WORLDS,
} from '../data/gameData';
import { IAP_PRODUCTS, MonetizationService } from '../services/monetization';
import { ModalType, PlayerSaveData, PowerUpType, WorldId } from '../types/game';
import { CoinIcon, GemIcon, PowerUpIcon } from './SheraBadges';

interface ModalShellProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}

export const ModalShell: React.FC<ModalShellProps> = ({ title, subtitle, onClose, children }) => (
  <div className="fixed inset-0 z-40 bg-slate-950/84 flex items-center justify-center safe-area-frame">
    <div className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-3xl bg-[#0b132b] border-2 border-amber-400/75 shadow-[0_16px_48px_rgba(0,0,0,0.85)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-[#132248] via-[#192b59] to-[#132248] border-b border-amber-400/40">
        <div>
          <h2 className="text-lg sm:text-xl font-black tracking-wide text-amber-300">{title}</h2>
          {subtitle && <p className="text-[11px] text-slate-300">{subtitle}</p>}
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="w-11 h-11 rounded-full bg-slate-900/90 border border-slate-600 flex items-center justify-center text-slate-200 hover:border-amber-300 hover:text-amber-300 transition shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto custom-scroll p-4 sm:p-5">{children}</div>
    </div>
  </div>
);

interface ProgressionModalsProps {
  modal: ModalType;
  save: PlayerSaveData;
  onClose: () => void;
  onUpdateSave: (updater: (prev: PlayerSaveData) => PlayerSaveData) => void;
  onStartStage: (worldId: WorldId, stage: number) => void;
}

export const ProgressionModals: React.FC<ProgressionModalsProps> = ({
  modal,
  save,
  onClose,
  onUpdateSave,
  onStartStage,
}) => {
  const [shopTab, setShopTab] = useState<'powerups' | 'upgrades' | 'store'>('powerups');
  const [notice, setNotice] = useState<string | null>(null);

  if (modal === 'characters') {
    return (
      <ModalShell
        title="SHERA ROYAL WARDROBE"
        subtitle="White Lion King & Optional Royal Suits"
        onClose={onClose}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CHARACTER_OUTFITS.map((outfit) => {
            const unlocked = save.unlockedOutfits.includes(outfit.id);
            const equipped = save.selectedOutfit === outfit.id;
            const canCoins = save.coins >= outfit.costCoins;
            const canGems = save.gems >= outfit.costGems;
            const suitHex = `#${outfit.suitColor.toString(16).padStart(6, '0')}`;
            const trimHex = `#${outfit.trimColor.toString(16).padStart(6, '0')}`;

            return (
              <div
                key={outfit.id}
                className={`rounded-2xl p-4 border-2 transition ${
                  equipped
                    ? 'bg-sky-950/75 border-amber-400'
                    : 'bg-slate-900/90 border-slate-700/80'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl border-2 flex items-center justify-center shadow-inner"
                      style={{ backgroundColor: suitHex, borderColor: trimHex }}
                    >
                      <Crown className="w-6 h-6" style={{ color: trimHex }} />
                    </div>
                    <div>
                      <h3 className="font-black text-white text-sm sm:text-base">{outfit.name}</h3>
                      <p className="text-[11px] text-slate-400">{outfit.subtitle}</p>
                    </div>
                  </div>
                  {equipped && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black">
                      EQUIPPED
                    </span>
                  )}
                </div>

                <div className="mt-3 text-xs font-bold text-emerald-300">{outfit.perkText}</div>

                <div className="mt-3 flex gap-2">
                  {unlocked ? (
                    <button
                      type="button"
                      disabled={equipped}
                      onClick={() =>
                        onUpdateSave((s) => ({ ...s, selectedOutfit: outfit.id }))
                      }
                      className={`w-full py-2 rounded-xl font-extrabold text-xs transition ${
                        equipped
                          ? 'bg-slate-800 text-slate-400 cursor-default'
                          : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                      }`}
                    >
                      {equipped ? 'Active Suit' : 'Equip Suit'}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={!canCoins}
                        onClick={() =>
                          onUpdateSave((s) => ({
                            ...s,
                            coins: s.coins - outfit.costCoins,
                            unlockedOutfits: [...s.unlockedOutfits, outfit.id],
                            selectedOutfit: outfit.id,
                          }))
                        }
                        className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl font-extrabold text-xs ${
                          canCoins
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        <CoinIcon className="w-3.5 h-3.5" />
                        <span>{outfit.costCoins.toLocaleString()}</span>
                      </button>
                      <button
                        type="button"
                        disabled={!canGems}
                        onClick={() =>
                          onUpdateSave((s) => ({
                            ...s,
                            gems: s.gems - outfit.costGems,
                            unlockedOutfits: [...s.unlockedOutfits, outfit.id],
                            selectedOutfit: outfit.id,
                          }))
                        }
                        className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl font-extrabold text-xs ${
                          canGems
                            ? 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        <GemIcon className="w-3.5 h-3.5" />
                        <span>{outfit.costGems}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ModalShell>
    );
  }

  if (modal === 'hoverboards') {
    return (
      <ModalShell
        title="ROYAL HOVERBOARDS"
        subtitle="Ride in Style & Survive One Obstacle Crash"
        onClose={onClose}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {HOVERBOARDS.map((board) => {
            const unlocked = save.unlockedHoverboards.includes(board.id);
            const equipped = save.selectedHoverboard === board.id;
            const canCoins = save.coins >= board.costCoins;
            const canGems = save.gems >= board.costGems;
            const glowHex = `#${board.glowColor.toString(16).padStart(6, '0')}`;

            return (
              <div
                key={board.id}
                className={`rounded-2xl p-4 border-2 ${
                  equipped ? 'bg-sky-950/75 border-cyan-400' : 'bg-slate-900/90 border-slate-700/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center border-2"
                      style={{ borderColor: glowHex, backgroundColor: '#0f172a' }}
                    >
                      <Zap className="w-6 h-6" style={{ color: glowHex }} />
                    </div>
                    <div>
                      <h3 className="font-black text-white text-sm">{board.name}</h3>
                      <p className="text-[11px] text-slate-400">{board.subtitle}</p>
                    </div>
                  </div>
                  {equipped && (
                    <span className="px-2 py-0.5 rounded-full bg-cyan-400 text-slate-950 text-[10px] font-black">
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-xs font-bold text-cyan-300 mt-3">{board.perkText}</p>
                <div className="mt-3 flex gap-2">
                  {unlocked ? (
                    <button
                      type="button"
                      disabled={equipped}
                      onClick={() =>
                        onUpdateSave((s) => ({ ...s, selectedHoverboard: board.id }))
                      }
                      className={`w-full py-2 rounded-xl font-extrabold text-xs ${
                        equipped
                          ? 'bg-slate-800 text-slate-400'
                          : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950'
                      }`}
                    >
                      {equipped ? 'Equipped' : 'Equip Hoverboard'}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={!canCoins}
                        onClick={() =>
                          onUpdateSave((s) => ({
                            ...s,
                            coins: s.coins - board.costCoins,
                            unlockedHoverboards: [...s.unlockedHoverboards, board.id],
                            selectedHoverboard: board.id,
                          }))
                        }
                        className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl font-extrabold text-xs ${
                          canCoins ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        <CoinIcon className="w-3.5 h-3.5" />
                        <span>{board.costCoins.toLocaleString()}</span>
                      </button>
                      <button
                        type="button"
                        disabled={!canGems}
                        onClick={() =>
                          onUpdateSave((s) => ({
                            ...s,
                            gems: s.gems - board.costGems,
                            unlockedHoverboards: [...s.unlockedHoverboards, board.id],
                            selectedHoverboard: board.id,
                          }))
                        }
                        className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl font-extrabold text-xs ${
                          canGems ? 'bg-fuchsia-600 text-white' : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        <GemIcon className="w-3.5 h-3.5" />
                        <span>{board.costGems}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ModalShell>
    );
  }

  if (modal === 'worlds') {
    const activeWorldCfg = WORLDS.find((w) => w.id === save.selectedWorld) || WORLDS[0];
    const worldLevels = LEVELS.filter((l) => l.worldId === activeWorldCfg.id);

    return (
      <ModalShell
        title="FANTASY KINGDOMS & 150 STAGES"
        subtitle="Unlock All 5 Worlds • Select Stage to Run"
        onClose={onClose}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {WORLDS.map((w) => {
            const unlocked = save.unlockedWorlds.includes(w.id);
            const selected = save.selectedWorld === w.id;
            const canCoins = save.coins >= w.unlockCostCoins;
            const canGems = save.gems >= w.unlockCostGems;

            return (
              <div
                key={w.id}
                className={`rounded-2xl p-4 border-2 transition ${
                  selected ? 'bg-sky-950/80 border-amber-400' : 'bg-slate-900/90 border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Globe2 className="w-4 h-4" style={{ color: w.accentColor }} />
                      <h3 className="font-black text-white text-sm sm:text-base">{w.name}</h3>
                    </div>
                    <p className="text-[11px] font-semibold text-amber-300 mt-0.5">{w.subtitle}</p>
                  </div>
                  {selected && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black">
                      ACTIVE
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-300 mt-2 leading-relaxed">{w.description}</p>
                <div className="text-[11px] text-slate-400 mt-2 font-bold">
                  Stages {w.levelRange[0]}–{w.levelRange[1]} · Best:{' '}
                  <span className="text-white tabular-nums">
                    {(save.worldHighScores[w.id] || 0).toLocaleString()}
                  </span>
                </div>

                <div className="mt-3 flex gap-2">
                  {unlocked ? (
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSave((s) => ({
                          ...s,
                          selectedWorld: w.id,
                          selectedGameLevel: Math.max(
                            w.levelRange[0],
                            Math.min(s.highestGameLevel, w.levelRange[1])
                          ),
                        }))
                      }
                      className={`w-full py-2 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 ${
                        selected
                          ? 'bg-emerald-600 text-white'
                          : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                      }`}
                    >
                      {selected ? <Check className="w-4 h-4" /> : null}
                      <span>{selected ? 'Selected Kingdom' : 'Enter Kingdom'}</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={!canCoins}
                        onClick={() =>
                          onUpdateSave((s) => ({
                            ...s,
                            coins: s.coins - w.unlockCostCoins,
                            unlockedWorlds: [...s.unlockedWorlds, w.id],
                            selectedWorld: w.id,
                            selectedGameLevel: w.levelRange[0],
                            highestGameLevel: Math.max(s.highestGameLevel, w.levelRange[0]),
                          }))
                        }
                        className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl font-extrabold text-xs ${
                          canCoins ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        <CoinIcon className="w-3.5 h-3.5" />
                        <span>{w.unlockCostCoins.toLocaleString()}</span>
                      </button>
                      <button
                        type="button"
                        disabled={!canGems}
                        onClick={() =>
                          onUpdateSave((s) => ({
                            ...s,
                            gems: s.gems - w.unlockCostGems,
                            unlockedWorlds: [...s.unlockedWorlds, w.id],
                            selectedWorld: w.id,
                            selectedGameLevel: w.levelRange[0],
                            highestGameLevel: Math.max(s.highestGameLevel, w.levelRange[0]),
                          }))
                        }
                        className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl font-extrabold text-xs ${
                          canGems ? 'bg-fuchsia-600 text-white' : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        <GemIcon className="w-3.5 h-3.5" />
                        <span>{w.unlockCostGems}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Stage Grid for Selected World */}
        <div className="border-t border-slate-700 pt-4">
          <h3 className="text-sm font-black text-amber-300 mb-2.5">
            {activeWorldCfg.name} — Select Stage ({worldLevels[0].level} to {worldLevels[worldLevels.length - 1].level})
          </h3>
          <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
            {worldLevels.map((lvl) => {
              const stageUnlocked =
                save.unlockedWorlds.includes(activeWorldCfg.id) &&
                (lvl.level <= save.highestGameLevel || lvl.level === activeWorldCfg.levelRange[0]);
              const isSelected = save.selectedGameLevel === lvl.level;

              return (
                <button
                  key={lvl.level}
                  type="button"
                  disabled={!stageUnlocked}
                  onClick={() => {
                    onUpdateSave((s) => ({ ...s, selectedGameLevel: lvl.level }));
                    onStartStage(activeWorldCfg.id, lvl.level);
                  }}
                  className={`py-2 rounded-xl border text-xs font-black tabular-nums flex flex-col items-center justify-center transition ${
                    isSelected
                      ? 'bg-amber-400 border-white text-slate-950'
                      : stageUnlocked
                      ? 'bg-slate-900 border-sky-500/50 text-white hover:border-amber-300'
                      : 'bg-slate-950 border-slate-800 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  <span>{lvl.level}</span>
                  {!stageUnlocked && <Lock className="w-3 h-3 mt-0.5" />}
                </button>
              );
            })}
          </div>
        </div>
      </ModalShell>
    );
  }

  if (modal === 'shop') {
    const powerTypes: PowerUpType[] = [
      'magnet',
      'shield',
      'rocket',
      'speedBoost',
      'invincibility',
      'doubleCoins',
      'hoverboard',
      'superJump',
    ];
    const packPrices: Record<PowerUpType, number> = {
      magnet: 300,
      shield: 400,
      rocket: 550,
      speedBoost: 420,
      invincibility: 620,
      doubleCoins: 450,
      hoverboard: 500,
      superJump: 350,
    };

    return (
      <ModalShell
        title="ROYAL TREASURY SHOP"
        subtitle="Stock Power-Ups, Upgrade Abilities & Exchange Currency"
        onClose={onClose}
      >
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex gap-1.5">
            {(['powerups', 'upgrades', 'store'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setShopTab(t)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black capitalize transition ${
                  shopTab === t
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-slate-900 text-slate-300 border border-slate-700'
                }`}
              >
                {t === 'powerups' ? 'Buy Gear' : t === 'upgrades' ? 'Upgrades' : 'Treasury & IAP'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-xs font-black">
            <span className="flex items-center gap-1 text-amber-300 tabular-nums">
              <CoinIcon className="w-4 h-4" />
              {save.coins.toLocaleString()}
            </span>
            <span className="flex items-center gap-1 text-fuchsia-300 tabular-nums">
              <GemIcon className="w-4 h-4" />
              {save.gems.toLocaleString()}
            </span>
          </div>
        </div>

        {notice && (
          <div className="mb-3 rounded-xl bg-sky-950/80 border border-sky-400/60 px-3 py-2 text-xs text-sky-200 font-semibold">
            {notice}
          </div>
        )}

        {shopTab === 'powerups' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {powerTypes.map((type) => {
              const info = POWERUP_INFO[type];
              const price = packPrices[type];
              const canBuy = save.coins >= price;
              return (
                <div
                  key={type}
                  className="rounded-2xl bg-slate-900/90 border border-slate-700 p-3.5 flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-700 flex items-center justify-center">
                        <PowerUpIcon type={type} className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-black text-white text-sm">{info.name}</h3>
                        <span className="text-[11px] font-bold text-amber-300 tabular-nums">
                          Owned: {save.powerUpInventory[type]}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">{info.description}</p>
                  <button
                    type="button"
                    disabled={!canBuy}
                    onClick={() => {
                      if (save.coins < price) return;
                      onUpdateSave((s) => ({
                        ...s,
                        coins: s.coins - price,
                        powerUpInventory: {
                          ...s.powerUpInventory,
                          [type]: (s.powerUpInventory[type] || 0) + 1,
                        },
                      }));
                      setNotice(`Purchased +1 ${info.name} for ${price.toLocaleString()} Coins!`);
                    }}
                    className={`mt-3 w-full min-h-[44px] py-2 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 ${
                      canBuy
                        ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <CoinIcon className="w-3.5 h-3.5" />
                    <span>Buy +1 ({price.toLocaleString()} Coins)</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {shopTab === 'upgrades' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {powerTypes.map((type) => {
              const info = POWERUP_INFO[type];
              const lvl = save.powerUpLevels[type] || 1;
              const maxed = lvl >= 6;
              const cost = info.upgradeCostBase * lvl;
              const canUpgrade = !maxed && save.coins >= cost;
              const dur = info.baseDuration + (lvl - 1) * 2;
              return (
                <div key={type} className="rounded-2xl bg-slate-900/90 border border-slate-700 p-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PowerUpIcon type={type} className="w-5 h-5" />
                      <span className="font-black text-white text-sm">{info.name}</span>
                    </div>
                    <span className="text-xs font-black text-sky-300 tabular-nums">Lv. {lvl}/6</span>
                  </div>
                  <div className="text-xs text-slate-300 mt-2">
                    Duration: <strong className="text-white">{dur}s</strong>
                    {!maxed && <span className="text-emerald-300"> → {dur + 2}s</span>}
                    <span className="text-slate-400"> · Owned: {save.powerUpInventory[type]}</span>
                  </div>
                  <div className="flex gap-1 my-2">
                    {[1, 2, 3, 4, 5, 6].map((pip) => (
                      <div
                        key={pip}
                        className={`h-1.5 flex-1 rounded-full ${
                          pip <= lvl ? 'bg-amber-400' : 'bg-slate-800'
                        }`}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={!canUpgrade}
                    onClick={() => {
                      if (maxed || save.coins < cost) return;
                      onUpdateSave((s) => ({
                        ...s,
                        coins: s.coins - cost,
                        powerUpLevels: { ...s.powerUpLevels, [type]: lvl + 1 },
                      }));
                      setNotice(`Upgraded ${info.name} to Lv. ${lvl + 1} (${dur + 2}s duration)!`);
                    }}
                    className={`w-full min-h-[44px] py-2 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 ${
                      maxed
                        ? 'bg-emerald-900/50 text-emerald-300'
                        : canUpgrade
                        ? 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {maxed ? (
                      <span>MAX LEVEL (Lv. 6/6)</span>
                    ) : (
                      <>
                        <CoinIcon className="w-3.5 h-3.5" />
                        <span>Upgrade to Lv. {lvl + 1} ({cost.toLocaleString()})</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {shopTab === 'store' && (
          <div className="space-y-4">
            {/* Gem-to-Coin Royal Exchange (always functional!) */}
            <div className="rounded-2xl bg-slate-900/90 border border-amber-400/50 p-4">
              <h3 className="font-black text-amber-300 text-sm mb-2 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> Royal Gem-to-Coin Exchange
              </h3>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={save.gems < 10}
                  onClick={() => {
                    if (save.gems < 10) return;
                    onUpdateSave((s) => ({ ...s, gems: s.gems - 10, coins: s.coins + 1500 }));
                    setNotice('Exchanged 10 Gems for +1,500 Coins!');
                  }}
                  className={`min-h-[44px] py-2.5 px-3 rounded-xl border text-xs font-extrabold flex items-center justify-between ${
                    save.gems >= 10
                      ? 'bg-slate-800 hover:bg-slate-700 border-amber-400/50 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-600'
                  }`}
                >
                  <span className="flex items-center gap-1 text-amber-300">
                    <CoinIcon className="w-4 h-4" /> +1,500
                  </span>
                  <span className="flex items-center gap-1 text-fuchsia-300">
                    <GemIcon className="w-3.5 h-3.5" /> 10
                  </span>
                </button>

                <button
                  type="button"
                  disabled={save.gems < 40}
                  onClick={() => {
                    if (save.gems < 40) return;
                    onUpdateSave((s) => ({ ...s, gems: s.gems - 40, coins: s.coins + 7500 }));
                    setNotice('Exchanged 40 Gems for +7,500 Coins!');
                  }}
                  className={`min-h-[44px] py-2.5 px-3 rounded-xl border text-xs font-extrabold flex items-center justify-between ${
                    save.gems >= 40
                      ? 'bg-slate-800 hover:bg-slate-700 border-amber-400/50 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-600'
                  }`}
                >
                  <span className="flex items-center gap-1 text-amber-300">
                    <CoinIcon className="w-4 h-4" /> +7,500
                  </span>
                  <span className="flex items-center gap-1 text-fuchsia-300">
                    <GemIcon className="w-3.5 h-3.5" /> 40
                  </span>
                </button>
              </div>
            </div>

            {/* Google Play IAP Storefront SKUs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {IAP_PRODUCTS.map((p) => {
                const alreadyOwned =
                  (p.sku === 'shera_remove_ads' && save.removeAds) ||
                  (p.sku === 'shera_vip_monthly' && save.vipActive) ||
                  (p.sku === 'shera_starter_pack' && save.starterPackPurchased);

                return (
                  <div key={p.sku} className="rounded-2xl bg-slate-900/90 border border-slate-700 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-white text-sm">{p.title}</span>
                      {p.badge && (
                        <span className="px-2 py-0.5 rounded bg-rose-600 text-[10px] font-black text-white shrink-0">
                          {p.badge}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-300 mt-1">
                      {p.coins ? `+${p.coins.toLocaleString()} Coins ` : ''}
                      {p.gems ? `+${p.gems} Gems ` : ''}
                      {p.removeAds ? '• Removes All Ads' : ''}
                    </div>
                    <button
                      type="button"
                      disabled={alreadyOwned}
                      onClick={async () => {
                        const res = await MonetizationService.purchaseIap(p.sku);
                        if (res.status === 'purchased') {
                          onUpdateSave((s) => ({
                            ...s,
                            coins: s.coins + (p.coins || 0),
                            gems: s.gems + (p.gems || 0),
                            vipActive: s.vipActive || Boolean(p.vip),
                            removeAds: s.removeAds || Boolean(p.removeAds || p.vip),
                            starterPackPurchased: s.starterPackPurchased || Boolean(p.starterPack),
                            purchaseHistory: [
                              ...s.purchaseHistory,
                              {
                                sku: p.sku,
                                title: p.title,
                                purchasedAt: new Date().toISOString(),
                                source: 'google_play',
                                transactionId: res.transactionId,
                              },
                            ],
                          }));
                        }
                        setNotice(res.message);
                      }}
                      className={`mt-2.5 w-full min-h-[44px] py-2 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 ${
                        alreadyOwned
                          ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 cursor-default'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      }`}
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>{alreadyOwned ? 'OWNED' : p.priceDisplay}</span>
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={async () => {
                const res = await MonetizationService.restorePurchases();
                if (res.status === 'restored' && res.restoredSkus.length > 0) {
                  onUpdateSave((s) => ({
                    ...s,
                    removeAds:
                      s.removeAds ||
                      res.restoredSkus.includes('shera_remove_ads') ||
                      res.restoredSkus.includes('shera_vip_monthly'),
                    vipActive: s.vipActive || res.restoredSkus.includes('shera_vip_monthly'),
                    starterPackPurchased:
                      s.starterPackPurchased || res.restoredSkus.includes('shera_starter_pack'),
                  }));
                }
                setNotice(res.message);
              }}
              className="w-full min-h-[44px] py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold text-xs"
            >
              Restore Google Play Purchases
            </button>
          </div>
        )}
      </ModalShell>
    );
  }

  return null;
};
