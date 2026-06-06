const reader = document.querySelector("#reader");
const toc = document.querySelector("#toc");
const progress = document.querySelector("#progress");
const backTop = document.querySelector("#backTop");
const themeToggle = document.querySelector("#themeToggle");
const fontPlus = document.querySelector("#fontPlus");
const fontMinus = document.querySelector("#fontMinus");
const currentSection = document.querySelector("#currentSection");
const readPercent = document.querySelector("#readPercent");
const sidePercent = document.querySelector("#sidePercent");
const sideSection = document.querySelector("#sideSection");
const tocToggle = document.querySelector("#tocToggle");
const tocClose = document.querySelector("#tocClose");
const tocScrim = document.querySelector("#tocScrim");
const prevChapter = document.querySelector("#prevChapter");
const nextChapter = document.querySelector("#nextChapter");

const state = {
  fontSize: Number(localStorage.getItem("timeSiteFontSize")) || 18,
  headings: [],
  currentId: "",
  restored: false,
};

document.documentElement.style.setProperty("--reader-size", `${state.fontSize}px`);
document.documentElement.dataset.theme = localStorage.getItem("timeSiteTheme") || "light";

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function slugify(text, index) {
  return `sec-${index}-${text
    .trim()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 36)}`;
}

function inlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  const headings = [];
  let inCode = false;
  let codeLines = [];
  let listOpen = false;
  let listTag = "ul";
  let blockquote = [];
  let highlightNextParagraph = false;
  let headingIndex = 0;

  const closeList = () => {
    if (listOpen) {
      html.push(`</${listTag}>`);
      listOpen = false;
      listTag = "ul";
    }
  };

  const closeBlockquote = () => {
    if (blockquote.length) {
      html.push(`<blockquote>${blockquote.map((line) => `<p>${inlineMarkdown(line)}</p>`).join("")}</blockquote>`);
      blockquote = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith("```")) {
      closeList();
      closeBlockquote();
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(rawLine);
      continue;
    }

    if (!line.trim()) {
      closeList();
      closeBlockquote();
      continue;
    }

    if (line === "---") {
      closeList();
      closeBlockquote();
      html.push('<div class="divider"></div>');
      continue;
    }

    if (line.startsWith(">")) {
      closeList();
      blockquote.push(line.replace(/^>\s?/, ""));
      continue;
    }

    closeBlockquote();

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      const id = slugify(text, headingIndex++);
      headings.push({ id, level, text });
      html.push(`<h${level} id="${id}">${inlineMarkdown(text)}</h${level}>`);
      highlightNextParagraph = text.includes("本章一句话");
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    const numberMatch = line.match(/^\d+\.\s+(.+)$/);
    if (bulletMatch) {
      if (listOpen && listTag !== "ul") closeList();
      if (!listOpen) {
        html.push("<ul>");
        listOpen = true;
        listTag = "ul";
      }
      html.push(`<li>${inlineMarkdown(bulletMatch[1])}</li>`);
      continue;
    }

    if (numberMatch) {
      if (listOpen && listTag !== "ol") closeList();
      if (!listOpen) {
        html.push("<ol>");
        listOpen = true;
        listTag = "ol";
      }
      html.push(`<li>${inlineMarkdown(numberMatch[1])}</li>`);
      continue;
    }

    closeList();

    if (highlightNextParagraph || /^.+一句话$/.test(line) || line.includes("本章一句话")) {
      html.push(`<p class="highlight">${inlineMarkdown(line)}</p>`);
      highlightNextParagraph = false;
    } else {
      html.push(`<p>${inlineMarkdown(line)}</p>`);
    }
  }

  closeList();
  closeBlockquote();
  state.headings = headings;
  return html.join("\n");
}

function buildToc() {
  toc.innerHTML = state.headings
    .filter((heading) => heading.level <= 2)
    .map(
      (heading) =>
        `<a class="level-${heading.level}" href="#${heading.id}" data-id="${heading.id}">${heading.text}</a>`,
    )
    .join("");

  toc.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeToc);
  });
}

function updateProgress() {
  const scrollTop = window.scrollY;
  const height = document.documentElement.scrollHeight - window.innerHeight;
  const percent = height > 0 ? (scrollTop / height) * 100 : 0;
  const rounded = Math.max(0, Math.min(100, Math.round(percent)));
  progress.style.width = `${percent}%`;
  readPercent.textContent = `${rounded}%`;
  sidePercent.textContent = `${rounded}%`;
  backTop.classList.toggle("visible", scrollTop > 700);

  if (rounded > 0) {
    localStorage.setItem("timeSiteScroll", String(scrollTop));
  }
}

function updateActiveToc() {
  let currentId = "";
  for (const heading of state.headings) {
    const element = document.getElementById(heading.id);
    if (element && element.getBoundingClientRect().top < 130) {
      currentId = heading.id;
    }
  }

  document.querySelectorAll(".toc a").forEach((link) => {
    link.classList.toggle("active", link.dataset.id === currentId);
  });

  const active = state.headings.find((heading) => heading.id === currentId);
  if (active) {
    state.currentId = active.id;
    currentSection.textContent = active.text;
    sideSection.textContent = active.text;
    updateChapterNav(active.id);
  }
}

function updateChapterNav(currentId) {
  const chapterHeadings = state.headings.filter((heading) => heading.level === 2);
  const currentElement = document.getElementById(currentId);
  const currentTop = currentElement ? currentElement.offsetTop : window.scrollY;
  let index = 0;
  chapterHeadings.forEach((heading, headingIndex) => {
    const element = document.getElementById(heading.id);
    if (element && element.offsetTop <= currentTop + 4) index = headingIndex;
  });
  const previous = chapterHeadings[index - 1];
  const next = chapterHeadings[index + 1];

  if (previous) {
    prevChapter.href = `#${previous.id}`;
    prevChapter.textContent = "上一章";
    prevChapter.removeAttribute("aria-disabled");
  } else {
    prevChapter.href = "#top";
    prevChapter.textContent = "顶部";
    prevChapter.removeAttribute("aria-disabled");
  }

  if (next) {
    nextChapter.href = `#${next.id}`;
    nextChapter.textContent = "下一章";
    nextChapter.removeAttribute("aria-disabled");
  } else {
    nextChapter.href = "#top";
    nextChapter.textContent = "回到顶部";
    nextChapter.removeAttribute("aria-disabled");
  }
}

function openToc() {
  document.body.classList.add("toc-open");
  tocToggle.setAttribute("aria-expanded", "true");
  tocScrim.hidden = false;
}

function closeToc() {
  document.body.classList.remove("toc-open");
  tocToggle.setAttribute("aria-expanded", "false");
  tocScrim.hidden = true;
}

async function loadBook() {
  try {
    const response = await fetch("./book.md", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const markdown = await response.text();
    reader.innerHTML = renderMarkdown(markdown);
    buildToc();
    requestAnimationFrame(() => {
      updateProgress();
      updateActiveToc();
      restoreScroll();
    });
  } catch (error) {
    reader.innerHTML = `
      <h1>书稿暂时无法载入</h1>
      <p>请从本地服务器打开这个页面，例如在工作区根目录启动静态服务后访问 <code>/time-site/</code>。</p>
      <pre><code>${escapeHtml(String(error))}</code></pre>
    `;
  }
}

function restoreScroll() {
  if (state.restored || location.hash) return;
  const saved = Number(localStorage.getItem("timeSiteScroll"));
  if (Number.isFinite(saved) && saved > 200) {
    window.scrollTo(0, saved);
    state.restored = true;
  }
}

function setupControls() {
  tocToggle.addEventListener("click", () => {
    if (document.body.classList.contains("toc-open")) closeToc();
    else openToc();
  });

  tocClose.addEventListener("click", closeToc);
  tocScrim.addEventListener("click", closeToc);

  themeToggle.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("timeSiteTheme", next);
  });

  fontPlus.addEventListener("click", () => {
    state.fontSize = Math.min(22, state.fontSize + 1);
    document.documentElement.style.setProperty("--reader-size", `${state.fontSize}px`);
    localStorage.setItem("timeSiteFontSize", String(state.fontSize));
  });

  fontMinus.addEventListener("click", () => {
    state.fontSize = Math.max(16, state.fontSize - 1);
    document.documentElement.style.setProperty("--reader-size", `${state.fontSize}px`);
    localStorage.setItem("timeSiteFontSize", String(state.fontSize));
  });

  backTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  window.addEventListener("scroll", () => {
    updateProgress();
    updateActiveToc();
  }, { passive: true });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeToc();
    if (event.key === "[" && prevChapter.href) prevChapter.click();
    if (event.key === "]" && nextChapter.href) nextChapter.click();
  });
}

function drawCanvas() {
  const canvas = document.querySelector("#timeCanvas");
  const context = canvas.getContext("2d");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let width = 0;
  let height = 0;
  let frame = 0;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function render() {
    frame += prefersReducedMotion ? 0 : 0.006;
    context.clearRect(0, 0, width, height);

    const dark = document.documentElement.dataset.theme === "dark";
    context.globalAlpha = dark ? 0.9 : 0.75;

    for (let i = 0; i < 11; i += 1) {
      const y = height * (0.16 + i * 0.07);
      const amplitude = 18 + i * 3;
      context.beginPath();
      for (let x = -40; x <= width + 40; x += 18) {
        const wave = Math.sin(x * 0.008 + frame * (1.6 + i * 0.12) + i) * amplitude;
        const slope = y + wave + x * 0.03;
        if (x === -40) context.moveTo(x, slope);
        else context.lineTo(x, slope);
      }
      context.strokeStyle = i % 2 === 0
        ? (dark ? "rgba(94,234,212,0.26)" : "rgba(15,118,110,0.24)")
        : (dark ? "rgba(251,191,36,0.18)" : "rgba(180,83,9,0.18)");
      context.lineWidth = i % 3 === 0 ? 2 : 1;
      context.stroke();
    }

    for (let i = 0; i < 46; i += 1) {
      const x = ((i * 97 + frame * 900) % (width + 140)) - 70;
      const y = height * (0.12 + ((i * 37) % 78) / 100);
      const radius = 1.8 + (i % 5) * 0.45;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fillStyle = i % 2 === 0
        ? (dark ? "rgba(236,231,220,0.42)" : "rgba(31,41,51,0.24)")
        : (dark ? "rgba(94,234,212,0.35)" : "rgba(15,118,110,0.32)");
      context.fill();
    }

    if (!prefersReducedMotion) requestAnimationFrame(render);
  }

  resize();
  render();
  window.addEventListener("resize", resize);
}

setupControls();
drawCanvas();
loadBook();
