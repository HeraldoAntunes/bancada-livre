// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Salvamento automático em arquivo, além do localStorage, para resistir a queda de energia ou do programa no meio da
// gravação: escreve num temporário, força a ida ao disco e só então troca pelo definitivo (a troca é atômica no NTFS).
// A versão anterior fica guardada à parte. Cada gravação usa um temporário com nome próprio (processo e contador): duas
// gravações nunca escrevem no mesmo arquivo. Quem escolhe a cópia que abre é a página, pela revisão gravada dentro do
// próprio circuito (`salvamento.revisao`): este módulo só guarda e devolve os bytes, e nunca decide pela data do arquivo
// (auditoria de 30/10/2026, BL-NR-03-R e BL-NR-04). A única exceção é `migrar`, que a página pede depois que a pessoa
// escolhe entre cópias sem envelope: ela guarda tudo em `copias-preservadas` antes de converter (rc.6, BL-MIG-01).
use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::UNIX_EPOCH;

pub const ATUAL: &str = "circuito.json";
pub const ANTERIOR: &str = "circuito-anterior.json";
const PREFIXO_TEMPORARIO: &str = "circuito.json.";
/// Sobras da 2.1.1-rc.4, que copiava o atual para um temporário antes de virar a reserva: também são entregues.
const PREFIXO_RESERVA: &str = "circuito-anterior.json.";
static GRAVACOES: AtomicU64 = AtomicU64::new(0);

fn temporario(pasta: &Path) -> (PathBuf, u64) {
    let n = GRAVACOES.fetch_add(1, Ordering::SeqCst);
    (pasta.join(format!("{PREFIXO_TEMPORARIO}{}-{n}.tmp", std::process::id())), n)
}

fn hora_de(caminho: &Path) -> u64 {
    fs::metadata(caminho).and_then(|m| m.modified()).ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_millis() as u64).unwrap_or(0)
}

/// Os temporários que sobraram (de uma queda, ou de uma troca que falhou), dos dois tipos, em ordem de nome.
fn sobras(pasta: &Path) -> Vec<PathBuf> {
    let Ok(lista) = fs::read_dir(pasta) else { return Vec::new() };
    let mut achados: Vec<PathBuf> = lista.flatten().map(|e| e.path()).filter(|p| {
        p.file_name().map(|n| n.to_string_lossy().to_string()).is_some_and(|n| {
            (n.starts_with(PREFIXO_TEMPORARIO) || n.starts_with(PREFIXO_RESERVA)) && n.ends_with(".tmp")
        })
    }).collect();
    achados.sort();
    achados
}

/// Uma sobra (temporário novo ou reserva provisória) é mais velha que a gravação `n` deste processo quando é de outro
/// processo (de uma abertura anterior: o programa abre uma janela só por pasta, ver `sistema::janela_unica`) ou deste
/// processo com contador menor. Decide pelo nome, nunca pela data.
fn mais_velha(sobra: &Path, n: u64) -> bool {
    let nome = sobra.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
    let resto = nome.strip_prefix(PREFIXO_TEMPORARIO).or_else(|| nome.strip_prefix(PREFIXO_RESERVA));
    let Some(resto) = resto.and_then(|r| r.strip_suffix(".tmp")) else { return true };
    match resto.split_once('-').map(|(p, c)| (p.parse::<u32>(), c.parse::<u64>())) {
        Some((Ok(pid), Ok(c))) => pid != std::process::id() || c < n,
        _ => true,
    }
}

/// Íntegro: JSON que abre, com as listas de componentes e de fios, cada peça com id, tipo e posição e cada fio com id e
/// as duas pontas. É só um filtro de arquivo estragado: a conferência completa é a do simulador, que escolhe entre as
/// cópias. Por isso nada aqui apaga ou troca uma cópia por causa dele (auditoria de 30/10/2026, BL-NR-03-R).
pub fn integro(texto: &str) -> bool {
    use serde_json::Value;
    let Ok(v) = serde_json::from_str::<Value>(texto) else { return false };
    let texto_em = |o: &Value, campo: &str| o.get(campo).is_some_and(Value::is_string);
    let numero_em = |o: &Value, campo: &str| o.get(campo).and_then(Value::as_f64).is_some_and(f64::is_finite);
    let ponta = |o: &Value, campo: &str| o.get(campo).is_some_and(|p| texto_em(p, "comp") && texto_em(p, "pin"));
    let pecas_ok = v.get("components").and_then(Value::as_array).is_some_and(|lista| lista.iter().all(|c| {
        texto_em(c, "id") && texto_em(c, "type") && numero_em(c, "x") && numero_em(c, "y")
    }));
    let fios_ok = v.get("wires").and_then(Value::as_array).is_some_and(|lista| lista.iter().all(|w| {
        texto_em(w, "id") && ponta(w, "from") && ponta(w, "to")
    }));
    pecas_ok && fios_ok
}

/// Uma gravação por vez. A página já espera a anterior terminar antes de mandar outra; a trava garante o mesmo para
/// qualquer outro chamador (auditoria de 30/10/2026, N01/N23): o contrato é "chamadas a `gravar` podem vir ao mesmo
/// tempo, e cada uma acontece inteira, uma depois da outra".
static GRAVANDO: std::sync::Mutex<()> = std::sync::Mutex::new(());

/// Grava o circuito que a página mandou (ela já o conferiu por inteiro).
pub fn gravar(pasta: &Path, texto: &str) -> io::Result<()> {
    gravar_com(pasta, texto, &|de, para| fs::rename(de, para))
}

/// Ordem, com `renomear` trocável nos testes (para falhar em cada passo):
/// 1. o temporário vai ao disco;
/// 2. o atual íntegro sai para uma reserva provisória (renomeação: guarda a data, nada é copiado);
/// 3. o temporário vira o atual; se falhar, a reserva provisória volta a ser o atual;
/// 4. só então a reserva provisória vira a reserva, no lugar da antiga, que até aqui ficou intacta (N16);
/// 5. as sobras mais velhas saem.
///
/// Se um passo falhar, o que já está no disco fica (o temporário novo, a reserva provisória) e segue entre os
/// `candidatos`: nenhuma cópia é apagada ou trocada sem a promoção confirmada.
fn gravar_com(pasta: &Path, texto: &str, renomear: &dyn Fn(&Path, &Path) -> io::Result<()>) -> io::Result<()> {
    if !integro(texto) {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "circuito incompleto: não gravado"));
    }
    let _vez = GRAVANDO.lock().unwrap_or_else(|e| e.into_inner());
    conhecer(texto.as_bytes());
    fs::create_dir_all(pasta)?;
    let (atual, (tmp, n)) = (pasta.join(ATUAL), temporario(pasta));
    let escrito = (|| {
        let mut f = fs::File::create_new(&tmp)?;
        f.write_all(texto.as_bytes())?;
        f.sync_all()
    })();
    if let Err(e) = escrito {
        let _ = fs::remove_file(&tmp);       // pela metade: não é cópia de nada
        return Err(e);
    }
    // um atual estragado nunca substitui a reserva boa (auditoria de 29/10/2026): ele só é trocado pelo novo
    let provisoria = if fs::read_to_string(&atual).is_ok_and(|t| integro(&t)) {
        let p = pasta.join(format!("{PREFIXO_RESERVA}{}-{n}.tmp", std::process::id()));
        renomear(&atual, &p)?;
        Some(p)
    } else {
        None
    };
    if let Err(e) = renomear(&tmp, &atual) {
        if let Some(p) = &provisoria { let _ = renomear(p, &atual); }
        return Err(e);
    }
    if let Some(p) = &provisoria {
        renomear(p, &pasta.join(ANTERIOR))?;
    }
    for velha in sobras(pasta).into_iter().filter(|s| mais_velha(s, n)) {
        let _ = fs::remove_file(velha);
    }
    Ok(())
}

/// Uma cópia entregue à página: os bytes, a data do arquivo (só informação) e de onde veio, para a pergunta da migração.
pub struct Copia {
    pub texto: String,
    pub hora: u64,
    pub principal: bool,
    pub origem: &'static str,
}

/// Todas as cópias íntegras (o atual, a reserva e os temporários que sobraram), com a data de cada arquivo. A página
/// confere cada uma por inteiro e abre a de maior revisão; a data vai só como informação.
pub fn candidatos(pasta: &Path) -> Vec<Copia> {
    let caminhos = [pasta.join(ATUAL), pasta.join(ANTERIOR)].into_iter().chain(sobras(pasta));
    caminhos.enumerate().filter_map(|(i, caminho)| {
        let texto = fs::read_to_string(&caminho).ok().filter(|t| integro(t))?;
        conhecer(texto.as_bytes());
        let origem = match i { 0 => "Arquivo principal do programa", 1 => "Cópia anterior do programa",
            _ => "Gravação interrompida do programa" };
        Some(Copia { hora: hora_de(&caminho), texto, principal: i == 0, origem })
    }).collect()
}

/// Regra do professor para as cópias sem envelope (30/10/2026): a migração é silenciosa, pelo `circuito.json`, e só
/// pergunta quando ele falta, não abre como circuito, ou quando há um temporário mais novo que ele. Aqui a data do
/// arquivo decide, porque cópia sem envelope não tem revisão. Temporário pela metade não conta. A página acrescenta o
/// caso do atual que o simulador recusa.
pub fn perguntar_migracao(pasta: &Path) -> bool {
    let atual = pasta.join(ATUAL);
    if !fs::read_to_string(&atual).is_ok_and(|t| integro(&t)) {
        return true;
    }
    let hora = hora_de(&atual);
    sobras(pasta).iter().any(|s| hora_de(s) > hora && fs::read_to_string(s).is_ok_and(|t| integro(&t)))
}

/// Cópias que este programa já conhece nesta abertura (as que entregou à página e as que gravou), pela impressão dos
/// bytes. Uma cópia ativa fora delas e fora do que a página mandou só pode ter vindo de outro programa: a migração não
/// passa por cima dela.
static CONHECIDAS: std::sync::Mutex<Vec<u64>> = std::sync::Mutex::new(Vec::new());

/// FNV-1a de 64 bits: estável entre versões do Rust, serve para reconhecer e para dar nome às cópias preservadas.
fn impressao(bytes: &[u8]) -> u64 {
    bytes.iter().fold(0xcbf2_9ce4_8422_2325, |h, b| (h ^ u64::from(*b)).wrapping_mul(0x0100_0000_01b3))
}
fn conhecer(bytes: &[u8]) {
    CONHECIDAS.lock().unwrap_or_else(|e| e.into_inner()).push(impressao(bytes));
}
fn conhecida(bytes: &[u8]) -> bool {
    CONHECIDAS.lock().unwrap_or_else(|e| e.into_inner()).contains(&impressao(bytes))
}

/// Pasta das cópias guardadas pela migração. Nada nela volta a ser candidato ao abrir.
pub const PRESERVADAS: &str = "copias-preservadas";
/// Registro durável dos reinícios da contagem (ver `migrar`), entregue à página em `__BANCADA_REVISOES_REINICIADAS__`.
const REINICIOS: &str = "revisoes-reiniciadas.json";

/// Um circuito que a página recebeu (`original`, os bytes como chegaram) e a conversão dele com envelope.
pub struct Par {
    pub original: String,
    pub envelope: String,
}

/// Escreve num temporário, força a ida ao disco e troca pelo destino. Se falhar, o temporário sai.
fn escrever_e_trocar(tmp: &Path, destino: &Path, bytes: &[u8], renomear: &dyn Fn(&Path, &Path) -> io::Result<()>)
    -> io::Result<()> {
    let r = (|| {
        let mut f = fs::File::create(tmp)?;
        f.write_all(bytes)?;
        f.sync_all()?;
        drop(f);
        renomear(tmp, destino)
    })();
    if r.is_err() { let _ = fs::remove_file(tmp); }
    r
}

/// Guarda os bytes em `copias-preservadas`, com nome tirado da impressão. Repetir não duplica nada.
fn preservar(pasta: &Path, bytes: &[u8], renomear: &dyn Fn(&Path, &Path) -> io::Result<()>) -> io::Result<()> {
    let base = format!("circuito-{:016x}", impressao(bytes));
    let mut k = 0u32;
    loop {
        let nome = if k == 0 { format!("{base}.json") } else { format!("{base}-{k}.json") };
        let destino = pasta.join(&nome);
        match fs::read(&destino) {
            Ok(b) if b == bytes => return Ok(()),
            Ok(_) => k += 1,
            Err(e) if e.kind() == io::ErrorKind::NotFound =>
                return escrever_e_trocar(&pasta.join(format!("{nome}.tmp")), &destino, bytes, renomear),
            Err(e) => return Err(e),
        }
    }
}

/// Junta os pares novos ao registro dos reinícios (o par novo de um mesmo original vale) e grava de uma vez.
fn registrar_reinicio(pasta: &Path, novos: &[&Par], renomear: &dyn Fn(&Path, &Path) -> io::Result<()>)
    -> io::Result<()> {
    use serde_json::{json, Value};
    let destino = pasta.join(REINICIOS);
    let mut lista: Vec<Value> = match fs::read(&destino) {
        Ok(b) => match serde_json::from_slice::<Value>(&b) {
            Ok(Value::Array(v)) => v,
            _ => { preservar(pasta, &b, renomear)?; Vec::new() }     // registro estragado: guardado, e recomeça
        },
        Err(e) if e.kind() == io::ErrorKind::NotFound => Vec::new(),
        Err(e) => return Err(e),
    };
    for par in novos {
        lista.retain(|r| r.get("original").and_then(Value::as_str) != Some(par.original.as_str()));
        lista.push(json!({ "original": par.original, "envelope": par.envelope }));
    }
    let texto = serde_json::to_string(&Value::Array(lista)).map_err(io::Error::other)?;
    escrever_e_trocar(&pasta.join(format!("{REINICIOS}.tmp")), &destino, texto.as_bytes(), renomear)
}

/// O registro dos reinícios, como a página espera; sem registro, ou estragado, a lista vazia.
pub fn reinicios(pasta: &Path) -> serde_json::Value {
    fs::read(pasta.join(PRESERVADAS).join(REINICIOS)).ok()
        .and_then(|b| serde_json::from_slice::<serde_json::Value>(&b).ok())
        .filter(serde_json::Value::is_array)
        .unwrap_or_else(|| serde_json::Value::Array(Vec::new()))
}

/// Migração das cópias sem envelope (e reinício da contagem), pedida pela página depois que a pessoa escolheu qual
/// circuito continua (contrato em docs/ARQUITETURA.md). `texto` é o escolhido, já com envelope; `pares`, cada cópia que
/// a página recebeu com a conversão dela. Ordem:
/// 1. confere que toda cópia ativa no disco é conhecida (veio da página, foi entregue a ela ou gravada por este
///    programa); se não, para sem mudar nada;
/// 2. guarda em `copias-preservadas` os bytes de toda cópia ativa e de todo original, e, no reinício, o registro dos
///    pares cujo original não está no disco (o do navegador), antes de publicar;
/// 3. troca a reserva pela conversão do atual de antes (ou da própria reserva);
/// 4. tira os temporários que sobraram (já guardados);
/// 5. publica o escolhido por último.
///
/// Repetir com os mesmos dados não muda nada; depois de uma falha no meio, repetir completa o que faltou.
pub fn migrar(pasta: &Path, texto: &str, pares: &[Par], reiniciar: bool) -> io::Result<()> {
    migrar_com(pasta, texto, pares, reiniciar, &|de, para| fs::rename(de, para))
}

fn migrar_com(pasta: &Path, texto: &str, pares: &[Par], reiniciar: bool,
    renomear: &dyn Fn(&Path, &Path) -> io::Result<()>) -> io::Result<()> {
    if !integro(texto) || pares.iter().any(|p| !integro(&p.envelope)) {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "migração com circuito incompleto: nada foi mudado"));
    }
    let _vez = GRAVANDO.lock().unwrap_or_else(|e| e.into_inner());
    fs::create_dir_all(pasta)?;
    let (atual, anterior) = (pasta.join(ATUAL), pasta.join(ANTERIOR));
    let mut ativas: Vec<(PathBuf, Vec<u8>)> = Vec::new();
    for c in [atual.clone(), anterior.clone()].into_iter().chain(sobras(pasta)) {
        match fs::read(&c) {
            Ok(b) => ativas.push((c, b)),
            Err(e) if e.kind() == io::ErrorKind::NotFound => {}
            Err(e) => return Err(e),
        }
    }
    let da_pagina = |b: &[u8]| b == texto.as_bytes()
        || pares.iter().any(|p| b == p.original.as_bytes() || b == p.envelope.as_bytes());
    for (c, b) in &ativas {
        if std::str::from_utf8(b).is_ok_and(integro) && !da_pagina(b) && !conhecida(b) {
            let nome = c.file_name().unwrap_or_default().to_string_lossy();
            return Err(io::Error::other(format!("{nome} mudou fora do programa: a migração não seguiu")));
        }
    }
    let guardadas = pasta.join(PRESERVADAS);
    fs::create_dir_all(&guardadas)?;
    // o escolhido e as conversões saem do que já está guardado: não precisam de cópia
    let derivada = |b: &[u8]| b == texto.as_bytes() || pares.iter().any(|p| b == p.envelope.as_bytes());
    for b in ativas.iter().map(|(_, b)| b.as_slice()).filter(|b| !derivada(b))
        .chain(pares.iter().map(|p| p.original.as_bytes())) {
        preservar(&guardadas, b, renomear)?;
    }
    if reiniciar {
        let fora: Vec<&Par> = pares.iter()
            .filter(|p| !ativas.iter().any(|(_, b)| b == p.original.as_bytes())).collect();
        if !fora.is_empty() { registrar_reinicio(&guardadas, &fora, renomear)?; }
    }
    let conteudo = |c: &Path| ativas.iter().find(|(p, _)| p == c).map(|(_, b)| b.as_slice());
    let convertida = |b: &[u8]| pares.iter().find_map(|p| {
        (p.original.as_bytes() == b || p.envelope.as_bytes() == b).then_some(p.envelope.as_bytes())
    });
    // quando o escolhido é o próprio atual (o caso da migração silenciosa), a reserva continua sendo a de antes, convertida
    let sem_envelope = |b: &[u8]| serde_json::from_slice::<serde_json::Value>(b).ok().map(|mut v| {
        if let Some(o) = v.as_object_mut() { o.remove("salvamento"); }
        v
    });
    let mesmo_circuito = |b: &[u8]| sem_envelope(b).is_some_and(|v| Some(v) == sem_envelope(texto.as_bytes()));
    let reserva = conteudo(&atual).filter(|b| !mesmo_circuito(b)).and_then(convertida)
        .or_else(|| conteudo(&anterior).and_then(convertida));
    let (tmp, _) = temporario(pasta);
    if let Some(r) = reserva.filter(|r| conteudo(&anterior) != Some(*r)) {
        escrever_e_trocar(&tmp, &anterior, r, renomear)?;
        conhecer(r);
    }
    for (c, _) in ativas.iter().filter(|(c, _)| *c != atual && *c != anterior) {
        fs::remove_file(c)?;
    }
    if conteudo(&atual) != Some(texto.as_bytes()) {
        escrever_e_trocar(&tmp, &atual, texto.as_bytes(), renomear)?;
    }
    conhecer(texto.as_bytes());
    Ok(())
}

#[cfg(test)]
mod testes {
    use super::*;

    /// Pasta de teste na pasta temporária, apagada no fim do teste, também quando ele falha.
    struct Pasta(PathBuf);
    impl std::ops::Deref for Pasta {
        type Target = Path;
        fn deref(&self) -> &Path { &self.0 }
    }
    impl Drop for Pasta {
        fn drop(&mut self) { let _ = fs::remove_dir_all(&self.0); }
    }
    fn pasta(nome: &str) -> Pasta {
        let p = std::env::temp_dir().join(format!("bancada-teste-salvamento-{nome}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&p);
        fs::create_dir_all(&p).unwrap();
        Pasta(p)
    }
    fn nomes_das_sobras(p: &Path) -> Vec<String> {
        sobras(p).iter().map(|s| s.file_name().unwrap().to_string_lossy().to_string()).collect()
    }
    fn textos(p: &Path) -> Vec<String> { candidatos(p).into_iter().map(|c| c.texto).collect() }
    fn ler(p: &Path) -> Option<String> { fs::read_to_string(p.join(ATUAL)).ok() }
    const C1: &str = r#"{"version":1,"components":[{"id":"a","type":"LED","x":10,"y":20}],"wires":[]}"#;
    const C2: &str = r#"{"version":1,"components":[{"id":"a","type":"LED","x":10,"y":20},{"id":"b","type":"SWITCH","x":0,"y":0}],"wires":[{"id":"w","from":{"comp":"b","pin":"out"},"to":{"comp":"a","pin":"in"}}]}"#;
    /// Um circuito que passa no filtro daqui mas que o simulador recusa (tipo de peça que não existe).
    const TIPO_DESCONHECIDO: &str = r#"{"version":1,"components":[{"id":"z","type":"NAO_EXISTE","x":1,"y":1}],"wires":[]}"#;
    /// O atual que não deixa ser trocado (aberto sem permitir apagar), como um antivírus segurando o arquivo.
    fn prender(caminho: &Path) -> fs::File {
        use std::os::windows::fs::OpenOptionsExt;
        fs::OpenOptions::new().read(true).share_mode(1).open(caminho).unwrap()   // só FILE_SHARE_READ
    }

    #[test]
    fn grava_e_le_de_volta() {
        let p = pasta("simples");
        gravar(&p, C1).unwrap();
        assert_eq!(ler(&p).as_deref(), Some(C1));
        gravar(&p, C2).unwrap();
        assert_eq!(ler(&p).as_deref(), Some(C2));
        assert_eq!(fs::read_to_string(p.join(ANTERIOR)).unwrap(), C1);
        assert!(nomes_das_sobras(&p).is_empty());
    }

    #[test]
    fn atual_estragado_ainda_deixa_a_reserva_entre_as_copias() {
        let p = pasta("estragado");
        gravar(&p, C1).unwrap();
        gravar(&p, C2).unwrap();
        fs::write(p.join(ATUAL), &C2[..20]).unwrap();   // como se a energia caísse no meio da escrita
        assert_eq!(textos(&p), vec![C1.to_string()]);
    }

    #[test]
    fn temporario_pela_metade_nao_e_entregue_e_sai_na_gravacao_seguinte() {
        let p = pasta("temporario");
        gravar(&p, C1).unwrap();
        fs::write(p.join("circuito.json.99-0.tmp"), &C2[..10]).unwrap();   // de uma abertura anterior, pela metade
        assert_eq!(textos(&p), vec![C1.to_string()]);
        gravar(&p, C2).unwrap();
        assert_eq!(ler(&p).as_deref(), Some(C2));
        assert!(nomes_das_sobras(&p).is_empty());
    }

    #[test]
    fn recusa_circuito_incompleto_e_pasta_vazia_nao_tem_nada() {
        let p = pasta("vazia");
        assert!(gravar(&p, "{\"components\":[").is_err());
        assert!(gravar(&p, "{}").is_err());
        assert!(textos(&p).is_empty());
    }

    // auditoria de 29/10/2026: duas gravações ao mesmo tempo (duas janelas, ou dois processos) usavam o mesmo
    // temporário, e uma podia trocar o arquivo pelo temporário que a outra ainda escrevia
    #[test]
    fn gravacoes_ao_mesmo_tempo_nunca_deixam_copia_ilegivel() {
        let p = pasta("concorrente");
        gravar(&p, C1).unwrap();
        let grande = |marca: usize| {
            let pecas: Vec<String> = (0..3000).map(|i| format!(r#"{{"id":"{marca}-{i}","type":"LED","x":{i},"y":0}}"#)).collect();
            format!(r#"{{"version":1,"components":[{}],"wires":[]}}"#, pecas.join(","))
        };
        let (a, b) = (grande(1), grande(2));
        let fios: Vec<_> = [a.clone(), b.clone()].into_iter().map(|texto| {
            let p = p.to_path_buf();
            std::thread::spawn(move || for _ in 0..40 { let _ = gravar(&p, &texto); })
        }).collect();
        let mut leituras = 0;
        while !fios.iter().all(|f| f.is_finished()) {
            if let Ok(t) = fs::read_to_string(p.join(ATUAL)) {
                assert!(integro(&t), "circuito.json ilegível no meio das gravações");
                leituras += 1;
            }
        }
        for f in fios { f.join().unwrap(); }
        gravar(&p, &a).unwrap();     // uma gravação confirmada no fim limpa o que sobrou das que falharam
        assert_eq!(ler(&p).as_deref(), Some(a.as_str()));
        assert!(nomes_das_sobras(&p).is_empty(), "sobrou temporário: {:?}", nomes_das_sobras(&p));
        assert!(leituras > 0);
    }

    // auditoria rodada 2 (29/10/2026): um atual estragado não pode virar a reserva
    #[test]
    fn atual_estragado_nao_substitui_a_reserva_boa() {
        let p = pasta("reserva");
        gravar(&p, C1).unwrap();
        gravar(&p, C2).unwrap();                       // reserva = C1, atual = C2
        fs::write(p.join(ATUAL), &C2[..20]).unwrap();  // o atual se estraga
        gravar(&p, C1).unwrap();
        assert_eq!(fs::read_to_string(p.join(ANTERIOR)).unwrap(), C1, "a reserva virou o atual estragado");
    }

    // BL-NR-03 (caso N09): um atual que abre como JSON mas tem `null` na lista não pode virar a reserva boa
    #[test]
    fn atual_com_peca_nula_nao_substitui_a_reserva_boa() {
        let p = pasta("semantica");
        fs::write(p.join(ATUAL), r#"{"version":1,"components":[null],"wires":[]}"#).unwrap();
        fs::write(p.join(ANTERIOR), C1).unwrap();
        gravar(&p, C2).unwrap();
        assert_eq!(fs::read_to_string(p.join(ANTERIOR)).unwrap(), C1);
        assert_eq!(ler(&p).as_deref(), Some(C2));
    }

    #[test]
    fn integro_confere_as_pecas_e_os_fios() {
        assert!(integro(C1) && integro(C2) && integro(TIPO_DESCONHECIDO));
        for ruim in [
            r#"{"components":[null],"wires":[]}"#,
            r#"{"components":[{"id":"a"}],"wires":[]}"#,
            r#"{"components":[{"id":"a","type":"LED","x":"1","y":0}],"wires":[]}"#,
            r#"{"components":[],"wires":[null]}"#,
            r#"{"components":[],"wires":[{"id":"w","from":{"comp":"a"},"to":{"comp":"b","pin":"in"}}]}"#,
        ] {
            assert!(!integro(ruim), "aceitou: {ruim}");
        }
    }

    // BL-NR-01 e BL-NR-03-R (casos N04, N05 e N11 do auditor): ao abrir não se promove, não se copia e não se apaga
    // nada. Atual com tipo desconhecido, reserva boa e dois temporários: a página recebe todas as cópias que abrem
    #[test]
    fn ao_abrir_todas_as_copias_vao_para_a_pagina_e_nada_e_apagado() {
        let p = pasta("abrir");
        fs::write(p.join(ATUAL), TIPO_DESCONHECIDO).unwrap();
        fs::write(p.join(ANTERIOR), C1).unwrap();
        fs::write(p.join("circuito.json.77-0.tmp"), C2).unwrap();
        fs::write(p.join("circuito-anterior.json.77-1.tmp"), C1).unwrap();     // sobra da rc.4
        let antes = nomes_das_sobras(&p);
        let c = textos(&p);
        assert_eq!(c.len(), 4);
        for t in [TIPO_DESCONHECIDO, C1, C2] { assert!(c.contains(&t.to_string())); }
        assert_eq!(nomes_das_sobras(&p), antes);
        assert_eq!(fs::read_to_string(p.join(ATUAL)).unwrap(), TIPO_DESCONHECIDO);
        assert_eq!(fs::read_to_string(p.join(ANTERIOR)).unwrap(), C1);
    }

    // BL-NR-01 (caso N05): a troca falha de verdade (há uma pasta no lugar do atual). O temporário novo fica no disco
    // e vai para a página; a gravação confirmada seguinte, quando a troca voltar a dar certo, limpa
    #[test]
    fn troca_que_falha_deixa_o_temporario_novo_entre_as_copias() {
        let p = pasta("promocao-falha");
        fs::create_dir_all(p.join(ATUAL)).unwrap();
        assert!(gravar(&p, C1).is_err());
        assert_eq!(textos(&p), vec![C1.to_string()]);
        assert_eq!(nomes_das_sobras(&p).len(), 1);
        fs::remove_dir(p.join(ATUAL)).unwrap();
        gravar(&p, C2).unwrap();
        assert_eq!(ler(&p).as_deref(), Some(C2));
        assert!(nomes_das_sobras(&p).is_empty());
    }

    // BL-NR-04: a reserva vira reserva por renomeação, com a data dela; nada é copiado, e ela continua sendo a de antes
    #[test]
    fn reserva_por_renomeacao_guarda_a_data_do_atual_de_antes() {
        let p = pasta("data");
        gravar(&p, C1).unwrap();
        let data = fs::metadata(p.join(ATUAL)).unwrap().modified().unwrap();
        std::thread::sleep(std::time::Duration::from_millis(30));
        gravar(&p, C2).unwrap();
        assert_eq!(fs::metadata(p.join(ANTERIOR)).unwrap().modified().unwrap(), data);
        assert_eq!(fs::read_to_string(p.join(ANTERIOR)).unwrap(), C1);
    }

    // a troca final falha (atual preso): o atual e a reserva ficam como estavam, e o novo fica entre as cópias
    #[test]
    fn atual_preso_nao_perde_nenhuma_copia() {
        let p = pasta("troca-presa");
        gravar(&p, C1).unwrap();
        gravar(&p, C2).unwrap();                         // reserva = C1, atual = C2
        let trava = prender(&p.join(ATUAL));
        let novo = C2.replace("\"a\"", "\"novo\"").replace("comp\":\"a", "comp\":\"novo");
        assert!(gravar(&p, &novo).is_err());
        drop(trava);
        assert_eq!(fs::read_to_string(p.join(ANTERIOR)).unwrap(), C1);
        assert_eq!(fs::read_to_string(p.join(ATUAL)).unwrap(), C2);
        assert!(textos(&p).contains(&novo), "a gravação nova sumiu");
    }

    // N16 (auditoria da rc.5): com o atual que a página recusa, uma falha em qualquer renomeação não pode trocar a
    // reserva boa nem perder o circuito novo. Cada passo falha sozinho e, depois, junto com todos os seguintes (a volta
    // atrás também falha)
    #[test]
    fn falha_em_cada_renomeacao_nao_perde_a_reserva_nem_o_novo() {
        use std::cell::Cell;
        for passo in 1..=3 {
            for e_os_seguintes in [false, true] {
                let p = pasta(&format!("n16-{passo}-{e_os_seguintes}"));
                fs::write(p.join(ATUAL), TIPO_DESCONHECIDO).unwrap();
                fs::write(p.join(ANTERIOR), C1).unwrap();
                let chamada = Cell::new(0);
                let renomear = |de: &Path, para: &Path| {
                    chamada.set(chamada.get() + 1);
                    let falha = if e_os_seguintes { chamada.get() >= passo } else { chamada.get() == passo };
                    if falha { Err(io::Error::other("renomeação negada")) } else { fs::rename(de, para) }
                };
                let r = gravar_com(&p, C2, &renomear);
                let caso = format!("passo {passo}, seguintes {e_os_seguintes}");
                assert!(r.is_err(), "{caso}: devia falhar");
                assert_eq!(fs::read_to_string(p.join(ANTERIOR)).unwrap(), C1, "{caso}: a reserva boa foi trocada");
                assert!(textos(&p).contains(&C2.to_string()), "{caso}: o circuito novo sumiu");
            }
        }
    }

    // N01/N23: chamadas ao mesmo tempo acontecem uma depois da outra; no fim, o atual é uma delas e a reserva, a outra
    #[test]
    fn duas_gravacoes_ao_mesmo_tempo_acontecem_uma_depois_da_outra() {
        let p = pasta("trava");
        gravar(&p, C1).unwrap();
        let fios: Vec<_> = [C1, C2].into_iter().map(|t| {
            let p = p.to_path_buf();
            std::thread::spawn(move || gravar(&p, t))
        }).collect();
        for f in fios { f.join().unwrap().unwrap(); }
        let (atual, reserva) = (ler(&p).unwrap(), fs::read_to_string(p.join(ANTERIOR)).unwrap());
        assert!(atual == C1 || atual == C2);
        assert!(reserva == C1 || reserva == C2);
        assert!(nomes_das_sobras(&p).is_empty());
    }

    // contrato com a página (rc.5): o envelope com `salvamento` (hora e revisão) é gravado e devolvido byte a byte
    #[test]
    fn envelope_da_pagina_vai_e_volta_sem_mudar_um_byte() {
        let p = pasta("envelope");
        let envelope = r#"{"version":1,"components":[{"id":"led1","type":"LED","x":0,"y":0}],"wires":[],"salvamento":{"hora":1793370000000,"revisao":8}}"#;
        gravar(&p, envelope).unwrap();
        assert_eq!(textos(&p), vec![envelope.to_string()]);
    }

    #[test]
    fn sobra_de_outra_abertura_e_mais_velha_que_qualquer_gravacao_desta() {
        let eu = std::process::id();
        assert!(mais_velha(Path::new("circuito.json.1-5.tmp"), 0) || eu == 1);
        assert!(mais_velha(Path::new(&format!("circuito.json.{eu}-3.tmp")), 4));
        assert!(!mais_velha(Path::new(&format!("circuito.json.{eu}-5.tmp")), 4));
        assert!(mais_velha(Path::new("circuito-anterior.json.9-0.tmp"), 0));
    }

    // migração (rc.6, BL-MIG-01): cada teste usa ids próprios, porque as cópias conhecidas valem para o processo todo
    fn legado(id: &str) -> String {
        format!(r#"{{"version":1,"components":[{{"id":"{id}","type":"LED","x":1,"y":2}}],"wires":[]}}"#)
    }
    fn com_envelope(texto: &str, revisao: u64) -> String {
        format!(r#"{},"salvamento":{{"hora":1793370000000,"revisao":{revisao}}}}}"#, &texto[..texto.len() - 1])
    }
    fn par(original: &str, revisao: u64) -> Par {
        Par { original: original.to_string(), envelope: com_envelope(original, revisao) }
    }
    fn preservadas(p: &Path) -> Vec<String> {
        let mut v: Vec<String> = fs::read_dir(p.join(PRESERVADAS)).map(|l| l.flatten()
            .filter(|e| e.file_name().to_string_lossy().starts_with("circuito-"))
            .map(|e| fs::read_to_string(e.path()).unwrap()).collect()).unwrap_or_default();
        v.sort();
        v
    }

    #[test]
    fn migracao_guarda_os_originais_converte_a_reserva_e_publica_o_escolhido() {
        let p = pasta("migra-simples");
        let (atual, reserva, sobra, local) = (legado("ma"), legado("mb"), legado("mc"), legado("md"));
        fs::write(p.join(ATUAL), &atual).unwrap();
        fs::write(p.join(ANTERIOR), &reserva).unwrap();
        fs::write(p.join("circuito.json.55-0.tmp"), &sobra).unwrap();
        let pares = [par(&atual, 0), par(&reserva, 0), par(&sobra, 0), par(&local, 0)];
        let escolhido = com_envelope(&reserva, 1);
        for vez in 0..2 {                                   // a repetição não muda nada
            migrar(&p, &escolhido, &pares, false).unwrap();
            assert_eq!(ler(&p).as_deref(), Some(escolhido.as_str()), "vez {vez}");
            assert_eq!(fs::read_to_string(p.join(ANTERIOR)).unwrap(), pares[0].envelope, "vez {vez}");
            assert!(nomes_das_sobras(&p).is_empty(), "vez {vez}");
            let mut esperado = vec![atual.clone(), reserva.clone(), sobra.clone(), local.clone()];
            esperado.sort();
            assert_eq!(preservadas(&p), esperado, "vez {vez}");
        }
        assert!(textos(&p).iter().all(|t| t.contains("\"salvamento\"")), "sobrou cópia sem envelope entre as ativas");
        assert!(reinicios(&p).as_array().unwrap().is_empty());
    }

    #[test]
    fn migracao_nao_passa_por_cima_de_copia_que_ninguem_conhece() {
        let p = pasta("migra-estranha");
        let estranha = legado("mestranha-de-outro-programa");
        fs::write(p.join(ATUAL), &estranha).unwrap();
        let local = legado("mf");
        assert!(migrar(&p, &com_envelope(&local, 1), &[par(&local, 0)], false).is_err());
        assert_eq!(ler(&p).as_deref(), Some(estranha.as_str()));
        assert!(!p.join(PRESERVADAS).exists());
    }

    // a página recusa o atual (tipo que não existe): ele não vem entre os pares, mas foi entregue a ela ao abrir
    #[test]
    fn copia_que_a_pagina_recusou_e_guardada_e_sai_das_ativas() {
        let p = pasta("migra-recusada");
        let recusada = TIPO_DESCONHECIDO.replace("\"z\"", "\"mrecusada\"");
        let reserva = legado("mg");
        fs::write(p.join(ATUAL), &recusada).unwrap();
        fs::write(p.join(ANTERIOR), &reserva).unwrap();
        assert_eq!(textos(&p).len(), 2);                    // a abertura entrega as duas
        let pares = [par(&reserva, 0)];
        let escolhido = com_envelope(&reserva, 1);
        migrar(&p, &escolhido, &pares, false).unwrap();
        assert_eq!(ler(&p).as_deref(), Some(escolhido.as_str()));
        assert_eq!(fs::read_to_string(p.join(ANTERIOR)).unwrap(), pares[0].envelope);
        assert!(preservadas(&p).contains(&recusada));
    }

    // falha em cada renomeação: nenhum original some (ou está ativo, ou guardado) e repetir completa a migração
    #[test]
    fn falha_no_meio_da_migracao_nao_perde_original_e_a_repeticao_completa() {
        use std::cell::Cell;
        for passo in 1..=7 {
            let p = pasta(&format!("migra-falha-{passo}"));
            let (atual, reserva, sobra, local) =
                (legado(&format!("mh{passo}")), legado(&format!("mi{passo}")), legado(&format!("mj{passo}")), legado(&format!("mk{passo}")));
            fs::write(p.join(ATUAL), &atual).unwrap();
            fs::write(p.join(ANTERIOR), &reserva).unwrap();
            fs::write(p.join("circuito.json.66-0.tmp"), &sobra).unwrap();
            let pares = [par(&atual, 0), par(&reserva, 0), par(&sobra, 0), par(&local, 0)];
            let escolhido = com_envelope(&atual, 1);
            let chamada = Cell::new(0);
            let renomear = |de: &Path, para: &Path| {
                chamada.set(chamada.get() + 1);
                if chamada.get() == passo { Err(io::Error::other("renomeação negada")) } else { fs::rename(de, para) }
            };
            let r = migrar_com(&p, &escolhido, &pares, false, &renomear);
            if r.is_ok() { assert!(passo > 6, "passo {passo}: devia falhar"); }
            let mut guardado = preservadas(&p);
            guardado.extend(textos(&p));
            for o in [&atual, &reserva, &sobra] {
                assert!(guardado.contains(o), "passo {passo}: o original sumiu: {o}");
            }
            migrar(&p, &escolhido, &pares, false).unwrap();
            assert_eq!(ler(&p).as_deref(), Some(escolhido.as_str()), "passo {passo}");
            assert_eq!(fs::read_to_string(p.join(ANTERIOR)).unwrap(), pares[1].envelope, "passo {passo}");
            assert!(nomes_das_sobras(&p).is_empty(), "passo {passo}");
            assert_eq!(preservadas(&p).len(), 4, "passo {passo}");
        }
    }

    // reinício da contagem: o par do que não está no disco (o do navegador) vai para o registro, que não duplica. Na
    // repetição, o atual de antes já saiu do disco e entra também: não atrapalha, a página só usa o par que bate
    #[test]
    fn reinicio_registra_o_par_do_navegador_e_a_repeticao_nao_duplica() {
        let p = pasta("migra-reinicio");
        let no_disco = com_envelope(&legado("ml"), 9_007_199_254_740_991);
        let no_navegador = com_envelope(&legado("mm"), 9_007_199_254_740_991);
        fs::write(p.join(ATUAL), &no_disco).unwrap();
        let pares = [Par { original: no_disco.clone(), envelope: com_envelope(&legado("ml"), 0) },
                     Par { original: no_navegador.clone(), envelope: com_envelope(&legado("mm"), 0) }];
        let escolhido = com_envelope(&legado("mm"), 1);
        migrar(&p, &escolhido, &pares, true).unwrap();
        let primeira = reinicios(&p);
        assert_eq!(primeira.as_array().unwrap().len(), 1);
        assert_eq!(primeira[0]["original"], no_navegador.as_str());
        assert_eq!(primeira[0]["envelope"], pares[1].envelope.as_str());
        for _ in 0..2 { migrar(&p, &escolhido, &pares, true).unwrap(); }
        let registro = reinicios(&p);
        let lista = registro.as_array().unwrap();
        assert_eq!(lista.len(), 2);
        assert_eq!(lista.iter().filter(|r| r["original"] == no_navegador.as_str()).count(), 1);
        assert_eq!(ler(&p).as_deref(), Some(escolhido.as_str()));
        assert_eq!(fs::read_to_string(p.join(ANTERIOR)).unwrap(), pares[0].envelope);
        assert!(textos(&p).iter().all(|t| !t.contains("9007199254740991")));
    }

    #[test]
    fn migracao_recusa_envelope_incompleto_sem_mudar_nada() {
        let p = pasta("migra-incompleta");
        let atual = legado("mn");
        fs::write(p.join(ATUAL), &atual).unwrap();
        let ruim = [Par { original: atual.clone(), envelope: "{\"components\":[".to_string() }];
        assert!(migrar(&p, &com_envelope(&atual, 1), &ruim, false).is_err());
        assert_eq!(ler(&p).as_deref(), Some(atual.as_str()));
        assert!(!p.join(PRESERVADAS).exists());
    }

    // migração silenciosa (professor, 30/10/2026): a página publica o próprio atual, com envelope. A reserva fica sendo
    // a de antes, convertida, e os dois originais vão para copias-preservadas
    #[test]
    fn migracao_silenciosa_pelo_atual_mantem_a_reserva_de_antes() {
        let p = pasta("migra-silenciosa");
        let (atual, reserva) = (legado("mq"), legado("mr"));
        fs::write(p.join(ATUAL), &atual).unwrap();
        fs::write(p.join(ANTERIOR), &reserva).unwrap();
        assert!(!perguntar_migracao(&p));
        let pares = [par(&atual, 0), par(&reserva, 0)];
        let escolhido = com_envelope(&atual, 1);
        migrar(&p, &escolhido, &pares, false).unwrap();
        assert_eq!(ler(&p).as_deref(), Some(escolhido.as_str()));
        assert_eq!(fs::read_to_string(p.join(ANTERIOR)).unwrap(), pares[1].envelope);
        let mut esperado = vec![atual, reserva];
        esperado.sort();
        assert_eq!(preservadas(&p), esperado);
    }

    // quando pergunta: atual que falta, que não abre, ou temporário íntegro mais novo que ele
    #[test]
    fn so_pergunta_sem_atual_bom_ou_com_temporario_mais_novo() {
        let p = pasta("pergunta");
        assert!(perguntar_migracao(&p), "sem atual");
        fs::write(p.join(ANTERIOR), legado("ms")).unwrap();
        assert!(perguntar_migracao(&p), "só a reserva");
        fs::write(p.join(ATUAL), "{\"components\":[").unwrap();
        assert!(perguntar_migracao(&p), "atual que não abre");
        fs::write(p.join(ATUAL), legado("mt")).unwrap();
        assert!(!perguntar_migracao(&p), "atual bom e reserva");
        let antes = std::time::SystemTime::now() - std::time::Duration::from_secs(60);
        let depois = std::time::SystemTime::now() + std::time::Duration::from_secs(60);
        let sobra = p.join("circuito.json.44-0.tmp");
        fs::write(&sobra, legado("mu")).unwrap();
        fs::File::options().write(true).open(&sobra).unwrap().set_modified(antes).unwrap();
        assert!(!perguntar_migracao(&p), "temporário mais velho");
        fs::File::options().write(true).open(&sobra).unwrap().set_modified(depois).unwrap();
        assert!(perguntar_migracao(&p), "temporário mais novo");
        fs::write(&sobra, "{\"comp").unwrap();
        fs::File::options().write(true).open(&sobra).unwrap().set_modified(depois).unwrap();
        assert!(!perguntar_migracao(&p), "temporário pela metade não conta");
    }

    #[test]
    fn origem_de_cada_copia_entregue() {
        let p = pasta("origens");
        fs::write(p.join(ANTERIOR), legado("mo")).unwrap();
        fs::write(p.join("circuito.json.12-0.tmp"), legado("mp")).unwrap();
        let c = candidatos(&p);
        assert_eq!(c.len(), 2);
        assert!(!c[0].principal && c[0].origem == "Cópia anterior do programa");
        assert_eq!(c[1].origem, "Gravação interrompida do programa");
    }
}
