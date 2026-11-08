#!/usr/bin/env python3
"""
Pipeline Unificado de Importação de Músicas para o BEAT//LINE.

Suporta:
1. URLs de Playlists ou Vídeos do YouTube:
   python3 scripts/importar_musicas.py "https://www.youtube.com/playlist?list=..."

2. Listas de Músicas diretamente (sem precisar de playlist no YouTube!):
   python3 scripts/importar_musicas.py --busca "Queen - Bohemian Rhapsody" "A-ha - Take On Me"

3. Arquivo de texto contendo 1 música por linha:
   python3 scripts/importar_musicas.py --arquivo musicas.txt

4. Entrada via Pipe/Stdin:
   cat musicas.txt | python3 scripts/importar_musicas.py
"""

import os
import sys
import re
import json
import uuid
import shutil
import argparse
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

def check_duplicate_track(supa_url, service_key, title, artist, year=None):
    """Verifica se a faixa já existe no banco de dados."""
    encoded_title = urllib.parse.quote(title.strip())
    url = f"{supa_url}/rest/v1/beatline_tracks?select=id,title,artist,release_year&title=ilike.{encoded_title}"
    req = urllib.request.Request(url, headers={'apikey': service_key, 'Authorization': f'Bearer {service_key}'})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            tracks = json.load(resp)
            for t in tracks:
                same_artist = t['artist'].strip().lower() == artist.strip().lower()
                if same_artist:
                    if year is None:
                        return True
                    if int(t['release_year']) == int(year):
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

def get_ytdlp_base_cmd():
    if shutil.which("yt-dlp"):
        return ["yt-dlp"]
    elif shutil.which("uv"):
        return ["uv", "tool", "run", "yt-dlp"]
    return [sys.executable, "-m", "yt_dlp"]

def process_music_import(items, is_playlist=False):
    """
    Processa uma lista de buscas ("Artista - Música") ou uma URL de Playlist.
    """
    print("=" * 65)
    print("INICIANDO IMPORTAÇÃO AUTOMÁTICA DE MÚSICAS PARA O BEAT//LINE")
    print("=" * 65)

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

    base_cmd = get_ytdlp_base_cmd()

    # Montar comando de download
    if is_playlist:
        playlist_url = items[0]
        print(f"\n→ Modo Playlist: Extraindo áudios de: {playlist_url}")
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
    else:
        # Modo Lista de Músicas com busca direta (ytsearch1:)
        print(f"\n→ Modo Lista: Processando {len(items)} música(s) via busca direta no YouTube...")
        batch_file = work_dir / "batch_queries.txt"
        with open(batch_file, "w", encoding="utf-8") as bf:
            for item in items:
                clean_item = item.strip()
                if clean_item:
                    # Prefixo ytsearch1: para buscar o primeiro resultado mais relevante no YouTube
                    bf.write(f"ytsearch1:{clean_item}\n")

        ydl_cmd = base_cmd + [
            "--format", "bestaudio/best",
            "--extract-audio",
            "--audio-format", "mp3",
            "--audio-quality", "192K",
            "--output", str(work_dir / "%(autonumber)03d - %(title)s.%(ext)s"),
            "--write-info-json",
            "--ignore-errors",
            "--batch-file", str(batch_file)
        ]
        subprocess.run(ydl_cmd, check=True)

    mp3_files = sorted(work_dir.glob("*.mp3"))
    print(f"\n✓ Download concluído: {len(mp3_files)} áudio(s) obtido(s).\n")

    if not mp3_files:
        print("[!] Nenhum áudio foi baixado.")
        return

    sucessos = 0
    duplicadas = 0
    falhas = 0
    cadastradas = []

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
            year = meta.get('release_year')
            if not year and meta.get('upload_date'):
                year = int(meta['upload_date'][:4])
            print(f"  [Aviso] Usando ano alternativo: {year}")

        if not year or year < 1900 or year > 2100:
            year = 2000

        # Montar categorias
        categories = []
        decade = compute_decade_category(year)
        if decade:
            categories.append(decade)
        if genre and len(genre) <= 30:
            categories.append(genre)

        if any(w in uploader.lower() or w in raw_title.lower() for w in ['sertanejo', 'mpb', 'brasil', 'funk', 'pagode']):
            if 'Nacional' not in categories:
                categories.append('Nacional')

        print(f"  → Dados finais: '{title}' | Artista: '{artist}' | Ano: {year} | Categorias: {categories}")

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
            cadastradas.append({
                'title': title,
                'artist': artist,
                'year': year,
                'categories': categories,
                'file_path': r2_filename
            })

        except Exception as e:
            print(f"  [ERRO] Falha ao processar música '{title}': {e}")
            falhas += 1

    shutil.rmtree(work_dir, ignore_errors=True)

    print("\n" + "=" * 65)
    print("RESUMO DA IMPORTAÇÃO:")
    print(f"  Total de músicas baixadas:    {len(mp3_files)}")
    print(f"  ✓ Cadastradas com sucesso:     {sucessos}")
    print(f"  ⚠ Já existentes (duplicadas):   {duplicadas}")
    print(f"  ✕ Falhas:                      {falhas}")
    print("=" * 65)

    return cadastradas

def main():
    parser = argparse.ArgumentParser(description="Importador de Músicas do BEAT//LINE")
    parser.add_argument('targets', nargs='*', help="URLs de playlist/vídeo ou nomes de músicas (Artista - Música)")
    parser.add_argument('--arquivo', '-a', help="Caminho para arquivo de texto com 1 música por linha")
    parser.add_argument('--busca', '-b', nargs='+', help="Lista de músicas para pesquisar no YouTube")
    parser.add_argument('--playlist', '-p', help="URL de playlist do YouTube")

    args = parser.parse_args()

    items = []
    is_playlist = False

    if args.playlist:
        items = [args.playlist]
        is_playlist = True
    elif args.arquivo:
        with open(args.arquivo, 'r', encoding='utf-8') as f:
            items = [line.strip() for line in f if line.strip() and not line.startswith('#')]
    elif args.busca:
        items = args.busca
    elif args.targets:
        first = args.targets[0].strip()
        if first.startswith('http://') or first.startswith('https://'):
            items = [first]
            is_playlist = True
        elif os.path.isfile(first):
            with open(first, 'r', encoding='utf-8') as f:
                items = [line.strip() for line in f if line.strip() and not line.startswith('#')]
        else:
            items = args.targets
    elif not sys.stdin.isatty():
        # Lendo de stdin
        items = [line.strip() for line in sys.stdin if line.strip() and not line.startswith('#')]
    else:
        entrada = input("Cole o link da playlist OU digite as músicas (Artista - Nome): ").strip()
        if entrada.startswith('http://') or entrada.startswith('https://'):
            items = [entrada]
            is_playlist = True
        else:
            items = [entrada]

    if not items:
        print("Nenhuma música ou URL fornecida.")
        sys.exit(1)

    process_music_import(items, is_playlist=is_playlist)

if __name__ == '__main__':
    main()
