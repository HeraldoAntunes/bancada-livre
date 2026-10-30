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

/// Caixa de pergunta do Windows; devolve o botão escolhido (6 = Sim).
pub fn perguntar(texto: &str, tipo: u32) -> i32 {
    unsafe { MessageBoxW(0, largo(texto).as_ptr(), largo("Bancada Livre").as_ptr(), tipo) }
}

/// Aviso de erro. Com a variável BANCADA_SEM_CAIXAS (um caminho de arquivo), vai para esse arquivo em vez de virar
/// caixa na tela: os testes automáticos não podem deixar caixas para o professor responder.
pub fn avisar_erro(msg: &str) {
    if let Some(arquivo) = std::env::var_os("BANCADA_SEM_CAIXAS") {
        use std::io::Write;
        if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(arquivo) {
            let _ = writeln!(f, "{}", msg.replace('\n', " "));
        }
        return;
    }
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

// ---- uma janela só por perfil ----
// Duas janelas gravando o mesmo circuito.json: a última a gravar apagaria em silêncio o trabalho da outra (reproduzido
// na auditoria de 29/10/2026). Como no Giz na Tela, uma trava com nome por pasta de dados: a segunda abertura traz para a
// frente a janela que já está aberta e sai.
#[link(name = "kernel32")]
extern "system" {
    fn CreateMutexW(atributos: *const u8, dono: i32, nome: *const u16) -> isize;
    fn GetLastError() -> u32;
    fn CloseHandle(h: isize) -> i32;
}
#[link(name = "user32")]
extern "system" {
    fn FindWindowW(classe: *const u16, titulo: *const u16) -> isize;
    fn ShowWindow(hwnd: isize, modo: i32) -> i32;
    fn SetForegroundWindow(hwnd: isize) -> i32;
    fn IsIconic(hwnd: isize) -> i32;
}

/// `true`: esta é a única janela desta pasta de dados (a trava fica aberta até o programa sair). `false`: já havia uma;
/// ela foi trazida para a frente. `espera`: reaberto logo depois de fechar, o anterior pode estar terminando de gravar.
pub fn janela_unica(dados: &std::path::Path, espera: std::time::Duration) -> bool {
    let chave = dados.to_string_lossy().to_lowercase();
    let h = chave.bytes().fold(0xcbf29ce484222325u64, |h, b| (h ^ b as u64).wrapping_mul(0x100000001b3));
    let nome = largo(&format!(r"Local\BancadaLivre-{h:016x}"));
    let limite = std::time::Instant::now() + espera;
    loop {
        unsafe {
            let m = CreateMutexW(std::ptr::null(), 0, nome.as_ptr());
            if m == 0 || GetLastError() != 183 { return true; }
            CloseHandle(m);   // ERROR_ALREADY_EXISTS: solta a nossa cópia, senão a trava nunca some
        }
        // a outra janela está aberta: vem para a frente na hora. Mas ela pode estar fechando (a pessoa fechou e abriu
        // de novo logo em seguida; achado na bateria da 2.1.1): se a trava se soltar em alguns segundos, esta abre.
        let janela = unsafe { FindWindowW(largo("Tauri Window").as_ptr(), largo("Bancada Livre").as_ptr()) };
        if janela != 0 {
            unsafe {
                if IsIconic(janela) != 0 { ShowWindow(janela, 9); }   // SW_RESTORE
                SetForegroundWindow(janela);
            }
            let ate = std::time::Instant::now() + std::time::Duration::from_secs(5);
            while std::time::Instant::now() < ate {
                std::thread::sleep(std::time::Duration::from_millis(200));
                unsafe {
                    let m = CreateMutexW(std::ptr::null(), 0, nome.as_ptr());
                    if m != 0 && GetLastError() != 183 { return true; }   // a anterior fechou: a trava agora é desta
                    if m != 0 { CloseHandle(m); }
                }
            }
            return false;
        }
        if std::time::Instant::now() >= limite { break; }
        std::thread::sleep(std::time::Duration::from_millis(250));
    }
    avisar_erro("O Bancada Livre já está aberto nesta conta. Use a janela que já está aberta.");
    false
}

// ---- WebView2 órfão ----
// Depois de uma queda do Bancada Livre (fechado à força, energia, travamento), o processo principal do WebView2 que ele
// abriu pode ficar vivo, órfão, segurando o perfil; a próxima abertura não consegue criar a janela (visto em 29/10/2026,
// com o processo órfão vivo por mais de uma hora). Ao abrir, já sozinho na pasta de dados (`janela_unica`), o programa
// encerra só esses processos: msedgewebview2.exe, processo principal (sem --type), com o perfil exato deste programa na
// linha de comando e com o pai já morto. Nada de outro programa é tocado.
#[link(name = "kernel32")]
extern "system" {
    fn CreateToolhelp32Snapshot(flags: u32, pid: u32) -> isize;
    fn Process32FirstW(h: isize, e: *mut EntradaDeProcesso) -> i32;
    fn Process32NextW(h: isize, e: *mut EntradaDeProcesso) -> i32;
    fn OpenProcess(acesso: u32, herdar: i32, pid: u32) -> isize;
    fn TerminateProcess(h: isize, codigo: u32) -> i32;
    fn WaitForSingleObject(h: isize, ms: u32) -> u32;
}
#[link(name = "ntdll")]
extern "system" {
    fn NtQueryInformationProcess(h: isize, classe: u32, dados: *mut u8, tam: u32, devolvido: *mut u32) -> i32;
}
#[repr(C)]
struct EntradaDeProcesso {
    tam: u32, uso: u32, pid: u32, heap: usize, modulo: u32, threads: u32, pai: u32, prioridade: i32, flags: u32,
    nome: [u16; 260],
}

/// Só conta como morto o pai que o Windows diz não existir: sem permissão para consultar, conta como vivo, e o WebView2
/// dele não é encerrado (auditoria do modelo nativo, 29/10/2026).
fn processo_vivo(pid: u32) -> bool {
    unsafe {
        let h = OpenProcess(0x0010_0000, 0, pid);      // SYNCHRONIZE
        if h == 0 { return GetLastError() != 87; }      // ERROR_INVALID_PARAMETER: não há processo com esse número
        let vivo = WaitForSingleObject(h, 0) == 258;    // WAIT_TIMEOUT: ainda rodando
        CloseHandle(h);
        vivo
    }
}

fn linha_de_comando(h: isize) -> Option<String> {
    let mut buf = vec![0u8; 65536];
    let mut devolvido = 0u32;
    // ProcessCommandLineInformation (60): um UNICODE_STRING seguido do texto, no próprio buffer
    if unsafe { NtQueryInformationProcess(h, 60, buf.as_mut_ptr(), buf.len() as u32, &mut devolvido) } < 0 { return None; }
    let tam = u16::from_le_bytes([buf[0], buf[1]]) as usize / 2;
    let ptr = usize::from_le_bytes(buf[8..16].try_into().ok()?) as *const u16;
    if ptr.is_null() { return None; }
    Some(String::from_utf16_lossy(unsafe { std::slice::from_raw_parts(ptr, tam) }))
}

/// Encerra os processos principais do WebView2 órfãos deste perfil. Devolve quantos foram encerrados.
pub fn encerrar_webview2_orfao(perfil: &std::path::Path) -> usize {
    encerrar_webview2(perfil, |pai| !processo_vivo(pai))
}

/// Encerra o processo principal do WebView2 que este programa abriu para o perfil. Usado entre as tentativas de criar a
/// janela: se a primeira falha, o WebView2 dela pode ficar preso e as seguintes o reaproveitariam (bateria da
/// 2.1.1-rc.2, 29/10/2026). Os processos filhos dele acabam junto.
pub fn encerrar_webview2_deste_programa(perfil: &std::path::Path) -> usize {
    let eu = std::process::id();
    encerrar_webview2(perfil, |pai| pai == eu)
}

fn encerrar_webview2(perfil: &std::path::Path, escolher_pelo_pai: impl Fn(u32) -> bool) -> usize {
    let marca = format!("--user-data-dir=\"{}\"", perfil.display()).to_lowercase();
    let mut encerrados = 0;
    unsafe {
        let foto = CreateToolhelp32Snapshot(0x2, 0);    // TH32CS_SNAPPROCESS
        if foto == -1 { return 0; }
        let mut e: EntradaDeProcesso = std::mem::zeroed();
        e.tam = std::mem::size_of::<EntradaDeProcesso>() as u32;
        let mut tem = Process32FirstW(foto, &mut e) != 0;
        while tem {
            let fim = e.nome.iter().position(|&c| c == 0).unwrap_or(e.nome.len());
            let nome = String::from_utf16_lossy(&e.nome[..fim]).to_lowercase();
            if nome == "msedgewebview2.exe" && escolher_pelo_pai(e.pai) {
                let h = OpenProcess(0x1000 | 0x0001 | 0x0010_0000, 0, e.pid);   // consulta, encerrar, esperar
                if h != 0 {
                    let cmd = linha_de_comando(h).unwrap_or_default().to_lowercase();
                    // só conta o que de fato acabou (WAIT_OBJECT_0 = 0)
                    if cmd.contains(&marca) && !cmd.contains("--type=")
                        && TerminateProcess(h, 1) != 0 && WaitForSingleObject(h, 3000) == 0 {
                        encerrados += 1;
                    }
                    CloseHandle(h);
                }
            }
            tem = Process32NextW(foto, &mut e) != 0;
        }
        CloseHandle(foto);
    }
    encerrados
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

    // um pai que não dá para consultar (o System, pid 4, nega acesso a uma conta comum) não é um pai morto
    #[test]
    fn pai_sem_permissao_de_consulta_conta_como_vivo() {
        assert!(processo_vivo(std::process::id()));
        assert!(processo_vivo(4));
        assert!(!processo_vivo(0xFFFF_FFF0));
    }
}
