import { useEffect, useRef, useState } from "react";
import mammoth from "mammoth";
import {
  appendCloudWords,
  createCloudLibrary,
  deleteCloudLibrary,
  fetchCloudLibraries,
  replaceCloudLibrary,
  saveCloudProgress,
  updateCloudWord,
} from "./cloudStorage";
import {
  createLibrary,
  loadLibraries,
  persistLibraries,
  updateLibrary,
} from "./libraryStorage";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { parseVocabulary } from "./parser";
import { createManualWords } from "./manualVocabulary";
import {
  loadAppSession,
  saveAppSession,
  saveHomeSession,
} from "./appSession";

function formatUpdatedAt(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function countMastered(words) {
  return words.reduce(
    (count, word) => count + (word.mastered === true ? 1 : 0),
    0,
  );
}

function getWordsForMode(words, starredWordIds, mode) {
  if (mode === "unmastered") {
    return words.filter((word) => !word.mastered);
  }
  if (mode === "mastered") {
    return words.filter((word) => word.mastered);
  }
  if (mode === "starred") {
    return words.filter((word) => starredWordIds.includes(word.id));
  }
  return words;
}

function RestoreLoadingView() {
  return (
    <main className="restore-loading" aria-live="polite">
      <p>正在恢复学习状态…</p>
    </main>
  );
}

function AccountPanel({
  session,
  busy,
  message,
  onSignIn,
  onSignUp,
  onSignOut,
}) {
  const [expanded, setExpanded] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (!isSupabaseConfigured) {
    return (
      <aside className="account-panel">
        <span>本地模式</span>
        <small>配置 Supabase 后可在多设备同步词库</small>
      </aside>
    );
  }

  if (session) {
    return (
      <div className="account-status">
        <span>已登录：{session.user.email}</span>
        <button type="button" disabled={busy} onClick={onSignOut}>退出登录</button>
      </div>
    );
  }

  return (
    <aside className="account-panel">
      <div className="account-line">
        <span>登录后可在多设备同步词库</span>
        <button type="button" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "收起" : "登录 / 注册"}
        </button>
      </div>
      {expanded && (
        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSignIn(email, password);
          }}
        >
          <input
            type="email"
            autoComplete="email"
            placeholder="邮箱"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <input
            type="password"
            autoComplete="current-password"
            placeholder="密码（至少 6 位）"
            minLength={6}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <div>
            <button type="submit" disabled={busy}>登录</button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onSignUp(email, password)}
            >
              注册
            </button>
          </div>
        </form>
      )}
      {message && <small role="status">{message}</small>}
    </aside>
  );
}

function MigrationNotice({
  hasConflicts,
  strategy,
  busy,
  onStrategyChange,
  onMigrate,
  onDismiss,
}) {
  return (
    <aside className="migration-notice">
      <p>检测到本地词库，可上传到云端以多设备同步。</p>
      {hasConflicts && (
        <div className="migration-strategies" aria-label="重名词库处理方式">
          {[
            ["overwrite", "覆盖"],
            ["skip", "跳过"],
            ["rename", "重命名"],
          ].map(([value, label]) => (
            <button
              className={strategy === value ? "is-selected" : ""}
              key={value}
              type="button"
              onClick={() => onStrategyChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="migration-actions">
        <button type="button" disabled={busy} onClick={onMigrate}>
          上传到云端
        </button>
        <button type="button" onClick={onDismiss}>暂不上传</button>
      </div>
    </aside>
  );
}

function UploadView({
  onUpload,
  onManualAdd,
  loading,
  error,
  libraries,
  onOpenLibrary,
  onStartLibrary,
  onDeleteLibrary,
  accountPanel,
  migrationNotice,
}) {
  const inputRef = useRef(null);

  return (
    <main className="upload-page">
      <div className="home-shell">
        {accountPanel}
        <section className="upload-panel">
          <div className="mark" aria-hidden="true">W</div>
          <h1>极简背词</h1>
          <p className="intro">上传 Word 单词表，马上开始。</p>

          <input
            ref={inputRef}
            className="file-input"
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(event) => onUpload(event.target.files?.[0])}
          />
          <div className="import-actions">
            <button
              className="primary-button upload-button"
              type="button"
              disabled={loading}
              onClick={() => inputRef.current?.click()}
            >
              {loading ? "正在解析…" : "选择 .docx 文件"}
            </button>
            <button
              className="secondary-button manual-import-button"
              type="button"
              disabled={loading}
              onClick={onManualAdd}
            >
              手动添加生词
            </button>
          </div>
          <p className="format-note">选择一种方式创建你的词库</p>
          {error && <p className="error-message" role="alert">{error}</p>}
        </section>

        {migrationNotice}
        {libraries.length > 0 && (
          <section className="library-section">
            <div className="library-heading">
              <h2>我的词库</h2>
              <span>{libraries.length} 个</span>
            </div>
            <div className="library-list">
              {libraries.map((library) => {
                const masteredCount = countMastered(library.words);
                const totalWords = library.words.length;
                const percent = totalWords > 0
                  ? Math.round((masteredCount / totalWords) * 100)
                  : 0;

                return (
                  <article className="library-row" key={library.id}>
                    <button
                      className="library-main"
                      type="button"
                      onClick={() => onOpenLibrary(library)}
                    >
                      <strong>{library.name}</strong>
                      <div className="library-stats">
                        <span>{totalWords} 个单词</span>
                        <span className="library-star-count">
                          ★ 重点词 {library.starredWordIds.length}
                        </span>
                        <span className="library-mastered-count">
                          ◆ 已掌握 {masteredCount}
                        </span>
                      </div>
                      <div className="library-progress">
                        <div className="library-progress-summary">
                          <span>已掌握 {masteredCount} / {totalWords}</span>
                          <span>{percent}%</span>
                        </div>
                        <div
                          className="library-progress-track"
                          role="progressbar"
                          aria-label={`${library.name} 掌握进度`}
                          aria-valuemin="0"
                          aria-valuemax="100"
                          aria-valuenow={percent}
                        >
                          <span style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                      <span className="library-updated">
                        更新于 {formatUpdatedAt(library.updatedAt)}
                      </span>
                    </button>
                    <div className="library-actions">
                      <button type="button" onClick={() => onStartLibrary(library)}>
                        开始背词
                      </button>
                      <button type="button" onClick={() => onDeleteLibrary(library)}>
                        删除
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function createManualRow() {
  return {
    id:
      globalThis.crypto?.randomUUID?.()
      || `row-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    word: "",
    meaning: "",
  };
}

function ManualAddView({
  libraries,
  busy,
  onSave,
  onCancel,
}) {
  const [rows, setRows] = useState(() => [createManualRow()]);
  const [destination, setDestination] = useState("new");
  const [libraryName, setLibraryName] = useState("");
  const [targetLibraryId, setTargetLibraryId] = useState(libraries[0]?.id || "");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const updateRow = (id, field, value) => {
    setRows((items) => items.map((row) => (
      row.id === id ? { ...row, [field]: value } : row
    )));
    setMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");

    if (rows.some((row) => !row.word.trim() || !row.meaning.trim())) {
      setMessage("每一行的英文单词和中文释义都必须填写。");
      return;
    }
    if (destination === "new" && !libraryName.trim()) {
      setMessage("请输入新词库名称。");
      return;
    }
    if (destination === "existing" && !targetLibraryId) {
      setMessage("请选择要加入的词库。");
      return;
    }

    setSubmitting(true);
    const saveError = await onSave({
      entries: rows,
      destination,
      libraryName,
      targetLibraryId,
    });
    if (saveError) {
      setMessage(saveError);
      setSubmitting(false);
    }
  };

  return (
    <main className="manual-page">
      <form className="manual-panel" onSubmit={handleSubmit}>
        <header className="manual-header">
          <div>
            <p className="eyebrow">生词录入</p>
            <h1>手动添加生词</h1>
          </div>
          <button className="text-button" type="button" onClick={onCancel}>
            返回首页
          </button>
        </header>

        <section className="manual-rows" aria-label="待添加单词">
          {rows.map((row, index) => (
            <div className="manual-row" key={row.id}>
              <span className="manual-row-number">{index + 1}</span>
              <input
                type="text"
                value={row.word}
                placeholder="英文单词"
                aria-label={`第 ${index + 1} 行英文单词`}
                autoCapitalize="none"
                autoCorrect="off"
                onChange={(event) => updateRow(row.id, "word", event.target.value)}
              />
              <input
                type="text"
                value={row.meaning}
                placeholder="中文释义"
                aria-label={`第 ${index + 1} 行中文释义`}
                onChange={(event) => updateRow(row.id, "meaning", event.target.value)}
              />
              <button
                className="manual-delete"
                type="button"
                disabled={rows.length === 1}
                aria-label={`删除第 ${index + 1} 行`}
                onClick={() => {
                  setRows((items) => items.filter((item) => item.id !== row.id));
                  setMessage("");
                }}
              >
                删除
              </button>
            </div>
          ))}
        </section>

        <button
          className="manual-add-row"
          type="button"
          onClick={() => {
            setRows((items) => [...items, createManualRow()]);
            setMessage("");
          }}
        >
          ＋ 添加一行
        </button>

        <section className="manual-destination" aria-labelledby="save-target-title">
          <h2 id="save-target-title">保存到</h2>
          <div className="destination-options">
            <label>
              <input
                type="radio"
                name="destination"
                value="new"
                checked={destination === "new"}
                onChange={() => {
                  setDestination("new");
                  setMessage("");
                }}
              />
              新建词库
            </label>
            <label className={!libraries.length ? "is-disabled" : ""}>
              <input
                type="radio"
                name="destination"
                value="existing"
                disabled={!libraries.length}
                checked={destination === "existing"}
                onChange={() => {
                  setDestination("existing");
                  setMessage("");
                }}
              />
              加入已有词库
            </label>
          </div>

          {destination === "new" ? (
            <input
              className="manual-library-input"
              type="text"
              value={libraryName}
              maxLength={60}
              placeholder="输入新词库名称"
              aria-label="新词库名称"
              onChange={(event) => {
                setLibraryName(event.target.value);
                setMessage("");
              }}
            />
          ) : (
            <select
              className="manual-library-input"
              value={targetLibraryId}
              aria-label="选择已有词库"
              onChange={(event) => {
                setTargetLibraryId(event.target.value);
                setMessage("");
              }}
            >
              {libraries.map((library) => (
                <option key={library.id} value={library.id}>
                  {library.name}（{library.words.length} 词）
                </option>
              ))}
            </select>
          )}
        </section>

        <footer className="manual-footer">
          <p>将添加 <strong>{rows.length}</strong> 个单词</p>
          <button
            className="primary-button compact-button"
            type="submit"
            disabled={busy || submitting}
          >
            {busy || submitting ? "正在保存…" : "保存生词"}
          </button>
        </footer>
        {message && <p className="error-message" role="alert">{message}</p>}
      </form>
    </main>
  );
}

function ListView({
  words,
  fileName,
  initialLibraryName,
  canOverwrite,
  saveMessage,
  onNameChange,
  onSave,
  onOverwrite,
  onStart,
  onReset,
}) {
  const [libraryName, setLibraryName] = useState(initialLibraryName);

  const handleNameChange = (event) => {
    setLibraryName(event.target.value);
    onNameChange(event.target.value);
  };

  return (
    <main className="list-page">
      <header className="list-header">
        <div>
          <p className="eyebrow">已成功导入</p>
          <h1>{words.length} 个单词</h1>
          <p className="file-name">{fileName}</p>
        </div>
        <button className="text-button" type="button" onClick={onReset}>重新上传</button>
      </header>

      <section className="save-panel" aria-label="保存词库">
        <label htmlFor="library-name">词库名称</label>
        <input
          id="library-name"
          type="text"
          value={libraryName}
          maxLength={60}
          placeholder="例如：GRE 高频词"
          onChange={handleNameChange}
        />
        <div className="save-actions">
          <button className="secondary-button" type="button" onClick={() => onSave(libraryName)}>
            保存为词库
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={!canOverwrite}
            onClick={() => onOverwrite(libraryName)}
          >
            覆盖已有词库
          </button>
          <button className="primary-button compact-button" type="button" onClick={onStart}>
            开始快速背词
          </button>
        </div>
        {saveMessage && <p className="save-message" role="status">{saveMessage}</p>}
      </section>

      <section className="word-list" aria-label="单词列表">
        {words.map((item, index) => (
          <article className="word-row" key={item.id}>
            <span className="row-index">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h2>{item.word}</h2>
              <p>{item.meaning}</p>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

function StudyModeView({
  wordCount,
  starredCount,
  masteredCount,
  onSelect,
  onBack,
}) {
  const unmasteredCount = wordCount - masteredCount;

  return (
    <main className="mode-page">
      <section className="mode-panel" aria-labelledby="mode-title">
        <button className="mode-back" type="button" onClick={onBack}>
          ← 返回列表
        </button>
        <p className="eyebrow">快速背词</p>
        <h1 id="mode-title">选择学习模式</h1>
        <p className="mode-intro">这次想复习哪些单词？</p>

        <div className="mode-options">
          <button type="button" onClick={() => onSelect("all")}>
            <span className="mode-radio" aria-hidden="true" />
            <span>
              <strong>全部</strong>
              <small>{wordCount} 个单词</small>
            </span>
          </button>
          <button
            className="is-default"
            type="button"
            disabled={unmasteredCount === 0}
            onClick={() => onSelect("unmastered")}
          >
            <span className="mode-radio" aria-hidden="true" />
            <span>
              <strong>未掌握 <em>默认</em></strong>
              <small>
                {unmasteredCount > 0 ? `${unmasteredCount} 个单词` : "全部掌握了"}
              </small>
            </span>
          </button>
          <button
            type="button"
            disabled={masteredCount === 0}
            onClick={() => onSelect("mastered")}
          >
            <span className="mode-radio" aria-hidden="true" />
            <span>
              <strong>
                <span className="mode-mastered" aria-hidden="true">◆</span> 已掌握
              </strong>
              <small>
                {masteredCount > 0 ? `${masteredCount} 个单词` : "还没有已掌握单词"}
              </small>
            </span>
          </button>
          <button
            type="button"
            disabled={starredCount === 0}
            onClick={() => onSelect("starred")}
          >
            <span className="mode-radio" aria-hidden="true" />
            <span>
              <strong><span className="mode-star" aria-hidden="true">★</span> 星标</strong>
              <small>
                {starredCount > 0 ? `${starredCount} 个已星标单词` : "还没有星标单词"}
              </small>
            </span>
          </button>
        </div>
      </section>
    </main>
  );
}

function StudyView({
  words,
  starredWordIds,
  onToggleStar,
  onMaster,
  initialIndex,
  initialRevealed,
  onProgress,
  onMeaningChange,
  onExit,
  onRestart,
  onReset,
}) {
  const [sessionWords, setSessionWords] = useState(words);
  const [index, setIndex] = useState(
    Math.max(0, Math.min(words.length - 1, initialIndex || 0)),
  );
  const [revealed, setRevealed] = useState(initialRevealed === true);
  const [starAnimating, setStarAnimating] = useState(false);
  const [gestureOffset, setGestureOffset] = useState(null);
  const [isMastering, setIsMastering] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const startX = useRef(null);
  const startY = useRef(null);
  const lastTouchX = useRef(null);
  const lastTouchY = useRef(null);
  const directionLock = useRef(null);
  const didSwipe = useRef(false);
  const starAnimationTimer = useRef(null);
  const starAnimationFrame = useRef(null);
  const masterAnimationTimer = useRef(null);
  const clickSuppressionTimer = useRef(null);
  const initialTotal = useRef(words.length);
  const current = sessionWords[index];
  const isStarred = starredWordIds.includes(current.id);

  const updateRevealed = (nextValue) => {
    setRevealed(nextValue);
    onMeaningChange(index, current.id, nextValue);
  };

  const goTo = (nextIndex) => {
    if (isMastering) return;
    const boundedIndex = Math.max(
      0,
      Math.min(sessionWords.length - 1, nextIndex),
    );
    if (boundedIndex !== index) {
      window.cancelAnimationFrame(starAnimationFrame.current);
      window.clearTimeout(starAnimationTimer.current);
      setStarAnimating(false);
      setIndex(boundedIndex);
      setRevealed(false);
      onProgress(boundedIndex, sessionWords[boundedIndex].id);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      const key = event.key.toLowerCase();

      if (key === "arrowright" || key === "d") {
        event.preventDefault();
        goTo(index + 1);
      }
      if (key === "arrowleft" || key === "a") {
        event.preventDefault();
        goTo(index - 1);
      }
      if (event.key === " ") {
        event.preventDefault();
        updateRevealed(!revealed);
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onExit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    index,
    isMastering,
    onExit,
    onMeaningChange,
    onProgress,
    revealed,
    sessionWords.length,
  ]);

  useEffect(() => () => {
    window.cancelAnimationFrame(starAnimationFrame.current);
    window.clearTimeout(starAnimationTimer.current);
    window.clearTimeout(masterAnimationTimer.current);
    window.clearTimeout(clickSuppressionTimer.current);
  }, []);

  const suppressGestureClick = () => {
    didSwipe.current = true;
    window.clearTimeout(clickSuppressionTimer.current);
    clickSuppressionTimer.current = window.setTimeout(() => {
      didSwipe.current = false;
    }, 400);
  };

  const resetTouch = () => {
    startX.current = null;
    startY.current = null;
    lastTouchX.current = null;
    lastTouchY.current = null;
    directionLock.current = null;
  };

  const handleTouchStart = (event) => {
    if (isMastering || event.touches.length !== 1) {
      resetTouch();
      return;
    }

    const touch = event.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    lastTouchX.current = touch.clientX;
    lastTouchY.current = touch.clientY;
    window.clearTimeout(clickSuppressionTimer.current);
    didSwipe.current = false;
  };

  const handleTouchMove = (event) => {
    if (startX.current === null || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const distanceX = touch.clientX - startX.current;
    const distanceY = touch.clientY - startY.current;
    const absoluteX = Math.abs(distanceX);
    const absoluteY = Math.abs(distanceY);

    lastTouchX.current = touch.clientX;
    lastTouchY.current = touch.clientY;

    if (directionLock.current === null) {
      if (Math.max(absoluteX, absoluteY) < 12) return;

      if (absoluteX > absoluteY * 1.3) {
        directionLock.current = "horizontal";
      } else if (absoluteY > absoluteX * 1.3) {
        directionLock.current = "vertical";
      } else {
        return;
      }
    }

    if (directionLock.current === "horizontal") {
      setGestureOffset({ x: distanceX, y: 0 });
    } else {
      if (event.cancelable) event.preventDefault();
      setGestureOffset({ x: 0, y: distanceY });
    }
  };

  const beginMastering = () => {
    if (!onMaster(current.id)) {
      setGestureOffset(null);
      return;
    }

    setGestureOffset(null);
    setIsMastering(true);
    masterAnimationTimer.current = window.setTimeout(() => {
      const nextWords = sessionWords.filter((word) => word.id !== current.id);

      if (!nextWords.length) {
        onExit();
        return;
      }

      setSessionWords(nextWords);
      const nextIndex = Math.min(index, nextWords.length - 1);
      setIndex(nextIndex);
      setCompletedCount((count) => count + 1);
      setRevealed(false);
      setIsMastering(false);
      onProgress(nextIndex, nextWords[nextIndex].id);
    }, 200);
  };

  const handleTouchEnd = (event) => {
    if (startX.current === null || startY.current === null) return;

    const touch = event.changedTouches[0];
    const endX = touch?.clientX ?? lastTouchX.current;
    const endY = touch?.clientY ?? lastTouchY.current;
    const distanceX = endX - startX.current;
    const distanceY = endY - startY.current;
    const lockedDirection = directionLock.current;
    const movedEnough =
      Math.max(Math.abs(distanceX), Math.abs(distanceY)) >= 12;
    resetTouch();
    setGestureOffset(null);

    if (!lockedDirection) {
      if (movedEnough) suppressGestureClick();
      return;
    }

    suppressGestureClick();
    if (lockedDirection === "horizontal") {
      if (Math.abs(distanceX) < 50) return;
      if (distanceX < 0) goTo(index + 1);
      if (distanceX > 0) goTo(index - 1);
      return;
    }

    if (distanceY <= -60) beginMastering();
  };

  const handleTouchCancel = () => {
    resetTouch();
    setGestureOffset(null);
  };

  const handlePageClick = (event) => {
    if (didSwipe.current) {
      window.clearTimeout(clickSuppressionTimer.current);
      didSwipe.current = false;
      return;
    }
    if (isMastering) return;
    if (event.target.closest("button")) return;
    updateRevealed(!revealed);
  };

  const handleToggleStar = () => {
    onToggleStar(current.id);
    setStarAnimating(false);
    window.clearTimeout(starAnimationTimer.current);
    starAnimationFrame.current = window.requestAnimationFrame(() => {
      setStarAnimating(true);
      starAnimationTimer.current = window.setTimeout(
        () => setStarAnimating(false),
        180,
      );
    });
  };

  return (
    <main
      className="study-page"
      onClick={handlePageClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      <header className="study-header">
        <button className="header-button" type="button" onClick={onExit}>
          ← 返回列表
        </button>
        <button className="header-button" type="button" onClick={onRestart}>
          重新开始
        </button>
        <button className="header-button" type="button" onClick={onReset}>
          重新上传
        </button>
      </header>

      <section
        className={`card-stage${isMastering ? " is-mastering" : ""}`}
        key={`${index}-${current.id}`}
        style={
          gestureOffset
            ? {
              transform: `translate3d(${gestureOffset.x}px, ${gestureOffset.y}px, 0)`,
              transition: "none",
            }
            : undefined
        }
        aria-live="polite"
      >
        <button
          className={`star-button${isStarred ? " is-starred" : ""}${starAnimating ? " is-animating" : ""}`}
          type="button"
          aria-label={isStarred ? `取消星标 ${current.word}` : `星标 ${current.word}`}
          aria-pressed={isStarred}
          onClick={handleToggleStar}
        >
          <span aria-hidden="true">{isStarred ? "★" : "☆"}</span>
        </button>
        <p className="study-word">{current.word}</p>
        <div className="meaning-slot">
          {revealed ? (
            <p className="study-meaning">{current.meaning}</p>
          ) : (
            <button className="reveal-button" type="button" onClick={() => updateRevealed(true)}>
              点击查看释义
            </button>
          )}
        </div>
      </section>

      <footer className="study-footer">
        <div className="progress-track" aria-hidden="true">
          <span
            style={{
              width: `${(
                (completedCount + index + 1)
                / initialTotal.current
              ) * 100}%`,
            }}
          />
        </div>
        <p className="progress-text">
          <strong>{completedCount + index + 1}</strong>
          <span> / {initialTotal.current}</span>
        </p>
        <div className="mastery-hint">
          <div className="mastery-chevrons" aria-hidden="true">
            {[0, 1, 2].map((item) => (
              <svg
                key={item}
                viewBox="0 0 24 8"
                width="24"
                height="8"
                focusable="false"
              >
                <path d="M3 6 L12 2 L21 6" />
              </svg>
            ))}
          </div>
          <p>向上滑动即可掌握</p>
        </div>
      </footer>
    </main>
  );
}

export default function App() {
  const initialAppSession = useRef(loadAppSession());
  const [words, setWords] = useState([]);
  const [fileName, setFileName] = useState("");
  const [view, setView] = useState("upload");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [libraries, setLibraries] = useState(() => loadLibraries());
  const [currentLibraryId, setCurrentLibraryId] = useState(null);
  const [draftLibraryName, setDraftLibraryName] = useState("");
  const [starredWordIds, setStarredWordIds] = useState([]);
  const [studyWords, setStudyWords] = useState([]);
  const [studyInitialIndex, setStudyInitialIndex] = useState(0);
  const [studyInitialRevealed, setStudyInitialRevealed] = useState(false);
  const [studyMode, setStudyMode] = useState("all");
  const [studyRunId, setStudyRunId] = useState(0);
  const [saveMessage, setSaveMessage] = useState("");
  const [session, setSession] = useState(null);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [accountMessage, setAccountMessage] = useState("");
  const [migrationStrategy, setMigrationStrategy] = useState("skip");
  const [migrationDismissed, setMigrationDismissed] = useState(false);
  const [authReady, setAuthReady] = useState(!supabase);
  const [librariesReady, setLibrariesReady] = useState(!supabase);
  const [restorePending, setRestorePending] = useState(
    initialAppSession.current.screen === "review",
  );
  const wordsRef = useRef(words);
  const starredWordIdsRef = useRef(starredWordIds);
  const librariesRef = useRef(libraries);
  wordsRef.current = words;
  starredWordIdsRef.current = starredWordIds;
  librariesRef.current = libraries;
  const isCloudMode = Boolean(session && supabase);
  const localLibraries = loadLibraries();
  const hasMigrationConflicts = localLibraries.some((localLibrary) => (
    libraries.some(
      (cloudLibrary) => cloudLibrary.name.trim() === localLibrary.name.trim(),
    )
  ));

  useEffect(() => {
    if (!supabase) return undefined;

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) setAccountMessage(sessionError.message);
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
      if (event === "SIGNED_IN") setLibrariesReady(false);
      if (event === "SIGNED_OUT") {
        setMigrationDismissed(false);
        setRestorePending(false);
        saveHomeSession();
        setWords([]);
        setCurrentLibraryId(null);
        setStudyWords([]);
        setView("upload");
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady) return undefined;

    if (!session) {
      setLibraries(loadLibraries());
      setLibrariesReady(true);
      return undefined;
    }

    let active = true;
    setLibraries([]);
    setLibrariesReady(false);
    setCloudBusy(true);
    fetchCloudLibraries(session.user.id)
      .then((cloudLibraries) => {
        if (active) setLibraries(cloudLibraries);
      })
      .catch((cloudError) => {
        if (active) setAccountMessage(`云端读取失败：${cloudError.message}`);
        if (active) setLibraries([]);
      })
      .finally(() => {
        if (active) {
          setCloudBusy(false);
          setLibrariesReady(true);
        }
      });
    return () => { active = false; };
  }, [authReady, session]);

  useEffect(() => {
    if (!restorePending || !authReady || !librariesReady) return;

    const saved = initialAppSession.current;
    const library = libraries.find((item) => item.id === saved.listId);
    const selectedWords = library
      ? getWordsForMode(library.words, library.starredWordIds, saved.mode)
      : [];

    if (!library || !selectedWords.length || saved.index >= selectedWords.length) {
      saveHomeSession();
      setRestorePending(false);
      setView("upload");
      return;
    }

    setWords(library.words);
    setFileName("已保存词库");
    setCurrentLibraryId(library.id);
    setDraftLibraryName(library.name);
    setStarredWordIds(library.starredWordIds);
    setStudyWords(selectedWords);
    setStudyMode(saved.mode);
    setStudyInitialIndex(saved.index);
    setStudyInitialRevealed(saved.showMeaning);
    setStudyRunId((value) => value + 1);
    setSaveMessage("");
    setView("study");
    setRestorePending(false);
  }, [authReady, libraries, librariesReady, restorePending]);

  const handleSignIn = async (email, password) => {
    setCloudBusy(true);
    setAccountMessage("");
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setAccountMessage(authError ? authError.message : "登录成功。");
    setCloudBusy(false);
  };

  const handleSignUp = async (email, password) => {
    setCloudBusy(true);
    setAccountMessage("");
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });
    if (authError) {
      setAccountMessage(authError.message);
    } else if (!data.session) {
      setAccountMessage("注册成功，请先到邮箱完成验证。");
    } else {
      setAccountMessage("注册并登录成功。");
    }
    setCloudBusy(false);
  };

  const handleSignOut = async () => {
    saveHomeSession();
    setRestorePending(false);
    setView("upload");
    setCloudBusy(true);
    const { error: authError } = await supabase.auth.signOut();
    if (authError) setAccountMessage(authError.message);
    setCloudBusy(false);
  };

  const handleUpload = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setError("请选择 .docx 格式的 Word 文档。");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      const parsedWords = parseVocabulary(result.value);

      if (!parsedWords.length) {
        throw new Error("没有识别到“英文单词 + 中文释义”，请检查文档格式。");
      }

      setWords(parsedWords);
      setFileName(file.name);
      setCurrentLibraryId(null);
      setDraftLibraryName("");
      setStarredWordIds([]);
      setStudyWords([]);
      setSaveMessage("");
      saveHomeSession();
      setView("list");
    } catch (uploadError) {
      setError(uploadError.message || "文档解析失败，请换一个文件重试。");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    saveHomeSession();
    setWords([]);
    setFileName("");
    setError("");
    setCurrentLibraryId(null);
    setDraftLibraryName("");
    setStarredWordIds([]);
    setStudyWords([]);
    setSaveMessage("");
    setView("upload");
  };

  const commitLibraries = (nextLibraries) => {
    try {
      persistLibraries(nextLibraries);
      setLibraries(nextLibraries);
      return true;
    } catch {
      setSaveMessage("保存失败：浏览器本地存储空间不足或不可用。");
      return false;
    }
  };

  const openLibrary = (library, startImmediately = false) => {
    saveHomeSession();
    setWords(library.words);
    setFileName("已保存词库");
    setCurrentLibraryId(library.id);
    setDraftLibraryName(library.name);
    setStarredWordIds(library.starredWordIds);
    setStudyWords([]);
    setStudyInitialRevealed(false);
    setSaveMessage("");
    setView(startImmediately ? "mode" : "list");
  };

  const saveManualWords = async ({
    entries,
    destination,
    libraryName,
    targetLibraryId,
  }) => {
    try {
      const manualWords = createManualWords(entries);
      let savedLibrary;

      if (destination === "new") {
        const trimmedName = libraryName.trim();
        if (!trimmedName) return "请输入新词库名称。";
        if (librariesRef.current.some((library) => library.name.trim() === trimmedName)) {
          return "该词库名称已存在，请换一个名称或选择“加入已有词库”。";
        }

        const created = createLibrary(trimmedName, manualWords);
        if (isCloudMode) {
          setCloudBusy(true);
          savedLibrary = await createCloudLibrary(session.user.id, created);
          const nextLibraries = [savedLibrary, ...librariesRef.current];
          librariesRef.current = nextLibraries;
          setLibraries(nextLibraries);
        } else {
          const nextLibraries = [created, ...librariesRef.current];
          if (!commitLibraries(nextLibraries)) {
            return "保存失败：浏览器本地存储空间不足或不可用。";
          }
          librariesRef.current = nextLibraries;
          savedLibrary = created;
        }
      } else {
        const targetLibrary = librariesRef.current.find(
          (library) => library.id === targetLibraryId,
        );
        if (!targetLibrary) return "没有找到所选词库，请返回后重试。";

        if (isCloudMode) {
          setCloudBusy(true);
          savedLibrary = await appendCloudWords(
            session.user.id,
            targetLibrary,
            manualWords,
          );
          const nextLibraries = librariesRef.current
            .map((library) => (
              library.id === savedLibrary.id ? savedLibrary : library
            ))
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
          librariesRef.current = nextLibraries;
          setLibraries(nextLibraries);
        } else {
          savedLibrary = updateLibrary(
            targetLibrary,
            targetLibrary.name,
            [...targetLibrary.words, ...manualWords],
          );
          const nextLibraries = librariesRef.current
            .map((library) => (
              library.id === savedLibrary.id ? savedLibrary : library
            ))
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
          if (!commitLibraries(nextLibraries)) {
            return "保存失败：浏览器本地存储空间不足或不可用。";
          }
          librariesRef.current = nextLibraries;
        }
      }

      openLibrary(savedLibrary, false);
      setSaveMessage(
        `已添加 ${manualWords.length} 个生词到“${savedLibrary.name}”。`,
      );
      return null;
    } catch (manualError) {
      return `保存失败：${manualError.message || "请稍后重试。"}`;
    } finally {
      if (isCloudMode) setCloudBusy(false);
    }
  };

  const saveCurrentLibrary = async (name, forceOverwrite = false) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setSaveMessage("请先输入词库名称。");
      return;
    }

    const sameNameLibrary = libraries.find(
      (library) => library.name.trim() === trimmedName,
    );
    const currentLibrary = libraries.find(
      (library) => library.id === currentLibraryId,
    );
    const overwriteTarget = sameNameLibrary || (forceOverwrite ? currentLibrary : null);

    if (forceOverwrite && !overwriteTarget) {
      setSaveMessage("没有找到可覆盖的词库，请先用该名称保存。");
      return;
    }

    if (overwriteTarget) {
      const confirmed = window.confirm(`“${overwriteTarget.name}”已经存在，确定覆盖吗？`);
      if (!confirmed) {
        setSaveMessage("未覆盖，请修改名称后再保存。");
        return;
      }

      const wordIds = new Set(words.map((word) => word.id));
      const updated = {
        ...updateLibrary(overwriteTarget, trimmedName, words),
        starredWordIds: starredWordIds.filter((id) => wordIds.has(id)),
      };
      if (isCloudMode) {
        setCloudBusy(true);
        try {
          const cloudLibrary = await replaceCloudLibrary(
            session.user.id,
            overwriteTarget.id,
            updated,
          );
          setLibraries((items) => items
            .map((item) => (item.id === cloudLibrary.id ? cloudLibrary : item))
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
          setWords(cloudLibrary.words);
          setStarredWordIds(cloudLibrary.starredWordIds);
          setCurrentLibraryId(cloudLibrary.id);
          setSaveMessage(`已同步“${cloudLibrary.name}”。`);
        } catch (cloudError) {
          setSaveMessage(`云端保存失败：${cloudError.message}`);
        } finally {
          setCloudBusy(false);
        }
        return;
      }
      const nextLibraries = libraries
        .map((library) => (library.id === updated.id ? updated : library))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

      if (commitLibraries(nextLibraries)) {
        setCurrentLibraryId(updated.id);
        setDraftLibraryName(updated.name);
        setSaveMessage(`已覆盖“${updated.name}”。`);
      }
      return;
    }

    const created = {
      ...createLibrary(trimmedName, words),
      starredWordIds,
    };
    if (isCloudMode) {
      setCloudBusy(true);
      try {
        const cloudLibrary = await createCloudLibrary(session.user.id, created);
        setLibraries((items) => [cloudLibrary, ...items]);
        setWords(cloudLibrary.words);
        setStarredWordIds(cloudLibrary.starredWordIds);
        setCurrentLibraryId(cloudLibrary.id);
        setDraftLibraryName(cloudLibrary.name);
        setSaveMessage(`已同步“${cloudLibrary.name}”。`);
      } catch (cloudError) {
        setSaveMessage(`云端保存失败：${cloudError.message}`);
      } finally {
        setCloudBusy(false);
      }
      return;
    }
    const nextLibraries = [created, ...libraries];
    if (commitLibraries(nextLibraries)) {
      setCurrentLibraryId(created.id);
      setDraftLibraryName(created.name);
      setSaveMessage(`已保存“${created.name}”。`);
    }
  };

  const deleteLibrary = async (library) => {
    const confirmed = window.confirm(`确定删除词库“${library.name}”吗？`);
    if (!confirmed) return;
    if (isCloudMode) {
      setCloudBusy(true);
      try {
        await deleteCloudLibrary(session.user.id, library.id);
        setLibraries((items) => items.filter((item) => item.id !== library.id));
      } catch (cloudError) {
        setAccountMessage(`云端删除失败：${cloudError.message}`);
      } finally {
        setCloudBusy(false);
      }
      return;
    }
    commitLibraries(libraries.filter((item) => item.id !== library.id));
  };

  const overwriteTargetExists = Boolean(
    libraries.find((library) => library.id === currentLibraryId)
    || libraries.find((library) => library.name.trim() === draftLibraryName.trim()),
  );

  const toggleStar = (wordId) => {
    const nextStarredWordIds = starredWordIds.includes(wordId)
      ? starredWordIds.filter((id) => id !== wordId)
      : [...starredWordIds, wordId];

    if (!currentLibraryId) {
      starredWordIdsRef.current = nextStarredWordIds;
      setStarredWordIds(nextStarredWordIds);
      return;
    }

    const nextLibraries = libraries.map((library) => (
      library.id === currentLibraryId
        ? { ...library, starredWordIds: nextStarredWordIds }
        : library
    ));
    if (isCloudMode) {
      setLibraries(nextLibraries);
      starredWordIdsRef.current = nextStarredWordIds;
      setStarredWordIds(nextStarredWordIds);
      updateCloudWord(session.user.id, currentLibraryId, wordId, {
        starred: nextStarredWordIds.includes(wordId),
      }).catch((cloudError) => {
        setAccountMessage(`星标同步失败：${cloudError.message}`);
      });
      return;
    }
    if (commitLibraries(nextLibraries)) {
      starredWordIdsRef.current = nextStarredWordIds;
      setStarredWordIds(nextStarredWordIds);
    }
  };

  const masterWord = (wordId) => {
    const nextWords = words.map((word) => (
      word.id === wordId ? { ...word, mastered: true } : word
    ));

    if (!currentLibraryId) {
      wordsRef.current = nextWords;
      setWords(nextWords);
      return true;
    }

    const nextLibraries = libraries.map((library) => (
      library.id === currentLibraryId
        ? { ...library, words: nextWords }
        : library
    ));

    if (isCloudMode) {
      setLibraries(nextLibraries);
      wordsRef.current = nextWords;
      setWords(nextWords);
      updateCloudWord(session.user.id, currentLibraryId, wordId, {
        mastered: true,
      }).catch((cloudError) => {
        setAccountMessage(`掌握状态同步失败：${cloudError.message}`);
      });
      return true;
    }

    if (!commitLibraries(nextLibraries)) return false;
    wordsRef.current = nextWords;
    setWords(nextWords);
    return true;
  };

  const saveProgress = (sessionIndex, wordId) => {
    if (!currentLibraryId) return;
    const currentWords = wordsRef.current;
    const wordIndex = currentWords.findIndex((word) => word.id === wordId);
    const lastIndex = wordIndex >= 0 ? wordIndex : sessionIndex;
    const restoredWords = getWordsForMode(
      currentWords,
      starredWordIdsRef.current,
      studyMode,
    );
    const restoredIndex = restoredWords.findIndex((word) => word.id === wordId);
    const reviewIndex = restoredIndex >= 0 ? restoredIndex : sessionIndex;
    const nextLibraries = librariesRef.current.map((library) => (
      library.id === currentLibraryId
        ? { ...library, lastIndex }
        : library
    ));
    librariesRef.current = nextLibraries;
    if (!isCloudMode) {
      try {
        persistLibraries(nextLibraries);
      } catch {
        setSaveMessage("进度保存失败：浏览器本地存储空间不足或不可用。");
      }
    }
    setLibraries(nextLibraries);
    saveAppSession({
      screen: "review",
      listId: currentLibraryId,
      mode: studyMode,
      index: reviewIndex,
      showMeaning: false,
    });
    if (isCloudMode) {
      saveCloudProgress(
        session.user.id,
        currentLibraryId,
        lastIndex,
      ).catch((cloudError) => {
        setAccountMessage(`进度同步失败：${cloudError.message}`);
      });
    }
  };

  const saveMeaningState = (sessionIndex, wordId, showMeaning) => {
    if (!currentLibraryId) return;
    const restoredWords = getWordsForMode(
      wordsRef.current,
      starredWordIdsRef.current,
      studyMode,
    );
    const restoredIndex = restoredWords.findIndex((word) => word.id === wordId);
    saveAppSession({
      screen: "review",
      listId: currentLibraryId,
      mode: studyMode,
      index: restoredIndex >= 0 ? restoredIndex : sessionIndex,
      showMeaning,
    });
  };

  const resetCurrentProgress = () => {
    if (!currentLibraryId) return;
    const nextLibraries = librariesRef.current.map((library) => (
      library.id === currentLibraryId
        ? { ...library, lastIndex: 0 }
        : library
    ));
    librariesRef.current = nextLibraries;
    if (!isCloudMode) {
      try {
        persistLibraries(nextLibraries);
      } catch {
        setSaveMessage("进度保存失败：浏览器本地存储空间不足或不可用。");
      }
    }
    setLibraries(nextLibraries);
    if (isCloudMode) {
      saveCloudProgress(session.user.id, currentLibraryId, 0).catch((cloudError) => {
        setAccountMessage(`进度同步失败：${cloudError.message}`);
      });
    }
  };

  const migrateLocalLibraries = async () => {
    setCloudBusy(true);
    setAccountMessage("");
    try {
      let cloudLibraries = [...libraries];
      for (const localLibrary of localLibraries) {
        const duplicate = cloudLibraries.find(
          (item) => item.name.trim() === localLibrary.name.trim(),
        );
        if (duplicate && migrationStrategy === "skip") continue;
        if (duplicate && migrationStrategy === "overwrite") {
          const replaced = await replaceCloudLibrary(
            session.user.id,
            duplicate.id,
            localLibrary,
          );
          cloudLibraries = cloudLibraries.map((item) => (
            item.id === replaced.id ? replaced : item
          ));
          continue;
        }

        let name = localLibrary.name;
        if (duplicate && migrationStrategy === "rename") {
          let suffix = 2;
          while (cloudLibraries.some((item) => item.name === `${name} ${suffix}`)) {
            suffix += 1;
          }
          name = `${name} ${suffix}`;
        }
        const created = await createCloudLibrary(session.user.id, {
          ...localLibrary,
          name,
        });
        cloudLibraries.push(created);
      }
      setLibraries(await fetchCloudLibraries(session.user.id));
      setMigrationDismissed(true);
      setAccountMessage("本地词库已上传，原本地数据仍然保留。");
    } catch (cloudError) {
      setAccountMessage(`迁移失败：${cloudError.message}`);
    } finally {
      setCloudBusy(false);
    }
  };

  const startStudy = (mode, restart = false) => {
    const selectedWords = getWordsForMode(words, starredWordIds, mode);
    if (!selectedWords.length) return;
    const currentLibrary = libraries.find(
      (library) => library.id === currentLibraryId,
    );
    const maximumBaseIndex = Math.max(0, words.length - 1);
    const baseIndex = restart
      ? 0
      : Math.max(0, Math.min(maximumBaseIndex, currentLibrary?.lastIndex || 0));
    const baseWordId = words[baseIndex]?.id;
    let initialIndex = mode === "all"
      ? baseIndex
      : selectedWords.findIndex((word) => word.id === baseWordId);

    if (initialIndex < 0) {
      initialIndex = selectedWords.findIndex(
        (word) => words.findIndex((item) => item.id === word.id) >= baseIndex,
      );
    }
    if (initialIndex < 0) initialIndex = selectedWords.length - 1;

    if (restart) resetCurrentProgress();
    setStudyWords(selectedWords);
    setStudyMode(mode);
    setStudyInitialIndex(initialIndex);
    setStudyInitialRevealed(false);
    setStudyRunId((value) => value + 1);
    if (currentLibraryId) {
      saveAppSession({
        screen: "review",
        listId: currentLibraryId,
        mode,
        index: initialIndex,
        showMeaning: false,
      });
    }
    setView("study");
  };

  if (restorePending && (!authReady || !librariesReady)) {
    return <RestoreLoadingView />;
  }

  if (view === "study" && studyWords.length) {
    return (
      <StudyView
        key={studyRunId}
        words={studyWords}
        starredWordIds={starredWordIds}
        onToggleStar={toggleStar}
        onMaster={masterWord}
        initialIndex={studyInitialIndex}
        initialRevealed={studyInitialRevealed}
        onProgress={saveProgress}
        onMeaningChange={saveMeaningState}
        onExit={() => {
          saveHomeSession();
          setView("list");
        }}
        onRestart={() => startStudy(studyMode, true)}
        onReset={reset}
      />
    );
  }

  if (view === "manual") {
    return (
      <ManualAddView
        libraries={libraries}
        busy={cloudBusy}
        onSave={saveManualWords}
        onCancel={() => {
          saveHomeSession();
          setView("upload");
        }}
      />
    );
  }

  if (view === "mode" && words.length) {
    return (
      <StudyModeView
        wordCount={words.length}
        starredCount={starredWordIds.length}
        masteredCount={countMastered(words)}
        onSelect={startStudy}
        onBack={() => setView("list")}
      />
    );
  }

  if (view === "list" && words.length) {
    return (
      <ListView
        words={words}
        fileName={fileName}
        initialLibraryName={draftLibraryName}
        canOverwrite={overwriteTargetExists}
        saveMessage={saveMessage}
        onNameChange={(name) => {
          setDraftLibraryName(name);
          setSaveMessage("");
        }}
        onSave={(name) => saveCurrentLibrary(name, false)}
        onOverwrite={(name) => saveCurrentLibrary(name, true)}
        onStart={() => setView("mode")}
        onReset={reset}
      />
    );
  }

  return (
    <UploadView
      onUpload={handleUpload}
      onManualAdd={() => {
        saveHomeSession();
        setView("manual");
      }}
      loading={loading}
      error={error}
      libraries={libraries}
      onOpenLibrary={(library) => openLibrary(library, false)}
      onStartLibrary={(library) => openLibrary(library, true)}
      onDeleteLibrary={deleteLibrary}
      accountPanel={(
        <AccountPanel
          session={session}
          busy={cloudBusy}
          message={accountMessage}
          onSignIn={handleSignIn}
          onSignUp={handleSignUp}
          onSignOut={handleSignOut}
        />
      )}
      migrationNotice={
        session && localLibraries.length > 0 && !migrationDismissed
          ? (
              <MigrationNotice
                hasConflicts={hasMigrationConflicts}
                strategy={migrationStrategy}
                busy={cloudBusy}
                onStrategyChange={setMigrationStrategy}
                onMigrate={migrateLocalLibraries}
                onDismiss={() => setMigrationDismissed(true)}
              />
            )
          : null
      }
    />
  );
}
