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
; AppUserModelID igual ao que o lancador.py põe na janela: o pino da barra de tarefas fica com o Bancada Livre, não com o Edge
Name: "{autoprograms}\Bancada Livre"; Filename: "{app}\BancadaLivre.exe"; Comment: "Simulador didático de lógica digital"; AppUserModelID: "BancadaLivre"
Name: "{autoprograms}\Desinstalar o Bancada Livre"; Filename: "{uninstallexe}"; Comment: "Remove o programa; os circuitos salvos ficam guardados"
Name: "{autodesktop}\Bancada Livre"; Filename: "{app}\BancadaLivre.exe"; Tasks: desktopicon; AppUserModelID: "BancadaLivre"

[Run]
Filename: "{app}\BancadaLivre.exe"; Description: "Abrir o Bancada Livre agora"; Flags: nowait postinstall skipifsilent

[Messages]
ptbr.WelcomeLabel2=Este assistente vai instalar o [name/ver] no seu computador.%n%nÉ um programa livre e gratuito (licença MIT), que funciona sem internet. Os circuitos que você salvar ficam onde você escolher e são mantidos se você desinstalar.
