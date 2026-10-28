; Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
; Instalador do Bancada Livre (Inno Setup 6). Compilado por instalador\build.ps1, que passa a versão lida do
; package.json em /DAppVer (a versão não fica escrita aqui, para não ficar para trás).
#ifndef AppVer
  #error Compile pelo instalador\build.ps1 (ele informa /DAppVer=<versão>)
#endif
#define Dist "..\pacote\BancadaLivre"

[Setup]
AppId={{B3D1A6E0-5C2F-4A87-9E14-7F0C2B8D4E61}
AppName=Bancada Livre
AppVersion={#AppVer}
AppVerName=Bancada Livre {#AppVer}
AppPublisher=Heraldo Antunes (projeto livre)
AppCopyright=Copyright (c) 2026 Heraldo Antunes - Licença MIT
VersionInfoVersion={#AppVer}.0
VersionInfoDescription=Instalador do Bancada Livre
; instalação só para o usuário: não pede administrador
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
DefaultDirName={autopf}\Bancada Livre
DefaultGroupName=Bancada Livre
DisableProgramGroupPage=yes
LicenseFile=licenca-instalador.txt
SetupIconFile=bancada-livre.ico
UninstallDisplayIcon={app}\BancadaLivre.exe
UninstallDisplayName=Bancada Livre {#AppVer}
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
Compression=lzma2/max
SolidCompression=yes
; avisa o Windows no fim para refazer o cache de ícones
ChangesAssociations=yes
OutputDir=..\pacote
OutputBaseFilename=Instalar-BancadaLivre-{#AppVer}

[Languages]
Name: "ptbr"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na Área de Trabalho"; GroupDescription: "Atalhos:"

[Files]
Source: "{#Dist}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
; AppUserModelID igual ao que o Edge dá à janela do simulador (ver IdDaJanela): o pino da barra de tarefas fica com o
; ícone do Bancada Livre, não com o do Edge
Name: "{autoprograms}\Bancada Livre"; Filename: "{app}\BancadaLivre.exe"; Comment: "Simulador didático de lógica digital"; AppUserModelID: "{code:IdDaJanela}"
Name: "{autoprograms}\Desinstalar o Bancada Livre"; Filename: "{uninstallexe}"; Comment: "Remove o programa; os circuitos salvos ficam guardados"
Name: "{autodesktop}\Bancada Livre"; Filename: "{app}\BancadaLivre.exe"; Tasks: desktopicon; AppUserModelID: "{code:IdDaJanela}"

[Run]
Filename: "{app}\BancadaLivre.exe"; Description: "Abrir o Bancada Livre agora"; Flags: nowait postinstall skipifsilent

[Messages]
ptbr.WelcomeLabel2=Este assistente vai instalar o [name/ver] no seu computador.%n%nÉ um programa livre e gratuito (licença MIT), que funciona sem internet. Os circuitos que você salvar ficam onde você escolher e são mantidos se você desinstalar.

[Code]
// Mesma regra de id_da_janela no lancador.py: o Edge identifica a janela aberta com --app=file:///<html> (perfil
// padrão) por "MSEdge._" mais o caminho da URL; acima de 31 caracteres, só os 15 primeiros e os 16 últimos.
// O caminho vai codificado como o pathlib do Python faz (letras, algarismos e "-._~/" ficam; o resto vira %XX em UTF-8).
function Hex2(B: Integer): String;
begin
  Result := '%' + Format('%.2X', [B]);
end;

function CodificarUrl(const S: String): String;
var
  I, C: Integer;
begin
  Result := '';
  for I := 1 to Length(S) do begin
    C := Ord(S[I]);
    if ((C >= Ord('A')) and (C <= Ord('Z'))) or ((C >= Ord('a')) and (C <= Ord('z'))) or
       ((C >= Ord('0')) and (C <= Ord('9'))) or (Pos(S[I], '-._~/') > 0) then
      Result := Result + S[I]
    else if C < $80 then
      Result := Result + Hex2(C)
    else if C < $800 then
      Result := Result + Hex2($C0 or (C shr 6)) + Hex2($80 or (C and $3F))
    else
      Result := Result + Hex2($E0 or (C shr 12)) + Hex2($80 or ((C shr 6) and $3F)) + Hex2($80 or (C and $3F));
  end;
end;

function IdDaJanela(Param: String): String;
var
  Html, Nome: String;
begin
  Html := ExpandConstant('{app}') + '\_internal\bancada-livre.html';
  StringChangeEx(Html, '\', '/', True);
  Nome := '_/' + Copy(Html, 1, 2) + CodificarUrl(Copy(Html, 3, Length(Html)));
  if Length(Nome) > 31 then
    Nome := Copy(Nome, 1, 15) + Copy(Nome, Length(Nome) - 15, 16);
  Result := 'MSEdge.' + Nome;
end;
