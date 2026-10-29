// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Chamadas diretas ao Windows: identidade na barra de tarefas, abrir a página de versões, avisos e WebView2.

#[link(name = "user32")]
extern "system" {
    fn MessageBoxW(hwnd: isize, texto: *const u16, titulo: *const u16, tipo: u32) -> i32;
}
#[link(name = "shell32")]
extern "system" {
    fn ShellExecuteW(hwnd: isize, op: *const u16, arq: *const u16, par: *const u16, pasta: *const u16, mostrar: i32) -> isize;
    fn SetCurrentProcessExplicitAppUserModelID(id: *const u16) -> i32;
}
#[link(name = "advapi32")]
extern "system" {
    fn RegGetValueW(chave: isize, sub: *const u16, valor: *const u16, flags: u32, tipo: *mut u32, dados: *mut u16,
        tam: *mut u32) -> i32;
}

pub fn largo(t: &str) -> Vec<u16> { t.encode_utf16().chain([0]).collect() }

/// Mesmo AppUserModelID dos atalhos do instalador: fixado na barra de tarefas, fica o Bancada Livre com o ícone dele.
/// Vale só para este processo; nenhuma janela de outro programa é tocada.
pub const APP_ID: &str = "BancadaLivre";

pub fn marcar_programa() {
    let id = largo(APP_ID);
    unsafe { SetCurrentProcessExplicitAppUserModelID(id.as_ptr()); }
}

/// Única página que o programa abre: a da versão mais recente, no navegador padrão. O programa não consulta a internet.
pub const PAGINA_VERSOES: &str = "https://github.com/HeraldoAntunes/bancada-livre/releases/latest";

pub fn abrir_pagina_versoes() {
    let url = largo(PAGINA_VERSOES);
    unsafe { ShellExecuteW(0, largo("open").as_ptr(), url.as_ptr(), std::ptr::null(), std::ptr::null(), 1) };
}

pub fn avisar_erro(msg: &str) {
    unsafe { MessageBoxW(0, largo(msg).as_ptr(), largo("Bancada Livre").as_ptr(), 0x10) };
}

// O Bancada Livre desenha com o WebView2 (motor do Edge, separado do navegador). Ele vem no Windows 11 e nos Windows
// 10 atualizados. A conferência é a que a Microsoft recomenda (versão "pv" na chave do EdgeUpdate), a mesma do instalador.
pub fn tem_webview2() -> bool {
    const CHAVE: &str = r"Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";
    const HKLM: isize = 0x80000002u32 as i32 as isize;
    const HKCU: isize = 0x80000001u32 as i32 as isize;
    const SO_TEXTO: u32 = 0x2;              // RRF_RT_REG_SZ
    const VISTA_32: u32 = 0x20000;          // RRF_SUBKEY_WOW6432KEY
    let ler = |raiz: isize, sub: String, flags: u32| -> bool {
        let (sub, valor) = (largo(&sub), largo("pv"));
        let mut buf = [0u16; 64];
        let mut tam = (buf.len() * 2) as u32;
        let r = unsafe { RegGetValueW(raiz, sub.as_ptr(), valor.as_ptr(), flags, std::ptr::null_mut(), buf.as_mut_ptr(), &mut tam) };
        if r != 0 { return false; }
        let v = String::from_utf16_lossy(&buf[..(tam as usize / 2).min(buf.len()).saturating_sub(1)]);
        !v.is_empty() && v != "0.0.0.0"
    };
    ler(HKLM, format!(r"SOFTWARE\{CHAVE}"), SO_TEXTO | VISTA_32) || ler(HKLM, format!(r"SOFTWARE\{CHAVE}"), SO_TEXTO)
        || ler(HKCU, format!(r"Software\{CHAVE}"), SO_TEXTO)
}

// ---- WebView2 para escola sem internet ----
// O pacote "para escola sem internet" traz, ao lado do BancadaLivre.exe, o instalador completo do WebView2, que a
// Microsoft distribui assinado. Só é executado se a assinatura for válida e for da Microsoft.
pub const WEBVIEW2_COMPLETO: &str = "MicrosoftEdgeWebView2RuntimeInstallerX64.exe";

#[link(name = "wintrust")]
extern "system" {
    fn WinVerifyTrust(hwnd: isize, acao: *const Guid, dados: *mut DadosDeConfianca) -> i32;
    fn WTHelperProvDataFromStateData(estado: isize) -> *mut std::ffi::c_void;
    fn WTHelperGetProvSignerFromChain(prov: *mut std::ffi::c_void, signatario: u32, contra: i32, idx: u32) -> *const Signatario;
}
#[link(name = "crypt32")]
extern "system" {
    fn CertGetNameStringW(cert: *const std::ffi::c_void, tipo: u32, flags: u32, para: *const std::ffi::c_void,
        nome: *mut u16, tam: u32) -> u32;
}
#[repr(C)]
struct Guid(u32, u16, u16, [u8; 8]);
#[repr(C)]
struct InfoDoArquivo { tam: u32, caminho: *const u16, arquivo: isize, sujeito: *const Guid }
#[repr(C)]
struct DadosDeConfianca {
    tam: u32, politica: *const u8, sip: *const u8, interface: u32, revogacao: u32, escolha: u32,
    arquivo: *const InfoDoArquivo, acao: u32, estado: isize, url: *const u16, flags: u32, contexto: u32, assinatura: *const u8,
}
#[repr(C)]
struct Signatario { tam: u32, quando: [u32; 2], qtd_certificados: u32, certificados: *const CertificadoDoProvedor }
#[repr(C)]
struct CertificadoDoProvedor { tam: u32, cert: *const std::ffi::c_void }

/// Assinatura válida (conferida sem internet) e emitida para a Microsoft.
pub fn assinado_pela_microsoft(arquivo: &std::path::Path) -> bool {
    let acao = Guid(0x00AAC56B, 0xCD44, 0x11D0, [0x8C, 0xC2, 0x00, 0xC0, 0x4F, 0xC2, 0x95, 0xEE]);  // GENERIC_VERIFY_V2
    let caminho = largo(&arquivo.display().to_string());
    let info = InfoDoArquivo { tam: std::mem::size_of::<InfoDoArquivo>() as u32, caminho: caminho.as_ptr(), arquivo: 0,
        sujeito: std::ptr::null() };
    let mut dados = DadosDeConfianca {
        tam: std::mem::size_of::<DadosDeConfianca>() as u32, politica: std::ptr::null(), sip: std::ptr::null(),
        interface: 2, revogacao: 0, escolha: 1, arquivo: &info, acao: 1, estado: 0, url: std::ptr::null(),
        flags: 0x1000, contexto: 0, assinatura: std::ptr::null(),   // sem tela, sem revogação, só o cache (sem rede)
    };
    let valida = unsafe { WinVerifyTrust(-1, &acao, &mut dados) } == 0;
    let mut da_microsoft = false;
    if valida {
        unsafe {
            let sig = WTHelperGetProvSignerFromChain(WTHelperProvDataFromStateData(dados.estado), 0, 0, 0);
            if !sig.is_null() && (*sig).qtd_certificados > 0 && !(*sig).certificados.is_null() {
                let mut nome = [0u16; 128];
                let n = CertGetNameStringW((*(*sig).certificados).cert, 4, 0, std::ptr::null(), nome.as_mut_ptr(), 128);
                da_microsoft = String::from_utf16_lossy(&nome[..(n as usize).saturating_sub(1)]) == "Microsoft Corporation";
            }
        }
    }
    dados.acao = 2;   // fecha
    unsafe { WinVerifyTrust(-1, &acao, &mut dados) };
    da_microsoft
}

/// Sem WebView2: se o instalador da Microsoft estiver ao lado do programa, oferece instalá-lo. `true`: agora tem.
pub fn instalar_webview2_ao_lado() -> bool {
    let Some(pasta) = std::env::current_exe().ok().and_then(|e| e.parent().map(|p| p.to_path_buf())) else { return false };
    let instalador = pasta.join(WEBVIEW2_COMPLETO);
    if !instalador.is_file() || !assinado_pela_microsoft(&instalador) { return false; }
    let texto = "O Bancada Livre precisa do WebView2 da Microsoft, que desenha a janela do simulador, e ele não está \
        neste computador.\n\nO instalador oficial da Microsoft veio junto com o Bancada Livre e não precisa de internet. \
        Instalar o WebView2 agora? Leva um ou dois minutos.";
    if unsafe { MessageBoxW(0, largo(texto).as_ptr(), largo("Bancada Livre").as_ptr(), 0x4 | 0x20) } != 6 { return false; }
    let _ = std::process::Command::new(&instalador).args(["/silent", "/install"]).status();
    tem_webview2()
}

// sem WebView2 nenhuma janela abre: explica o que fazer e oferece a página oficial de download
pub fn avisar_sem_webview2() {
    let texto = "O Bancada Livre precisa do WebView2 da Microsoft, que desenha a janela do simulador. Ele vem no \
        Windows 11 e nos Windows 10 atualizados, mas não foi encontrado neste computador.\n\nPara resolver: baixe o \
        \"WebView2 Runtime\" no site da Microsoft; sem internet, use o pacote \"para escola sem internet\" do Bancada \
        Livre, que já traz o instalador dele. Enquanto isso, o simulador abre no navegador pelo arquivo \
        bancada-livre.html.\n\nAbrir a página de download agora?";
    let r = unsafe { MessageBoxW(0, largo(texto).as_ptr(), largo("Bancada Livre").as_ptr(), 0x4 | 0x30) };  // Sim/Não, alerta
    if r == 6 {
        let url = largo("https://developer.microsoft.com/microsoft-edge/webview2/");
        unsafe { ShellExecuteW(0, largo("open").as_ptr(), url.as_ptr(), std::ptr::null(), std::ptr::null(), 1) };
    }
}

#[cfg(test)]
mod testes {
    use super::*;

    // o Edge vem no Windows assinado pela Microsoft; este próprio teste não é assinado
    #[test]
    fn so_aceita_assinatura_da_microsoft() {
        let edge = std::path::Path::new(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe");
        if edge.exists() { assert!(assinado_pela_microsoft(edge)); }
        // o instalador do WebView2 baixado pelo build.ps1, se já houver um
        let wv2 = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(r"..\pacote\work").join(WEBVIEW2_COMPLETO);
        if wv2.exists() { assert!(assinado_pela_microsoft(&wv2)); }
        assert!(!assinado_pela_microsoft(&std::env::current_exe().unwrap()));
        assert!(!assinado_pela_microsoft(std::path::Path::new(r"C:\nao-existe\nada.exe")));
    }
}
