# Missões do casamento · Arthur & Fernanda

Página para os convidados cumprirem 8 missões fotográficas no casamento (09/10/2026).
HTML, CSS e JS puros, hospedados no GitHub Pages. As fotos e vídeos vão direto para o Cloudinary.

- **Convidados:** https://arrthurgeronimo.github.io/missoes-casamento/
- **Galeria pública:** https://arrthurgeronimo.github.io/missoes-casamento/galeria.html
- **QR Code para imprimir:** [`qrcode/qrcode-verde.png`](qrcode/qrcode-verde.png) (ou a versão preta, ou o `.svg` para a gráfica)

## Arquivos

| Arquivo | O que é |
|---|---|
| `config.js` | **Edite aqui:** noivos, data, textos, cores, missões, Cloudinary |
| `index.html` / `styles.css` | Página dos convidados |
| `app.js` | Nome, cards, contador, fila de envio, parabéns |
| `upload.js` | Compressão (canvas, 1600 px, JPEG 0.8), upload em pedaços e fila offline (IndexedDB) |
| `galeria.html` | Galeria pública agrupada por missão |

## Como funciona

- Cada foto vai para `casamento/missao-0N` (ou `casamento/livres`) com as tags `casamento` e `missao-0N`. O nome do convidado fica no *context* (`convidado=...`).
- Fotos são comprimidas no celular antes do envio. Vídeos vão como estão (limite do plano grátis: **100 MB**, ~1 min). Arquivos com mais de 12 MB sobem em pedaços de 6 MB e retomam de onde pararam se a rede cair.
- Se o envio falhar, o arquivo fica guardado no celular (IndexedDB) e a página tenta de novo sozinha (4 s, 8 s, 16 s… até 1 min, e quando a internet volta). Se o convidado fechar a página, o envio continua quando ele abrir de novo.
- A galeria lê `res.cloudinary.com/arthurefernanda/{image,video}/list/casamento.json` (público, cache de ~1 min).

## Ver as fotos (noivos)

1. **Galeria:** link acima, atualiza sozinha a cada minuto.
2. **Cloudinary → Media Library → Folders → `casamento`**: todas as fotos originais, por pasta. Para baixar tudo: selecione → *Download*.

## Testar sem sujar a galeria

No `config.js`, troque temporariamente `pastaRaiz` e `tagGeral` para `"casamento-teste"`, publique e teste. **Volte para `"casamento"` antes da festa.** Para zerar o progresso de um celular de teste, abra a página em uma aba anônima.

## Depois do casamento

- Cloudinary → Settings → Upload → preset `casamento_af` → mude para **Signed** (ninguém mais consegue enviar).
- Se quiser fechar a galeria: Settings → Security → marque de novo **Resource list**.
- Baixe tudo do Media Library para guardar.
