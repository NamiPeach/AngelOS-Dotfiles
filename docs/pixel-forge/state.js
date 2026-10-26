(function(){
 const key='angelos-pixel-forge-demo-v1';
 let state=null;
 try{state=JSON.parse(localStorage.getItem(key)||'null');}catch(_){}
 window.openai={widgetState:state,async setWidgetState(next){this.widgetState=next;try{localStorage.setItem(key,JSON.stringify(next));}catch(_){}}};
})();
