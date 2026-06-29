# 极简背词 MVP

一个手机端优先的 React + Vite 单词卡网站。上传 `.docx` 后，页面会在浏览器内使用 Mammoth 解析“英文单词 + 中文释义”，无需后端。

## 启动

```bash
cd word-card-mvp
npm install
npm run dev
```

打开终端提示的本地地址（通常是 `http://localhost:5173`）。

## 文档格式

每行一个单词，英文在前、中文释义在后。支持空格、Tab、冒号或破折号分隔，例如：

```text
ungainly 笨拙的；不优雅的
ambiguous: 模棱两可的
arduous - 艰难的
```
