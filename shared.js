(function () {
  function normalizeText(value) {
    return String(value || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[\s\u3000\-ー‐―]/g, "");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function createId(record, index) {
    var department = normalizeText(record.department || "dept").slice(0, 8) || "dept";
    var name = normalizeText(record.name || "name").slice(0, 8) || "name";
    return department + "-" + name + "-" + String(index + 1).padStart(3, "0");
  }

  function sanitizeRecords(records) {
    return (Array.isArray(records) ? records : [])
      .map(function (record, index) {
        var department = String(record.department || "").trim();
        var name = String(record.name || "").trim();
        var extension = String(record.extension || "").trim();

        if (!department || !name || !extension) {
          return null;
        }

        return {
          id: record.id || createId(record, index),
          department: department,
          name: name,
          extension: extension,
          normalizedDepartment: normalizeText(department),
          normalizedName: normalizeText(name),
          normalizedExtension: normalizeText(extension)
        };
      })
      .filter(Boolean);
  }

  function detectDelimiter(line) {
    if (!line) {
      return null;
    }
    if (line.indexOf("\t") >= 0) {
      return "\t";
    }
    if ((line.match(/,/g) || []).length >= 2) {
      return ",";
    }
    if ((line.match(/、/g) || []).length >= 2) {
      return "、";
    }
    if (/\s{2,}/.test(line)) {
      return "multi-space";
    }
    return null;
  }

  function splitLine(line, delimiter) {
    if (delimiter === "\t") {
      return line.split("\t");
    }
    if (delimiter === ",") {
      return line.split(",");
    }
    if (delimiter === "、") {
      return line.split("、");
    }
    if (delimiter === "multi-space") {
      return line.split(/\s{2,}/);
    }
    return line.split(/\s+/);
  }

  function inferColumnMap(cells) {
    var map = {
      department: 0,
      name: 1,
      extension: 2
    };

    cells.forEach(function (cell, index) {
      var normalized = normalizeText(cell);
      if (/(部署|部門|所属)/.test(normalized)) {
        map.department = index;
      } else if (/(名前|氏名|社員名)/.test(normalized)) {
        map.name = index;
      } else if (/(内線|電話|extension|ext)/.test(normalized)) {
        map.extension = index;
      }
    });

    return map;
  }

  function buildDirectoryPayload(records, meta) {
    var sanitized = sanitizeRecords(records);
    return {
      sourceName: meta && meta.sourceName ? meta.sourceName : "directory.txt",
      updatedAt: meta && meta.updatedAt ? meta.updatedAt : new Date().toISOString(),
      records: sanitized.map(function (record) {
        return {
          id: record.id,
          department: record.department,
          name: record.name,
          extension: record.extension
        };
      })
    };
  }

  function parseDirectoryText(text, sourceName) {
    var lines = String(text || "")
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .map(function (line) {
        return line.trim();
      })
      .filter(Boolean);

    if (!lines.length) {
      return buildDirectoryPayload([], { sourceName: sourceName || "directory.txt" });
    }

    var delimiter = detectDelimiter(lines[0]);
    if (!delimiter) {
      var matchLine = lines.find(function (line) {
        return detectDelimiter(line);
      });
      delimiter = detectDelimiter(matchLine || "");
    }

    var map = null;
    var records = [];

    lines.forEach(function (line, lineIndex) {
      var cells = splitLine(line, delimiter)
        .map(function (cell) {
          return cell.trim();
        })
        .filter(Boolean);

      if (cells.length < 3) {
        return;
      }

      if (lineIndex === 0) {
        var headerText = normalizeText(cells.join(" "));
        if (/(部署|部門|所属|名前|氏名|社員名|内線|電話|extension|ext)/.test(headerText)) {
          map = inferColumnMap(cells);
          return;
        }
      }

      if (!map) {
        map = {
          department: 0,
          name: 1,
          extension: 2
        };
      }

      var department = cells[map.department] || cells[0] || "";
      var name = cells[map.name] || cells[1] || "";
      var extension = cells[map.extension] || cells[2] || "";

      if (!department || !name || !extension) {
        return;
      }

      records.push({
        department: department,
        name: name,
        extension: extension
      });
    });

    return buildDirectoryPayload(records, {
      sourceName: sourceName || "directory.txt",
      updatedAt: new Date().toISOString()
    });
  }

  function scoreField(fieldValue, query) {
    if (!query) {
      return 0;
    }
    if (fieldValue === query) {
      return 160;
    }
    if (fieldValue.indexOf(query) === 0) {
      return 120;
    }
    if (fieldValue.indexOf(query) >= 0) {
      return 92;
    }
    if (query.indexOf(fieldValue) >= 0) {
      return 64;
    }
    return 0;
  }

  function sortMatches(matches) {
    return matches.sort(function (left, right) {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return (left.record.department + left.record.name).localeCompare(right.record.department + right.record.name, "ja");
    });
  }

  function searchRecords(records, departmentQuery, nameQuery) {
    var department = normalizeText(departmentQuery);
    var name = normalizeText(nameQuery);

    if (!department && !name) {
      return [];
    }

    return sortMatches(
      sanitizeRecords(records)
        .map(function (record) {
          var score = 0;

          if (department) {
            var departmentScore = scoreField(record.normalizedDepartment, department);
            if (!departmentScore) {
              return null;
            }
            score += departmentScore;
          }

          if (name) {
            var nameScore = scoreField(record.normalizedName, name);
            if (!nameScore) {
              return null;
            }
            score += nameScore;
          }

          if (department && name) {
            score += 24;
          }

          return {
            record: record,
            score: score
          };
        })
        .filter(Boolean)
    );
  }

  function tokenizeTranscript(transcript) {
    return String(transcript || "")
      .normalize("NFKC")
      .replace(/[、,./／]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .map(function (token) {
        return normalizeText(token);
      })
      .filter(Boolean);
  }

  function searchByTranscript(records, transcript) {
    var normalizedTranscript = normalizeText(transcript);
    var tokens = tokenizeTranscript(transcript);

    if (!normalizedTranscript) {
      return [];
    }

    return sortMatches(
      sanitizeRecords(records)
        .map(function (record) {
          var score = 0;

          if (normalizedTranscript.indexOf(record.normalizedDepartment) >= 0) {
            score += 120;
          }
          if (normalizedTranscript.indexOf(record.normalizedName) >= 0) {
            score += 170;
          }
          if (record.normalizedDepartment.indexOf(normalizedTranscript) >= 0) {
            score += 72;
          }
          if (record.normalizedName.indexOf(normalizedTranscript) >= 0) {
            score += 96;
          }

          tokens.forEach(function (token) {
            if (record.normalizedDepartment.indexOf(token) >= 0) {
              score += 30;
            }
            if (record.normalizedName.indexOf(token) >= 0) {
              score += 42;
            }
          });

          if (!score) {
            return null;
          }

          return {
            record: record,
            score: score
          };
        })
        .filter(Boolean)
    );
  }

  function describeConfidence(matches) {
    if (!matches.length) {
      return "none";
    }
    if (matches.length === 1) {
      return "high";
    }
    var gap = matches[0].score - matches[1].score;
    if (matches[0].score >= 220 || gap >= 90) {
      return "high";
    }
    if (gap >= 36) {
      return "medium";
    }
    return "low";
  }

  function inferFromTranscript(transcript, records) {
    var matches = searchByTranscript(records, transcript);
    return {
      matches: matches,
      confidence: describeConfidence(matches)
    };
  }

  function formatTimestamp(value) {
    if (!value) {
      return "未設定";
    }

    var date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function loadBundledDirectory() {
    var payload = window.RECEPTION_DIRECTORY_DATA || {};
    var records = sanitizeRecords(payload.records || []);
    return {
      sourceName: payload.sourceName || "directory.js",
      updatedAt: payload.updatedAt || null,
      records: records,
      recordCount: records.length
    };
  }

  function exportDirectoryModule(payload) {
    var nextPayload = buildDirectoryPayload(payload.records || [], {
      sourceName: payload.sourceName || "directory.txt",
      updatedAt: payload.updatedAt || new Date().toISOString()
    });
    return "window.RECEPTION_DIRECTORY_DATA = " + JSON.stringify(nextPayload, null, 2) + ";\n";
  }

  window.ReceptionDirectory = {
    buildDirectoryPayload: buildDirectoryPayload,
    createId: createId,
    describeConfidence: describeConfidence,
    escapeHtml: escapeHtml,
    exportDirectoryModule: exportDirectoryModule,
    formatTimestamp: formatTimestamp,
    inferFromTranscript: inferFromTranscript,
    loadBundledDirectory: loadBundledDirectory,
    normalizeText: normalizeText,
    parseDirectoryText: parseDirectoryText,
    sanitizeRecords: sanitizeRecords,
    searchByTranscript: searchByTranscript,
    searchRecords: searchRecords
  };
})();
