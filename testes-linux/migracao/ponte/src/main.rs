// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
// Ponte de teste da migração: faz o papel do programa do Windows (src-tauri/src/main.rs) para a página aberta num
// navegador sem janela, usando o módulo de salvamento REAL (incluído pelo caminho, sem cópia). Cada processo é uma
// "abertura do programa": as cópias conhecidas (`CONHECIDAS`) valem só enquanto ele roda, como no programa.
//
// Com a característica "v210", usa o salvamento.rs da tag v2.1.0 (extraído para v2.1.0/ por preparar.sh) e o início
// da 2.1.0, que só entregava o arquivo principal: serve para criar os dados de quem atualiza da 2.1.0.
//
// Uso: ponte-salvamento <pasta de dados> <porta>
// Pedidos (HTTP, só em 127.0.0.1), corpo e resposta em JSON:
//   POST /inicio            → { "js": o script de início, montado como em main.rs }
//   POST /salvar_circuito   { texto }                              → como o comando do mesmo nome
//   POST /migrar_circuitos  { texto, copias, reiniciarRevisao }    → como o comando do mesmo nome
//   POST /fim               → encerra a ponte
// Resposta: { "ok": true, "resultado": ... } ou { "ok": false, "erro": "..." }.
#![allow(dead_code)]

#[cfg(not(feature = "v210"))]
#[path = "../../../../src-tauri/src/salvamento.rs"]
mod salvamento;
#[cfg(feature = "v210")]
#[path = "../v2.1.0/salvamento.rs"]
mod salvamento;

use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpListener;
use std::path::{Path, PathBuf};

/// O script de início da 2.1.0 (main.rs da tag v2.1.0).
#[cfg(feature = "v210")]
fn inicio(dados: &Path) -> String {
    let salvo = salvamento::ler(dados).unwrap_or_default();
    format!("window.__BANCADA_CIRCUITO__ = {};", Value::String(salvo))
}

/// O mesmo script de início de main.rs (linhas de `main`, entre `candidatos` e `inicio`).
#[cfg(not(feature = "v210"))]
fn inicio(dados: &Path) -> String {
    let (principal, outras): (Vec<_>, Vec<_>) = salvamento::candidatos(dados).into_iter().partition(|c| c.principal);
    let (salvo, hora) = principal.into_iter().next().map(|c| (c.texto, c.hora)).unwrap_or_default();
    let reservas: Vec<Value> = outras.into_iter()
        .map(|c| json!({ "texto": c.texto, "hora": c.hora, "origem": c.origem })).collect();
    format!("window.__BANCADA_CIRCUITO__ = {}; window.__BANCADA_CIRCUITO_HORA__ = {hora}; \
        window.__BANCADA_RESERVAS__ = {}; window.__BANCADA_REVISOES_REINICIADAS__ = {}; \
        window.__BANCADA_PERGUNTAR_MIGRACAO__ = {};",
        Value::String(salvo), Value::Array(reservas), salvamento::reinicios(dados),
        salvamento::perguntar_migracao(dados))
}

/// O mesmo corpo do comando `migrar_circuitos` de main.rs.
#[cfg(not(feature = "v210"))]
fn migrar_circuitos(dados: &Path, texto: String, copias: Vec<Value>, reiniciar_revisao: bool) -> Result<Value, String> {
    let campo = |c: &Value, nome: &str| c.get(nome).and_then(Value::as_str).map(str::to_string);
    let pares = copias.iter().map(|c| match (campo(c, "original"), campo(c, "envelope")) {
        (Some(original), Some(envelope)) => Ok(salvamento::Par { original, envelope }),
        _ => Err("cópia sem original ou sem envelope: nada foi mudado".to_string()),
    }).collect::<Result<Vec<_>, _>>()?;
    salvamento::migrar(dados, &texto, &pares, reiniciar_revisao).map_err(|e| e.to_string())?;
    Ok(json!({ "ok": true }))
}

fn atender(dados: &Path, caminho: &str, corpo: &Value) -> Result<Value, String> {
    let texto = || corpo.get("texto").and_then(Value::as_str).map(str::to_string).ok_or("falta texto".to_string());
    match caminho {
        "/inicio" => Ok(json!({ "js": inicio(dados) })),
        "/salvar_circuito" => salvamento::gravar(dados, &texto()?).map(|_| Value::Null).map_err(|e| e.to_string()),
        #[cfg(not(feature = "v210"))]
        "/migrar_circuitos" => {
            let copias = corpo.get("copias").and_then(Value::as_array).cloned().ok_or("falta copias")?;
            let reiniciar = corpo.get("reiniciarRevisao").and_then(Value::as_bool).ok_or("falta reiniciarRevisao")?;
            migrar_circuitos(dados, texto()?, copias, reiniciar)
        }
        _ => Err(format!("pedido desconhecido: {caminho}")),
    }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let dados = PathBuf::from(&args[1]);
    let ouvinte = TcpListener::bind(("127.0.0.1", args[2].parse::<u16>().unwrap())).unwrap();
    println!("pronta");
    for conexao in ouvinte.incoming().flatten() {
        let mut leitor = BufReader::new(conexao.try_clone().unwrap());
        let mut linha = String::new();
        if leitor.read_line(&mut linha).is_err() { continue; }
        let caminho = linha.split_whitespace().nth(1).unwrap_or("").to_string();
        let mut tamanho = 0usize;
        loop {
            let mut h = String::new();
            if leitor.read_line(&mut h).is_err() || h.trim().is_empty() { break; }
            if let Some(v) = h.to_ascii_lowercase().strip_prefix("content-length:") { tamanho = v.trim().parse().unwrap_or(0); }
        }
        let mut corpo = vec![0u8; tamanho];
        let _ = leitor.read_exact(&mut corpo);
        let corpo: Value = serde_json::from_slice(&corpo).unwrap_or(Value::Null);
        let fim = caminho == "/fim";
        let resposta = if fim { json!({ "ok": true }) } else {
            match atender(&dados, &caminho, &corpo) {
                Ok(r) => json!({ "ok": true, "resultado": r }),
                Err(e) => json!({ "ok": false, "erro": e }),
            }
        };
        let texto = resposta.to_string();
        let mut saida = conexao;
        let _ = write!(saida, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{texto}", texto.len());
        if fim { break; }
    }
}
