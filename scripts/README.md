# Pipeline Unificado de Importação de Músicas (BEAT//LINE)

Script automatizado para importar músicas para o jogo **BEAT//LINE**, suportando tanto **busca direta por nome** quanto **links de playlists do YouTube**.

## 🚀 Modos de Uso

### 1. Busca Direta por Lista de Músicas (Recomendado)
Não precisa criar nenhuma playlist no YouTube! O script busca automaticamente cada música no YouTube e seleciona o melhor resultado:

```bash
# Passando as músicas diretamente via linha de comando:
python3 scripts/importar_musicas.py --busca "Queen - Bohemian Rhapsody" "A-ha - Take On Me"

# Ou passando um arquivo de texto com 1 música por linha:
python3 scripts/importar_musicas.py --arquivo musicas.txt
```

### 2. Importação via Playlist do YouTube
Se você tiver um link de playlist ou vídeo do YouTube:

```bash
python3 scripts/importar_musicas.py "https://www.youtube.com/playlist?list=ID_DA_PLAYLIST"
```

---

## 🛠️ O que o pipeline faz por debaixo dos panos

1. **Download do Áudio:** Utiliza `yt-dlp` para buscar e extrair áudio MP3 (192 kbps).
2. **Higienização de Título:** Remove ruídos como "Clipe Oficial", "Ao Vivo", "Remaster", etc.
3. **Metadados Canônicos (iTunes Search API):** Identifica o título oficial, artista e o **ano real de lançamento original** da canção.
4. **Categorias Inteligentes:** Cria/vincula as categorias da década (`Anos 70`, `Anos 80`, etc.), gênero musical e tag `Nacional` se for brasileiro.
5. **Prevenção de Duplicatas:** Checa no Supabase se a faixa já existe para não gastar upload nem duplicar no catálogo.
6. **Upload Cloudflare R2:** Envia o arquivo MP3 autenticado para a Media API em `audio.altigames.com.br/beatline/musicas/`.
7. **Cadastro no Supabase:** Cria os vínculos e adiciona na tabela `beatline_tracks`.

---

## 🔐 Credenciais

O script lê automaticamente de `~/.gemini/beatline_credentials.json` ou de variáveis de ambiente:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BEATLINE_BOT_EMAIL`
- `BEATLINE_BOT_PASSWORD`
