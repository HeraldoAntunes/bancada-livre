# Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
# Testes do lançador.  Uso:  python -m unittest discover -s instalador -p "test_*.py"
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import lancador


class TestLancador(unittest.TestCase):
    def test_endereco_do_arquivo_com_espaco_e_acento(self):
        caminho = Path(tempfile.gettempdir()) / "Pasta Ação" / "bancada-livre.html"
        url = lancador.endereco(caminho)
        self.assertTrue(url.startswith("file:///"))
        self.assertNotIn(" ", url)

    def test_comando_abre_em_janela_propria(self):
        cmd = lancador.comando("msedge.exe", "file:///C:/x/bancada-livre.html")
        self.assertEqual(cmd[0], "msedge.exe")
        self.assertIn("--app=file:///C:/x/bancada-livre.html", cmd)

    def test_sem_o_html_avisa_e_nao_abre_nada(self):
        with tempfile.TemporaryDirectory() as vazia, \
                mock.patch.object(lancador, "pasta_do_programa", return_value=Path(vazia)), \
                mock.patch.object(lancador, "avisar") as avisar, \
                mock.patch.object(lancador.subprocess, "Popen") as popen, \
                mock.patch.object(lancador.webbrowser, "open") as navegador:
            self.assertEqual(lancador.main([]), 1)
            avisar.assert_called_once()
            popen.assert_not_called()
            navegador.assert_not_called()

    def test_sem_edge_nem_chrome_usa_o_navegador_padrao(self):
        with tempfile.TemporaryDirectory() as pasta:
            (Path(pasta) / lancador.NOME_HTML).write_text("<!doctype html>", encoding="utf-8")
            with mock.patch.object(lancador, "pasta_do_programa", return_value=Path(pasta)), \
                    mock.patch.object(lancador, "navegadores", return_value=[]), \
                    mock.patch.object(lancador.webbrowser, "open") as navegador:
                self.assertEqual(lancador.main([]), 0)
                navegador.assert_called_once()

    def test_mostrar_so_imprime_o_comando(self):
        with tempfile.TemporaryDirectory() as pasta:
            (Path(pasta) / lancador.NOME_HTML).write_text("<!doctype html>", encoding="utf-8")
            with mock.patch.object(lancador, "pasta_do_programa", return_value=Path(pasta)), \
                    mock.patch.object(lancador.subprocess, "Popen") as popen, \
                    mock.patch("builtins.print") as imprimir:
                self.assertEqual(lancador.main(["--mostrar"]), 0)
                popen.assert_not_called()
                self.assertEqual(imprimir.call_count, 2)


class TestBarraDeTarefas(unittest.TestCase):
    # identidades lidas de janelas reais do Edge em 28/10/2026
    def test_identidade_igual_a_do_edge(self):
        casos = {
            "file:///C:/a%20b/bancada-livre.html": "MSEdge._/C:/a%20b/bancada-livre.html",
            "file:///C:/abcdefg/bancada-livre.html": "MSEdge._/C:/abcdefg/bancada-livre.html",
            "file:///C:/abcdefgh/bancada-livre.html": "MSEdge._/C:/abcdefgh/bncada-livre.html",
            "file:///C:/A%C3%A7%C3%A3o/bancada-livre.html": "MSEdge._/C:/A%C3%A7%C3ncada-livre.html",
            "file:///C:/Users/heral/AppData/Local/Programs/Bancada%20Livre/_internal/bancada-livre.html":
                "MSEdge._/C:/Users/herancada-livre.html",
        }
        for url, esperado in casos.items():
            self.assertEqual(lancador.id_da_janela(url), esperado)

    def test_endereco_codifica_como_o_edge_espera(self):
        url = lancador.endereco(Path("C:/Ação/bancada-livre.html"))
        self.assertEqual(url, "file:///C:/A%C3%A7%C3%A3o/bancada-livre.html")

    def test_abre_sempre_no_perfil_padrao(self):
        self.assertIn("--profile-directory=Default", lancador.comando("msedge.exe", "file:///C:/x.html"))


if __name__ == "__main__":
    unittest.main()
