// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Salvamento automático em arquivo, além do localStorage, para resistir a queda de energia ou do programa no meio da
// gravação: escreve num temporário, força a ida ao disco e só então troca pelo definitivo (a troca é atômica no NTFS).
// A versão anterior fica guardada à parte; ao abrir, vale a mais recente das duas que esteja íntegra.
use std::fs;
use std::io::{self, Write};
use std::path::Path;

pub const ATUAL: &str = "circuito.json";
pub const ANTERIOR: &str = "circuito-anterior.json";
const TEMPORARIO: &str = "circuito.json.tmp";

/// Íntegro: JSON que abre, com as listas de componentes e de fios. A conferência completa é a do simulador.
pub fn integro(texto: &str) -> bool {
    serde_json::from_str::<serde_json::Value>(texto)
        .map(|v| v.get("components").is_some_and(|c| c.is_array()) && v.get("wires").is_some_and(|w| w.is_array()))
        .unwrap_or(false)
}

pub fn gravar(pasta: &Path, texto: &str) -> io::Result<()> {
    if !integro(texto) {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "circuito incompleto: não gravado"));
    }
    fs::create_dir_all(pasta)?;
    let (atual, tmp) = (pasta.join(ATUAL), pasta.join(TEMPORARIO));
    {
        let mut f = fs::File::create(&tmp)?;
        f.write_all(texto.as_bytes())?;
        f.sync_all()?;
    }
    // a cópia anterior é só reserva: se cair no meio dela, o atual continua intacto
    if atual.exists() {
        let _ = fs::copy(&atual, pasta.join(ANTERIOR));
    }
    fs::rename(&tmp, &atual)
}

/// O circuito salvo, se houver um íntegro: primeiro o atual, depois o anterior.
pub fn ler(pasta: &Path) -> Option<String> {
    [ATUAL, ANTERIOR].iter().find_map(|nome| fs::read_to_string(pasta.join(nome)).ok().filter(|t| integro(t)))
}

#[cfg(test)]
mod testes {
    use super::*;

    fn pasta(nome: &str) -> std::path::PathBuf {
        let p = std::env::temp_dir().join(format!("bancada-teste-{nome}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&p);
        p
    }
    const C1: &str = r#"{"version":1,"components":[{"id":"a"}],"wires":[]}"#;
    const C2: &str = r#"{"version":1,"components":[{"id":"a"},{"id":"b"}],"wires":[]}"#;

    #[test]
    fn grava_e_le_de_volta() {
        let p = pasta("simples");
        gravar(&p, C1).unwrap();
        assert_eq!(ler(&p).as_deref(), Some(C1));
        gravar(&p, C2).unwrap();
        assert_eq!(ler(&p).as_deref(), Some(C2));
        assert_eq!(fs::read_to_string(p.join(ANTERIOR)).unwrap(), C1);
        assert!(!p.join(TEMPORARIO).exists());
    }

    #[test]
    fn atual_estragado_volta_para_o_anterior() {
        let p = pasta("estragado");
        gravar(&p, C1).unwrap();
        gravar(&p, C2).unwrap();
        fs::write(p.join(ATUAL), &C2[..20]).unwrap();   // como se a energia caísse no meio da escrita
        assert_eq!(ler(&p).as_deref(), Some(C1));
    }

    #[test]
    fn queda_antes_da_troca_deixa_o_atual_intacto() {
        let p = pasta("temporario");
        gravar(&p, C1).unwrap();
        fs::write(p.join(TEMPORARIO), &C2[..10]).unwrap();   // temporário pela metade, troca não aconteceu
        assert_eq!(ler(&p).as_deref(), Some(C1));
        gravar(&p, C2).unwrap();   // a gravação seguinte sobrescreve o temporário velho
        assert_eq!(ler(&p).as_deref(), Some(C2));
    }

    #[test]
    fn recusa_circuito_incompleto_e_pasta_vazia_nao_tem_nada() {
        let p = pasta("vazia");
        assert!(gravar(&p, "{\"components\":[").is_err());
        assert!(gravar(&p, "{}").is_err());
        assert_eq!(ler(&p), None);
    }
}
