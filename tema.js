// Aplica cores, nomes dos noivos e data do config.js (usado pela página e pela galeria).
(function () {
  "use strict";
  var C = window.CONFIG;
  var mapaCores = { oliva: "--oliva", olivaEscuro: "--oliva-escuro", folha: "--folha", creme: "--creme",
    pergaminho: "--pergaminho", dourado: "--dourado", texto: "--texto" };
  Object.keys(mapaCores).forEach(function (k) {
    if (C.cores && C.cores[k]) document.documentElement.style.setProperty(mapaCores[k], C.cores[k]);
  });

  // "Arthur" / e / "Fernanda" — o "e" vai numa fonte legível, como no convite impresso.
  var h1 = document.getElementById("noivos");
  if (h1) {
    h1.innerHTML = "";
    C.noivos.forEach(function (nome, i) {
      if (i > 0) {
        var e = document.createElement("span");
        e.className = "noivos-e"; e.textContent = "e";
        h1.appendChild(e);
      }
      var s = document.createElement("span");
      s.className = "noivos-nome"; s.textContent = nome;
      h1.appendChild(s);
    });
  }
  var data = document.getElementById("data");
  if (data) data.textContent = C.data;
  window.NOIVOS_TEXTO = C.noivos.join(" & ");
})();
