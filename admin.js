(function () {
  var elements = {
    adminStatus: document.getElementById("adminStatus"),
    copyButton: document.getElementById("copyButton"),
    directoryFile: document.getElementById("directoryFile"),
    downloadButton: document.getElementById("downloadButton"),
    moduleOutput: document.getElementById("moduleOutput"),
    parseButton: document.getElementById("parseButton"),
    previewBody: document.getElementById("previewBody"),
    previewSummary: document.getElementById("previewSummary"),
    rawInput: document.getElementById("rawInput"),
    sampleText: document.getElementById("sampleText")
  };

  var latestPayload = null;
  var latestModuleText = "";

  function setStatus(message, tone) {
    elements.adminStatus.textContent = message;
    elements.adminStatus.classList.remove("is-success", "is-warning", "is-danger");

    if (tone === "success") {
      elements.adminStatus.classList.add("is-success");
    } else if (tone === "warning") {
      elements.adminStatus.classList.add("is-warning");
    } else if (tone === "danger") {
      elements.adminStatus.classList.add("is-danger");
    }
  }

  function renderPreview(payload) {
    if (!payload.records.length) {
      elements.previewSummary.innerHTML =
        '<p class="summary-main">該当データがありません。</p>' +
        '<p class="summary-sub">ファイル形式を確認してください。</p>';
      elements.previewBody.innerHTML = '<tr><td colspan="3">レコードが見つかりませんでした。</td></tr>';
      return;
    }

    elements.previewSummary.innerHTML =
      '<p class="summary-main">' +
      payload.records.length +
      '件を解析しました。</p>' +
      '<p class="summary-sub">更新対象: ' +
      window.ReceptionDirectory.escapeHtml(payload.sourceName) +
      ' / 生成時刻: ' +
      window.ReceptionDirectory.escapeHtml(window.ReceptionDirectory.formatTimestamp(payload.updatedAt)) +
      "</p>";

    elements.previewBody.innerHTML = payload.records
      .slice(0, 12)
      .map(function (record) {
        return (
          "<tr>" +
          "<td>" + window.ReceptionDirectory.escapeHtml(record.department) + "</td>" +
          "<td>" + window.ReceptionDirectory.escapeHtml(record.name) + "</td>" +
          "<td>" + window.ReceptionDirectory.escapeHtml(record.extension) + "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  function updateModuleOutput(payload) {
    latestPayload = payload;
    latestModuleText = window.ReceptionDirectory.exportDirectoryModule(payload);
    elements.moduleOutput.value = latestModuleText;
    elements.downloadButton.disabled = false;
    elements.copyButton.disabled = false;
  }

  function parseCurrentText(sourceName) {
    var text = elements.rawInput.value.trim();
    if (!text) {
      setStatus("内線表の内容が空です。", "warning");
      return;
    }

    var payload = window.ReceptionDirectory.parseDirectoryText(text, sourceName || "directory.txt");
    renderPreview(payload);
    updateModuleOutput(payload);

    if (!payload.records.length) {
      setStatus("3列の内線表として読み取れませんでした。区切り文字や列順を確認してください。", "danger");
      return;
    }

    setStatus("公開用の directory.js を生成しました。`,data/directory.js` を置き換えてください。", "success");
  }

  function handleFileSelection(file) {
    if (!file) {
      return;
    }

    var reader = new FileReader();
    reader.onload = function () {
      elements.rawInput.value = String(reader.result || "");
      parseCurrentText(file.name);
    };
    reader.onerror = function () {
      setStatus("ファイルを読み込めませんでした。", "danger");
    };
    reader.readAsText(file, "utf-8");
  }

  function downloadModule() {
    if (!latestModuleText) {
      return;
    }

    var blob = new Blob([latestModuleText], { type: "text/javascript;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "directory.js";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function copyModule() {
    if (!latestModuleText) {
      return;
    }

    navigator.clipboard
      .writeText(latestModuleText)
      .then(function () {
        setStatus("directory.js の内容をコピーしました。", "success");
      })
      .catch(function () {
        setStatus("コピーに失敗しました。必要であれば手動で選択してください。", "warning");
      });
  }

  function showCurrentSample() {
    var current = window.ReceptionDirectory.loadBundledDirectory();
    if (!current.records.length) {
      return;
    }

    elements.sampleText.textContent = current.records
      .slice(0, 3)
      .map(function (record, index) {
        var head = index === 0 ? "部署名,名前,内線番号\n" : "";
        return head + record.department + "," + record.name + "," + record.extension;
      })
      .join("\n");
  }

  elements.parseButton.addEventListener("click", function () {
    var file = elements.directoryFile.files && elements.directoryFile.files[0];
    parseCurrentText(file ? file.name : "pasted-directory.txt");
  });

  elements.directoryFile.addEventListener("change", function (event) {
    handleFileSelection(event.target.files && event.target.files[0]);
  });

  elements.downloadButton.addEventListener("click", downloadModule);
  elements.copyButton.addEventListener("click", copyModule);

  showCurrentSample();
})();
