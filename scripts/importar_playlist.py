#!/usr/bin/env python3
"""
Pipeline de Importação Automática de Músicas do YouTube para o BEAT//LINE.
1. Baixa músicas da playlist do YouTube com yt-dlp e extrai áudio em MP3.
2. Identifica e higieniza Título, Artista, Ano Real de Lançamento e Categorias (via iTunes Search API + metadados).
3. Faz upload dos MP3s para a Cloudflare Media API (R2) com a conta do robô.
4. Cadastra as faixas, categorias e vínculos nas tabelas do Supabase.
"""

import os
import sys
import re
import json
import uuid
import shutil
import urllib.request
import urllib.parse
from pathlib import Path
import subprocess

CONFIG_PATHS = [
    os.path.expanduser('~/.gemini/beatline_credentials.json'),
    Path(__file__).resolve().parent.parent / '.gemini' / 'beatline_credentials.json'
]

def load_credentials():
    creds = {}
    for p in CONFIG_PATHS:
        if os.path.exists(p):
            try:
                with open(p, 'r', encoding='utf-8') as f:
                    creds = json.load(f)
                    break
            except Exception:
                pass

    supabase_url = creds.get('supabase_url') or os.environ.get('SUPABASE_URL') or "https://cvaocseqrgjstyakncnt.supabase.co"
    service_key = creds.get('supabase_service_role_key') or os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    bot_email = creds.get('bot_email') or os.environ.get('BEATLINE_BOT_EMAIL') or "bot@altigames.com.br"
    bot_password = creds.get('bot_password') or os.environ.get('BEATLINE_BOT_PASSWORD')

    if not service_key or not bot_password:
        raise FileNotFoundError(
            "Credenciais não encontradas. Certifique-se de que ~/.gemini/beatline_credentials.json "
            "ou as variáveis de ambiente (SUPABASE_SERVICE_ROLE_KEY, BEATLINE_BOT_PASSWORD) estejam configuradas."
        )

    return {
        'supabase_url': supabase_url,
        'supabase_service_role_key': service_key,
        'bot_email': bot_email,
        'bot_password': bot_password,
        'bot_user_id': creds.get('bot_user_id', '')
    }

def clean_youtube_title(raw_title):
    """Limpa termos típicos de títulos do YouTube (Clipe Oficial, Remaster, 4K, etc.)"""
    title = raw_title
    patterns = [
        r'\s*[\(\[](?:Official\s*(?:Music\s*)?Video|Video\s*Oficial|Clipe\s*Oficial|Áudio\s*Oficial|Audio|Videoclipe|Lyric\s*Video|Letra|Visualizer|Clip|Ao\s*Vivo|Live|Remaster(?:ed)?|HD|4K|HQ|Explicit|Bonus\s*Track)[\)\]]',
        r'\s*[\(\[](?:feat\.?|ft\.?)[^\)\]]+[\)\]]',
        r'\s*\|\s*.*$',
        r'^\d+\s*[-–.]\s*',
    ]
    for p in patterns:
        title = re.sub(p, '', title, flags=re.IGNORECASE)
    return title.strip()

def search_itunes_metadata(search_term):
    """Busca metadados oficiais (Ano real, artista, título, gênero) no catálogo do iTunes."""
    url = f"https://itunes.apple.com/search?term={urllib.parse.quote(search_term)}&entity=song&limit=5"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Beatline/1.0)'})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.load(resp)
            results = data.get('results', [])
            if results:
                # Retorna o primeiro resultado relevante
                item = results[0]
                release_date = item.get('releaseDate', '')
                year = None
                if release_date and len(release_date) >= 4:
                    try:
                        year = int(release_date[:4])
                    except ValueError:
                        pass
                
                genre = item.get('primaryGenreName', '').upper()
                return {
                    'title': item.get('trackName', ''),
                    'artist': item.get('artistName', ''),
                    'year': year,
                    'genre': genre
                }
    except Exception as e:
        print(f"  [Aviso] Falha ao consultar iTunes API para '{search_term}': {e}")
    return None

def compute_decade_category(year):
    if not year or year < 1900 or year > 2100:
        return None
    if year < 1950:
        return "Anos 40"
    decade = (year // 10) * 10
    if decade == 1950: return "Anos 50"
    if decade == 1960: return "Anos 60"
    if decade == 1970: return "Anos 70"
    if decade == 1980: return "Anos 80"
    if decade == 1990: return "Anos 90"
    if decade == 2000: return "Anos 2000"
    if decade == 2010: return "Anos 2010"
    if decade >= 2020: return "Anos 2020"
    return None

def authenticate_bot(creds):
    supa_url = creds['supabase_url']
    key = creds['supabase_service_role_key']
    payload = json.dumps({'email': creds['bot_email'], 'password': creds['bot_password']}).encode('utf-8')
    req = urllib.request.Request(
        f"{supa_url}/auth/v1/token?grant_type=password",
        data=payload,
        headers={'apikey': key, 'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.load(resp)
        return data['access_token']

def upload_mp3_to_cloudflare(mp3_path, bot_token):
    boundary = '----WebKitFormBoundaryBeatline' + uuid.uuid4().hex[:16]
    with open(mp3_path, 'rb') as f:
        file_bytes = f.read()

    filename = os.path.basename(mp3_path)
    body = bytearray()
    body.extend(f'--{boundary}\r\n'.encode('utf-8'))
    body.extend(f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode('utf-8'))
    body.extend(b'Content-Type: audio/mpeg\r\n\r\n')
    body.extend(file_bytes)
    body.extend(b'\r\n')
    body.extend(f'--{boundary}--\r\n'.encode('utf-8'))

    url = 'https://altigames-media-api.julia-correa-souza.workers.dev/upload'
    req = urllib.request.Request(
        url,
        data=bytes(body),
        headers={
            'Authorization': f'Bearer {bot_token}',
            'Content-Type': f'multipart/form-data; boundary={boundary}',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.load(resp)
        if not data.get('success') or not data.get('key'):
            raise RuntimeError(f"Erro da API de mídia: {data.get('error', 'Resposta inválida')}")
        # A chave vem como 'beatline/musicas/<uuid>.mp3', pegamos o nome do arquivo
        return os.path.basename(data['key'])

def get_or_create_categories(supa_url, service_key, category_names):
    """Garante que as categorias existam no Supabase e retorna seus IDs."""
    existing_req = urllib.request.Request(
        f"{supa_url}/rest/v1/beatline_categories?select=id,name",
        headers={'apikey': service_key, 'Authorization': f'Bearer {service_key}'}
    )
    with urllib.request.urlopen(existing_req, timeout=10) as resp:
        existing = json.load(resp)
    
    cat_map = {c['name'].strip().lower(): c['id'] for c in existing}
    cat_ids = []

    for name in category_names:
        clean_name = name.strip()
        if not clean_name:
            continue
        key = clean_name.lower()
        if key in cat_map:
            cat_ids.append(cat_map[key])
        else:
            # Criar nova categoria
            new_payload = json.dumps({'name': clean_name, 'color': '#c7f456'}).encode('utf-8')
            create_req = urllib.request.Request(
                f"{supa_url}/rest/v1/beatline_categories",
                data=new_payload,
                headers={
                    'apikey': service_key,
                    'Authorization': f'Bearer {service_key}',
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                }
            )
            try:
                with urllib.request.urlopen(create_req, timeout=10) as resp:
                    created = json.load(resp)
                    if created:
                        new_id = created[0]['id']
                        cat_map[key] = new_id
                        cat_ids.append(new_id)
            except Exception as e:
                print(f"  [Aviso] Erro ao criar categoria '{clean_name}': {e}")
    return cat_ids

def check_duplicate_track(supa_url, service_key, title, artist, year):
    encoded_title = urllib.parse.quote(title.strip())
    req = urllib.request.Request(
        f"{supa_url}/rest/v1/beatline_tracks?select=id,title,artist,release_year&title=ilike.{encoded_title}",
        headers={'apikey': service_key, 'Authorization': f'Bearer {service_key}'}
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            tracks = json.load(resp)
            for t in tracks:
                if t['artist'].strip().lower() == artist.strip().lower() and int(t['release_year']) == int(year):
                    return True
    except Exception:
        pass
    return False

def register_track_in_supabase(supa_url, service_key, title, artist, year, file_path, category_ids):
    track_payload = json.dumps({
        'title': title.strip(),
        'artist': artist.strip(),
        'release_year': int(year),
        'file_path': file_path
    }).encode('utf-8')

    req = urllib.request.Request(
        f"{supa_url}/rest/v1/beatline_tracks",
        data=track_payload,
        headers={
            'apikey': service_key,
            'Authorization': f'Bearer {service_key}',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        created = json.load(resp)
        track_id = created[0]['id']

    if category_ids:
        rel_payload = json.dumps([{'track_id': track_id, 'category_id': cid} for cid in category_ids]).encode('utf-8')
        rel_req = urllib.request.Request(
            f"{supa_url}/rest/v1/beatline_track_categories",
            data=rel_payload,
            headers={
                'apikey': service_key,
                'Authorization': f'Bearer {service_key}',
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            }
        )
        with urllib.request.urlopen(rel_req, timeout=10):
            pass

    return track_id

def process_playlist(playlist_url):
    print("=" * 60)
    print("INICIANDO IMPORTAÇÃO DE PLAYLIST PARA O BEAT//LINE")
    print("=" * 60)

    creds = load_credentials()
    supa_url = creds['supabase_url']
    service_key = creds['supabase_service_role_key']

    print("→ Autenticando robô administrador...")
    bot_token = authenticate_bot(creds)
    print("✓ Robô autenticado com sucesso!")

    work_dir = Path("/tmp/beatline_import")
    if work_dir.exists():
        shutil.rmtree(work_dir)
    work_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n→ Extraindo informações e baixando áudios de: {playlist_url}")
    # Detectar o executor para o yt-dlp
    if shutil.which("yt-dlp"):
        base_cmd = ["yt-dlp"]
    elif shutil.which("uv"):
        base_cmd = ["uv", "tool", "run", "yt-dlp"]
    else:
        base_cmd = [sys.executable, "-m", "yt_dlp"]

    ydl_cmd = base_cmd + [
        "--format", "bestaudio/best",
        "--extract-audio",
        "--audio-format", "mp3",
        "--audio-quality", "192K",
        "--output", str(work_dir / "%(playlist_index)03d - %(title)s.%(ext)s"),
        "--write-info-json",
        "--ignore-errors",
        "--no-playlist" if ("watch?v=" in playlist_url and "list=" not in playlist_url) else "--yes-playlist",
        playlist_url
    ]

    subprocess.run(ydl_cmd, check=True)

    mp3_files = sorted(work_dir.glob("*.mp3"))
    print(f"\n✓ Download concluído: {len(mp3_files)} música(s) obtida(s).\n")

    if not mp3_files:
        print("[!] Nenhum MP3 foi encontrado para processar.")
        return

    sucessos = 0
    duplicadas = 0
    falhas = 0

    for idx, mp3 in enumerate(mp3_files, start=1):
        print(f"\n[{idx}/{len(mp3_files)}] Processando: {mp3.name}")
        info_json = mp3.with_suffix('.info.json')
        meta = {}
        if info_json.exists():
            try:
                with open(info_json, 'r', encoding='utf-8') as f:
                    meta = json.load(f)
            except Exception:
                pass

        raw_title = meta.get('title', mp3.stem)
        uploader = meta.get('uploader', '') or meta.get('channel', '')
        artist_meta = meta.get('artist', '')
        track_meta = meta.get('track', '')

        # Limpar título
        cleaned_title = clean_youtube_title(raw_title)

        # Detectar Artista e Título
        title = ""
        artist = ""

        if track_meta and artist_meta:
            title = track_meta
            artist = artist_meta
        elif ' - ' in cleaned_title:
            parts = cleaned_title.split(' - ', 1)
            artist = parts[0].strip()
            title = parts[1].strip()
        else:
            title = cleaned_title
            artist = uploader.replace(' - Topic', '').replace('VEVO', '').strip()

        # Buscar dados oficiais no iTunes para pegar o ANO REAL DE LANÇAMENTO
        print(f"  → Buscando metadados oficiais para '{title}' ({artist})...")
        itunes = search_itunes_metadata(f"{artist} {title}")
        
        year = None
        genre = None

        if itunes and itunes['year']:
            print(f"  ✓ Encontrado no catálogo oficial: {itunes['title']} por {itunes['artist']} ({itunes['year']})")
            title = itunes['title'] or title
            artist = itunes['artist'] or artist
            year = itunes['year']
            genre = itunes.get('genre')
        else:
            # Fallback para release_year do yt-dlp ou ano atual
            year = meta.get('release_year')
            if not year and meta.get('upload_date'):
                # Tenta o ano do upload como último caso
                year = int(meta['upload_date'][:4])
            print(f"  [Aviso] Usando ano alternativo: {year}")

        if not year or year < 1900 or year > 2100:
            year = 2000 # valor seguro caso não detecte

        # Montar categorias
        categories = []
        decade = compute_decade_category(year)
        if decade:
            categories.append(decade)
        if genre and len(genre) <= 30:
            categories.append(genre)

        # Se for artista brasileiro, podemos adicionar MPB/Nacional caso aplicável
        if any(w in uploader.lower() or w in raw_title.lower() for w in ['sertanejo', 'mpb', 'brasil', 'funk', 'pagode']):
            if 'Nacional' not in categories:
                categories.append('Nacional')

        print(f"  → Dados finais: Título: '{title}' | Artista: '{artist}' | Ano: {year} | Categorias: {categories}")

        # Checar duplicatas no Supabase
        if check_duplicate_track(supa_url, service_key, title, artist, year):
            print(f"  [Pular] Música já existente no catálogo: '{title}' - '{artist}' ({year})")
            duplicadas += 1
            continue

        try:
            # 1. Upload do MP3 para Cloudflare R2 via Media API
            print("  → Enviando MP3 para a Cloudflare Media API...")
            r2_filename = upload_mp3_to_cloudflare(mp3, bot_token)
            print(f"  ✓ MP3 salvo com sucesso: {r2_filename}")

            # 2. Obter ou criar categorias no Supabase
            cat_ids = get_or_create_categories(supa_url, service_key, categories)

            # 3. Registrar música no Supabase
            print("  → Registrando no Supabase...")
            track_id = register_track_in_supabase(supa_url, service_key, title, artist, year, r2_filename, cat_ids)
            print(f"  ✓ Cadastrada com sucesso! (ID: {track_id})")
            sucessos += 1

        except Exception as e:
            print(f"  [ERRO] Falha ao processar música '{title}': {e}")
            falhas += 1

    # Limpar diretório temporário
    shutil.rmtree(work_dir, ignore_errors=True)

    print("\n" + "=" * 60)
    print("RESUMO DA IMPORTAÇÃO:")
    print(f"  Total de músicas baixadas: {len(mp3_files)}")
    print(f"  ✓ Cadastradas com sucesso:  {sucessos}")
    print(f"  ⚠ Já existentes (duplicadas): {duplicadas}")
    print(f"  ✕ Falhas:                   {falhas}")
    print("=" * 60)

if __name__ == '__main__':
    if len(sys.argv) > 1:
        url = sys.argv[1].strip()
    else:
        url = input("Cole o link da playlist do YouTube: ").strip()

    if url:
        process_playlist(url)
    else:
        print("URL inválida.")
