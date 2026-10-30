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

/// A página pede depois que a pessoa escolheu qual circuito continua (ver `salvamento::migrar`). Só responde `ok` com a
/// migração inteira no disco.
#[tauri::command]
fn migrar_circuitos(texto: String, copias: Vec<serde_json::Value>, reiniciar_revisao: bool, dados: State<Dados>)
    -> Result<serde_json::Value, String> {
    let campo = |c: &serde_json::Value, nome: &str| c.get(nome).and_then(serde_json::Value::as_str).map(str::to_string);
    let pares = copias.iter().map(|c| match (campo(c, "original"), campo(c, "envelope")) {
        (Some(original), Some(envelope)) => Ok(salvamento::Par { original, envelope }),
        _ => Err("cópia sem original ou sem envelope: nada foi mudado".to_string()),
    }).collect::<Result<Vec<_>, _>>()?;
    salvamento::migrar(&dados.0, &texto, &pares, reiniciar_revisao).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "ok": true }))
}

#[tauri::command]
fn ver_versao_nova() {
    sistema::abrir_pagina_versoes();
}

/// A página chama depois de gravar o circuito pendente (ver `ao_fechar`).
#[tauri::command]
fn fechar(janela: WebviewWindow) {
    RESPONDEU.store(true, Ordering::SeqCst);
    let _ = janela.destroy();
}

/// A página chama quando não conseguiu gravar o circuito: a pessoa decide se fecha assim mesmo.
#[tauri::command]
fn fechar_sem_gravar(janela: WebviewWindow) {
    RESPONDEU.store(true, Ordering::SeqCst);
    fechar_se_a_pessoa_quiser(NAO_GRAVOU, perguntar_se_fecha, || { let _ = janela.destroy(); });
}

const NAO_GRAVOU: &str = "O circuito não pôde ser gravado agora, e a última mudança pode se perder se o Bancada Livre \
    fechar.\n\nFechar assim mesmo?\n\nNão: a janela continua aberta. Use Salvar para guardar o circuito num arquivo.";
const DEMOROU: &str = "A gravação do circuito está demorando mais que o normal.\n\nFechar assim mesmo? A última mudança \
    pode se perder.\n\nNão: a janela continua aberta e a gravação segue.";
const SEM_CONFERIR: &str = "Não foi possível conferir se o circuito foi gravado.\n\nFechar assim mesmo? A última \
    mudança pode se perder.\n\nNão: a janela continua aberta. Use Salvar para guardar o circuito num arquivo.";

fn perguntar_se_fecha(texto: &str) -> bool {
    sistema::perguntar(texto, 0x4 | 0x30 | 0x100) == 6      // Sim/Não, alerta, "Não" já escolhido
}

/// Sem a página confirmar que gravou, a janela só fecha se a pessoa disser Sim; com Não, ela fica aberta e um novo X
/// volta a ser atendido. Nunca destrói a janela sem perguntar (auditoria de 30/10/2026, BL-NR-02).
fn fechar_se_a_pessoa_quiser(texto: &str, perguntar: impl FnOnce(&str) -> bool, destruir: impl FnOnce()) {
    if perguntar(texto) {
        destruir();
    } else {
        FECHANDO.store(false, Ordering::SeqCst);
    }
}

// Fechar a janela não pode perder trabalho: o X pede à página que espere a gravação em andamento e grave o que faltar,
// e ela responde chamando `fechar` (gravou) ou `fechar_sem_gravar` (não conseguiu: a pessoa decide). Se a página não
// responder em PRAZO_PARA_FECHAR, o programa avisa que a gravação está demorando e a pessoa decide. Mais cliques no X,
// enquanto isso, são ignorados (antes, o segundo clique fechava na hora e a gravação se perdia).
static FECHANDO: AtomicBool = AtomicBool::new(false);
static RESPONDEU: AtomicBool = AtomicBool::new(false);
const PRAZO_PARA_FECHAR: Duration = Duration::from_secs(8);
const AO_FECHAR: &str = "Promise.resolve(window.__bancadaAoFechar ? window.__bancadaAoFechar() : true)\
    .catch(() => false).then((gravou) => window.__TAURI__.core.invoke(gravou === true ? 'fechar' : 'fechar_sem_gravar'))";

fn ao_fechar(janela: &tauri::Window, evento: &WindowEvent) {
    let WindowEvent::CloseRequested { api, .. } = evento else { return };
    // já fechando (esperando a gravação): mais um clique no X é ignorado; se demorar, o programa pergunta no prazo
    if FECHANDO.swap(true, Ordering::SeqCst) {
        api.prevent_close();
        return;
    }
    let Some(pagina) = janela.app_handle().get_webview_window("principal") else { return };
    api.prevent_close();
    RESPONDEU.store(false, Ordering::SeqCst);
    // não deu nem para pedir à página que grave: a pessoa decide, como quando a gravação falha
    if pagina.eval(AO_FECHAR).is_err() {
        std::thread::spawn(move || fechar_se_a_pessoa_quiser(SEM_CONFERIR, perguntar_se_fecha, || { let _ = pagina.destroy(); }));
        return;
    }
    std::thread::spawn(move || {
        let inicio = std::time::Instant::now();
        while inicio.elapsed() < PRAZO_PARA_FECHAR {
            if RESPONDEU.load(Ordering::SeqCst) { return; }
            std::thread::sleep(Duration::from_millis(100));
        }
        if RESPONDEU.load(Ordering::SeqCst) || !FECHANDO.load(Ordering::SeqCst) { return; }
        fechar_se_a_pessoa_quiser(DEMOROU, perguntar_se_fecha, || { let _ = pagina.destroy(); });
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
    // uma janela só por pasta de dados: a segunda abertura traz a primeira para a frente
    if !sistema::janela_unica(&dados, std::time::Duration::from_secs(4)) {
        return;
    }
    // todas as cópias do arquivo chegam à página antes de ela carregar, como estão no disco (nada é promovido, copiado
    // ou apagado ao abrir): o simulador confere cada uma e abre a de maior revisão, entre elas e o localStorage
    // (o arquivo principal vai à parte só se existir: sem ele, a reserva não pode aparecer na pergunta como principal)
    let (principal, outras): (Vec<_>, Vec<_>) = salvamento::candidatos(&dados).into_iter().partition(|c| c.principal);
    let (salvo, hora) = principal.into_iter().next().map(|c| (c.texto, c.hora)).unwrap_or_default();
    let reservas: Vec<serde_json::Value> = outras.into_iter()
        .map(|c| serde_json::json!({ "texto": c.texto, "hora": c.hora, "origem": c.origem })).collect();
    let inicio = format!("window.__BANCADA_CIRCUITO__ = {}; window.__BANCADA_CIRCUITO_HORA__ = {hora}; \
        window.__BANCADA_RESERVAS__ = {}; window.__BANCADA_REVISOES_REINICIADAS__ = {}; \
        window.__BANCADA_PERGUNTAR_MIGRACAO__ = {};",
        serde_json::Value::String(salvo), serde_json::Value::Array(reservas), salvamento::reinicios(&dados),
        salvamento::perguntar_migracao(&dados));
    let webview = dados.join("WebView2");
    // depois de uma queda, o WebView2 da vez anterior pode ter ficado órfão segurando o perfil (ver sistema.rs)
    let orfaos = sistema::encerrar_webview2_orfao(&webview.join("EBWebView"));
    if orfaos > 0 {
        anotar_erro(&dados, &format!("WebView2 órfão de uma queda anterior encerrado ({orfaos})"));
    }
    sem_conexao_do_perfil(&webview);
    registrar_erros_fatais(dados.clone());
    let resultado = tauri::Builder::default()
        .manage(Dados(dados.clone()))
        .invoke_handler(tauri::generate_handler![salvar_circuito, migrar_circuitos, ver_versao_nova, fechar, fechar_sem_gravar])
        .on_window_event(ao_fechar)
        .setup(move |app| {
            // a janela nasce invisível e só aparece pronta (fechar antes da hora derrubava a criação do WebView2 no Giz
            // Livre, 29/10/2026); se a criação falhar (WebView2 ainda ocupado depois de uma queda, ou logo depois de
            // instalar), tenta de novo, esperando cada vez mais
            let mut erro = None;
            for tentativa in 1..=ESPERAS_DA_JANELA.len() + 1 {
                match criar_janela(app, &webview, &inicio, janela_visivel_ao_criar(tentativa)) {
                    Ok(()) => return Ok(()),
                    Err(e) => {
                        anotar_erro(&dados, &format!("janela: erro ao criar (tentativa {tentativa}): {e}"));
                        if let Some(j) = app.get_webview_window("principal") { let _ = j.destroy(); }
                        // o WebView2 desta tentativa pode ficar preso ao perfil e estragar as próximas
                        let presos = sistema::encerrar_webview2_deste_programa(&webview.join("EBWebView"));
                        if presos > 0 { anotar_erro(&dados, &format!("janela: WebView2 da tentativa encerrado ({presos})")); }
                        erro = Some(e);
                        if let Some(ms) = ESPERAS_DA_JANELA.get(tentativa - 1) {
                            std::thread::sleep(Duration::from_millis(*ms));
                        }
                    }
                }
            }
            Err(erro.map(Box::from).unwrap_or_else(|| "janela não criada".into()))
        })
        .run(tauri::generate_context!());
    if resultado.is_err() {
        sistema::avisar_erro(NAO_ABRIU);
    }
}

/// Espera antes de cada nova tentativa de criar a janela. Logo depois de instalar, a criação falhou com 0x80070578 em
/// várias aberturas seguidas (bateria da 2.1.1-rc.1, 29/10/2026); três tentativas em 1,6 s não bastaram. São 15 s no
/// total, com o aviso só no fim.
const ESPERAS_DA_JANELA: [u64; 4] = [500, 2_000, 5_000, 7_500];

const NAO_ABRIU: &str = "O Bancada Livre não conseguiu abrir a janela agora (o componente WebView2 da Microsoft pode estar \
    ocupado, por exemplo logo depois de o programa fechar de repente).\n\nAbra o Bancada Livre de novo em alguns segundos. \
    Os circuitos salvos não foram afetados. Se acontecer de novo, reinicie o computador.";

/// Só a primeira tentativa cria a janela invisível. Escondida, o WebView2 às vezes recusa a janela com 0x80070578 em
/// todas as tentativas (bateria da 2.1.1-rc.2, 29/10/2026; o Giz na Tela viu o mesmo): a partir da segunda, ela nasce
/// visível, como na 2.1.0.
fn janela_visivel_ao_criar(tentativa: usize) -> bool { tentativa > 1 }

fn criar_janela(app: &tauri::App, webview: &std::path::Path, inicio: &str, visivel: bool) -> tauri::Result<()> {
    let j = WebviewWindowBuilder::new(app, "principal", WebviewUrl::App("index.html".into()))
        .title("Bancada Livre")
        .inner_size(1366.0, 800.0)
        .min_inner_size(800.0, 500.0)
        .maximized(visivel)
        .visible(visivel)
        .data_directory(webview.to_path_buf())
        .additional_browser_args(SEM_REDE)
        .initialization_script(inicio)
        .build()?;
    j.maximize()?;
    j.show()?;
    let _ = j.set_focus();
    Ok(())
}

/// Erros guardados em `erro.log`, na pasta de dados (o programa não tem console).
fn anotar_erro(dados: &std::path::Path, texto: &str) {
    use std::io::Write;
    let quando = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let _ = std::fs::create_dir_all(dados);
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(dados.join("erro.log")) {
        let _ = writeln!(f, "{quando} {} {texto}", env!("CARGO_PKG_VERSION"));
    }
}

/// Um erro fatal (o programa encerra na hora) antes só sumia com a janela, sem aviso (visto ao reabrir logo depois de
/// uma queda forçada, 29/10/2026). Agora fica anotado em `erro.log` e a pessoa recebe um aviso em português.
fn registrar_erros_fatais(dados: PathBuf) {
    std::panic::set_hook(Box::new(move |info| {
        anotar_erro(&dados, &format!("erro fatal: {info}"));
        sistema::avisar_erro(NAO_ABRIU);
    }));
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

    // BL-NR-02 (caso N06 do auditor): sem a página confirmar a gravação, só fecha com o Sim da pessoa; com Não, a janela
    // fica e o próximo X volta a ser atendido. O ramo do erro ao pedir à página passa por essa decisão
    #[test]
    fn sem_confirmacao_da_pagina_a_janela_so_fecha_com_o_sim() {
        use std::cell::Cell;
        let (perguntas, destruida) = (Cell::new(0), Cell::new(false));
        FECHANDO.store(true, Ordering::SeqCst);
        fechar_se_a_pessoa_quiser(SEM_CONFERIR, |_| { perguntas.set(perguntas.get() + 1); false }, || destruida.set(true));
        assert!(!destruida.get() && perguntas.get() == 1 && !FECHANDO.load(Ordering::SeqCst));
        fechar_se_a_pessoa_quiser(SEM_CONFERIR, |_| true, || destruida.set(true));
        assert!(destruida.get());
        let codigo = include_str!("main.rs");
        let ramo = &codigo[codigo.find("if pagina.eval(AO_FECHAR).is_err()").unwrap()..][..250];
        assert!(ramo.contains("fechar_se_a_pessoa_quiser(SEM_CONFERIR"), "o erro do eval não pergunta antes de fechar");
    }

    // N-C1 (auditoria do modelo nativo): resposta vazia, null ou estranha da página não fecha sem perguntar
    #[test]
    fn so_fecha_direto_quando_a_pagina_diz_que_gravou() {
        assert!(AO_FECHAR.contains("gravou === true ? 'fechar' : 'fechar_sem_gravar'"));
    }

    #[test]
    fn so_a_primeira_tentativa_cria_a_janela_escondida() {
        assert!(!janela_visivel_ao_criar(1));
        assert!((2..=ESPERAS_DA_JANELA.len() + 1).all(janela_visivel_ao_criar));
    }

    #[test]
    fn tenta_criar_a_janela_por_15_segundos_esperando_cada_vez_mais() {
        assert!(ESPERAS_DA_JANELA.windows(2).all(|par| par[0] < par[1]));
        assert_eq!(ESPERAS_DA_JANELA.iter().sum::<u64>(), 15_000);
    }
}
