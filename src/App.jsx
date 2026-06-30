import { useEffect, useRef, useState } from "react";
import mammoth from "mammoth";
import {
  createLibrary,
  loadLibraries,
  persistLibraries,
  updateLibrary,
} from "./libraryStorage";
import { parseVocabulary } from "./parser";

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

function UploadView({
  onUpload,
  loading,
  error,
  libraries,
  onOpenLibrary,
  onStartLibrary,
  onDeleteLibrary,
}) {
  const inputRef = useRef(null);

  return (
    <main className="upload-page">
      <div className="home-shell">
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
          <button
            className="primary-button upload-button"
            type="button"
            disabled={loading}
            onClick={() => inputRef.current?.click()}
          >
            {loading ? "正在解析…" : "选择 .docx 文件"}
          </button>
          <p className="format-note">每行一个单词或词组：英文在前，中文释义在后</p>
          {error && <p className="error-message" role="alert">{error}</p>}
        </section>

        {libraries.length > 0 && (
          <section className="library-section">
            <div className="library-heading">
              <h2>我的词库</h2>
              <span>{libraries.length} 个</span>
            </div>
            <div className="library-list">
              {libraries.map((library) => (
                <article className="library-row" key={library.id}>
                  <button
                    className="library-main"
                    type="button"
                    onClick={() => onOpenLibrary(library)}
                  >
                    <strong>{library.name}</strong>
                    <span>{library.words.length} 个单词</span>
                    <span className="library-star-count">
                      ★ 重点词 {library.starredWordIds.length}
                    </span>
                    <span className="library-mastered-count">
                      ◆ 已掌握 {countMastered(library.words)}
                    </span>
                    <span>
                      剩余 {library.words.length - countMastered(library.words)} 个
                    </span>
                    <span>更新于 {formatUpdatedAt(library.updatedAt)}</span>
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
              ))}
            </div>
          </section>
        )}
      </div>
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
  onExit,
  onReset,
}) {
  const [sessionWords, setSessionWords] = useState(words);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
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
        setRevealed((value) => !value);
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onExit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [index, isMastering, onExit, sessionWords.length]);

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
      setIndex((currentIndex) => Math.min(currentIndex, nextWords.length - 1));
      setCompletedCount((count) => count + 1);
      setRevealed(false);
      setIsMastering(false);
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
    setRevealed((value) => !value);
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
            <button className="reveal-button" type="button" onClick={() => setRevealed(true)}>
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
      </footer>
    </main>
  );
}

export default function App() {
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
  const [saveMessage, setSaveMessage] = useState("");

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
      setView("list");
    } catch (uploadError) {
      setError(uploadError.message || "文档解析失败，请换一个文件重试。");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
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
    setWords(library.words);
    setFileName("已保存词库");
    setCurrentLibraryId(library.id);
    setDraftLibraryName(library.name);
    setStarredWordIds(library.starredWordIds);
    setStudyWords([]);
    setSaveMessage("");
    setView(startImmediately ? "mode" : "list");
  };

  const saveCurrentLibrary = (name, forceOverwrite = false) => {
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
    const nextLibraries = [created, ...libraries];
    if (commitLibraries(nextLibraries)) {
      setCurrentLibraryId(created.id);
      setDraftLibraryName(created.name);
      setSaveMessage(`已保存“${created.name}”。`);
    }
  };

  const deleteLibrary = (library) => {
    const confirmed = window.confirm(`确定删除词库“${library.name}”吗？`);
    if (!confirmed) return;
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
      setStarredWordIds(nextStarredWordIds);
      return;
    }

    const nextLibraries = libraries.map((library) => (
      library.id === currentLibraryId
        ? { ...library, starredWordIds: nextStarredWordIds }
        : library
    ));
    if (commitLibraries(nextLibraries)) {
      setStarredWordIds(nextStarredWordIds);
    }
  };

  const masterWord = (wordId) => {
    const nextWords = words.map((word) => (
      word.id === wordId ? { ...word, mastered: true } : word
    ));

    if (!currentLibraryId) {
      setWords(nextWords);
      return true;
    }

    const nextLibraries = libraries.map((library) => (
      library.id === currentLibraryId
        ? { ...library, words: nextWords }
        : library
    ));

    if (!commitLibraries(nextLibraries)) return false;
    setWords(nextWords);
    return true;
  };

  const startStudy = (mode) => {
    let selectedWords = words;

    if (mode === "unmastered") {
      selectedWords = words.filter((word) => !word.mastered);
    }
    if (mode === "mastered") {
      selectedWords = words.filter((word) => word.mastered);
    }
    if (mode === "starred") {
      selectedWords = words.filter((word) => starredWordIds.includes(word.id));
    }

    if (!selectedWords.length) return;
    setStudyWords(selectedWords);
    setView("study");
  };

  if (view === "study" && studyWords.length) {
    return (
      <StudyView
        words={studyWords}
        starredWordIds={starredWordIds}
        onToggleStar={toggleStar}
        onMaster={masterWord}
        onExit={() => setView("list")}
        onReset={reset}
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
      loading={loading}
      error={error}
      libraries={libraries}
      onOpenLibrary={(library) => openLibrary(library, false)}
      onStartLibrary={(library) => openLibrary(library, true)}
      onDeleteLibrary={deleteLibrary}
    />
  );
}
