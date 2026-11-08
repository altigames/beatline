# Pipeline de Importação Automática de Músicas (BEAT//LINE)

Script automatizado para importar playlists e músicas do YouTube diretamente para o jogo **BEAT//LINE**.

## 🚀 Como funciona

1. **Download do Áudio:** Utiliza `yt-dlp` para extrair áudio de alta qualidade em formato MP3 (192 kbps).
2. **Higienização e Enriquecimento de Metadados:**
   - Remove ruídos comuns em títulos de clipes ("Clipe Oficial", "Ao Vivo", "Remaster", etc.).
   - Consulta a **iTunes Search API** para descobrir o título canônico, artista oficial, gênero musical e o **ano real de lançamento original** da canção (evitando usar a data de upload do vídeo no YouTube).
   - Classifica a faixa por década (`Anos 70`, `Anos 80`, `Anos 90`, `Anos 2000`, etc.) e gênero.
3. **Detecção de Duplicatas:** Checa se a faixa com o mesmo título, artista e ano já existe no banco do Supabase antes de fazer o upload.
4. **Armazenamento no Cloudflare R2:** Realiza upload autenticado do MP3 via Cloudflare Media API (`https://altigames-media-api.julia-correa-souza.workers.dev/upload`), gerando o link público em `https://audio.altigames.com.br/beatline/musicas/<uuid>.mp3`.
5. **Cadastro no Supabase:** Cria ou vincula as categorias e insere a faixa na tabela `beatline_tracks`.

## 💻 Como executar

```bash
# Executar passando a URL da playlist ou música do YouTube
python3 scripts/importar_playlist.py "https://www.youtube.com/playlist?list=ID_DA_PLAYLIST"
```

## 🔐 Configuração e Credenciais

O script busca automaticamente as credenciais em `~/.gemini/beatline_credentials.json` ou através das variáveis de ambiente:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BEATLINE_BOT_EMAIL`
- `BEATLINE_BOT_PASSWORD`
