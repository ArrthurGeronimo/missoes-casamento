// Página do convidado: nome, cards das missões, fila de envio e parabéns.
(function () {
  "use strict";
  var C = window.CONFIG;
  var MC = window.MC;
  var $ = function (sel, el) { return (el || document).querySelector(sel); };

  // ---------- Tema a partir do config ----------
  var mapaCores = { oliva: "--oliva", olivaEscuro: "--oliva-escuro", folha: "--folha", creme: "--creme",
    pergaminho: "--pergaminho", dourado: "--dourado", texto: "--texto" };
  Object.keys(mapaCores).forEach(function (k) {
    if (C.cores && C.cores[k]) document.documentElement.style.setProperty(mapaCores[k], C.cores[k]);
  });

  // ---------- localStorage (sempre com try/catch: modo privado pode bloquear) ----------
  function ler(chave, padrao) {
    try { var v = localStorage.getItem(chave); return v ? JSON.parse(v) : padrao; } catch (_) { return padrao; }
  }
  function gravar(chave, valor) { try { localStorage.setItem(chave, JSON.stringify(valor)); } catch (_) {} }

  var nome = ler("mc_nome", "");
  var progresso = ler("mc_progresso", {});   // { "missao-01": { thumb, tipo, em } }
  var livres = ler("mc_livres", 0);          // quantos envios livres já concluídos
  var fila = [];                              // itens pendentes (memória + IndexedDB)
  var estado = {};                            // grupo -> { fase, pct, erro }
  var rodando = false, timerRetry = null, tentativas = 0;
  var thumbsLocais = {};                      // grupo -> objectURL da prévia

  // ---------- Cabeçalho ----------
  $("#noivos").textContent = C.noivos;
  $("#data").textContent = C.data;
  $("#chamada").textContent = C.chamada;
  $("#rodape-texto").textContent = C.rodape;
  document.title = "Missões · " + C.noivos;

  // ---------- Nome do convidado ----------
  var modalNome = $("#modal-nome");
  function pedirNome() {
    $("#input-nome").value = nome || "";
    modalNome.hidden = false;
    setTimeout(function () { $("#input-nome").focus(); }, 50);
  }
  $("#form-nome").addEventListener("submit", function (e) {
    e.preventDefault();
    var v = $("#input-nome").value.trim().split(/\s+/)[0] || "";
    if (!v) { $("#input-nome").focus(); return; }
    nome = v.charAt(0).toUpperCase() + v.slice(1);
    gravar("mc_nome", nome);
    modalNome.hidden = true;
    atualizarSaudacao();
  });
  $("#trocar-nome").addEventListener("click", pedirNome);
  function atualizarSaudacao() {
    $("#saudacao-nome").textContent = nome || "convidado";
  }

  // ---------- Cards ----------
  var lista = $("#missoes");
  C.missoes.forEach(function (m, i) {
    var li = document.createElement("li");
    li.className = "card";
    li.id = "card-" + m.id;
    li.innerHTML =
      '<div class="card-topo">' +
        '<span class="card-num">' + (i + 1) + '</span>' +
        '<h3 class="card-titulo"></h3>' +
        '<span class="card-emoji" aria-hidden="true"></span>' +
      '</div>' +
      '<div class="card-corpo">' +
        '<div class="card-thumb" hidden></div>' +
        '<div class="card-info">' +
          '<p class="card-status" aria-live="polite"></p>' +
          '<div class="barra" hidden><div class="barra-fill"></div></div>' +
        '</div>' +
      '</div>' +
      '<label class="botao">' +
        '<input type="file" accept="image/*,video/*" class="input-arquivo">' +
        '<span class="botao-texto"></span>' +
      '</label>';
    $(".card-titulo", li).textContent = m.titulo;
    $(".card-emoji", li).textContent = m.emoji || "";
    $(".input-arquivo", li).addEventListener("change", function (e) {
      var arq = e.target.files && e.target.files[0];
      e.target.value = "";
      if (arq) adicionarArquivos([arq], m.id);
    });
    lista.appendChild(li);
  });

  $("#input-livres").addEventListener("change", function (e) {
    var arqs = Array.prototype.slice.call(e.target.files || []);
    e.target.value = "";
    if (arqs.length) adicionarArquivos(arqs, "livres");
  });

  function urlThumb(res) {
    var base = "https://res.cloudinary.com/" + C.cloudName + "/";
    if (res.resource_type === "video") return base + "video/upload/c_fill,w_240,h_240,so_0,q_auto/" + res.public_id + ".jpg";
    return base + "image/upload/c_fill,w_240,h_240,q_auto,f_auto/" + res.public_id;
  }

  function ultimoDaFila(grupo) {
    for (var i = fila.length - 1; i >= 0; i--) if (fila[i].grupo === grupo) return fila[i];
    return null;
  }

  function renderCard(grupo) {
    if (grupo === "livres") return renderLivres();
    var li = document.getElementById("card-" + grupo);
    if (!li) return;
    var feito = progresso[grupo];
    var st = estado[grupo] || {};
    var pendente = ultimoDaFila(grupo);
    var thumb = $(".card-thumb", li), status = $(".card-status", li), barra = $(".barra", li);
    var txt = $(".botao-texto", li);

    li.classList.toggle("feito", !!feito);
    li.classList.toggle("pendente", !!pendente);

    // Miniatura: prévia local se está na fila; senão a do Cloudinary.
    var src = null, video = false;
    if (pendente && thumbsLocais[grupo]) src = thumbsLocais[grupo];
    else if (pendente && pendente.tipo === "video") video = true;
    else if (feito) src = feito.thumb;
    var chave = video ? "video" : (src || "");
    if (thumb.getAttribute("data-src") !== chave) {
      thumb.setAttribute("data-src", chave);
      thumb.innerHTML = video ? '<span class="thumb-video">🎬</span>' : "";
      if (src) { var img = new Image(); img.alt = ""; img.src = src; thumb.appendChild(img); }
    }
    thumb.hidden = !chave;

    barra.hidden = true;
    status.className = "card-status";
    if (st.fase === "preparando") {
      status.textContent = "Preparando…";
    } else if (pendente && st.fase === "enviando") {
      status.textContent = "Enviando… " + Math.round((st.pct || 0) * 100) + "%";
      barra.hidden = false;
      $(".barra-fill", li).style.width = Math.round((st.pct || 0) * 100) + "%";
    } else if (pendente) {
      status.textContent = "Guardada no celular. Enviaremos assim que a internet voltar.";
      status.classList.add("aviso");
    } else if (st.erro) {
      status.textContent = st.erro;
      status.classList.add("erro");
    } else if (feito) {
      status.textContent = "✓ Missão cumprida!";
      status.classList.add("ok");
    } else {
      status.textContent = "";
    }
    txt.textContent = (feito || pendente) ? "↻ Refazer" : "📷 Tirar foto";
  }

  function renderLivres() {
    var n = fila.filter(function (it) { return it.grupo === "livres"; }).length;
    var st = estado.livres || {};
    var s = $("#livres-status");
    var partes = [];
    if (livres) partes.push(livres + (livres === 1 ? " enviado" : " enviados") + " ✓");
    if (st.fase === "preparando") partes.push("preparando…");
    else if (n && st.fase === "enviando") partes.push("enviando " + n + "… " + Math.round((st.pct || 0) * 100) + "%");
    else if (n) partes.push(n + " aguardando internet");
    if (st.erro) partes.push(st.erro);
    s.textContent = partes.join(" · ");
  }

  function renderContador() {
    var total = C.missoes.length;
    var feitas = C.missoes.filter(function (m) { return progresso[m.id]; }).length;
    $("#contador").textContent = feitas + " de " + total + " missões";
    $("#progresso-geral").style.width = (feitas / total * 100) + "%";
    return feitas === total;
  }

  function renderBanner() {
    var b = $("#banner");
    var esperando = fila.length;
    if (!esperando) { b.hidden = true; return; }
    var semDisco = fila.some(function (it) { return !it.salvoNoDisco; });
    var offline = estado._offline;
    b.hidden = false;
    b.classList.toggle("offline", !!offline);
    $("#banner-texto").textContent = offline
      ? "📶 Internet fraca. " + esperando + (esperando === 1 ? " envio guardado" : " envios guardados") +
        " no celular, vamos tentar de novo sozinhos." + (semDisco ? " Não feche esta página." : " Deixe esta página aberta.")
      : "⏳ Enviando " + esperando + (esperando === 1 ? " arquivo…" : " arquivos…") + " Deixe esta página aberta.";
    $("#banner-tentar").hidden = !offline;
  }

  function renderTudo() {
    C.missoes.forEach(function (m) { renderCard(m.id); });
    renderLivres();
    renderContador();
    renderBanner();
  }

  // ---------- Adicionar arquivos à fila ----------
  function adicionarArquivos(arquivos, grupo) {
    if (!nome) { pedirNome(); return; }
    estado[grupo] = { fase: "preparando" };
    renderCard(grupo);
    // Processa um por vez para não estourar a memória do celular.
    var p = Promise.resolve();
    arquivos.forEach(function (arq) {
      p = p.then(function () {
        return MC.prepararArquivo(arq).then(function (prep) {
          var item = {
            id: Date.now() + "-" + Math.random().toString(36).slice(2, 8),
            grupo: grupo, nome: nome, blob: prep.blob, tipo: prep.tipo,
            nomeArquivo: prep.nomeArquivo, criadoEm: Date.now(), offset: 0, uploadId: null, salvoNoDisco: false
          };
          if (grupo !== "livres" && prep.tipo === "image") {
            if (thumbsLocais[grupo]) URL.revokeObjectURL(thumbsLocais[grupo]);
            thumbsLocais[grupo] = URL.createObjectURL(prep.blob);
          }
          fila.push(item);
          return MC.fila.salvar(item).then(function () { item.salvoNoDisco = true; }, function () { /* sem espaço: segue só em memória */ });
        }, function (err) {
          estado[grupo] = { erro: err.message };
        });
      });
    });
    p.then(function () {
      if (estado[grupo] && estado[grupo].fase === "preparando") estado[grupo] = {};
      renderTudo();
      tentativas = 0;
      processar();
    });
  }

  // ---------- Processamento da fila (um envio por vez) ----------
  function agendarRetry() {
    clearTimeout(timerRetry);
    var espera = Math.min(60000, 4000 * Math.pow(2, tentativas));
    tentativas++;
    timerRetry = setTimeout(processar, espera);
  }

  function processar() {
    if (rodando || !fila.length) { renderBanner(); return; }
    rodando = true;
    clearTimeout(timerRetry);
    var item = fila[0];
    var g = item.grupo;
    estado[g] = { fase: "enviando", pct: item.offset && item.blob.size ? item.offset / item.blob.size : 0 };
    renderCard(g); renderBanner();

    var ultimoRender = 0;
    MC.enviar(item, function (pct) {
      estado[g].pct = pct;
      var agora = Date.now();
      if (agora - ultimoRender > 150) { ultimoRender = agora; renderCard(g); }
    }, function (offset, uploadId) {
      item.offset = offset; item.uploadId = uploadId;
      if (item.salvoNoDisco) MC.fila.salvar(item).catch(function () {});
    }).then(function (res) {
      concluir(item, res);
      estado._offline = false;
      tentativas = 0;
      rodando = false;
      processar();
    }, function (err) {
      rodando = false;
      if (err.permanente && item.offset > 0) {
        // Upload em pedaços expirou no servidor: recomeça do zero uma vez.
        item.offset = 0; item.uploadId = null;
        if (item.salvoNoDisco) MC.fila.salvar(item).catch(function () {});
        return processar();
      }
      if (err.permanente) {
        removerDaFila(item);
        estado[g] = { erro: "Não foi possível enviar este arquivo (" + (err.message || err.status) + "). Tente outro." };
        renderTudo();
        return processar();
      }
      estado._offline = true;
      estado[g] = { fase: "aguardando" };
      renderCard(g); renderBanner();
      agendarRetry();
    });
  }

  function removerDaFila(item) {
    var i = fila.indexOf(item);
    if (i >= 0) fila.splice(i, 1);
    MC.fila.remover(item.id).catch(function () {});
  }

  function concluir(item, res) {
    removerDaFila(item);
    var g = item.grupo;
    estado[g] = {};
    if (g === "livres") {
      livres++; gravar("mc_livres", livres);
    } else {
      progresso[g] = { thumb: urlThumb(res), tipo: res.resource_type, em: Date.now() };
      gravar("mc_progresso", progresso);
      if (!ultimoDaFila(g) && thumbsLocais[g]) {
        // Mantém a prévia local até a miniatura do Cloudinary carregar.
        var local = thumbsLocais[g];
        var pre = new Image();
        pre.onload = pre.onerror = function () {
          if (thumbsLocais[g] === local) { URL.revokeObjectURL(local); delete thumbsLocais[g]; }
          renderCard(g);
        };
        pre.src = progresso[g].thumb;
      }
    }
    renderCard(g);
    var completo = renderContador();
    renderBanner();
    if (completo && !ler("mc_parabens", false)) {
      gravar("mc_parabens", true);
      mostrarParabens();
    }
  }

  // ---------- Parabéns ----------
  function mostrarParabens() {
    $("#parabens-nome").textContent = nome;
    $("#modal-parabens").hidden = false;
  }
  $("#fechar-parabens").addEventListener("click", function () { $("#modal-parabens").hidden = true; });

  // ---------- Gatilhos para tentar de novo ----------
  window.addEventListener("online", function () { tentativas = 0; processar(); });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && fila.length && !rodando) { tentativas = 0; processar(); }
  });
  $("#banner-tentar").addEventListener("click", function () { tentativas = 0; processar(); });
  window.addEventListener("beforeunload", function (e) {
    if (fila.some(function (it) { return !it.salvoNoDisco; })) { e.preventDefault(); e.returnValue = ""; }
  });

  // ---------- Início ----------
  atualizarSaudacao();
  renderTudo();
  if (!nome) pedirNome();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});

  // Recupera envios que ficaram pendentes de uma visita anterior.
  MC.fila.listar().then(function (itens) {
    (itens || []).sort(function (a, b) { return a.criadoEm - b.criadoEm; }).forEach(function (it) {
      it.salvoNoDisco = true;
      fila.push(it);
      if (it.grupo !== "livres" && it.tipo === "image" && it.blob) {
        if (thumbsLocais[it.grupo]) URL.revokeObjectURL(thumbsLocais[it.grupo]);
        thumbsLocais[it.grupo] = URL.createObjectURL(it.blob);
      }
    });
    renderTudo();
    processar();
  }).catch(function () {});
})();
