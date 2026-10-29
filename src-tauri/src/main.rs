// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Programa do Windows: abre o simulador (o mesmo HTML único do navegador, embutido aqui) numa janela própria do
// WebView2, sem depender do navegador do dia a dia. Não tem rede. Além do localStorage, guarda o circuito em arquivo
// (salvamento.rs) e abre a página de versões pelo botão do Sobre. Aberto de fora da pasta de instalação, oferece se
// instalar (instalacao.rs).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod instalacao;
mod salvamento;
mod sistema;

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::{Manager, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent};

/// Pasta dos dados deste usuário: o circuito salvo e os arquivos do WebView2.
struct Dados(PathBuf);

/// O WebView2, sozinho, conversa com servidores da Microsoft (atualização de componentes, telemetria, SmartScreen).
/// O programa não precisa de rede nenhuma: estes argumentos desligam esses serviços e mandam qualquer conexão que
/// sobrar para um proxy que não existe, então nada sai do computador. As três primeiras funções desligadas são as
/// que o Tauri já desliga por padrão.
const SEM_REDE: &str = "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection,AutofillServerCommunication,\
OptimizationHints,MediaRouter,msEdgeTranslate --disable-background-networking --disable-component-update \
--disable-domain-reliability --disable-sync --no-pings --disable-client-side-phishing-detection \
--proxy-server=http://127.0.0.1:9 --proxy-bypass-list=<-loopback>";

/// O processo principal do WebView2 abre uma conexão com a Microsoft, fora do alcance de SEM_REDE, só quando o
/// arquivo `EBWebView\Local State` do perfil já registra o perfil (bisseção da gestão em 29/10/2026, documentada em
/// WEBVIEW2-REDE.md). Apagar só esse arquivo, só na pasta deste programa, antes de abrir a janela, evita a conexão; os
/// dados da página (localStorage e IndexedDB) ficam em outros arquivos e não são tocados. Sem o arquivo, nada a fazer.
fn sem_conexao_do_perfil(webview: &std::path::Path) {
    let _ = std::fs::remove_file(webview.join("EBWebView").join("Local State"));
}

fn pasta_de_dados() -> PathBuf {
    std::env::var_os("LOCALAPPDATA").map(PathBuf::from).unwrap_or_else(std::env::temp_dir).join("Bancada Livre")
}

#[tauri::command]
fn salvar_circuito(texto: String, dados: State<Dados>) -> Result<(), String> {
    salvamento::gravar(&dados.0, &texto).map_err(|e| e.to_string())
}

#[tauri::command]
fn ver_versao_nova() {
    sistema::abrir_pagina_versoes();
}

/// A página chama depois de gravar o circuito pendente (ver `ao_fechar`).
#[tauri::command]
fn fechar(janela: WebviewWindow) {
    let _ = janela.destroy();
}

// Fechar a janela logo depois de uma mudança não pode perder a mudança: o X pede à página que grave o que estiver
// esperando e ela chama `fechar` em seguida. Se a página não responder em 3 s, a janela fecha assim mesmo; um segundo
// clique no X também fecha na hora.
static FECHANDO: AtomicBool = AtomicBool::new(false);
const AO_FECHAR: &str = "Promise.resolve(window.__bancadaAoFechar && window.__bancadaAoFechar()).catch(() => {})    .finally(() => window.__TAURI__.core.invoke('fechar'))";

fn ao_fechar(janela: &tauri::Window, evento: &WindowEvent) {
    let WindowEvent::CloseRequested { api, .. } = evento else { return };
    if FECHANDO.swap(true, Ordering::SeqCst) { return; }
    let Some(pagina) = janela.app_handle().get_webview_window("principal") else { return };
    api.prevent_close();
    if pagina.eval(AO_FECHAR).is_err() {
        let _ = pagina.destroy();
        return;
    }
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(3));
        let _ = pagina.destroy();
    });
}

fn main() {
    sistema::marcar_programa();
    instalacao::comandos();
    // sem WebView2, primeiro tenta o instalador oficial que vem no pacote "para escola sem internet"
    if !sistema::tem_webview2() && !sistema::instalar_webview2_ao_lado() {
        sistema::avisar_sem_webview2();
        return;
    }
    if let instalacao::Seguir::Sair = instalacao::ao_abrir() {
        return;
    }
    let dados = pasta_de_dados();
    // o circuito do arquivo chega à página antes de ela carregar: o simulador o prefere ao do localStorage
    let salvo = salvamento::ler(&dados).unwrap_or_default();
    let inicio = format!("window.__BANCADA_CIRCUITO__ = {};", serde_json::Value::String(salvo));
    let webview = dados.join("WebView2");
    sem_conexao_do_perfil(&webview);
    let resultado = tauri::Builder::default()
        .manage(Dados(dados))
        .invoke_handler(tauri::generate_handler![salvar_circuito, ver_versao_nova, fechar])
        .on_window_event(ao_fechar)
        .setup(move |app| {
            WebviewWindowBuilder::new(app, "principal", WebviewUrl::App("index.html".into()))
                .title("Bancada Livre")
                .inner_size(1366.0, 800.0)
                .min_inner_size(800.0, 500.0)
                .maximized(true)
                .data_directory(webview.clone())
                .additional_browser_args(SEM_REDE)
                .initialization_script(&inicio)
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!());
    if let Err(e) = resultado {
        sistema::avisar_erro(&format!("O Bancada Livre não conseguiu abrir a janela.\n\n{e}"));
    }
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn apaga_so_o_local_state_do_perfil() {
        let webview = std::env::temp_dir().join(format!("bancada-teste-perfil-{}", std::process::id()));
        let perfil = webview.join("EBWebView");
        std::fs::create_dir_all(perfil.join("Default").join("Local Storage")).unwrap();
        std::fs::write(perfil.join("Local State"), b"{\"profile\":{\"info_cache\":{\"Default\":{}}}}").unwrap();
        std::fs::write(perfil.join("Default").join("Local Storage").join("000003.log"), b"circuito").unwrap();
        sem_conexao_do_perfil(&webview);
        assert!(!perfil.join("Local State").exists());
        assert!(perfil.join("Default").join("Local Storage").join("000003.log").exists());
        sem_conexao_do_perfil(&webview);       // sem o arquivo: nada a fazer, sem erro
        let _ = std::fs::remove_dir_all(webview);
    }
}
