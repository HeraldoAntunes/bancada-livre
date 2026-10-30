// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Instalação sem instalador: o próprio BancadaLivre.exe se copia para a pasta de programas da conta, cria os atalhos
// (com o mesmo AppUserModelID da janela) e se registra em Aplicativos instalados, na mesma chave que o Inno Setup usava
// até a 2.1.0, para tomar o lugar daquela instalação. Não pede administrador e não toca fora da conta do usuário.
// Uso: aberto de fora da pasta de instalação, pergunta se instala; `--instalar` instala em silêncio (testes e CI);
// `--desinstalar` (chamado por Aplicativos instalados) remove o programa e deixa os circuitos salvos.
use crate::sistema::{avisar_erro, largo};
use std::ffi::c_void;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

pub const VERSAO: &str = env!("CARGO_PKG_VERSION");
/// Chave de desinstalação do Inno Setup (AppId do bancada-livre.iss até a 2.1.0), dentro de HKCU.
pub const CHAVE: &str = r"Software\Microsoft\Windows\CurrentVersion\Uninstall\{B3D1A6E0-5C2F-4A87-9E14-7F0C2B8D4E61}_is1";
const ATALHO: &str = "Bancada Livre.lnk";
const ATALHO_DESINSTALAR: &str = "Desinstalar o Bancada Livre.lnk";   // criado pelo Inno Setup até a 2.1.0
const EXE: &str = "BancadaLivre.exe";

// arquivos que vão junto: a página (para abrir no navegador, se faltar o WebView2) e as licenças, com os textos das
// licenças das bibliotecas Rust do programa
const ARQUIVOS: [(&str, &[u8]); 5] = [
    ("bancada-livre.html", include_bytes!("../../dist/index.html")),
    ("LICENSE", include_bytes!("../../LICENSE")),
    ("THIRD-PARTY-NOTICES.md", include_bytes!("../../THIRD-PARTY-NOTICES.md")),
    ("THIRD-PARTY-RUST.md", include_bytes!("../../THIRD-PARTY-RUST.md")),
    ("README.md", include_bytes!("../../README.md")),
];
// restos das versões instaladas pelo Inno Setup (e do lançador em Python, até a 2.0.3); só estes nomes são apagados
const RESTOS: [&str; 5] = ["unins000.exe", "unins000.dat", "unins000.msg", "bancada-livre.ico", "_internal"];
const RESTOS_LICENCAS: [&str; 3] = ["innosetup-license.txt", "python-LICENSE.txt", "pyinstaller-COPYING.txt"];

/// Onde a instalação fica. Os testes usam pastas e chave próprias.
pub struct Destino {
    pub programa: PathBuf,
    pub menu: PathBuf,
    pub area: PathBuf,
    pub chave: String,
    /// Onde vai o programa em uso que não pode ser apagado: no mesmo disco do programa (mover entre discos não dá).
    pub sobras: PathBuf,
}

impl Destino {
    pub fn da_conta() -> Option<Destino> {
        let local = std::env::var_os("LOCALAPPDATA").map(PathBuf::from)?;
        Some(Destino {
            programa: local.join("Programs").join("Bancada Livre"),
            menu: pasta_conhecida(&FOLDERID_PROGRAMS)?,
            area: pasta_conhecida(&FOLDERID_DESKTOP)?,
            chave: CHAVE.to_string(),
            sobras: local.join("Bancada Livre").join("sobras"),
        })
    }
    fn exe(&self) -> PathBuf { self.programa.join(EXE) }
}

pub enum Seguir { Abrir, Sair }

/// `--instalar` e `--desinstalar`: fazem o trabalho em silêncio (ou com as perguntas da desinstalação) e encerram.
pub fn comandos() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let tem = |a: &str| args.iter().any(|x| x == a);
    if !tem("--instalar") && !tem("--desinstalar") { return; }
    let (Ok(atual), Some(destino)) = (std::env::current_exe(), Destino::da_conta()) else { std::process::exit(1) };
    if tem("--instalar") {
        let r = instalar(&destino, &atual);
        std::process::exit(if r.is_ok() { 0 } else { 1 });
    }
    if tem("--desinstalar") {
        let r = desinstalar(&destino, &atual, tem("--silencioso"));
        std::process::exit(if r.is_ok() { 0 } else { 1 });
    }
}

/// Aberto de fora da pasta de instalação, pergunta se instala (ou atualiza). `Sair`: o trabalho já foi feito (a cópia
/// instalada foi aberta) ou o usuário cancelou.
pub fn ao_abrir() -> Seguir {
    // --sem-instalar: só usar, sem a pergunta (para os testes não deixarem caixa na tela; uso portátil por atalho)
    if std::env::args().any(|a| a == "--sem-instalar") { return Seguir::Abrir; }
    let Ok(atual) = std::env::current_exe() else { return Seguir::Abrir };
    let Some(destino) = Destino::da_conta() else { return Seguir::Abrir };
    limpar_sobras(&destino);
    if mesmo_arquivo(&atual, &destino.exe()) { return Seguir::Abrir; }
    let instalada = ler_texto(HKCU, &destino.chave, "DisplayVersion");
    let pergunta = match instalada.as_deref() {
        None => format!("Instalar o Bancada Livre {VERSAO} neste computador?\n\nSim: instala só para a sua conta (não \
            pede administrador), cria os atalhos no menu Iniciar e na Área de Trabalho e abre o simulador.\nNão: só usa \
            agora, sem instalar.\nCancelar: fecha."),
        Some(v) if mais_nova(VERSAO, v) => format!("Atualizar o Bancada Livre da versão {v} para a {VERSAO}?\n\nOs \
            circuitos salvos continuam guardados.\n\nSim: atualiza e abre o simulador.\nNão: só usa esta versão agora, \
            sem instalar.\nCancelar: fecha."),
        // a mesma versão ou uma mais nova já instalada: só abre esta cópia
        Some(_) => return Seguir::Abrir,
    };
    match perguntar(&pergunta, 0x3 | 0x20) {       // Sim/Não/Cancelar, pergunta
        6 => match instalar(&destino, &atual) {
            Ok(()) => {
                if std::process::Command::new(destino.exe()).current_dir(&destino.programa).spawn().is_ok() {
                    return Seguir::Sair;
                }
                Seguir::Abrir
            }
            Err(e) => {
                avisar_erro(&format!("Não foi possível instalar o Bancada Livre.\n\n{e}\n\nO simulador vai abrir assim \
                    mesmo, sem instalar."));
                Seguir::Abrir
            }
        },
        7 => Seguir::Abrir,
        _ => Seguir::Sair,
    }
}

/// "2.1.1" é mais nova que "2.1.0". Versão que não se entende conta como antiga (vale atualizar por cima).
pub fn mais_nova(esta: &str, outra: &str) -> bool {
    let partes = |v: &str| -> Option<Vec<u32>> { v.trim().split('.').map(|p| p.parse().ok()).collect() };
    match (partes(esta), partes(outra)) {
        (Some(a), Some(b)) => a > b,
        (Some(_), None) => true,
        _ => false,
    }
}

fn mesmo_arquivo(a: &Path, b: &Path) -> bool {
    match (fs::canonicalize(a), fs::canonicalize(b)) {
        (Ok(x), Ok(y)) => x.to_string_lossy().eq_ignore_ascii_case(&y.to_string_lossy()),
        _ => false,
    }
}

pub fn instalar(destino: &Destino, origem: &Path) -> io::Result<()> {
    let atualizacao = ler_texto(HKCU, &destino.chave, "DisplayVersion").is_some();
    fs::create_dir_all(&destino.programa)?;
    // o programa: copia para um nome provisório e só então troca. Se a versão antiga estiver aberta, o Windows não
    // deixa apagá-la, mas deixa movê-la: ela vai para a pasta temporária e segue aberta até ser fechada. Cada passo
    // insiste por um tempo (antivírus segurando o arquivo); se a troca não der certo, nada mais é tocado.
    let exe = destino.exe();
    if !mesmo_arquivo(origem, &exe) {
        let novo = destino.programa.join(format!("{EXE}.novo"));
        let antigo = destino.programa.join(format!("{EXE}.antigo"));
        let copiar = com_tentativas(PRAZO_ARQUIVO_EM_USO, || fs::copy(origem, &novo).map(|_| ()));
        if let Err(e) = copiar.and_then(|()| trocar_exe(&novo, &exe, &antigo, PRAZO_ARQUIVO_EM_USO, |a, b| fs::rename(a, b))) {
            let _ = fs::remove_file(&novo);
            return Err(e);
        }
        // a versão antiga, já fora do lugar: aberta, não pode ser apagada e vai para as sobras
        if antigo.exists() && fs::remove_file(&antigo).is_err() { let _ = mover_para_sobras(destino, &antigo); }
    }
    for (nome, dados) in ARQUIVOS {
        fs::write(destino.programa.join(nome), dados)?;
    }
    for nome in RESTOS {
        let p = destino.programa.join(nome);
        let _ = if p.is_dir() { fs::remove_dir_all(&p) } else { fs::remove_file(&p) };
    }
    let licencas = destino.programa.join("licencas");
    for nome in RESTOS_LICENCAS { let _ = fs::remove_file(licencas.join(nome)); }
    let _ = fs::remove_dir(&licencas);      // só se ficou vazia

    // atalhos: o do menu Iniciar sempre; o da Área de Trabalho na instalação nova, ou na atualização se já existia
    let _ = fs::remove_file(destino.menu.join(ATALHO_DESINSTALAR));
    let area = destino.area.join(ATALHO);
    let com_area = !atualizacao || area.exists();
    {
        let _com = Com::iniciar();
        criar_atalho(&destino.menu.join(ATALHO), &exe, &destino.programa)?;
        if com_area { criar_atalho(&area, &exe, &destino.programa)?; }
    }
    registrar(destino, &exe)?;
    unsafe { SHChangeNotify(0x0800_0000, 0, std::ptr::null(), std::ptr::null()) };   // SHCNE_ASSOCCHANGED: refaz ícones
    Ok(())
}

/// Põe o exe novo no lugar do instalado. O antigo sai primeiro para `antigo` (o Windows deixa renomear um exe aberto);
/// se o novo não entrar, o antigo volta, e a conta não fica sem programa (auditoria do modelo nativo, N-C2, 29/10/2026).
fn trocar_exe(novo: &Path, exe: &Path, antigo: &Path, prazo: Duration,
    por_no_lugar: impl Fn(&Path, &Path) -> io::Result<()>) -> io::Result<()> {
    // troca anterior interrompida (sem o exe, só a reserva): a reserva volta ao lugar antes de tudo, e só sai quando
    // houver outro exe no lugar (auditoria do modelo nativo, N-R1)
    if !exe.exists() && antigo.exists() { com_tentativas(prazo, || fs::rename(antigo, exe))?; }
    let _ = fs::remove_file(antigo);
    let tinha = exe.exists();
    if tinha { com_tentativas(prazo, || fs::rename(exe, antigo))?; }
    if let Err(e) = com_tentativas(prazo, || por_no_lugar(novo, exe)) {
        if tinha { let _ = com_tentativas(prazo, || fs::rename(antigo, exe)); }
        return Err(e);
    }
    Ok(())
}

/// Quanto tempo insistir num arquivo em uso. Logo depois de aberto ou gravado, o antivírus costuma segurar o exe por um
/// instante (erro 32); visto ao desinstalar pelo winget no Tarja Livre, que usa este mesmo modelo (29/10/2026).
pub const PRAZO_ARQUIVO_EM_USO: Duration = Duration::from_secs(10);

/// Repete `passo` até dar certo ou acabar o prazo, e devolve o último erro.
fn com_tentativas(prazo: Duration, mut passo: impl FnMut() -> io::Result<()>) -> io::Result<()> {
    let inicio = Instant::now();
    loop {
        match passo() {
            Ok(()) => return Ok(()),
            Err(e) if inicio.elapsed() >= prazo => return Err(e),
            Err(_) => std::thread::sleep(Duration::from_millis(250)),
        }
    }
}

pub fn desinstalar(destino: &Destino, atual: &Path, silencioso: bool) -> io::Result<()> {
    desinstalar_com_prazo(destino, atual, silencioso, PRAZO_ARQUIVO_EM_USO)
}

fn desinstalar_com_prazo(destino: &Destino, atual: &Path, silencioso: bool, prazo: Duration) -> io::Result<()> {
    if !silencioso && perguntar("Remover o Bancada Livre deste computador?\n\nOs circuitos salvos ficam guardados.",
        0x4 | 0x20) != 6 {
        return Ok(());
    }
    // o programa sai primeiro. Em uso, não pode ser apagado, mas pode ser movido para a pasta temporária. Se nem isso
    // der certo dentro do prazo, nada mais é tocado: atalhos e Aplicativos instalados continuam valendo.
    let exe = destino.exe();
    if exe.exists() {
        let tirar = || {
            if mesmo_arquivo(atual, &exe) {
                mover_para_sobras(destino, &exe)
            } else {
                fs::remove_file(&exe).or_else(|_| mover_para_sobras(destino, &exe))
            }
        };
        if let Err(e) = com_tentativas(prazo, tirar) {
            if !silencioso {
                avisar_erro(&format!("Não foi possível remover o Bancada Livre agora (o programa está em uso).\n\n{e}\n\n\
                    Feche o Bancada Livre e tente de novo. Nada foi removido."));
            }
            return Err(e);
        }
    }
    for p in [destino.menu.join(ATALHO), destino.menu.join(ATALHO_DESINSTALAR), destino.area.join(ATALHO)] {
        let _ = fs::remove_file(p);
    }
    apagar_chave(HKCU, &destino.chave);
    for (nome, _) in ARQUIVOS { let _ = fs::remove_file(destino.programa.join(nome)); }
    for nome in RESTOS {
        let p = destino.programa.join(nome);
        let _ = if p.is_dir() { fs::remove_dir_all(&p) } else { fs::remove_file(&p) };
    }
    let licencas = destino.programa.join("licencas");
    for nome in RESTOS_LICENCAS { let _ = fs::remove_file(licencas.join(nome)); }
    let _ = fs::remove_dir(&licencas);
    let _ = fs::remove_file(destino.programa.join(format!("{EXE}.novo")));
    let _ = fs::remove_file(destino.programa.join(format!("{EXE}.antigo")));
    // só some se ficou vazia: nada que o usuário tenha posto lá é apagado
    let _ = fs::remove_dir(&destino.programa);
    unsafe { SHChangeNotify(0x0800_0000, 0, std::ptr::null(), std::ptr::null()) };
    if !silencioso {
        perguntar("O Bancada Livre foi removido. Os circuitos salvos continuam guardados.", 0x40);
    }
    Ok(())
}

// cópias antigas do programa, movidas por uma atualização ou desinstalação com ele em uso. Vão para a pasta `sobras`, no
// mesmo disco do programa: o Windows só move um arquivo em uso dentro do mesmo disco, e a pasta temporária pode estar em
// outro (auditoria de 29/10/2026). A pasta temporária fica como segunda tentativa (versões até a 2.1.0 usavam só ela).
const PREFIXO_SOBRA: &str = "BancadaLivre-antigo-";

fn nome_de_sobra(pasta: &Path) -> PathBuf {
    let n = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    pasta.join(format!("{PREFIXO_SOBRA}{}-{n}.exe", std::process::id()))
}

fn mover_para_sobras(destino: &Destino, exe: &Path) -> io::Result<()> {
    let _ = fs::create_dir_all(&destino.sobras);
    fs::rename(exe, nome_de_sobra(&destino.sobras)).or_else(|_| fs::rename(exe, nome_de_sobra(&std::env::temp_dir())))
}

fn limpar_sobras(destino: &Destino) {
    for pasta in [destino.sobras.clone(), std::env::temp_dir()] {
        let Ok(lista) = fs::read_dir(&pasta) else { continue };
        for item in lista.flatten() {
            let nome = item.file_name().to_string_lossy().to_string();
            if nome.starts_with(PREFIXO_SOBRA) && nome.ends_with(".exe") {
                let _ = fs::remove_file(item.path());      // a que ainda estiver aberta fica para a próxima
            }
        }
    }
    let _ = fs::remove_dir(&destino.sobras);       // só se ficou vazia
}

fn registrar(destino: &Destino, exe: &Path) -> io::Result<()> {
    apagar_chave(HKCU, &destino.chave);     // tira os valores do Inno Setup
    let exe_txt = exe.display().to_string();
    let tamanho = (fs::metadata(exe).map(|m| m.len()).unwrap_or(0)
        + ARQUIVOS.iter().map(|(_, d)| d.len() as u64).sum::<u64>()) / 1024;
    let textos = [
        ("DisplayName", "Bancada Livre".to_string()),
        ("DisplayVersion", VERSAO.to_string()),
        ("Publisher", "Heraldo Antunes (projeto livre)".to_string()),
        ("DisplayIcon", format!("{exe_txt},0")),
        ("InstallLocation", format!("{}\\", destino.programa.display())),
        ("UninstallString", format!("\"{exe_txt}\" --desinstalar")),
        ("QuietUninstallString", format!("\"{exe_txt}\" --desinstalar --silencioso")),
        ("URLInfoAbout", "https://github.com/HeraldoAntunes/bancada-livre".to_string()),
    ];
    let numeros = [("NoModify", 1u32), ("NoRepair", 1), ("EstimatedSize", tamanho as u32)];
    let mut chave: isize = 0;
    let r = unsafe { RegCreateKeyExW(HKCU, largo(&destino.chave).as_ptr(), 0, std::ptr::null(), 0, 0x20006,
        std::ptr::null(), &mut chave, std::ptr::null_mut()) };
    if r != 0 { return Err(io::Error::from_raw_os_error(r)); }
    let mut erro = 0;
    for (nome, valor) in textos {
        let v = largo(&valor);
        erro |= unsafe { RegSetValueExW(chave, largo(nome).as_ptr(), 0, 1, v.as_ptr() as *const u8, (v.len() * 2) as u32) };
    }
    for (nome, valor) in numeros {
        erro |= unsafe { RegSetValueExW(chave, largo(nome).as_ptr(), 0, 4, &valor as *const u32 as *const u8, 4) };
    }
    unsafe { RegCloseKey(chave) };
    if erro != 0 { return Err(io::Error::other("não foi possível registrar em Aplicativos instalados")); }
    Ok(())
}

// ---- Windows ----
pub const HKCU: isize = 0x80000001u32 as i32 as isize;

#[link(name = "advapi32")]
extern "system" {
    fn RegCreateKeyExW(chave: isize, sub: *const u16, reservado: u32, classe: *const u16, opcoes: u32, acesso: u32,
        seguranca: *const u8, saida: *mut isize, disposicao: *mut u32) -> i32;
    fn RegSetValueExW(chave: isize, nome: *const u16, reservado: u32, tipo: u32, dados: *const u8, tam: u32) -> i32;
    fn RegDeleteTreeW(chave: isize, sub: *const u16) -> i32;
    fn RegCloseKey(chave: isize) -> i32;
    fn RegGetValueW(chave: isize, sub: *const u16, valor: *const u16, flags: u32, tipo: *mut u32, dados: *mut u16,
        tam: *mut u32) -> i32;
}
#[link(name = "shell32")]
extern "system" {
    fn SHGetKnownFolderPath(id: *const Guid, flags: u32, token: isize, saida: *mut *mut u16) -> i32;
    fn SHChangeNotify(evento: i32, flags: u32, a: *const c_void, b: *const c_void);
}
#[link(name = "ole32")]
extern "system" {
    fn CoInitializeEx(reservado: *const c_void, modo: u32) -> i32;
    fn CoUninitialize();
    fn CoCreateInstance(clsid: *const Guid, externo: *const c_void, contexto: u32, iid: *const Guid,
        saida: *mut *mut c_void) -> i32;
    fn CoTaskMemFree(p: *const c_void);
}
#[link(name = "user32")]
extern "system" {
    fn MessageBoxW(hwnd: isize, texto: *const u16, titulo: *const u16, tipo: u32) -> i32;
}

fn perguntar(texto: &str, tipo: u32) -> i32 {
    unsafe { MessageBoxW(0, largo(texto).as_ptr(), largo("Bancada Livre").as_ptr(), tipo) }
}

#[repr(C)]
struct Guid(u32, u16, u16, [u8; 8]);
#[repr(C)]
struct ChaveDePropriedade { fmtid: Guid, pid: u32 }
#[repr(C)]
struct Propvariant { vt: u16, r: [u16; 3], texto: *const u16, resto: usize }

const FOLDERID_PROGRAMS: Guid = Guid(0xA77F5D77, 0x2E2B, 0x44C3, [0xA6, 0xA2, 0xAB, 0xA6, 0x01, 0x05, 0x4A, 0x51]);
const FOLDERID_DESKTOP: Guid = Guid(0xB4BFCC3A, 0xDB2C, 0x424C, [0xB0, 0x29, 0x7F, 0xE9, 0x9A, 0x87, 0xC6, 0x41]);
const CLSID_SHELLLINK: Guid = Guid(0x00021401, 0, 0, [0xC0, 0, 0, 0, 0, 0, 0, 0x46]);
const IID_ISHELLLINKW: Guid = Guid(0x000214F9, 0, 0, [0xC0, 0, 0, 0, 0, 0, 0, 0x46]);
const IID_IPERSISTFILE: Guid = Guid(0x0000010B, 0, 0, [0xC0, 0, 0, 0, 0, 0, 0, 0x46]);
const IID_IPROPERTYSTORE: Guid = Guid(0x886D8EEB, 0x8CF2, 0x4446, [0x8D, 0x02, 0xCD, 0xBA, 0x1D, 0xBD, 0xCF, 0x99]);
const PKEY_APPUSERMODEL: Guid = Guid(0x9F4C2855, 0x9F79, 0x4B39, [0xA8, 0xD0, 0xE1, 0xD4, 0x2D, 0xE1, 0xD5, 0xF3]);

fn pasta_conhecida(id: &Guid) -> Option<PathBuf> {
    let mut p: *mut u16 = std::ptr::null_mut();
    if unsafe { SHGetKnownFolderPath(id, 0, 0, &mut p) } != 0 || p.is_null() { return None; }
    let texto = unsafe {
        let tam = (0..).take_while(|&i| *p.add(i) != 0).count();
        let t = String::from_utf16_lossy(std::slice::from_raw_parts(p, tam));
        CoTaskMemFree(p as *const c_void);
        t
    };
    Some(PathBuf::from(texto))
}

pub fn ler_texto(raiz: isize, sub: &str, valor: &str) -> Option<String> {
    let (sub, valor) = (largo(sub), largo(valor));
    let mut buf = [0u16; 260];
    let mut tam = (buf.len() * 2) as u32;
    let r = unsafe { RegGetValueW(raiz, sub.as_ptr(), valor.as_ptr(), 0x2, std::ptr::null_mut(), buf.as_mut_ptr(), &mut tam) };
    if r != 0 { return None; }
    Some(String::from_utf16_lossy(&buf[..(tam as usize / 2).min(buf.len()).saturating_sub(1)]))
}

fn apagar_chave(raiz: isize, sub: &str) {
    unsafe { RegDeleteTreeW(raiz, largo(sub).as_ptr()) };
}

/// COM aberto só enquanto os atalhos são criados.
struct Com(bool);
impl Com {
    fn iniciar() -> Com { Com(unsafe { CoInitializeEx(std::ptr::null(), 0x2) } >= 0) }   // apartamento único
}
impl Drop for Com {
    fn drop(&mut self) { if self.0 { unsafe { CoUninitialize() } } }
}

type Objeto = *mut *const usize;

/// Método `i` da tabela do objeto COM.
unsafe fn metodo<T: Copy>(obj: Objeto, i: usize) -> T { std::mem::transmute_copy(&*(*obj).add(i)) }

unsafe fn soltar(obj: Objeto) {
    let f: unsafe extern "system" fn(Objeto) -> u32 = metodo(obj, 2);
    f(obj);
}

/// Atalho para o programa com o AppUserModelID dele: fixado na barra de tarefas, fica o Bancada Livre com o ícone dele.
fn criar_atalho(lnk: &Path, exe: &Path, pasta: &Path) -> io::Result<()> {
    let falha = |o: &str| io::Error::other(format!("não foi possível criar o atalho {} ({o})", lnk.display()));
    if let Some(p) = lnk.parent() { fs::create_dir_all(p)?; }
    unsafe {
        let mut link: *mut c_void = std::ptr::null_mut();
        if CoCreateInstance(&CLSID_SHELLLINK, std::ptr::null(), 1, &IID_ISHELLLINKW, &mut link) < 0 || link.is_null() {
            return Err(falha("ShellLink"));
        }
        let link = link as Objeto;
        type Texto = unsafe extern "system" fn(Objeto, *const u16) -> i32;
        type Icone = unsafe extern "system" fn(Objeto, *const u16, i32) -> i32;
        type Pedir = unsafe extern "system" fn(Objeto, *const Guid, *mut *mut c_void) -> i32;
        let (exe_t, pasta_t) = (largo(&exe.display().to_string()), largo(&pasta.display().to_string()));
        let desc = largo("Simulador didático de lógica digital");
        let mut ok = metodo::<Texto>(link, 20)(link, exe_t.as_ptr()) >= 0               // SetPath
            && metodo::<Texto>(link, 9)(link, pasta_t.as_ptr()) >= 0                     // SetWorkingDirectory
            && metodo::<Texto>(link, 7)(link, desc.as_ptr()) >= 0                        // SetDescription
            && metodo::<Icone>(link, 17)(link, exe_t.as_ptr(), 0) >= 0;                  // SetIconLocation
        let pedir: Pedir = metodo(link, 0);                                              // QueryInterface
        let mut loja: *mut c_void = std::ptr::null_mut();
        if ok && pedir(link, &IID_IPROPERTYSTORE, &mut loja) >= 0 && !loja.is_null() {
            let loja = loja as Objeto;
            let id = largo(crate::sistema::APP_ID);
            let chave = ChaveDePropriedade { fmtid: PKEY_APPUSERMODEL, pid: 5 };          // PKEY_AppUserModel_ID
            let v = Propvariant { vt: 31, r: [0; 3], texto: id.as_ptr(), resto: 0 };     // VT_LPWSTR
            let definir: unsafe extern "system" fn(Objeto, *const ChaveDePropriedade, *const Propvariant) -> i32 =
                metodo(loja, 6);
            let gravar: unsafe extern "system" fn(Objeto) -> i32 = metodo(loja, 7);
            ok = definir(loja, &chave, &v) >= 0 && gravar(loja) >= 0;
            soltar(loja);
        } else {
            ok = false;
        }
        let mut arquivo: *mut c_void = std::ptr::null_mut();
        if ok && pedir(link, &IID_IPERSISTFILE, &mut arquivo) >= 0 && !arquivo.is_null() {
            let arquivo = arquivo as Objeto;
            let salvar: unsafe extern "system" fn(Objeto, *const u16, i32) -> i32 = metodo(arquivo, 6);
            ok = salvar(arquivo, largo(&lnk.display().to_string()).as_ptr(), 1) >= 0;
            soltar(arquivo);
        } else {
            ok = false;
        }
        soltar(link);
        if ok { Ok(()) } else { Err(falha("gravação")) }
    }
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn compara_versoes() {
        assert!(mais_nova("2.1.1", "2.1.0"));
        assert!(mais_nova("2.10.0", "2.9.9"));
        assert!(mais_nova("2.1.0", "2.0.3"));
        assert!(!mais_nova("2.1.0", "2.1.0"));
        assert!(!mais_nova("2.0.3", "2.1.0"));
        assert!(mais_nova("2.1.0", "versão estranha"));
    }

    fn destino_de_teste(nome: &str) -> Destino {
        let base = std::env::temp_dir().join(format!("bancada-teste-instalacao-{nome}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        Destino {
            programa: base.join("Programs").join("Bancada Livre"),
            menu: base.join("Menu"),
            area: base.join("Area"),
            chave: format!(r"Software\BancadaLivreTeste\{nome}-{}", std::process::id()),
            sobras: base.join("sobras"),
        }
    }

    // instala por cima de uma instalação do Inno Setup, atualiza e desinstala, em pastas e chave próprias do teste
    #[test]
    fn instala_atualiza_e_desinstala() {
        let d = destino_de_teste("ciclo");
        let base = d.programa.parent().unwrap().parent().unwrap().to_path_buf();
        // "instalação do Inno": o desinstalador dele, o atalho de desinstalar e a chave com a versão antiga
        fs::create_dir_all(d.programa.join("licencas")).unwrap();
        fs::write(d.programa.join("unins000.exe"), b"x").unwrap();
        fs::write(d.programa.join("licencas").join("innosetup-license.txt"), b"x").unwrap();
        fs::create_dir_all(&d.menu).unwrap();
        fs::write(d.menu.join(ATALHO_DESINSTALAR), b"x").unwrap();
        let origem = base.join("baixado").join(EXE);
        fs::create_dir_all(origem.parent().unwrap()).unwrap();
        fs::write(&origem, b"programa novo").unwrap();
        instalar(&d, &origem).unwrap();

        assert_eq!(fs::read(d.exe()).unwrap(), b"programa novo");
        assert!(d.programa.join("bancada-livre.html").exists() && d.programa.join("LICENSE").exists());
        assert!(!d.programa.join("unins000.exe").exists() && !d.programa.join("licencas").exists());
        assert!(d.menu.join(ATALHO).exists() && d.area.join(ATALHO).exists());
        assert!(!d.menu.join(ATALHO_DESINSTALAR).exists());
        assert_eq!(ler_texto(HKCU, &d.chave, "DisplayVersion").as_deref(), Some(VERSAO));
        let desinstalar_cmd = ler_texto(HKCU, &d.chave, "UninstallString").unwrap();
        assert!(desinstalar_cmd.ends_with("--desinstalar") && desinstalar_cmd.contains(EXE));

        // atualização: quem tirou o atalho da Área de Trabalho não o ganha de volta
        fs::remove_file(d.area.join(ATALHO)).unwrap();
        fs::write(&origem, b"programa mais novo").unwrap();
        instalar(&d, &origem).unwrap();
        assert_eq!(fs::read(d.exe()).unwrap(), b"programa mais novo");
        assert!(!d.area.join(ATALHO).exists());

        // um arquivo do usuário na pasta impede que ela suma, e só ele fica
        fs::write(d.programa.join("meu-circuito.json"), b"{}").unwrap();
        desinstalar(&d, &origem, true).unwrap();
        assert!(ler_texto(HKCU, &d.chave, "DisplayVersion").is_none());
        assert!(!d.menu.join(ATALHO).exists());
        let sobrou: Vec<_> = fs::read_dir(&d.programa).unwrap().flatten().map(|e| e.file_name()).collect();
        assert_eq!(sobrou, vec![std::ffi::OsString::from("meu-circuito.json")]);
        apagar_chave(HKCU, &d.chave);      // só a deste teste: os outros rodam ao mesmo tempo
        let _ = fs::remove_dir_all(base);
    }

    // achado do Tarja Livre (29/10/2026): o exe preso por um instante (antivírus) deixava a desinstalação pela metade
    fn instalado_para_desinstalar(nome: &str) -> (Destino, PathBuf) {
        let d = destino_de_teste(nome);
        let origem = d.programa.parent().unwrap().parent().unwrap().join("baixado").join(EXE);
        fs::create_dir_all(origem.parent().unwrap()).unwrap();
        fs::write(&origem, b"programa").unwrap();
        instalar(&d, &origem).unwrap();
        (d, origem)
    }

    fn prender(arquivo: &Path) -> fs::File {
        use std::os::windows::fs::OpenOptionsExt;
        fs::OpenOptions::new().read(true).share_mode(0).open(arquivo).unwrap()
    }

    #[test]
    fn desinstalar_espera_o_exe_preso_por_um_instante() {
        let (d, origem) = instalado_para_desinstalar("preso-instante");
        let trava = prender(&d.exe());
        let solta = std::thread::spawn(move || { std::thread::sleep(Duration::from_millis(800)); drop(trava) });
        desinstalar_com_prazo(&d, &origem, true, Duration::from_secs(5)).unwrap();
        solta.join().unwrap();
        assert!(!d.exe().exists() && !d.menu.join(ATALHO).exists());
        assert!(ler_texto(HKCU, &d.chave, "DisplayVersion").is_none());
        let _ = fs::remove_dir_all(d.programa.parent().unwrap().parent().unwrap());
    }

    #[test]
    fn desinstalar_com_o_exe_preso_nao_mexe_em_nada() {
        let (d, origem) = instalado_para_desinstalar("preso-sempre");
        let trava = prender(&d.exe());
        assert!(desinstalar_com_prazo(&d, &origem, true, Duration::from_millis(500)).is_err());
        drop(trava);
        assert!(d.exe().exists() && d.menu.join(ATALHO).exists() && d.programa.join("LICENSE").exists());
        assert_eq!(ler_texto(HKCU, &d.chave, "DisplayVersion").as_deref(), Some(VERSAO));
        apagar_chave(HKCU, &d.chave);
        let _ = fs::remove_dir_all(d.programa.parent().unwrap().parent().unwrap());
    }

    #[test]
    fn instalar_por_cima_espera_o_exe_preso_por_um_instante() {
        let (d, origem) = instalado_para_desinstalar("atualizar-preso");
        fs::write(&origem, b"programa novo").unwrap();
        let trava = prender(&d.exe());
        let solta = std::thread::spawn(move || { std::thread::sleep(Duration::from_millis(800)); drop(trava) });
        instalar(&d, &origem).unwrap();
        solta.join().unwrap();
        assert_eq!(fs::read(d.exe()).unwrap(), b"programa novo");
        apagar_chave(HKCU, &d.chave);
        let _ = fs::remove_dir_all(d.programa.parent().unwrap().parent().unwrap());
    }

    // N-C2: se o exe novo não entrar no lugar, o antigo volta; dando certo, o antigo sai
    #[test]
    fn troca_do_exe_volta_atras_se_o_novo_nao_entrar() {
        let pasta = std::env::temp_dir().join(format!("bancada-teste-troca-{}", std::process::id()));
        fs::create_dir_all(&pasta).unwrap();
        let (novo, exe, antigo) = (pasta.join("x.novo"), pasta.join("x.exe"), pasta.join("x.antigo"));
        fs::write(&novo, b"novo").unwrap();
        fs::write(&exe, b"antigo").unwrap();
        let falha = |_: &Path, _: &Path| Err(io::Error::other("rename negado"));
        assert!(trocar_exe(&novo, &exe, &antigo, Duration::from_millis(300), falha).is_err());
        assert_eq!(fs::read(&exe).unwrap(), b"antigo");
        assert!(!antigo.exists());
        trocar_exe(&novo, &exe, &antigo, Duration::from_millis(300), |a, b| fs::rename(a, b)).unwrap();
        assert_eq!(fs::read(&exe).unwrap(), b"novo");
        assert_eq!(fs::read(&antigo).unwrap(), b"antigo");
        let _ = fs::remove_dir_all(pasta);
    }

    // N-R1: com uma troca anterior pela metade (só a reserva no disco), falhas repetidas não podem apagar a última cópia
    #[test]
    fn falhas_repetidas_deixam_sempre_uma_copia_do_programa() {
        let pasta = std::env::temp_dir().join(format!("bancada-teste-troca-interrompida-{}", std::process::id()));
        fs::create_dir_all(&pasta).unwrap();
        let (novo, exe, antigo) = (pasta.join("x.novo"), pasta.join("x.exe"), pasta.join("x.antigo"));
        fs::write(&novo, b"novo").unwrap();
        fs::write(&antigo, b"antigo").unwrap();       // o exe sumiu numa troca interrompida
        let falha = |_: &Path, _: &Path| Err(io::Error::other("rename negado"));
        // o antivírus pode segurar por um instante o exe recém-renomeado: a leitura insiste antes de dizer que não há
        let e_copia = |p: &Path| {
            let mut leu = false;
            let _ = com_tentativas(Duration::from_secs(2), || {
                if !p.exists() { return Ok(()); }
                fs::read(p).map(|d| leu = d == b"antigo")
            });
            leu
        };
        for _ in 0..3 {
            assert!(trocar_exe(&novo, &exe, &antigo, Duration::from_millis(300), falha).is_err());
            assert!(e_copia(&exe) || e_copia(&antigo), "sem nenhuma cópia do programa depois da falha");
        }
        let _ = fs::remove_dir_all(pasta);
    }

    // auditoria rodada 2: com a pasta temporária em outro disco, mover o exe para lá sempre falha; a desinstalação
    // feita pelo próprio exe instalado o põe na pasta de sobras, no mesmo disco
    #[test]
    fn desinstalar_pelo_exe_instalado_move_para_as_sobras_no_mesmo_disco() {
        let (d, _) = instalado_para_desinstalar("sobras");
        let exe = d.exe();
        desinstalar(&d, &exe, true).unwrap();
        assert!(!exe.exists() && ler_texto(HKCU, &d.chave, "DisplayVersion").is_none());
        let movidos: Vec<_> = fs::read_dir(&d.sobras).unwrap().flatten().collect();
        assert_eq!(movidos.len(), 1);
        limpar_sobras(&d);
        assert!(!d.sobras.exists());
        let _ = fs::remove_dir_all(d.programa.parent().unwrap().parent().unwrap());
    }
}
