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
                    <span>
                      {library.words.length} 个单词 · 更新于 {formatUpdatedAt(library.updatedAt)}
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

function StudyView({ words, onExit, onReset }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const startX = useRef(null);
  const didSwipe = useRef(false);
  const lastWheelAt = useRef(0);
  const current = words[index];

  const goTo = (nextIndex) => {
    const boundedIndex = Math.max(0, Math.min(words.length - 1, nextIndex));
    if (boundedIndex !== index) {
      setIndex(boundedIndex);
      setRevealed(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goTo(index + 1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goTo(index - 1);
      }
      if (event.key === " ") {
        event.preventDefault();
        setRevealed((value) => !value);
      }
      if (event.key === "Enter") {
        event.preventDefault();
        goTo(index + 1);
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onExit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [index, onExit]);

  const handlePointerDown = (event) => {
    if (
      event.pointerType !== "touch"
      || window.matchMedia("(min-width: 768px)").matches
    ) return;
    startX.current = event.clientX;
    didSwipe.current = false;
  };

  const handlePointerUp = (event) => {
    if (
      event.pointerType !== "touch"
      || window.matchMedia("(min-width: 768px)").matches
    ) return;
    if (startX.current === null) return;
    const distance = event.clientX - startX.current;
    startX.current = null;

    if (Math.abs(distance) < 50) return;
    didSwipe.current = true;
    // Follow the requested gesture: swipe right for next, swipe left for previous.
    if (distance > 0) goTo(index + 1);
    if (distance < 0) goTo(index - 1);
  };

  const handlePageClick = (event) => {
    if (didSwipe.current) {
      didSwipe.current = false;
      return;
    }
    if (event.target.closest("button")) return;
    if (
      event.target.closest(
        ".study-word, .study-meaning, .study-header, .study-footer",
      )
    ) return;
    setRevealed((value) => !value);
  };

  const handleWheel = (event) => {
    if (Math.abs(event.deltaY) < 8) return;
    const now = Date.now();
    if (now - lastWheelAt.current < 350) return;
    lastWheelAt.current = now;

    if (event.deltaY > 0) goTo(index + 1);
    if (event.deltaY < 0) goTo(index - 1);
  };

  return (
    <main
      className="study-page"
      onClick={handlePageClick}
      onDoubleClick={() => setRevealed(true)}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { startX.current = null; }}
    >
      <header className="study-header">
        <button className="header-button" type="button" onClick={onExit}>
          ← 返回列表
        </button>
        <button className="header-button" type="button" onClick={onReset}>
          重新上传
        </button>
      </header>

      <button
        className="desktop-nav desktop-nav-previous"
        type="button"
        disabled={index === 0}
        onClick={() => goTo(index - 1)}
        aria-label="上一个单词"
      >
        <span aria-hidden="true">‹</span> 上一个
      </button>
      <button
        className="desktop-nav desktop-nav-next"
        type="button"
        disabled={index === words.length - 1}
        onClick={() => goTo(index + 1)}
        aria-label="下一个单词"
      >
        下一个 <span aria-hidden="true">›</span>
      </button>

      <section className="card-stage" key={index} aria-live="polite">
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
          <span style={{ width: `${((index + 1) / words.length) * 100}%` }} />
        </div>
        <p className="progress-text">
          <strong>{index + 1}</strong><span> / {words.length}</span>
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
    setSaveMessage("");
    setView(startImmediately ? "study" : "list");
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

      const updated = updateLibrary(overwriteTarget, trimmedName, words);
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

    const created = createLibrary(trimmedName, words);
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

  if (view === "study" && words.length) {
    return (
      <StudyView
        words={words}
        onExit={() => setView("list")}
        onReset={reset}
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
        onStart={() => setView("study")}
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
