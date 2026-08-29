
(()=>{
 "use strict";
 window.lifeArchiveMarkAchievementCheck=function(check,done){
   if(!check||typeof check!=="object")return check;
   check.done=!!done;
   if(done){
     if(!check.doneAt)check.doneAt=Date.now();
   }else{
     check.doneAt=0;
   }
   return check;
 };
 window.lifeArchiveAchievementCheckDate=function(check){
   if(!check?.doneAt)return "";
   try{return new Date(check.doneAt).toLocaleDateString("ja-JP")}catch(e){return ""}
 };
})();
