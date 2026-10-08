// =============================================================
//  CONFIGURAÇÃO — edite este arquivo à vontade.
//  Depois de salvar, faça commit/push e espere ~1 min no GitHub Pages.
// =============================================================
window.CONFIG = {
  // ---- Noivos e textos ----
  noivos: "Arthur & Fernanda",
  data: "09 de outubro de 2026",
  chamada: "Você consegue capturar todos esses momentos?",
  rodape: "Feito com amor no Condado",

  // ---- Cloudinary (nada secreto aqui: só o cloud name e o preset unsigned) ----
  cloudName: "arthurefernanda",
  uploadPreset: "casamento_af",
  pastaRaiz: "casamento",      // fotos vão para casamento/missao-01, casamento/livres...
  tagGeral: "casamento",       // tag em todas as fotos; a galeria lista por ela

  // ---- Limites ----
  maxLadoImagem: 1600,         // px do maior lado depois da compressão
  qualidadeJpeg: 0.8,
  maxVideoMB: 100,             // limite do plano grátis do Cloudinary (vídeos)
  maxImagemMB: 10,             // limite do plano grátis do Cloudinary (imagens)

  // ---- Cores (tema Condado) ----
  cores: {
    oliva: "#6b7a45",          // cor principal (botões, títulos)
    olivaEscuro: "#4a5631",
    folha: "#8a9a5b",
    creme: "#fbf8ef",          // fundo
    pergaminho: "#f3ecd9",     // cards
    dourado: "#c2a35a",        // detalhes
    texto: "#3d4128"
  },

  // ---- As 8 missões (id não deve mudar depois que a festa começar) ----
  missoes: [
    { id: "missao-01", titulo: "Foto em grupo com a sua mesa", emoji: "🍻" },
    { id: "missao-02", titulo: "Foto dos noivos", emoji: "💍" },
    { id: "missao-03", titulo: "Foto com os pais dos noivos", emoji: "👨‍👩‍👧‍👦" },
    { id: "missao-04", titulo: "Foto espontânea do Pedroca", emoji: "📸" },
    { id: "missao-05", titulo: "Selfie com os noivos", emoji: "🤳" },
    { id: "missao-06", titulo: "Foto do buffet", emoji: "🥧" },
    { id: "missao-07", titulo: "Foto de um sorriso espontâneo", emoji: "😄" },
    { id: "missao-08", titulo: "Uma careta", emoji: "😜" }
  ]
};
