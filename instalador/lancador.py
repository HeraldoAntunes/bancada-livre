# Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
"""Lançador do Bancada Livre para Windows (vira o BancadaLivre.exe pelo PyInstaller).

Abre o simulador, que é o arquivo bancada-livre.html guardado junto com o programa, numa janela própria do
Edge ou do Chrome (modo app, sem barra de endereço). Sem nenhum dos dois, abre no navegador padrão.
Não tem servidor nem acesso à rede: abre o arquivo, marca a janela para a barra de tarefas e termina.

Uso:  BancadaLivre.exe              abre o simulador
      BancadaLivre.exe --mostrar    só mostra o comando que seria usado (para conferência)
"""
import os
import subprocess
import sys
import time
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
    return [exe, f"--app={url}", "--start-maximized"]


def avisar(texto: str) -> None:
    """Caixa de mensagem do Windows (o .exe não tem console onde imprimir)."""
    try:
        import ctypes
        ctypes.windll.user32.MessageBoxW(None, texto, "Bancada Livre", 0x10)
    except (ImportError, AttributeError, OSError):
        print(texto, file=sys.stderr)


# ---- ícone na barra de tarefas (Windows) ----
# O simulador roda numa janela do Edge/Chrome em modo app. Sem isto, ao fixar na barra de tarefas o Windows guarda o
# Edge (ícone e atalho). Aqui marcamos a janela com o AppUserModelID do Bancada Livre (o mesmo dos atalhos do
# instalador) e com o comando e o ícone para reabrir o programa. Tudo é opcional: se falhar, o programa segue normal.
APP_ID = "BancadaLivre"
TITULO = "Bancada Livre"
_FMT_AUMID = "{9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3}"
_PID_RELAUNCH_CMD, _PID_RELAUNCH_ICON, _PID_RELAUNCH_NOME, _PID_ID = 2, 3, 4, 5


def _caminho_curto(caminho: str) -> str:
    try:
        import ctypes
        buf = ctypes.create_unicode_buffer(520)
        n = ctypes.windll.kernel32.GetShortPathNameW(caminho, buf, 520)
        return buf.value if 0 < n < 520 else caminho
    except (ImportError, AttributeError, OSError):
        return caminho


def comando_relancar() -> tuple[str, str]:
    """(linha de comando, ícone "caminho,0") para reabrir o Bancada Livre a partir do pino da barra de tarefas.
    A janela guarda no máximo MAX_PATH caracteres: se passar, encurta os caminhos."""
    if getattr(sys, "frozen", False):
        exe = str(Path(sys.executable).resolve())
        base, ico = [exe], exe
    else:
        py = Path(sys.executable).resolve()
        pyw = py.with_name("pythonw.exe")
        icone = Path(__file__).resolve().parent / "bancada-livre.ico"
        base = [str(pyw if pyw.exists() else py), str(Path(__file__).resolve())]
        ico = str(icone if icone.exists() else base[0])
    cmd = subprocess.list2cmdline(base)
    if len(cmd) >= 260:
        cmd = subprocess.list2cmdline([_caminho_curto(c) for c in base])
    if len(ico) + 2 >= 260:
        ico = _caminho_curto(ico)
    return cmd, f"{ico},0"


def e_janela_do_programa(classe: str, titulo: str) -> bool:
    """Janela do Edge/Chrome em modo app com o título da página do simulador."""
    return classe == "Chrome_WidgetWin_1" and (titulo == TITULO or titulo.endswith(" - " + TITULO))


def _com_aumid():
    """Prepara as estruturas ctypes de IPropertyStore (só Windows). Devolve (definir, ler, listar_janelas)."""
    import ctypes
    from ctypes import wintypes

    class GUID(ctypes.Structure):
        _fields_ = [("d1", ctypes.c_ulong), ("d2", ctypes.c_ushort), ("d3", ctypes.c_ushort), ("d4", ctypes.c_ubyte * 8)]

    class PROPERTYKEY(ctypes.Structure):
        _fields_ = [("fmtid", GUID), ("pid", wintypes.DWORD)]

    class _Valor(ctypes.Union):
        _fields_ = [("ptr", ctypes.c_void_p), ("pad", ctypes.c_ulonglong * 2)]

    class PROPVARIANT(ctypes.Structure):
        _fields_ = [("vt", ctypes.c_ushort), ("r1", ctypes.c_ushort), ("r2", ctypes.c_ushort), ("r3", ctypes.c_ushort),
                    ("v", _Valor)]

    VT_LPWSTR = 31
    ole32, shell32, user32 = ctypes.windll.ole32, ctypes.windll.shell32, ctypes.windll.user32

    def guid(texto):
        g = GUID()
        if ole32.CLSIDFromString(ctypes.c_wchar_p(texto), ctypes.byref(g)) != 0:
            raise OSError("GUID inválido")
        return g

    iid_store = guid("{886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99}")
    fmt = guid(_FMT_AUMID)
    shell32.SHGetPropertyStoreForWindow.argtypes = [wintypes.HWND, ctypes.POINTER(GUID), ctypes.POINTER(ctypes.c_void_p)]
    shell32.SHGetPropertyStoreForWindow.restype = ctypes.c_long
    PROTO_REL = ctypes.WINFUNCTYPE(ctypes.c_ulong, ctypes.c_void_p)
    PROTO_GET = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, ctypes.POINTER(PROPERTYKEY), ctypes.POINTER(PROPVARIANT))
    PROTO_SET = PROTO_GET
    PROTO_COMMIT = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p)
    ole32.PropVariantClear.argtypes = [ctypes.POINTER(PROPVARIANT)]

    def chave(pid):
        return PROPERTYKEY(fmt, pid)

    def com_store(hwnd, fn):
        store = ctypes.c_void_p()
        if shell32.SHGetPropertyStoreForWindow(hwnd, ctypes.byref(iid_store), ctypes.byref(store)) != 0 or not store:
            raise OSError("sem IPropertyStore")
        vt = ctypes.cast(store, ctypes.POINTER(ctypes.POINTER(ctypes.c_void_p)))[0]
        try:
            return fn(store, vt)
        finally:
            PROTO_REL(vt[2])(store)

    def ler(hwnd, pid=_PID_ID) -> str:
        def fn(store, vt):
            pv = PROPVARIANT()
            if PROTO_GET(vt[5])(store, ctypes.byref(chave(pid)), ctypes.byref(pv)) != 0:
                return ""
            try:
                return ctypes.wstring_at(pv.v.ptr) if pv.vt == VT_LPWSTR and pv.v.ptr else ""
            finally:
                ole32.PropVariantClear(ctypes.byref(pv))
        return com_store(hwnd, fn)

    def definir(hwnd, valores: dict) -> None:
        def fn(store, vt):
            definir_valor = PROTO_SET(vt[6])
            erros = []
            for pid, texto in valores.items():   # cada propriedade por si: uma recusada não impede as outras
                buf = ctypes.create_unicode_buffer(texto)
                pv = PROPVARIANT()
                pv.vt = VT_LPWSTR
                pv.v.ptr = ctypes.cast(buf, ctypes.c_void_p).value
                r = definir_valor(store, ctypes.byref(chave(pid)), ctypes.byref(pv))
                if r != 0:
                    erros.append(f"{pid}: {r & 0xFFFFFFFF:#010x}")
            PROTO_COMMIT(vt[7])(store)
            if erros:
                raise OSError("SetValue recusado (" + ", ".join(erros) + ")")
        com_store(hwnd, fn)

    WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    user32.EnumWindows.argtypes = [WNDENUMPROC, wintypes.LPARAM]

    def janelas_do_programa() -> list:
        achadas = []

        def cada(hwnd, _):
            if user32.IsWindowVisible(hwnd):
                cls = ctypes.create_unicode_buffer(64)
                user32.GetClassNameW(hwnd, cls, 64)
                tit = ctypes.create_unicode_buffer(512)
                user32.GetWindowTextW(hwnd, tit, 512)
                if e_janela_do_programa(cls.value, tit.value):
                    achadas.append(hwnd)
            return True

        user32.EnumWindows(WNDENUMPROC(cada), 0)
        return achadas

    return definir, ler, janelas_do_programa


def marcar_janelas_na_barra(espera_s: float = 30, depois_s: float = 3, dormir=time.sleep, relogio=time.monotonic,
                            com_aumid=None) -> int:
    """Espera a janela do simulador abrir e aplica o AUMID e o ícone de relançamento. Depois da primeira marcada,
    vigia mais `depois_s` segundos (o Edge pode trocar o ID logo depois de abrir) e termina. Devolve quantas marcou."""
    try:
        if com_aumid is None:
            import ctypes
            ctypes.windll.ole32.CoInitialize(None)
            com_aumid = _com_aumid
        definir, ler, janelas = com_aumid()
        cmd, ico = comando_relancar()
        # o ID vem primeiro: sem ele a janela recusa as propriedades de relançamento
        valores = {_PID_ID: APP_ID, _PID_RELAUNCH_CMD: cmd, _PID_RELAUNCH_ICON: ico, _PID_RELAUNCH_NOME: TITULO}
    except (ImportError, AttributeError, OSError):
        return 0
    marcadas, fim = 0, relogio() + espera_s
    while relogio() < fim:
        for hwnd in janelas():
            try:
                if ler(hwnd) != APP_ID:
                    definir(hwnd, valores)
                    if marcadas == 0:
                        fim = min(fim, relogio() + depois_s)
                    marcadas += 1
            except OSError:
                pass
        dormir(0.3)
    return marcadas


def main(argv: list[str]) -> int:
    html = pasta_do_programa() / NOME_HTML
    if not html.is_file():
        avisar(f"Não encontrei o arquivo do simulador:\n{html}\n\nReinstale o Bancada Livre.")
        return 1
    url = endereco(html)
    exe = next((e for e in navegadores() if os.path.exists(e)), None)
    if "--mostrar" in argv:
        print(subprocess.list2cmdline(comando(exe, url)) if exe else f"navegador padrão: {url}")
        return 0
    if exe:
        try:
            subprocess.Popen(comando(exe, url), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except OSError:
            pass
        else:
            if os.name == "nt":
                marcar_janelas_na_barra()
            return 0
    webbrowser.open(url)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
