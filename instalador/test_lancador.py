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
                imprimir.assert_called_once()


class TestBarraDeTarefas(unittest.TestCase):
    def test_reconhece_so_a_janela_do_simulador(self):
        self.assertTrue(lancador.e_janela_do_programa("Chrome_WidgetWin_1", "Bancada Livre"))
        self.assertFalse(lancador.e_janela_do_programa("Chrome_WidgetWin_1", "Bancada Livre - Pessoal - Microsoft Edge"))
        self.assertFalse(lancador.e_janela_do_programa("Notepad", "Bancada Livre"))

    def test_comando_relancar_cabe_no_limite_e_aponta_o_icone(self):
        cmd, ico = lancador.comando_relancar()
        self.assertLess(len(cmd), 260)
        self.assertTrue(ico.endswith(",0"))

    def test_marca_a_janela_com_o_id_e_o_comando_de_reabrir(self):
        marcadas = {}
        relogio = iter(range(1000)).__next__
        aumid = lambda: (lambda h, v: marcadas.__setitem__(h, v), lambda h: marcadas.get(h, {}).get(5, ""),
                         lambda: [7])
        n = lancador.marcar_janelas_na_barra(dormir=lambda s: None, relogio=relogio, com_aumid=aumid)
        self.assertEqual(n, 1)
        self.assertEqual(marcadas[7][5], "BancadaLivre")
        self.assertIn(2, marcadas[7])   # comando para reabrir
        self.assertTrue(marcadas[7][3].endswith(",0"))   # ícone

    def test_sem_janela_desiste_no_prazo(self):
        relogio = iter(range(1000)).__next__
        aumid = lambda: (lambda h, v: None, lambda h: "", lambda: [])
        self.assertEqual(lancador.marcar_janelas_na_barra(espera_s=5, dormir=lambda s: None, relogio=relogio,
                                                          com_aumid=aumid), 0)

    def test_falha_do_windows_nao_impede_abrir(self):
        def quebra():
            raise OSError("sem IPropertyStore")
        self.assertEqual(lancador.marcar_janelas_na_barra(com_aumid=quebra), 0)

    def test_depois_de_abrir_no_edge_marca_a_janela(self):
        with tempfile.TemporaryDirectory() as pasta:
            (Path(pasta) / lancador.NOME_HTML).write_text("<!doctype html>", encoding="utf-8")
            with mock.patch.object(lancador, "pasta_do_programa", return_value=Path(pasta)), \
                    mock.patch.object(lancador, "navegadores", return_value=[__file__]), \
                    mock.patch.object(lancador.subprocess, "Popen"), \
                    mock.patch.object(lancador.os, "name", "nt"), \
                    mock.patch.object(lancador, "marcar_janelas_na_barra") as marcar:
                self.assertEqual(lancador.main([]), 0)
                marcar.assert_called_once()


if __name__ == "__main__":
    unittest.main()
