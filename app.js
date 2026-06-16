(function () {
  var directory = window.ReceptionDirectory.loadBundledDirectory();
  var records = directory.records;
  var recognition = null;
  var listening = false;
  var currentMatches = [];

  var elements = {
    candidateList: document.getElementById("candidateList"),
    departmentInput: document.getElementById("departmentInput"),
    directoryCount: document.getElementById("directoryCount"),
    directoryUpdated: document.getElementById("directoryUpdated"),
    guideMessage: document.getElementById("guideMessage"),
    manualSearchButton: document.getElementById("manualSearchButton"),
    nameInput: document.getElementById("nameInput"),
    resetButton: document.getElementById("resetButton"),
    resultCard: document.getElementById("resultCard"),
    statusMessage: document.getElementById("statusMessage"),
    stopButton: document.getElementById("stopButton"),
    transcriptInput: document.getElementById("transcriptInput"),
    transcriptSearchButton: document.getElementById("transcriptSearchButton"),
    voiceButton: document.getElementById("voiceButton"),
    voiceSupportNote: document.getElementById("voiceSupportNote")
  };

  function setGuide(message) {
    elements.guideMessage.textContent = message;
  }

  function setStatus(message, tone) {
    elements.statusMessage.textContent = message;
    elements.statusMessage.classList.remove("is-success", "is-warning", "is-danger");

    if (tone === "success") {
      elements.statusMessage.classList.add("is-success");
    } else if (tone === "warning") {
      elements.statusMessage.classList.add("is-warning");
    } else if (tone === "danger") {
      elements.statusMessage.classList.add("is-danger");
    }
  }

  function renderSourceMeta() {
    elements.directoryCount.textContent = String(directory.recordCount) + "件";
    elements.directoryUpdated.textContent = window.ReceptionDirectory.formatTimestamp(directory.updatedAt);
  }

  function renderEmpty(title, description) {
    elements.resultCard.className = "result-card empty";
    elements.resultCard.innerHTML =
      '<p class="result-kicker">待機中</p>' +
      '<p class="result-main">' + window.ReceptionDirectory.escapeHtml(title) + "</p>" +
      '<p class="result-sub">' + window.ReceptionDirectory.escapeHtml(description) + "</p>";
  }

  function renderResult(record, sourceLabel) {
    elements.resultCard.className = "result-card";
    elements.resultCard.innerHTML =
      '<p class="result-kicker">' + window.ReceptionDirectory.escapeHtml(sourceLabel) + "</p>" +
      '<p class="result-main">' +
      window.ReceptionDirectory.escapeHtml(record.department) +
      " / " +
      window.ReceptionDirectory.escapeHtml(record.name) +
      "</p>" +
      '<p class="result-extension"><strong>' +
      window.ReceptionDirectory.escapeHtml(record.extension) +
      '</strong><span>内線番号</span></p>' +
      '<p class="result-sub">内線番号を担当者へお伝えください。</p>';
  }

  function renderCandidates(matches) {
    currentMatches = matches.slice(0, 5);

    if (currentMatches.length <= 1) {
      elements.candidateList.hidden = true;
      elements.candidateList.innerHTML = "";
      return;
    }

    elements.candidateList.hidden = false;
    elements.candidateList.innerHTML = currentMatches
      .map(function (match, index) {
        return (
          '<button class="candidate-item" type="button" data-index="' +
          index +
          '">' +
          '<strong>' +
          window.ReceptionDirectory.escapeHtml(match.record.department) +
          " / " +
          window.ReceptionDirectory.escapeHtml(match.record.name) +
          "</strong>" +
          "<span>候補です。タップすると内線番号を表示します。</span>" +
          "</button>"
        );
      })
      .join("");
  }

  function showMatches(matches, sourceLabel) {
    if (!matches.length) {
      renderCandidates([]);
      renderEmpty("一致しませんでした", "音声が違う場合は、部署名とお名前を手入力してください。");
      setGuide("候補が見つかりませんでした。部署名とお名前をもう一度教えてください。");
      setStatus("一致する担当者が見つかりませんでした。手入力もお試しください。", "warning");
      return;
    }

    renderResult(matches[0].record, sourceLabel);
    renderCandidates(matches);

    if (matches.length === 1) {
      setGuide("内線番号を表示しました。必要であれば別の方を続けて検索できます。");
      setStatus("1件見つかりました。", "success");
      return;
    }

    setGuide("最有力候補を表示しています。別候補がある場合は一覧から選び直してください。");
    setStatus("複数候補があります。必要なら下の候補をタップしてください。", "warning");
  }

  function runManualSearch() {
    var department = elements.departmentInput.value.trim();
    var name = elements.nameInput.value.trim();
    var matches = window.ReceptionDirectory.searchRecords(records, department, name).slice(0, 5);

    if (!department && !name) {
      setStatus("部署名またはお名前を入力してください。", "warning");
      return;
    }

    showMatches(matches, "手入力の検索結果");
  }

  function runTranscriptSearch() {
    var transcript = elements.transcriptInput.value.trim();

    if (!transcript) {
      setStatus("認識テキストが空です。音声入力または手入力を使ってください。", "warning");
      return;
    }

    var inference = window.ReceptionDirectory.inferFromTranscript(transcript, records);
    var matches = inference.matches.slice(0, 5);

    if (inference.confidence === "high") {
      setStatus("音声から高い確度で候補を見つけました。", "success");
    } else if (inference.confidence === "medium") {
      setStatus("音声から候補を見つけました。候補一覧も確認してください。", "warning");
    }

    showMatches(matches, "音声検索の結果");
  }

  function resetForm() {
    elements.departmentInput.value = "";
    elements.nameInput.value = "";
    elements.transcriptInput.value = "";
    currentMatches = [];
    renderCandidates([]);
    renderEmpty("部署名とお名前を入力してください。", "一致した担当者の内線番号をここに表示します。");
    setGuide("音声または手入力で、部署名とお名前を教えてください。");
    setStatus("受付を開始できます。", "");
  }

  function chooseCandidate(index) {
    var match = currentMatches[index];
    if (!match) {
      return;
    }
    renderResult(match.record, "候補から選択");
    setGuide("候補から選択した担当者の内線番号を表示しています。");
    setStatus("候補を確定しました。", "success");
  }

  function updateListeningState(active) {
    listening = active;
    elements.voiceButton.hidden = active;
    elements.stopButton.hidden = !active;
    elements.voiceSupportNote.textContent = active
      ? "音声を聞き取っています。話し終えたら自動で検索します。"
      : "このブラウザで音声検索が利用できます。";
  }

  function setupSpeechRecognition() {
    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      elements.voiceButton.disabled = true;
      elements.voiceSupportNote.textContent =
        "このブラウザでは Web 音声認識を利用できません。iPad キーボードの音声入力か手入力をご利用ください。";
      return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = "ja-JP";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    elements.voiceSupportNote.textContent = "このブラウザで音声検索が利用できます。";

    recognition.onstart = function () {
      updateListeningState(true);
      setGuide("部署名とお名前をそのまま話してください。");
      setStatus("音声入力を開始しました。", "success");
    };

    recognition.onresult = function (event) {
      var transcript = "";
      var finalTranscript = "";

      for (var index = event.resultIndex; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript;
        if (event.results[index].isFinal) {
          finalTranscript += event.results[index][0].transcript;
        }
      }

      elements.transcriptInput.value = transcript.trim();

      if (finalTranscript.trim()) {
        elements.transcriptInput.value = finalTranscript.trim();
        runTranscriptSearch();
      }
    };

    recognition.onerror = function (event) {
      updateListeningState(false);
      setGuide("音声認識を開始できませんでした。手入力でも検索できます。");
      setStatus("音声認識エラー: " + event.error + "。必要であれば手入力をご利用ください。", "danger");
    };

    recognition.onend = function () {
      if (listening) {
        updateListeningState(false);
      }
    };
  }

  function bindEvents() {
    elements.manualSearchButton.addEventListener("click", runManualSearch);
    elements.transcriptSearchButton.addEventListener("click", runTranscriptSearch);
    elements.resetButton.addEventListener("click", resetForm);

    elements.departmentInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        runManualSearch();
      }
    });

    elements.nameInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        runManualSearch();
      }
    });

    elements.voiceButton.addEventListener("click", function () {
      if (!recognition) {
        return;
      }

      try {
        recognition.start();
      } catch (error) {
        setStatus("音声認識を開始できませんでした。時間をおいて再試行してください。", "danger");
      }
    });

    elements.stopButton.addEventListener("click", function () {
      if (recognition && listening) {
        recognition.stop();
      }
    });

    elements.candidateList.addEventListener("click", function (event) {
      var button = event.target.closest("[data-index]");
      if (!button) {
        return;
      }
      chooseCandidate(Number(button.getAttribute("data-index")));
    });
  }

  renderSourceMeta();
  renderEmpty("部署名とお名前を入力してください。", "一致した担当者の内線番号をここに表示します。");
  bindEvents();
  setupSpeechRecognition();
})();
