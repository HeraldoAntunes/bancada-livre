// Bancada Livre · © 2026 Heraldo Antunes · SPDX-License-Identifier: MIT
/* eslint-disable */
// @ts-nocheck: texto do auditor mantido como ele escreveu (sem os tipos do projeto); só a execução vale aqui
// Testes didáticos do auditor independente (rodada 1, 29/10/2026), como regressão: 3.048 avaliações de portas contra a
// aritmética, o somador completo dos exemplos e o FF D. Só os caminhos de importação mudaram.
import {expect,it} from 'vitest'
import {evalGate} from '../engine/gates'
import {circuitTruthTable} from '../engine/truthTable'
import {EXAMPLES} from '../examples'
import {assentar} from '../engine/sequencial'
it('portas AND/OR/XOR e inversas: todas as entradas binárias de 2 a 8 bits',()=>{
 let vectors=0
 for(let n=2;n<=8;n++) for(let m=0;m<2**n;m++){
  const bits=Array.from({length:n},(_,i)=>(m>>i)&1),sum=bits.reduce((a,b)=>a+b,0)
  const expected={AND:Number(sum===n),OR:Number(sum>0),XOR:sum%2,NAND:Number(sum!==n),NOR:Number(sum===0),XNOR:1-sum%2}
  for(const [gate,value] of Object.entries(expected)){expect(evalGate(gate,bits)).toBe(value);vectors++}
 }
 for(const bit of [0,1]){expect(evalGate('NOT',[bit])).toBe(1-bit);expect(evalGate('BUFFER',[bit])).toBe(bit)}
 expect(vectors).toBe(3048)
})
it('somador completo: tabela de 8 linhas corresponde à soma aritmética A+B+Cin',()=>{
 const ex=EXAMPLES.find(e=>e.name.toLowerCase().includes('somador completo'))
 expect(ex).toBeDefined()
 const t=circuitTruthTable(ex.components,ex.wires)
 expect(t.rows).toHaveLength(8)
 const s=t.outputs.findIndex(o=>o.name==='S'),carry=t.outputs.findIndex(o=>o.name==='Cout')
 expect(s).toBeGreaterThanOrEqual(0);expect(carry).toBeGreaterThanOrEqual(0)
 for(const row of t.rows){const sum=row.inputs.reduce((a,b)=>a+b,0);expect(row.outputs[s]).toBe(sum%2);expect(row.outputs[carry]).toBe(Math.floor(sum/2))}
})
it('FF D: segue D apenas na subida e conserva na descida',()=>{
 let cs=[{id:'d',type:'SWITCH',x:0,y:0,state:0},{id:'ck',type:'SWITCH',x:0,y:0,state:0},{id:'f',type:'FF_D',x:0,y:0,q:0,clkVisto:0}]
 const wires=[{id:'w1',from:{comp:'d',pin:'out'},to:{comp:'f',pin:'d'}},{id:'w2',from:{comp:'ck',pin:'out'},to:{comp:'f',pin:'clk'}}]
 for(const [d,clk,expected] of [[1,0,0],[1,1,1],[0,1,1],[0,0,1],[0,1,0]]){
  cs=assentar(cs.map(c=>c.id==='d'?{...c,state:d}:c.id==='ck'?{...c,state:clk}:c),wires).components
  expect(cs.find(c=>c.id==='f').q).toBe(expected)
 }
})
