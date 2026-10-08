// Compressão de imagem, upload para o Cloudinary (com chunks) e fila offline (IndexedDB).
(function () {
  "use strict";
  var C = window.CONFIG;
  var CHUNK = 6 * 1024 * 1024;        // Cloudinary exige chunks >= 5 MB (exceto o último)
  var LIMIAR_CHUNK = 12 * 1024 * 1024; // acima disso, envia em pedaços (retoma se a rede cair)

  // ---------------------------------------------------------------
  //  Compressão (canvas). <img> já respeita a orientação EXIF nos
  //  navegadores atuais (Safari 13.1+, Chrome 81+, Firefox 77+).
  // ---------------------------------------------------------------
  function carregarImagem(arquivo) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(arquivo);
      var img = new Image();
      img.onload = function () { resolve({ img: img, url: url }); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("decode")); };
      img.src = url;
    });
  }

  function comprimirImagem(arquivo) {
    return carregarImagem(arquivo).then(function (r) {
      var img = r.img;
      var w = img.naturalWidth, h = img.naturalHeight;
      var escala = Math.min(1, C.maxLadoImagem / Math.max(w, h));
      var cw = Math.max(1, Math.round(w * escala)), ch = Math.max(1, Math.round(h * escala));
      var canvas = document.createElement("canvas");
      canvas.width = cw; canvas.height = ch;
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff"; // PNG transparente vira fundo branco no JPEG
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(img, 0, 0, cw, ch);
      return new Promise(function (resolve, reject) {
        canvas.toBlob(function (blob) {
          URL.revokeObjectURL(r.url);
          canvas.width = canvas.height = 0; // libera memória no iOS
          if (blob && blob.size > 0) resolve(blob); else reject(new Error("toBlob"));
        }, "image/jpeg", C.qualidadeJpeg);
      });
    });
  }

  // Prepara o arquivo escolhido: comprime imagens, valida tamanhos.
  // Resolve { blob, tipo: "image"|"video", nomeArquivo } ou rejeita com mensagem amigável.
  function prepararArquivo(arquivo) {
    var ehVideo = /^video\//.test(arquivo.type) || /\.(mov|mp4|m4v|3gp|webm|mkv)$/i.test(arquivo.name || "");
    if (ehVideo) {
      var mb = arquivo.size / 1048576;
      if (mb > C.maxVideoMB) {
        return Promise.reject(new Error(
          "Esse vídeo tem " + Math.round(mb) + " MB e o limite é " + C.maxVideoMB +
          " MB (cerca de 1 minuto). Grave um trecho mais curto 🙂"));
      }
      return Promise.resolve({ blob: arquivo, tipo: "video", nomeArquivo: arquivo.name || "video.mp4" });
    }
    return comprimirImagem(arquivo).then(function (blob) {
      return { blob: blob, tipo: "image", nomeArquivo: "foto.jpg" };
    }, function () {
      // Navegador não conseguiu ler (ex.: HEIC no Android): envia o original se couber.
      if (arquivo.size <= C.maxImagemMB * 1048576) {
        return { blob: arquivo, tipo: "image", nomeArquivo: arquivo.name || "foto" };
      }
      throw new Error("Não consegui processar essa foto. Tente tirar outra ou escolher da galeria.");
    });
  }

  // ---------------------------------------------------------------
  //  Upload (XHR para ter progresso). Erro com .permanente = não adianta tentar de novo.
  // ---------------------------------------------------------------
  function erroUpload(status, msg) {
    var e = new Error(msg || ("HTTP " + status));
    e.status = status;
    // 400/401/403/404/413: requisição inválida (ex.: arquivo grande demais) — não insistir.
    // 420/429/5xx/0 (sem rede): tentar de novo depois.
    e.permanente = status >= 400 && status < 500 && status !== 408 && status !== 420 && status !== 429;
    return e;
  }

  function postar(form, headers, onProgress) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open("POST", "https://api.cloudinary.com/v1_1/" + C.cloudName + "/auto/upload");
      xhr.timeout = 120000;
      Object.keys(headers || {}).forEach(function (k) { xhr.setRequestHeader(k, headers[k]); });
      xhr.upload.onprogress = function (ev) { if (ev.lengthComputable && onProgress) onProgress(Math.min(1, ev.loaded / ev.total)); };
      xhr.onload = function () {
        var json = null;
        try { json = JSON.parse(xhr.responseText); } catch (_) {}
        if (xhr.status >= 200 && xhr.status < 300 && json) resolve(json);
        else reject(erroUpload(xhr.status, json && json.error && json.error.message));
      };
      xhr.onerror = function () { reject(erroUpload(0, "rede")); };
      xhr.ontimeout = function () { reject(erroUpload(0, "timeout")); };
      xhr.send(form);
    });
  }

  function limparNome(s) { return String(s || "").replace(/[|=\\]/g, " ").trim().slice(0, 40); }

  function camposBase(item) {
    var f = new FormData();
    f.append("upload_preset", C.uploadPreset);
    f.append("folder", C.pastaRaiz + "/" + item.grupo);
    f.append("tags", [C.tagGeral, item.grupo].join(","));
    f.append("context", "convidado=" + limparNome(item.nome) + "|missao=" + item.grupo);
    return f;
  }

  // item: { blob, grupo, nome, uploadId?, offset? }
  // onProgress(fração 0..1); onChunk(offset, uploadId) para persistir o ponto de retomada.
  function enviar(item, onProgress, onChunk) {
    var blob = item.blob, total = blob.size;
    if (total <= LIMIAR_CHUNK) {
      var f = camposBase(item);
      f.append("file", blob, item.nomeArquivo || "arquivo");
      return postar(f, null, function (fr) { onProgress && onProgress(fr); });
    }
    // Upload em pedaços: se a rede cair, retoma do último pedaço confirmado.
    var uploadId = item.uploadId || ("af-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10));
    var offset = item.offset || 0;
    function proximo() {
      var fim = Math.min(offset + CHUNK, total);
      // Se sobraria um último pedaço < 5 MB, junta com este.
      if (total - fim > 0 && total - fim < 5 * 1048576) fim = total;
      var f = camposBase(item);
      f.append("file", blob.slice(offset, fim), item.nomeArquivo || "arquivo");
      var headers = { "X-Unique-Upload-Id": uploadId, "Content-Range": "bytes " + offset + "-" + (fim - 1) + "/" + total };
      var inicio = offset;
      var tamanho = fim - inicio;
      return postar(f, headers, function (fr) { onProgress && onProgress((inicio + fr * tamanho) / total); })
        .then(function (res) {
          offset = fim;
          if (offset >= total) return res;
          onChunk && onChunk(offset, uploadId);
          return proximo();
        });
    }
    return proximo();
  }

  // ---------------------------------------------------------------
  //  IndexedDB — fila de envios pendentes (sobrevive a fechar a página).
  // ---------------------------------------------------------------
  var dbPromise = null;
  function db() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) return reject(new Error("sem IndexedDB"));
      var req = indexedDB.open("missoes-casamento", 1);
      req.onupgradeneeded = function () { req.result.createObjectStore("fila", { keyPath: "id" }); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    dbPromise.catch(function () { dbPromise = null; });
    return dbPromise;
  }

  function tx(modo, fn) {
    return db().then(function (d) {
      return new Promise(function (resolve, reject) {
        var t = d.transaction("fila", modo);
        var store = t.objectStore("fila");
        var out = fn(store);
        t.oncomplete = function () { resolve(out && out.result !== undefined ? out.result : undefined); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error || new Error("abort")); };
      });
    });
  }

  var fila = {
    salvar: function (item) { return tx("readwrite", function (s) { return s.put(item); }); },
    remover: function (id) { return tx("readwrite", function (s) { return s.delete(id); }); },
    listar: function () { return tx("readonly", function (s) { return s.getAll(); }); }
  };

  window.MC = { prepararArquivo: prepararArquivo, enviar: enviar, fila: fila };
})();
