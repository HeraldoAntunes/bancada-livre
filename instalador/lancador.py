# Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
"""Lançador do Bancada Livre para Windows (vira o BancadaLivre.exe pelo PyInstaller).

Abre o simulador, que é o arquivo bancada-livre.html guardado junto com o programa, numa janela própria do
Edge ou do Chrome (modo app, sem barra de endereço). Sem nenhum dos dois, abre no navegador padrão.
Não tem servidor nem acesso à rede: só abre o arquivo e termina.

Uso:  BancadaLivre.exe              abre o simulador
      BancadaLivre.exe --mostrar    só mostra o comando que seria usado (para conferência)
"""
import os
import subprocess
import sys
import webbrowser
from pathlib import Path

NOME_HTML = "bancada-livre.html"


def pasta_do_programa() -> Path:
    # empacotado pelo PyInstaller (onedir), os dados ficam em _internal (sys._MEIPASS)
    if getattr(sys, "frozen", False):
        return Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent))
    return Path(__file__).resolve().parent


def navegadores() -> list[str]:
    return [os.path.expandvars(c) for c in (
        r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe",
        r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe",
        r"%ProgramFiles%\Google\Chrome\Application\chrome.exe",
        r"%LocalAppData%\Google\Chrome\Application\chrome.exe",
    )]


def endereco(html: Path) -> str:
    return html.resolve().as_uri()


def comando(exe: str, url: str) -> list[str]:
    # sempre o perfil padrão: com outro perfil o Edge muda a identidade da janela (ver id_da_janela)
    return [exe, f"--app={url}", "--profile-directory=Default", "--start-maximized"]


def id_da_janela(url: str) -> str:
    """Identidade (AppUserModelID) que o Edge dá à janela aberta com --app=<url>, no perfil padrão: "MSEdge._" mais
    o caminho da URL; acima de 31 caracteres, só os 15 primeiros e os 16 últimos. Conferido no Edge em 28/10/2026.
    O instalador grava a mesma identidade nos atalhos (função IdDaJanela do .iss): assim o pino da barra de tarefas
    fica com o ícone do Bancada Livre sem nenhum código mexendo na janela."""
    nome = "_" + url.removeprefix("file://")
    if len(nome) > 31:
        nome = nome[:15] + nome[-16:]
    return "MSEdge." + nome


def avisar(texto: str) -> None:
    """Caixa de mensagem do Windows (o .exe não tem console onde imprimir)."""
    try:
        import ctypes
        ctypes.windll.user32.MessageBoxW(None, texto, "Bancada Livre", 0x10)
    except (ImportError, AttributeError, OSError):
        print(texto, file=sys.stderr)


def main(argv: list[str]) -> int:
    html = pasta_do_programa() / NOME_HTML
    if not html.is_file():
        avisar(f"Não encontrei o arquivo do simulador:\n{html}\n\nReinstale o Bancada Livre.")
        return 1
    url = endereco(html)
    exe = next((e for e in navegadores() if os.path.exists(e)), None)
    if "--mostrar" in argv:
        print(subprocess.list2cmdline(comando(exe, url)) if exe else f"navegador padrão: {url}")
        print(f"identidade da janela no Edge: {id_da_janela(url)}")
        return 0
    if exe:
        try:
            subprocess.Popen(comando(exe, url), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return 0
        except OSError:
            pass
    webbrowser.open(url)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
