// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
/* eslint-disable */
// @ts-nocheck: texto do auditor mantido como ele escreveu (sem os tipos do projeto); só a execução vale aqui
// Testes do auditor independente (rodada 1, 29/10/2026), trazidos como regressão: só os caminhos de importação mudaram
// (@audit/... para os módulos do projeto); as asserções são as dele. Fora: o replay integral do clock (NÃO PRODUÇÃO) e o
// teste do lançador em Python (saiu na 2.1.0). Origem: relatorios/bancada-livre/testes/independente.test.ts e didatica.test.ts.
import {afterEach, beforeEach, expect, it, vi} from 'vitest'
beforeEach(() => { vi.resetModules(); vi.useFakeTimers() })
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
async function ambiente() {
 const data = new Map<string,string>()
 vi.stubGlobal('localStorage',{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v)})
 const events = new Map<string,Function[]>()
 vi.stubGlobal('window',{setTimeout,clearTimeout,addEventListener:(k:string,f:Function)=>events.set(k,[...(events.get(k)??[]),f])})
 vi.stubGlobal('document',{visibilityState:'visible',addEventListener:(k:string,f:Function)=>events.set(k,[...(events.get(k)??[]),f])})
 const {useCircuit} = await import('../state/store')
 return {data,useCircuit,st:()=>useCircuit.getState(),events}
}
it('controle: circuito estático persiste após 400 ms',async()=>{
 const {data,st}=await ambiente(); st().addComponent('SWITCH',0,0); vi.advanceTimersByTime(401)
 expect(JSON.parse(data.get('simulador-portas:autosave')!).components).toHaveLength(1)
})
it('BL-01: circuito com CLOCK 2 Hz precisa persistir enquanto roda',async()=>{
 const {data,st}=await ambiente(); st().addComponent('CLOCK',0,0); st().setClockFreq(st().components[0].id,2)
 for(let i=0;i<100;i++){ vi.advanceTimersByTime(50); st().tickClocks(50) }
 expect(data.has('simulador-portas:autosave')).toBe(true)
})
it('BL-01b: fechar antes de 400 ms precisa descarregar mudança pendente',async()=>{
 const {data,st,events}=await ambiente(); st().addComponent('SWITCH',0,0)
 for(const f of events.get('pagehide')??[]) f({type:'pagehide'})
 expect(data.has('simulador-portas:autosave')).toBe(true)
})
it('BL-02: ID numérico acima de MAX_SAFE_INTEGER não pode causar colisão futura',async()=>{
 const {st}=await ambiente()
 const err=st().loadJSON(JSON.stringify({version:1,components:[{id:'c9007199254740992',type:'SWITCH',x:0,y:0}],wires:[]}))
 if(err) return
 st().addComponent('LED',100,0); st().addComponent('LED',200,0)
 const ids=st().components.map(c=>c.id)
 expect(new Set(ids).size).toBe(ids.length)
})
it('BL-03: 3 segundos atrasados equivalem a 60 passos de 50 ms',async()=>{
 const {st,useCircuit}=await ambiente()
 const init=()=>useCircuit.setState({clockMs:0, components:[{id:'ck',type:'CLOCK',freq:1,state:0,x:0,y:0},{id:'um',type:'LEVEL_HIGH',x:0,y:0},{id:'f',type:'FF_T',q:0,clkVisto:0,x:0,y:0}],wires:[{id:'w1',from:{comp:'ck',pin:'out'},to:{comp:'f',pin:'clk'}},{id:'w2',from:{comp:'um',pin:'out'},to:{comp:'f',pin:'t'}}]})
 init(); st().tickClocks(3000); const atrasado=st().components.find(c=>c.id==='f')!.q
 init(); for(let i=0;i<60;i++) st().tickClocks(50); const emPassos=st().components.find(c=>c.id==='f')!.q
 expect(atrasado).toBe(emPassos)
})
it('controle: JSON inválido não altera circuito nem histórico',async()=>{
 const {st}=await ambiente(); st().addComponent('SWITCH',0,0); const before=st().toJSON(), history=st().past.length
 expect(st().loadJSON('{"components":[null],"wires":[]}')).toMatch(/inválido/)
 expect(st().toJSON()).toBe(before); expect(st().past.length).toBe(history)
})
it('controle: round-trip mantém circuito com orientação',async()=>{
 const {st}=await ambiente(); st().addComponent('AND',0,0); st().girar(st().components[0].id); const before=st().toJSON()
 st().clearAll(); expect(st().loadJSON(before)).toBeNull(); expect(st().toJSON()).toBe(before)
})

it('BL-04: CSV exportado com rótulo contendo ponto e vírgula deve reabrir',async()=>{
 const {st}=await ambiente()
 let captured: Blob|undefined
 vi.spyOn(URL,'createObjectURL').mockImplementation((blob:Blob)=>{captured=blob;return 'blob:audit'})
 vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{})
 vi.stubGlobal('document',{createElement:()=>({click:()=>{}})})
 const {executar}=await import('../comandos')
 st().loadJSON(JSON.stringify({version:1,components:[{id:'a',type:'SWITCH',x:0,y:0,label:'A;B'},{id:'b',type:'LED',x:100,y:0,label:'S'}],wires:[{id:'w',from:{comp:'a',pin:'out'},to:{comp:'b',pin:'in'}}]}))
 expect(executar('tabela.exportar_csv').ok).toBe(true)
 const csv=await captured!.text()
 expect(executar('gabarito.importar',{csv}).ok).toBe(true)
})
it('controle: CSV simples exportado reabre como gabarito',async()=>{
 const {st}=await ambiente()
 let captured: Blob|undefined
 vi.spyOn(URL,'createObjectURL').mockImplementation((blob:Blob)=>{captured=blob;return 'blob:audit'})
 vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{})
 vi.stubGlobal('document',{createElement:()=>({click:()=>{}})})
 const {executar}=await import('../comandos')
 st().loadJSON(JSON.stringify({version:1,components:[{id:'a',type:'SWITCH',x:0,y:0,label:'A'},{id:'b',type:'LED',x:100,y:0,label:'S'}],wires:[{id:'w',from:{comp:'a',pin:'out'},to:{comp:'b',pin:'in'}}]}))
 expect(executar('tabela.exportar_csv').ok).toBe(true)
 expect(executar('gabarito.importar',{csv:await captured!.text()}).ok).toBe(true)
 const comparison=executar('gabarito.conferir'); expect(comparison).toMatchObject({ok:true,resultado:{certas:2,total:2}})
})
