(function () {
  "use strict";

  const core = window.StylePortCore;
  const photoInput = document.querySelector("#photoInput");
  const dropZone = document.querySelector("#dropZone");
  const emptyState = document.querySelector("#emptyState");
  const queueState = document.querySelector("#queueState");
  const queueCount = document.querySelector("#queueCount");
  const fileList = document.querySelector("#fileList");
  const addMoreButton = document.querySelector("#addMoreButton");
  const clearButton = document.querySelector("#clearButton");
  const convertButton = document.querySelector("#convertButton");
  const convertButtonText = document.querySelector("#convertButtonText");
  const downloadAllButton = document.querySelector("#downloadAllButton");
  const resultSummary = document.querySelector("#resultSummary");
  const queueProgress = document.querySelector("#queueProgress");
  const progressText = document.querySelector("#progressText");
  const progressPercent = document.querySelector("#progressPercent");
  const progressBar = document.querySelector("#progressBar");
  const toast = document.querySelector("#toast");

  const state = {
    files: [],
    busy: false,
    toastTimer: 0,
    nextID: 1,
  };

  const placeholderMarkup = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="14" rx="2.5"></rect>
      <circle cx="9" cy="10" r="1.6"></circle>
      <path d="m5.5 16 4.2-4.2 3.1 3.1 2.2-2.2 3.5 3.3"></path>
    </svg>
  `;

  function nextPaint() {
    return new Promise((resolve) => setTimeout(resolve, 16));
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
    const units = ["B", "KB", "MB", "GB"];
    const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 3);
    const value = bytes / 1024 ** unit;
    return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
  }

  function safeName(name) {
    const leaf = String(name || "Photo.HEIC").split(/[\\/]/).pop();
    return leaf && leaf !== "." && leaf !== ".." ? leaf : "Photo.HEIC";
  }

  function outputName(name) {
    const safe = safeName(name);
    const dot = safe.lastIndexOf(".");
    let stem = dot > 0 ? safe.slice(0, dot) : safe;
    if (!stem) stem = "Photo";
    const characters = Array.from(stem);
    if (characters.length > 54) stem = characters.slice(0, 54).join("");
    return `${stem}_GP.HEIC`;
  }

  function statusLabel(status) {
    return {
      analyzing: "正在识别",
      compatible: "可转换",
      processing: "正在转换",
      success: "已转换",
      already: "已含风格 3",
      incompatible: "不兼容",
      failed: "转换失败",
    }[status] || "";
  }

  function showToast(message) {
    window.clearTimeout(state.toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    state.toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 4200);
  }

  function releaseOutput(file) {
    if (file.downloadUrl) URL.revokeObjectURL(file.downloadUrl);
    if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
    file.downloadUrl = "";
    file.previewUrl = "";
  }

  function makeThumb(file) {
    const thumb = document.createElement("div");
    thumb.className = "file-thumb";
    const placeholder = document.createElement("span");
    placeholder.className = "file-thumb-placeholder";
    placeholder.innerHTML = placeholderMarkup;
    thumb.append(placeholder);

    const image = document.createElement("img");
    image.alt = "";
    image.style.display = "none";
    image.addEventListener("load", () => {
      image.style.display = "block";
      placeholder.hidden = true;
    });
    image.addEventListener("error", () => {
      image.remove();
    });
    image.src = file.previewUrl;
    thumb.append(image);
    return thumb;
  }

  function makeDownloadLink(file) {
    const link = document.createElement("a");
    link.className = "file-download";
    link.href = file.downloadUrl;
    link.download = file.outputName;
    link.setAttribute("aria-label", `下载 ${file.outputName}`);
    link.innerHTML = `
      下载
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4v10M8 10l4 4 4-4M5 19h14"></path>
      </svg>
    `;
    return link;
  }

  function makeRemoveButton(file) {
    const button = document.createElement("button");
    button.className = "remove-file";
    button.type = "button";
    button.setAttribute("aria-label", `移除 ${file.name}`);
    button.disabled = state.busy;
    button.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m7 7 10 10M17 7 7 17"></path>
      </svg>
    `;
    button.addEventListener("click", () => {
      if (state.busy) return;
      releaseOutput(file);
      state.files = state.files.filter((item) => item.id !== file.id);
      render();
    });
    return button;
  }

  function makeFileRow(file) {
    const row = document.createElement("article");
    row.className = "file-row";
    row.dataset.id = String(file.id);

    const details = document.createElement("div");
    details.className = "file-details";
    const name = document.createElement("span");
    name.className = "file-name";
    name.textContent = file.name;
    name.title = file.error || file.name;
    const meta = document.createElement("div");
    meta.className = "file-meta";
    const size = document.createElement("span");
    size.textContent = formatBytes(file.size);
    const status = document.createElement("span");
    status.className = `file-status ${file.status}`;
    status.textContent = statusLabel(file.status);
    if (file.error) status.title = file.error;
    meta.append(size, status);
    details.append(name, meta);

    const actions = document.createElement("div");
    actions.className = "file-actions";
    if (file.status === "success" && file.downloadUrl) {
      actions.append(makeDownloadLink(file));
    }
    actions.append(makeRemoveButton(file));

    row.append(makeThumb(file), details, actions);
    return row;
  }

  function successfulFiles() {
    return state.files.filter((file) => file.status === "success");
  }

  function compatibleFiles() {
    return state.files.filter((file) => file.status === "compatible");
  }

  function updateControls() {
    const analyzing = state.files.some((file) => file.status === "analyzing");
    const actionable = compatibleFiles().length;
    convertButton.disabled = state.busy || analyzing || actionable === 0;
    clearButton.disabled = state.busy;
    addMoreButton.disabled = state.busy;
    photoInput.disabled = state.busy;
    queueCount.textContent = `${state.files.length} 张照片`;

    if (state.busy) {
      convertButtonText.textContent = "正在转换";
    } else if (analyzing) {
      convertButtonText.textContent = "正在识别";
    } else if (actionable > 0) {
      convertButtonText.textContent = `转换 ${actionable} 张照片`;
    } else if (state.files.some((file) => file.status === "success")) {
      convertButtonText.textContent = "转换完成";
    } else {
      convertButtonText.textContent = "无可转换照片";
    }

    const successes = successfulFiles().length;
    downloadAllButton.hidden = successes === 0;
    downloadAllButton.textContent =
      successes > 1 ? `下载全部 ${successes} 个结果` : "下载转换结果";
  }

  function updateSummary() {
    const successes = successfulFiles().length;
    const failures = state.files.filter((file) => file.status === "failed").length;
    const skipped = state.files.filter(
      (file) => file.status === "already" || file.status === "incompatible"
    ).length;
    const processed =
      successes + failures + skipped > 0 &&
      !state.files.some(
        (file) =>
          file.status === "compatible" ||
          file.status === "processing" ||
          file.status === "analyzing"
      );

    if (!processed) {
      resultSummary.hidden = true;
      return;
    }
    const parts = [`成功 ${successes} 张`];
    if (skipped) parts.push(`跳过 ${skipped} 张`);
    if (failures) parts.push(`失败 ${failures} 张`);
    resultSummary.textContent = `${parts.join(" · ")}。${successes ? "转换结果已准备好下载。" : "没有生成新的照片。"}`;
    resultSummary.classList.toggle("has-errors", failures > 0 || skipped > 0);
    resultSummary.hidden = false;
  }

  function render() {
    emptyState.hidden = state.files.length > 0;
    queueState.hidden = state.files.length === 0;
    if (!state.files.length) {
      resultSummary.hidden = true;
      queueProgress.hidden = true;
      return;
    }
    fileList.replaceChildren(...state.files.map(makeFileRow));
    updateControls();
    updateSummary();
  }

  async function analyzeFile(file) {
    try {
      const bytes = new Uint8Array(await file.file.arrayBuffer());
      const photo = core.extractPhotoData(bytes);
      const inspection = core.inspect(photo);
      file.isLiveWrapper = photo.length !== bytes.length;
      if (inspection.alreadyConverted) file.status = "already";
      else if (inspection.hasStyles) file.status = "compatible";
      else file.status = "incompatible";
    } catch (error) {
      file.status = "failed";
      file.error =
        error instanceof Error ? error.message : "无法读取这张 HEIC 照片。";
    }
    render();
  }

  async function addFiles(fileListObject) {
    if (state.busy) return;
    const incoming = Array.from(fileListObject || []);
    if (!incoming.length) return;

    const existing = new Set(
      state.files.map(
        (file) => `${file.name}:${file.size}:${file.lastModified}`
      )
    );
    const available = Math.max(0, 50 - state.files.length);
    const accepted = [];
    for (const browserFile of incoming) {
      const name = safeName(browserFile.name);
      const key = `${name}:${browserFile.size}:${browserFile.lastModified}`;
      if (existing.has(key)) continue;
      existing.add(key);
      accepted.push({
        id: state.nextID++,
        file: browserFile,
        name,
        size: browserFile.size,
        lastModified: browserFile.lastModified,
        outputName: outputName(name),
        status: "analyzing",
        previewUrl: URL.createObjectURL(browserFile),
        downloadUrl: "",
        error: "",
        isLiveWrapper: false,
      });
      if (accepted.length >= available) break;
    }

    if (!accepted.length) {
      showToast(incoming.length >= 50 ? "一次最多处理 50 张照片。" : "这些照片已经添加过了。");
      return;
    }
    if (incoming.length > accepted.length && state.files.length + accepted.length >= 50) {
      showToast("网页版一次最多处理 50 张照片。");
    }
    state.files.push(...accepted);
    render();
    for (const file of accepted) {
      await analyzeFile(file);
    }
  }

  function setProgress(current, total) {
    queueProgress.hidden = false;
    const percent = total ? Math.round((current / total) * 100) : 0;
    progressText.textContent =
      current < total ? `正在处理第 ${current + 1} 张，共 ${total} 张` : "正在整理结果";
    progressPercent.textContent = `${percent}%`;
    progressBar.style.width = `${percent}%`;
  }

  async function convertAll() {
    const queue = compatibleFiles();
    if (!queue.length || state.busy) return;

    state.busy = true;
    resultSummary.hidden = true;
    queueProgress.hidden = false;
    setProgress(0, queue.length);
    render();

    let succeeded = 0;
    let failed = 0;
    for (let index = 0; index < queue.length; index += 1) {
      const file = queue[index];
      file.status = "processing";
      file.error = "";
      setProgress(index, queue.length);
      render();
      await nextPaint();
      try {
        const bytes = new Uint8Array(await file.file.arrayBuffer());
        const result = core.convert(bytes);
        if (result.alreadyConverted) {
          file.status = "already";
        } else {
          if (file.downloadUrl) URL.revokeObjectURL(file.downloadUrl);
          const blob = new Blob([result.data], { type: "image/heic" });
          file.downloadUrl = URL.createObjectURL(blob);
          file.outputBytes = result.data.length;
          file.status = "success";
          succeeded += 1;
        }
      } catch (error) {
        file.status = "failed";
        file.error =
          error instanceof Error ? error.message : "转换失败，请重试。";
        failed += 1;
      }
      setProgress(index + 1, queue.length);
      render();
    }

    state.busy = false;
    progressBar.style.width = "100%";
    progressText.textContent = "处理完成";
    progressPercent.textContent = "100%";
    render();
    if (succeeded) {
      showToast(
        `${succeeded} 张照片已转换完成${failed ? `，${failed} 张失败` : ""}。`
      );
    } else if (failed) {
      showToast("未能生成新照片，请查看列表中的失败原因。");
    } else {
      showToast("没有需要转换的照片，已自动跳过。");
    }
  }

  function clearQueue() {
    if (state.busy) return;
    for (const file of state.files) releaseOutput(file);
    state.files = [];
    queueProgress.hidden = true;
    progressBar.style.width = "0%";
    render();
    photoInput.value = "";
  }

  function downloadAll() {
    const files = successfulFiles();
    if (!files.length) return;
    for (const file of files) {
      const link = document.createElement("a");
      link.href = file.downloadUrl;
      link.download = file.outputName;
      document.body.append(link);
      link.click();
      link.remove();
    }
    showToast(
      files.length > 1
        ? "已发起全部下载；若浏览器询问，请允许多文件下载。"
        : "已开始下载转换后的照片。"
    );
  }

  photoInput.addEventListener("change", () => {
    const files = Array.from(photoInput.files || []);
    photoInput.value = "";
    addFiles(files);
  });

  addMoreButton.addEventListener("click", () => {
    if (!state.busy) photoInput.click();
  });

  convertButton.addEventListener("click", convertAll);
  clearButton.addEventListener("click", clearQueue);
  downloadAllButton.addEventListener("click", downloadAll);

  for (const eventName of ["dragenter", "dragover"]) {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add("is-dragging");
    });
  }
  for (const eventName of ["dragleave", "drop"]) {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove("is-dragging");
    });
  }
  dropZone.addEventListener("drop", (event) => {
    if (state.busy) return;
    addFiles(event.dataTransfer.files);
  });

  window.addEventListener("dragover", (event) => event.preventDefault());
  window.addEventListener("drop", (event) => event.preventDefault());
  window.addEventListener("beforeunload", () => {
    for (const file of state.files) releaseOutput(file);
  });

  render();
})();
