#!/usr/bin/env python3
"""
Compatibilidade com chamadas anteriores: redireciona para scripts/importar_musicas.py
"""
import sys
from pathlib import Path

script_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(script_dir))

import importar_musicas

if __name__ == '__main__':
    importar_musicas.main()
