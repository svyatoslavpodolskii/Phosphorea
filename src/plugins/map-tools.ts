import type {Plugin} from './api';
export const mapTools:Plugin[]=[
 {manifest:{id:'builtin.ambient',name:'Мягкие линзы',version:'1.0.0',apiVersion:1,permissions:['graph'],description:'Во всех состояниях сохраняет окружение: остальные атомы становятся серыми и полупрозрачными.'},activate:app=>{app.graph.registerMapTool({id:'ambient',name:'Мягкие линзы',kind:'ambient-lens'});}},
 {manifest:{id:'builtin.lasso',name:'Волшебное лассо',version:'1.0.0',apiVersion:1,permissions:['graph'],description:'Зажмите пустое место и обведите атомы. Отпустите без движения, чтобы создать атом. На компьютере также работает Shift + обведение. Выделенные атомы переносятся вместе.'},activate:app=>{app.graph.registerMapTool({id:'lasso',name:'Волшебное лассо',kind:'lasso'});}}
];
